<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT lmp FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$lmp = $stmt->fetchColumn();
$trimester = 1;
if ($lmp){
    $weeks = floor((time() - strtotime($lmp)) / (7*86400));
    $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
}

render_header('Education Hub', 'education');
?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Trimester <?php echo $trimester; ?> Guidance</div>
  <p class="muted">General guidance only — always confirm specifics with your OB-GYN.</p>
  <div class="grid grid-2">
    <div>
      <h4>Checklist</h4>
      <ul>
        <?php
        $tips = [
          1 => ['Confirm pregnancy & first prenatal visit', 'Start prenatal vitamins with folic acid', 'Discuss existing medical conditions with OB-GYN', 'Schedule dating ultrasound'],
          2 => ['Anatomy scan ultrasound (~20 weeks)', 'Glucose screening', 'Track fetal movement daily', 'Plan childbirth education class'],
          3 => ['Weekly/biweekly OB visits', 'Pack hospital bag', 'Finalize birth plan', 'Install car seat', 'Count kicks daily'],
        ];
        foreach ($tips[$trimester] as $t) echo '<li>'.e($t).'</li>';
        ?>
      </ul>
    </div>
    <div>
      <h4>Nutrition &amp; Exercise</h4>
      <ul>
        <?php
        $nut = [
          1 => ['Folic acid 400–800mcg/day', 'Small frequent meals for nausea', 'Light walking 20–30 min/day'],
          2 => ['Increase calcium & iron intake', '~340 extra calories/day', 'Prenatal yoga / swimming'],
          3 => ['Continue iron & calcium', 'Small frequent meals', 'Gentle walking, birthing ball exercises'],
        ];
        foreach ($nut[$trimester] as $t) echo '<li>'.e($t).'</li>';
        ?>
      </ul>
    </div>
  </div>
</div>

<div class="grid grid-2">
  <?php foreach (KNOWLEDGE_BASE as $kb): ?>
    <div class="card">
      <span class="badge badge-teal"><?php echo e($kb['cat']); ?></span>
      <h4 style="margin:8px 0 4px;"><?php echo e($kb['title']); ?></h4>
      <p class="soft" style="font-size:13.5px;margin:0;"><?php echo e($kb['body']); ?></p>
    </div>
  <?php endforeach; ?>
</div>

<?php render_footer(); ?>
