<?php
require_once __DIR__ . '/base.php';
$u = require_role('admin');

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    if (($_POST['form'] ?? '') === 'weights'){
        $weights = $_POST['weight'] ?? [];
        $sum = array_sum(array_map('floatval', $weights));
        if ($sum <= 0) $sum = 1;
        foreach ($weights as $key => $val){
            $norm = round((float)$val / $sum, 3); // keep weights normalized to sum to 1, like the AHP brief requires
            $pdo->prepare("UPDATE ahp_weights SET weight=? WHERE criterion=?")->execute([$norm, $key]);
        }
        flash('AHP weights updated and re-normalized to sum to 1.', 'success');
        log_action('update_ahp_weights');
    } elseif (($_POST['form'] ?? '') === 'rules'){
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

$weights = get_ahp_weights();
$rules = get_rule_base();

render_header('AHP & Rules Configuration', 'admin_settings');
?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Step 2 Configuration</div>
  <h3 style="margin-top:6px;">AHP Criteria Weights</h3>
  <p class="muted" style="margin-top:-6px;">Values are automatically re-normalized to sum to 1 after saving.</p>
  <form method="post" action="admin_settings.php">
    <input type="hidden" name="form" value="weights">
    <div class="grid grid-2">
      <?php foreach ($weights as $key => $val): ?>
        <div class="field">
          <label><?php echo e(AHP_LABELS[$key] ?? $key); ?></label>
          <input type="number" step="0.01" min="0" max="1" name="weight[<?php echo e($key); ?>]" value="<?php echo e($val); ?>">
        </div>
      <?php endforeach; ?>
    </div>
    <button class="btn btn-primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Weights</button>
  </form>
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
