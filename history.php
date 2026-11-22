<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');
$userId = $u['id'];

// Handle POST actions if any
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'switch_pregnancy') {
        $targetPid = $_POST['pregnancy_id'] ?? '';
        if ($targetPid) {
            switch_active_pregnancy($pdo, $userId, $targetPid);
            flash('success', 'Active pregnancy switched successfully.');
        }
        redirect('history.php?pregnancy_id=' . urlencode($_POST['current_filter'] ?? 'all'));
    }
}

// 1. Fetch all pregnancies
$pregsStmt = $pdo->prepare("SELECT * FROM pregnancies WHERE user_id = ? ORDER BY pregnancy_number DESC, created_at DESC");
$pregsStmt->execute([$userId]);
$pregnancies = $pregsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$activePregId = get_active_pregnancy_id($pdo, $userId);

// Filter
$filterPregId = $_GET['pregnancy_id'] ?? 'all';
if ($filterPregId !== 'all' && !empty($filterPregId)) {
    $found = false;
    foreach ($pregnancies as $p) {
        if ($p['id'] === $filterPregId) { $found = true; break; }
    }
    if (!$found) $filterPregId = 'all';
} else {
    $filterPregId = 'all';
}

$activeTab = $_GET['tab'] ?? 'children';
if (!in_array($activeTab, ['children', 'vitals', 'risk', 'symptoms'])) {
    $activeTab = 'children';
}

// 2. Fetch Vitals Logs
if ($filterPregId !== 'all') {
    $vStmt = $pdo->prepare("
        SELECT m.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM monitoring m 
        LEFT JOIN pregnancies p ON p.id = m.pregnancy_id 
        WHERE m.user_id = ? AND m.pregnancy_id = ? 
        ORDER BY m.date DESC
    ");
    $vStmt->execute([$userId, $filterPregId]);
} else {
    $vStmt = $pdo->prepare("
        SELECT m.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM monitoring m 
        LEFT JOIN pregnancies p ON p.id = m.pregnancy_id 
        WHERE m.user_id = ? 
        ORDER BY m.date DESC
    ");
    $vStmt->execute([$userId]);
}
$vitalsLogs = $vStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// 3. Compute Vitals Trends
$trends = compute_vitals_trends($pdo, $userId, $filterPregId === 'all' ? 'all' : $filterPregId);

// 4. Fetch Risk Assessments
if ($filterPregId !== 'all') {
    $caStmt = $pdo->prepare("
        SELECT ca.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM coopland_assessments ca 
        LEFT JOIN pregnancies p ON p.id = ca.pregnancy_id 
        WHERE ca.user_id = ? AND ca.pregnancy_id = ? 
        ORDER BY ca.date DESC, ca.id DESC
    ");
    $caStmt->execute([$userId, $filterPregId]);
} else {
    $caStmt = $pdo->prepare("
        SELECT ca.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM coopland_assessments ca 
        LEFT JOIN pregnancies p ON p.id = ca.pregnancy_id 
        WHERE ca.user_id = ? 
        ORDER BY ca.date DESC, ca.id DESC
    ");
    $caStmt->execute([$userId]);
}
$riskAssessments = $caStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// 5. Fetch Attended Doctor Consultations
if ($filterPregId !== 'all') {
    $cvStmt = $pdo->prepare("
        SELECT cv.*, p.title AS pregnancy_title 
        FROM clinical_visits cv 
        LEFT JOIN pregnancies p ON p.id = cv.pregnancy_id 
        WHERE cv.user_id = ? AND cv.pregnancy_id = ? 
        ORDER BY cv.visit_date DESC, cv.created_at DESC
    ");
    $cvStmt->execute([$userId, $filterPregId]);
} else {
    $cvStmt = $pdo->prepare("
        SELECT cv.*, p.title AS pregnancy_title 
        FROM clinical_visits cv 
        LEFT JOIN pregnancies p ON p.id = cv.pregnancy_id 
        WHERE cv.user_id = ? 
        ORDER BY cv.visit_date DESC, cv.created_at DESC
    ");
    $cvStmt->execute([$userId]);
}
$clinicalVisits = $cvStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// 6. Fetch Symptom Check-in Logs
if ($filterPregId !== 'all') {
    $slStmt = $pdo->prepare("
        SELECT sl.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM symptom_logs sl 
        LEFT JOIN pregnancies p ON p.id = sl.pregnancy_id 
        WHERE sl.user_id = ? AND sl.pregnancy_id = ? 
        ORDER BY sl.date DESC
    ");
    $slStmt->execute([$userId, $filterPregId]);
} else {
    $slStmt = $pdo->prepare("
        SELECT sl.*, p.title AS pregnancy_title, p.pregnancy_number 
        FROM symptom_logs sl 
        LEFT JOIN pregnancies p ON p.id = sl.pregnancy_id 
        WHERE sl.user_id = ? 
        ORDER BY sl.date DESC
    ");
    $slStmt->execute([$userId]);
}
$symptomLogs = $slStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

// Count summaries per pregnancy (queried directly so counts are always permanent and independent of filter)
$pregnancySummaries = [];
foreach ($pregnancies as $pr) {
    $pId = $pr['id'];
    $cntV = (int)$pdo->query("SELECT COUNT(*) FROM monitoring WHERE user_id = '{$userId}' AND pregnancy_id = '{$pId}'")->fetchColumn();
    $cntR = (int)$pdo->query("SELECT COUNT(*) FROM coopland_assessments WHERE user_id = '{$userId}' AND pregnancy_id = '{$pId}'")->fetchColumn();
    $cntS = (int)$pdo->query("SELECT COUNT(*) FROM symptom_logs WHERE user_id = '{$userId}' AND pregnancy_id = '{$pId}'")->fetchColumn();
    $pregnancySummaries[$pId] = [
        'vitals' => $cntV,
        'risk' => $cntR,
        'symptoms' => $cntS
    ];
}

render_header('Pregnancy & Health History', 'history');
?>

<div class="card" style="margin-bottom:20px;border-radius:20px;padding:24px;background:linear-gradient(135deg, #FFF5F8 0%, #FFFFFF 100%);border:1px solid #FBCFE8;">
  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
    <div style="width:52px;height:52px;border-radius:26px;background:#FCE7F3;color:#B04A6E;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 8px rgba(176,74,110,0.15);">
      <i class="fa-solid fa-clock-rotate-left"></i>
    </div>
    <div style="flex:1;min-width:240px;">
      <h1 style="font-size:22px;font-weight:800;color:#1E293B;margin:0 0 4px;">Pregnancy &amp; Health History</h1>
      <p style="font-size:13.5px;color:#64748B;margin:0;">
        Complete records of all your children, vitals trends, risk evaluations, and symptom check-ins.
      </p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-top:20px;">
    <div style="background:#FFF;border:1px solid #F1E6EC;border-radius:14px;padding:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);"><?php echo count($pregnancies); ?></div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;">Children / Pregnancies</div>
    </div>
    <div style="background:#FFF;border:1px solid #F1E6EC;border-radius:14px;padding:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#02848F;"><?php echo count($vitalsLogs); ?></div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;">Vitals Logs</div>
    </div>
    <div style="background:#FFF;border:1px solid #F1E6EC;border-radius:14px;padding:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#D97706;"><?php echo count($riskAssessments); ?></div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;">Risk Assessments</div>
    </div>
    <div style="background:#FFF;border:1px solid #F1E6EC;border-radius:14px;padding:12px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#8B5CF6;"><?php echo count($symptomLogs); ?></div>
      <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;">Symptom Logs</div>
    </div>
  </div>
</div>

<!-- Filter Selection Bar -->
<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;">
  <span style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;"><i class="fa-solid fa-filter" style="margin-right:4px;"></i> Filter by Child:</span>
  <a href="history.php?pregnancy_id=all&tab=<?php echo urlencode($activeTab); ?>" class="chip <?php echo $filterPregId==='all'?'on':''; ?>" style="text-decoration:none;font-weight:700;font-size:12px;">
    All Children / Pregnancies
  </a>
  <?php foreach ($pregnancies as $p): ?>
    <a href="history.php?pregnancy_id=<?php echo urlencode($p['id']); ?>&tab=<?php echo urlencode($activeTab); ?>" class="chip <?php echo $filterPregId===$p['id']?'on':''; ?>" style="text-decoration:none;font-weight:700;font-size:12px;">
      👶 <?php echo e($p['title'] ?: 'Pregnancy #'.$p['pregnancy_number']); ?> <?php if ($p['id']===$activePregId): ?><span style="font-size:10px;color:#15803D;">(Active)</span><?php endif; ?>
    </a>
  <?php endforeach; ?>
</div>

<!-- Tabs Bar -->
<div class="tabs" style="margin-bottom:20px;">
  <a class="tab-link <?php echo $activeTab==='children'?'active':''; ?>" href="history.php?pregnancy_id=<?php echo urlencode($filterPregId); ?>&tab=children">
    <i class="fa-solid fa-baby"></i> Children (<?php echo count($pregnancies); ?>)
  </a>
  <a class="tab-link <?php echo $activeTab==='vitals'?'active':''; ?>" href="history.php?pregnancy_id=<?php echo urlencode($filterPregId); ?>&tab=vitals">
    <i class="fa-solid fa-heart-pulse"></i> Vitals &amp; Trends (<?php echo count($vitalsLogs); ?>)
  </a>
  <a class="tab-link <?php echo $activeTab==='risk'?'active':''; ?>" href="history.php?pregnancy_id=<?php echo urlencode($filterPregId); ?>&tab=risk">
    <i class="fa-solid fa-shield-halved"></i> Risk Assessments (<?php echo count($riskAssessments); ?>)
  </a>
  <a class="tab-link <?php echo $activeTab==='symptoms'?'active':''; ?>" href="history.php?pregnancy_id=<?php echo urlencode($filterPregId); ?>&tab=symptoms">
    <i class="fa-solid fa-notes-medical"></i> Symptom Check-ins (<?php echo count($symptomLogs); ?>)
  </a>
</div>

<!-- TAB 1: CHILDREN / PREGNANCIES -->
<?php if ($activeTab === 'children'): ?>
  <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">
    <?php if (empty($pregnancies)): ?>
      <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;">
        <i class="fa-solid fa-heart" style="font-size:36px;color:#CBD5E1;margin-bottom:12px;"></i>
        <div style="font-size:16px;font-weight:700;color:#1E293B;">No Pregnancies on Record</div>
        <div class="muted" style="margin-top:6px;">You haven't recorded any pregnancies yet.</div>
      </div>
    <?php else: ?>
      <?php foreach ($pregnancies as $p): 
        $isActive = $p['id'] === $activePregId;
        $isCompleted = $p['status'] === 'completed';
        $sum = $pregnancySummaries[$p['id']] ?? ['vitals'=>0,'risk'=>0,'symptoms'=>0];
      ?>
        <div class="card" style="border-radius:18px;border:1.5px solid <?php echo $isActive?'var(--primary)':'var(--border)'; ?>;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:38px;height:38px;border-radius:50%;background:#FCE7F3;color:#B04A6E;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">
                #<?php echo e($p['pregnancy_number']); ?>
              </div>
              <div>
                <h3 style="font-size:16px;font-weight:800;color:#1E293B;margin:0;"><?php echo e($p['title'] ?: 'Pregnancy #'.$p['pregnancy_number']); ?></h3>
                <div class="muted" style="font-size:11.5px;">Recorded <?php echo e(fmt_date($p['created_at'])); ?></div>
              </div>
            </div>
            <span class="badge" style="<?php echo $isActive?'background:#DCFCE7;color:#15803D;':($isCompleted?'background:#E0F2FE;color:#0369A1;':'background:#F1F5F9;color:#64748B;'); ?>font-weight:700;">
              <?php echo $isActive ? 'Active' : ($isCompleted ? 'Delivered' : 'Archived'); ?>
            </span>
          </div>

          <div style="margin:12px 0;font-size:12.5px;color:#475569;display:flex;flex-direction:column;gap:4px;">
            <?php if (!empty($p['edd'])): ?>
              <div><i class="fa-solid fa-calendar-day" style="color:var(--primary);width:18px;"></i> <strong>EDD:</strong> <?php echo e(fmt_date($p['edd'])); ?></div>
            <?php endif; ?>
            <?php if (!empty($p['delivery_date'])): ?>
              <div><i class="fa-solid fa-gift" style="color:#02848F;width:18px;"></i> <strong>Delivered:</strong> <?php echo e(fmt_date($p['delivery_date'])); ?></div>
            <?php endif; ?>
            <?php if (!empty($p['notes'])): ?>
              <div style="margin-top:6px;font-style:italic;background:#F8FAFC;padding:8px 10px;border-radius:8px;">
                "<?php echo e($p['notes']); ?>"
              </div>
            <?php endif; ?>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin:14px 0 16px;text-align:center;">
            <div style="background:#F8FAFC;border-radius:8px;padding:6px;">
              <div style="font-weight:800;font-size:14px;color:#02848F;"><?php echo $sum['vitals']; ?></div>
              <div class="muted" style="font-size:10.5px;font-weight:600;">Vitals</div>
            </div>
            <div style="background:#F8FAFC;border-radius:8px;padding:6px;">
              <div style="font-weight:800;font-size:14px;color:#D97706;"><?php echo $sum['risk']; ?></div>
              <div class="muted" style="font-size:10.5px;font-weight:600;">Assessments</div>
            </div>
            <div style="background:#F8FAFC;border-radius:8px;padding:6px;">
              <div style="font-weight:800;font-size:14px;color:#8B5CF6;"><?php echo $sum['symptoms']; ?></div>
              <div class="muted" style="font-size:10.5px;font-weight:600;">Symptoms</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <a href="history.php?pregnancy_id=<?php echo urlencode($p['id']); ?>&tab=vitals" class="btn btn-primary btn-sm btn-block" style="text-decoration:none;">
              <i class="fa-solid fa-chart-line"></i> View Child Records
            </a>
            <?php if (!$isActive): ?>
              <form method="post" action="history.php" style="margin:0;">
                <input type="hidden" name="action" value="switch_pregnancy">
                <input type="hidden" name="pregnancy_id" value="<?php echo e($p['id']); ?>">
                <input type="hidden" name="current_filter" value="<?php echo e($filterPregId); ?>">
                <button type="submit" class="btn btn-outline btn-sm" title="Set this as current active pregnancy">
                  Make Active
                </button>
              </form>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>

<!-- TAB 2: VITALS & TRENDS -->
<?php elseif ($activeTab === 'vitals'): ?>
  <!-- Trends Summary -->
  <div class="card" style="margin-bottom:20px;">
    <div class="eyebrow" style="margin-bottom:12px;">Vitals Trend Insights &bull; <?php echo $filterPregId==='all'?'All Children':'Filtered Child'; ?></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px;">
      <div style="background:#F8FAFC;border-radius:12px;padding:12px 14px;border:1px solid #E2E8F0;">
        <div class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;">Total Readings</div>
        <div style="font-size:20px;font-weight:800;color:var(--text);margin-top:2px;"><?php echo count($vitalsLogs); ?> entries</div>
      </div>
      <div style="background:#F8FAFC;border-radius:12px;padding:12px 14px;border:1px solid #E2E8F0;">
        <div class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;">Latest Reading</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:4px;">
          <?php echo !empty($vitalsLogs[0]) ? e(fmt_datetime($vitalsLogs[0]['date'])) : '—'; ?>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="eyebrow" style="margin-bottom:12px;">Complete Vitals Log (<?php echo count($vitalsLogs); ?>)</div>
    <?php if (empty($vitalsLogs)): ?>
      <div class="empty"><i class="fa-solid fa-heart-pulse"></i> No vitals logged yet for this selection.</div>
    <?php else: ?>
      <div style="overflow-x:auto;">
        <table class="table" style="width:100%;font-size:13px;">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Child / Pregnancy</th>
              <th>Blood Pressure</th>
              <th>Heart Rate</th>
              <th>Blood Sugar</th>
              <th>Weight</th>
              <th>Fetal Movement</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($vitalsLogs as $v): 
              $sys = (int)$v['bp_sys'];
              $dia = (int)$v['bp_dia'];
              $isHigh = ($sys >= 140 || $dia >= 90);
              $isElevated = (($sys >= 120 && $sys < 140) || ($dia >= 80 && dia < 90));
            ?>
              <tr>
                <td><strong><?php echo e(fmt_datetime($v['date'])); ?></strong></td>
                <td><span class="badge" style="background:#FCE7F3;color:#B04A6E;">👶 <?php echo e($v['pregnancy_title'] ?: 'Pregnancy'); ?></span></td>
                <td>
                  <?php if ($sys && $dia): ?>
                    <span class="badge <?php echo $isHigh ? 'badge-danger' : ($isElevated ? 'badge-warning' : 'badge-success'); ?>">
                      <?php echo "{$sys}/{$dia} mmHg"; ?>
                    </span>
                  <?php else: ?>
                    <span class="muted">—</span>
                  <?php endif; ?>
                </td>
                <td><?php echo !empty($v['heart_rate']) ? e($v['heart_rate']).' bpm' : '—'; ?></td>
                <td><?php echo !empty($v['blood_sugar']) ? e($v['blood_sugar']).' mg/dL' : '—'; ?></td>
                <td><?php echo !empty($v['weight_kg']) ? e($v['weight_kg']).' kg' : '—'; ?></td>
                <td><?php echo $v['fetal_movement'] !== null ? e($v['fetal_movement']).' kicks' : '—'; ?></td>
                <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?php echo e($v['notes'] ?: '—'); ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </div>

<!-- TAB 3: RISK ASSESSMENTS -->
<?php elseif ($activeTab === 'risk'): ?>
  <?php if (!empty($clinicalVisits)): ?>
    <div class="card" style="margin-bottom:20px;">
      <div class="eyebrow" style="margin-bottom:12px;"><i class="fa-solid fa-hospital-user" style="color:var(--teal);margin-right:6px;"></i>Attended Doctor Consultations (<?php echo count($clinicalVisits); ?>)</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <?php foreach ($clinicalVisits as $cv): ?>
          <div style="background:var(--bg-soft);border-radius:10px;padding:12px 14px;border:1px solid var(--border);font-size:13px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong><i class="fa-solid fa-hospital" style="color:var(--teal);margin-right:6px;"></i><?php echo e($cv['facility'] ?: 'Hospital / OB-GYN Clinic'); ?></strong>
                <span class="muted" style="margin-left:8px;font-size:12px;">Dr. <?php echo e($cv['doctor'] ?: 'Attending Physician'); ?> &bull; <?php echo e(fmt_date($cv['visit_date'])); ?></span>
              </div>
              <span class="badge" style="background:#e6fffa;color:#0d9488;border:1px solid #99f6e4;">Attended &amp; Resolved</span>
            </div>
            <?php if (!empty($cv['notes'])): ?>
              <div style="font-size:12.5px;margin-top:5px;color:var(--ink-soft);font-style:italic;">
                "<?php echo e($cv['notes']); ?>"
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endif; ?>

  <div class="card">
    <div class="eyebrow" style="margin-bottom:12px;">Coopland Risk Assessments (<?php echo count($riskAssessments); ?>)</div>
    <?php if (empty($riskAssessments)): ?>
      <div class="empty"><i class="fa-solid fa-shield-halved"></i> No risk assessments recorded yet for this selection.</div>
    <?php else: ?>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <?php foreach ($riskAssessments as $ra): 
          $lvl = strtolower($ra['risk_level']);
          $isSev = strpos($lvl, 'severe') !== false;
          $isHi = strpos($lvl, 'high') !== false || strpos($lvl, 'mod') !== false;
          $badgeCls = $isSev ? 'badge-danger' : ($isHi ? 'badge-warning' : 'badge-success');
          $factors = json_decode($ra['factors_json'] ?? '[]', true) ?: [];
        ?>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="font-size:14px;"><?php echo e(fmt_datetime($ra['date'])); ?></strong>
                <span class="badge" style="background:#FCE7F3;color:#B04A6E;margin-left:8px;">👶 <?php echo e($ra['pregnancy_title'] ?: 'Pregnancy'); ?></span>
              </div>
              <span class="badge <?php echo $badgeCls; ?>" style="font-size:12px;font-weight:800;padding:5px 10px;">
                <?php echo e(ucfirst($ra['risk_level'])); ?> Risk &bull; Score: <?php echo e($ra['score']); ?>
              </span>
            </div>
            <?php if (!empty($factors)): ?>
              <div style="margin-top:10px;">
                <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;margin-bottom:4px;">Contributing Factors:</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                  <?php foreach ($factors as $f): ?>
                    <span class="badge" style="background:#FFFFFF;border:1px solid #CBD5E1;font-size:11.5px;color:#334155;">
                      <i class="fa-solid fa-circle-exclamation" style="margin-right:4px;color:<?php echo $isSev?'#DC2626':($isHi?'#D97706':'#15803D'); ?>;"></i><?php echo e($f); ?>
                    </span>
                  <?php endforeach; ?>
                </div>
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>

<!-- TAB 4: SYMPTOM CHECK-INS -->
<?php elseif ($activeTab === 'symptoms'): ?>
  <div class="card">
    <div class="eyebrow" style="margin-bottom:12px;">Logged Symptoms History (<?php echo count($symptomLogs); ?> check-ins)</div>
    <?php if (empty($symptomLogs)): ?>
      <div class="empty"><i class="fa-solid fa-notes-medical"></i> No symptom check-ins recorded yet for this selection.</div>
    <?php else: ?>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <?php foreach ($symptomLogs as $sl): 
          $itemsStmt = $pdo->prepare("SELECT sli.*, sc.name FROM symptom_log_items sli LEFT JOIN symptom_catalog sc ON sc.id = sli.symptom_id WHERE sli.symptom_log_id = ? AND sli.severity != 'None'");
          $itemsStmt->execute([$sl['id']]);
          $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        ?>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <strong style="font-size:14px;"><?php echo e(fmt_datetime($sl['date'])); ?></strong>
                <span class="badge" style="background:#FCE7F3;color:#B04A6E;margin-left:8px;">👶 <?php echo e($sl['pregnancy_title'] ?: 'Pregnancy'); ?></span>
              </div>
              <span class="badge" style="background:#EDE9FE;color:#7C3AED;font-weight:700;">
                <?php echo count($items); ?> <?php echo count($items)===1?'Symptom':'Symptoms'; ?>
              </span>
            </div>

            <?php if (!empty($items)): ?>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:6px;margin-top:8px;">
                <?php foreach ($items as $it): 
                  $sev = strtolower($it['severity'] ?? '');
                  $isSev = strpos($sev, 'severe') !== false;
                  $isMod = strpos($sev, 'mod') !== false;
                  $sevColor = $isSev ? '#DC2626' : ($isMod ? '#D97706' : '#2563EB');
                  $sevBg = $isSev ? '#FEE2E2' : ($isMod ? '#FEF3C7' : '#EFF6FF');
                ?>
                  <div style="background:#FFF;border:1px solid #E2E8F0;border-radius:8px;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <div style="font-weight:700;font-size:12.5px;color:#1E293B;"><?php echo e($it['name'] ?: $it['symptom_id']); ?></div>
                      <?php if (!empty($it['duration']) || !empty($it['frequency'])): ?>
                        <div class="muted" style="font-size:11px;"><?php echo e(implode(' • ', array_filter([$it['duration'], $it['frequency']]))); ?></div>
                      <?php endif; ?>
                    </div>
                    <span class="badge" style="background:<?php echo $sevBg; ?>;color:<?php echo $sevColor; ?>;font-weight:800;font-size:10.5px;">
                      <?php echo e($it['severity']); ?>
                    </span>
                  </div>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
<?php endif; ?>

<?php
render_footer();
?>
