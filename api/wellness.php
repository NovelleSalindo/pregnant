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
// 1. HOSPITAL BAG CHECKLIST
// ------------------------------------------------------------------
if ($section === 'hospital_bag') {
    if ($method === 'GET') {
        // Ensure default items exist
        seed_default_hospital_bag($pdo, $u['id']);

        $stmt = $pdo->prepare("SELECT * FROM hospital_bag_items WHERE user_id = ? ORDER BY category, sort_order, id");
        $stmt->execute([$u['id']]);
        $items = $stmt->fetchAll();

        $grouped = [];
        $totalChecked = 0;
        foreach ($items as $item) {
            $cat = $item['category'] ?: 'General';
            $grouped[$cat][] = [
                'id' => $item['id'],
                'label' => $item['label'],
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
            json_success([], 'Item toggled');
        } elseif ($action === 'add') {
            $label = trim($input['label'] ?? '');
            $cat = trim($input['category'] ?? 'General');
            if (empty($label)) json_error('Item label required', 422);

            $id = uid('bag');
            $stmt = $pdo->prepare("INSERT INTO hospital_bag_items (id, user_id, label, category, is_checked, is_custom, sort_order) VALUES (?, ?, ?, ?, 0, 1, 99)");
            $stmt->execute([$id, $u['id'], $label, $cat]);
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
        }
    }
}

// ------------------------------------------------------------------
// 3. BIRTH PLAN
// ------------------------------------------------------------------
if ($section === 'birth_plan') {
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM birth_plans WHERE user_id = ?");
        $stmt->execute([$u['id']]);
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
        $stmt = $pdo->prepare("INSERT INTO birth_plans (user_id, delivery_location, support_people, pain_management, feeding_preference, who_cuts_cord, skin_to_skin, special_requests, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            $u['id'],
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
