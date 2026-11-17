<?php
/* ============================================================
   PregnaCare — api/dashboard.php
   Endpoint: GET /api/dashboard.php
   Returns full patient home overview:
     - Gestational age, due date countdown, trimester
     - Baby size comparison (fruit & emoji)
     - Latest risk assessment & score
     - Latest vitals
     - Daily check-in status (vitals logged today? symptoms logged today?)
     - Notifications & OB visit reminders
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');

// Handle notification actions if requested via POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? ($_POST['action'] ?? '');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!$action && isset($body['action'])) {
        $action = $body['action'];
    }

    $actPregId = get_active_pregnancy_id($pdo, $u['id']);
    if ($action === 'mark_all_read') {
        if ($actPregId) {
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND pregnancy_id = ?");
            $stmt->execute([$u['id'], $actPregId]);
        } else {
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?");
            $stmt->execute([$u['id']]);
        }
        json_success(['message' => 'All notifications marked as read']);
    } elseif ($action === 'clear_all') {
        if ($actPregId) {
            $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND pregnancy_id = ?");
            $stmt->execute([$u['id'], $actPregId]);
        } else {
            $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ?");
            $stmt->execute([$u['id']]);
        }
        json_success(['message' => 'All notifications cleared']);
    } elseif ($action === 'delete') {
        $id = $body['id'] ?? ($_GET['id'] ?? '');
        if ($id) {
            $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);
        }
        json_success(['message' => 'Notification deleted']);
    } elseif ($action === 'mark_read') {
        $id = $body['id'] ?? ($_GET['id'] ?? '');
        if ($id) {
            $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $u['id']]);
        }
        json_success(['message' => 'Notification marked as read']);
    } elseif ($action === 'resolve_visit') {
        $assessmentId = $body['assessment_id'] ?? ($_POST['assessment_id'] ?? '');
        if (!$assessmentId) {
            $stmt = $pdo->prepare("SELECT id FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
            $stmt->execute([$u['id']]);
            $assessmentId = $stmt->fetchColumn();
        }
        if (!$assessmentId) {
            $assessmentId = uid('asm');
            $pdo->prepare("INSERT INTO assessments (id, user_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json, status)
                           VALUES (?, ?, NOW(), 70, 'Severe', 0.70, 70, '{}', '{}', '[]', '[]', 'active')")
                ->execute([$assessmentId, $u['id']]);
        }
        try {
            $res = record_clinical_visit($pdo, $u['id'], $assessmentId, [
                'facility' => $body['facility'] ?? ($_POST['facility'] ?? ''),
                'doctor_name' => $body['doctor_name'] ?? ($_POST['doctor_name'] ?? ''),
                'visit_date' => $body['visit_date'] ?? ($_POST['visit_date'] ?? now_iso()),
                'notes' => $body['notes'] ?? ($_POST['notes'] ?? ''),
            ]);
            json_success(['message' => 'Clinical visit recorded and severe alert archived successfully', 'result' => $res]);
        } catch (Exception $e) {
            json_error($e->getMessage(), 400);
        }
    }
}

// Trigger OB-GYN reminder check & Hospital Bag check
check_ob_visit_reminder($pdo, $u);
check_hospital_bag_reminder($pdo, $u);

// 1. Patient Profile & Active Pregnancy Timeline
$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch() ?: [];

$actPregId = get_active_pregnancy_id($pdo, $u['id']);
$stmtP = $pdo->prepare("SELECT * FROM pregnancies WHERE id = ? AND user_id = ?");
$stmtP->execute([$actPregId, $u['id']]);
$activePregnancy = $stmtP->fetch() ?: null;

$weeksPregnant = null;
$daysPregnant = null;
$trimester = null;
$babySize = null;
$daysToEdd = null;

$eddToUse = ($activePregnancy && !empty($activePregnancy['edd'])) ? $activePregnancy['edd'] : ($profile['edd'] ?? null);

if (!empty($profile['lmp'])) {
    $diffSecs = time() - strtotime($profile['lmp']);
    if ($diffSecs >= 0) {
        $daysPregnant = (int)floor($diffSecs / 86400);
        $weeksPregnant = (int)floor($daysPregnant / 7);
        $trimester = $weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3);
        $babySize = baby_size_for_week($weeksPregnant);
    }
} elseif (!empty($eddToUse)) {
    $daysToEdd = (int)ceil((strtotime($eddToUse) - time()) / 86400);
    $daysPregnant = max(0, 280 - $daysToEdd);
    $weeksPregnant = (int)floor($daysPregnant / 7);
    $trimester = $weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3);
    $babySize = baby_size_for_week($weeksPregnant);
}

if (!empty($eddToUse)) {
    $daysToEdd = (int)ceil((strtotime($eddToUse) - time()) / 86400);
}

// 2. Latest Risk Assessment (Scoped strictly to Active Pregnancy)
$latestAssessment = null;
$latestCoopland = null;
$prevCoopland = null;
$topRecs = [];
try {
    // 2.1 Fetch latest Coopland assessment strictly for this active pregnancy
    $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC, id DESC LIMIT 1");
    $stmt->execute([$u['id'], $actPregId]);
    $latestCoopland = $stmt->fetch() ?: null;

    // 2.2 Also fetch previous Coopland assessment if available
    $stmtPrev = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC, id DESC LIMIT 1 OFFSET 1");
    $stmtPrev->execute([$u['id'], $actPregId]);
    $prevCoopland = $stmtPrev->fetch() ?: null;

    // 2.3 Also fetch latest general assessment for clinical visit status
    $stmtAsm = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 1");
    $stmtAsm->execute([$u['id'], $actPregId]);
    $latestAssessment = $stmtAsm->fetch() ?: null;

    $latestVisit = null;
    try {
        $stmtVisit = $pdo->prepare("SELECT * FROM clinical_visits WHERE user_id = ? AND pregnancy_id = ? ORDER BY visit_date DESC, created_at DESC LIMIT 1");
        $stmtVisit->execute([$u['id'], $actPregId]);
        $latestVisit = $stmtVisit->fetch() ?: null;
    } catch (Exception $e) {}

    $coopScore = $latestCoopland ? (int)$latestCoopland['score'] : 0;
    $coopLevel = $latestCoopland ? ucfirst(strtolower($latestCoopland['risk_level'])) : 'Low';
    $coopFactors = $latestCoopland ? json_decode($latestCoopland['factors_json'] ?? '[]', true) : [];

    // Calculate gauge percentage needle position:
    // Low (0-2): 10% - 30%
    // High (3-6): 40% - 64%
    // Severe (>=7): 72% - 95%
    if ($coopLevel === 'Severe') {
        $gaugeScore = min(95, 72 + max(0, $coopScore - 7) * 4);
    } elseif ($coopLevel === 'High') {
        $gaugeScore = min(64, max(40, 40 + max(0, $coopScore - 3) * 8));
    } else {
        $gaugeScore = min(30, max(10, 10 + $coopScore * 10));
    }

    // Build obstetric recommendations based on latest symptoms or Coopland risk classification
    if ($latestAssessment && !empty($latestAssessment['recommendations_json']) && $latestAssessment['recommendations_json'] !== '[]') {
        $rawRecs = json_decode($latestAssessment['recommendations_json'], true) ?: [];
        // Map string array to object array if necessary
        $parsedRecs = [];
        foreach ($rawRecs as $rec) {
            if (is_string($rec)) {
                $parsedRecs[] = ['text' => $rec, 'icon' => 'checkmark-circle', 'urgent' => false, 'category' => 'Daily Care'];
            } elseif (is_array($rec)) {
                $parsedRecs[] = $rec;
            }
        }
        $topRecs = $parsedRecs;
    } else {
        if ($coopLevel === 'Severe') {
            $topRecs[] = [
                'text' => 'Contact your OB-GYN or go to the nearest hospital now',
                'category' => 'Urgent Action',
                'urgent' => true,
                'icon' => 'alert-circle'
            ];
            $topRecs[] = [
                'text' => 'Do not wait for your next scheduled appointment',
                'category' => 'Urgent Action',
                'urgent' => true,
                'icon' => 'alert-circle'
            ];
            $topRecs[] = [
                'text' => 'High-risk tertiary hospital evaluation and continuous monitoring required',
                'category' => 'Clinical Guidance',
                'urgent' => false,
                'icon' => 'medkit'
            ];
        } elseif ($coopLevel === 'High') {
            $topRecs[] = [
                'text' => 'Schedule an OB-GYN checkup within 24 to 48 hours',
                'category' => 'Priority Care',
                'urgent' => true,
                'icon' => 'warning'
            ];
            $topRecs[] = [
                'text' => 'More frequent prenatal checkups and specialized maternal-fetal assessments recommended',
                'category' => 'Clinical Guidance',
                'urgent' => false,
                'icon' => 'checkmark-circle'
            ];
            $topRecs[] = [
                'text' => 'Closely monitor blood pressure, blood glucose, and daily fetal kick counts',
                'category' => 'Daily Monitoring',
                'urgent' => false,
                'icon' => 'checkmark-circle'
            ];
        } else {
            $topRecs[] = [
                'text' => 'Routine prenatal checkup schedule: monthly until 28 wks, every 2 wks until 36 wks, weekly after',
                'category' => 'Routine Care',
                'urgent' => false,
                'icon' => 'checkmark-circle'
            ];
            $topRecs[] = [
                'text' => 'Continue daily prenatal vitamins, iron, and folic acid supplements',
                'category' => 'Daily Nutrition',
                'urgent' => false,
                'icon' => 'checkmark-circle'
            ];
            $topRecs[] = [
                'text' => 'Drink plenty of water and rest when tired. Log daily vitals and symptoms',
                'category' => 'Wellness',
                'urgent' => false,
                'icon' => 'checkmark-circle'
            ];
        }
    }

    // Fetch reported symptoms for the latest assessment or latest symptom log
    $latestSymptoms = [];
    try {
        $stmtSymLog = $pdo->prepare("SELECT id, date FROM symptom_logs WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 1");
        $stmtSymLog->execute([$u['id'], $actPregId]);
        $latestSymLog = $stmtSymLog->fetch();
        if ($latestSymLog) {
            $symStmt = $pdo->prepare("
                SELECT sli.symptom_id AS id, sli.severity, sli.duration, sli.frequency, sc.name 
                FROM symptom_log_items sli
                LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id
                WHERE sli.symptom_log_id = ? AND sli.severity != 'None'
                ORDER BY sli.id ASC
            ");
            $symStmt->execute([$latestSymLog['id']]);
            $latestSymptoms = $symStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (Exception $e) {}
} catch (Exception $e) {}

// 3. Latest Vitals (Scoped to Active Pregnancy)
$lastVitals = null;
try {
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id'], $actPregId]);
    $lastVitals = $stmt->fetch();
} catch (Exception $e) {}

// 4. Daily Check-in Status (Scoped to Active Pregnancy)
$today = today_iso();
$loggedVitalsToday = false;
$loggedSymptomsToday = false;
try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id = ? AND pregnancy_id = ? AND date >= ?");
    $stmt->execute([$u['id'], $actPregId, $today . ' 00:00:00']);
    $loggedVitalsToday = (int)$stmt->fetchColumn() > 0;

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id = ? AND pregnancy_id = ? AND date >= ?");
    $stmt->execute([$u['id'], $actPregId, $today . ' 00:00:00']);
    $loggedSymptomsToday = (int)$stmt->fetchColumn() > 0;
} catch (Exception $e) {}

// 5. Notifications with Severe/High risk auto-sync
$notifications = [];
$unreadCount = 0;
try {
    // Ensure active High or Severe risks are notified in notifications table FOR THIS PREGNANCY
    if ($actPregId) {
        $stmtHighRisks = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ? AND (risk_level IN ('Severe', 'High') OR score >= 3) ORDER BY date DESC");
        $stmtHighRisks->execute([$u['id'], $actPregId]);
    } else {
        $stmtHighRisks = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND (risk_level IN ('Severe', 'High') OR score >= 3) ORDER BY date DESC");
        $stmtHighRisks->execute([$u['id']]);
    }
    foreach ($stmtHighRisks->fetchAll() as $rk) {
        $rl = ucfirst(strtolower($rk['risk_level']));
        if ($rl === 'Moderate') $rl = 'High';
        if ($rk['score'] >= 7) $rl = 'Severe';
        elseif ($rk['score'] >= 3 && $rl !== 'Severe') $rl = 'High';

        $kindSearch = ($rl === 'Severe') ? 'severe_risk_alert' : 'high_risk_alert';
        $titleSearch = "%{$rl}%";
        if ($actPregId) {
            $stmtChk = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND pregnancy_id = ? AND (kind = ? OR title LIKE ?)");
            $stmtChk->execute([$u['id'], $actPregId, $kindSearch, $titleSearch]);
        } else {
            $stmtChk = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND (kind = ? OR title LIKE ?)");
            $stmtChk->execute([$u['id'], $kindSearch, $titleSearch]);
        }
        if (!$stmtChk->fetch()) {
            $notifId = uid('ntf');
            if ($rl === 'Severe') {
                $notifTitle = '🚨 Urgent: Severe Maternal Risk Detected';
                $notifBody = "Your Coopland risk score is {$rk['score']} (Severe Risk). Immediate medical evaluation by an obstetrician or at a hospital triage is required.";
                $notifKind = 'severe_risk_alert';
            } else {
                $notifTitle = '⚠️ Maternal Risk Alert: High Risk';
                $notifBody = "Your Coopland risk score is {$rk['score']} (High Risk). Please schedule an OB-GYN checkup within 24 to 48 hours.";
                $notifKind = 'high_risk_alert';
            }
            $pdo->prepare("INSERT INTO notifications (id, user_id, pregnancy_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,?,0,?)")
                ->execute([$notifId, $u['id'], $actPregId, $notifTitle, $notifBody, $rk['date'] ?: now_iso(), $notifKind]);
        }
    }

    if ($actPregId) {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 20");
        $stmt->execute([$u['id'], $actPregId]);
        $notifications = $stmt->fetchAll();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND pregnancy_id = ? AND is_read = 0");
        $stmt->execute([$u['id'], $actPregId]);
        $unreadCount = (int)$stmt->fetchColumn();
    } else {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY date DESC LIMIT 20");
        $stmt->execute([$u['id']]);
        $notifications = $stmt->fetchAll();

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
        $stmt->execute([$u['id']]);
        $unreadCount = (int)$stmt->fetchColumn();
    }
} catch (Exception $e) {}

// 6. Today's Kicks Count (trackers table with kind='kick', scoped to active pregnancy)
$kicksToday = 0;
try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM trackers WHERE user_id = ? AND pregnancy_id = ? AND kind = 'kick' AND at >= ?");
    $stmt->execute([$u['id'], $actPregId, $today . ' 00:00:00']);
    $kicksToday = (int)$stmt->fetchColumn();
} catch (Exception $e) {
    $kicksToday = 0;
}

// 7. Active Medications/Supplements for Today's Reminder Checklist
$medsList = [];
try {
    $stmt = $pdo->prepare("SELECT m.*, 
                                  (SELECT taken FROM medication_logs l WHERE l.medication_id = m.id AND l.date = ?) as taken_today
                           FROM medications m 
                           WHERE m.user_id = ? AND m.active = 1 
                           ORDER BY m.name");
    $stmt->execute([$today, $u['id']]);
    $medsList = $stmt->fetchAll();
} catch (Exception $e) {
    $medsList = [];
}

// Fetch next upcoming OB visit from ob_visits or patient_profiles
$upcomingVisit = null;
$upcomingVisitsList = [];
try {
    if ($actPregId) {
        $stmtVisit = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
        $stmtVisit->execute([$u['id'], $actPregId]);
        $upcomingVisit = $stmtVisit->fetch(PDO::FETCH_ASSOC);

        $stmtAllVisits = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 5");
        $stmtAllVisits->execute([$u['id'], $actPregId]);
        $upcomingVisitsList = $stmtAllVisits->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $stmtVisit = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
        $stmtVisit->execute([$u['id']]);
        $upcomingVisit = $stmtVisit->fetch(PDO::FETCH_ASSOC);

        $stmtAllVisits = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 5");
        $stmtAllVisits->execute([$u['id']]);
        $upcomingVisitsList = $stmtAllVisits->fetchAll(PDO::FETCH_ASSOC);
    }
} catch (Exception $e) {}

$nextVisitDate = $upcomingVisit ? $upcomingVisit['visit_date'] : ($actPregId ? null : ($profile['next_ob_visit'] ?? null));
$nextVisitTitle = $upcomingVisit['title'] ?? ($nextVisitDate ? 'Next OB-GYN Visit' : null);
$nextVisitNotes = $upcomingVisit['notes'] ?? '';
$daysToVisit = !empty($nextVisitDate) ? (int)ceil((strtotime($nextVisitDate) - strtotime(today_iso())) / 86400) : null;

json_success([
    'user' => [
        'id' => $u['id'],
        'name' => $u['name'],
        'email' => $u['email'],
    ],
    'medications' => $medsList,
    'pregnancy' => [
        'weeks' => $weeksPregnant,
        'days' => $daysPregnant,
        'trimester' => $trimester,
        'lmp' => $profile['lmp'] ?? null,
        'edd' => $eddToUse,
        'formattedEdd' => !empty($eddToUse) ? fmt_date($eddToUse) : null,
        'daysToEdd' => $daysToEdd,
        'nextObVisit' => $nextVisitDate,
        'nextObVisitTitle' => $nextVisitTitle,
        'nextObVisitNotes' => $nextVisitNotes,
        'daysToVisit' => $daysToVisit,
        'upcomingVisits' => $upcomingVisitsList,
        'babyFruit' => $babySize ? $babySize[0] : null,
        'babyEmoji' => $babySize ? $babySize[1] : null,
        'activePregnancy' => $activePregnancy,
        'activePregnancyId' => $actPregId,
    ],
    'risk' => [
        'hasAssessment' => (bool)$latestCoopland || (bool)$latestAssessment,
        'assessmentId' => $latestCoopland ? $latestCoopland['id'] : ($latestAssessment ? $latestAssessment['id'] : null),
        'latestScore' => $latestCoopland ? ($gaugeScore ?? 20) : null,
        'cooplandScore' => $coopScore,
        'level' => $coopLevel,
        'factors' => $coopFactors ?? [],
        'reportedSymptoms' => $latestSymptoms ?? [],
        'latestSymptomDate' => $latestSymLog ? $latestSymLog['date'] : null,
        'status' => ($latestAssessment && ($latestAssessment['status'] ?? 'active') === 'resolved') ? 'resolved' : 'active',
        'isResolved' => ($latestAssessment && ($latestAssessment['status'] ?? 'active') === 'resolved'),
        'canResolveVisit' => in_array(strtoupper($coopLevel ?? 'Low'), ['SEVERE', 'HIGH']) && !($latestAssessment && ($latestAssessment['status'] ?? 'active') === 'resolved'),
        'visitedFacility' => (is_array($latestAssessment) ? ($latestAssessment['visited_facility'] ?? null) : null) ?: ($latestVisit['facility'] ?? null),
        'doctorName' => (is_array($latestAssessment) ? ($latestAssessment['doctor_name'] ?? null) : null) ?: ($latestVisit['doctor_name'] ?? null),
        'visitDate' => (is_array($latestAssessment) ? ($latestAssessment['visit_date'] ?? null) : null) ?: ($latestVisit['visit_date'] ?? null),
        'doctorNotes' => (is_array($latestAssessment) ? ($latestAssessment['doctor_notes'] ?? null) : null) ?: ($latestVisit['notes'] ?? null),
        'assessmentDate' => $latestCoopland ? $latestCoopland['date'] : ($latestAssessment ? $latestAssessment['date'] : null),
        'previousCoopland' => $prevCoopland ? [
            'id' => $prevCoopland['id'],
            'score' => (int)$prevCoopland['score'],
            'level' => ucfirst(strtolower($prevCoopland['risk_level'])),
            'date' => $prevCoopland['date'],
        ] : null,
        'topRecommendations' => $topRecs,
    ],
    'vitals' => [
        'latest' => $lastVitals ?: null,
        'loggedToday' => $loggedVitalsToday,
    ],
    'symptomTrends' => compute_symptoms_trends($pdo, $u['id'], $actPregId),
    'checkin' => [
        'vitalsLoggedToday' => $loggedVitalsToday,
        'symptomsLoggedToday' => $loggedSymptomsToday,
        'latestSymptomDate' => $latestSymLog ? $latestSymLog['date'] : null,
        'latestAssessmentDate' => $latestCoopland ? $latestCoopland['date'] : ($latestAssessment ? $latestAssessment['date'] : null),
        'kicksToday' => $kicksToday,
    ],
    'notifications' => [
        'unreadCount' => $unreadCount,
        'items' => $notifications,
    ],
]);
