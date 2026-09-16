<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM birth_plans WHERE user_id=?");
$stmt->execute([$u['id']]);
$plan = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $pdo->prepare("REPLACE INTO birth_plans
        (user_id, delivery_location, support_people, pain_management, feeding_preference, who_cuts_cord, skin_to_skin, special_requests, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)")
        ->execute([
            $u['id'], trim($_POST['delivery_location']), trim($_POST['support_people']),
            trim($_POST['pain_management']), trim($_POST['feeding_preference']), trim($_POST['who_cuts_cord']),
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
    <div class="field"><label>Preferred Delivery Location / Hospital</label><input type="text" name="delivery_location" value="<?php echo e($plan['delivery_location'] ?? ''); ?>" placeholder="e.g. City General Hospital, Labor & Delivery Unit"></div>

    <div class="field"><label>Who You'd Like Present</label><input type="text" name="support_people" value="<?php echo e($plan['support_people'] ?? ''); ?>" placeholder="e.g. Partner, mother, doula"></div>

    <div class="field">
      <label>Pain Management Preference</label>
      <select name="pain_management">
        <?php $pm = $plan['pain_management'] ?? ''; foreach (['Unmedicated / natural','Epidural','Open to options as labor progresses','Other (describe in special requests)'] as $opt): ?>
          <option value="<?php echo e($opt); ?>" <?php echo $pm===$opt?'selected':''; ?>><?php echo e($opt); ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="grid grid-2">
      <div class="field">
        <label>Feeding Preference</label>
        <select name="feeding_preference">
          <?php $fp = $plan['feeding_preference'] ?? ''; foreach (['Breastfeeding','Formula feeding','Combination','Undecided'] as $opt): ?>
            <option value="<?php echo e($opt); ?>" <?php echo $fp===$opt?'selected':''; ?>><?php echo e($opt); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label>Who Cuts the Cord</label>
        <select name="who_cuts_cord">
          <?php $wc = $plan['who_cuts_cord'] ?? ''; foreach (['Partner','Medical staff','No preference'] as $opt): ?>
            <option value="<?php echo e($opt); ?>" <?php echo $wc===$opt?'selected':''; ?>><?php echo e($opt); ?></option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <label class="chip" style="cursor:pointer;margin:6px 0 14px;display:inline-flex;">
      <input type="checkbox" name="skin_to_skin" <?php echo !isset($plan['skin_to_skin']) || $plan['skin_to_skin'] ? 'checked' : ''; ?> style="margin-right:8px;">
      I'd like immediate skin-to-skin contact after delivery
    </label>

    <div class="field"><label>Special Requests or Notes</label><textarea name="special_requests" rows="4" placeholder="Anything else your care team should know — music preferences, cultural or religious practices, photography, etc."><?php echo e($plan['special_requests'] ?? ''); ?></textarea></div>

    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Birth Plan</button>
  </form>

  <?php if (!empty($plan['updated_at'])): ?>
    <div class="muted" style="font-size:12px;margin-top:10px;">Last updated <?php echo e(fmt_datetime($plan['updated_at'])); ?></div>
  <?php endif; ?>
</div>

<?php render_footer(); ?>
