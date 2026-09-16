<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latest = $stmt->fetch();

$stmt = $pdo->prepare("SELECT recommendations_json FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$recsJson = $stmt->fetchColumn();
$topRecs = $recsJson ? array_slice(json_decode($recsJson, true), 0, 3) : [];

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

$stmt = $pdo->prepare("SELECT lmp, edd, gravida FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch();

$weeksPregnant = null;
if ($profile && $profile['lmp']){
    $weeksPregnant = floor((time() - strtotime($profile['lmp'])) / (7*86400));
}
$trimester = $weeksPregnant !== null ? ($weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3)) : null;
$babySize = $weeksPregnant !== null ? baby_size_for_week($weeksPregnant) : null;
$daysToEdd = ($profile && $profile['edd']) ? (int)ceil((strtotime($profile['edd']) - time()) / 86400) : null;

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

<?php if ($babySize): ?>
<div class="card" style="margin-bottom:16px;">
  <div class="grid grid-3" style="align-items:center;gap:20px;">
    <div style="text-align:center;">
      <?php echo baby_silhouette_svg(90); ?>
      <div class="muted" style="font-size:11px;margin-top:4px;">Illustrative only</div>
    </div>
    <div style="text-align:center;">
      <div class="eyebrow">Baby's Size This Week</div>
      <div style="font-size:40px;line-height:1.1;margin:4px 0;"><?php echo $babySize[1]; ?></div>
      <div style="font-weight:700;font-size:16px;">About the size of a <?php echo e($babySize[0]); ?></div>
      <div class="muted" style="font-size:12.5px;">Week <?php echo (int)$weeksPregnant; ?> of 40</div>
    </div>
    <div style="text-align:center;">
      <div class="eyebrow">Countdown to Due Date</div>
      <?php if ($daysToEdd !== null && $daysToEdd > 0): ?>
        <div style="font-family:var(--font-display);font-size:38px;font-weight:700;color:var(--teal-dark);"><?php echo $daysToEdd; ?></div>
        <div class="muted" style="font-size:12.5px;">days to go</div>
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
    <div class="eyebrow">Current Risk Level</div>
    <?php if ($latest): ?>
      <div class="risk-gauge-wrap">
        <?php echo risk_gauge_svg($latest['score'], $latest['level']); ?>
        <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($latest['level']); ?>);"><?php echo (int)$latest['score']; ?></div>
        <span class="badge <?php echo risk_badge_class($latest['level']); ?>"><?php echo e($latest['level']); ?> Risk</span>
        <div class="muted" style="font-size:12px;margin-top:4px;">Assessed <?php echo e(fmt_datetime($latest['date'])); ?></div>
      </div>
      <a class="btn btn-outline btn-sm" href="analyze.php" style="margin-top:12px;">View Full Breakdown</a>
    <?php else: ?>
      <div class="empty">
        <i class="fa-solid fa-notes-medical"></i>
        No assessment yet.
        <div style="margin-top:10px;"><a class="btn btn-primary btn-sm" href="symptoms.php">Start Symptom Check-in</a></div>
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
    <div class="eyebrow">Reminders</div>
    <p class="muted" style="font-size:13px;margin-top:6px;">Track your next OB-GYN visit and mark off today's supplements/vitamins.</p>
    <a class="btn btn-primary btn-block btn-sm" href="reminders.php"><i class="fa-solid fa-bell"></i> Open Reminders</a>
  </div>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Top Recommendations</div>
  <?php if ($topRecs): foreach ($topRecs as $r): ?>
    <div class="kv"><span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:<?php echo !empty($r['urgent']) ? 'var(--risk-high)' : 'var(--teal)'; ?>;"></i><?php echo e($r['text']); ?></span></div>
  <?php endforeach; else: ?>
    <div class="empty"><i class="fa-solid fa-lightbulb"></i>Complete a symptom check-in to get recommendations.</div>
  <?php endif; ?>
  <a class="btn btn-outline btn-sm" style="margin-top:10px;" href="recommendations.php"><i class="fa-solid fa-list-check"></i> View All Recommendations</a>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Recent Notifications</div>
  <?php if ($notifications): foreach ($notifications as $n): ?>
    <div class="kv">
      <span class="k"><i class="fa-solid fa-bell" style="margin-right:6px;color:var(--teal);"></i><?php echo e($n['title']); ?> — <span class="muted"><?php echo e($n['body']); ?></span></span>
      <span class="v muted" style="font-weight:600;"><?php echo e(fmt_date($n['date'])); ?></span>
    </div>
  <?php endforeach; else: ?>
    <div class="empty"><i class="fa-solid fa-bell-slash"></i>No notifications yet.</div>
  <?php endif; ?>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Wellness Tools</div>
  <div class="grid grid-4" style="margin-top:10px;">
    <a class="btn btn-outline btn-block btn-sm" href="medications.php"><i class="fa-solid fa-pills"></i> Medications</a>
    <a class="btn btn-outline btn-block btn-sm" href="weight_tracker.php"><i class="fa-solid fa-weight-scale"></i> Weight Gain</a>
    <a class="btn btn-outline btn-block btn-sm" href="journal.php"><i class="fa-solid fa-book"></i> Journal</a>
    <a class="btn btn-outline btn-block btn-sm" href="bump_photos.php"><i class="fa-solid fa-camera"></i> Bump Photos</a>
  </div>
</div>

<?php render_footer(); ?>