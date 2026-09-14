<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
$stmt->execute([$u['id']]);
$latest = $stmt->fetch();

$recs = $latest ? (json_decode($latest['recommendations_json'], true) ?: []) : [];
$urgentRecs = array_filter($recs, fn($r) => !empty($r['urgent']));
$generalRecs = array_filter($recs, fn($r) => empty($r['urgent']));

// Recommendation history — one row per past assessment, so the patient can see how advice changed over time
$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 10");
$stmt->execute([$u['id']]);
$history = $stmt->fetchAll();

render_header('Recommendations', 'recommendations');
?>

<?php if (!$latest): ?>
  <div class="card empty">
    <i class="fa-solid fa-lightbulb"></i>
    No recommendations yet. Complete a symptom check-in to get your first personalized set.
    <div style="margin-top:12px;"><a class="btn btn-primary" href="symptoms.php">Start Symptom Check-in</a></div>
  </div>
<?php else: ?>

<div class="hero-gradient" style="margin-bottom:20px;">
  <div class="eyebrow" style="color:rgba(255,255,255,.85);">Based on your latest assessment</div>
  <h1 style="margin:6px 0 4px;color:#fff;font-size:24px;">
    <?php echo e($latest['level']); ?> Risk — <?php echo (int)$latest['score']; ?>/100
  </h1>
  <div style="color:rgba(255,255,255,.9);font-size:14px;">
    Generated <?php echo e(fmt_datetime($latest['date'])); ?> ·
    <a href="analyze.php" style="color:#fff;text-decoration:underline;">View full risk breakdown</a>
  </div>
</div>

<?php if ($urgentRecs): ?>
<div class="card" style="margin-bottom:16px;border-color:var(--risk-high);">
  <div class="eyebrow" style="color:var(--risk-high);"><i class="fa-solid fa-triangle-exclamation"></i> Urgent — Act On These First</div>
  <?php foreach ($urgentRecs as $r): ?>
    <div class="kv"><span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:var(--risk-high);"></i><strong><?php echo e($r['text']); ?></strong></span></div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<div class="card" style="margin-bottom:16px;">
  <div class="eyebrow">Daily Care Recommendations</div>
  <?php foreach ($generalRecs as $r): ?>
    <div class="kv"><span class="k"><i class="fa-solid <?php echo e($r['icon']); ?>" style="margin-right:8px;color:var(--teal);"></i><?php echo e($r['text']); ?></span></div>
  <?php endforeach; ?>
  <?php if (!$generalRecs): ?><div class="empty"><i class="fa-solid fa-leaf"></i>No general recommendations logged.</div><?php endif; ?>
</div>

<div class="grid grid-2" style="margin-bottom:16px;align-items:start;">
  <div class="card">
    <div class="eyebrow">Emergency Contacts</div>
    <?php foreach (EMERGENCY_HOTLINES as $h): ?>
      <div class="kv"><span class="k"><?php echo e($h['name']); ?></span><span class="v"><a href="tel:<?php echo e($h['number']); ?>"><?php echo e($h['number']); ?></a></span></div>
    <?php endforeach; ?>
  </div>
  <div class="card">
    <div class="eyebrow">Want More Guidance?</div>
    <p class="muted" style="font-size:13.5px;">Browse trimester-specific tips, nutrition guidance, and warning signs.</p>
    <a class="btn btn-outline btn-block btn-sm" href="education.php"><i class="fa-solid fa-book-medical"></i> Go to Education Hub</a>
  </div>
</div>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <h3 style="margin-top:0;">Recommendation History</h3>
    <a class="btn btn-outline btn-sm" href="compare.php"><i class="fa-solid fa-code-compare"></i> Compare Two</a>
  </div>
  <p class="muted" style="margin-top:-6px;font-size:13px;">How your guidance has changed as your risk level changed over time.</p>
  <?php foreach ($history as $h):
      $hRecs = json_decode($h['recommendations_json'], true) ?: [];
  ?>
    <div class="engine-step">
      <div class="num" style="background:var(<?php echo risk_color_var($h['level']); ?>-bg, var(--teal-light));color:var(<?php echo risk_color_var($h['level']); ?>);">
        <?php echo (int)$h['score']; ?>
      </div>
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="badge <?php echo risk_badge_class($h['level']); ?>"><?php echo e($h['level']); ?></span>
          <span class="muted" style="font-size:12px;"><?php echo e(fmt_datetime($h['date'])); ?></span>
        </div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--ink-soft);">
          <?php foreach (array_slice($hRecs, 0, 3) as $r): ?>
            <li><?php echo e($r['text']); ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
  <?php endforeach; ?>
</div>

<?php endif; ?>
<?php render_footer(); ?>
