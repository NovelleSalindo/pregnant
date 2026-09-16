<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 20");
$stmt->execute([$u['id']]);
$all = $stmt->fetchAll();

// Pick which two assessments to compare — via ?a=ID&b=ID, defaulting to the two most recent.
$idA = $_GET['a'] ?? ($all[0]['id'] ?? null);
$idB = $_GET['b'] ?? ($all[1]['id'] ?? null);

$byId = [];
foreach ($all as $row) { $byId[$row['id']] = $row; }
$a = $byId[$idA] ?? null;
$b = $byId[$idB] ?? null;

function decode_fields($row){
    if (!$row) return null;
    $row['ahp'] = json_decode($row['ahp_json'], true);
    $row['fuzzy'] = json_decode($row['fuzzy_json'], true);
    $row['rules'] = json_decode($row['rules_json'], true) ?: [];
    $row['recs'] = json_decode($row['recommendations_json'], true) ?: [];
    return $row;
}
$a = decode_fields($a);
$b = decode_fields($b);

function delta_badge($newVal, $oldVal, $lowerIsBetter = true){
    $diff = $newVal - $oldVal;
    if ($diff == 0) return '<span class="muted" style="font-size:12px;"><i class="fa-solid fa-equals"></i> No change</span>';
    $improved = $lowerIsBetter ? ($diff < 0) : ($diff > 0);
    $color = $improved ? 'var(--risk-low)' : 'var(--risk-high)';
    $icon = $diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    $sign = $diff > 0 ? '+' : '';
    return "<span style=\"color:{$color};font-weight:700;font-size:12.5px;\"><i class=\"fa-solid {$icon}\"></i> {$sign}" . number_format($diff, 0) . "</span>";
}

render_header('Compare Assessments', 'analyze');
?>

<div class="card">
  <div class="eyebrow">Assessment Comparison</div>
  <h1 style="margin:6px 0 4px;font-size:22px;">Compare Current vs Previous Results</h1>
  <div class="muted" style="font-size:13.5px;">See how your risk score, contributing factors, and triggered rules have changed between two check-ins.</div>

  <?php if (count($all) < 1): ?>
    <div class="empty" style="margin-top:16px;">
      <i class="fa-solid fa-diagram-project"></i>
      No assessments yet. Complete a <a href="symptoms.php">symptom check-in</a> to get started.
    </div>
  <?php elseif (count($all) < 2): ?>
    <div class="empty" style="margin-top:16px;">
      <i class="fa-solid fa-clock-rotate-left"></i>
      You only have one assessment so far. Complete another <a href="symptoms.php">symptom check-in</a> later to unlock comparisons.
    </div>
  <?php else: ?>
  <form method="get" action="compare.php" style="margin-top:16px;">
    <div class="grid grid-2">
      <div class="field">
        <label>Comparing (current)</label>
        <select name="a" onchange="this.form.submit()">
          <?php foreach ($all as $row): ?>
            <option value="<?php echo e($row['id']); ?>" <?php echo $row['id']===$idA?'selected':''; ?>>
              <?php echo e(fmt_datetime($row['date'])); ?> — <?php echo e($row['level']); ?> (<?php echo (int)$row['score']; ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label>Against (previous)</label>
        <select name="b" onchange="this.form.submit()">
          <?php foreach ($all as $row): ?>
            <option value="<?php echo e($row['id']); ?>" <?php echo $row['id']===$idB?'selected':''; ?>>
              <?php echo e(fmt_datetime($row['date'])); ?> — <?php echo e($row['level']); ?> (<?php echo (int)$row['score']; ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>
  </form>
  <?php endif; ?>
</div>

<?php if ($a && $b): ?>

<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card" style="text-align:center;">
    <div class="eyebrow">Current — <?php echo e(fmt_datetime($a['date'])); ?></div>
    <div class="risk-gauge-wrap">
      <?php echo risk_gauge_svg($a['score'], $a['level'], 180); ?>
      <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($a['level']); ?>);"><?php echo (int)$a['score']; ?></div>
      <span class="badge <?php echo risk_badge_class($a['level']); ?>"><?php echo e($a['level']); ?> Risk</span>
    </div>
  </div>
  <div class="card" style="text-align:center;">
    <div class="eyebrow">Previous — <?php echo e(fmt_datetime($b['date'])); ?></div>
    <div class="risk-gauge-wrap">
      <?php echo risk_gauge_svg($b['score'], $b['level'], 180); ?>
      <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($b['level']); ?>);"><?php echo (int)$b['score']; ?></div>
      <span class="badge <?php echo risk_badge_class($b['level']); ?>"><?php echo e($b['level']); ?> Risk</span>
    </div>
  </div>
</div>

<div class="card" style="margin-top:16px;text-align:center;">
  <div class="eyebrow">Score Change</div>
  <div style="font-size:20px;margin-top:6px;"><?php echo delta_badge((int)$a['score'], (int)$b['score']); ?></div>
  <div class="muted" style="font-size:12.5px;margin-top:6px;">
    <?php if ($a['level'] !== $b['level']): ?>
      Risk level moved from <strong><?php echo e($b['level']); ?></strong> to <strong><?php echo e($a['level']); ?></strong>.
    <?php else: ?>
      Risk level stayed at <strong><?php echo e($a['level']); ?></strong>.
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">AHP Weighted Contribution per Criterion</div>
  <h3 style="margin-top:6px;">What changed</h3>
  <?php
  $keys = array_unique(array_merge(array_keys($a['ahp']['contributions'] ?? []), array_keys($b['ahp']['contributions'] ?? [])));
  $sumA = array_sum($a['ahp']['contributions'] ?? []) ?: 1;
  $sumB = array_sum($b['ahp']['contributions'] ?? []) ?: 1;
  foreach ($keys as $key):
      $pctA = (($a['ahp']['contributions'][$key] ?? 0) / $sumA) * 100;
      $pctB = (($b['ahp']['contributions'][$key] ?? 0) / $sumB) * 100;
  ?>
    <div class="contrib-bar-row" style="align-items:center;">
      <div class="name"><?php echo e(AHP_LABELS[$key] ?? $key); ?></div>
      <div class="contrib-bar-track"><div class="contrib-bar-fill" style="width:<?php echo min(100,max(0,$pctA)); ?>%"></div></div>
      <div class="contrib-bar-pct"><?php echo number_format($pctA,0); ?>%</div>
      <div style="min-width:70px;text-align:right;"><?php echo delta_badge(round($pctA), round($pctB)); ?></div>
    </div>
  <?php endforeach; ?>
  <div class="muted" style="font-size:12px;margin-top:8px;">Bars show the current assessment's share; the arrow shows the change vs. the previous one.</div>
</div>

<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card">
    <div class="eyebrow">Rules Triggered — Current</div>
    <?php if ($a['rules']): foreach ($a['rules'] as $r): ?>
      <div class="engine-step"><div class="num"><?php echo strtoupper(substr($r['id'],1)); ?></div><div><?php echo e($r['text']); ?></div></div>
    <?php endforeach; else: ?>
      <div class="empty"><i class="fa-solid fa-check"></i>No expert rules triggered.</div>
    <?php endif; ?>
  </div>
  <div class="card">
    <div class="eyebrow">Rules Triggered — Previous</div>
    <?php if ($b['rules']): foreach ($b['rules'] as $r): ?>
      <div class="engine-step"><div class="num"><?php echo strtoupper(substr($r['id'],1)); ?></div><div><?php echo e($r['text']); ?></div></div>
    <?php endforeach; else: ?>
      <div class="empty"><i class="fa-solid fa-check"></i>No expert rules triggered.</div>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Recommendations — Current</div>
  <?php foreach ($a['recs'] as $r): ?>
    <div class="kv"><span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:<?php echo !empty($r['urgent']) ? 'var(--risk-high)' : 'var(--teal)'; ?>;"></i><?php echo e($r['text']); ?></span></div>
  <?php endforeach; ?>
  <?php if (!$a['recs']): ?><div class="empty">No recommendations recorded.</div><?php endif; ?>
</div>

<div class="card" style="margin-top:16px;text-align:center;">
  <a class="btn btn-outline btn-sm" href="analyze.php"><i class="fa-solid fa-diagram-project"></i> View Full Breakdown of Current</a>
  <a class="btn btn-outline btn-sm" href="monitoring.php" style="margin-left:8px;"><i class="fa-solid fa-clock-rotate-left"></i> View All History</a>
</div>

<?php elseif (count($all) >= 2): ?>
  <div class="card empty" style="margin-top:16px;">
    <i class="fa-solid fa-circle-exclamation"></i>
    Please choose two assessments above to compare.
  </div>
<?php endif; ?>

<?php render_footer(); ?>
