<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$asmId = $_GET['a'] ?? null;
$latest = null;
if ($asmId) {
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE id = ? AND user_id = ?");
    $stmt->execute([$asmId, $u['id']]);
    $latest = $stmt->fetch();
}
if (!$latest) {
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $latest = $stmt->fetch();
}

$rawRecs = $latest ? (json_decode($latest['recommendations_json'], true) ?: []) : [];

if (empty($rawRecs)) {
    $stmtCoop = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
    $stmtCoop->execute([$u['id']]);
    $coop = $stmtCoop->fetch();
    if ($coop) {
        $cLevel = ucfirst(strtolower($coop['risk_level']));
        if ($cLevel === 'Severe') {
            $rawRecs = [
                ['text' => 'Contact your OB-GYN or go to the nearest hospital now', 'urgent' => true, 'category' => 'Urgent Action', 'icon' => 'fa-triangle-exclamation'],
                ['text' => 'Do not wait for your next scheduled appointment', 'urgent' => true, 'category' => 'Urgent Action', 'icon' => 'fa-triangle-exclamation'],
                ['text' => 'High-risk tertiary hospital evaluation and continuous monitoring required', 'urgent' => false, 'category' => 'Clinical Guidance', 'icon' => 'fa-hospital']
            ];
        } elseif ($cLevel === 'High') {
            $rawRecs = [
                ['text' => 'Schedule an OB-GYN checkup within 24 to 48 hours', 'urgent' => true, 'category' => 'Priority Care', 'icon' => 'fa-calendar-day'],
                ['text' => 'More frequent prenatal checkups and specialized maternal-fetal assessments recommended', 'urgent' => false, 'category' => 'Clinical Guidance', 'icon' => 'fa-circle-check'],
                ['text' => 'Closely monitor blood pressure, blood glucose, and daily fetal kick counts', 'urgent' => false, 'category' => 'Daily Monitoring', 'icon' => 'fa-circle-check']
            ];
        }
    }
}
$recs = [];
foreach ($rawRecs as $item) {
    if (is_string($item)) {
        $recs[] = ['text' => $item, 'icon' => 'fa-circle-check', 'urgent' => false];
    } elseif (is_array($item) && !empty($item['text'])) {
        $icon = $item['icon'] ?? (!empty($item['urgent']) ? 'fa-triangle-exclamation' : 'fa-circle-check');
        if (strpos($icon, 'fa-') !== 0) $icon = 'fa-' . $icon;
        $recs[] = [
            'text' => $item['text'],
            'category' => $item['category'] ?? '',
            'icon' => $icon,
            'urgent' => !empty($item['urgent']) || (($item['category'] ?? '') === 'Urgent Action')
        ];
    }
}
$urgentRecs = array_filter($recs, fn($r) => !empty($r['urgent']));
$generalRecs = array_filter($recs, fn($r) => empty($r['urgent']));

// Fetch reported symptoms associated with this assessment
$reportedSymptoms = [];
if ($latest) {
    try {
        $symStmt = $pdo->prepare("
            SELECT sli.symptom_id AS id, sli.severity, sli.duration, sli.frequency, sc.name 
            FROM symptom_logs sl
            JOIN symptom_log_items sli ON sli.symptom_log_id = sl.id
            LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id
            WHERE sl.user_id = ? AND ABS(TIMESTAMPDIFF(SECOND, sl.date, ?)) <= 120 AND sli.severity != 'None'
            ORDER BY sli.id ASC
        ");
        $symStmt->execute([$u['id'], $latest['date']]);
        $reportedSymptoms = $symStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($reportedSymptoms)) {
            // Fallback to latest symptom log with active symptoms
            $symStmtLatest = $pdo->prepare("
                SELECT sli.symptom_id AS id, sli.severity, sli.duration, sli.frequency, sc.name 
                FROM symptom_logs sl
                JOIN symptom_log_items sli ON sli.symptom_log_id = sl.id
                LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id
                WHERE sl.user_id = ? AND sli.severity != 'None'
                ORDER BY sl.date DESC LIMIT 10
            ");
            $symStmtLatest->execute([$u['id']]);
            $reportedSymptoms = $symStmtLatest->fetchAll(PDO::FETCH_ASSOC);
        }
    } catch (Exception $e) {}
}

// Recommendation history — one row per past assessment, so the patient can see how advice changed over time
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 10");
$stmt->execute([$u['id']]);
$history = $stmt->fetchAll();

render_header('Recommendations', 'recommendations');
?>

<?php if (!$latest): ?>
  <div class="card empty">
    <i class="fa-solid fa-lightbulb"></i>
    No recommendations yet. Complete a symptom check-in to get your first personalized set.
    <div style="margin-top:12px;"><a class="btn btn-primary" href="symptoms.php">Start Symptom Check-in</a></div>
  </div>
<?php else: ?>

<div class="hero-gradient" style="margin-bottom:20px;">
  <div class="eyebrow" style="color:rgba(255,255,255,.85);">Clinical Care Recommendations</div>
  <h1 style="margin:6px 0 4px;color:#fff;font-size:24px;">
    Personalized Clinical Care Plan
  </h1>
  <div style="color:rgba(255,255,255,.9);font-size:14px;">
    Generated <?php echo e(fmt_datetime($latest['date'])); ?> · Actionable maternal recommendations and care plan tailored to your reported symptoms and check-in.
  </div>
</div>

<!-- Reported Symptoms from Check-in -->
<div class="card" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div class="eyebrow" style="margin-bottom:0;"><i class="fa-solid fa-stethoscope" style="margin-right:6px;color:var(--teal);"></i>Symptoms Reported During Check-in</div>
    <a href="symptoms.php" class="btn btn-outline btn-sm"><i class="fa-solid fa-plus"></i> New Check-in</a>
  </div>
  <?php if (!empty($reportedSymptoms)): ?>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <?php foreach ($reportedSymptoms as $sym):
        $sev = strtolower($sym['severity'] ?? 'mild');
        $isSev = strpos($sev, 'severe') !== false;
        $isMod = strpos($sev, 'moderate') !== false;
        $badgeClass = $isSev ? 'badge-danger' : ($isMod ? 'badge-warning' : 'badge-primary');
        $badgeBg = $isSev ? '#FEE2E2' : ($isMod ? '#FEF3C7' : '#E6F4F1');
        $badgeColor = $isSev ? '#DC2626' : ($isMod ? '#D97706' : 'var(--teal)');
        $badgeBorder = $isSev ? '#FCA5A5' : ($isMod ? '#FCD34D' : '#B2DFDB');
      ?>
        <span style="font-size:12.5px;padding:6px 12px;border-radius:12px;background:<?php echo $badgeBg; ?>;color:<?php echo $badgeColor; ?>;border:1px solid <?php echo $badgeBorder; ?>;display:inline-flex;align-items:center;gap:6px;">
          <i class="fa-solid <?php echo $isSev ? 'fa-triangle-exclamation' : ($isMod ? 'fa-circle-exclamation' : 'fa-circle-check'); ?>"></i>
          <strong><?php echo e($sym['name'] ?? $sym['symptom_id'] ?? 'Symptom'); ?>:</strong> <?php echo e($sym['severity']); ?>
        </span>
      <?php endforeach; ?>
    </div>
  <?php else: ?>
    <p class="muted" style="margin:0;font-size:13.5px;"><i class="fa-solid fa-circle-check" style="color:var(--teal);margin-right:6px;"></i>Routine maternal check-in: No acute critical symptoms reported.</p>
  <?php endif; ?>
</div>

<?php if ($urgentRecs): ?>
<div class="card" style="margin-bottom:16px;border-color:var(--risk-high);">
  <div class="eyebrow" style="color:var(--risk-high);"><i class="fa-solid fa-triangle-exclamation"></i> Urgent — Act On These First</div>
  <?php foreach ($urgentRecs as $idx => $r): ?>
    <div class="kv rec-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
      <label style="cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;margin:0;">
        <input type="checkbox" class="rec-checkbox" style="width:18px;height:18px;accent-color:var(--risk-high);" />
        <span class="k rec-text"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:var(--risk-high);"></i><strong><?php echo e($r['text']); ?></strong></span>
      </label>
    </div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Daily Care Recommendations</div>
  <?php foreach ($generalRecs as $idx => $r): ?>
    <div class="kv rec-row" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
      <label style="cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;margin:0;">
        <input type="checkbox" class="rec-checkbox" style="width:18px;height:18px;accent-color:var(--teal);" />
        <span class="k rec-text"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:var(--teal);"></i><?php echo e($r['text']); ?></span>
      </label>
    </div>
  <?php endforeach; ?>
  <?php if (!$generalRecs): ?><div class="empty"><i class="fa-solid fa-leaf"></i>No general recommendations logged.</div><?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const checkboxes = document.querySelectorAll('.rec-checkbox');
  checkboxes.forEach((cb, idx) => {
    const key = 'pregna_rec_' + <?php echo json_encode($latest['id'] ?? 'default'); ?> + '_' + idx;
    if (localStorage.getItem(key) === 'true') {
      cb.checked = true;
      const row = cb.closest('.rec-row');
      if (row) {
        row.style.opacity = '0.6';
        const txt = row.querySelector('.rec-text');
        if (txt) txt.style.textDecoration = 'line-through';
      }
    }
    cb.addEventListener('change', function() {
      localStorage.setItem(key, cb.checked ? 'true' : 'false');
      const row = cb.closest('.rec-row');
      if (row) {
        row.style.opacity = cb.checked ? '0.6' : '1';
        const txt = row.querySelector('.rec-text');
        if (txt) txt.style.textDecoration = cb.checked ? 'line-through' : 'none';
      }
    });
  });
});
</script>

<div class="grid grid-2" style="margin-bottom:16px;align-items:start;">
  <div class="card">
    <div class="eyebrow">Emergency Contacts</div>
    <?php
    try {
        $stmtProfRec = $pdo->prepare("SELECT emergency_name, emergency_phone FROM patient_profiles WHERE user_id = ?");
        $stmtProfRec->execute([$u['id']]);
        $profRec = $stmtProfRec->fetch();
        if (!empty($profRec['emergency_phone'])):
    ?>
      <div class="kv"><span class="k"><i class="fa-solid fa-heart" style="color:var(--danger);margin-right:6px;"></i><?php echo e($profRec['emergency_name'] ?: 'Emergency Contact'); ?></span><span class="v"><a href="tel:<?php echo e($profRec['emergency_phone']); ?>"><?php echo e($profRec['emergency_phone']); ?></a></span></div>
    <?php
        endif;
    } catch (Exception $e) {}
    ?>
    <?php foreach (EMERGENCY_HOTLINES as $h): ?>
      <div class="kv"><span class="k"><?php echo e($h['name']); ?></span><span class="v"><?php if (!empty($h['number'])): ?><a href="tel:<?php echo e($h['number']); ?>"><?php echo e($h['number']); ?></a><?php else: ?><a href="profile.php" class="muted" style="font-size:12px;">Add clinic contact in Profile</a><?php endif; ?></span></div>
    <?php endforeach; ?>
  </div>
  <div class="card">
    <div class="eyebrow">Want More Guidance?</div>
    <p class="muted" style="font-size:13.5px;">Browse trimester-specific tips, nutrition guidance, and warning signs.</p>
    <a class="btn btn-outline btn-block btn-sm" href="education.php"><i class="fa-solid fa-book-medical"></i> Go to Education Hub</a>
  </div>
</div>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <h3 style="margin-top:0;">Recommendation History</h3>
    <a class="btn btn-outline btn-sm" href="compare.php"><i class="fa-solid fa-code-compare"></i> Compare Two</a>
  </div>
  <p class="muted" style="margin-top:-6px;font-size:13px;">How your guidance has changed as your risk level changed over time.</p>
  <?php foreach ($history as $h):
      $hRecs = json_decode($h['recommendations_json'], true) ?: [];
  ?>
    <div class="engine-step">
      <div class="num" style="background:var(--teal-light);color:var(--teal);">
        <i class="fa-solid fa-list-check"></i>
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="badge badge-primary">Care Guidance</span>
          <span class="muted" style="font-size:12px;"><?php echo e(fmt_datetime($h['date'])); ?></span>
        </div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--ink-soft);">
          <?php foreach (array_slice($hRecs, 0, 3) as $r): ?>
            <li><?php echo e(is_array($r) ? ($r['text'] ?? '') : $r); ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
  <?php endforeach; ?>
</div>

<?php endif; ?>
<?php render_footer(); ?>
