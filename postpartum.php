<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM postpartum_status WHERE user_id=?");
$stmt->execute([$u['id']]);
$status = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';

    if ($action === 'mark_delivered'){
        $deliveryDate = $_POST['delivery_date'] ?: date('Y-m-d');
        $pdo->prepare("REPLACE INTO postpartum_status (user_id, is_postpartum, delivery_date, delivery_type, baby_name, recovery_notes)
                       VALUES (?,1,?,?,?,?)")
            ->execute([$u['id'], $deliveryDate, trim($_POST['delivery_type']), trim($_POST['baby_name']), $status['recovery_notes'] ?? '']);
        seed_default_vaccinations($pdo, $u['id'], $deliveryDate);
        flash('Congratulations! Postpartum tracking is now active.', 'success');
        log_action('mark_delivered');
        redirect('postpartum.php');
    }

    if ($action === 'update_notes'){
        $pdo->prepare("UPDATE postpartum_status SET recovery_notes=? WHERE user_id=?")
            ->execute([trim($_POST['recovery_notes']), $u['id']]);
        flash('Recovery notes saved.', 'success');
        redirect('postpartum.php');
    }

    if ($action === 'toggle_vaccine'){
        $vaxId = $_POST['vax_id'];
        $given = isset($_POST['given']) ? 1 : 0;
        $pdo->prepare("UPDATE baby_vaccinations SET given=?, given_date=? WHERE id=? AND user_id=?")
            ->execute([$given, $given ? date('Y-m-d') : null, $vaxId, $u['id']]);
        redirect('postpartum.php');
    }
}

$isPostpartum = !empty($status['is_postpartum']);
$daysSinceDelivery = null;
if ($isPostpartum && !empty($status['delivery_date'])){
    $daysSinceDelivery = (int)floor((time() - strtotime($status['delivery_date'])) / 86400);
}

$vaccines = [];
if ($isPostpartum){
    $stmt = $pdo->prepare("SELECT * FROM baby_vaccinations WHERE user_id=? ORDER BY sort_order ASC");
    $stmt->execute([$u['id']]);
    $vaccines = $stmt->fetchAll();
}

render_header('Postpartum', 'postpartum');
?>

<?php if (!$isPostpartum): ?>
  <div class="card">
    <div class="eyebrow">Postpartum Tracking</div>
    <h3 style="margin-top:6px;">Mark Your Delivery</h3>
    <p class="muted" style="font-size:13.5px;">Once you mark yourself as postpartum, PregnaCare switches to recovery tracking and sets up your baby's vaccination checklist automatically.</p>
    <form method="post" action="postpartum.php">
      <input type="hidden" name="action" value="mark_delivered">
      <div class="grid grid-2">
        <div class="field"><label>Delivery Date</label><input type="date" name="delivery_date" value="<?php echo e(today_iso()); ?>" required></div>
        <div class="field">
          <label>Delivery Type</label>
          <select name="delivery_type">
            <option value="Vaginal">Vaginal</option>
            <option value="Cesarean">Cesarean</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Baby's Name (optional)</label><input type="text" name="baby_name" placeholder="e.g. Baby Salindo"></div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-baby"></i> Mark as Delivered</button>
    </form>
  </div>

<?php else: ?>

  <div class="hero-gradient" style="margin-bottom:16px;">
    <div class="eyebrow" style="color:rgba(255,255,255,.85);">Postpartum Recovery</div>
    <h1 style="margin:6px 0 4px;color:#fff;font-size:26px;">Day <?php echo (int)$daysSinceDelivery; ?> Postpartum</h1>
    <div style="color:rgba(255,255,255,.9);font-size:14px;">
      <?php echo e($status['delivery_type'] ?: 'Delivery'); ?> on <?php echo e(fmt_date($status['delivery_date'])); ?>
      <?php if (!empty($status['baby_name'])): ?> · Welcome, <?php echo e($status['baby_name']); ?>!<?php endif; ?>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <div class="eyebrow">Recovery Notes</div>
    <h3 style="margin-top:6px;">How are you feeling?</h3>
    <form method="post" action="postpartum.php">
      <input type="hidden" name="action" value="update_notes">
      <div class="field">
        <textarea name="recovery_notes" rows="3" placeholder="Track how your recovery is going — pain levels, mood, sleep, anything worth remembering."><?php echo e($status['recovery_notes'] ?? ''); ?></textarea>
      </div>
      <button class="btn btn-outline btn-sm" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Notes</button>
    </form>
    <div class="warning-callout" style="margin-top:14px;">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong>Seek care right away if you notice:</strong> heavy bleeding (soaking a pad in under an hour), fever, severe headache with vision changes, chest pain or difficulty breathing, or signs of infection at an incision site.</div>
    </div>
  </div>

  <div class="card">
    <div class="eyebrow">Baby's Vaccination Checklist</div>
    <h3 style="margin-top:6px;">Track each dose as it's given</h3>
    <?php foreach ($vaccines as $v): ?>
      <form method="post" action="postpartum.php" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <input type="hidden" name="action" value="toggle_vaccine">
        <input type="hidden" name="vax_id" value="<?php echo e($v['id']); ?>">
        <label style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;">
          <input type="checkbox" name="given" onchange="this.form.submit()" <?php echo $v['given']?'checked':''; ?> style="width:18px;height:18px;">
          <div>
            <div style="font-weight:700;font-size:13.5px;<?php echo $v['given']?'text-decoration:line-through;color:var(--muted);':''; ?>"><?php echo e($v['vaccine_name']); ?></div>
            <div class="muted" style="font-size:12px;">Due: <?php echo e($v['due_age_label']); ?><?php echo $v['due_date'] ? ' — ' . e(fmt_date($v['due_date'])) : ''; ?></div>
          </div>
        </label>
        <?php if ($v['given']): ?><span class="badge badge-low">Given <?php echo e(fmt_date($v['given_date'])); ?></span><?php endif; ?>
      </form>
    <?php endforeach; ?>
  </div>

<?php endif; ?>

<?php render_footer(); ?>
