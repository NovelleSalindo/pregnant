<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$a = $stmt->fetch();

$ahp = $a ? json_decode($a['ahp_json'], true) : null;
$fuzzy = $a ? json_decode($a['fuzzy_json'], true) : null;
$rules = $a ? json_decode($a['rules_json'], true) : [];
$recs = $a ? json_decode($a['recommendations_json'], true) : [];

render_header('Risk Analysis', 'analyze');
?>

<?php if (!$a): ?>
  <div class="card empty">
    <i class="fa-solid fa-diagram-project"></i>
    No risk assessment yet. Complete a symptom check-in first.
    <div style="margin-top:12px;"><a class="btn btn-primary" href="symptoms.php">Start Symptom Check-in</a></div>
  </div>
<?php else: ?>

<div class="grid grid-2" style="align-items:start;">
  <div class="card" style="text-align:center;">
    <div class="eyebrow">Overall Risk Score</div>
    <div class="risk-gauge-wrap">
      <?php echo risk_gauge_svg($a['score'], $a['level'], 220); ?>
      <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($a['level']); ?>);"><?php echo (int)$a['score']; ?></div>
      <span class="badge <?php echo risk_badge_class($a['level']); ?>"><?php echo e($a['level']); ?> Risk</span>
    </div>
    <div class="muted" style="margin-top:10px;font-size:12.5px;">Generated <?php echo e(fmt_datetime($a['date'])); ?> · Decision support only, not a diagnosis.</div>
    <a class="btn btn-outline btn-sm" href="compare.php" style="margin-top:10px;"><i class="fa-solid fa-code-compare"></i> Compare with Previous</a>
  </div>

  <div class="card">
    <div class="eyebrow">Recommendations</div>
    <?php foreach ($recs as $r): ?>
      <div class="kv">
        <span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:<?php echo !empty($r['urgent']) ? 'var(--risk-high)' : 'var(--teal)'; ?>;"></i><?php echo e($r['text']); ?></span>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Step 2 — AHP Weighted Contribution per Criterion</div>
  <h3 style="margin-top:6px;">What's driving this score</h3>
  <?php foreach ($ahp['contributions'] as $key => $val):
      $pct = ($ahp['weights'][$key] ?? 0) > 0 ? ($val / array_sum($ahp['contributions'])) * 100 : 0;
  ?>
    <?php echo contrib_bar(AHP_LABELS[$key] ?? $key, $pct); ?>
  <?php endforeach; ?>
</div>

<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card">
    <div class="eyebrow">Step 3 — Fuzzy Logic Membership</div>
    <h3 style="margin-top:6px;">Composite score: <?php echo e($fuzzy['weightedScore']); ?></h3>
    <div class="kv"><span class="k">Low membership</span><span class="v"><?php echo number_format($fuzzy['membership']['low']*100,0); ?>%</span></div>
    <div class="kv"><span class="k">Medium membership</span><span class="v"><?php echo number_format($fuzzy['membership']['medium']*100,0); ?>%</span></div>
    <div class="kv"><span class="k">High membership</span><span class="v"><?php echo number_format($fuzzy['membership']['high']*100,0); ?>%</span></div>
    <div class="kv"><span class="k">Defuzzified centroid</span><span class="v"><?php echo (int)$fuzzy['centroid']; ?></span></div>
  </div>

  <div class="card">
    <div class="eyebrow">Step 4 — Rule-Based Expert Layer</div>
    <h3 style="margin-top:6px;">Rules triggered</h3>
    <?php if ($rules): foreach ($rules as $r): ?>
      <div class="engine-step">
        <div class="num"><?php echo strtoupper(substr($r['id'],1)); ?></div>
        <div><?php echo e($r['text']); ?></div>
      </div>
    <?php endforeach; else: ?>
      <div class="empty"><i class="fa-solid fa-check"></i>No expert rules triggered this time.</div>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Emergency Contacts</div>
  <div class="grid grid-3">
    <?php foreach (EMERGENCY_HOTLINES as $h): ?>
      <div class="kv"><span class="k"><?php echo e($h['name']); ?></span><span class="v"><a href="tel:<?php echo e($h['number']); ?>"><?php echo e($h['number']); ?></a></span></div>
    <?php endforeach; ?>
  </div>
</div>

<?php endif; ?>
<?php render_footer(); ?>
