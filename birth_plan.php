<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');
$actPregId = get_active_pregnancy_id($pdo, $u['id']);

if ($actPregId) {
    $stmt = $pdo->prepare("SELECT * FROM birth_plans WHERE user_id=? AND pregnancy_id=?");
    $stmt->execute([$u['id'], $actPregId]);
} else {
    $stmt = $pdo->prepare("SELECT * FROM birth_plans WHERE user_id=?");
    $stmt->execute([$u['id']]);
}
$plan = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $planId = $plan['id'] ?? uid('bp');
    $pdo->prepare("INSERT INTO birth_plans
        (id, user_id, pregnancy_id, delivery_location, support_people, pain_management, feeding_preference, who_cuts_cord, skin_to_skin, special_requests, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
            delivery_location = VALUES(delivery_location),
            support_people = VALUES(support_people),
            pain_management = VALUES(pain_management),
            feeding_preference = VALUES(feeding_preference),
            who_cuts_cord = VALUES(who_cuts_cord),
            skin_to_skin = VALUES(skin_to_skin),
            special_requests = VALUES(special_requests),
            updated_at = VALUES(updated_at)")
        ->execute([
            $planId, $u['id'], $actPregId,
            trim($_POST['delivery_location']), trim($_POST['support_people']),
            trim($_POST['pain_management']), trim($_POST['feeding_preference'] ?? ($plan['feeding_preference'] ?? '')), trim($_POST['who_cuts_cord']),
            isset($_POST['skin_to_skin']) ? 1 : 0, trim($_POST['special_requests']), now_iso(),
        ]);
    flash('Birth plan saved.', 'success');
    log_action('save_birth_plan');
    redirect('birth_plan.php');
}

render_header('Birth Plan', 'birth_plan');
?>

<div class="card">
  <div class="eyebrow">Birth Plan Builder</div>
  <h3 style="margin-top:6px;">Your Preferences for Delivery Day</h3>
  <p class="muted" style="font-size:13.5px;">Share this with your OB-GYN and support team ahead of time. Plans can always change once you're in labor — this just helps everyone start on the same page.</p>

  <form method="post" action="birth_plan.php">
    <div class="field">
      <label>Delivery Location Preference</label>
      <input type="text" name="delivery_location" list="location_options" value="<?php echo e($plan['delivery_location'] ?? ''); ?>" placeholder="e.g. City Hospital, Maternity Clinic, Water Birth">
      <datalist id="location_options">
        <option value="City Hospital / Tertiary Medical Center">
        <option value="Private Hospital">
        <option value="Public District Hospital">
        <option value="Maternity / Lying-in Clinic">
        <option value="Birthing Center / Water Birth Center">
        <option value="Home Birth (with licensed midwife)">
      </datalist>
    </div>

    <div class="field">
      <label>Labor Support People</label>
      <input type="text" name="support_people" list="support_options" value="<?php echo e($plan['support_people'] ?? ''); ?>" placeholder="e.g. Partner, Doula, Mother">
      <datalist id="support_options">
        <option value="Partner / Husband">
        <option value="Partner & Mother">
        <option value="Partner & Doula">
        <option value="Mother only">
        <option value="Doula only">
        <option value="Family Member / Sister">
        <option value="Medical Staff only">
      </datalist>
    </div>

    <div class="field">
      <label>Pain Management Preference</label>
      <input type="text" name="pain_management" list="pain_options" value="<?php echo e($plan['pain_management'] ?? ''); ?>" placeholder="e.g. Epidural, Nitrous Oxide, Breathing Exercises">
      <datalist id="pain_options">
        <option value="Unmedicated / Natural (Breathing & Movement)">
        <option value="Epidural">
        <option value="Nitrous Oxide (Gas & Air)">
        <option value="IV Pain Relief / Analgesics">
        <option value="Water Immersion / Warm Bath">
        <option value="Open to options as labor progresses">
      </datalist>
    </div>

    <div class="field">
      <label>Who Cuts the Cord</label>
      <select name="who_cuts_cord">
        <?php $wc = $plan['who_cuts_cord'] ?? ''; foreach (['Partner','Medical staff','No preference'] as $opt): ?>
          <option value="<?php echo e($opt); ?>" <?php echo $wc===$opt?'selected':''; ?>><?php echo e($opt); ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <label class="chip" style="cursor:pointer;margin:6px 0 14px;display:inline-flex;">
      <input type="checkbox" name="skin_to_skin" <?php echo !isset($plan['skin_to_skin']) || $plan['skin_to_skin'] ? 'checked' : ''; ?> style="margin-right:8px;">
      I'd like immediate skin-to-skin contact after delivery
    </label>

    <div class="field">
      <label>Special Requests or Instructions</label>
      <input type="text" name="special_requests" list="request_options" value="<?php echo e($plan['special_requests'] ?? ''); ?>" placeholder="Any specific wishes, music, delayed cord clamping, or emergency preferences...">
      <datalist id="request_options">
        <option value="Immediate skin-to-skin contact & delayed cord clamping">
        <option value="Quiet, dim room with soothing music">
        <option value="Delayed cord clamping only">
        <option value="Partner to cut the umbilical cord">
        <option value="No episiotomy unless medically necessary">
        <option value="Breastfeeding support within the first hour">
        <option value="Standard hospital protocol (no special requests)">
      </datalist>
    </div>

    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Birth Plan</button>
  </form>

  <?php if (!empty($plan['updated_at'])): ?>
    <div class="muted" style="font-size:12px;margin-top:10px;">Last updated <?php echo e(fmt_datetime($plan['updated_at'])); ?></div>
  <?php endif; ?>
</div>

<?php render_footer(); ?>
