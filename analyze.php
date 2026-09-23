<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 20");
$stmt->execute([$u['id']]);
$all = $stmt->fetchAll();

$idA = $_GET['a'] ?? ($all[0]['id'] ?? null);
$idB = $_GET['b'] ?? ($all[1]['id'] ?? null);

$byId = [];
foreach ($all as $row) { $byId[$row['id']] = $row; }
$a = $byId[$idA] ?? null;
$b = $byId[$idB] ?? null;

// Fetch Coopland Assessment
$cId = $_GET['c'] ?? null;
$cooplandAssm = null;
if ($cId) {
    $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE id = ?");
    $stmt->execute([$cId]);
    $cooplandAssm = $stmt->fetch();
} else {
    $stmt = $pdo->prepare("SELECT * FROM coopland_assessments WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1");
    $stmt->execute([$u['id']]);
    $cooplandAssm = $stmt->fetch();
}
if ($cooplandAssm) {
    $cooplandAssm['factors'] = json_decode($cooplandAssm['factors_json'] ?? '[]');
}

// Fetch Active Clinical Alerts
$stmt = $pdo->prepare("SELECT * FROM clinical_alerts WHERE user_id = ? AND status = 'active' ORDER BY severity DESC, date DESC");
$stmt->execute([$u['id']]);
$clinicalAlerts = $stmt->fetchAll();

// Generate recommendations if both exist
require_once __DIR__ . '/recommendation_engine.php';
$cooplandRecs = [];
if ($cooplandAssm) {
    $cooplandRecs = generate_recommendations($cooplandAssm, $clinicalAlerts);
}

function decode_fields($row, $pdo = null, $userId = null){
    if (!$row) return null;
    $row['structural'] = json_decode($row['ahp_json'] ?? '{}', true);
    $row['fuzzy'] = json_decode($row['fuzzy_json'] ?? '{}', true);
    $row['rules'] = json_decode($row['rules_json'] ?? '[]', true) ?: [];
    $row['recs'] = json_decode($row['recommendations_json'] ?? '[]', true) ?: [];
    
    if ($pdo && $userId) {
        $symStmt = $pdo->prepare("
            SELECT sli.symptom_id AS id, sli.severity, sli.duration, sli.frequency, sc.name 
            FROM symptom_logs sl
            JOIN symptom_log_items sli ON sli.symptom_log_id = sl.id
            LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id
            WHERE sl.user_id = ? AND ABS(TIMESTAMPDIFF(SECOND, sl.date, ?)) <= 60
            ORDER BY sli.id ASC
        ");
        $symStmt->execute([$userId, $row['date']]);
        $row['logged_symptoms'] = $symStmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $row['logged_symptoms'] = [];
    }

    return $row;
}
$a = decode_fields($a, $pdo, $u['id']);
$b = decode_fields($b, $pdo, $u['id']);

function delta_badge($newVal, $oldVal, $lowerIsBetter = true){
    $diff = $newVal - $oldVal;
    if ($diff == 0) return '<span class="muted" style="font-size:12px;"><i class="fa-solid fa-equals"></i> No change</span>';
    $improved = $lowerIsBetter ? ($diff < 0) : ($diff > 0);
    $color = $improved ? 'var(--risk-low)' : 'var(--risk-high)';
    $icon = $diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    $sign = $diff > 0 ? '+' : '';
    return "<span style=\"color:{$color};font-weight:700;font-size:12.5px;\"><i class=\"fa-solid {$icon}\"></i> {$sign}" . number_format($diff, 0) . "</span>";
}

render_header('Fuzzy Risk Analysis', 'analyze');
?>

<div class="card">
  <div class="eyebrow">Fuzzy Logic Decision Support</div>
  <h1 style="margin:6px 0 4px;font-size:22px;">Explainable Symptom &amp; Risk Analysis</h1>
  <div class="muted" style="font-size:13.5px;">
    PregnaCare evaluates your reported symptoms and measurements using smooth fuzzy membership functions and clinical decision rules.
  </div>

  <?php if (count($all) < 1): ?>
    <div class="empty" style="margin-top:16px;">
      <i class="fa-solid fa-diagram-project"></i>
      No assessments on record yet. Complete a <a href="symptoms.php">symptom check-in</a> to run your first fuzzy evaluation.
    </div>
  <?php else: ?>
    <!-- Assessment Selector -->
    <form method="get" action="analyze.php" style="margin-top:16px;">
      <div class="grid grid-2">
        <div class="field">
          <label style="font-size:12px;font-weight:700;">Selected Assessment</label>
          <select name="a" onchange="this.form.submit()" class="select-pill" style="width:100%;">
            <?php foreach ($all as $row): ?>
              <option value="<?php echo e($row['id']); ?>" <?php echo $row['id']===$idA?'selected':''; ?>>
                <?php echo e(fmt_datetime($row['date'])); ?> — <?php echo e($row['level']); ?> (Score: <?php echo (int)$row['score']; ?>)
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <?php if (count($all) >= 2): ?>
        <div class="field">
          <label style="font-size:12px;font-weight:700;">Compare Against (Previous)</label>
          <select name="b" onchange="this.form.submit()" class="select-pill" style="width:100%;">
            <?php foreach ($all as $row): ?>
              <option value="<?php echo e($row['id']); ?>" <?php echo $row['id']===$idB?'selected':''; ?>>
                <?php echo e(fmt_datetime($row['date'])); ?> — <?php echo e($row['level']); ?> (Score: <?php echo (int)$row['score']; ?>)
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <?php endif; ?>
      </div>
    </form>
  <?php endif; ?>
</div>

<?php if ($a): 
  $fuzA = $a['fuzzy'] ?? [];
  $symptomsA = $fuzA['symptoms'] ?? [];
  $overallMemA = $fuzA['overall_membership'] ?? ['low'=>0.8,'high'=>0.15,'severe'=>0.05];
  $dominantA = $fuzA['dominant_membership'] ?? 'LOW';

  // Standard 3-level display mapping
  $rawLevel = strtoupper($a['level'] ?? 'LOW');
  $dispRiskLevel = 'LOW RISK';
  if ($rawLevel === 'SEVERE' || strpos($rawLevel, 'HIGH RISK') !== false) $dispRiskLevel = 'HIGH RISK';
  elseif ($rawLevel === 'HIGH' || strpos($rawLevel, 'MODERATE') !== false) $dispRiskLevel = 'MODERATE RISK';

  $dispSeverity = $dominantA;
  if ($dispRiskLevel === 'HIGH RISK') $dispSeverity = 'SEVERE';
  elseif ($dispRiskLevel === 'MODERATE RISK' && $dispSeverity === 'LOW') $dispSeverity = 'HIGH';

  $isSevereA = in_array($rawLevel, ['SEVERE', 'HIGH RISK']);
  $isResolvedA = (($a['status'] ?? 'active') === 'resolved');
  $canResolveA = ($isSevereA && !$isResolvedA);
  $allVisits = get_clinical_visits_history($pdo, $u['id']);
?>

<?php if ($canResolveA): ?>
<div class="card" style="margin-top:16px;border-left:5px solid var(--risk-high);background:#fff5f5;border-color:rgba(220,53,69,0.3);">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(220,53,69,0.15);display:flex;align-items:center;justify-content:center;color:var(--risk-high);font-size:20px;flex-shrink:0;">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;color:#b02a37;">Active Severe Alert on this Assessment</div>
        <div class="muted" style="font-size:13px;margin-top:2px;">
          If you have already received medical attention or visited your OB-GYN, record your visit to archive this record and unlock a fresh assessment.
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-danger btn-sm" onclick="pcOpenVisitModal()">
      <i class="fa-solid fa-hospital-user"></i> I Already Visited Hospital / OB-GYN
    </button>
  </div>
</div>
<?php elseif ($isResolvedA): ?>
<div class="card" style="margin-top:16px;border-left:5px solid var(--teal);background:rgba(20,184,166,0.06);border-color:rgba(20,184,166,0.3);">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(20,184,166,0.18);display:flex;align-items:center;justify-content:center;color:var(--teal-dark);font-size:20px;flex-shrink:0;margin-top:2px;">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--teal-dark);">Medical Consultation Recorded &amp; Archived</div>
        <div class="muted" style="font-size:13px;margin-top:2px;">
          <strong>Facility:</strong> <?php echo e($a['visited_facility'] ?: 'Hospital / Clinic'); ?>
          <?php if (!empty($a['doctor_name'])): ?> &bull; <strong>Attending:</strong> <?php echo e($a['doctor_name']); ?><?php endif; ?>
          &bull; <strong>Date:</strong> <?php echo e(fmt_datetime($a['visit_date'])); ?>
        </div>
        <?php if (!empty($a['doctor_notes'])): ?>
          <div style="margin-top:6px;font-size:12.5px;color:var(--ink-soft);background:rgba(255,255,255,0.7);padding:8px 12px;border-radius:8px;border:1px solid var(--border);">
            <strong>Doctor's Advice / Notes:</strong> "<?php echo e($a['doctor_notes']); ?>"
          </div>
        <?php endif; ?>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <a class="btn btn-primary btn-sm" href="symptoms.php"><i class="fa-solid fa-plus"></i> Start New Assessment</a>
    </div>
  </div>
</div>
<?php endif; ?>

<!-- COOPLAND RISK AND CLINICAL ALERTS -->
<?php if ($cooplandAssm): 
  $cScore = (int)$cooplandAssm['score'];
  $cRisk = $cooplandAssm['risk_level'];
  $cColor = 'var(--risk-low)';
  if ($cRisk === 'High') $cColor = 'var(--risk-mod)';
  if ($cRisk === 'Review') $cColor = 'var(--orange)';
  if ($cRisk === 'Severe') $cColor = 'var(--risk-high)';
?>
<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card">
    <div class="eyebrow">Coopland Risk Assessment</div>
    <div style="margin-top:12px;display:flex;align-items:center;gap:16px;">
      <div style="width:80px;height:80px;border-radius:50%;border:6px solid <?php echo $cColor; ?>;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:<?php echo $cColor; ?>;">
        <?php echo $cScore; ?>
      </div>
      <div>
        <div style="font-size:14px;color:var(--ink-soft);font-weight:600;text-transform:uppercase;">Coopland Risk</div>
        <div style="font-size:22px;font-weight:800;color:<?php echo $cColor; ?>;"><?php echo $cRisk; ?></div>
      </div>
    </div>
    
    <div style="margin-top:16px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Contributing Risk Factors:</div>
      <?php if (empty($cooplandAssm['factors'])): ?>
        <div class="muted" style="font-size:13px;">No specific Coopland risk factors identified.</div>
      <?php else: ?>
        <ul style="padding-left:20px;font-size:13.5px;color:var(--ink);">
          <?php foreach ($cooplandAssm['factors'] as $factor): ?>
            <li style="margin-bottom:4px;"><?php echo e($factor); ?></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
  </div>

  <div class="card" style="border-left:4px solid var(--risk-high);">
    <div class="eyebrow">Clinical Alerts</div>
    <?php if (empty($clinicalAlerts)): ?>
      <div class="muted" style="font-size:13.5px;margin-top:12px;">
        <i class="fa-solid fa-circle-check" style="color:var(--teal);margin-right:6px;"></i> No active clinical alerts based on current symptoms.
      </div>
    <?php else: ?>
      <?php foreach ($clinicalAlerts as $alert): 
        $aColor = $alert['severity'] === 'Severe' || $alert['severity'] === 'High' ? 'var(--risk-high)' : 'var(--risk-mod)';
      ?>
        <div style="margin-top:12px;background:rgba(220,53,69,0.05);border:1px solid rgba(220,53,69,0.2);padding:12px;border-radius:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <i class="fa-solid fa-triangle-exclamation" style="color:<?php echo $aColor; ?>;"></i>
            <span style="font-size:12px;font-weight:800;color:<?php echo $aColor; ?>;text-transform:uppercase;"><?php echo e($alert['severity']); ?> ALERT</span>
          </div>
          <div style="font-size:14px;color:var(--ink);font-weight:600;margin-bottom:8px;">
            <?php echo e($alert['alert_text']); ?>

          </div>
          <?php if (!empty($cooplandRecs)): ?>
            <div style="font-size:13px;color:var(--ink-soft);border-top:1px dashed var(--border);padding-top:8px;margin-top:8px;">
              <strong>Recommendation:</strong> 
              <?php foreach ($cooplandRecs as $rec) { echo e($rec) . ' '; } ?>
            </div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>
<?php endif; ?>

<!-- PRIMARY EXPLAINABLE RESULT CARD -->
<div class="grid grid-2" style="margin-top:16px;align-items:start;">
  <div class="card" style="text-align:center;">
    <div class="eyebrow">Assessment from <?php echo e(fmt_datetime($a['date'])); ?></div>
    <div class="risk-gauge-wrap" style="margin:12px auto 6px;">
      <?php echo risk_gauge_svg($a['score'], $dispRiskLevel, 190); ?>
      <div class="risk-gauge-value" style="color:var(<?php echo risk_color_var($dispRiskLevel); ?>);"><?php echo (int)$a['score']; ?></div>
      <div style="margin-top:6px;">
        <span class="badge <?php echo risk_badge_class($dispRiskLevel); ?>" style="font-size:13px;padding:6px 14px;">
          <?php echo e($dispRiskLevel); ?>
        </span>
      </div>
      <?php if ($isResolvedA): ?>
        <div style="margin-top:6px;">
          <span class="badge" style="background:#e6fffa;color:#0d9488;border:1px solid #99f6e4;font-size:11px;">
            <i class="fa-solid fa-check"></i> Attended by Doctor
          </span>
        </div>
      <?php elseif ($canResolveA): ?>
        <div style="margin-top:8px;">
          <button type="button" class="btn btn-danger btn-sm" onclick="pcOpenVisitModal()">
            <i class="fa-solid fa-hospital-user"></i> Visited Hospital / OB-GYN?
          </button>
        </div>
      <?php endif; ?>
    </div>
    <div style="margin-top:10px;font-size:13px;" class="muted">
      Overall Symptom Severity: <strong style="color:var(--ink);"><?php echo e($dispSeverity); ?></strong>
    </div>
  </div>

  <div class="card">
    <div class="eyebrow">Fuzzy Output Memberships</div>
    <h3 style="margin-top:6px;font-size:17px;">Overall Severity Degree</h3>
    <p class="muted" style="font-size:12.5px;margin-top:2px;">
      Gradual transition degrees computed from combined fuzzy inference:
    </p>

    <div style="margin-top:14px;display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:4px;">
          <span>LOW Severity (0.00 – 0.39)</span>
          <span style="color:var(--risk-low);"><?php echo number_format($overallMemA['low'] ?? 0, 2); ?></span>
        </div>
        <div style="background:var(--bg-soft);border-radius:6px;height:9px;overflow:hidden;border:1px solid var(--border);">
          <div style="width:<?php echo (($overallMemA['low'] ?? 0) * 100); ?>%;background:var(--risk-low);height:100%;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:4px;">
          <span>HIGH Severity (0.40 – 0.69)</span>
          <span style="color:var(--risk-mod);"><?php echo number_format($overallMemA['high'] ?? 0, 2); ?></span>
        </div>
        <div style="background:var(--bg-soft);border-radius:6px;height:9px;overflow:hidden;border:1px solid var(--border);">
          <div style="width:<?php echo (($overallMemA['high'] ?? 0) * 100); ?>%;background:var(--risk-mod);height:100%;"></div>
        </div>
      </div>

      <div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:4px;">
          <span>SEVERE Severity (0.70 – 1.00)</span>
          <span style="color:var(--risk-high);"><?php echo number_format($overallMemA['severe'] ?? 0, 2); ?></span>
        </div>
        <div style="background:var(--bg-soft);border-radius:6px;height:9px;overflow:hidden;border:1px solid var(--border);">
          <div style="width:<?php echo (($overallMemA['severe'] ?? 0) * 100); ?>%;background:var(--risk-high);height:100%;"></div>
        </div>
      </div>
    </div>

    <div class="divider" style="margin:16px 0 12px;"></div>
    <div style="font-size:12.5px;" class="muted">
      Defuzzified Centroid Score: <strong><?php echo (int)($fuzA['centroid'] ?? $a['score']); ?> / 100</strong>
    </div>
  </div>
</div>

<!-- REPORTED SYMPTOMS IN THIS ASSESSMENT -->
<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Patient Reported Symptoms</div>
  <h3 style="margin-top:6px;font-size:18px;">Symptoms Selected in this Assessment</h3>
  <p class="muted" style="font-size:12.5px;margin-top:2px;">
    Here are the specific symptoms you logged during this evaluation and how they factored into your <?php echo e($dispRiskLevel); ?> result:
  </p>

  <?php if (!empty($a['logged_symptoms'])): ?>
    <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:10px;">
      <?php foreach ($a['logged_symptoms'] as $ls): 
        $sev = $ls['severity'] ?? 'Mild';
        $badgeClass = 'badge-teal';
        if ($sev === 'Moderate') $badgeClass = 'badge-orange';
        if ($sev === 'Severe') $badgeClass = 'badge-danger';
      ?>
        <div style="background:var(--bg-soft);padding:12px;border-radius:12px;border:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:700;font-size:14px;color:var(--ink);"><?php echo e($ls['name'] ?: ucwords(str_replace('_',' ',$ls['id']))); ?></span>
            <span class="badge <?php echo $badgeClass; ?>" style="font-size:11px;"><?php echo e($sev); ?></span>
          </div>
          <div class="muted" style="font-size:12px;">
            <i class="fa-regular fa-clock"></i> <?php echo e($ls['duration'] ?? 'Recent'); ?> &bull; <i class="fa-solid fa-arrows-rotate"></i> <?php echo e($ls['frequency'] ?? 'Occasional'); ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <?php if (strpos($dispRiskLevel, 'LOW') !== false): ?>
      <div style="margin-top:14px;background:rgba(20,184,166,0.08);padding:12px 14px;border-radius:10px;border-left:4px solid var(--teal);font-size:13px;color:var(--teal-dark);">
        <i class="fa-solid fa-circle-check"></i> <strong>Why this resulted in Low Risk:</strong> The reported symptoms are mild/moderate non-critical indicators and did not trigger any acute danger alarms, keeping your overall evaluation safely within <strong>Low Risk</strong>.
      </div>
    <?php endif; ?>

  <?php else: ?>
    <div style="margin-top:12px;background:rgba(20,184,166,0.08);padding:14px;border-radius:10px;border-left:4px solid var(--teal);font-size:13px;color:var(--teal-dark);">
      <i class="fa-solid fa-circle-check"></i> <strong>No adverse symptoms reported:</strong> You logged zero distress symptoms during this check-in. All baseline maternal vitals and obstetric indicators remained normal, resulting in a <strong>Low Risk</strong> evaluation.
    </div>
  <?php endif; ?>
</div>

<!-- MAIN CONTRIBUTING SYMPTOMS & FACTORS -->
<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Explainability</div>
  <h3 style="margin-top:6px;font-size:18px;">Main Contributing Symptoms &amp; Factors</h3>
  <p class="muted" style="font-size:12.5px;margin-top:2px;">
    The primary clinical factors driving your assessment results:
  </p>

  <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
    <?php 
    $contributors = is_array($a['rules']) ? $a['rules'] : [];
    if (!empty($contributors)):
      foreach ($contributors as $cItem):
        $text = is_array($cItem) ? ($cItem['text'] ?? $cItem['rule'] ?? json_encode($cItem)) : (string)$cItem;
    ?>
      <div style="background:var(--bg-soft);padding:10px 14px;border-radius:10px;font-size:13px;display:flex;align-items:center;border:1px solid var(--border);">
        <i class="fa-solid fa-circle-dot" style="color:var(--teal);margin-right:10px;font-size:10px;"></i>
        <span><?php echo e($text); ?></span>
      </div>
    <?php endforeach; else: ?>
      <div class="empty"><i class="fa-solid fa-check"></i>All monitored symptoms and measurements are within normal baseline ranges.</div>
    <?php endif; ?>
  </div>
</div>

<!-- DETAILED SYMPTOM FUZZY MEMBERSHIP TABLE -->
<?php if (!empty($symptomsA)): ?>
<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Fuzzy Analysis of Individual Symptoms</div>
  <h3 style="margin-top:6px;font-size:18px;">Detailed Degree of Severity Breakdown</h3>
  <p class="muted" style="font-size:12.5px;margin-top:2px;">
    Each reported symptom transitions gradually across LOW, HIGH, and SEVERE fuzzy membership curves (0.00–1.00):
  </p>

  <div style="overflow-x:auto;margin-top:14px;">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);text-align:left;">
          <th style="padding:8px 10px;">Symptom</th>
          <th style="padding:8px 10px;text-align:center;">Intensity</th>
          <th style="padding:8px 10px;text-align:center;">LOW</th>
          <th style="padding:8px 10px;text-align:center;">HIGH</th>
          <th style="padding:8px 10px;text-align:center;">SEVERE</th>
          <th style="padding:8px 10px;text-align:center;">Dominant</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($symptomsA as $sid => $sm): 
          if (($sm['intensity'] ?? 0) <= 0 && ($sm['dominant'] ?? '') === 'LOW' && ($sm['high'] ?? 0) == 0 && ($sm['severe'] ?? 0) == 0) continue;
        ?>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px 10px;font-weight:600;">
              <?php echo e($sm['name'] ?? ucwords(str_replace('_',' ',$sid))); ?>
            </td>
            <td style="padding:10px 10px;text-align:center;">
              <span class="badge badge-outline" style="font-size:11px;"><?php echo (float)($sm['intensity'] ?? 0); ?> / 10</span>
            </td>
            <td style="padding:10px 10px;text-align:center;color:var(--risk-low);font-weight:700;">
              <?php echo number_format($sm['low'] ?? 0, 2); ?>
            </td>
            <td style="padding:10px 10px;text-align:center;color:var(--risk-mod);font-weight:700;">
              <?php echo number_format($sm['high'] ?? 0, 2); ?>
            </td>
            <td style="padding:10px 10px;text-align:center;color:var(--risk-high);font-weight:700;">
              <?php echo number_format($sm['severe'] ?? 0, 2); ?>
            </td>
            <td style="padding:10px 10px;text-align:center;">
              <span class="badge <?php echo risk_badge_class($sm['dominant'] ?? 'LOW'); ?>" style="font-size:10.5px;padding:3px 8px;">
                <?php echo e($sm['dominant'] ?? 'LOW'); ?>
              </span>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>

<!-- CALM PERSONALIZED RECOMMENDATIONS (RULES.docx Rule 23) -->
<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Personalized Prenatal Care Guidance</div>
  <h3 style="margin-top:6px;font-size:18px;">Recommended Next Steps</h3>
  <p class="muted" style="font-size:12.5px;margin-top:2px;">
    Tailored healthcare advice to keep you and your baby comfortable and supported:
  </p>

  <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
    <?php foreach ($a['recs'] as $r): ?>
      <div style="background:var(--bg-soft);padding:12px 14px;border-radius:10px;display:flex;align-items:center;border:1px solid var(--border);">
        <i class="fa-solid <?php echo e($r['icon']); ?>" style="font-size:16px;color:<?php echo !empty($r['urgent']) ? 'var(--risk-high)' : 'var(--teal)'; ?>;margin-right:12px;"></i>
        <span style="font-size:13px;color:var(--ink);"><?php echo e($r['text']); ?></span>
      </div>
    <?php endforeach; ?>
    <?php if (!$a['recs']): ?>
      <div class="empty">No specific recommendations recorded for this entry.</div>
    <?php endif; ?>
  </div>
</div>

<!-- SIDE-BY-SIDE COMPARISON (IF PREVIOUS ASSESSMENT EXISTS) -->
<?php if ($b): ?>
<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Monitoring Comparison</div>
  <h3 style="margin-top:6px;font-size:18px;">Current vs. Previous Check-in</h3>
  <div class="grid grid-2" style="margin-top:14px;align-items:start;">
    <div style="background:var(--bg-soft);padding:14px;border-radius:12px;border:1px solid var(--border);text-align:center;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;">Current (<?php echo e(fmt_date($a['date'])); ?>)</div>
      <div style="font-size:24px;font-weight:800;color:var(<?php echo risk_color_var($a['level']); ?>);margin-top:4px;">
        <?php echo (int)$a['score']; ?>
      </div>
      <span class="badge <?php echo risk_badge_class($a['level']); ?>" style="margin-top:4px;"><?php echo e($a['level']); ?></span>
    </div>
    <div style="background:var(--bg-soft);padding:14px;border-radius:12px;border:1px solid var(--border);text-align:center;">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;">Previous (<?php echo e(fmt_date($b['date'])); ?>)</div>
      <div style="font-size:24px;font-weight:800;color:var(<?php echo risk_color_var($b['level']); ?>);margin-top:4px;">
        <?php echo (int)$b['score']; ?>
      </div>
      <span class="badge <?php echo risk_badge_class($b['level']); ?>" style="margin-top:4px;"><?php echo e($b['level']); ?></span>
    </div>
  </div>

  <div style="margin-top:14px;text-align:center;padding:10px;background:var(--bg-soft);border-radius:8px;">
    <span style="font-size:13px;font-weight:600;">Score Change: </span>
    <?php echo delta_badge((int)$a['score'], (int)$b['score']); ?>
  </div>
</div>
<?php endif; ?>

<div class="card" style="margin-top:16px;text-align:center;">
  <a class="btn btn-primary" href="symptoms.php"><i class="fa-solid fa-plus"></i> New Symptom Check-in</a>
  <a class="btn btn-outline" href="monitoring.php" style="margin-left:8px;"><i class="fa-solid fa-chart-line"></i> View Vitals History</a>
</div>

<?php if (!empty($allVisits)): ?>
<div class="card" id="archivedVisits" style="margin-top:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <div>
      <div class="eyebrow"><i class="fa-solid fa-hospital-user" style="color:var(--teal);margin-right:6px;"></i>Clinical Care Archive</div>
      <h3 style="margin-top:4px;font-size:18px;">Archived Hospital &amp; OB-GYN Consultations</h3>
    </div>
    <span class="badge badge-outline"><?php echo count($allVisits); ?> Recorded</span>
  </div>
  <p class="muted" style="font-size:12.5px;margin-top:2px;">
    Permanent historical record of attended severe alerts, clinic visits, and medical treatment instructions:
  </p>

  <div style="overflow-x:auto;margin-top:14px;">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border);text-align:left;">
          <th style="padding:8px 10px;">Visit Date</th>
          <th style="padding:8px 10px;">Hospital / Clinic</th>
          <th style="padding:8px 10px;">Attending Doctor</th>
          <th style="padding:8px 10px;text-align:center;">Alert Level</th>
          <th style="padding:8px 10px;">Doctor's Advice &amp; Treatment</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($allVisits as $v): ?>
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px 10px;white-space:nowrap;font-weight:600;">
              <?php echo e(fmt_datetime($v['visit_date'])); ?>
            </td>
            <td style="padding:10px 10px;font-weight:600;color:var(--ink);">
              <i class="fa-solid fa-hospital" style="color:var(--teal);margin-right:6px;"></i><?php echo e($v['facility'] ?: 'Healthcare Facility'); ?>
            </td>
            <td style="padding:10px 10px;">
              <?php echo e($v['doctor_name'] ?: '<span class="muted">—</span>'); ?>
            </td>
            <td style="padding:10px 10px;text-align:center;">
              <span class="badge <?php echo risk_badge_class($v['assessment_level']); ?>" style="font-size:10.5px;">
                <?php echo e($v['assessment_level']); ?>
              </span>
            </td>
            <td style="padding:10px 10px;color:var(--ink-soft);">
              <?php echo e($v['notes'] ?: 'Attended and monitored.'); ?>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>

<?php 
if ($canResolveA && $a) {
    render_clinical_visit_modal($a['id'], 'analyze');
}
?>

<?php endif; ?>

<?php render_footer(); ?>