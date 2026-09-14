<?php
require_once __DIR__ . '/base.php';
$u = require_role('admin');

$patients = $pdo->query("SELECT u.*, pp.edd, pp.lmp, pp.gravida FROM users u LEFT JOIN patient_profiles pp ON pp.user_id = u.id WHERE u.role='patient' ORDER BY u.name")->fetchAll();

$rows = [];
foreach ($patients as $p){
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id=? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$p['id']]);
    $latest = $stmt->fetch();
    $rows[] = ['patient'=>$p, 'assessment'=>$latest];
}
usort($rows, function($a,$b){
    $order = ['Severe'=>0,'High'=>1,'Low'=>2];
    $la = $a['assessment']['level'] ?? 'Low'; $lb = $b['assessment']['level'] ?? 'Low';
    return ($order[$la] ?? 3) <=> ($order[$lb] ?? 3);
});

$highRiskCount = count(array_filter($rows, fn($r)=> ($r['assessment']['level'] ?? null) === 'Severe'));

render_header('Patients Overview', 'admin_patients');
?>

<div class="grid grid-3" style="margin-bottom:16px;">
  <div class="card stat"><div class="eyebrow">Total Patients</div><div class="num"><?php echo count($rows); ?></div></div>
  <div class="card stat"><div class="eyebrow">Severe Risk Cases</div><div class="num" style="color:var(--risk-high);"><?php echo $highRiskCount; ?></div></div>
  <div class="card stat"><div class="eyebrow">Low Risk / Stable</div><div class="num" style="color:var(--risk-low);"><?php echo count(array_filter($rows, fn($r)=> ($r['assessment']['level'] ?? null) === 'Low')); ?></div></div>
</div>

<div class="card">
  <h3 style="margin-top:0;">Patient List — sorted by risk</h3>
  <table>
    <thead><tr><th>Patient</th><th>EDD</th><th>Risk</th><th>Score</th><th>Last Assessed</th><th></th></tr></thead>
    <tbody>
    <?php if(!$rows): ?><tr><td colspan="6" class="muted">No patients registered yet.</td></tr><?php endif; ?>
    <?php foreach ($rows as $r): $p = $r['patient']; $a = $r['assessment']; ?>
      <tr>
        <td style="display:flex;align-items:center;gap:10px;">
          <div class="avatar" style="width:32px;height:32px;font-size:12px;"><?php echo e(initials($p['name'])); ?></div>
          <div><?php echo e($p['name']); ?><br><span class="muted" style="font-size:11.5px;"><?php echo e($p['email']); ?></span></div>
        </td>
        <td><?php echo e(fmt_date($p['edd'] ?? null)); ?></td>
        <td><?php if($a): ?><span class="badge <?php echo risk_badge_class($a['level']); ?>"><?php echo e($a['level']); ?></span><?php else: ?><span class="muted">No data</span><?php endif; ?></td>
        <td><?php echo $a ? (int)$a['score'] : '—'; ?></td>
        <td><?php echo $a ? e(fmt_date($a['date'])) : '—'; ?></td>
        <td><a class="btn btn-outline btn-sm" href="admin_patient.php?id=<?php echo urlencode($p['id']); ?>">View</a></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php render_footer(); ?>
