<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT height_cm FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$heightCm = (float)($stmt->fetchColumn() ?: 160);

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $weight = (float)$_POST['weight_kg'];
    $bmi = bmi_of($weight, $heightCm);
    $stmt = $pdo->prepare("INSERT INTO monitoring
        (id, user_id, date, bp_sys, bp_dia, weight_kg, bmi, hemoglobin, blood_sugar, temp, heart_rate, fetal_movement, sleep_hours, water_intake, mood, activity)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        uid('mon'), $u['id'], now_iso(),
        (int)$_POST['bp_sys'], (int)$_POST['bp_dia'], $weight, $bmi,
        (float)$_POST['hemoglobin'], (int)$_POST['blood_sugar'], (float)($_POST['temp'] ?: 36.8),
        (int)($_POST['heart_rate'] ?: 78), (int)($_POST['fetal_movement'] ?: 0),
        (float)($_POST['sleep_hours'] ?: 7), (int)($_POST['water_intake'] ?: 6),
        trim($_POST['mood'] ?? ''), trim($_POST['activity'] ?? ''),
    ]);
    flash('Vitals logged successfully.', 'success');
    log_action('add_monitoring');
    redirect('monitoring.php');
}

$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 30");
$stmt->execute([$u['id']]);
$rows = $stmt->fetchAll();
$chartRows = array_reverse($rows);

// ---------- Risk monitoring data ----------
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 30");
$stmt->execute([$u['id']]);
$riskRows = $stmt->fetchAll();
$riskChartRows = array_reverse($riskRows);
$latestRisk = $riskRows[0] ?? null;

render_header('Vitals & Risk Monitoring', 'monitoring');
?>

<div class="grid grid-2" style="align-items:start;">
  <div class="card">
    <h3 style="margin-top:0;">Log Today's Vitals</h3>
    <form method="post" action="monitoring.php">
      <div class="grid grid-2">
        <div class="field"><label>Systolic BP (mmHg)</label><input type="number" name="bp_sys" required min="60" max="220" value="118"></div>
        <div class="field"><label>Diastolic BP (mmHg)</label><input type="number" name="bp_dia" required min="40" max="140" value="76"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Weight (kg)</label><input type="number" step="0.1" name="weight_kg" required value="62"></div>
        <div class="field"><label>Hemoglobin (g/dL)</label><input type="number" step="0.1" name="hemoglobin" required value="12"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Blood Sugar (mg/dL)</label><input type="number" name="blood_sugar" required value="95"></div>
        <div class="field"><label>Temperature (°C)</label><input type="number" step="0.1" name="temp" value="36.8"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Heart Rate (bpm)</label><input type="number" name="heart_rate" value="78"></div>
        <div class="field"><label>Fetal Movement (kicks/hr)</label><input type="number" name="fetal_movement" value="8"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Sleep (hours)</label><input type="number" step="0.5" name="sleep_hours" value="7"></div>
        <div class="field"><label>Water Intake (glasses)</label><input type="number" name="water_intake" value="6"></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Mood</label>
          <select name="mood"><option>Good</option><option>Okay</option><option>Tired</option><option>Anxious</option><option>Low</option></select>
        </div>
        <div class="field"><label>Activity Level</label>
          <select name="activity"><option>Resting</option><option>Light</option><option>Moderate</option><option>Active</option></select>
        </div>
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Entry</button>
    </form>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Blood Pressure Trend</h3>
    <canvas id="bpChart" height="180"></canvas>
    <div class="divider"></div>
    <h3 style="margin-top:0;">History</h3>
    <div style="max-height:320px;overflow-y:auto;">
      <table>
        <thead><tr><th>Date</th><th>BP</th><th>HB</th><th>Sugar</th><th>BMI</th></tr></thead>
        <tbody>
        <?php if(!$rows): ?><tr><td colspan="5" class="muted">No entries yet.</td></tr><?php endif; ?>
        <?php foreach ($rows as $r): ?>
          <tr>
            <td><?php echo e(fmt_date($r['date'])); ?></td>
            <td><?php echo (int)$r['bp_sys']; ?>/<?php echo (int)$r['bp_dia']; ?></td>
            <td><?php echo e($r['hemoglobin']); ?></td>
            <td><?php echo e($r['blood_sugar']); ?></td>
            <td><?php echo e($r['bmi']); ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card" style="text-align:center;">
    <div class="eyebrow">Current Risk Level</div>
    <?php if ($latestRisk): ?>
      <div class="risk-gauge-wrap">
        <?php echo risk_gauge_svg($latestRisk['score'], $latestRisk['level']); ?>
        <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($latestRisk['level']); ?>);"><?php echo (int)$latestRisk['score']; ?></div>
        <span class="badge <?php echo risk_badge_class($latestRisk['level']); ?>"><?php echo e($latestRisk['level']); ?> Risk</span>
        <div class="muted" style="font-size:12px;margin-top:4px;">Assessed <?php echo e(fmt_datetime($latestRisk['date'])); ?></div>
      </div>
      <a class="btn btn-outline btn-sm" href="analyze.php" style="margin-top:12px;">View Full Breakdown</a>
      <a class="btn btn-outline btn-sm" href="compare.php" style="margin-top:12px;margin-left:8px;">Compare with Previous</a>
    <?php else: ?>
      <div class="empty">
        <i class="fa-solid fa-diagram-project"></i>
        No risk assessment yet — log vitals above, then run a
        <div style="margin-top:10px;"><a class="btn btn-primary btn-sm" href="symptoms.php">Symptom Check-in</a></div>
      </div>
    <?php endif; ?>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">Risk Score Trend</h3>
    <canvas id="riskChart" height="180"></canvas>
    <div class="divider"></div>
    <h3 style="margin-top:0;">Risk History</h3>
    <div style="max-height:260px;overflow-y:auto;">
      <table>
        <thead><tr><th>Date</th><th>Level</th><th>Score</th></tr></thead>
        <tbody>
        <?php if(!$riskRows): ?><tr><td colspan="3" class="muted">No assessments logged yet.</td></tr><?php endif; ?>
        <?php foreach ($riskRows as $r): ?>
          <tr>
            <td><?php echo e(fmt_date($r['date'])); ?></td>
            <td><span class="badge <?php echo risk_badge_class($r['level']); ?>"><?php echo e($r['level']); ?></span></td>
            <td><?php echo (int)$r['score']; ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
const riskCtx = document.getElementById('riskChart');
new Chart(riskCtx, {
  type: 'line',
  data: {
    labels: <?php echo json_encode(array_map(fn($r)=>date('M j', strtotime($r['date'])), $riskChartRows)); ?>,
    datasets: [
      {
        label: 'Risk Score',
        data: <?php echo json_encode(array_map(fn($r)=>(int)$r['score'], $riskChartRows)); ?>,
        borderColor: '#E0574E',
        backgroundColor: 'rgba(224,87,78,0.08)',
        fill: true,
        tension: .3,
        pointBackgroundColor: <?php echo json_encode(array_map(function($r){
            if ($r['level']==='Severe') return '#E0574E';
            if ($r['level']==='High') return '#E3A62B';
            return '#4CAF7D';
        }, $riskChartRows)); ?>,
      }
    ]
  },
  options: {
    responsive: true,
    scales: { y: { min: 0, max: 100, ticks: { stepSize: 20 } } },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          afterLabel: function(ctx){
            const levels = <?php echo json_encode(array_map(fn($r)=>$r['level'], $riskChartRows)); ?>;
            return 'Level: ' + levels[ctx.dataIndex];
          }
        }
      }
    }
  }
});
</script>

<script>
const ctx = document.getElementById('bpChart');
new Chart(ctx, {
  type: 'line',
  data: {
    labels: <?php echo json_encode(array_map(fn($r)=>date('M j', strtotime($r['date'])), $chartRows)); ?>,
    datasets: [
      { label: 'Systolic', data: <?php echo json_encode(array_map(fn($r)=>(int)$r['bp_sys'], $chartRows)); ?>, borderColor: '#0E9C8F', tension: .3 },
      { label: 'Diastolic', data: <?php echo json_encode(array_map(fn($r)=>(int)$r['bp_dia'], $chartRows)); ?>, borderColor: '#3FA9DE', tension: .3 },
    ]
  },
  options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
});
</script>

<?php render_footer(); ?>