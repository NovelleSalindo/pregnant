<?php
require_once __DIR__ . '/base.php';
$stmt = $pdo->query("SELECT c.id, c.user_id, u.email, u.name, c.date, c.score, c.risk_level, c.factors_json FROM coopland_assessments c LEFT JOIN users u ON u.id = c.user_id ORDER BY c.date DESC, c.id DESC LIMIT 10");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo "{$r['id']} | User: {$r['name']} ({$r['email']}) | {$r['date']} | Score: {$r['score']} | Risk: {$r['risk_level']} | Factors: {$r['factors_json']}\n";
}
