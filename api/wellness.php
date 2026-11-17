<?php
/* ============================================================
   PregnaCare — api/wellness.php
   Endpoints:
     GET  ?section=hospital_bag      -> Bag items grouped by category
     POST ?section=hospital_bag      -> toggle, add, delete item
     GET  ?section=medications       -> Meds list with today's taken status
     POST ?section=medications       -> log_taken, add_medication
     GET  ?section=birth_plan        -> Current birth plan preferences
     POST ?section=birth_plan        -> Update birth plan
     GET  ?section=weight_gain       -> Weight logs + IOM recommended range
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');
$section = $_GET['section'] ?? 'hospital_bag';
$method = $_SERVER['REQUEST_METHOD'];
$input = get_json_input();

// ------------------------------------------------------------------
// 1. HOSPITAL BAG CHECKLIST (Scoped to Active Pregnancy)
// ------------------------------------------------------------------
if ($section === 'hospital_bag') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);
    if ($method === 'GET') {
        // Ensure default items exist for active pregnancy
        seed_default_hospital_bag($pdo, $u['id'], $actPregId);

        $stmt = $pdo->prepare("SELECT * FROM hospital_bag_items WHERE user_id = ? AND pregnancy_id = ? ORDER BY sort_order ASC, id ASC");
        $stmt->execute([$u['id'], $actPregId]);
        $items = $stmt->fetchAll();

        $grouped = [];
        $totalChecked = 0;
        foreach ($items as $item) {
            $cat = $item['category'] ?: 'General';
            $label = $item['label'];
            $grouped[$cat][] = [
                'id' => $item['id'],
                'label' => $label,
                'isChecked' => (bool)$item['is_checked'],
                'isCustom' => (bool)$item['is_custom'],
            ];
            if ($item['is_checked']) $totalChecked++;
        }

        json_success([
            'categories' => $grouped,
            'totalItems' => count($items),
            'checkedItems' => $totalChecked,
            'completionPercentage' => count($items) ? round(($totalChecked / count($items)) * 100) : 0,
        ]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? 'toggle');

        if ($action === 'toggle') {
            $id = $input['id'] ?? null;
            if (!$id) json_error('Item ID required', 422);

            $stmt = $pdo->prepare("UPDATE hospital_bag_items SET is_checked = NOT is_checked WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);

            // If all items are now checked, mark any unread hospital_bag notification as read
            $stmtCount = $pdo->prepare("SELECT COUNT(*) as total, COALESCE(SUM(is_checked), 0) as checked FROM hospital_bag_items WHERE user_id = ? AND pregnancy_id = ?");
            $stmtCount->execute([$u['id'], $actPregId]);
            $r = $stmtCount->fetch();
            if ($r && (int)$r['total'] > 0 && (int)$r['checked'] >= (int)$r['total']) {
                $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND kind = 'hospital_bag'")->execute([$u['id']]);
            }

            json_success([], 'Item toggled');
        } elseif ($action === 'add') {
            $label = trim($input['label'] ?? '');
            $cat = trim($input['category'] ?? 'General');
            if (empty($label)) json_error('Item label required', 422);

            $id = uid('bag');
            $stmt = $pdo->prepare("INSERT INTO hospital_bag_items (id, user_id, pregnancy_id, label, category, is_checked, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, 0, 1, 99)");
            $stmt->execute([$id, $u['id'], $actPregId, $label, $cat]);
            json_success(['id' => $id, 'label' => $label, 'category' => $cat], 'Item added', 201);
        } elseif ($action === 'delete') {
            $id = $input['id'] ?? ($_GET['id'] ?? null);
            if (!$id) json_error('Item ID required', 422);

            $stmt = $pdo->prepare("DELETE FROM hospital_bag_items WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);
            json_success([], 'Item deleted');
        }
    }
}

// ------------------------------------------------------------------
// 2. MEDICATIONS & VITAMINS
// ------------------------------------------------------------------
if ($section === 'medications') {
    $today = today_iso();

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT m.*, 
                                      (SELECT taken FROM medication_logs l WHERE l.medication_id = m.id AND l.date = ?) as taken_today,
                                      (SELECT taken_at FROM medication_logs l WHERE l.medication_id = m.id AND l.date = ?) as taken_at
                               FROM medications m 
                               WHERE m.user_id = ? AND m.active = 1
                               ORDER BY m.name");
        $stmt->execute([$today, $today, $u['id']]);
        $meds = $stmt->fetchAll();

        $formatted = [];
        foreach ($meds as $m) {
            $formatted[] = [
                'id' => $m['id'],
                'name' => $m['name'],
                'dosage' => $m['dosage'],
                'scheduleTime' => $m['schedule_time'],
                'takenToday' => !empty($m['taken_today']),
                'takenAt' => $m['taken_at'],
            ];
        }

        json_success(['medications' => $formatted]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? 'toggle');

        if ($action === 'toggle' || $action === 'log_taken') {
            $medId = $input['medication_id'] ?? null;
            if (!$medId) json_error('Medication ID required', 422);

            // Check if already taken today
            $stmt = $pdo->prepare("SELECT id, taken FROM medication_logs WHERE medication_id = ? AND date = ?");
            $stmt->execute([$medId, $today]);
            $existing = $stmt->fetch();

            if ($existing) {
                $newTaken = $existing['taken'] ? 0 : 1;
                $stmt = $pdo->prepare("UPDATE medication_logs SET taken = ?, taken_at = ? WHERE id = ?");
                $stmt->execute([$newTaken, $newTaken ? now_iso() : null, $existing['id']]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO medication_logs (id, medication_id, user_id, date, taken, taken_at) VALUES (?, ?, ?, ?, 1, ?)");
                $stmt->execute([uid('mdl'), $medId, $u['id'], $today, now_iso()]);
            }
            json_success([], 'Medication status updated');
        } elseif ($action === 'add') {
            $name = trim($input['name'] ?? '');
            $dosage = trim($input['dosage'] ?? '');
            $schedule = trim($input['schedule_time'] ?? 'Daily');
            if (empty($name)) json_error('Medication name required', 422);

            $id = uid('med');
            $stmt = $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?, ?, ?, ?, ?, 1)");
            $stmt->execute([$id, $u['id'], $name, $dosage, $schedule]);
            json_success(['id' => $id, 'name' => $name], 'Medication added', 201);
        } elseif ($action === 'delete' || $action === 'deactivate') {
            $medId = $input['medication_id'] ?? ($input['id'] ?? ($_GET['id'] ?? null));
            if ($medId) {
                $pdo->prepare("UPDATE medications SET active = 0 WHERE id = ? AND user_id = ?")->execute([$medId, $u['id']]);
                json_success([], 'Medication removed');
            } else {
                json_error('Medication ID required', 422);
            }
        }
    }
}

// ------------------------------------------------------------------
// 3. BIRTH PLAN (Scoped to Active Pregnancy)
// ------------------------------------------------------------------
if ($section === 'birth_plan') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM birth_plans WHERE user_id = ? AND pregnancy_id = ?");
        $stmt->execute([$u['id'], $actPregId]);
        $plan = $stmt->fetch() ?: [
            'delivery_location' => '',
            'support_people' => '',
            'pain_management' => '',
            'feeding_preference' => '',
            'who_cuts_cord' => '',
            'skin_to_skin' => 1,
            'special_requests' => '',
        ];
        json_success(['birthPlan' => $plan]);
    }

    if ($method === 'POST') {
        $stmtEx = $pdo->prepare("SELECT id FROM birth_plans WHERE user_id = ? AND pregnancy_id = ?");
        $stmtEx->execute([$u['id'], $actPregId]);
        $bpId = $stmtEx->fetchColumn() ?: uid('bp');

        $stmt = $pdo->prepare("INSERT INTO birth_plans (id, user_id, pregnancy_id, delivery_location, support_people, pain_management, feeding_preference, who_cuts_cord, skin_to_skin, special_requests, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                delivery_location = VALUES(delivery_location),
                support_people = VALUES(support_people),
                pain_management = VALUES(pain_management),
                feeding_preference = VALUES(feeding_preference),
                who_cuts_cord = VALUES(who_cuts_cord),
                skin_to_skin = VALUES(skin_to_skin),
                special_requests = VALUES(special_requests),
                updated_at = VALUES(updated_at)");
        $stmt->execute([
            $bpId,
            $u['id'],
            $actPregId,
            $input['delivery_location'] ?? null,
            $input['support_people'] ?? null,
            $input['pain_management'] ?? null,
            $input['feeding_preference'] ?? null,
            $input['who_cuts_cord'] ?? null,
            isset($input['skin_to_skin']) ? (int)$input['skin_to_skin'] : 1,
            $input['special_requests'] ?? null,
            now_iso(),
        ]);
        json_success([], 'Birth plan saved');
    }
}

// ------------------------------------------------------------------
// 4. WEIGHT GAIN GUIDANCE & HISTORY
// ------------------------------------------------------------------
if ($section === 'weight_gain') {
    $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
    $stmt->execute([$u['id']]);
    $profile = $stmt->fetch() ?: [];

    $preWeight = (float)($profile['pre_pregnancy_weight_kg'] ?? ($profile['weight_kg'] ?? 60));
    $height = (float)($profile['height_cm'] ?? 160);
    $preBmi = bmi_of($preWeight, $height);
    $bmiCat = bmi_category($preBmi);

    $stmt = $pdo->prepare("SELECT date, weight_kg FROM monitoring WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date ASC");
    $stmt->execute([$u['id']]);
    $logs = $stmt->fetchAll();

    $lmpTime = !empty($profile['lmp']) ? strtotime($profile['lmp']) : null;
    $history = [];
    foreach ($logs as $l) {
        $week = null;
        if ($lmpTime) {
            $week = max(0, (int)floor((strtotime($l['date']) - $lmpTime) / (7 * 86400)));
        }
        $gainKg = round($l['weight_kg'] - $preWeight, 1);
        $range = $week !== null ? recommended_weight_gain_range($bmiCat, $week) : null;
        $history[] = [
            'date' => $l['date'],
            'weightKg' => (float)$l['weight_kg'],
            'gainKg' => $gainKg,
            'gestationalWeek' => $week,
            'recommendedRange' => $range,
        ];
    }

    json_success([
        'prePregnancyWeightKg' => $preWeight,
        'heightCm' => $height,
        'prePregnancyBmi' => $preBmi,
        'bmiCategory' => $bmiCat,
        'bmiCategoryLabel' => bmi_category_label($bmiCat),
        'weightHistory' => $history,
    ]);
}

// ------------------------------------------------------------------
// 5. PREGNANCY JOURNAL
// ------------------------------------------------------------------
if ($section === 'journal') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM journal_entries WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC");
        $stmt->execute([$u['id'], $actPregId]);
        $entries = $stmt->fetchAll();
        json_success(['entries' => $entries]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? 'add');

        if ($action === 'add') {
            $mood = trim($input['mood'] ?? 'Happy');
            $content = trim($input['content'] ?? '');
            if (empty($content)) json_error('Journal content is required', 422);

            $id = uid('jrn');
            $date = now_iso();
            $stmt = $pdo->prepare("INSERT INTO journal_entries (id, user_id, pregnancy_id, date, mood, content) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $u['id'], $actPregId, $date, $mood, $content]);
            json_success(['id' => $id, 'date' => $date, 'mood' => $mood, 'content' => $content], 'Journal entry saved', 201);
        } elseif ($action === 'delete') {
            $id = $input['id'] ?? ($_GET['id'] ?? null);
            if (!$id) json_error('Entry ID required', 422);

            $stmt = $pdo->prepare("DELETE FROM journal_entries WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);
            json_success([], 'Journal entry deleted');
        }
    }
}

// ------------------------------------------------------------------
// 6. BUMP PHOTO TIMELINE (Scoped to Active Pregnancy)
// ------------------------------------------------------------------
if ($section === 'bump_photos') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM bump_photos WHERE user_id = ? AND pregnancy_id = ? ORDER BY week_number ASC");
        $stmt->execute([$u['id'], $actPregId]);
        $photos = $stmt->fetchAll();
        json_success(['photos' => $photos]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? 'add');

        if ($action === 'add') {
            $weekNumber = (int)($input['week_number'] ?? 20);
            $note = trim($input['note'] ?? '');
            
            // Handle base64 image if provided
            $filename = trim($input['filename'] ?? ('bump_week_' . $weekNumber . '.jpg'));
            if (!empty($input['image_base64'])) {
                $base64_string = $input['image_base64'];
                @list($type, $base64_string) = explode(';', $base64_string);
                @list(, $base64_string)      = explode(',', $base64_string);
                $image_data = base64_decode($base64_string);
                
                if ($image_data) {
                    $uploadDir = __DIR__ . '/../uploads/bumps/' . $u['id'];
                    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
                    $filename = uid('bump') . '.jpg';
                    file_put_contents($uploadDir . '/' . $filename, $image_data);
                }
            }

            $id = uid('bmp');
            $date = today_iso();
            $stmt = $pdo->prepare("INSERT INTO bump_photos (id, user_id, pregnancy_id, week_number, date, filename, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $u['id'], $actPregId, $weekNumber, $date, $filename, $note]);
            json_success(['id' => $id, 'week_number' => $weekNumber, 'date' => $date, 'note' => $note, 'filename' => $filename], 'Bump photo logged', 201);
        } elseif ($action === 'delete') {
            $id = $input['id'] ?? ($_GET['id'] ?? null);
            if (!$id) json_error('Photo ID required', 422);

            $stmt = $pdo->prepare("DELETE FROM bump_photos WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);
            json_success([], 'Bump photo deleted');
        }
    }
}

// ------------------------------------------------------------------
// 7. POSTPARTUM RECOVERY & BABY VACCINATIONS
// ------------------------------------------------------------------
if ($section === 'postpartum') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM postpartum_status WHERE user_id = ?");
        $stmt->execute([$u['id']]);
        $status = $stmt->fetch() ?: [];

        $isPostpartum = !empty($status['is_postpartum']);
        $daysSinceDelivery = null;
        if ($isPostpartum && !empty($status['delivery_date'])) {
            $daysSinceDelivery = (int)floor((time() - strtotime($status['delivery_date'])) / 86400);
        }

        $vaccines = [];
        if ($isPostpartum) {
            $stmt = $pdo->prepare("SELECT * FROM baby_vaccinations WHERE user_id = ? ORDER BY sort_order ASC, id ASC");
            $stmt->execute([$u['id']]);
            $vaccines = $stmt->fetchAll();
        }

        $defaultPreview = [];
        $sortIdx = 1;
        foreach (DEFAULT_VACCINES as $dv) {
            $defaultPreview[] = [
                'id' => 'prev-' . $sortIdx,
                'vaccine_name' => $dv['name'],
                'due_age_label' => $dv['age'],
                'due_date' => null,
                'given' => 0,
                'sort_order' => $sortIdx++
            ];
        }

        $newbornCare = get_user_newborn_care_items($pdo, $u['id'], $actPregId);
        $totalItems = count($newbornCare);
        $completedItems = 0;
        foreach ($newbornCare as $nc) {
            if (!empty($nc['is_completed'])) $completedItems++;
        }
        $pendingItems = $totalItems - $completedItems;
        $percentItems = $totalItems > 0 ? (int)round(($completedItems / $totalItems) * 100) : 0;

        json_success([
            'isPostpartum' => $isPostpartum,
            'daysSinceDelivery' => $daysSinceDelivery,
            'status' => $status,
            'vaccines' => $vaccines,
            'previewChecklist' => $defaultPreview,
            'newbornCareChecklist' => $newbornCare,
            'newbornCareStats' => [
                'total' => $totalItems,
                'completed' => $completedItems,
                'pending' => $pendingItems,
                'percent' => $percentItems,
            ],
        ]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? '');

        if ($action === 'mark_delivered') {
            $deliveryDate = !empty($input['delivery_date']) ? $input['delivery_date'] : today_iso();
            $deliveryType = trim($input['delivery_type'] ?? 'Vaginal');
            $babyName = trim($input['baby_name'] ?? '');

            $stmt = $pdo->prepare("REPLACE INTO postpartum_status (user_id, is_postpartum, delivery_date, delivery_type, baby_name, recovery_notes)
                                   VALUES (?, 1, ?, ?, ?, '')");
            $stmt->execute([$u['id'], $deliveryDate, $deliveryType, $babyName]);

            // Seed Philippine EPI baby vaccinations
            seed_default_vaccinations($pdo, $u['id'], $deliveryDate);

            // Also ensure newborn care checklist is seeded
            seed_default_newborn_care($pdo, $u['id'], $actPregId);

            json_success([], 'Delivery marked, baby vaccination and newborn care checklists initialized');
        } elseif ($action === 'update_notes') {
            $notes = trim($input['recovery_notes'] ?? '');
            $stmt = $pdo->prepare("UPDATE postpartum_status SET recovery_notes = ? WHERE user_id = ?");
            $stmt->execute([$notes, $u['id']]);
            json_success([], 'Recovery notes saved');
        } elseif ($action === 'toggle_newborn_care') {
            $itemId = $input['item_id'] ?? null;
            if (!$itemId) json_error('Item ID required', 422);

            $completed = isset($input['is_completed']) ? (int)$input['is_completed'] : 1;
            toggle_newborn_care_item($pdo, $u['id'], $itemId, $completed, $actPregId);

            $newbornCare = get_user_newborn_care_items($pdo, $u['id'], $actPregId);
            $totalItems = count($newbornCare);
            $completedItems = 0;
            foreach ($newbornCare as $nc) {
                if (!empty($nc['is_completed'])) $completedItems++;
            }
            $pendingItems = $totalItems - $completedItems;
            $percentItems = $totalItems > 0 ? (int)round(($completedItems / $totalItems) * 100) : 0;

            json_success([
                'newbornCareChecklist' => $newbornCare,
                'newbornCareStats' => [
                    'total' => $totalItems,
                    'completed' => $completedItems,
                    'pending' => $pendingItems,
                    'percent' => $percentItems,
                ]
            ], 'Newborn care item updated');
        } elseif ($action === 'toggle_vaccine') {
            $vaxId = $input['vax_id'] ?? null;
            if (!$vaxId) json_error('Vaccine ID required', 422);

            $given = isset($input['given']) ? (int)$input['given'] : 1;
            toggle_baby_vaccine_item($pdo, $u['id'], $vaxId, $given);
            $givenDate = $given ? today_iso() : null;

            json_success(['given' => $given, 'given_date' => $givenDate], 'Vaccine updated');
        }
    }
}

// ------------------------------------------------------------------
// 8. EDUCATION HUB GUIDANCE DATA
// ------------------------------------------------------------------
if ($section === 'education') {
    $categoryMeta = [
        'healthy_living'       => ['icon' => 'leaf', 'title' => 'Healthy Living'],
        'prenatal_testing'     => ['icon' => 'flask', 'title' => 'Prenatal Testing'],
        'symptoms_emergencies' => ['icon' => 'warning', 'title' => 'Symptoms & Emergencies'],
        'hospital_information' => ['icon' => 'business', 'title' => 'Hospital Information'],
        'faqs'                 => ['icon' => 'help-circle', 'title' => 'FAQs'],
    ];

    $guidance = [
        1 => [
            'label' => 'First Trimester',
            'categories' => [
                'healthy_living' => [
                    'explain' => "Small changes now support your baby's earliest development.",
                    'recommendations' => ['Eat balanced and nutrient-rich meals.', 'Include folate-rich foods.', 'Drink enough water.', 'Gentle walking and pregnancy-safe activities may be appropriate.'],
                    'reminders' => ['Avoid alcohol, smoking, and unsafe medications.', 'Start prescribed prenatal vitamins with folic acid.'],
                ],
                'prenatal_testing' => [
                    'explain' => 'Early testing confirms your pregnancy and sets a baseline for your care.',
                    'recommendations' => ['Confirm pregnancy and estimate gestational age.', 'Schedule your first prenatal/OB visit.', 'Discuss existing medical conditions with your OB-GYN.', 'Ask about a dating ultrasound.'],
                    'reminders' => ['Bring a list of current medications and supplements to your first visit.'],
                ],
                'symptoms_emergencies' => [
                    'explain' => 'Most early symptoms are normal, but some need same-day care.',
                    'recommendations' => ['Monitor early pregnancy symptoms like nausea and fatigue.', 'Track any spotting or cramping.'],
                    'reminders' => ["Heavy bleeding, severe abdominal pain, fainting, or severe vomiting/dehydration need prompt medical attention — don't wait for your next visit."],
                ],
                'hospital_information' => [
                    'explain' => "You likely won't need delivery logistics yet, but a little prep now helps.",
                    'recommendations' => ["Save your OB-GYN's direct line.", 'Save your delivery hospital contact in your contacts.'],
                    'reminders' => ["Confirm which hospital or birthing center your OB-GYN is affiliated with."],
                ],
                'faqs' => [
                    'explain' => 'Answers to what most people ask in the first trimester.',
                    'recommendations' => ['Is spotting normal? Light spotting can happen but should always be reported.', 'When will morning sickness improve? For most people, by around week 14.'],
                    'reminders' => ["Any bleeding or severe pain should be reported to your OB-GYN, not just tracked at home."],
                ],
            ],
        ],
        2 => [
            'label' => 'Second Trimester',
            'categories' => [
                'healthy_living' => [
                    'explain' => 'Your nutrient needs increase as your baby grows quickly this trimester.',
                    'recommendations' => ['Continue iron, folic acid, calcium, and other prescribed supplements.', 'Eat protein-rich, iron-rich, and calcium-rich foods.', 'Maintain adequate hydration.', 'Walking, prenatal yoga, and other pregnancy-safe exercises may be appropriate.'],
                    'reminders' => ['Avoid exercises flat on your back after the first trimester.'],
                ],
                'prenatal_testing' => [
                    'explain' => 'Several key screenings happen in the second trimester.',
                    'recommendations' => ['Follow recommended prenatal tests and screenings.', 'Attend your anatomy scan ultrasound (~18–20 weeks).', 'Complete glucose screening as scheduled.'],
                    'reminders' => ["Ask your OB-GYN to explain any results you don't understand."],
                ],
                'symptoms_emergencies' => [
                    'explain' => 'Fetal movement becomes a key thing to track this trimester.',
                    'recommendations' => ['Monitor fetal movement as it becomes noticeable.', 'Monitor blood pressure and weight as advised.'],
                    'reminders' => ['Vaginal bleeding, severe abdominal pain, severe headache with vision changes, sudden swelling, leaking fluid, or concerning changes in fetal movement should not be ignored.'],
                ],
                'hospital_information' => [
                    'explain' => "Start getting familiar with where you'll deliver.",
                    'recommendations' => ["Research your delivery hospital's labor & delivery unit.", 'Ask about registration or pre-admission paperwork.'],
                    'reminders' => ["Save your OB-GYN's office number and emergency contact for quick access."],
                ],
                'faqs' => [
                    'explain' => 'Common second-trimester questions.',
                    'recommendations' => ['When will I feel the baby move? Most people start feeling movement between 18–22 weeks.', 'Is it safe to travel? Usually yes, but check with your OB-GYN for your specific situation.'],
                    'reminders' => ["Get familiar with your baby's typical movement pattern so you'll notice changes."],
                ],
            ],
        ],
        3 => [
            'label' => 'Third Trimester',
            'categories' => [
                'healthy_living' => [
                    'explain' => 'Comfort and preparation take priority as delivery approaches.',
                    'recommendations' => ['Continue iron and calcium as prescribed.', 'Eat small frequent meals if more comfortable.', 'Gentle walking and pregnancy-safe exercises may be appropriate.'],
                    'reminders' => ["Save higher-intensity activity for after delivery unless cleared by your OB-GYN."],
                ],
                'prenatal_testing' => [
                    'explain' => 'Visits become more frequent to monitor you and your baby closely.',
                    'recommendations' => ['Attend weekly/biweekly OB visits as advised.', 'Count/monitor fetal movements as instructed.'],
                    'reminders' => ['Ask about Group B Strep testing, usually done around 36–37 weeks.'],
                ],
                'symptoms_emergencies' => [
                    'explain' => 'Some symptoms this trimester are urgent and require immediate care.',
                    'recommendations' => ['Count fetal movements as instructed.', 'Watch for regular, painful uterine contractions.'],
                    'reminders' => ['Heavy vaginal bleeding, constant severe abdominal pain, reduced movement, leaking amniotic fluid, or contractions 5 mins apart need emergency attention.'],
                ],
                'hospital_information' => [
                    'explain' => "Have your bag packed and hospital route planned.",
                    'recommendations' => ['Review your hospital bag checklist.', 'Know the quickest route and parking at labor & delivery.', 'Keep your insurance and ID easily accessible.'],
                    'reminders' => ['Have your support person on alert and vehicle fueled.'],
                ],
                'faqs' => [
                    'explain' => 'Common questions as labor approaches.',
                    'recommendations' => ['How do I know if it is real labor? Real contractions get longer, stronger, and closer together.', 'What is the 5-1-1 rule? Contractions every 5 mins, lasting 1 min, for 1 hour.'],
                    'reminders' => ['Call your OB-GYN or labor unit whenever in doubt.'],
                ],
            ],
        ],
    ];

    json_success([
        'categories' => $categoryMeta,
        'guidance' => $guidance,
    ]);
}

// ------------------------------------------------------------------
// 9. MEAL PLANNER (18 RECIPES BY TRIMESTER)
// ------------------------------------------------------------------
if ($section === 'meal_planner') {
    $meals = [
        1 => [
            'label' => 'First Trimester',
            'focus' => 'Nausea is common early on — these lean toward bland, folate-rich, and easy on the stomach.',
            'items' => [
                ['icon' => 'cafe', 'title' => 'Ginger Tea & Crackers', 'why' => 'Ginger is commonly used to ease morning sickness, and plain crackers are gentle on an unsettled stomach.', 'tip' => 'Steep fresh ginger slices in hot water for 5–10 minutes. Sip slowly first thing in the morning.'],
                ['icon' => 'leaf', 'title' => 'Leafy Greens Salad', 'why' => 'Leafy greens like spinach and kangkong are rich in folate, important for neural tube development.', 'tip' => 'Toss with a light vinaigrette and a handful of nuts for extra protein.'],
                ['icon' => 'nutrition', 'title' => 'Citrus Fruit Bowl', 'why' => 'Vitamin C from citrus helps your body absorb iron better, and acidity helps settle the stomach.', 'tip' => 'Mix orange, calamansi, or dalandan segments with a little honey.'],
                ['icon' => 'egg', 'title' => 'Scrambled Eggs & Toast', 'why' => 'Eggs are an easy source of protein and choline, both important in early pregnancy.', 'tip' => 'Cook eggs soft and pair with plain toast if nausea is an issue.'],
                ['icon' => 'restaurant', 'title' => 'Oatmeal with Berries', 'why' => 'Oats are gentle, high in fiber, and help prevent constipation.', 'tip' => 'Top with berries and a drizzle of honey.'],
                ['icon' => 'water', 'title' => 'Hydration Reminder', 'why' => 'Staying hydrated helps reduce nausea, dizziness, and headaches.', 'tip' => 'Keep a water bottle nearby and sip small amounts throughout the day.'],
            ],
        ],
        2 => [
            'label' => 'Second Trimester',
            'focus' => 'Your baby is growing quickly now — protein, iron, and calcium needs go up.',
            'items' => [
                ['icon' => 'fish', 'title' => 'Grilled Fish & Vegetables', 'why' => 'Fish like bangus or tilapia provide omega-3s and protein that support fetal brain development.', 'tip' => 'Grill or bake instead of frying, and pair with steamed vegetables.'],
                ['icon' => 'restaurant', 'title' => 'Bean & Lentil Soup (Munggo)', 'why' => 'Beans and lentils are a great plant-based source of iron and fiber, helping prevent anemia.', 'tip' => 'Add malunggay (moringa) leaves for an extra iron and calcium boost.'],
                ['icon' => 'ice-cream', 'title' => 'Yogurt & Nut Parfait', 'why' => 'Yogurt and nuts together provide calcium and protein for baby\'s developing bones.', 'tip' => 'Layer plain Greek yogurt with almonds and sliced bananas.'],
                ['icon' => 'egg', 'title' => 'Spinach & Egg Omelette', 'why' => 'Doubles up on iron (spinach) and protein (egg) in one quick dish.', 'tip' => 'Add a slice of cheese for extra calcium.'],
                ['icon' => 'water', 'title' => 'Milk or Fortified Drinks', 'why' => 'Calcium needs increase as your baby\'s skeletal system strengthens.', 'tip' => 'Try lactose-free milk or calcium-fortified plant milk if sensitive.'],
                ['icon' => 'restaurant', 'title' => 'Lean Meat Stir-fry', 'why' => 'Lean beef or chicken is a strong source of iron and protein to support increasing blood volume.', 'tip' => 'Stir-fry with bell peppers (high vitamin C) to maximize iron absorption.'],
            ],
        ],
        3 => [
            'label' => 'Third Trimester',
            'focus' => 'Less room for big meals as baby grows — smaller, frequent meals with steady energy work best.',
            'items' => [
                ['icon' => 'time', 'title' => 'Small, Frequent Meals', 'why' => 'Smaller meals spread through the day feel much more comfortable and prevent heartburn.', 'tip' => 'Try 5–6 small meals instead of 3 large ones.'],
                ['icon' => 'nutrition', 'title' => 'Whole Grain Toast & Peanut Butter', 'why' => 'A mix of complex carbs and protein provides steady energy without blood sugar spikes.', 'tip' => 'Great as a mid-morning or mid-afternoon snack.'],
                ['icon' => 'nutrition', 'title' => 'Dates & Nuts', 'why' => 'A naturally sweet, energy-dense snack associated with cervical ripening in late pregnancy.', 'tip' => 'A small handful of dates with almonds makes an easy on-the-go snack.'],
                ['icon' => 'restaurant', 'title' => 'Chicken & Rice Bowl', 'why' => 'A balanced combo of protein and complex carbs to keep your energy steady for delivery.', 'tip' => 'Pair with fiber-rich vegetables to ease third-trimester constipation.'],
                ['icon' => 'beer', 'title' => 'Fruit Smoothie', 'why' => 'Easy to digest and hydrating when solid food feels heavy.', 'tip' => 'Blend banana, yogurt, chia seeds, and berries.'],
                ['icon' => 'cafe', 'title' => 'Caffeine-Free Herbal Tea', 'why' => 'Chamomile or ginger tea promotes evening relaxation and hydration without caffeine.', 'tip' => 'Check with your OB-GYN before introducing any new herbal tea blend.'],
            ],
        ],
    ];

    json_success(['meals' => $meals]);
}

// ------------------------------------------------------------------
// 10. REMINDERS & OB VISIT
// ------------------------------------------------------------------
if ($section === 'reminders') {
    $actPregId = get_active_pregnancy_id($pdo, $u['id']);

    if ($method === 'GET') {
        if ($actPregId) {
            $stmtVisits = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? ORDER BY visit_date ASC");
            $stmtVisits->execute([$u['id'], $actPregId]);
            $obVisits = $stmtVisits->fetchAll(PDO::FETCH_ASSOC);

            $stmtNext = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
            $stmtNext->execute([$u['id'], $actPregId]);
            $upcoming = $stmtNext->fetch(PDO::FETCH_ASSOC);
        } else {
            $stmtVisits = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? ORDER BY visit_date ASC");
            $stmtVisits->execute([$u['id']]);
            $obVisits = $stmtVisits->fetchAll(PDO::FETCH_ASSOC);

            $stmtNext = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
            $stmtNext->execute([$u['id']]);
            $upcoming = $stmtNext->fetch(PDO::FETCH_ASSOC);
        }

        $stmtProf = $pdo->prepare("SELECT next_ob_visit FROM patient_profiles WHERE user_id = ?");
        $stmtProf->execute([$u['id']]);
        $profileVisit = $stmtProf->fetchColumn();

        if ($actPregId) {
            $nextVisit = $upcoming ? $upcoming['visit_date'] : null;
            if ($profileVisit !== $nextVisit) {
                $pdo->prepare("UPDATE patient_profiles SET next_ob_visit = ? WHERE user_id = ?")->execute([$nextVisit, $u['id']]);
            }
        } else {
            $nextVisit = $upcoming ? $upcoming['visit_date'] : ($profileVisit ?: null);
            if ($nextVisit && $profileVisit !== $nextVisit) {
                $pdo->prepare("UPDATE patient_profiles SET next_ob_visit = ? WHERE user_id = ?")->execute([$nextVisit, $u['id']]);
            }
        }

        $daysToVisit = $nextVisit ? (int)round((strtotime($nextVisit) - strtotime(today_iso())) / 86400) : null;

        $stmt = $pdo->prepare("SELECT m.*, 
                                      (SELECT taken FROM medication_logs l WHERE l.medication_id = m.id AND l.date = ?) as taken_today
                               FROM medications m 
                               WHERE m.user_id = ? AND m.active = 1 
                               ORDER BY m.name");
        $stmt->execute([today_iso(), $u['id']]);
        $meds = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_success([
            'nextObVisit' => $nextVisit,
            'nextObVisitTitle' => $upcoming['title'] ?? 'Routine Prenatal Checkup',
            'nextObVisitNotes' => $upcoming['notes'] ?? '',
            'formattedVisit' => $nextVisit ? fmt_date($nextVisit) : null,
            'daysToVisit' => $daysToVisit,
            'obVisits' => $obVisits,
            'medications' => $meds,
        ]);
    }

    if ($method === 'POST') {
        $action = $_GET['action'] ?? ($input['action'] ?? ($_POST['action'] ?? ''));

        if ($action === 'set_ob_visit' || $action === 'add_ob_visit') {
            $visitDate = $input['visit_date'] ?? ($input['next_ob_visit'] ?? ($_POST['visit_date'] ?? ($_POST['next_ob_visit'] ?? null)));
            $visitTitle = trim($input['title'] ?? ($_POST['title'] ?? 'Routine Prenatal Checkup'));
            $visitNotes = trim($input['notes'] ?? ($_POST['notes'] ?? ''));

            if (!empty($visitDate)) {
                $visitId = uid('obv');
                $stmtIns = $pdo->prepare("INSERT INTO ob_visits (id, user_id, pregnancy_id, visit_date, title, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                $stmtIns->execute([$visitId, $u['id'], $actPregId, $visitDate, $visitTitle ?: 'Routine Prenatal Checkup', $visitNotes]);

                if ($actPregId) {
                    $stmtNext = $pdo->prepare("SELECT visit_date FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
                    $stmtNext->execute([$u['id'], $actPregId]);
                } else {
                    $stmtNext = $pdo->prepare("SELECT visit_date FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
                    $stmtNext->execute([$u['id']]);
                }
                $earliest = $stmtNext->fetchColumn() ?: $visitDate;

                $pdo->prepare("UPDATE patient_profiles SET next_ob_visit = ? WHERE user_id = ?")->execute([$earliest, $u['id']]);

                $daysToVisit = (int)round((strtotime($earliest) - strtotime(today_iso())) / 86400);
                $visitLabel = fmt_date($earliest);
                $body = $daysToVisit === 0
                    ? "Your {$visitTitle} is today ({$visitLabel})."
                    : ($daysToVisit > 0
                        ? "Your {$visitTitle} is scheduled in {$daysToVisit} day(s), on {$visitLabel}."
                        : "Your scheduled {$visitTitle} on {$visitLabel} has passed.");

                $stmtNtf = $pdo->prepare("INSERT INTO notifications (id, user_id, pregnancy_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,?,0,?)");
                $stmtNtf->execute([uid('ntf'), $u['id'], $actPregId, 'OB-GYN Visit Reminder', $body, now_iso(), 'ob_visit']);

                if ($actPregId) {
                    $stmtAll = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? ORDER BY visit_date ASC");
                    $stmtAll->execute([$u['id'], $actPregId]);
                } else {
                    $stmtAll = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? ORDER BY visit_date ASC");
                    $stmtAll->execute([$u['id']]);
                }
                $allVisits = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

                json_success([
                    'nextObVisit' => $earliest,
                    'daysToVisit' => $daysToVisit,
                    'formattedVisit' => fmt_date($earliest),
                    'obVisits' => $allVisits,
                ], 'Checkup date saved');
            } else {
                json_error('Visit date is required', 422);
            }
        } elseif ($action === 'delete_ob_visit') {
            $visitId = $input['visit_id'] ?? ($_POST['visit_id'] ?? '');
            if ($visitId) {
                $stmt = $pdo->prepare("DELETE FROM ob_visits WHERE id = ? AND user_id = ?");
                $stmt->execute([$visitId, $u['id']]);

                if ($actPregId) {
                    $stmtNext = $pdo->prepare("SELECT visit_date FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
                    $stmtNext->execute([$u['id'], $actPregId]);
                } else {
                    $stmtNext = $pdo->prepare("SELECT visit_date FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
                    $stmtNext->execute([$u['id']]);
                }
                $nextDate = $stmtNext->fetchColumn() ?: null;

                $pdo->prepare("UPDATE patient_profiles SET next_ob_visit = ? WHERE user_id = ?")->execute([$nextDate, $u['id']]);

                if ($actPregId) {
                    $stmtAll = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? ORDER BY visit_date ASC");
                    $stmtAll->execute([$u['id'], $actPregId]);
                } else {
                    $stmtAll = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? ORDER BY visit_date ASC");
                    $stmtAll->execute([$u['id']]);
                }
                $allVisits = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

                json_success([
                    'nextObVisit' => $nextDate,
                    'obVisits' => $allVisits,
                ], 'Checkup removed');
            } else {
                json_error('Visit ID required', 422);
            }
        } elseif ($action === 'add_supplement') {
            $name = trim($input['name'] ?? ($_POST['name'] ?? ''));
            $dosage = trim($input['dosage'] ?? ($_POST['dosage'] ?? ''));
            $schedule = trim($input['schedule_time'] ?? ($_POST['schedule_time'] ?? 'Daily with breakfast'));
            if (empty($name)) json_error('Supplement name required', 422);

            $id = uid('med');
            $stmt = $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?,?,?,?,?,1)");
            $stmt->execute([$id, $u['id'], $name, $dosage, $schedule]);
            json_success(['id' => $id, 'name' => $name], 'Supplement added', 201);
        } elseif ($action === 'toggle_taken') {
            $medId = $input['medication_id'] ?? ($_POST['medication_id'] ?? '');
            if (!$medId) json_error('Medication ID required', 422);

            $today = today_iso();
            $stmt = $pdo->prepare("SELECT * FROM medication_logs WHERE medication_id = ? AND date = ?");
            $stmt->execute([$medId, $today]);
            $existing = $stmt->fetch();
            if ($existing) {
                $pdo->prepare("DELETE FROM medication_logs WHERE id = ?")->execute([$existing['id']]);
                $taken = false;
            } else {
                $pdo->prepare("INSERT INTO medication_logs (id, medication_id, user_id, date, taken, taken_at) VALUES (?,?,?,?,1,?)")
                    ->execute([uid('mlg'), $medId, $u['id'], $today, now_iso()]);
                $taken = true;
            }
            json_success(['medication_id' => $medId, 'taken' => $taken], $taken ? 'Marked as taken' : 'Unmarked');
        }
    }
}

