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

// Trigger OB-GYN reminder check
check_ob_visit_reminder($pdo, $u);

// 1. Patient Profile & Pregnancy Timeline
$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch() ?: [];

$weeksPregnant = null;
$daysPregnant = null;
if (!empty($profile['lmp'])) {
    $diffSecs = time() - strtotime($profile['lmp']);
    if ($diffSecs >= 0) {
        $daysPregnant = (int)floor($diffSecs / 86400);
        $weeksPregnant = (int)floor($daysPregnant / 7);
    }
}

$trimester = null;
if ($weeksPregnant !== null) {
    $trimester = $weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3);
}

$babySize = $weeksPregnant !== null ? baby_size_for_week($weeksPregnant) : null;
$daysToEdd = !empty($profile['edd']) ? (int)ceil((strtotime($profile['edd']) - time()) / 86400) : null;

// 2. Latest Risk Assessment
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latestAssessment = $stmt->fetch();

$topRecs = [];
if ($latestAssessment && !empty($latestAssessment['recommendations_json'])) {
    $decodedRecs = json_decode($latestAssessment['recommendations_json'], true);
    if (is_array($decodedRecs)) {
        $topRecs = array_slice($decodedRecs, 0, 4);
    }
}

// 3. Latest Vitals
$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$lastVitals = $stmt->fetch();

// 4. Daily Check-in Status
$today = today_iso();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id = ? AND date >= ?");
$stmt->execute([$u['id'], $today . ' 00:00:00']);
$loggedVitalsToday = (int)$stmt->fetchColumn() > 0;

$stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id = ? AND date >= ?");
$stmt->execute([$u['id'], $today . ' 00:00:00']);
$loggedSymptomsToday = (int)$stmt->fetchColumn() > 0;

// 5. Notifications
$stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY date DESC LIMIT 5");
$stmt->execute([$u['id']]);
$notifications = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
$stmt->execute([$u['id']]);
$unreadCount = (int)$stmt->fetchColumn();

// 6. Today's Kicks Count
$stmt = $pdo->prepare("SELECT COUNT(*) FROM kick_logs WHERE user_id = ? AND recorded_at >= ?");
$stmt->execute([$u['id'], $today . ' 00:00:00']);
$kicksToday = (int)$stmt->fetchColumn();

json_success([
    'user' => [
        'id' => $u['id'],
        'name' => $u['name'],
        'email' => $u['email'],
    ],
    'pregnancy' => [
        'weeks' => $weeksPregnant,
        'days' => $daysPregnant,
        'trimester' => $trimester,
        'lmp' => $profile['lmp'] ?? null,
        'edd' => $profile['edd'] ?? null,
        'daysToEdd' => $daysToEdd,
        'nextObVisit' => $profile['next_ob_visit'] ?? null,
        'babyFruit' => $babySize ? $babySize[0] : 'Growing Baby',
        'babyEmoji' => $babySize ? $babySize[1] : '👶',
    ],
    'risk' => [
        'latestScore' => $latestAssessment ? (int)$latestAssessment['score'] : null,
        'level' => $latestAssessment ? $latestAssessment['level'] : 'None',
        'assessmentDate' => $latestAssessment ? $latestAssessment['date'] : null,
        'topRecommendations' => $topRecs,
    ],
    'vitals' => [
        'latest' => $lastVitals ?: null,
        'loggedToday' => $loggedVitalsToday,
    ],
    'checkin' => [
        'vitalsLoggedToday' => $loggedVitalsToday,
        'symptomsLoggedToday' => $loggedSymptomsToday,
        'kicksToday' => $kicksToday,
    ],
    'notifications' => [
        'unreadCount' => $unreadCount,
        'items' => $notifications,
    ],
]);
