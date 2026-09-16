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

$filter = $_GET['filter'] ?? 'all';
if ($filter === 'unread'){
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id=? AND is_read=0 ORDER BY date DESC");
} else {
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY date DESC");
}
$stmt->execute([$u['id']]);
$items = $stmt->fetchAll();

$kindIcon = ['error'=>'fa-circle-exclamation','success'=>'fa-circle-check','info'=>'fa-circle-info'];
$kindColor = ['error'=>'var(--risk-high)','success'=>'var(--risk-low)','info'=>'var(--teal)'];

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

  <?php foreach ($items as $n): ?>
    <div class="engine-step" style="<?php echo $n['is_read'] ? '' : 'background:var(--sky-light);border-radius:12px;padding-left:10px;padding-right:10px;'; ?>">
      <div class="num" style="background:transparent;color:<?php echo $kindColor[$n['kind']] ?? 'var(--teal)'; ?>;font-size:18px;">
        <i class="fa-solid <?php echo $kindIcon[$n['kind']] ?? 'fa-bell'; ?>"></i>
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <strong><?php echo e($n['title']); ?></strong>
          <span class="muted" style="font-size:12px;"><?php echo e(fmt_datetime($n['date'])); ?></span>
        </div>
        <p style="margin:4px 0 8px;font-size:13.5px;color:var(--ink-soft);"><?php echo e($n['body']); ?></p>
        <div style="display:flex;gap:8px;">
          <?php if (!$n['is_read']): ?>
          <form method="post" action="notifications.php">
            <input type="hidden" name="action" value="mark_read">
            <input type="hidden" name="id" value="<?php echo e($n['id']); ?>">
            <button class="btn btn-ghost btn-sm" type="submit" style="padding:2px 8px;"><i class="fa-solid fa-check"></i> Mark Read</button>
          </form>
          <?php endif; ?>
          <form method="post" action="notifications.php" onsubmit="return confirm('Delete this notification?');">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?php echo e($n['id']); ?>">
            <button class="btn btn-ghost btn-sm" type="submit" style="padding:2px 8px;"><i class="fa-solid fa-trash"></i> Delete</button>
          </form>
        </div>
      </div>
    </div>
  <?php endforeach; ?>
</div>

<?php render_footer(); ?>
