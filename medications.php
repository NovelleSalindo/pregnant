<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';
    if ($action === 'add'){
        $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?,?,?,?,?,1)")
            ->execute([uid('med'), $u['id'], trim($_POST['name']), trim($_POST['dosage']), trim($_POST['schedule_time'])]);
        flash('Medication/vitamin added.', 'success');
    } elseif ($action === 'toggle_taken'){
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
    } elseif ($action === 'deactivate'){
        $pdo->prepare("UPDATE medications SET active=0 WHERE id=? AND user_id=?")->execute([$_POST['id'], $u['id']]);
        flash('Medication removed from your list.', 'info');
    }
    log_action('medications_update');
    redirect('medications.php');
}

$stmt = $pdo->prepare("SELECT * FROM medications WHERE user_id=? AND active=1 ORDER BY name");
$stmt->execute([$u['id']]);
$meds = $stmt->fetchAll();

$today = today_iso();
$stmt = $pdo->prepare("SELECT medication_id FROM medication_logs WHERE user_id=? AND date=?");
$stmt->execute([$u['id'], $today]);
$takenToday = $stmt->fetchAll(PDO::FETCH_COLUMN);

// simple 7-day adherence view
$stmt = $pdo->prepare("SELECT date, COUNT(*) as cnt FROM medication_logs WHERE user_id=? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY date");
$stmt->execute([$u['id']]);
$adherence = [];
foreach ($stmt->fetchAll() as $row) $adherence[$row['date']] = (int)$row['cnt'];

render_header('Medication & Vitamin Reminders', 'medications');
?>

<div class="grid grid-2" style="align-items:start;">
  <div class="card">
    <h3 style="margin-top:0;">Add a Medication or Vitamin</h3>
    <form method="post" action="medications.php">
      <input type="hidden" name="action" value="add">

      <div class="field">
        <label>Name</label>
        <select id="med_name_select" name="name" required onchange="pcToggleOther(this,'med_name_other')">
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
        <input type="text" id="med_name_other" name="name" disabled style="display:none;margin-top:6px;" placeholder="Enter medication/vitamin name">
      </div>

      <div class="field">
        <label>Dosage</label>
        <select id="med_dosage_select" name="dosage" onchange="pcToggleOther(this,'med_dosage_other')">
          <option value="">Select a dosage…</option>
          <option>1 tablet</option>
          <option>2 tablets</option>
          <option>1 capsule</option>
          <option>250mg</option>
          <option>500mg</option>
          <option>1000mg</option>
          <option value="__other__">Other (type it in)</option>
        </select>
        <input type="text" id="med_dosage_other" name="dosage" disabled style="display:none;margin-top:6px;" placeholder="Enter dosage">
      </div>

      <div class="field">
        <label>Schedule</label>
        <select id="med_schedule_select" name="schedule_time" onchange="pcToggleOther(this,'med_schedule_other')">
          <option value="">Select a schedule…</option>
          <option>Morning, before breakfast</option>
          <option>Morning, after breakfast</option>
          <option>Afternoon, after lunch</option>
          <option>Evening, after dinner</option>
          <option>Before bedtime</option>
          <option value="__other__">Other (type it in)</option>
        </select>
        <input type="text" id="med_schedule_other" name="schedule_time" disabled style="display:none;margin-top:6px;" placeholder="Enter schedule">
      </div>

      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-plus"></i> Add to My List</button>
    </form>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Today's Checklist</h3>
    <?php if (!$meds): ?>
      <div class="empty"><i class="fa-solid fa-pills"></i>No medications/vitamins added yet.</div>
    <?php endif; ?>
    <?php foreach ($meds as $m): $isTaken = in_array($m['id'], $takenToday); ?>
      <form method="post" action="medications.php" style="margin-bottom:8px;">
        <input type="hidden" name="action" value="toggle_taken">
        <input type="hidden" name="medication_id" value="<?php echo e($m['id']); ?>">
        <button type="submit" class="chip <?php echo $isTaken?'on':''; ?>" style="width:100%;justify-content:space-between;display:flex;cursor:pointer;border:1.5px solid var(--border);padding:12px 14px;">
          <span><i class="fa-solid <?php echo $isTaken?'fa-circle-check':'fa-circle'; ?>" style="margin-right:8px;"></i><strong><?php echo e($m['name']); ?></strong> <span class="muted">— <?php echo e($m['dosage']); ?> · <?php echo e($m['schedule_time']); ?></span></span>
        </button>
      </form>
    <?php endforeach; ?>
  </div>
</div>

<?php if ($meds): ?>
<div class="card" style="margin-top:16px;">
  <h3 style="margin-top:0;">Manage Your List</h3>
  <table>
    <thead><tr><th>Name</th><th>Dosage</th><th>Schedule</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($meds as $m): ?>
      <tr>
        <td><?php echo e($m['name']); ?></td>
        <td><?php echo e($m['dosage']); ?></td>
        <td><?php echo e($m['schedule_time']); ?></td>
        <td>
          <form method="post" action="medications.php" onsubmit="return confirm('Remove this from your list?');">
            <input type="hidden" name="action" value="deactivate">
            <input type="hidden" name="id" value="<?php echo e($m['id']); ?>">
            <button class="btn btn-ghost btn-sm" type="submit"><i class="fa-solid fa-trash"></i></button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>

<?php render_footer(); ?>