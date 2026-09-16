<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';
    if ($action === 'add'){
        $pdo->prepare("INSERT INTO journal_entries (id, user_id, date, mood, content) VALUES (?,?,?,?,?)")
            ->execute([uid('jrn'), $u['id'], now_iso(), trim($_POST['mood']), trim($_POST['content'])]);
        flash('Journal entry saved.', 'success');
    } elseif ($action === 'delete'){
        $pdo->prepare("DELETE FROM journal_entries WHERE id=? AND user_id=?")->execute([$_POST['id'], $u['id']]);
        flash('Entry deleted.', 'info');
    }
    log_action('journal_update');
    redirect('journal.php');
}

$stmt = $pdo->prepare("SELECT * FROM journal_entries WHERE user_id=? ORDER BY date DESC");
$stmt->execute([$u['id']]);
$entries = $stmt->fetchAll();

$moodEmoji = ['Happy'=>'😊','Grateful'=>'🥰','Tired'=>'😴','Anxious'=>'😟','Emotional'=>'🥺','Excited'=>'🤩','Uncomfortable'=>'😣'];

render_header('Pregnancy Journal', 'journal');
?>

<div class="card" style="margin-bottom:16px;">
  <h3 style="margin-top:0;">New Entry</h3>
  <form method="post" action="journal.php">
    <input type="hidden" name="action" value="add">
    <div class="field">
      <label>How are you feeling?</label>
      <select name="mood">
        <?php foreach (array_keys($moodEmoji) as $m): ?><option value="<?php echo e($m); ?>"><?php echo $moodEmoji[$m]; ?> <?php echo e($m); ?></option><?php endforeach; ?>
      </select>
    </div>
    <div class="field"><label>Journal Entry</label><textarea name="content" rows="4" required placeholder="Write about your day, how you're feeling, symptoms, thoughts about baby..."></textarea></div>
    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-pen"></i> Save Entry</button>
  </form>
</div>

<div class="card">
  <h3 style="margin-top:0;">Past Entries</h3>
  <?php if (!$entries): ?>
    <div class="empty"><i class="fa-solid fa-book"></i>No journal entries yet. Write your first one above.</div>
  <?php endif; ?>
  <?php foreach ($entries as $e): ?>
    <div class="engine-step">
      <div class="num" style="background:var(--teal-light);font-size:20px;"><?php echo $moodEmoji[$e['mood']] ?? '📝'; ?></div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong><?php echo e($e['mood'] ?: 'Journal Entry'); ?></strong>
          <span class="muted" style="font-size:12px;"><?php echo e(fmt_datetime($e['date'])); ?></span>
        </div>
        <p style="margin:6px 0 8px;font-size:13.5px;color:var(--ink-soft);white-space:pre-wrap;"><?php echo e($e['content']); ?></p>
        <form method="post" action="journal.php" onsubmit="return confirm('Delete this entry?');">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id" value="<?php echo e($e['id']); ?>">
          <button class="btn btn-ghost btn-sm" type="submit" style="padding:2px 8px;"><i class="fa-solid fa-trash"></i> Delete</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>

<?php render_footer(); ?>
