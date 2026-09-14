<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id=?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'set_pre_weight'){
    $pdo->prepare("UPDATE patient_profiles SET pre_pregnancy_weight_kg=? WHERE user_id=?")
        ->execute([(float)$_POST['pre_pregnancy_weight_kg'], $u['id']]);
    flash('Pre-pregnancy weight saved.', 'success');
    redirect('weight_tracker.php');
}

$preWeight = $profile['pre_pregnancy_weight_kg'] ?? null;
$heightCm = $profile['height_cm'] ?? null;
$lmp = $profile['lmp'] ?? null;

$category = null;
if ($preWeight && $heightCm){
    $preBmi = bmi_of($preWeight, $heightCm);
    $category = bmi_category($preBmi);
}

$stmt = $pdo->prepare("SELECT date, weight_kg FROM monitoring WHERE user_id=? AND weight_kg IS NOT NULL ORDER BY date ASC");
$stmt->execute([$u['id']]);
$weightRows = $stmt->fetchAll();

$chartLabels = []; $actualWeights = []; $recMin = []; $recMax = [];
$currentGain = null; $currentWeek = null; $onTrack = null;

if ($preWeight && $lmp){
    foreach ($weightRows as $r){
        $week = (int)floor((strtotime($r['date']) - strtotime($lmp)) / (7*86400));
        if ($week < 0) $week = 0;
        $chartLabels[] = 'Wk ' . $week;
        $actualWeights[] = (float)$r['weight_kg'];
        [$min,$max] = recommended_weight_gain_range($category, $week);
        $recMin[] = round($preWeight + $min, 1);
        $recMax[] = round($preWeight + $max, 1);
    }
    if ($weightRows){
        $last = end($weightRows);
        $currentWeek = (int)floor((strtotime($last['date']) - strtotime($lmp)) / (7*86400));
        $currentGain = round($last['weight_kg'] - $preWeight, 1);
        [$expMin,$expMax] = recommended_weight_gain_range($category, $currentWeek);
        $onTrack = ($currentGain >= $expMin - 1 && $currentGain <= $expMax + 1);
    }
}

render_header('Weight Gain Tracker', 'weight_tracker');
?>

<?php if (!$preWeight || !$heightCm || !$lmp): ?>
<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Setup Needed</div>
  <p class="muted">To show your personalized healthy weight-gain range, we need your pre-pregnancy weight (plus height and LMP, already in your Profile).</p>
  <form method="post" action="weight_tracker.php" style="max-width:320px;">
    <input type="hidden" name="action" value="set_pre_weight">
    <div class="field"><label>Pre-Pregnancy Weight (kg)</label><input type="number" step="0.1" name="pre_pregnancy_weight_kg" required></div>
    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button>
  </form>
</div>
<?php else: ?>

<div class="grid grid-3" style="margin-bottom:16px;">
  <div class="card stat"><div class="eyebrow">Pre-Pregnancy BMI Category</div><div class="num" style="font-size:20px;"><?php echo e(bmi_category_label($category)); ?></div></div>
  <div class="card stat"><div class="eyebrow">Total Weight Gained</div><div class="num"><?php echo $currentGain !== null ? $currentGain.' kg' : '—'; ?></div></div>
  <div class="card stat">
    <div class="eyebrow">Status</div>
    <div class="num" style="font-size:18px;color:<?php echo $onTrack===null?'var(--muted)':($onTrack?'var(--risk-low)':'var(--risk-mod)'); ?>;">
      <?php echo $onTrack===null ? '—' : ($onTrack ? 'On Track' : 'Outside Range'); ?>
    </div>
  </div>
</div>

<div class="card">
  <h3 style="margin-top:0;">Weight Gain vs. Healthy Range</h3>
  <p class="muted" style="font-size:12.5px;margin-top:-6px;">Recommended range is estimated from your pre-pregnancy BMI category (a general guideline, not personalized medical advice — confirm specifics with your OB-GYN).</p>
  <canvas id="weightChart" height="200"></canvas>
</div>

<script>
new Chart(document.getElementById('weightChart'), {
  type: 'line',
  data: {
    labels: <?php echo json_encode($chartLabels); ?>,
    datasets: [
      { label: 'Recommended Max', data: <?php echo json_encode($recMax); ?>, borderColor: 'rgba(227,166,43,0.5)', backgroundColor: 'rgba(227,166,43,0.08)', fill: '+1', pointRadius: 0, borderDash:[4,4] },
      { label: 'Recommended Min', data: <?php echo json_encode($recMin); ?>, borderColor: 'rgba(227,166,43,0.5)', pointRadius: 0, borderDash:[4,4], fill:false },
      { label: 'Your Weight', data: <?php echo json_encode($actualWeights); ?>, borderColor: '#0E9C8F', backgroundColor: '#0E9C8F', tension:.3 },
    ]
  },
  options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
});
</script>

<?php endif; ?>
<?php render_footer(); ?>
