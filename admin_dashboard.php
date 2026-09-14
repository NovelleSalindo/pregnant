<?php
require_once __DIR__ . '/base.php';
$u = require_role('admin');

$totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$patients = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='patient'")->fetchColumn();
$highRisk = (int)$pdo->query("SELECT COUNT(*) FROM (SELECT user_id, level, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) rn FROM assessments) t WHERE rn=1 AND level='Severe'")->fetchColumn();
$totalAssessments = (int)$pdo->query("SELECT COUNT(*) FROM assessments")->fetchColumn();
$notifications = (int)$pdo->query("SELECT COUNT(*) FROM notifications")->fetchColumn();

$recentLogs = $pdo->query("SELECT * FROM audit_logs ORDER BY at DESC LIMIT 15")->fetchAll();

render_header('System Overview', 'admin_dashboard');
?>

<div class="grid grid-4">
  <div class="card stat"><div class="eyebrow">Total Users</div><div class="num"><?php echo $totalUsers; ?></div></div>
  <div class="card stat"><div class="eyebrow">Patients</div><div class="num"><?php echo $patients; ?></div></div>
  <div class="card stat"><div class="eyebrow">Severe-Risk Cases</div><div class="num" style="color:var(--risk-high);"><?php echo $highRisk; ?></div></div>
  <div class="card stat"><div class="eyebrow">Risk Assessments Run</div><div class="num"><?php echo $totalAssessments; ?></div></div>
</div>

<div class="card" style="margin-top:16px;">
  <h3 style="margin-top:0;">Recent Activity</h3>
  <table>
    <thead><tr><th>Action</th><th>By</th><th>When</th></tr></thead>
    <tbody>
    <?php if(!$recentLogs): ?><tr><td colspan="3" class="muted">No activity yet.</td></tr><?php endif; ?>
    <?php foreach ($recentLogs as $l): ?>
      <tr><td><?php echo e($l['action']); ?></td><td><?php echo e($l['by_email']); ?></td><td><?php echo e(fmt_datetime($l['at'])); ?></td></tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php render_footer(); ?>
