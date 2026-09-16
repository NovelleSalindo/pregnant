<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

seed_default_hospital_bag($pdo, $u['id']);

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';

    if ($action === 'toggle'){
        $itemId = $_POST['item_id'];
        $checked = isset($_POST['checked']) ? 1 : 0;
        $pdo->prepare("UPDATE hospital_bag_items SET is_checked=? WHERE id=? AND user_id=?")
            ->execute([$checked, $itemId, $u['id']]);
        redirect('hospital_bag.php');
    }

    if ($action === 'add_item'){
        $label = trim($_POST['label']);
        $category = trim($_POST['category']) ?: 'General';
        if ($label !== ''){
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order),0)+1 FROM hospital_bag_items WHERE user_id=?");
            $stmt->execute([$u['id']]);
            $sort = (int)$stmt->fetchColumn();
            $pdo->prepare("INSERT INTO hospital_bag_items (id, user_id, label, category, is_custom, sort_order) VALUES (?,?,?,?,1,?)")
                ->execute([uid('bag'), $u['id'], $label, $category, $sort]);
        }
        redirect('hospital_bag.php');
    }

    if ($action === 'delete_item'){
        $pdo->prepare("DELETE FROM hospital_bag_items WHERE id=? AND user_id=? AND is_custom=1")
            ->execute([$_POST['item_id'], $u['id']]);
        redirect('hospital_bag.php');
    }
}

$stmt = $pdo->prepare("SELECT * FROM hospital_bag_items WHERE user_id=? ORDER BY category, sort_order ASC");
$stmt->execute([$u['id']]);
$items = $stmt->fetchAll();

$byCategory = [];
foreach ($items as $item) $byCategory[$item['category']][] = $item;

$totalCount = count($items);
$checkedCount = count(array_filter($items, fn($i) => $i['is_checked']));
$pct = $totalCount ? round(($checkedCount / $totalCount) * 100) : 0;

render_header('Hospital Bag', 'hospital_bag');
?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Hospital Bag Checklist</div>
  <h3 style="margin:6px 0 10px;"><?php echo $checkedCount; ?> of <?php echo $totalCount; ?> packed</h3>
  <div style="background:var(--border);border-radius:999px;height:8px;overflow:hidden;">
    <div style="background:var(--teal);height:100%;width:<?php echo $pct; ?>%;border-radius:999px;transition:width .3s ease;"></div>
  </div>
</div>

<?php foreach ($byCategory as $cat => $catItems): ?>
  <div class="card" style="margin-bottom:16px;">
    <div class="eyebrow"><?php echo e($cat); ?></div>
    <?php foreach ($catItems as $item): ?>
      <form method="post" action="hospital_bag.php" style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);">
        <input type="hidden" name="action" value="toggle">
        <input type="hidden" name="item_id" value="<?php echo e($item['id']); ?>">
        <label style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;">
          <input type="checkbox" name="checked" onchange="this.form.submit()" <?php echo $item['is_checked']?'checked':''; ?> style="width:18px;height:18px;">
          <span style="font-size:13.5px;<?php echo $item['is_checked']?'text-decoration:line-through;color:var(--muted);':''; ?>"><?php echo e($item['label']); ?></span>
        </label>
      </form>
      <?php if ($item['is_custom']): ?>
        <form method="post" action="hospital_bag.php" style="margin:-6px 0 4px;">
          <input type="hidden" name="action" value="delete_item">
          <input type="hidden" name="item_id" value="<?php echo e($item['id']); ?>">
          <button type="submit" class="btn-link" style="font-size:11.5px;color:var(--risk-high);background:none;border:none;cursor:pointer;padding:0;">Remove</button>
        </form>
      <?php endif; ?>
    <?php endforeach; ?>
  </div>
<?php endforeach; ?>

<div class="card">
  <div class="eyebrow">Add Your Own Item</div>
  <form method="post" action="hospital_bag.php">
    <input type="hidden" name="action" value="add_item">
    <div class="grid grid-2">
      <div class="field"><label>Item</label><input type="text" name="label" required placeholder="e.g. Extra pillow"></div>
      <div class="field">
        <label>Category</label>
        <select name="category">
          <option>For Mom</option>
          <option>For Baby</option>
          <option>For Partner/Support</option>
          <option>General</option>
        </select>
      </div>
    </div>
    <button class="btn btn-outline btn-block btn-sm" type="submit"><i class="fa-solid fa-plus"></i> Add Item</button>
  </form>
</div>

<?php render_footer(); ?>
