<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT next_ob_visit FROM patient_profiles WHERE user_id=?");
$stmt->execute([$u['id']]);
$nextVisit = $stmt->fetchColumn();

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';

    if ($action === 'set_ob_visit'){
        $nextDate = $_POST['next_ob_visit'] ?: null;
        $pdo->prepare("UPDATE patient_profiles SET next_ob_visit=? WHERE user_id=?")
            ->execute([$nextDate, $u['id']]);

        // Automatically trigger / update notification for this OB visit reminder
        if ($nextDate) {
            $daysToVisit = (int)ceil((strtotime($nextDate) - time()) / 86400);
            $visitLabel = date('M j, Y', strtotime($nextDate));
            if ($daysToVisit === 0) {
                $body = "Your prenatal checkup is today ({$visitLabel})! Please don't forget your appointment.";
            } else if ($daysToVisit > 0) {
                $body = "Your prenatal checkup is in {$daysToVisit} day(s), scheduled for {$visitLabel}.";
            } else {
                $body = "Your prenatal checkup date was scheduled for {$visitLabel}. Please update your next visit.";
            }

            // Refresh notification for this OB visit
            $pdo->prepare("DELETE FROM notifications WHERE user_id=? AND kind='ob_visit'")->execute([$u['id']]);
            $stmtNtf = $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)");
            $stmtNtf->execute([uid('ntf'), $u['id'], 'OB-GYN Visit Reminder', $body, now_iso(), 'ob_visit']);
        } else {
            $pdo->prepare("DELETE FROM notifications WHERE user_id=? AND kind='ob_visit'")->execute([$u['id']]);
        }

        flash('OB visit reminder saved. A notification has been scheduled.', 'success');
        log_action('set_ob_visit');
        redirect('reminders.php');
    }

    if ($action === 'add_supplement'){
        $pdo->prepare("INSERT INTO medications (id, user_id, name, dosage, schedule_time, active) VALUES (?,?,?,?,?,1)")
            ->execute([uid('med'), $u['id'], trim($_POST['name']), trim($_POST['dosage']), trim($_POST['schedule_time'])]);
        flash('Supplement/vitamin added.', 'success');
        log_action('add_supplement');
        redirect('reminders.php');
    }

    if ($action === 'toggle_taken'){
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
        redirect('reminders.php');
    }
}

$stmt = $pdo->prepare("SELECT * FROM medications WHERE user_id=? AND active=1 ORDER BY name");
$stmt->execute([$u['id']]);
$meds = $stmt->fetchAll();

$today = today_iso();
$stmt = $pdo->prepare("SELECT medication_id FROM medication_logs WHERE user_id=? AND date=?");
$stmt->execute([$u['id'], $today]);
$takenToday = $stmt->fetchAll(PDO::FETCH_COLUMN);

$daysToVisit = $nextVisit ? (int)ceil((strtotime($nextVisit) - time()) / 86400) : null;

render_header('Reminders', 'reminders');
?>

<!-- Phone Notifications Status Banner -->
<div id="phone_notif_banner" style="background:linear-gradient(135deg, #FFF0F5, #FFE4ED);border:1.5px solid #F8B6CE;border-radius:14px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
  <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:220px;">
    <div style="width:36px;height:36px;border-radius:10px;background:var(--primary, #C2577D);color:#FFF;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
      <i class="fa-solid fa-mobile-screen-button"></i>
    </div>
    <div>
      <strong style="font-size:13px;color:#9B2C52;display:block;">Phone Notifications</strong>
      <span id="phone_notif_subtext" class="muted" style="font-size:12px;">Get checkup alerts on your phone screen &amp; lockscreen.</span>
    </div>
  </div>
  <button type="button" id="phone_notif_btn" onclick="togglePhoneNotificationPermission()" class="btn btn-sm" style="background:var(--primary, #C2577D);color:#FFF;border:none;padding:7px 14px;font-size:12px;border-radius:999px;font-weight:700;">
    <i class="fa-solid fa-bell"></i> Enable Phone Alerts
  </button>
</div>

<div class="grid grid-2" style="align-items:start;">

  <div class="card" id="ob_visit_card">
    <div class="eyebrow">OB-GYN Visit Reminder</div>
    <h3 style="margin-top:6px;">Next Prenatal Checkup</h3>
    
    <div id="pc_countdown_section" style="text-align:center;padding:10px 0;<?php echo (!$nextVisit || $daysToVisit === null) ? 'display:none;' : ''; ?>">
      <div id="pc_countdown_number" style="font-family:var(--font-display);font-size:44px;font-weight:700;color:var(--teal-dark);<?php echo ($daysToVisit !== null && $daysToVisit < 0) ? 'display:none;' : ''; ?>">
        <?php echo ($daysToVisit !== null && $daysToVisit >= 0) ? $daysToVisit : ''; ?>
      </div>
      <div id="pc_countdown_label" class="muted" style="<?php echo ($daysToVisit !== null && $daysToVisit < 0) ? 'display:none;' : ''; ?>">
        <?php echo $daysToVisit === 0 ? "That's today!" : 'day(s) until your visit'; ?>
      </div>
      <div id="pc_countdown_passed" class="badge badge-mod" style="font-size:13px;padding:8px 14px;<?php echo ($daysToVisit !== null && $daysToVisit < 0) ? '' : 'display:none;'; ?>">
        This date has passed — update it below
      </div>
      <div id="pc_countdown_date" style="margin-top:8px;font-weight:700;">
        <?php echo $nextVisit ? e(fmt_date($nextVisit)) : ''; ?>
      </div>
    </div>

    <div id="pc_countdown_empty" class="empty" style="<?php echo ($nextVisit && $daysToVisit !== null) ? 'display:none;' : ''; ?>">
      <i class="fa-solid fa-calendar"></i>No upcoming visit set yet.
    </div>

    <form method="post" action="reminders.php" id="pc_ob_form">
      <input type="hidden" name="action" value="set_ob_visit">
      <div class="field">
        <label for="next_ob_visit">Next OB-GYN Visit Date</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input 
            type="date" 
            id="next_ob_visit" 
            name="next_ob_visit" 
            value="<?php echo e($nextVisit ?? ''); ?>"
            style="width:100%;cursor:pointer;padding-right:42px;"
            onclick="try{this.showPicker();}catch(e){}"
            autocomplete="off"
          >
          <button 
            type="button" 
            onclick="var inp=document.getElementById('next_ob_visit');if(inp){try{inp.showPicker();}catch(e){inp.focus();}}"
            style="position:absolute;right:8px;background:none;border:none;padding:6px;cursor:pointer;color:var(--primary, #C2577D);display:flex;align-items:center;justify-content:center;"
            title="Open Calendar"
          >
            <i class="fa-solid fa-calendar-days" style="font-size:17px;"></i>
          </button>
        </div>
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-calendar-check"></i> Save Reminder</button>
    </form>
  </div>

  <div class="card">
    <div class="eyebrow">Supplement &amp; Vitamin Reminder</div>
    <h3 style="margin-top:6px;">Today's Checklist</h3>
    <?php if (!$meds): ?>
      <div class="empty"><i class="fa-solid fa-pills"></i>No supplements/vitamins added yet.</div>
    <?php endif; ?>
    <?php foreach ($meds as $m): $isTaken = in_array($m['id'], $takenToday); ?>
      <form method="post" action="reminders.php" style="margin-bottom:8px;">
        <input type="hidden" name="action" value="toggle_taken">
        <input type="hidden" name="medication_id" value="<?php echo e($m['id']); ?>">
        <button type="submit" class="chip <?php echo $isTaken?'on':''; ?>" style="width:100%;justify-content:flex-start;display:flex;cursor:pointer;border:1.5px solid var(--border);padding:12px 14px;">
          <i class="fa-solid <?php echo $isTaken?'fa-circle-check':'fa-circle'; ?>" style="margin-right:8px;"></i>
          <strong><?php echo e($m['name']); ?></strong>&nbsp;<span class="muted">— <?php echo e($m['dosage']); ?> · <?php echo e($m['schedule_time']); ?></span>
        </button>
      </form>
    <?php endforeach; ?>

    <div class="divider"></div>
    <div style="margin: 8px 0;">
      <a href="medications.php" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;font-size:13.5px;color:var(--primary, #C2577D);text-decoration:none;">
        <i class="fa-solid fa-angle-right" style="font-size:12px;"></i> + Add a supplement/vitamin
      </a>
    </div>
    <div class="muted" style="font-size:12px;margin-top:10px;">Manage your full list (remove items, etc.) in <a href="medications.php" style="color:var(--teal-dark);font-weight:700;">Medications &amp; Vitamins</a>.</div>
  </div>

</div>

<script>
(function() {
  var dateInput = document.getElementById('next_ob_visit');
  var countdownSec = document.getElementById('pc_countdown_section');
  var countdownNum = document.getElementById('pc_countdown_number');
  var countdownLbl = document.getElementById('pc_countdown_label');
  var countdownPassed = document.getElementById('pc_countdown_passed');
  var countdownDate = document.getElementById('pc_countdown_date');
  var countdownEmpty = document.getElementById('pc_countdown_empty');

  function updateLiveCountdown(val) {
    if (!val) {
      if (countdownSec) countdownSec.style.display = 'none';
      if (countdownEmpty) countdownEmpty.style.display = 'flex';
      return;
    }
    
    var parts = val.split('-');
    if (parts.length === 3) {
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10) - 1;
      var day = parseInt(parts[2], 10);
      var target = new Date(year, month, day);
      target.setHours(0,0,0,0);
      var today = new Date();
      today.setHours(0,0,0,0);
      var diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var formatted = months[target.getMonth()] + ' ' + target.getDate() + ', ' + target.getFullYear();

      if (countdownSec) countdownSec.style.display = 'block';
      if (countdownEmpty) countdownEmpty.style.display = 'none';

      if (diffDays >= 0) {
        if (countdownNum) {
          countdownNum.style.display = 'block';
          countdownNum.textContent = diffDays;
        }
        if (countdownLbl) {
          countdownLbl.style.display = 'block';
          countdownLbl.textContent = diffDays === 0 ? "That's today!" : "day(s) until your visit";
        }
        if (countdownPassed) countdownPassed.style.display = 'none';
      } else {
        if (countdownNum) countdownNum.style.display = 'none';
        if (countdownLbl) countdownLbl.style.display = 'none';
        if (countdownPassed) countdownPassed.style.display = 'inline-block';
      }

      if (countdownDate) {
        countdownDate.textContent = formatted;
      }
    }
  }

  if (dateInput) {
    dateInput.addEventListener('input', function() {
      updateLiveCountdown(this.value);
    });
    dateInput.addEventListener('change', function() {
      updateLiveCountdown(this.value);
    });
  }

  // Handle Phone Notifications Banner & Save Hook
  var phoneBtn = document.getElementById('phone_notif_btn');
  var phoneSub = document.getElementById('phone_notif_subtext');

  function updatePhoneNotifUI() {
    if (!('Notification' in window)) {
      var b = document.getElementById('phone_notif_banner');
      if (b) b.style.display = 'none';
      return;
    }
    if (Notification.permission === 'granted') {
      if (phoneBtn) {
        phoneBtn.innerHTML = '<i class="fa-solid fa-check"></i> Enabled';
        phoneBtn.style.background = '#2E7D32';
        phoneBtn.disabled = true;
      }
      if (phoneSub) phoneSub.textContent = 'Phone alerts are active! You will receive alerts on this phone.';
    } else if (Notification.permission === 'denied') {
      if (phoneBtn) {
        phoneBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Blocked';
        phoneBtn.style.background = '#888';
      }
      if (phoneSub) phoneSub.textContent = 'Notifications blocked in browser. Unblock in your phone site settings.';
    }
  }
  updatePhoneNotifUI();

  window.togglePhoneNotificationPermission = function() {
    if (typeof window.pcRequestPhoneNotifications === 'function') {
      window.pcRequestPhoneNotifications(function(granted) {
        updatePhoneNotifUI();
      });
    }
  };

  // When saving the reminder form, trigger a phone system notification
  var obForm = document.getElementById('pc_ob_form');
  if (obForm) {
    obForm.addEventListener('submit', function(e) {
      var dateVal = dateInput ? dateInput.value : '';
      if (dateVal && typeof window.pcNotifyPhone === 'function') {
        var parts = dateVal.split('-');
        if (parts.length === 3) {
          var target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          target.setHours(0,0,0,0);
          var today = new Date();
          today.setHours(0,0,0,0);
          var diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var dateLabel = months[target.getMonth()] + ' ' + target.getDate() + ', ' + target.getFullYear();
          var bodyText = diff === 0
            ? 'Your prenatal checkup is TODAY (' + dateLabel + ')! Please don\'t forget your clinic appointment.'
            : 'Your prenatal checkup is in ' + diff + ' day(s), scheduled for ' + dateLabel + '.';

          window.pcNotifyPhone('OB-GYN Visit Reminder 🩺', bodyText, 'reminders.php', 'ob_visit');
        }
      }
    });
  }

  // Also if already granted and there is an upcoming visit today or approaching, trigger a reminder on load
  <?php if ($nextVisit && $daysToVisit !== null && $daysToVisit >= 0 && $daysToVisit <= 7): ?>
    if ('Notification' in window && Notification.permission === 'granted') {
      var lastNotified = localStorage.getItem('pc_last_ob_phone_notif');
      var todayKey = new Date().toISOString().split('T')[0];
      if (lastNotified !== todayKey) {
        localStorage.setItem('pc_last_ob_phone_notif', todayKey);
        var visitText = <?php echo json_encode($daysToVisit === 0 ? "Your prenatal checkup is TODAY (" . fmt_date($nextVisit) . ")! Please don't forget your clinic appointment." : "Your prenatal checkup is in {$daysToVisit} day(s), on " . fmt_date($nextVisit) . "."); ?>;
        window.pcNotifyPhone('OB-GYN Visit Reminder 🩺', visitText, 'reminders.php', 'ob_visit');
      }
    }
  <?php endif; ?>
})();
</script>

<?php render_footer(); ?>