<?php
/* ============================================================
   PregnaCare — api/trackers.php
   Endpoints:
     GET  ?kind=kick          -> Today's kicks & recent kick sessions
     POST ?action=kick        -> Logs a kick
     GET  ?kind=contraction   -> Contraction history & interval analysis
     POST ?action=contraction -> Logs a contraction (duration_seconds, at)
     DELETE ?id=...           -> Deletes a tracker item
   ============================================================ */

require_once __DIR__ . '/bootstrap.php';

$u = require_api_user('patient');
$method = $_SERVER['REQUEST_METHOD'];

// Handle DELETE
if ($method === 'DELETE' || ($method === 'POST' && ($_GET['action'] ?? '') === 'delete')) {
    $id = $_GET['id'] ?? (get_json_input()['id'] ?? null);
    if (!$id) json_error('Tracker entry ID is required.', 422);

    $stmt = $pdo->prepare("DELETE FROM trackers WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $u['id']]);
    json_success([], 'Tracker entry deleted');
}

// Handle GET
if ($method === 'GET') {
    $kind = $_GET['kind'] ?? 'kick';
    $today = today_iso();

    if ($kind === 'kick') {
        // Today's kicks
        $stmt = $pdo->prepare("SELECT id, at FROM trackers WHERE user_id = ? AND kind = 'kick' AND at >= ? ORDER BY at DESC");
        $stmt->execute([$u['id'], $today . ' 00:00:00']);
        $todayKicks = $stmt->fetchAll();

        // Kicks grouped by day for the last 7 days
        $stmt = $pdo->prepare("SELECT DATE(at) as kick_date, COUNT(*) as count 
                               FROM trackers 
                               WHERE user_id = ? AND kind = 'kick' AND at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                               GROUP BY DATE(at) 
                               ORDER BY kick_date DESC");
        $stmt->execute([$u['id']]);
        $weeklySummary = $stmt->fetchAll();

        json_success([
            'todayCount' => count($todayKicks),
            'todayKicks' => $todayKicks,
            'weeklySummary' => $weeklySummary,
        ]);
    } elseif ($kind === 'contraction') {
        $stmt = $pdo->prepare("SELECT id, at, duration_seconds FROM trackers WHERE user_id = ? AND kind = 'contraction' ORDER BY at DESC LIMIT 30");
        $stmt->execute([$u['id']]);
        $contractions = $stmt->fetchAll();

        // Calculate intervals between consecutive contractions
        $analyzed = [];
        for ($i = 0; $i < count($contractions); $i++) {
            $curr = $contractions[$i];
            $intervalSec = null;
            if ($i < count($contractions) - 1) {
                $prev = $contractions[$i + 1];
                $currTime = strtotime($curr['at']);
                $prevTime = strtotime($prev['at']);
                $intervalSec = max(0, $currTime - $prevTime);
            }
            $analyzed[] = [
                'id' => $curr['id'],
                'at' => $curr['at'],
                'durationSeconds' => (int)($curr['duration_seconds'] ?? 0),
                'intervalSeconds' => $intervalSec,
                'intervalMinutes' => $intervalSec !== null ? round($intervalSec / 60, 1) : null,
            ];
        }

        // Check 5-1-1 rule: Contractions 5 mins apart, lasting 1 min, for 1 hour
        $alert511 = false;
        if (count($analyzed) >= 5) {
            $lastFew = array_slice($analyzed, 0, 5);
            $allRegular = true;
            foreach ($lastFew as $c) {
                if ($c['intervalMinutes'] === null || $c['intervalMinutes'] > 6 || $c['intervalMinutes'] < 3) {
                    $allRegular = false;
                    break;
                }
            }
            if ($allRegular) $alert511 = true;
        }

        json_success([
            'contractions' => $analyzed,
            'alert511' => $alert511,
        ]);
    } else {
        json_error("Unknown tracker kind '{$kind}'. Supported: kick, contraction.", 400);
    }
}

// Handle POST
if ($method === 'POST') {
    $input = get_json_input();
    $action = $_GET['action'] ?? ($input['action'] ?? 'kick');

    if ($action === 'kick') {
        $id = uid('kck');
        $at = !empty($input['at']) ? $input['at'] : now_iso();
        $stmt = $pdo->prepare("INSERT INTO trackers (id, user_id, kind, at) VALUES (?, ?, 'kick', ?)");
        $stmt->execute([$id, $u['id'], $at]);

        // Count today's kicks
        $today = today_iso();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM trackers WHERE user_id = ? AND kind = 'kick' AND at >= ?");
        $stmt->execute([$u['id'], $today . ' 00:00:00']);
        $totalToday = (int)$stmt->fetchColumn();

        json_success([
            'id' => $id,
            'at' => $at,
            'todayCount' => $totalToday,
        ], 'Kick recorded', 201);
    } elseif ($action === 'contraction') {
        $id = uid('cnt');
        $at = !empty($input['at']) ? $input['at'] : now_iso();
        $duration = !empty($input['duration_seconds']) ? (int)$input['duration_seconds'] : null;

        $stmt = $pdo->prepare("INSERT INTO trackers (id, user_id, kind, at, duration_seconds) VALUES (?, ?, 'contraction', ?, ?)");
        $stmt->execute([$id, $u['id'], $at, $duration]);

        json_success([
            'id' => $id,
            'at' => $at,
            'durationSeconds' => $duration,
        ], 'Contraction recorded', 201);
    } else {
        json_error("Unknown tracker action '{$action}'. Supported: kick, contraction.", 400);
    }
}
