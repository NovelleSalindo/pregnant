<?php
/* ============================================================
   PregnaCare — api/reminders.php
   Matches reminders.php backend for mobile and web API clients:
     GET  /api/reminders.php -> next_ob_visit, daysToVisit, medications with today's status
     POST /api/reminders.php?action=set_ob_visit -> updates next_ob_visit
     POST /api/reminders.php?action=add_supplement -> adds medication/vitamin
     POST /api/reminders.php?action=toggle_taken -> toggles today's taken status
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');
$input = get_json_input();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $action = $_GET['action'] ?? ($input['action'] ?? ($_POST['action'] ?? ''));

    if ($action === 'set_ob_visit') {
        $nextVisit = $input['next_ob_visit'] ?? ($_POST['next_ob_visit'] ?? null);
        $stmt = $pdo->prepare("UPDATE patient_profiles SET next_ob_visit = ? WHERE user_id = ?");
        $stmt->execute([$nextVisit ?: null, $u['id']]);

        $daysToVisit = $nextVisit ? (int)round((strtotime($nextVisit) - strtotime(today_iso())) / 86400) : null;

        if ($nextVisit && $daysToVisit !== null) {
            $visitLabel = fmt_date($nextVisit);
            $body = $daysToVisit === 0
                ? "Your prenatal checkup is today ({$visitLabel})."
                : ($daysToVisit > 0
                    ? "Your prenatal checkup is scheduled in {$daysToVisit} day(s), on {$visitLabel}."
                    : "Your scheduled prenatal checkup on {$visitLabel} has passed.");

            $stmtNtf = $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)");
            $stmtNtf->execute([uid('ntf'), $u['id'], 'OB-GYN Visit Reminder', $body, now_iso(), 'ob_visit']);
        }

        json_success([
            'next_ob_visit' => $nextVisit,
            'daysToVisit' => $daysToVisit,
            'formattedDate' => $nextVisit ? fmt_date($nextVisit) : null,
        ], 'OB-GYN visit reminder saved');
    }

    if ($action === 'add_supplement') {
        $name = trim($input['name'] ?? ($_POST['name'] ?? ''));
        $dosage = trim($input['dosage'] ?? ($_POST['dosage'] ?? ''));
        $schedule = trim($input['schedule_time'] ?? ($_POST['schedule_time'] ?? 'Daily with breakfast'));
        if (empty($name)) json_error('Supplement name required', 422);

        $id = uid('med');
        $stmt = $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?,?,?,?,?,1)");
        $stmt->execute([$id, $u['id'], $name, $dosage, $schedule]);
        json_success(['id' => $id, 'name' => $name], 'Supplement added', 201);
    }

    if ($action === 'toggle_taken') {
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

// GET Request
$stmt = $pdo->prepare("SELECT next_ob_visit FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$nextVisit = $stmt->fetchColumn();
$daysToVisit = $nextVisit ? (int)round((strtotime($nextVisit) - strtotime(today_iso())) / 86400) : null;

$stmt = $pdo->prepare("SELECT m.*, 
                              (SELECT COUNT(*) FROM medication_logs l WHERE l.medication_id = m.id AND l.date = ?) as taken_today
                       FROM medications m 
                       WHERE m.user_id = ? AND m.active = 1 
                       ORDER BY m.name");
$stmt->execute([today_iso(), $u['id']]);
$meds = $stmt->fetchAll();

foreach ($meds as &$m) {
    $m['taken_today'] = (bool)$m['taken_today'];
}

json_success([
    'nextObVisit' => $nextVisit,
    'formattedVisit' => $nextVisit ? fmt_date($nextVisit) : null,
    'daysToVisit' => $daysToVisit,
    'medications' => $meds,
]);
