<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT next_ob_visit FROM patient_profiles WHERE user_id=?");
$stmt->execute([$u['id']]);
$nextVisit = $stmt->fetchColumn();

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';

    if ($action === 'set_ob_visit'){
        $pdo->prepare("UPDATE patient_profiles SET next_ob_visit=? WHERE user_id=?")
            ->execute([$_POST['next_ob_visit'] ?: null, $u['id']]);
        flash('OB visit reminder saved.', 'success');
        log_action('set_ob_visit');
        redirect('reminders.php');
    }

    if ($action === 'add_supplement'){
        $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?,?,?,?,?,1)")
            ->execute([uid('med'), $u['id'], trim($_POST['name']), trim($_POST['dosage']), trim($_POST['schedule_time'])]);
        flash('Supplement/vitamin added.', 'success');
        log_action('add_supplement');
        redirect('reminders.php');
    }

    if ($action === 'toggle_taken'){
        $medId = $_POST['medication_id'];
        $today = today_iso();
        $stmt = $pdo->prepare("SELECT * FROM medication_logs WHERE medication_id=? AND date=?");
        $stmt->execute([$medId, $today]);
        $existing = $stmt->fetch();
        if ($existing){
            $pdo->prepare("DELETE FROM medication_logs WHERE id=?")->execute([$existing['id']]);
        } else {
            $pdo->prepare("INSERT INTO medication_logs (id, medication_id, user_id, date, taken, taken_at) VALUES (?,?,?,?,1,?)")
                ->execute([uid('mlg'), $medId, $u['id'], $today, now_iso()]);
        }
        redirect('reminders.php');
    }
}

$stmt = $pdo->prepare("SELECT * FROM medications WHERE user_id=? AND active=1 ORDER BY name");
$stmt->execute([$u['id']]);
$meds = $stmt->fetchAll();

$today = today_iso();
$stmt = $pdo->prepare("SELECT medication_id FROM medication_logs WHERE user_id=? AND date=?");
$stmt->execute([$u['id'], $today]);
$takenToday = $stmt->fetchAll(PDO::FETCH_COLUMN);

$daysToVisit = $nextVisit ? (int)ceil((strtotime($nextVisit) - time()) / 86400) : null;

render_header('Reminders', 'reminders');
?>

<div class="grid grid-2" style="align-items:start;">

  <div class="card">
    <div class="eyebrow">OB-GYN Visit Reminder</div>
    <h3 style="margin-top:6px;">Next Prenatal Checkup</h3>
    <?php if ($nextVisit && $daysToVisit !== null): ?>
      <div style="text-align:center;padding:10px 0;">
        <?php if ($daysToVisit >= 0): ?>
          <div style="font-family:var(--font-display);font-size:44px;font-weight:700;color:var(--teal-dark);"><?php echo $daysToVisit; ?></div>
          <div class="muted"><?php echo $daysToVisit === 0 ? 'That\'s today!' : 'day(s) until your visit'; ?></div>
        <?php else: ?>
          <div class="badge badge-mod" style="font-size:13px;padding:8px 14px;">This date has passed — update it below</div>
        <?php endif; ?>
        <div style="margin-top:8px;font-weight:700;"><?php echo e(fmt_date($nextVisit)); ?></div>
      </div>
    <?php else: ?>
      <div class="empty"><i class="fa-solid fa-calendar"></i>No upcoming visit set yet.</div>
    <?php endif; ?>
    <form method="post" action="reminders.php">
      <input type="hidden" name="action" value="set_ob_visit">
      <div class="field"><label>Next OB-GYN Visit Date</label><input type="date" name="next_ob_visit" value="<?php echo e($nextVisit ?? ''); ?>"></div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-calendar-check"></i> Save Reminder</button>
    </form>
  </div>

  <div class="card">
    <div class="eyebrow">Supplement &amp; Vitamin Reminder</div>
    <h3 style="margin-top:6px;">Today's Checklist</h3>
    <?php if (!$meds): ?>
      <div class="empty"><i class="fa-solid fa-pills"></i>No supplements/vitamins added yet.</div>
    <?php endif; ?>
    <?php foreach ($meds as $m): $isTaken = in_array($m['id'], $takenToday); ?>
      <form method="post" action="reminders.php" style="margin-bottom:8px;">
        <input type="hidden" name="action" value="toggle_taken">
        <input type="hidden" name="medication_id" value="<?php echo e($m['id']); ?>">
        <button type="submit" class="chip <?php echo $isTaken?'on':''; ?>" style="width:100%;justify-content:flex-start;display:flex;cursor:pointer;border:1.5px solid var(--border);padding:12px 14px;">
          <i class="fa-solid <?php echo $isTaken?'fa-circle-check':'fa-circle'; ?>" style="margin-right:8px;"></i>
          <strong><?php echo e($m['name']); ?></strong>&nbsp;<span class="muted">— <?php echo e($m['dosage']); ?> · <?php echo e($m['schedule_time']); ?></span>
        </button>
      </form>
    <?php endforeach; ?>

    <div class="divider"></div>
    <details>
      <summary style="cursor:pointer;font-weight:700;font-size:13.5px;color:var(--teal-dark);">+ Add a supplement/vitamin</summary>
      <form method="post" action="reminders.php" style="margin-top:12px;">
        <input type="hidden" name="action" value="add_supplement">

        <div class="field">
          <label>Name</label>
          <select id="rem_name_select" name="name" required onchange="pcToggleOther(this,'rem_name_other')">
            <option value="">Select an item…</option>
            <option>Prenatal Vitamin</option>
            <option>Iron Supplement</option>
            <option>Folic Acid</option>
            <option>Calcium</option>
            <option>Vitamin D</option>
            <option>DHA / Omega-3</option>
            <option>Vitamin B6</option>
            <option value="__other__">Other (type it in)</option>
          </select>
          <input type="text" id="rem_name_other" name="name" disabled style="display:none;margin-top:6px;" placeholder="Enter supplement/vitamin name">
        </div>

        <div class="field">
          <label>Dosage</label>
          <select id="rem_dosage_select" name="dosage" onchange="pcToggleOther(this,'rem_dosage_other')">
            <option value="">Select a dosage…</option>
            <option>1 tablet</option>
            <option>2 tablets</option>
            <option>1 capsule</option>
            <option>250mg</option>
            <option>500mg</option>
            <option>1000mg</option>
            <option value="__other__">Other (type it in)</option>
          </select>
          <input type="text" id="rem_dosage_other" name="dosage" disabled style="display:none;margin-top:6px;" placeholder="Enter dosage">
        </div>

        <div class="field">
          <label>Schedule</label>
          <select id="rem_schedule_select" name="schedule_time" onchange="pcToggleOther(this,'rem_schedule_other')">
            <option value="">Select a schedule…</option>
            <option>Morning, before breakfast</option>
            <option>Morning, after breakfast</option>
            <option>Afternoon, after lunch</option>
            <option>Evening, after dinner</option>
            <option>Before bedtime</option>
            <option value="__other__">Other (type it in)</option>
          </select>
          <input type="text" id="rem_schedule_other" name="schedule_time" disabled style="display:none;margin-top:6px;" placeholder="Enter schedule">
        </div>

        <button class="btn btn-outline btn-block btn-sm" type="submit"><i class="fa-solid fa-plus"></i> Add</button>
      </form>
    </details>
    <div class="muted" style="font-size:12px;margin-top:10px;">Manage your full list (remove items, etc.) in <a href="medications.php" style="color:var(--teal-dark);font-weight:700;">Medications &amp; Vitamins</a>.</div>
  </div>

</div>

<?php render_footer(); ?>