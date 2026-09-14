<?php
require_once __DIR__ . '/base.php';
$u = require_role('admin');

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    if (($_POST['form'] ?? '') === 'rules'){
        $activeKeys = $_POST['active'] ?? [];
        $all = $pdo->query("SELECT rule_key FROM rule_base")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($all as $key){
            $pdo->prepare("UPDATE rule_base SET active=? WHERE rule_key=?")->execute([in_array($key,$activeKeys)?1:0, $key]);
        }
        flash('Rule base updated.', 'success');
        log_action('update_rule_base');
    }
    redirect('admin_settings.php');
}

$rules = get_rule_base();

render_header('Risk Rules Configuration', 'admin_settings');
?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Step 2 — Reference</div>
  <h3 style="margin-top:6px;">Clinical Risk-Scoring Rules</h3>
  <p class="muted" style="margin-top:-6px;">Fixed point values from the reproductive history, medical conditions, and present pregnancy problems rule table. Each patient's total is classified into Low/High/Severe via fuzzy logic.</p>
  <?php
  $byCat = ['RH' => [], 'MC' => [], 'PP' => []];
  foreach (RULE_SCORES as $id => $r) $byCat[$r['cat']][] = [$id, $r];
  foreach ($byCat as $cat => $items):
  ?>
    <h4 style="margin:14px 0 6px;"><?php echo e(RULE_CAT_LABELS[$cat]); ?></h4>
    <?php foreach ($items as [$id, $r]): ?>
      <div class="kv"><span class="k"><?php echo e($id); ?> — <?php echo e($r['label']); ?></span><span class="v">+<?php echo (int)$r['points']; ?></span></div>
    <?php endforeach; ?>
  <?php endforeach; ?>
  <p class="muted" style="font-size:12px;margin-top:10px;">MC-06 (other significant disease) is a variable +1 to +5, set per patient in their profile.</p>
</div>

<div class="card">
  <div class="eyebrow">Step 4 Configuration</div>
  <h3 style="margin-top:6px;">Rule-Based Expert Layer</h3>
  <form method="post" action="admin_settings.php">
    <input type="hidden" name="form" value="rules">
    <?php foreach ($rules as $r): ?>
      <div class="engine-step">
        <div class="num"><?php echo strtoupper(substr($r['rule_key'],1)); ?></div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13.5px;">IF <?php echo e($r['if_text']); ?></div>
          <div class="muted" style="font-size:12.5px;">THEN <?php echo e($r['then_text']); ?></div>
        </div>
        <label class="chip <?php echo $r['active']?'on':''; ?>" style="cursor:pointer;flex-shrink:0;">
          <input type="checkbox" name="active[]" value="<?php echo e($r['rule_key']); ?>" <?php echo $r['active']?'checked':''; ?> style="margin-right:6px;"> Active
        </label>
      </div>
    <?php endforeach; ?>
    <button class="btn btn-primary" style="margin-top:14px;" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Rule Base</button>
  </form>
</div>

<?php render_footer(); ?>
