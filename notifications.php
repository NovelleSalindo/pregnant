<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';
    if ($action === 'mark_read'){
        $pdo->prepare("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?")->execute([$_POST['id'], $u['id']]);
    } elseif ($action === 'mark_all_read'){
        $pdo->prepare("UPDATE notifications SET is_read=1 WHERE user_id=?")->execute([$u['id']]);
        flash('All notifications marked as read.', 'success');
    } elseif ($action === 'delete'){
        $pdo->prepare("DELETE FROM notifications WHERE id=? AND user_id=?")->execute([$_POST['id'], $u['id']]);
        flash('Notification deleted.', 'info');
    }
    redirect('notifications.php');
}

// Auto-sync: If user has an active High or Severe risk assessment without a notification, create one now
try {
    // 1. Check all Severe/High Coopland assessments for this user
    $stmtHighRisks = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND (risk_level IN ('Severe', 'High') OR score >= 3) ORDER BY date DESC");
    $stmtHighRisks->execute([$u['id']]);
    $coopRisks = $stmtHighRisks->fetchAll();

    foreach ($coopRisks as $rk) {
        $rl = ucfirst(strtolower($rk['risk_level']));
        if ($rl === 'Moderate') $rl = 'High';
        if ($rk['score'] >= 7) $rl = 'Severe';
        elseif ($rk['score'] >= 3 && $rl !== 'Severe') $rl = 'High';

        $kindSearch = ($rl === 'Severe') ? 'severe_risk_alert' : 'high_risk_alert';
        $titleSearch = "%{$rl}%";
        $stmtChk = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND (kind = ? OR title LIKE ?)");
        $stmtChk->execute([$u['id'], $kindSearch, $titleSearch]);
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
            $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                ->execute([$notifId, $u['id'], $notifTitle, $notifBody, $rk['date'] ?: now_iso(), $notifKind]);
        }
    }

    // 2. Also check general assessments table if any severe/high exists
    $stmtAsmRisks = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? AND level IN ('Severe', 'High') ORDER BY date DESC");
    $stmtAsmRisks->execute([$u['id']]);
    $asmRisks = $stmtAsmRisks->fetchAll();
    foreach ($asmRisks as $ak) {
        $rl = ucfirst(strtolower($ak['level']));
        $kindSearch = ($rl === 'Severe') ? 'severe_risk_alert' : 'high_risk_alert';
        $titleSearch = "%{$rl}%";
        $stmtChk = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND (kind = ? OR title LIKE ?)");
        $stmtChk->execute([$u['id'], $kindSearch, $titleSearch]);
        if (!$stmtChk->fetch()) {
            $notifId = uid('ntf');
            if ($rl === 'Severe') {
                $notifTitle = '🚨 Urgent: Severe Maternal Risk Detected';
                $notifBody = "Maternal risk assessment completed with Severe Risk (Score: {$ak['score']}). Immediate obstetric consultation advised.";
                $notifKind = 'severe_risk_alert';
            } else {
                $notifTitle = '⚠️ Maternal Risk Alert: High Risk';
                $notifBody = "Maternal risk assessment completed with High Risk (Score: {$ak['score']}). Schedule an OB-GYN checkup within 24 to 48 hours.";
                $notifKind = 'high_risk_alert';
            }
            $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                ->execute([$notifId, $u['id'], $notifTitle, $notifBody, $ak['date'] ?: now_iso(), $notifKind]);
        }
    }
} catch (Exception $e) {}

$filter = $_GET['filter'] ?? 'all';
if ($filter === 'unread'){
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id=? AND is_read=0 ORDER BY date DESC");
} else {
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY date DESC");
}
$stmt->execute([$u['id']]);
$items = $stmt->fetchAll();

$kindIcon = [
    'severe_risk_alert' => 'fa-triangle-exclamation',
    'high_risk_alert' => 'fa-triangle-exclamation',
    'low_risk_assessment' => 'fa-circle-check',
    'error' => 'fa-circle-exclamation',
    'success' => 'fa-circle-check',
    'info' => 'fa-circle-info',
    'ob_visit' => 'fa-calendar-check',
    'emergency' => 'fa-truck-medical',
    'due_date' => 'fa-baby',
];

$kindColor = [
    'severe_risk_alert' => '#DC2626',
    'high_risk_alert' => '#D97706',
    'low_risk_assessment' => '#16A34A',
    'error' => '#DC2626',
    'success' => 'var(--risk-low)',
    'info' => 'var(--teal)',
    'ob_visit' => 'var(--teal-dark)',
    'emergency' => '#DC2626',
    'due_date' => 'var(--teal-dark)',
];

render_header('Notifications', 'notifications');
?>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
    <div class="tabs" style="border-bottom:none;margin-bottom:0;">
      <button type="button" class="<?php echo $filter==='all'?'active':''; ?>" onclick="location.href='notifications.php?filter=all'">All</button>
      <button type="button" class="<?php echo $filter==='unread'?'active':''; ?>" onclick="location.href='notifications.php?filter=unread'">Unread</button>
    </div>
    <form method="post" action="notifications.php">
      <input type="hidden" name="action" value="mark_all_read">
      <button class="btn btn-outline btn-sm" type="submit"><i class="fa-solid fa-check-double"></i> Mark All Read</button>
    </form>
  </div>

  <?php if (!$items): ?>
    <div class="empty"><i class="fa-solid fa-bell-slash"></i>No notifications<?php echo $filter==='unread' ? ' — you\'re all caught up!' : ' yet.'; ?></div>
  <?php endif; ?>

  <?php foreach ($items as $n): 
    $kind = $n['kind'] ?? '';
    $title = $n['title'] ?? '';
    $isSevere = ($kind === 'severe_risk_alert' || $kind === 'emergency' || stripos($title, 'Severe') !== false);
    $isHigh = !$isSevere && ($kind === 'high_risk_alert' || stripos($title, 'High') !== false);
    $isLow = !$isSevere && !$isHigh && ($kind === 'low_risk_assessment' || stripos($title, 'Low') !== false);

    $cardBorder = 'var(--border)';
    $cardBg = $n['is_read'] ? 'transparent' : 'var(--sky-light)';
    $iconColor = $kindColor[$kind] ?? 'var(--teal)';
    $icon = $kindIcon[$kind] ?? 'fa-bell';

    if ($isSevere) {
        $iconColor = '#DC2626';
        $icon = 'fa-triangle-exclamation';
        $cardBorder = '#FCA5A5';
        $cardBg = $n['is_read'] ? '#FFF8F8' : '#FEE2E2';
    } elseif ($isHigh) {
        $iconColor = '#D97706';
        $icon = 'fa-triangle-exclamation';
        $cardBorder = '#FCD34D';
        $cardBg = $n['is_read'] ? '#FFFDF7' : '#FEF3C7';
    } elseif ($isLow) {
        $iconColor = '#16A34A';
        $icon = 'fa-circle-check';
    }
  ?>
    <div class="engine-step" style="border: 1px solid <?php echo $cardBorder; ?>; <?php echo ($isSevere || $isHigh) ? 'border-left: 6px solid ' . $iconColor . ';' : ''; ?> background: <?php echo $cardBg; ?>; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; transition: all 0.2s ease;">
      <div class="num" style="background:transparent;color:<?php echo $iconColor; ?>;font-size:22px;margin-right:12px;">
        <i class="fa-solid <?php echo $icon; ?>"></i>
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-size:15px;color:<?php echo ($isSevere ? '#B91C1C' : ($isHigh ? '#B45309' : 'var(--ink)')); ?>;">
              <?php echo e($title); ?>
            </strong>
            <?php if ($isSevere): ?>
              <span class="badge" style="background:#DC2626;color:#FFF;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;">URGENT SEVERE</span>
            <?php elseif ($isHigh): ?>
              <span class="badge" style="background:#D97706;color:#FFF;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;">HIGH RISK</span>
            <?php elseif ($isLow): ?>
              <span class="badge" style="background:#16A34A;color:#FFF;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:10px;">LOW RISK</span>
            <?php endif; ?>
          </div>
          <span class="muted" style="font-size:12px;"><?php echo e(fmt_datetime($n['date'])); ?></span>
        </div>
        <p style="margin:6px 0 10px;font-size:13.5px;color:<?php echo ($isSevere ? '#991B1B' : ($isHigh ? '#92400E' : 'var(--ink-soft)')); ?>;line-height:1.45;">
          <?php echo e($n['body']); ?>
        </p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <?php if ($isSevere): ?>
            <a href="analyze.php" class="btn btn-sm" style="background:#DC2626;color:#FFF;font-weight:600;padding:3px 10px;text-decoration:none;border-radius:6px;">
              <i class="fa-solid fa-file-medical"></i> View Clinical Breakdown
            </a>
            <a href="tel:911" class="btn btn-outline btn-sm" style="border-color:#DC2626;color:#DC2626;padding:3px 10px;text-decoration:none;border-radius:6px;">
              <i class="fa-solid fa-phone"></i> Emergency Hotline
            </a>
          <?php elseif ($isHigh): ?>
            <a href="analyze.php" class="btn btn-sm" style="background:#D97706;color:#FFF;font-weight:600;padding:3px 10px;text-decoration:none;border-radius:6px;">
              <i class="fa-solid fa-file-medical"></i> View Risk Breakdown
            </a>
            <a href="reminders.php" class="btn btn-outline btn-sm" style="border-color:#D97706;color:#B45309;padding:3px 10px;text-decoration:none;border-radius:6px;">
              <i class="fa-solid fa-calendar-plus"></i> Set OB-GYN Visit
            </a>
          <?php elseif ($isLow): ?>
            <a href="analyze.php" class="btn btn-ghost btn-sm" style="color:#16A34A;padding:3px 8px;text-decoration:none;">
              <i class="fa-solid fa-chart-line"></i> View Analysis
            </a>
          <?php endif; ?>

          <?php if (!$n['is_read']): ?>
          <form method="post" action="notifications.php" style="margin:0;">
            <input type="hidden" name="action" value="mark_read">
            <input type="hidden" name="id" value="<?php echo e($n['id']); ?>">
            <button class="btn btn-ghost btn-sm" type="submit" style="padding:3px 8px;"><i class="fa-solid fa-check"></i> Mark Read</button>
          </form>
          <?php endif; ?>

          <form method="post" action="notifications.php" onsubmit="return confirm('Delete this notification?');" style="margin:0;">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?php echo e($n['id']); ?>">
            <button class="btn btn-ghost btn-sm" type="submit" style="padding:3px 8px;"><i class="fa-solid fa-trash"></i> Delete</button>
          </form>
        </div>
      </div>
    </div>
  <?php endforeach; ?>
</div>

<?php render_footer(); ?>
