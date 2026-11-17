<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'toggle_taken') {
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

$actPregId = get_active_pregnancy_id($pdo, $u['id']);
$hasActivePregnancy = !empty($actPregId);

// Fetch Coopland Assessment (definitive maternal risk classifier)
$latestCoopland = null;
$latest = null;
$coopScore = 0;
$coopLevel = 'Low';
$coopFactors = [];

if ($hasActivePregnancy) {
    $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC, id DESC LIMIT 1");
    $stmt->execute([$u['id'], $actPregId]);
    $latestCoopland = $stmt->fetch();

    if (!$latestCoopland) {
        require_once __DIR__ . '/coopland_engine.php';
        $eval = evaluate_coopland($u['id'], $pdo, [], []);
        if ($eval) {
            $initId = 'ca-' . uniqid();
            $pdo->prepare("INSERT INTO coopland_assessments (id, user_id, pregnancy_id, date, score, risk_level, factors_json) VALUES (?, ?, ?, NOW(), ?, ?, ?)")
                ->execute([
                    $initId,
                    $u['id'],
                    $actPregId,
                    $eval['coopland_score'],
                    $eval['coopland_risk'],
                    json_encode($eval['contributing_factors'] ?? [])
                ]);
            $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC, id DESC LIMIT 1");
            $stmt->execute([$u['id'], $actPregId]);
            $latestCoopland = $stmt->fetch();
        }
    }

    // General assessment for visit resolution
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id'], $actPregId]);
    $latest = $stmt->fetch();

    $coopScore = $latestCoopland ? (int)$latestCoopland['score'] : 0;
    $coopLevel = $latestCoopland ? ucfirst(strtolower($latestCoopland['risk_level'])) : 'Low';
    $coopFactors = $latestCoopland ? json_decode($latestCoopland['factors_json'] ?? '[]', true) : [];
}

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
if ($actPregId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id=? AND pregnancy_id=? AND date >= ?");
    $stmt->execute([$u['id'], $actPregId, $today.' 00:00:00']);
} else {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM monitoring WHERE user_id=? AND date >= ?");
    $stmt->execute([$u['id'], $today.' 00:00:00']);
}
$loggedVitalsToday = (int)$stmt->fetchColumn() > 0;

if ($actPregId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id=? AND pregnancy_id=? AND date >= ?");
    $stmt->execute([$u['id'], $actPregId, $today.' 00:00:00']);
} else {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM symptom_logs WHERE user_id=? AND date >= ?");
    $stmt->execute([$u['id'], $today.' 00:00:00']);
}
$loggedSymptomsToday = (int)$stmt->fetchColumn() > 0;

if ($actPregId) {
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id'], $actPregId]);
} else {
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$u['id']]);
}
$lastVitals = $stmt->fetch();

$clinicalVisits = get_clinical_visits_history($pdo, $u['id']);

$isSevere = ($coopLevel === 'Severe' || $coopLevel === 'High');
$isResolved = ($latest && ($latest['status'] ?? 'active') === 'resolved');
$canResolve = ($isSevere && !$isResolved);

$stmt = $pdo->prepare("SELECT lmp, edd, gravida, next_ob_visit FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$profile = $stmt->fetch();

$actPreg = null;
if ($actPregId) {
    $stmt = $pdo->prepare("SELECT * FROM pregnancies WHERE id = ? AND user_id = ?");
    $stmt->execute([$actPregId, $u['id']]);
    $actPreg = $stmt->fetch();
}

$hasActivePregnancy = !empty($actPreg);
$lmp = ($actPreg && !empty($actPreg['lmp'])) ? $actPreg['lmp'] : null;
$edd = ($actPreg && !empty($actPreg['edd'])) ? $actPreg['edd'] : null;

$weeksPregnant = null;
if ($hasActivePregnancy && $lmp){
    $weeksPregnant = floor((time() - strtotime($lmp)) / (7*86400));
} elseif ($hasActivePregnancy && $edd) {
    $daysToEdd = (int)ceil((strtotime($edd) - time()) / 86400);
    $daysPregnant = max(0, 280 - $daysToEdd);
    $weeksPregnant = (int)floor($daysPregnant / 7);
}
$trimester = $weeksPregnant !== null ? ($weeksPregnant < 14 ? 1 : ($weeksPregnant < 28 ? 2 : 3)) : null;
$babySize = $weeksPregnant !== null ? baby_size_for_week($weeksPregnant) : null;
$daysToEdd = ($hasActivePregnancy && $edd) ? (int)ceil((strtotime($edd) - time()) / 86400) : null;
$upcomingVisit = null;
try {
    if ($actPregId) {
        $stmtVisit = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND pregnancy_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
        $stmtVisit->execute([$u['id'], $actPregId]);
        $upcomingVisit = $stmtVisit->fetch(PDO::FETCH_ASSOC);
    } else {
        $stmtVisit = $pdo->prepare("SELECT * FROM ob_visits WHERE user_id = ? AND visit_date >= CURDATE() ORDER BY visit_date ASC LIMIT 1");
        $stmtVisit->execute([$u['id']]);
        $upcomingVisit = $stmtVisit->fetch(PDO::FETCH_ASSOC);
    }
} catch (Exception $e) {}

$nextVisit = $upcomingVisit ? $upcomingVisit['visit_date'] : ($actPregId ? null : ($profile['next_ob_visit'] ?? null));
$nextVisitTitle = $upcomingVisit['title'] ?? 'Next OB-GYN Visit';
$daysToVisit = $nextVisit ? (int)ceil((strtotime($nextVisit) - strtotime(today_iso())) / 86400) : null;

// Active medications/supplements and today's taken log
$stmt = $pdo->prepare("SELECT * FROM medications WHERE user_id = ? AND active = 1 ORDER BY name");
$stmt->execute([$u['id']]);
$dashboardMeds = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT medication_id FROM medication_logs WHERE user_id = ? AND date = ?");
$stmt->execute([$u['id'], $today]);
$dashboardTaken = $stmt->fetchAll(PDO::FETCH_COLUMN);

require_once __DIR__ . '/milestones_data.php';

$currentWeek = $weeksPregnant !== null ? (int)$weeksPregnant : 32;
$currentMonth = get_pregnancy_month($currentWeek);
$weekMilestone = get_week_milestone_details($currentWeek);
$currMonthData = PREGNANCY_MONTH_DATA[$currentMonth] ?? PREGNANCY_MONTH_DATA[8];

render_header('Dashboard', 'dashboard');
?>

<h1 class="page-title-display">Dashboard</h1>

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

<?php if ($hasActivePregnancy && (!$loggedVitalsToday || !$loggedSymptomsToday)): ?>
<div class="daily-reminder-banner" id="dailyReminderBanner">
  <div class="daily-reminder-top">
    <div class="daily-reminder-bell-wrap">
      <i class="fa-solid fa-bell"></i>
    </div>
    <div class="daily-reminder-info">
      <div class="daily-reminder-title">Daily check-in reminder</div>
      <div class="daily-reminder-sub">
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
  <div class="daily-reminder-btn-row">
    <?php if (!$loggedVitalsToday): ?>
      <a class="btn-daily-vitals" href="monitoring.php">Log Vitals</a>
    <?php endif; ?>
    <?php if (!$loggedSymptomsToday): ?>
      <a class="btn-daily-checkin" href="symptoms.php">Check-in Now</a>
    <?php endif; ?>
  </div>
</div>
<script>
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
    }
  })();
</script>
<?php endif; ?>

<?php if ($hasActivePregnancy): ?>
<div class="card" style="margin-bottom:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div class="eyebrow" style="margin:0;">Reminders</div>
    <?php if (!empty($dashboardMeds) || $nextVisit): ?>
      <a href="reminders.php" style="font-size:12px;font-weight:700;color:var(--primary, #C2577D);text-decoration:none;">
        Manage <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>
      </a>
    <?php endif; ?>
  </div>

  <?php if ($nextVisit && $daysToVisit !== null): ?>
    <div style="background:var(--bg-soft, #FFF5F8);border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;border:1px solid #F8D7E3;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:50%;background:#FCE7F0;display:flex;align-items:center;justify-content:center;color:#C2577D;font-size:15px;">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:13px;color:var(--text);"><?php echo e($nextVisitTitle); ?></div>
          <div class="muted" style="font-size:11.5px;"><?php echo e(fmt_date($nextVisit)); ?></div>
        </div>
      </div>
      <span class="badge" style="background:#C2577D;color:#FFF;font-weight:800;font-size:11.5px;padding:4px 9px;border-radius:8px;">
        <?php echo $daysToVisit === 0 ? "Today!" : ($daysToVisit === 1 ? "Tomorrow" : ($daysToVisit > 0 ? "{$daysToVisit}d left" : "Passed")); ?>
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
  <?php elseif (!$nextVisit): ?>
    <p class="muted" style="font-size:13px;margin-top:6px;margin-bottom:8px;">Track your next OB-GYN visit and mark off today's supplements/vitamins.</p>
  <?php endif; ?>
  <a class="btn btn-outline btn-block btn-sm" href="reminders.php" style="margin-top:4px;"><i class="fa-solid fa-bell"></i> Open Reminders</a>
</div>
<?php endif; ?>

<?php if (!$hasActivePregnancy): ?>
<div class="card" style="margin-bottom:20px;text-align:center;padding:36px 20px;background:linear-gradient(135deg, #fff5f8 0%, #ffffff 100%);border:1px solid #fbcfe8;border-radius:20px;box-shadow:0 4px 16px rgba(194,87,125,0.08);">
  <div style="width:68px;height:68px;border-radius:50%;background:#fce7f3;color:#b04a6e;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:30px;box-shadow:0 2px 8px rgba(194,87,125,0.15);">
    <i class="fa-solid fa-heart-pulse"></i>
  </div>
  <h2 style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 8px;">Start Your Pregnancy Journey</h2>
  <p style="font-size:14px;color:#64748b;max-width:480px;margin:0 auto 20px;line-height:1.5;">
    You haven't added an active pregnancy yet. Add your estimated due date to unlock week-by-week baby development, fruit size comparisons, and daily vitals monitoring.
  </p>
  <a href="profile.php" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;font-weight:700;box-shadow:0 4px 12px rgba(194,87,125,0.25);">
    <i class="fa-solid fa-plus-circle"></i> Add Pregnancy
  </a>
</div>
<?php else: ?>
<div class="fetal-card-display">
  <!-- 1. Circular Fetal Photo with month badge -->
  <div class="fetal-circle-container" onclick="pcOpenFetalMonthModal()" title="View 9-month development chart">
    <div class="fetal-circle-outer">
      <img src="assets/baby_months/month_<?php echo $currentMonth; ?>.png" alt="Month <?php echo $currentMonth; ?>" class="fetal-photo">
      <div class="fetal-mo-badge">Mo <?php echo $currentMonth; ?></div>
    </div>
  </div>

  <!-- 2. Month Link with sparkles -->
  <div>
    <button type="button" class="fetal-month-button" onclick="pcOpenFetalMonthModal()">
      <i class="fa-solid fa-wand-magic-sparkles" style="color:#b04a6e;font-size:12px;"></i>
      <span>Month <?php echo $currentMonth; ?> of 9 &bull; Illustrative Fetal Size</span>
      <i class="fa-solid fa-chevron-right" style="color:#b04a6e;font-size:11px;"></i>
    </button>
  </div>

  <!-- 3. See Week Development & Tips Pill Button -->
  <div style="margin: 8px 0 20px;">
    <button type="button" class="fetal-tips-pill" onclick="pcOpenWeekTipsModal()">
      <i class="fa-solid fa-wand-magic-sparkles" style="font-size:13px;"></i>
      <span>See Week <?php echo $currentWeek; ?> Development &amp; Tips</span>
      <i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>
    </button>
  </div>

  <!-- 4. Countdown to due date -->
  <div class="fetal-countdown-block">
    <div class="countdown-label">COUNTDOWN TO DUE DATE</div>
    <?php if ($daysToEdd !== null && $daysToEdd > 0): ?>
      <div class="countdown-big-num"><?php echo $daysToEdd; ?></div>
      <div class="countdown-sub">days to go &bull; Week <?php echo $currentWeek; ?> of 40</div>
    <?php elseif ($daysToEdd !== null): ?>
      <div class="countdown-big-num" style="font-size:36px;">Any day now! 🎉</div>
      <div class="countdown-sub">Week <?php echo $currentWeek; ?> of 40</div>
    <?php else: ?>
      <div class="countdown-sub"><a href="profile.php" style="color:#b04a6e;text-decoration:underline;">Add your LMP in Profile</a> to view countdown.</div>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>

<?php if ($hasActivePregnancy): ?>
<div class="grid grid-3" style="align-items:stretch;">
  <div class="card" style="grid-column:span 1;text-align:center;border-radius:24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:<?php echo $coopLevel==='Severe'?'var(--risk-high)':($coopLevel==='High'?'#ea580c':($coopLevel==='Moderate'?'#d97706':'#0d9488')); ?>;text-transform:uppercase;">
        CURRENT COOPLAND RISK &bull; <?php echo strtoupper($coopLevel); ?>
      </div>
      <a href="analyze.php" style="font-size:12px;font-weight:700;color:#64748b;display:inline-flex;align-items:center;gap:4px;">
        Assess Risk <i class="fa-solid fa-chevron-right" style="font-size:10px;"></i>
      </a>
    </div>
    <?php if ($latestCoopland): ?>
      <div class="risk-gauge-wrap">
        <?php echo risk_gauge_svg($coopScore, $coopLevel); ?>
        <span class="badge <?php echo risk_badge_class($coopLevel); ?>" style="margin-top:6px;"><?php echo e($coopLevel); ?> Risk</span>
        <div class="muted" style="font-size:12px;margin-top:4px;"><?php echo e(fmt_datetime($latestCoopland['date'])); ?></div>
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
</div>

<div class="card" style="margin-top:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div class="eyebrow" style="margin:0;">Top Clinical Recommendations</div>
      <div class="muted" style="font-size:12px;margin-top:2px;">Personalized guidance &amp; clinical advice</div>
    </div>
    <button type="button" class="btn btn-outline btn-sm" onclick="pcOpenRecsModal()" style="padding:6px 14px;font-size:12px;font-weight:700;">
      <i class="fa-solid fa-clipboard-list" style="margin-right:5px;"></i> View Result
    </button>
  </div>
</div>
<?php endif; ?>

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

<!-- Modal: See Week Development & Tips -->
<div class="ed-modal-backdrop" id="weekTipsModalBackdrop" style="display:none;" onclick="if(event.target===this) pcCloseWeekTipsModal()">
  <div class="ed-modal" style="max-width:480px;border-radius:24px;padding:24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:28px;"><?php echo $weekMilestone['emoji']; ?></span>
        <div>
          <div style="font-family:var(--font-display,'Fraunces',serif);font-size:20px;font-weight:700;color:#1e293b;">Week <?php echo $currentWeek; ?>: <?php echo e($weekMilestone['sizeName']); ?></div>
          <div style="font-size:12px;color:#64748b;">Length: <strong><?php echo e($weekMilestone['lengthApprox']); ?></strong> &bull; Weight: <strong><?php echo e($weekMilestone['weightApprox']); ?></strong></div>
        </div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseWeekTipsModal()" style="border:none;background:#f1f5f9;width:34px;height:34px;border-radius:50%;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;max-height:70vh;overflow-y:auto;padding-right:4px;">
      <div style="background:#fdf2f4;border:1px solid #fce7f0;border-radius:16px;padding:14px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#b04a6e;text-transform:uppercase;margin-bottom:6px;"><i class="fa-solid fa-baby"></i> Baby's Development</div>
        <div style="font-size:13.5px;color:#334155;line-height:1.45;"><?php echo e($weekMilestone['babyDevelopment']); ?></div>
      </div>

      <div style="background:#f0f9ff;border:1px solid #e0f2fe;border-radius:16px;padding:14px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#0284c7;text-transform:uppercase;margin-bottom:6px;"><i class="fa-solid fa-person-pregnant"></i> Mom's Common Symptoms</div>
        <div style="font-size:13.5px;color:#334155;line-height:1.45;"><?php echo e($weekMilestone['momSymptoms']); ?></div>
      </div>

      <div style="background:#fefce8;border:1px solid #fef08a;border-radius:16px;padding:14px;">
        <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#ca8a04;text-transform:uppercase;margin-bottom:6px;"><i class="fa-solid fa-lightbulb"></i> Clinical Care Tip</div>
        <div style="font-size:13.5px;color:#334155;line-height:1.45;"><?php echo e($weekMilestone['weeklyTip']); ?></div>
      </div>
    </div>

    <button type="button" class="btn btn-block" style="margin-top:18px;background:#b04a6e;color:#fff;border-radius:14px;padding:11px;" onclick="pcCloseWeekTipsModal()">Got it ✨</button>
  </div>
</div>

<!-- Modal: 9-Month Fetal Development Chart -->
<div class="ed-modal-backdrop" id="fetalMonthModalBackdrop" style="display:none;" onclick="if(event.target===this) pcCloseFetalMonthModal()">
  <div class="ed-modal" style="max-width:540px;border-radius:24px;padding:24px;max-height:88vh;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div>
        <div style="font-family:var(--font-display,'Fraunces',serif);font-size:20px;font-weight:700;color:#1e293b;">9-Month Fetal Development</div>
        <div style="font-size:12px;color:#64748b;">Month-by-month size and anatomical growth</div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseFetalMonthModal()" style="border:none;background:#f1f5f9;width:34px;height:34px;border-radius:50%;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <!-- Month Selector Pills -->
    <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:10px;" id="fetalMonthPillRow">
      <?php for ($m = 1; $m <= 9; $m++): ?>
        <button type="button" class="btn-mo-tab <?php echo $m === $currentMonth ? 'active' : ''; ?>" onclick="pcSelectFetalMonth(<?php echo $m; ?>)" id="btnMoTab<?php echo $m; ?>" style="flex-shrink:0;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #e2e8f0;background:<?php echo $m === $currentMonth ? '#b04a6e' : '#ffffff'; ?>;color:<?php echo $m === $currentMonth ? '#ffffff' : '#64748b'; ?>;cursor:pointer;">
          Mo <?php echo $m; ?>
        </button>
      <?php endfor; ?>
    </div>

    <div style="overflow-y:auto;flex:1;padding-right:4px;">
      <?php for ($m = 1; $m <= 9; $m++):
          $md = PREGNANCY_MONTH_DATA[$m];
      ?>
        <div class="fetal-month-panel" id="fetalMonthPanel<?php echo $m; ?>" style="display:<?php echo $m === $currentMonth ? 'block' : 'none'; ?>;">
          <div style="text-align:center;margin-bottom:16px;">
            <div style="width:130px;height:130px;border-radius:50%;margin:0 auto 10px;overflow:hidden;border:4px solid #fce7f0;box-shadow:0 4px 16px rgba(176,74,110,0.15);">
              <img src="assets/baby_months/month_<?php echo $m; ?>.png" alt="Month <?php echo $m; ?>" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div style="font-family:var(--font-display,'Fraunces',serif);font-size:18px;font-weight:700;color:#1e293b;">Month <?php echo $m; ?> &bull; <?php echo e($md['fruitCompare']); ?></div>
            <div style="font-size:12px;color:#64748b;"><?php echo e($md['weeks']); ?> &bull; Length: <strong><?php echo e($md['sizeLength']); ?></strong> &bull; Weight: <strong><?php echo e($md['weight']); ?></strong></div>
          </div>

          <div style="background:#fdf2f4;border:1px solid #fce7f0;border-radius:16px;padding:14px;margin-bottom:10px;">
            <div style="font-size:11.5px;font-weight:800;letter-spacing:1px;color:#b04a6e;text-transform:uppercase;margin-bottom:4px;">Monthly Highlights</div>
            <div style="font-size:13px;color:#334155;line-height:1.45;"><?php echo e($md['highlights']); ?></div>
          </div>

          <div style="background:#f0f9ff;border:1px solid #e0f2fe;border-radius:16px;padding:14px;">
            <div style="font-size:11.5px;font-weight:800;letter-spacing:1px;color:#0284c7;text-transform:uppercase;margin-bottom:4px;">Anatomical Milestones</div>
            <div style="font-size:13px;color:#334155;line-height:1.45;"><?php echo e($md['anatomy']); ?></div>
          </div>
        </div>
      <?php endfor; ?>
    </div>

    <button type="button" class="btn btn-block" style="margin-top:16px;background:#b04a6e;color:#fff;border-radius:14px;padding:11px;" onclick="pcCloseFetalMonthModal()">Close</button>
  </div>
</div>

<!-- Clinical Recommendations Pop-up Form / Modal -->
<div class="ed-modal-backdrop" id="recsModalBackdrop" style="display:none;" onclick="if(event.target===this) pcCloseRecsModal()">
  <div class="ed-modal" style="max-width:500px;border-radius:24px;padding:24px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:50%;background:#fce7f0;display:flex;align-items:center;justify-content:center;color:#b04a6e;font-size:18px;">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <div>
          <div style="font-family:var(--font-display,'Fraunces',serif);font-size:18px;font-weight:700;color:#1e293b;">Clinical Recommendations</div>
          <div style="font-size:12px;color:#64748b;">Guidance tailored to your maternal assessment</div>
        </div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseRecsModal()" style="border:none;background:#f1f5f9;width:34px;height:34px;border-radius:50%;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#85818A;text-transform:uppercase;margin-bottom:12px;">Top Clinical Recommendations</div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;max-height:360px;overflow-y:auto;padding-right:2px;">
      <?php if (!empty($topRecs)): foreach ($topRecs as $r): 
        $recText = is_array($r) ? ($r['text'] ?? '') : $r;
        $isUrgent = is_array($r) && !empty($r['urgent']);
        $cat = is_array($r) ? ($r['category'] ?? '') : '';
      ?>
        <div style="background:<?php echo $isUrgent ? '#FEE2E2' : '#FDF2F7'; ?>;border:1px solid <?php echo $isUrgent ? '#FCA5A5' : '#FCE7F0'; ?>;border-radius:14px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px;">
          <i class="fa-solid <?php echo $isUrgent ? 'fa-triangle-exclamation' : 'fa-circle-check'; ?>" style="font-size:16px;margin-top:2px;color:<?php echo $isUrgent ? '#DC2626' : '#B04A6E'; ?>;"></i>
          <div style="flex:1;">
            <?php if ($cat): ?>
              <div style="font-size:11px;font-weight:800;letter-spacing:0.8px;color:<?php echo $isUrgent ? '#DC2626' : '#B04A6E'; ?>;text-transform:uppercase;margin-bottom:2px;"><?php echo e($cat); ?></div>
            <?php endif; ?>
            <div style="font-size:13.5px;color:<?php echo $isUrgent ? '#991B1B' : '#334155'; ?>;line-height:1.45;"><?php echo e($recText); ?></div>
          </div>
        </div>
      <?php endforeach; else: ?>
        <div class="empty"><i class="fa-solid fa-lightbulb"></i>Complete a symptom check-in to get recommendations.</div>
      <?php endif; ?>
    </div>

    <a class="btn btn-outline btn-block" style="margin-bottom:8px;border-radius:12px;padding:10px;text-align:center;color:#B04A6E;border-color:#B04A6E;" href="recommendations.php">
      <i class="fa-solid fa-chart-line" style="margin-right:6px;"></i> View Factor Analysis & Guidance
    </a>
    <button type="button" class="btn btn-block" style="background:#b04a6e;color:#fff;border-radius:12px;padding:10px;" onclick="pcCloseRecsModal()">Close</button>
  </div>
</div>

<script>
function pcOpenRecsModal(){
  var m = document.getElementById('recsModalBackdrop');
  if(m){
    m.style.display = 'flex';
    m.classList.add('open');
  }
}
function pcCloseRecsModal(){
  var m = document.getElementById('recsModalBackdrop');
  if(m){
    m.style.display = 'none';
    m.classList.remove('open');
  }
}
function pcOpenWeekTipsModal(){
  var m = document.getElementById('weekTipsModalBackdrop');
  if(m) m.style.display = 'flex';
}
function pcCloseWeekTipsModal(){
  var m = document.getElementById('weekTipsModalBackdrop');
  if(m) m.style.display = 'none';
}
function pcOpenFetalMonthModal(){
  var m = document.getElementById('fetalMonthModalBackdrop');
  if(m) m.style.display = 'flex';
}
function pcCloseFetalMonthModal(){
  var m = document.getElementById('fetalMonthModalBackdrop');
  if(m) m.style.display = 'none';
}
function pcSelectFetalMonth(mNum){
  for(var i = 1; i <= 9; i++){
    var p = document.getElementById('fetalMonthPanel' + i);
    var b = document.getElementById('btnMoTab' + i);
    if(p) p.style.display = (i === mNum) ? 'block' : 'none';
    if(b){
      if(i === mNum){
        b.style.background = '#b04a6e';
        b.style.color = '#ffffff';
        b.style.borderColor = '#b04a6e';
      } else {
        b.style.background = '#ffffff';
        b.style.color = '#64748b';
        b.style.borderColor = '#e2e8f0';
      }
    }
  }
}
</script>

<?php render_footer(); ?>