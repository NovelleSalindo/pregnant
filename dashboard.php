<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'toggle_taken') {
    $medId = $_POST['medication_id'] ?? '';
    if ($medId) {
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
    }
    redirect('dashboard.php');
}

// Fetch Coopland Assessment (definitive maternal risk classifier)
$stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latestCoopland = $stmt->fetch();

if (!$latestCoopland) {
    require_once __DIR__ . '/coopland_engine.php';
    $eval = evaluate_coopland($u['id'], $pdo, [], []);
    if ($eval) {
        $initId = 'ca-' . uniqid();
        $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, date, score, risk_level, factors_json) VALUES (?, ?, NOW(), ?, ?, ?)")
            ->execute([
                $initId,
                $u['id'],
                $eval['coopland_score'],
                $eval['coopland_risk'],
                json_encode($eval['contributing_factors'] ?? [])
            ]);
        $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
        $stmt->execute([$u['id']]);
        $latestCoopland = $stmt->fetch();
    }
}

// General assessment for visit resolution
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latest = $stmt->fetch();

$coopScore = $latestCoopland ? (int)$latestCoopland['score'] : 0;
$coopLevel = $latestCoopland ? ucfirst(strtolower($latestCoopland['risk_level'])) : 'Low';
$coopFactors = $latestCoopland ? json_decode($latestCoopland['factors_json'] ?? '[]', true) : [];

// Recommendations based on latest assessment or Coopland risk level
$topRecs = [];
if ($latest && !empty($latest['recommendations_json']) && $latest['recommendations_json'] !== '[]') {
    $rawRecs = json_decode($latest['recommendations_json'], true) ?: [];
    $parsedRecs = [];
    foreach ($rawRecs as $rec) {
        if (is_string($rec)) {
            $parsedRecs[] = ['text' => $rec, 'icon' => 'fa-circle-check', 'urgent' => false, 'category' => 'Daily Care'];
        } elseif (is_array($rec)) {
            $icon = $rec['icon'] ?? (!empty($rec['urgent']) ? 'fa-triangle-exclamation' : 'fa-circle-check');
            if (strpos($icon, 'fa-') !== 0) $icon = 'fa-' . $icon;
            $parsedRecs[] = [
                'text' => $rec['text'] ?? '',
                'icon' => $icon,
                'urgent' => !empty($rec['urgent']) || (($rec['category'] ?? '') === 'Urgent Action'),
                'category' => $rec['category'] ?? 'Daily Care'
            ];
        }
    }
    $topRecs = array_slice($parsedRecs, 0, 3);
}

if (empty($topRecs)) {
if ($coopLevel === 'Severe') {
    $topRecs[] = [
        'text' => 'Contact your OB-GYN or go to the nearest hospital now',
        'icon' => 'fa-triangle-exclamation',
        'urgent' => true,
        'category' => 'Urgent Action'
    ];
    $topRecs[] = [
        'text' => 'Do not wait for your next scheduled appointment',
        'icon' => 'fa-triangle-exclamation',
        'urgent' => true,
        'category' => 'Urgent Action'
    ];
    $topRecs[] = [
        'text' => 'High-risk tertiary hospital evaluation and continuous maternal-fetal monitoring required',
        'icon' => 'fa-hospital',
        'urgent' => false,
        'category' => 'Clinical Guidance'
    ];
} elseif ($coopLevel === 'High') {
    $topRecs[] = [
        'text' => 'Schedule an OB-GYN checkup within 24 to 48 hours',
        'icon' => 'fa-calendar-day',
        'urgent' => true,
        'category' => 'Priority Care'
    ];
    $topRecs[] = [
        'text' => 'More frequent prenatal checkups and specialized maternal-fetal assessments recommended',
        'icon' => 'fa-circle-check',
        'urgent' => false,
        'category' => 'Clinical Guidance'
    ];
    $topRecs[] = [
        'text' => 'Closely monitor blood pressure, blood glucose, and daily fetal kick counts',
        'icon' => 'fa-circle-check',
        'urgent' => false,
        'category' => 'Daily Monitoring'
    ];
} else {
    $topRecs[] = [
        'text' => 'Routine prenatal checkup schedule: monthly until 28 wks, every 2 wks until 36 wks, weekly after',
        'icon' => 'fa-circle-check',
        'urgent' => false,
        'category' => 'Routine Care'
    ];
    $topRecs[] = [
        'text' => 'Continue daily prenatal vitamins, iron, and folic acid supplements',
        'icon' => 'fa-circle-check',
        'urgent' => false,
        'category' => 'Daily Nutrition'
    ];
    $topRecs[] = [
        'text' => 'Drink plenty of water and rest when tired. Log daily vitals and symptoms',
        'icon' => 'fa-circle-check',
        'urgent' => false,
        'category' => 'Wellness'
    ];
}
}

$stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY date DESC LIMIT 5");
$stmt->execute([$u['id']]);
$notifications = $stmt->fetchAll();

$today = today_iso();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id=? AND date >= ?");
$stmt->execute([$u['id'], $today.' 00:00:00']);
$loggedVitalsToday = (int)$stmt->fetchColumn() > 0;
$stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id=? AND date >= ?");
$stmt->execute([$u['id'], $today.' 00:00:00']);
$loggedSymptomsToday = (int)$stmt->fetchColumn() > 0;

$stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$lastVitals = $stmt->fetch();

$clinicalVisits = get_clinical_visits_history($pdo, $u['id']);

$isSevere = ($coopLevel === 'Severe' || $coopLevel === 'High');
$isResolved = ($latest && ($latest['status'] ?? 'active') === 'resolved');
$canResolve = ($isSevere && !$isResolved);

$stmt = $pdo->prepare("SELECT lmp, edd, gravida, next_ob_visit FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch();

$weeksPregnant = null;
if ($profile && $profile['lmp']){
    $weeksPregnant = floor((time() - strtotime($profile['lmp'])) / (7*86400));
}
$trimester = $weeksPregnant !== null ? ($weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3)) : null;
$babySize = $weeksPregnant !== null ? baby_size_for_week($weeksPregnant) : null;
$daysToEdd = ($profile && $profile['edd']) ? (int)ceil((strtotime($profile['edd']) - time()) / 86400) : null;
$nextVisit = $profile['next_ob_visit'] ?? null;
$daysToVisit = $nextVisit ? (int)ceil((strtotime($nextVisit) - time()) / 86400) : null;

// Active medications/supplements and today's taken log
$stmt = $pdo->prepare("SELECT * FROM medications WHERE user_id = ? AND active = 1 ORDER BY name");
$stmt->execute([$u['id']]);
$dashboardMeds = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT medication_id FROM medication_logs WHERE user_id = ? AND date = ?");
$stmt->execute([$u['id'], $today]);
$dashboardTaken = $stmt->fetchAll(PDO::FETCH_COLUMN);

render_header('Dashboard', 'dashboard');
?>

<div class="hero-gradient" style="margin-bottom:20px;">
  <div class="eyebrow" style="color:rgba(255,255,255,.85);">Welcome back</div>
  <h1 style="margin:6px 0 4px;color:#fff;font-size:26px;"><?php echo e($u['name']); ?></h1>
  <div style="color:rgba(255,255,255,.9);font-size:14px;">
    <?php if ($weeksPregnant !== null): ?>
      You're about <strong><?php echo (int)$weeksPregnant; ?> weeks</strong> along — Trimester <?php echo $trimester; ?>. Expected due date: <?php echo e(fmt_date($profile['edd'])); ?>.
    <?php else: ?>
      Complete your profile to see your pregnancy timeline.
    <?php endif; ?>
  </div>
</div>

<?php if ($canResolve): ?>
<div class="card" style="margin-bottom:16px;border-left:5px solid var(--risk-high);background:#fff5f5;border-color:rgba(220,53,69,0.3);">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">
    <div style="display:flex;gap:14px;align-items:center;">
      <div style="width:46px;height:46px;border-radius:50%;background:rgba(220,53,69,0.15);display:flex;align-items:center;justify-content:center;color:var(--risk-high);font-size:22px;flex-shrink:0;">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div>
        <div style="font-weight:700;font-size:16px;color:#b02a37;">Severe Risk Alert Active</div>
        <div class="muted" style="font-size:13px;margin-top:2px;">
          Your assessment from <?php echo e(fmt_datetime($latest['date'])); ?> triggered clinical safety rules requiring medical attention. Have you already consulted an OB-GYN or visited a hospital?
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button type="button" class="btn btn-danger btn-sm" onclick="pcOpenVisitModal()">
        <i class="fa-solid fa-hospital-user"></i> I Already Visited Hospital / OB-GYN
      </button>
      <a class="btn btn-outline btn-sm" href="analyze.php">View Analysis</a>
    </div>
  </div>
</div>
<?php elseif ($isResolved): ?>
<div class="card" style="margin-bottom:16px;border-left:5px solid var(--teal);background:rgba(20,184,166,0.06);border-color:rgba(20,184,166,0.3);">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(20,184,166,0.18);display:flex;align-items:center;justify-content:center;color:var(--teal-dark);font-size:20px;flex-shrink:0;">
        <i class="fa-solid fa-clipboard-check"></i>
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--teal-dark);">Severe Risk Alert Attended &amp; Archived</div>
        <div class="muted" style="font-size:13px;margin-top:2px;">
          Your visit to <strong><?php echo e($latest['visited_facility'] ?: ($latest['doctor_name'] ?: 'Healthcare Provider')); ?></strong> on <?php echo e(fmt_date($latest['visit_date'])); ?> was recorded. Ready to check your recovery?
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <a class="btn btn-primary btn-sm" href="symptoms.php"><i class="fa-solid fa-plus"></i> New Symptom Check-in</a>
      <a class="btn btn-outline btn-sm" href="monitoring.php"><i class="fa-solid fa-heart-pulse"></i> Log Vitals</a>
    </div>
  </div>
</div>
<?php endif; ?>

<?php if (!$loggedVitalsToday || !$loggedSymptomsToday): ?>
<div class="card" id="dailyReminderBanner" style="margin-bottom:16px;border-color:var(--sky);background:var(--sky-light);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
  <div style="display:flex;align-items:center;gap:12px;">
    <i class="fa-solid fa-bell" style="font-size:22px;color:#1E6E96;"></i>
    <div>
      <strong>Daily check-in reminder</strong>
      <div class="muted" style="font-size:13px;">
        <?php if (!$loggedVitalsToday && !$loggedSymptomsToday): ?>
          You haven't logged your vitals or symptoms today.
        <?php elseif (!$loggedVitalsToday): ?>
          You haven't logged your vitals today.
        <?php else: ?>
          You haven't done your symptom check-in today.
        <?php endif; ?>
      </div>
    </div>
  </div>
  <div style="display:flex;gap:8px;">
    <?php if (!$loggedVitalsToday): ?><a class="btn btn-outline btn-sm" href="monitoring.php">Log Vitals</a><?php endif; ?>
    <?php if (!$loggedSymptomsToday): ?><a class="btn btn-primary btn-sm" href="symptoms.php">Check-in Now</a><?php endif; ?>
  </div>
</div>
<script>
  // Ask (once) if the patient wants browser notifications, then remind them once per day if they haven't logged anything yet.
  (function(){
    const missedToday = <?php echo (!$loggedVitalsToday || !$loggedSymptomsToday) ? 'true' : 'false'; ?>;
    if (!missedToday || !('Notification' in window)) return;

    function fireReminder(){
      new Notification('PregnaCare reminder', {
        body: "Don't forget today's vitals log or symptom check-in.",
        icon: 'icon-192.png'
      });
    }
    if (Notification.permission === 'granted'){
      const lastShown = localStorage.getItem('pregnacare_reminder_shown_date');
      const todayStr = new Date().toDateString();
      if (lastShown !== todayStr){
        fireReminder();
        localStorage.setItem('pregnacare_reminder_shown_date', todayStr);
      }
    } else if (Notification.permission !== 'denied' && !localStorage.getItem('pregnacare_reminder_asked')){
      localStorage.setItem('pregnacare_reminder_asked', '1');
      const askBtn = document.createElement('button');
      askBtn.className = 'btn btn-outline btn-sm';
      askBtn.style.marginLeft = '8px';
      askBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Enable Reminders';
      askBtn.onclick = function(){ Notification.requestPermission().then(() => askBtn.remove()); };
      document.getElementById('dailyReminderBanner').appendChild(askBtn);
    }
  })();
</script>
<?php endif; ?>

<?php if ($babySize || $daysToEdd !== null): ?>
<div class="card" style="margin-bottom:16px;">
  <div class="grid grid-2" style="align-items:center;gap:20px;">
    <div style="text-align:center;">
      <?php echo baby_silhouette_svg(90); ?>
      <div class="muted" style="font-size:11px;margin-top:4px;">Illustrative only</div>
    </div>
    <div style="text-align:center;">
      <div class="eyebrow">Countdown to Due Date</div>
      <?php if ($daysToEdd !== null && $daysToEdd > 0): ?>
        <div style="font-family:var(--font-display);font-size:38px;font-weight:700;color:var(--teal-dark);"><?php echo $daysToEdd; ?></div>
        <div class="muted" style="font-size:12.5px;">days to go &bull; Week <?php echo (int)$weeksPregnant; ?> of 40</div>
      <?php elseif ($daysToEdd !== null): ?>
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--teal-dark);">Any day now! 🎉</div>
      <?php else: ?>
        <div class="muted" style="font-size:13px;">Add your LMP in Profile to see this.</div>
      <?php endif; ?>
    </div>
  </div>
</div>
<?php endif; ?>

<div class="grid grid-3" style="align-items:stretch;">
  <div class="card" style="grid-column:span 1;text-align:center;">
    <div class="eyebrow" style="letter-spacing:0.8px;font-weight:800;color:var(--ink-soft);margin-bottom:8px;">CURRENT COOPLAND</div>
    <?php if ($latestCoopland): ?>
      <div class="risk-gauge-wrap">
        <?php echo risk_gauge_svg($coopScore, $coopLevel); ?>
        <span class="badge <?php echo risk_badge_class($coopLevel); ?>" style="margin-top:6px;"><?php echo e($coopLevel); ?> Risk</span>
        <div class="muted" style="font-size:12px;margin-top:4px;"><?php echo e(fmt_date($latestCoopland['date'])); ?></div>
        <div style="font-weight:800;font-size:14px;color:var(--primary);margin-top:4px;">
          Score: <?php echo $coopScore; ?>
        </div>
      </div>
      <?php if (!empty($coopFactors)): ?>
        <div style="margin-top:10px;text-align:left;">
          <div style="font-size:11px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-bottom:4px;text-align:center;">Active Contributing Factors:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;">
            <?php foreach (array_slice($coopFactors, 0, 3) as $factor): ?>
              <span class="badge" style="font-size:10.5px;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;"><?php echo e($factor); ?></span>
            <?php endforeach; ?>
            <?php if (count($coopFactors) > 3): ?>
              <span class="badge" style="font-size:10.5px;background:#e2e8f0;color:#0f172a;">+<?php echo count($coopFactors) - 3; ?> more</span>
            <?php endif; ?>
          </div>
        </div>
      <?php endif; ?>
      <?php if ($isResolved): ?>
        <div style="margin-top:8px;">
          <span class="badge" style="background:#e6fffa;color:#0d9488;border:1px solid #99f6e4;font-size:11px;">
            <i class="fa-solid fa-check"></i> Attended by Doctor
          </span>
        </div>
        <a class="btn btn-primary btn-sm btn-block" href="symptoms.php" style="margin-top:10px;">
          <i class="fa-solid fa-arrows-rotate"></i> Update Risk Assessment
        </a>
      <?php elseif ($canResolve): ?>
        <div style="margin-top:10px;">
          <button type="button" class="btn btn-danger btn-sm btn-block" onclick="pcOpenVisitModal()">
            <i class="fa-solid fa-hospital-user"></i> Visited Hospital / OB-GYN?
          </button>
        </div>
      <?php endif; ?>
      <a class="btn btn-outline btn-sm btn-block" href="analyze.php" style="margin-top:8px;">View Factor Analysis</a>
    <?php else: ?>
      <div class="empty">
        <i class="fa-solid fa-notes-medical"></i>
        No risk assessment yet.
        <div style="margin-top:10px;"><a class="btn btn-primary btn-sm" href="symptoms.php">Start Risk Assessment</a></div>
      </div>
    <?php endif; ?>
  </div>

  <div class="card">
    <div class="eyebrow">Latest Vitals</div>
    <?php if ($lastVitals): ?>
      <div class="kv"><span class="k">Blood Pressure</span><span class="v"><?php echo (int)$lastVitals['bp_sys']; ?>/<?php echo (int)$lastVitals['bp_dia']; ?> mmHg</span></div>
      <div class="kv"><span class="k">Hemoglobin</span><span class="v"><?php echo e($lastVitals['hemoglobin']); ?> g/dL</span></div>
      <div class="kv"><span class="k">Blood Sugar</span><span class="v"><?php echo e($lastVitals['blood_sugar']); ?> mg/dL</span></div>
      <div class="kv"><span class="k">Weight</span><span class="v"><?php echo e($lastVitals['weight_kg']); ?> kg</span></div>
      <div class="kv"><span class="k">Logged</span><span class="v"><?php echo e(fmt_date($lastVitals['date'])); ?></span></div>
    <?php else: ?>
      <div class="empty"><i class="fa-solid fa-heart-pulse"></i>No vitals logged yet.</div>
    <?php endif; ?>
    <a class="btn btn-outline btn-block btn-sm" style="margin-top:10px;" href="monitoring.php"><i class="fa-solid fa-plus"></i> Log Vitals</a>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <div class="eyebrow" style="margin:0;">Reminders</div>
      <?php if (!empty($dashboardMeds) || $nextVisit): ?>
        <a href="reminders.php" style="font-size:12px;font-weight:700;color:var(--primary, #C2577D);text-decoration:none;">
          Manage <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>
        </a>
      <?php endif; ?>
    </div>

    <?php if ($nextVisit && $daysToVisit !== null): ?>
      <div style="background:var(--bg-soft, #FFF5F8);border-radius:10px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;border:1px solid #F8D7E3;">
        <div style="display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-calendar-check" style="color:var(--primary, #C2577D);font-size:16px;"></i>
          <div>
            <div style="font-weight:700;font-size:12px;color:var(--text);">Next OB-GYN Visit</div>
            <div class="muted" style="font-size:11px;"><?php echo e(fmt_date($nextVisit)); ?></div>
          </div>
        </div>
        <span class="badge" style="background:#C2577D;color:#FFF;font-weight:800;font-size:11px;padding:3px 8px;border-radius:8px;">
          <?php echo $daysToVisit === 0 ? "Today!" : ($daysToVisit > 0 ? "{$daysToVisit}d left" : "Passed"); ?>
        </span>
      </div>
    <?php endif; ?>

    <?php if (!empty($dashboardMeds)): ?>
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
        <span><i class="fa-solid fa-pills" style="color:#C2577D;margin-right:5px;"></i>Today's Checklist</span>
        <span class="muted" style="font-size:11.5px;font-weight:600;">
          <?php
            $takenCount = count(array_intersect(array_column($dashboardMeds, 'id'), $dashboardTaken));
            echo "{$takenCount} / " . count($dashboardMeds) . " taken";
          ?>
        </span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;max-height:160px;overflow-y:auto;">
        <?php foreach ($dashboardMeds as $m): $isTaken = in_array($m['id'], $dashboardTaken); ?>
          <form method="post" action="dashboard.php" style="margin:0;">
            <input type="hidden" name="action" value="toggle_taken">
            <input type="hidden" name="medication_id" value="<?php echo e($m['id']); ?>">
            <button type="submit" class="chip <?php echo $isTaken ? 'on' : ''; ?>" style="width:100%;justify-content:flex-start;display:flex;cursor:pointer;border:1.5px solid <?php echo $isTaken ? '#C2577D' : 'var(--border)'; ?>;padding:7px 10px;font-size:12.5px;text-align:left;border-radius:10px;background:<?php echo $isTaken ? '#FFF5F8' : '#FFF'; ?>;box-shadow:none;">
              <i class="fa-solid <?php echo $isTaken ? 'fa-circle-check' : 'fa-circle'; ?>" style="margin-right:8px;font-size:14px;color:<?php echo $isTaken ? '#C2577D' : 'var(--muted)'; ?>;"></i>
              <span style="font-weight:<?php echo $isTaken ? '700' : '600'; ?>;color:<?php echo $isTaken ? '#9B2C52' : 'var(--text)'; ?>;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">
                <?php echo e($m['name']); ?>
              </span>
              <?php if (!empty($m['dosage'])): ?>
                <span class="muted" style="font-size:11px;margin-left:4px;white-space:nowrap;">— <?php echo e($m['dosage']); ?></span>
              <?php endif; ?>
            </button>
          </form>
        <?php endforeach; ?>
      </div>
      <a class="btn btn-outline btn-block btn-sm" href="reminders.php"><i class="fa-solid fa-bell"></i> Open Reminders</a>
    <?php else: ?>
      <p class="muted" style="font-size:13px;margin-top:6px;">Track your next OB-GYN visit and mark off today's supplements/vitamins.</p>
      <a class="btn btn-primary btn-block btn-sm" href="reminders.php"><i class="fa-solid fa-bell"></i> Open Reminders</a>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Top Recommendations</div>
  <?php if ($topRecs): foreach ($topRecs as $r): ?>
    <div class="kv"><span class="k"><i class="fa-solid <?php echo e(is_array($r) ? ($r['icon'] ?? 'fa-circle-check') : 'fa-circle-check'); ?>" style="margin-right:8px;color:<?php echo (is_array($r) && !empty($r['urgent'])) ? 'var(--risk-high)' : 'var(--teal)'; ?>;"></i><?php echo e(is_array($r) ? ($r['text'] ?? '') : $r); ?></span></div>
  <?php endforeach; else: ?>
    <div class="empty"><i class="fa-solid fa-lightbulb"></i>Complete a symptom check-in to get recommendations.</div>
  <?php endif; ?>
  <a class="btn btn-outline btn-sm" style="margin-top:10px;" href="recommendations.php"><i class="fa-solid fa-list-check"></i> View All Recommendations</a>
</div>

<div class="card" style="margin-top:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div class="eyebrow"><i class="fa-solid fa-bell" style="margin-right:6px;color:var(--teal);"></i>Recent Notifications</div>
    <a href="notifications.php" class="btn btn-outline btn-sm" style="padding:2px 8px;font-size:12px;"><i class="fa-solid fa-list"></i> View All</a>
  </div>
  <?php if ($notifications): foreach (array_slice($notifications, 0, 4) as $n): 
    $kind = $n['kind'] ?? '';
    $title = $n['title'] ?? '';
    $isSevere = ($kind === 'severe_risk_alert' || $kind === 'emergency' || stripos($title, 'Severe') !== false);
    $isHigh = !$isSevere && ($kind === 'high_risk_alert' || stripos($title, 'High') !== false);
    $iconColor = $isSevere ? '#DC2626' : ($isHigh ? '#D97706' : 'var(--teal)');
    $icon = ($isSevere || $isHigh) ? 'fa-triangle-exclamation' : 'fa-bell';
  ?>
    <div class="kv" style="<?php echo ($isSevere ? 'background:#FEE2E2;border-left:3px solid #DC2626;border-radius:6px;padding:6px 10px;margin-bottom:6px;' : ($isHigh ? 'background:#FEF3C7;border-left:3px solid #D97706;border-radius:6px;padding:6px 10px;margin-bottom:6px;' : '')); ?>">
      <span class="k">
        <i class="fa-solid <?php echo $icon; ?>" style="margin-right:6px;color:<?php echo $iconColor; ?>;"></i>
        <strong style="color:<?php echo ($isSevere ? '#DC2626' : ($isHigh ? '#B45309' : 'inherit')); ?>;"><?php echo e($n['title']); ?></strong> — <span class="muted"><?php echo e($n['body']); ?></span>
      </span>
      <span class="v muted" style="font-weight:600;font-size:12px;"><?php echo e(fmt_date($n['date'])); ?></span>
    </div>
  <?php endforeach; else: ?>
    <div class="empty"><i class="fa-solid fa-bell-slash"></i>No notifications yet.</div>
  <?php endif; ?>
</div>

<?php if (!empty($clinicalVisits)): ?>
<div class="card" style="margin-top:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div class="eyebrow"><i class="fa-solid fa-hospital-user" style="color:var(--teal);margin-right:6px;"></i>Archived Clinical Consultations</div>
    <span class="badge badge-outline"><?php echo count($clinicalVisits); ?> Recorded</span>
  </div>
  <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
    <?php foreach (array_slice($clinicalVisits, 0, 3) as $cv): ?>
      <div style="background:var(--bg-soft);border-radius:10px;padding:12px 14px;border:1px solid var(--border);font-size:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong><i class="fa-solid fa-hospital" style="color:var(--teal);margin-right:6px;"></i><?php echo e($cv['facility'] ?: 'Hospital / OB-GYN Clinic'); ?></strong>
          <span class="muted" style="font-size:11.5px;"><?php echo e(fmt_date($cv['visit_date'])); ?></span>
        </div>
        <?php if (!empty($cv['doctor_name'])): ?>
          <div class="muted" style="font-size:12px;margin-top:2px;">Attending: <strong><?php echo e($cv['doctor_name']); ?></strong></div>
        <?php endif; ?>
        <?php if (!empty($cv['notes'])): ?>
          <div style="font-size:12.5px;margin-top:5px;color:var(--ink-soft);font-style:italic;">
            "<?php echo e($cv['notes']); ?>"
          </div>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  </div>
  <a class="btn btn-outline btn-sm" style="margin-top:10px;" href="analyze.php#archivedVisits">
    <i class="fa-solid fa-clock-rotate-left"></i> View All in Risk Analysis
  </a>
</div>
<?php endif; ?>

<?php 
if ($canResolve && $latest) {
    render_clinical_visit_modal($latest['id'], 'dashboard');
}
?>

<?php render_footer(); ?>