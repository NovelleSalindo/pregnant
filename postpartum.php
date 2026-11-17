<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');
$actPregId = get_active_pregnancy_id($pdo, $u['id']);

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
        seed_default_newborn_care($pdo, $u['id'], $actPregId);
        flash('Congratulations! Postpartum tracking and baby care checklists are now active.', 'success');
        log_action('mark_delivered');
        redirect('postpartum.php');
    }

    if ($action === 'update_notes'){
        $pdo->prepare("UPDATE postpartum_status SET recovery_notes=? WHERE user_id=?")
            ->execute([trim($_POST['recovery_notes']), $u['id']]);
        flash('Recovery notes saved.', 'success');
        redirect('postpartum.php');
    }

    if ($action === 'toggle_newborn_care'){
        $itemId = $_POST['item_id'] ?? '';
        $completed = isset($_POST['completed']) ? 1 : 0;
        toggle_newborn_care_item($pdo, $u['id'], $itemId, $completed, $actPregId);
        redirect('postpartum.php');
    }

    if ($action === 'toggle_vaccine'){
        $vaxId = $_POST['vax_id'];
        $given = isset($_POST['given']) ? 1 : 0;
        toggle_baby_vaccine_item($pdo, $u['id'], $vaxId, $given);
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

// Essential Newborn Care Checklist items
$newbornCare = get_user_newborn_care_items($pdo, $u['id'], $actPregId);
$totalCare = count($newbornCare);
$completedCare = 0;
foreach ($newbornCare as $nc) {
    if (!empty($nc['is_completed'])) $completedCare++;
}
$pendingCare = $totalCare - $completedCare;
$percentCare = $totalCare > 0 ? (int)round(($completedCare / $totalCare) * 100) : 0;

render_header('Postpartum & Baby Care', 'postpartum');
?>

<script>
function filterCare(type, btn) {
  document.querySelectorAll('.care-filter-btn').forEach(b => {
    b.classList.remove('active', 'btn-primary');
    b.classList.add('btn-outline');
  });
  btn.classList.add('active', 'btn-primary');
  btn.classList.remove('btn-outline');

  document.querySelectorAll('.care-item-card').forEach(el => {
    if (type === 'all') {
      el.style.display = 'block';
    } else if (type === 'todo') {
      el.style.display = el.getAttribute('data-status') === 'todo' ? 'block' : 'none';
    } else if (type === 'done') {
      el.style.display = el.getAttribute('data-status') === 'done' ? 'block' : 'none';
    }
  });
}
</script>

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

  <!-- Essential Newborn Care Interactive Checklist (Pre-delivery / Preparation) -->
  <div class="card" style="margin-top:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="eyebrow">Essential Newborn Care Checklist</div>
        <h3 style="margin-top:4px;">Unang Yakap &amp; At-Birth Clinical Protocol</h3>
        <p class="muted" style="font-size:13.5px;margin-bottom:0;">
          WHO &amp; Philippine DOH protocol to monitor what has been done and what still needs to be done.
        </p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:var(--primary);"><?php echo (int)$completedCare; ?> of <?php echo (int)$totalCare; ?> Done</div>
        <div class="muted" style="font-size:12px;"><?php echo (int)$percentCare; ?>% Completed</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div style="width:100%;height:8px;background:var(--border);border-radius:999px;margin:12px 0 14px;overflow:hidden;">
      <div style="width:<?php echo (int)$percentCare; ?>%;height:100%;background:#059669;transition:width 0.3s ease;"></div>
    </div>

    <!-- Filter buttons -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-primary care-filter-btn active" onclick="filterCare('all', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">All (<?php echo (int)$totalCare; ?>)</button>
      <button type="button" class="btn btn-sm btn-outline care-filter-btn" onclick="filterCare('todo', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">To Do / What to do (<?php echo (int)$pendingCare; ?>)</button>
      <button type="button" class="btn btn-sm btn-outline care-filter-btn" onclick="filterCare('done', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">Completed (<?php echo (int)$completedCare; ?>)</button>
    </div>

    <!-- Checklist items -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <?php foreach ($newbornCare as $item): 
        $isDone = !empty($item['is_completed']);
      ?>
        <div class="care-item-card" data-status="<?php echo $isDone ? 'done' : 'todo'; ?>" style="border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:<?php echo $isDone ? '#F8FAFC' : '#fff'; ?>;">
          <form method="post" action="postpartum.php" style="display:flex;align-items:flex-start;gap:12px;margin:0;">
            <input type="hidden" name="action" value="toggle_newborn_care">
            <input type="hidden" name="item_id" value="<?php echo e($item['id']); ?>">
            <input type="checkbox" name="completed" onchange="this.form.submit()" <?php echo $isDone ? 'checked' : ''; ?> style="width:19px;height:19px;margin-top:3px;cursor:pointer;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="font-weight:700;font-size:14px;color:var(--ink);<?php echo $isDone ? 'text-decoration:line-through;color:var(--muted);' : ''; ?>">
                  <?php echo e($item['title']); ?>
                </span>
                <span class="badge" style="background:#F1F5F9;color:#475569;font-size:11px;"><?php echo e($item['timing_label']); ?></span>
                <span class="badge" style="background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;font-size:11px;"><?php echo e($item['category']); ?></span>
              </div>
              <p style="font-size:12.5px;color:var(--muted);margin:0 0 6px;line-height:1.4;">
                <?php echo e($item['description']); ?>
              </p>
              <div>
                <?php if ($isDone): ?>
                  <span class="badge badge-low" style="font-size:11px;"><i class="fa-solid fa-check"></i> Completed<?php echo !empty($item['completed_at']) ? ' (' . fmt_date($item['completed_at']) . ')' : ''; ?></span>
                <?php else: ?>
                  <span class="badge" style="background:#F8FAFC;color:#64748B;border:1px solid #CBD5E1;font-size:11px;"><i class="fa-solid fa-clock"></i> To Do / Pending</span>
                <?php endif; ?>
              </div>
            </div>
          </form>
        </div>
      <?php endforeach; ?>
    </div>
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

  <!-- Essential Newborn Care Interactive Checklist (Delivered) -->
  <div class="card" style="margin-bottom:16px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="eyebrow">Essential Newborn Care Checklist</div>
        <h3 style="margin-top:4px;">Unang Yakap &amp; At-Birth Clinical Protocol</h3>
        <p class="muted" style="font-size:13.5px;margin-bottom:0;">
          WHO &amp; Philippine DOH protocol to monitor what has been done and what still needs to be done.
        </p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:var(--primary);"><?php echo (int)$completedCare; ?> of <?php echo (int)$totalCare; ?> Done</div>
        <div class="muted" style="font-size:12px;"><?php echo (int)$percentCare; ?>% Completed</div>
      </div>
    </div>

    <!-- Progress bar -->
    <div style="width:100%;height:8px;background:var(--border);border-radius:999px;margin:12px 0 14px;overflow:hidden;">
      <div style="width:<?php echo (int)$percentCare; ?>%;height:100%;background:#059669;transition:width 0.3s ease;"></div>
    </div>

    <!-- Filter buttons -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm btn-primary care-filter-btn active" onclick="filterCare('all', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">All (<?php echo (int)$totalCare; ?>)</button>
      <button type="button" class="btn btn-sm btn-outline care-filter-btn" onclick="filterCare('todo', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">To Do / What to do (<?php echo (int)$pendingCare; ?>)</button>
      <button type="button" class="btn btn-sm btn-outline care-filter-btn" onclick="filterCare('done', this)" style="border-radius:20px;padding:4px 12px;font-size:12px;">Completed (<?php echo (int)$completedCare; ?>)</button>
    </div>

    <!-- Checklist items -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <?php foreach ($newbornCare as $item): 
        $isDone = !empty($item['is_completed']);
      ?>
        <div class="care-item-card" data-status="<?php echo $isDone ? 'done' : 'todo'; ?>" style="border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:<?php echo $isDone ? '#F8FAFC' : '#fff'; ?>;">
          <form method="post" action="postpartum.php" style="display:flex;align-items:flex-start;gap:12px;margin:0;">
            <input type="hidden" name="action" value="toggle_newborn_care">
            <input type="hidden" name="item_id" value="<?php echo e($item['id']); ?>">
            <input type="checkbox" name="completed" onchange="this.form.submit()" <?php echo $isDone ? 'checked' : ''; ?> style="width:19px;height:19px;margin-top:3px;cursor:pointer;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="font-weight:700;font-size:14px;color:var(--ink);<?php echo $isDone ? 'text-decoration:line-through;color:var(--muted);' : ''; ?>">
                  <?php echo e($item['title']); ?>
                </span>
                <span class="badge" style="background:#F1F5F9;color:#475569;font-size:11px;"><?php echo e($item['timing_label']); ?></span>
                <span class="badge" style="background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;font-size:11px;"><?php echo e($item['category']); ?></span>
              </div>
              <p style="font-size:12.5px;color:var(--muted);margin:0 0 6px;line-height:1.4;">
                <?php echo e($item['description']); ?>
              </p>
              <div>
                <?php if ($isDone): ?>
                  <span class="badge badge-low" style="font-size:11px;"><i class="fa-solid fa-check"></i> Completed<?php echo !empty($item['completed_at']) ? ' (' . fmt_date($item['completed_at']) . ')' : ''; ?></span>
                <?php else: ?>
                  <span class="badge" style="background:#F8FAFC;color:#64748B;border:1px solid #CBD5E1;font-size:11px;"><i class="fa-solid fa-clock"></i> To Do / Pending</span>
                <?php endif; ?>
              </div>
            </div>
          </form>
        </div>
      <?php endforeach; ?>
    </div>
  </div>

  <!-- Childhood Routine Vaccinations (Philippine EPI) -->
  <div class="card">
    <div class="eyebrow">Baby's Routine Vaccinations (Philippine EPI)</div>
    <h3 style="margin-top:6px;">Ongoing Childhood Immunization Schedule</h3>
    <p class="muted" style="font-size:13.5px;margin-bottom:12px;">Track routine EPI vaccine doses across weeks and months as your baby grows.</p>
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
        <?php if ($v['given']): ?>
          <span class="badge badge-low">Completed <?php echo e(fmt_date($v['given_date'])); ?></span>
        <?php elseif (($v['due_age_days'] ?? 0) <= 1 || stripos($v['vaccine_name'], 'Screening') !== false || stripos($v['vaccine_name'], 'BCG') !== false): ?>
          <span class="badge" style="background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;">At-Birth Essential</span>
        <?php endif; ?>
      </form>
    <?php endforeach; ?>
  </div>

<?php endif; ?>

<?php render_footer(); ?>
