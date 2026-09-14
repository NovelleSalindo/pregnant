<?php
require_once __DIR__ . '/base.php';
$u = require_role('admin');

$patientId = $_GET['id'] ?? '';
$stmt = $pdo->prepare("SELECT * FROM users WHERE id=? AND role='patient'");
$stmt->execute([$patientId]);
$patient = $stmt->fetch();
if (!$patient){ flash('Patient not found.', 'error'); redirect('admin_patients.php'); }

$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id=?");
$stmt->execute([$patientId]);
$profile = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add_note'){
    $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, kind) VALUES (?,?,?,?,?,?)")
        ->execute([uid('ntf'), $patientId, 'Note from ' . $u['name'], trim($_POST['note']), now_iso(), 'info']);
    flash('Note sent to patient.', 'success');
    log_action('admin_note:' . $patientId);
    redirect('admin_patient.php?id=' . urlencode($patientId));
}

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id=? ORDER BY date DESC LIMIT 10");
$stmt->execute([$patientId]);
$assessments = $stmt->fetchAll();
$latest = $assessments[0] ?? null;

$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id=? ORDER BY date DESC LIMIT 10");
$stmt->execute([$patientId]);
$vitals = $stmt->fetchAll();

render_header('Patient: ' . $patient['name'], 'admin_patients');
?>

<a href="admin_patients.php" class="soft" style="font-size:13px;"><i class="fa-solid fa-arrow-left"></i> Back to patient list</a>

<div class="grid grid-3" style="margin-top:12px;align-items:start;">
  <div class="card" style="text-align:center;">
    <div class="avatar" style="margin:0 auto 10px;width:48px;height:48px;font-size:17px;"><?php echo e(initials($patient['name'])); ?></div>
    <h3 style="margin:4px 0;"><?php echo e($patient['name']); ?></h3>
    <div class="muted" style="font-size:13px;"><?php echo e($patient['email']); ?></div>
    <div class="divider"></div>
    <div class="kv"><span class="k">EDD</span><span class="v"><?php echo e(fmt_date($profile['edd'] ?? null)); ?></span></div>
    <div class="kv"><span class="k">Gravida</span><span class="v"><?php echo e($profile['gravida'] ?? '—'); ?></span></div>
    <div class="kv"><span class="k">Conditions</span><span class="v"><?php echo e($profile['conditions'] ?? 'None'); ?></span></div>
    <div class="kv"><span class="k">Phone</span><span class="v"><?php echo e($profile['phone'] ?? '—'); ?></span></div>
    <div class="kv"><span class="k">Emergency Contact</span><span class="v"><?php echo e($profile['emergency_name'] ?? '—'); ?></span></div>
  </div>

  <div class="card" style="text-align:center;">
    <div class="eyebrow">Current Risk</div>
    <?php if ($latest): ?>
      <div class="risk-gauge-wrap">
        <?php echo risk_gauge_svg($latest['score'], $latest['level']); ?>
        <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($latest['level']); ?>);"><?php echo (int)$latest['score']; ?></div>
        <span class="badge <?php echo risk_badge_class($latest['level']); ?>"><?php echo e($latest['level']); ?> Risk</span>
      </div>
    <?php else: ?>
      <div class="empty"><i class="fa-solid fa-diagram-project"></i>No assessment yet.</div>
    <?php endif; ?>
  </div>

  <div class="card">
    <h4 style="margin-top:0;">Send a Note</h4>
    <form method="post" action="admin_patient.php?id=<?php echo urlencode($patientId); ?>">
      <input type="hidden" name="action" value="add_note">
      <div class="field"><textarea name="note" rows="3" required placeholder="Message to patient..."></textarea></div>
      <button class="btn btn-primary btn-block btn-sm" type="submit"><i class="fa-solid fa-paper-plane"></i> Send</button>
    </form>
  </div>
</div>

<?php if ($latest):
    $recs = json_decode($latest['recommendations_json'], true) ?: [];
    $rules = json_decode($latest['rules_json'], true) ?: [];
?>
<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card">
    <h4 style="margin-top:0;">Recommendations</h4>
    <?php foreach ($recs as $r): ?>
      <div class="kv"><span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:<?php echo !empty($r['urgent']) ? 'var(--risk-high)' : 'var(--teal)'; ?>;"></i><?php echo e($r['text']); ?></span></div>
    <?php endforeach; ?>
  </div>
  <div class="card">
    <h4 style="margin-top:0;">Rules Triggered</h4>
    <?php if ($rules): foreach ($rules as $r): ?>
      <div class="kv"><span class="k"><?php echo e($r['text']); ?></span></div>
    <?php endforeach; else: ?>
      <div class="empty"><i class="fa-solid fa-check"></i>No expert rules triggered.</div>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>

<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card">
    <h4 style="margin-top:0;">Recent Vitals</h4>
    <table>
      <thead><tr><th>Date</th><th>BP</th><th>HB</th><th>Sugar</th></tr></thead>
      <tbody>
      <?php if(!$vitals): ?><tr><td colspan="4" class="muted">No vitals logged.</td></tr><?php endif; ?>
      <?php foreach ($vitals as $v): ?>
        <tr><td><?php echo e(fmt_date($v['date'])); ?></td><td><?php echo (int)$v['bp_sys']; ?>/<?php echo (int)$v['bp_dia']; ?></td><td><?php echo e($v['hemoglobin']); ?></td><td><?php echo e($v['blood_sugar']); ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="card">
    <h4 style="margin-top:0;">Assessment History</h4>
    <table>
      <thead><tr><th>Date</th><th>Level</th><th>Score</th></tr></thead>
      <tbody>
      <?php if(!$assessments): ?><tr><td colspan="3" class="muted">No assessments.</td></tr><?php endif; ?>
      <?php foreach ($assessments as $a): ?>
        <tr><td><?php echo e(fmt_date($a['date'])); ?></td><td><span class="badge <?php echo risk_badge_class($a['level']); ?>"><?php echo e($a['level']); ?></span></td><td><?php echo (int)$a['score']; ?></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php render_footer(); ?>
