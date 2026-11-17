<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT height_cm FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$heightCm = (float)($stmt->fetchColumn() ?: 160);
$actPregId = get_active_pregnancy_id($pdo, $u['id']);

// Ensure required tables & columns exist
try {
    $pdo->exec("ALTER TABLE monitoring ADD COLUMN fetal_heart_rate INT NULL");
} catch (Throwable $e) {}
try {
    $pdo->exec("ALTER TABLE monitoring ADD COLUMN respiratory_rate INT NULL");
} catch (Throwable $e) {}
try {
    $pdo->exec("ALTER TABLE monitoring ADD COLUMN spo2 INT NULL");
} catch (Throwable $e) {}

$pdo->exec("CREATE TABLE IF NOT EXISTS prenatal_laboratories (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  date DATETIME NOT NULL,
  lab_type VARCHAR(30) NOT NULL DEFAULT 'initial',
  cbc_hemoglobin DECIMAL(5,2) NULL,
  cbc_hematocrit DECIMAL(5,2) NULL,
  cbc_wbc DECIMAL(6,2) NULL,
  cbc_platelets INT NULL,
  blood_type VARCHAR(10) NULL,
  rh_factor VARCHAR(15) NULL,
  urinalysis_protein VARCHAR(20) NULL,
  urinalysis_glucose VARCHAR(20) NULL,
  urinalysis_ketones VARCHAR(20) NULL,
  blood_glucose DECIMAL(6,2) NULL,
  hiv_screening VARCHAR(20) NULL,
  syphilis_screening VARCHAR(20) NULL,
  hepb_screening VARCHAR(20) NULL,
  urine_culture VARCHAR(80) NULL,
  other_tests TEXT NULL,
  ultrasound_notes TEXT NULL,
  fetal_heart_rate INT NULL,
  fundal_height_cm DECIMAL(5,1) NULL,
  fetal_movement INT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $action = $_POST['action'] ?? 'save_vitals';

    if ($action === 'save_laboratory') {
        $labId = uid('lab');
        $labDate = !empty($_POST['date']) ? $_POST['date'] : now_iso();
        if (strlen($labDate) === 10) {
            $labDate .= ' ' . date('H:i:s');
        }
        $bloodType = trim($_POST['blood_type'] ?? '');
        $rhFactor = trim($_POST['rh_factor'] ?? '');
        $cbcHb = !empty($_POST['cbc_hemoglobin']) ? (float)$_POST['cbc_hemoglobin'] : null;
        $cbcHct = !empty($_POST['cbc_hematocrit']) ? (float)$_POST['cbc_hematocrit'] : null;
        $cbcWbc = !empty($_POST['cbc_wbc']) ? (float)$_POST['cbc_wbc'] : null;
        $cbcPlt = !empty($_POST['cbc_platelets']) ? (int)$_POST['cbc_platelets'] : null;
        $urinProt = trim($_POST['urinalysis_protein'] ?? '');
        $urinGlu = trim($_POST['urinalysis_glucose'] ?? '');
        $urinKet = trim($_POST['urinalysis_ketones'] ?? '');
        $bloodGlu = !empty($_POST['blood_glucose']) ? (float)$_POST['blood_glucose'] : null;
        $hiv = trim($_POST['hiv_screening'] ?? '');
        $syphilis = trim($_POST['syphilis_screening'] ?? '');
        $hepb = trim($_POST['hepb_screening'] ?? '');
        $notes = trim($_POST['notes'] ?? '');

        $stmt = $pdo->prepare("INSERT INTO prenatal_laboratories (
            id, user_id, pregnancy_id, date, lab_type,
            cbc_hemoglobin, cbc_hematocrit, cbc_wbc, cbc_platelets,
            blood_type, rh_factor,
            urinalysis_protein, urinalysis_glucose, urinalysis_ketones,
            blood_glucose, hiv_screening, syphilis_screening, hepb_screening,
            notes, created_at
        ) VALUES (?, ?, ?, ?, 'initial', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $labId, $u['id'], $actPregId, $labDate,
            $cbcHb, $cbcHct, $cbcWbc, $cbcPlt,
            $bloodType ?: null, $rhFactor ?: null,
            $urinProt ?: null, $urinGlu ?: null, $urinKet ?: null,
            $bloodGlu,
            $hiv ?: null, $syphilis ?: null, $hepb ?: null,
            $notes ?: null, now_iso()
        ]);

        flash('Initial laboratory results recorded successfully in Initial Lab Folder.', 'success');
        redirect('monitoring.php?folder=initial_lab');
    }

    if ($action === 'save_vitals') {
        $weight = !empty($_POST['weight_kg']) ? (float)$_POST['weight_kg'] : null;
        $bmi = ($weight && $heightCm) ? bmi_of($weight, $heightCm) : null;
        $bpSys = !empty($_POST['bp_sys']) ? (int)$_POST['bp_sys'] : null;
        $bpDia = !empty($_POST['bp_dia']) ? (int)$_POST['bp_dia'] : null;
        $tempVal = !empty($_POST['temp']) ? (float)$_POST['temp'] : null;
        $hrVal = !empty($_POST['heart_rate']) ? (int)$_POST['heart_rate'] : null;
        $respRate = !empty($_POST['respiratory_rate']) ? (int)$_POST['respiratory_rate'] : null;
        $spo2 = !empty($_POST['spo2']) ? (int)$_POST['spo2'] : null;
        $sugarVal = !empty($_POST['blood_sugar']) ? (int)$_POST['blood_sugar'] : null;
        $hemoVal = !empty($_POST['hemoglobin']) ? (float)$_POST['hemoglobin'] : null;
        $fetalHr = !empty($_POST['fetal_heart_rate']) ? (int)$_POST['fetal_heart_rate'] : null;
        $fetalMvmt = isset($_POST['fetal_movement']) && $_POST['fetal_movement'] !== '' ? (int)$_POST['fetal_movement'] : null;
        $sleep = !empty($_POST['sleep_hours']) ? (float)$_POST['sleep_hours'] : null;
        $water = !empty($_POST['water_intake']) ? (int)$_POST['water_intake'] : null;
        $mood = trim($_POST['mood'] ?? '');
        $activity = trim($_POST['activity'] ?? '');
        $vDate = !empty($_POST['date']) ? $_POST['date'] : now_iso();
        if (strlen($vDate) === 10) {
            $vDate .= ' ' . date('H:i:s');
        }

        $stmt = $pdo->prepare("INSERT INTO monitoring
            (id, user_id, pregnancy_id, date, bp_sys, bp_dia, weight_kg, bmi, hemoglobin, blood_sugar, temp, heart_rate, respiratory_rate, spo2, fetal_movement, fetal_heart_rate, sleep_hours, water_intake, mood, activity)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            uid('mon'), $u['id'], $actPregId, $vDate,
            $bpSys, $bpDia, $weight, $bmi,
            $hemoVal, $sugarVal, $tempVal,
            $hrVal, $respRate, $spo2, $fetalMvmt, $fetalHr,
            $sleep, $water,
            $mood ?: null, $activity ?: null
        ]);

        // Recalculate Risk Assessment if BP or sugar given
        if ($bpSys && $bpDia) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
                $stmt->execute([$u['id']]);
                $profile = $stmt->fetch() ?: [];

                $riskHistory = get_risk_history($pdo, $u['id']);
                $riskHistory['prev_cesarean'] = !empty($profile['prior_csection']);
                $pp = get_latest_pregnancy_problems($pdo, $u['id']);
                $catalog = get_symptom_catalog();
                $ruleBase = get_rule_base();

                $age = $profile['age'] ?? 28;
                $trimester = 2;
                if (!empty($profile['lmp'])){
                    $weeks = floor((time() - strtotime($profile['lmp'])) / (7*86400));
                    $trimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
                }

                if ($actPregId) {
                    $stmt = $pdo->prepare("SELECT sli.symptom_id as id, sli.severity, sli.duration, sli.frequency
                                           FROM symptom_logs sl
                                           JOIN symptom_log_items sli ON sl.id = sli.symptom_log_id
                                           WHERE sl.user_id = ? AND sl.pregnancy_id = ? ORDER BY sl.date DESC LIMIT 30");
                    $stmt->execute([$u['id'], $actPregId]);
                } else {
                    $stmt = $pdo->prepare("SELECT sli.symptom_id as id, sli.severity, sli.duration, sli.frequency
                                           FROM symptom_logs sl
                                           JOIN symptom_log_items sli ON sl.id = sli.symptom_log_id
                                           WHERE sl.user_id = ? ORDER BY sl.date DESC LIMIT 30");
                    $stmt->execute([$u['id']]);
                }
                $latestSymptoms = $stmt->fetchAll() ?: [];

                $engineInput = [
                    'user_id' => $u['id'],
                    'age' => (int)$age,
                    'trimester' => $trimester,
                    'bp_sys' => $bpSys,
                    'bp_dia' => $bpDia,
                    'temp' => $tempVal ?: 36.8,
                    'heart_rate' => $hrVal ?: 78,
                    'blood_sugar' => $sugarVal ?: 95,
                    'glucose_timing' => 'preprandial',
                    'bmi' => $bmi ?: 22,
                    'hemoglobin' => $hemoVal ?: 12.0,
                    'riskHistory' => $riskHistory,
                    'pregnancyProblems' => $pp,
                    'symptoms' => $latestSymptoms,
                ];

                $result = assess_risk($engineInput, $ruleBase, $catalog, $pdo);
                $asmId = uid('asm');
                $pdo->prepare("INSERT INTO assessments (id, user_id, pregnancy_id, date, score, level, weighted_score, centroid, ahp_json, fuzzy_json, rules_json, recommendations_json)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
                    ->execute([
                        $asmId, $u['id'], $actPregId, now_iso(), $result['score'], $result['level'],
                        $result['structural']['total'], $result['fuzzy']['centroid'],
                        json_encode($result['structural']), json_encode($result['fuzzy']),
                        json_encode($result['main_contributors']), json_encode($result['recommendations']),
                    ]);
            } catch (Throwable $e) {}
        }

        flash('Daily vitals recorded successfully in Daily Vitals Folder.', 'success');
        redirect('monitoring.php?folder=vitals');
    }
}

// Fetch Daily Vitals
if ($actPregId) {
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 60");
    $stmt->execute([$u['id'], $actPregId]);
} else {
    $stmt = $pdo->prepare("SELECT * FROM monitoring WHERE user_id = ? ORDER BY date DESC LIMIT 60");
    $stmt->execute([$u['id']]);
}
$vitals = $stmt->fetchAll();

// Fetch Initial Laboratories
if ($actPregId) {
    $stmt = $pdo->prepare("SELECT * FROM prenatal_laboratories WHERE user_id = ? AND pregnancy_id = ? ORDER BY date DESC LIMIT 60");
    $stmt->execute([$u['id'], $actPregId]);
} else {
    $stmt = $pdo->prepare("SELECT * FROM prenatal_laboratories WHERE user_id = ? ORDER BY date DESC LIMIT 60");
    $stmt->execute([$u['id']]);
}
$labs = $stmt->fetchAll();

// Combine and sort chronologically descending
$combined = [];
foreach ($vitals as $v) {
    $v['_kind'] = 'vital';
    $combined[] = $v;
}
foreach ($labs as $l) {
    $l['_kind'] = 'lab';
    $combined[] = $l;
}
usort($combined, function($a, $b) {
    return strcmp($b['date'], $a['date']);
});

// Compute Stats
$bpSysArr = [];
$bpDiaArr = [];
$sugarArr = [];
foreach ($vitals as $v) {
    if (!empty($v['bp_sys'])) $bpSysArr[] = (int)$v['bp_sys'];
    if (!empty($v['bp_dia'])) $bpDiaArr[] = (int)$v['bp_dia'];
    if (!empty($v['blood_sugar'])) $sugarArr[] = (int)$v['blood_sugar'];
}
$avgBp = count($bpSysArr) ? round(array_sum($bpSysArr)/count($bpSysArr)) . '/' . round(array_sum($bpDiaArr)/count($bpDiaArr)) : '—';
$avgSugar = count($sugarArr) ? (string)round(array_sum($sugarArr)/count($sugarArr)) : '—';
$totalLogs = count($vitals) + count($labs);

$defaultFolder = $_GET['folder'] ?? 'all';
$trends = compute_vitals_trends($pdo, $u['id'], $actPregId);

function render_trend_analysis_chart_svg($items, $metric = 'bp') {
    if (empty($items)) {
        return '<div style="text-align:center;padding:36px 12px;color:#94a3b8;font-size:13px;background:#f8fafc;border-radius:14px;margin-bottom:14px;">
          <i class="fa-regular fa-chart-line" style="font-size:28px;margin-bottom:6px;display:block;color:#cbd5e1;"></i>
          No readings logged yet in this timeframe.
        </div>';
    }

    $n = count($items);
    $svgW = 540;
    $svgH = 220;
    $plotLeft = 46;
    $plotRight = 410;
    $plotTop = 22;
    $plotBottom = 180;
    $plotW = $plotRight - $plotLeft;
    $plotH = $plotBottom - $plotTop;

    if ($metric === 'bp') {
        $sysArr = [];
        $diaArr = [];
        foreach ($items as $it) {
            if (!empty($it['avg_sys'])) $sysArr[] = (int)$it['avg_sys'];
            if (!empty($it['avg_dia'])) $diaArr[] = (int)$it['avg_dia'];
        }
        $minVal = count($diaArr) ? min($diaArr) : 60;
        $maxVal = count($sysArr) ? max($sysArr) : 140;
        $yMin = max(40, (int)(floor(($minVal - 10) / 20) * 20));
        $yMax = max(160, (int)(ceil(($maxVal + 10) / 20) * 20));
        if ($yMax - $yMin < 60) { $yMin = 60; $yMax = 160; }
        $step = ($yMax - $yMin > 120) ? 30 : 20;
    } else {
        $wtArr = [];
        foreach ($items as $it) {
            if (!empty($it['avg_weight'])) $wtArr[] = (float)$it['avg_weight'];
        }
        $minVal = count($wtArr) ? min($wtArr) : 50;
        $maxVal = count($wtArr) ? max($wtArr) : 70;
        $yMin = max(30, (int)(floor(($minVal - 3) / 5) * 5));
        $yMax = (int)(ceil(($maxVal + 3) / 5) * 5);
        if ($yMax - $yMin < 15) { $yMin = max(30, $yMin - 5); $yMax += 10; }
        $step = 5;
    }

    $yTicks = [];
    for ($v = $yMin; $v <= $yMax; $v += $step) {
        $yTicks[] = $v;
    }

    $getY = function($val) use ($yMin, $yMax, $plotTop, $plotBottom, $plotH) {
        if ($yMax == $yMin) return ($plotTop + $plotBottom) / 2;
        $ratio = ($val - $yMin) / ($yMax - $yMin);
        return $plotBottom - ($ratio * $plotH);
    };

    $getX = function($idx) use ($n, $plotLeft, $plotW) {
        if ($n <= 1) return $plotLeft + ($plotW / 2);
        return $plotLeft + (($idx / ($n - 1)) * $plotW);
    };

    $out = '<div style="width:100%;overflow-x:auto;padding-bottom:4px;margin-bottom:14px;">';
    $out .= '<svg viewBox="0 0 540 220" style="width:100%;min-width:320px;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">';
    
    // 1. Horizontal grid lines & Y labels
    foreach ($yTicks as $tick) {
        $y = $getY($tick);
        $out .= '<line x1="' . $plotLeft . '" y1="' . $y . '" x2="' . ($plotRight + 20) . '" y2="' . $y . '" stroke="#E2E8F0" stroke-width="1.2" />';
        $out .= '<text x="' . ($plotLeft - 8) . '" y="' . ($y + 4) . '" text-anchor="end" font-size="11" font-weight="600" fill="#64748B">' . $tick . '</text>';
    }

    // 2. Base X axis line
    $out .= '<line x1="' . $plotLeft . '" y1="' . $plotBottom . '" x2="' . ($plotRight + 20) . '" y2="' . $plotBottom . '" stroke="#94A3B8" stroke-width="1.8" />';

    // 3. X labels
    for ($i = 0; $i < $n; $i++) {
        $x = $getX($i);
        $lbl = $items[$i]['short_label'] ?? $items[$i]['period'] ?? '';
        $out .= '<text x="' . $x . '" y="' . ($plotBottom + 18) . '" text-anchor="middle" font-size="11" font-weight="600" fill="#64748B">' . htmlspecialchars($lbl) . '</text>';
    }

    if ($metric === 'bp') {
        $sysPoints = [];
        $diaPoints = [];
        $lastSysPt = null;
        $lastDiaPt = null;

        for ($i = 0; $i < $n; $i++) {
            $x = $getX($i);
            if (!empty($items[$i]['avg_sys'])) {
                $y = $getY($items[$i]['avg_sys']);
                $sysPoints[] = [$x, $y, $items[$i]['avg_sys']];
                $lastSysPt = [$x, $y, $items[$i]['avg_sys']];
            }
            if (!empty($items[$i]['avg_dia'])) {
                $y = $getY($items[$i]['avg_dia']);
                $diaPoints[] = [$x, $y, $items[$i]['avg_dia']];
                $lastDiaPt = [$x, $y, $items[$i]['avg_dia']];
            }
        }

        // Draw Diastolic line & dots (#02848F)
        if (count($diaPoints) > 1) {
            $ptsStr = implode(' ', array_map(function($p) { return round($p[0],1) . ',' . round($p[1],1); }, $diaPoints));
            $out .= '<polyline fill="none" stroke="#02848F" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="' . $ptsStr . '" />';
        } elseif (count($diaPoints) === 1) {
            $p = $diaPoints[0];
            $out .= '<line x1="' . $plotLeft . '" y1="' . round($p[1],1) . '" x2="' . ($plotRight + 10) . '" y2="' . round($p[1],1) . '" stroke="#02848F" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />';
        }
        foreach ($diaPoints as $p) {
            $isHigh = ($p[2] >= 90);
            $cColor = $isHigh ? '#DC2626' : '#02848F';
            $out .= '<circle cx="' . round($p[0],1) . '" cy="' . round($p[1],1) . '" r="5.5" fill="' . $cColor . '" stroke="#FFFFFF" stroke-width="2" />';
        }

        // Draw Systolic line & dots (#246944)
        if (count($sysPoints) > 1) {
            $ptsStr = implode(' ', array_map(function($p) { return round($p[0],1) . ',' . round($p[1],1); }, $sysPoints));
            $out .= '<polyline fill="none" stroke="#246944" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="' . $ptsStr . '" />';
        } elseif (count($sysPoints) === 1) {
            $p = $sysPoints[0];
            $out .= '<line x1="' . $plotLeft . '" y1="' . round($p[1],1) . '" x2="' . ($plotRight + 10) . '" y2="' . round($p[1],1) . '" stroke="#246944" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />';
        }
        foreach ($sysPoints as $p) {
            $isHigh = ($p[2] >= 140);
            $cColor = $isHigh ? '#DC2626' : '#246944';
            $out .= '<circle cx="' . round($p[0],1) . '" cy="' . round($p[1],1) . '" r="5.5" fill="' . $cColor . '" stroke="#FFFFFF" stroke-width="2" />';
        }

        // End Callouts
        if ($lastSysPt) {
            $isHigh = ($lastSysPt[2] >= 140);
            $col = $isHigh ? '#DC2626' : '#246944';
            $out .= '<text x="' . round($lastSysPt[0] + 8, 1) . '" y="' . round($lastSysPt[1] + 4, 1) . '" fill="' . $col . '" font-size="13" font-weight="800">' . $lastSysPt[2] . ' mmHg</text>';
        }
        if ($lastDiaPt) {
            $isHigh = ($lastDiaPt[2] >= 90);
            $col = $isHigh ? '#DC2626' : '#02848F';
            $out .= '<text x="' . round($lastDiaPt[0] + 8, 1) . '" y="' . round($lastDiaPt[1] + 4, 1) . '" fill="' . $col . '" font-size="13" font-weight="800">' . $lastDiaPt[2] . ' mmHg</text>';
        }

    } else {
        $wtPoints = [];
        $lastWtPt = null;
        for ($i = 0; $i < $n; $i++) {
            $x = $getX($i);
            if (!empty($items[$i]['avg_weight'])) {
                $y = $getY($items[$i]['avg_weight']);
                $wtPoints[] = [$x, $y, $items[$i]['avg_weight']];
                $lastWtPt = [$x, $y, $items[$i]['avg_weight']];
            }
        }

        if (count($wtPoints) > 1) {
            $ptsStr = implode(' ', array_map(function($p) { return round($p[0],1) . ',' . round($p[1],1); }, $wtPoints));
            $out .= '<polyline fill="none" stroke="#246944" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="' . $ptsStr . '" />';
        } elseif (count($wtPoints) === 1) {
            $p = $wtPoints[0];
            $out .= '<line x1="' . $plotLeft . '" y1="' . round($p[1],1) . '" x2="' . ($plotRight + 10) . '" y2="' . round($p[1],1) . '" stroke="#246944" stroke-width="2" stroke-dasharray="4,4" opacity="0.6" />';
        }
        foreach ($wtPoints as $p) {
            $out .= '<circle cx="' . round($p[0],1) . '" cy="' . round($p[1],1) . '" r="5.5" fill="#246944" stroke="#FFFFFF" stroke-width="2" />';
        }

        if ($lastWtPt) {
            $out .= '<text x="' . round($lastWtPt[0] + 8, 1) . '" y="' . round($lastWtPt[1] + 4, 1) . '" fill="#246944" font-size="13" font-weight="800">' . $lastWtPt[2] . ' kg</text>';
        }
    }

    $out .= '</svg></div>';
    return $out;
}

render_header('Vital Tracking', 'monitoring');
?>

<div style="max-width:580px;margin:0 auto;width:100%;">
  <!-- Header Title -->
  <div style="margin-bottom:16px;">
    <h1 style="font-family:var(--font-display, 'Fraunces', serif);font-size:24px;font-weight:800;color:#1e293b;margin:0 0 4px;letter-spacing:-0.02em;">Vital Tracking</h1>
    <p style="font-size:13px;color:#64748b;margin:0;line-height:1.4;">Record and monitor daily vitals and prenatal laboratory tests</p>
  </div>

  <!-- Action Buttons Row -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
    <!-- Daily Vitals Button -->
    <button type="button" onclick="pcOpenDailyVitalsModal()" style="border:none;cursor:pointer;background:linear-gradient(135deg, #f472b6 0%, #db2777 50%, #b04a6e 100%);border-radius:18px;padding:14px;display:flex;align-items:center;gap:10px;text-align:left;color:#ffffff;box-shadow:0 4px 14px rgba(219,39,119,0.3);transition:transform .15s ease;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='none'">
      <div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-heart" style="color:#ffffff;font-size:16px;"></i>
      </div>
      <div style="min-width:0;flex:1;">
        <div style="font-weight:800;font-size:14.5px;color:#ffffff;line-height:1.2;">Daily Vitals</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.9);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Log BP, HR, SpO₂, Sugar</div>
      </div>
    </button>

    <!-- Initial Laboratory Button -->
    <button type="button" onclick="pcOpenLabModal()" style="border:none;cursor:pointer;background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);border-radius:18px;padding:14px;display:flex;align-items:center;gap:10px;text-align:left;color:#ffffff;box-shadow:0 4px 14px rgba(2,132,199,0.3);transition:transform .15s ease;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='none'">
      <div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fa-solid fa-flask" style="color:#ffffff;font-size:15px;"></i>
      </div>
      <div style="min-width:0;flex:1;">
        <div style="font-weight:800;font-size:14.5px;color:#ffffff;line-height:1.2;">Initial Laboratory</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.9);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">CBC, Urine, Screenings</div>
      </div>
    </button>
  </div>

  <!-- Summary Stat Tiles Strip -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px;">
    <!-- AVG BP -->
    <div style="background:#ffffff;border:1px solid #edf2f7;border-radius:18px;padding:14px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;">AVG BP</div>
      <div style="font-size:20px;font-weight:800;color:#1e293b;margin:4px 0 2px;letter-spacing:-0.02em;"><?php echo e($avgBp); ?></div>
      <div style="font-size:11px;color:#94a3b8;font-weight:600;">mmHg</div>
    </div>

    <!-- AVG SUGAR -->
    <div style="background:#ffffff;border:1px solid #edf2f7;border-radius:18px;padding:14px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;">AVG SUGAR</div>
      <div style="font-size:20px;font-weight:800;color:#1e293b;margin:4px 0 2px;letter-spacing:-0.02em;"><?php echo e($avgSugar); ?></div>
      <div style="font-size:11px;color:#94a3b8;font-weight:600;">mg/dL</div>
    </div>

    <!-- TOTAL LOGS -->
    <div style="background:#ffffff;border:1px solid #edf2f7;border-radius:18px;padding:14px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;">TOTAL LOGS</div>
      <div style="font-size:20px;font-weight:800;color:#1e293b;margin:4px 0 2px;letter-spacing:-0.02em;"><?php echo $totalLogs; ?></div>
      <div style="font-size:11px;color:#94a3b8;font-weight:600;">entries</div>
    </div>
  </div>

  <!-- Vitals Trends & Analytics Card -->
  <div class="trends-card" style="background:#ffffff;border:1px solid #edf2f7;border-radius:20px;padding:22px 18px;margin-bottom:22px;box-shadow:0 1px 4px rgba(0,0,0,0.03);">
    <!-- Centered Header matching image -->
    <div style="text-align:center;margin-bottom:12px;">
      <h2 style="font-family:var(--font-display, 'Fraunces', serif);font-size:22px;font-weight:800;color:#0f372a;margin:0 0 8px;letter-spacing:-0.02em;">Trend Analysis</h2>
      
      <!-- Dynamic Legend -->
      <div id="trendLegendBp" class="trend-legend-row" style="display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#334155;">
          <span style="display:inline-block;width:12px;height:12px;background:#246944;border-radius:2px;"></span>
          Systolic BP (mmHg)
        </div>
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#334155;">
          <span style="display:inline-block;width:12px;height:12px;background:#02848F;border-radius:2px;"></span>
          Diastolic BP (mmHg)
        </div>
      </div>

      <div id="trendLegendWeight" class="trend-legend-row" style="display:none;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#334155;">
          <span style="display:inline-block;width:12px;height:12px;background:#246944;border-radius:2px;"></span>
          Weight (kg)
        </div>
      </div>
    </div>

    <!-- Timeframe Switcher Tabs -->
    <div style="display:flex;gap:4px;background:#f1f5f9;padding:4px;border-radius:12px;margin-bottom:12px;">
      <button type="button" class="trend-tab-btn active" id="tabTrendDaily" onclick="pcSwitchTrendTimeframe('daily')">Daily Readings</button>
      <button type="button" class="trend-tab-btn" id="tabTrendWeekly" onclick="pcSwitchTrendTimeframe('weekly')">Weekly</button>
      <button type="button" class="trend-tab-btn" id="tabTrendMonthly" onclick="pcSwitchTrendTimeframe('monthly')">Monthly</button>
    </div>

    <!-- Metric Switcher Pills -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid #f1f5f9;padding-bottom:10px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;gap:6px;">
        <button type="button" class="trend-metric-btn active" id="btnMetricBp" onclick="pcSwitchTrendMetric('bp')">
          <i class="fa-solid fa-heart-pulse"></i> Blood Pressure
        </button>
        <button type="button" class="trend-metric-btn" id="btnMetricWeight" onclick="pcSwitchTrendMetric('weight')">
          <i class="fa-solid fa-weight-scale"></i> Weight
        </button>
      </div>
      <span style="font-size:11.5px;font-weight:700;color:#64748b;" id="trendActiveSummaryTitle">Daily Readings BP Trends</span>
    </div>

    <!-- ==================== PANELS ==================== -->
    <?php
      $tWeekly = $trends['weekly'] ?? [];
      $tDaily = $trends['daily'] ?? [];
      $tMonthly = $trends['monthly'] ?? [];
    ?>

    <!-- 1. WEEKLY BP PANEL -->
    <div id="trendPanel_weekly_bp" class="trend-view-panel" style="display:none;">
      <?php echo render_trend_analysis_chart_svg($tWeekly, 'bp'); ?>
    </div>

    <!-- 2. WEEKLY WEIGHT PANEL -->
    <div id="trendPanel_weekly_weight" class="trend-view-panel" style="display:none;">
      <?php echo render_trend_analysis_chart_svg($tWeekly, 'weight'); ?>
    </div>

    <!-- 3. DAILY BP PANEL -->
    <div id="trendPanel_daily_bp" class="trend-view-panel">
      <?php echo render_trend_analysis_chart_svg($tDaily, 'bp'); ?>
    </div>

    <!-- 4. DAILY WEIGHT PANEL -->
    <div id="trendPanel_daily_weight" class="trend-view-panel" style="display:none;">
      <?php echo render_trend_analysis_chart_svg($tDaily, 'weight'); ?>
    </div>

    <!-- 5. MONTHLY BP PANEL -->
    <div id="trendPanel_monthly_bp" class="trend-view-panel" style="display:none;">
      <?php echo render_trend_analysis_chart_svg($tMonthly, 'bp'); ?>
    </div>

    <!-- 6. MONTHLY WEIGHT PANEL -->
    <div id="trendPanel_monthly_weight" class="trend-view-panel" style="display:none;">
      <?php echo render_trend_analysis_chart_svg($tMonthly, 'weight'); ?>
    </div>
  </div>

  <!-- History Folders Header -->
  <div style="margin-bottom:12px;">
    <h2 style="font-family:var(--font-display, 'Fraunces', serif);font-size:18px;font-weight:800;color:#1e293b;margin:0 0 10px;">History Folders</h2>
    <div style="display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;">
      <button type="button" class="folder-pill <?php echo $defaultFolder==='all'?'active':''; ?>" onclick="pcFilterHistory('all', this)" id="pillAll">
        All Records (<?php echo count($combined); ?>)
      </button>
      <button type="button" class="folder-pill <?php echo $defaultFolder==='vitals'?'active':''; ?>" onclick="pcFilterHistory('vitals', this)" id="pillVitals">
        📁 Daily Vitals Folder (<?php echo count($vitals); ?>)
      </button>
      <button type="button" class="folder-pill <?php echo $defaultFolder==='initial_lab'?'active':''; ?>" onclick="pcFilterHistory('initial_lab', this)" id="pillLabs">
        📁 Initial Lab Folder (<?php echo count($labs); ?>)
      </button>
    </div>
  </div>

  <!-- History Cards Feed -->
  <div id="historyFeed">
    <?php if (empty($combined)): ?>
      <div style="background:#ffffff;border:1px solid #edf2f7;border-radius:20px;padding:32px 18px;text-align:center;color:#64748b;">
        <i class="fa-regular fa-folder-open" style="font-size:38px;color:#cbd5e1;margin-bottom:10px;"></i>
        <div style="font-weight:700;font-size:15px;color:#334155;">No records logged yet</div>
        <p style="font-size:12.5px;margin:6px 0 16px;">Log your first daily vitals or initial laboratory tests above.</p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" class="btn btn-sm btn-primary" onclick="pcOpenDailyVitalsModal()">+ Daily Vitals</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="pcOpenLabModal()">+ Initial Lab</button>
        </div>
      </div>
    <?php endif; ?>

    <?php foreach ($combined as $item): ?>
      <?php if ($item['_kind'] === 'vital'): ?>
        <?php
          $isHighBp = (!empty($item['bp_sys']) && (int)$item['bp_sys'] >= 140) || (!empty($item['bp_dia']) && (int)$item['bp_dia'] >= 90);
        ?>
        <div class="history-card history-vital" onclick="pcOpenDetailModal(<?php echo htmlspecialchars(json_encode($item)); ?>, 'vital')">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:#fce7f3;color:#d45d79;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;display:inline-flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-heart-pulse" style="font-size:10px;"></i> DAILY VITALS
              </span>
              <span style="color:#64748b;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                <i class="fa-regular fa-calendar" style="font-size:12px;"></i> <?php echo e($item['date']); ?>
              </span>
            </div>
            <?php if ($isHighBp): ?>
              <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;">Elevated BP</span>
            <?php endif; ?>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <?php if (!empty($item['bp_sys']) && !empty($item['bp_dia'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['bp_sys']; ?>/<?php echo (int)$item['bp_dia']; ?></div>
                <div class="metric-lbl">BP (mmHg)</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['heart_rate'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['heart_rate']; ?> bpm</div>
                <div class="metric-lbl">Heart Rate</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['respiratory_rate'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['respiratory_rate']; ?> /min</div>
                <div class="metric-lbl">Resp. Rate</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['temp'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['temp']); ?> &deg;C</div>
                <div class="metric-lbl">Temperature</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['spo2'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['spo2']; ?>%</div>
                <div class="metric-lbl">SpO₂</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['weight_kg'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['weight_kg']); ?> kg</div>
                <div class="metric-lbl">Weight</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['fetal_heart_rate'])): ?>
              <div class="metric-block">
                <div class="metric-val" style="color:#d45d79;"><?php echo (int)$item['fetal_heart_rate']; ?> bpm</div>
                <div class="metric-lbl">Fetal HR</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['blood_sugar'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['blood_sugar']; ?></div>
                <div class="metric-lbl">Sugar (mg/dL)</div>
              </div>
            <?php endif; ?>

            <?php if (isset($item['fetal_movement']) && $item['fetal_movement'] !== null && $item['fetal_movement'] !== ''): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['fetal_movement']; ?>/hr</div>
                <div class="metric-lbl">Kicks</div>
              </div>
            <?php endif; ?>
          </div>

          <?php if (!empty($item['mood']) || !empty($item['activity'])): ?>
            <div style="display:flex;gap:6px;margin-top:10px;">
              <?php if (!empty($item['mood'])): ?>
                <span style="background:#fce7f3;color:#be185d;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;">
                  😊 <?php echo e($item['mood']); ?>
                </span>
              <?php endif; ?>
              <?php if (!empty($item['activity'])): ?>
                <span style="background:#e0e7ff;color:#4338ca;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;">
                  🏃 <?php echo e($item['activity']); ?>
                </span>
              <?php endif; ?>
            </div>
          <?php endif; ?>
        </div>
      <?php else: ?>
        <!-- Initial Laboratory Card -->
        <div class="history-card history-lab" onclick="pcOpenDetailModal(<?php echo htmlspecialchars(json_encode($item)); ?>, 'lab')">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:#e0f2fe;color:#0284c7;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:0.04em;display:inline-flex;align-items:center;gap:4px;">
                <i class="fa-solid fa-flask" style="font-size:10px;"></i> INITIAL LAB
              </span>
              <span style="color:#64748b;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                <i class="fa-regular fa-calendar" style="font-size:12px;"></i> <?php echo e($item['date']); ?>
              </span>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <?php if (!empty($item['blood_type'])): ?>
              <div class="metric-block" style="background:#f0f9ff;">
                <div class="metric-val" style="color:#0284c7;"><?php echo e($item['blood_type']); ?><?php echo !empty($item['rh_factor']) ? ' ' . (strpos($item['rh_factor'], '+') !== false ? 'Rh+' : 'Rh-') : ''; ?></div>
                <div class="metric-lbl">Blood Type</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['cbc_hemoglobin'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['cbc_hemoglobin']); ?> g/dL</div>
                <div class="metric-lbl">Hemoglobin</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['cbc_platelets'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo (int)$item['cbc_platelets']; ?></div>
                <div class="metric-lbl">Platelet</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['urinalysis_protein'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['urinalysis_protein']); ?></div>
                <div class="metric-lbl">Urine Protein</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['blood_glucose'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['blood_glucose']); ?> mg/dL</div>
                <div class="metric-lbl">Fasting Sugar</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['hiv_screening'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['hiv_screening']); ?></div>
                <div class="metric-lbl">HIV Screen</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['syphilis_screening'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['syphilis_screening']); ?></div>
                <div class="metric-lbl">Syphilis</div>
              </div>
            <?php endif; ?>

            <?php if (!empty($item['hepb_screening'])): ?>
              <div class="metric-block">
                <div class="metric-val"><?php echo e($item['hepb_screening']); ?></div>
                <div class="metric-lbl">HBsAg</div>
              </div>
            <?php endif; ?>
          </div>
        </div>
      <?php endif; ?>
    <?php endforeach; ?>
  </div>
</div>

<!-- ==================== MODAL: DAILY VITALS ==================== -->
<div class="ed-modal-backdrop" id="dailyVitalsModal" style="display:none;" onclick="if(event.target===this) pcCloseDailyVitalsModal()">
  <div class="ed-modal" style="max-width:440px;border-radius:24px;padding:22px;max-height:85vh;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:#1e293b;">Log Daily Vitals</div>
        <div style="font-size:12px;color:#64748b;">Record your physiological measurements</div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseDailyVitalsModal()"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <form method="post" action="monitoring.php">
      <input type="hidden" name="action" value="save_vitals">

      <!-- OB-GYN Checkup / Visit Date -->
      <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:14px;padding:12px;margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#9d174d;display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <i class="fa-regular fa-calendar" style="color:#db2777;"></i> OB-GYN Checkup / Visit Date
        </label>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px;">Choose the date you visited the clinic or took your vitals</div>
        <input type="date" name="date" value="<?php echo date('Y-m-d'); ?>" required style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13.5px;font-weight:600;background:#ffffff;color:#1e293b;">
      </div>
      
      <div style="font-size:11.5px;font-weight:800;color:#b04a6e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Blood Pressure &amp; Heart</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Systolic (mmHg)</label>
          <input type="number" name="bp_sys" placeholder="e.g. 118" min="60" max="240">
        </div>
        <div class="field" style="margin:0;">
          <label>Diastolic (mmHg)</label>
          <input type="number" name="bp_dia" placeholder="e.g. 76" min="40" max="150">
        </div>
      </div>

      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Heart Rate (bpm)</label>
          <input type="number" name="heart_rate" placeholder="e.g. 78" min="40" max="200">
        </div>
        <div class="field" style="margin:0;">
          <label>Respiratory Rate (/min)</label>
          <input type="number" name="respiratory_rate" placeholder="e.g. 18" min="8" max="40">
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#b04a6e;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Body Temperature &amp; Oxygen</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Temperature (&deg;C)</label>
          <input type="number" step="0.1" name="temp" placeholder="e.g. 36.8" min="34" max="43">
        </div>
        <div class="field" style="margin:0;">
          <label>SpO₂ (%)</label>
          <input type="number" name="spo2" placeholder="e.g. 98" min="70" max="100">
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#b04a6e;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Weight &amp; Metabolism</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Weight (kg)</label>
          <input type="number" step="0.1" name="weight_kg" placeholder="e.g. 62.5" min="30" max="200">
        </div>
        <div class="field" style="margin:0;">
          <label>Blood Sugar (mg/dL)</label>
          <input type="number" name="blood_sugar" placeholder="e.g. 95" min="40" max="400">
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#b04a6e;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Fetal Monitoring</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Fetal Heart Rate (bpm)</label>
          <input type="number" name="fetal_heart_rate" placeholder="e.g. 145" min="80" max="200">
        </div>
        <div class="field" style="margin:0;">
          <label>Kicks per Hour</label>
          <input type="number" name="fetal_movement" placeholder="e.g. 8" min="0" max="50">
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#b04a6e;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Wellness &amp; Sleep</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:14px;">
        <div class="field" style="margin:0;">
          <label>Mood</label>
          <select name="mood">
            <option value="">Select mood...</option>
            <option>Good</option>
            <option>Okay</option>
            <option>Tired</option>
            <option>Anxious</option>
            <option>Low</option>
          </select>
        </div>
        <div class="field" style="margin:0;">
          <label>Activity</label>
          <select name="activity">
            <option value="">Select activity...</option>
            <option>Resting</option>
            <option>Light</option>
            <option>Moderate</option>
            <option>Active</option>
          </select>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-block" style="background:linear-gradient(135deg, #f472b6 0%, #db2777 50%, #b04a6e 100%);border:none;border-radius:14px;padding:12px;font-weight:700;font-size:15px;margin-top:6px;">
        <i class="fa-solid fa-floppy-disk"></i> Save Daily Vitals
      </button>
    </form>
  </div>
</div>

<!-- ==================== MODAL: INITIAL LABORATORY ==================== -->
<div class="ed-modal-backdrop" id="initialLabModal" style="display:none;" onclick="if(event.target===this) pcCloseLabModal()">
  <div class="ed-modal" style="max-width:440px;border-radius:24px;padding:22px;max-height:85vh;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:800;color:#1e293b;">Initial Laboratory</div>
        <div style="font-size:12px;color:#64748b;">Record CBC, urinalysis &amp; screenings</div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseLabModal()"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <form method="post" action="monitoring.php">
      <input type="hidden" name="action" value="save_laboratory">

      <!-- OB-GYN Checkup / Visit Date -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:12px;margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#0369a1;display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <i class="fa-regular fa-calendar" style="color:#0284c7;"></i> OB-GYN Checkup / Visit Date
        </label>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px;">Choose the date you went to the OB-GYN for laboratory checkup</div>
        <input type="date" name="date" value="<?php echo date('Y-m-d'); ?>" required style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13.5px;font-weight:600;background:#ffffff;color:#1e293b;">
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Blood Group &amp; Rh</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Blood Type</label>
          <select name="blood_type">
            <option value="">Select type...</option>
            <option>A</option>
            <option>B</option>
            <option>AB</option>
            <option>O</option>
          </select>
        </div>
        <div class="field" style="margin:0;">
          <label>Rh Factor</label>
          <select name="rh_factor">
            <option value="">Select Rh...</option>
            <option>Positive (+)</option>
            <option>Negative (-)</option>
          </select>
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Complete Blood Count (CBC)</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Hemoglobin (g/dL)</label>
          <input type="number" step="0.1" name="cbc_hemoglobin" placeholder="e.g. 12.5" min="4" max="25">
        </div>
        <div class="field" style="margin:0;">
          <label>Hematocrit (%)</label>
          <input type="number" step="0.1" name="cbc_hematocrit" placeholder="e.g. 37.0" min="10" max="65">
        </div>
      </div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>WBC (x10³/µL)</label>
          <input type="number" step="0.1" name="cbc_wbc" placeholder="e.g. 8.2" min="1" max="50">
        </div>
        <div class="field" style="margin:0;">
          <label>Platelets (x10³/µL)</label>
          <input type="number" name="cbc_platelets" placeholder="e.g. 250" min="10" max="900">
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Urinalysis</div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>Urine Protein</label>
          <select name="urinalysis_protein">
            <option value="Negative">Negative</option>
            <option value="Trace">Trace</option>
            <option value="1+">1+</option>
            <option value="2+">2+</option>
            <option value="3+">3+</option>
            <option value="4+">4+</option>
          </select>
        </div>
        <div class="field" style="margin:0;">
          <label>Urine Glucose</label>
          <select name="urinalysis_glucose">
            <option value="Negative">Negative</option>
            <option value="Trace">Trace</option>
            <option value="1+">1+</option>
            <option value="2+">2+</option>
            <option value="3+">3+</option>
          </select>
        </div>
      </div>

      <div style="font-size:11.5px;font-weight:800;color:#0284c7;text-transform:uppercase;letter-spacing:0.05em;margin:14px 0 8px;">Blood Sugar &amp; Screenings</div>
      <div class="field" style="margin-bottom:12px;">
        <label>Fasting Blood Sugar (mg/dL)</label>
        <input type="number" step="0.1" name="blood_glucose" placeholder="e.g. 92.0" min="40" max="400">
      </div>
      <div class="grid grid-2" style="gap:10px;margin-bottom:12px;">
        <div class="field" style="margin:0;">
          <label>HIV Screening</label>
          <select name="hiv_screening">
            <option value="Non-Reactive">Non-Reactive</option>
            <option value="Reactive">Reactive</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div class="field" style="margin:0;">
          <label>Syphilis (VDRL/RPR)</label>
          <select name="syphilis_screening">
            <option value="Non-Reactive">Non-Reactive</option>
            <option value="Reactive">Reactive</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>
      <div class="field" style="margin-bottom:14px;">
        <label>Hepatitis B (HBsAg)</label>
        <select name="hepb_screening">
          <option value="Non-Reactive">Non-Reactive</option>
          <option value="Reactive">Reactive</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <button type="submit" class="btn btn-primary btn-block" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%);border:none;border-radius:14px;padding:12px;font-weight:700;font-size:15px;margin-top:6px;">
        <i class="fa-solid fa-flask"></i> Save Initial Laboratory
      </button>
    </form>
  </div>
</div>

<!-- ==================== MODAL: DETAIL VIEW ==================== -->
<div class="ed-modal-backdrop" id="detailModal" style="display:none;" onclick="if(event.target===this) pcCloseDetailModal()">
  <div class="ed-modal" style="max-width:440px;border-radius:24px;padding:22px;max-height:85vh;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div id="detailModalTitle" style="font-family:var(--font-display);font-size:20px;font-weight:800;color:#1e293b;">Record Detail</div>
        <div id="detailModalDate" style="font-size:12px;color:#64748b;"></div>
      </div>
      <button type="button" class="ed-close" onclick="pcCloseDetailModal()"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div id="detailModalContent" style="display:flex;flex-direction:column;gap:10px;"></div>
    <button type="button" class="btn btn-outline btn-block" style="margin-top:16px;border-radius:12px;" onclick="pcCloseDetailModal()">Close</button>
  </div>
</div>

<style>
.folder-pill {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  border: 1px solid #edf2f7;
  background: #ffffff;
  color: #64748b;
  cursor: pointer;
  transition: all .15s ease;
}
.folder-pill.active {
  background: #b04a6e !important;
  color: #ffffff !important;
  border-color: #b04a6e !important;
  box-shadow: 0 2px 8px rgba(176,74,110,0.25);
}
.history-card {
  background: #ffffff;
  border: 1px solid #edf2f7;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease;
}
.history-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.history-card:active {
  transform: scale(0.99);
}
.metric-block {
  background: #fdf2f8;
  border-radius: 12px;
  padding: 8px 12px;
  min-width: 82px;
  flex: 1;
}
.metric-val {
  font-size: 15px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}
.metric-lbl {
  font-size: 11px;
  font-weight: 600;
  color: #8e95a5;
  margin-top: 2px;
}
.trend-tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all .15s ease;
}
.trend-tab-btn.active {
  background: #ffffff;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.trend-metric-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: all .15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.trend-metric-btn.active {
  background: #b04a6e;
  color: #ffffff;
  border-color: #b04a6e;
}
[data-theme="dark"] .trend-tab-btn {
  color: #94a3b8;
}
[data-theme="dark"] .trend-tab-btn.active {
  background: #27272a;
  color: #f1f5f9;
}
[data-theme="dark"] .trend-metric-btn {
  background: #27272a;
  border-color: #3f3f46;
  color: #cbd5e1;
}
[data-theme="dark"] .trend-metric-btn.active {
  background: #d45d79;
  border-color: #d45d79;
  color: #ffffff;
}
[data-theme="dark"] .folder-pill {
  background: #1a1a1e;
  border-color: #2c2c31;
  color: #a09ca8;
}
[data-theme="dark"] .folder-pill.active {
  background: #d45d79 !important;
  color: #ffffff !important;
  border-color: #d45d79 !important;
}
[data-theme="dark"] .history-card {
  background: #1a1a1e;
  border-color: #2c2c31;
}
[data-theme="dark"] .metric-block {
  background: #241e26;
}
[data-theme="dark"] .metric-val {
  color: #f0eef0;
}
[data-theme="dark"] .metric-lbl {
  color: #85818a;
}
</style>

<script>
var currentTrendTimeframe = 'daily';
var currentTrendMetric = 'bp';

function pcUpdateTrendView() {
  var panels = document.querySelectorAll('.trend-view-panel');
  panels.forEach(function(p) { p.style.display = 'none'; });

  var targetId = 'trendPanel_' + currentTrendTimeframe + '_' + currentTrendMetric;
  var target = document.getElementById(targetId);
  if (target) {
    target.style.display = 'block';
  }

  ['daily', 'weekly', 'monthly'].forEach(function(tf) {
    var tab = document.getElementById('tabTrend' + tf.charAt(0).toUpperCase() + tf.slice(1));
    if (tab) {
      if (tf === currentTrendTimeframe) tab.classList.add('active');
      else tab.classList.remove('active');
    }
  });

  var btnBp = document.getElementById('btnMetricBp');
  var btnWeight = document.getElementById('btnMetricWeight');
  var legBp = document.getElementById('trendLegendBp');
  var legWeight = document.getElementById('trendLegendWeight');
  if (btnBp && btnWeight) {
    if (currentTrendMetric === 'bp') {
      btnBp.classList.add('active');
      btnWeight.classList.remove('active');
      if (legBp) legBp.style.display = 'flex';
      if (legWeight) legWeight.style.display = 'none';
    } else {
      btnBp.classList.remove('active');
      btnWeight.classList.add('active');
      if (legBp) legBp.style.display = 'none';
      if (legWeight) legWeight.style.display = 'flex';
    }
  }

  var titleEl = document.getElementById('trendActiveSummaryTitle');
  if (titleEl) {
    var tfText = currentTrendTimeframe === 'daily' ? 'Daily Readings' : (currentTrendTimeframe.charAt(0).toUpperCase() + currentTrendTimeframe.slice(1));
    var metricText = currentTrendMetric === 'bp' ? 'BP Trends' : 'Weight Trends';
    titleEl.textContent = tfText + ' ' + metricText;
  }
}

function pcSwitchTrendTimeframe(tf) {
  currentTrendTimeframe = tf;
  pcUpdateTrendView();
}

function pcSwitchTrendMetric(m) {
  currentTrendMetric = m;
  pcUpdateTrendView();
}

function pcOpenDailyVitalsModal(){
  var m = document.getElementById('dailyVitalsModal');
  if (m) m.style.display = 'flex';
}
function pcCloseDailyVitalsModal(){
  var m = document.getElementById('dailyVitalsModal');
  if (m) m.style.display = 'none';
}
function pcOpenLabModal(){
  var m = document.getElementById('initialLabModal');
  if (m) m.style.display = 'flex';
}
function pcCloseLabModal(){
  var m = document.getElementById('initialLabModal');
  if (m) m.style.display = 'none';
}
function pcFilterHistory(filter, btn){
  document.querySelectorAll('.folder-pill').forEach(function(el){ el.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  var vitals = document.querySelectorAll('.history-vital');
  var labs = document.querySelectorAll('.history-lab');

  if (filter === 'all') {
    vitals.forEach(function(el){ el.style.display = 'block'; });
    labs.forEach(function(el){ el.style.display = 'block'; });
  } else if (filter === 'vitals') {
    vitals.forEach(function(el){ el.style.display = 'block'; });
    labs.forEach(function(el){ el.style.display = 'none'; });
  } else if (filter === 'initial_lab') {
    vitals.forEach(function(el){ el.style.display = 'none'; });
    labs.forEach(function(el){ el.style.display = 'block'; });
  }
}

function pcOpenDetailModal(data, kind){
  var modal = document.getElementById('detailModal');
  var title = document.getElementById('detailModalTitle');
  var date = document.getElementById('detailModalDate');
  var content = document.getElementById('detailModalContent');
  if (!modal || !title || !content) return;

  date.textContent = data.date || '';
  content.innerHTML = '';

  if (kind === 'vital') {
    title.textContent = 'Daily Vitals Detail';
    var rows = [
      { l: 'Blood Pressure', v: data.bp_sys ? (data.bp_sys + '/' + data.bp_dia + ' mmHg') : null },
      { l: 'Heart Rate', v: data.heart_rate ? (data.heart_rate + ' bpm') : null },
      { l: 'Respiratory Rate', v: data.respiratory_rate ? (data.respiratory_rate + ' /min') : null },
      { l: 'Body Temperature', v: data.temp ? (data.temp + ' °C') : null },
      { l: 'SpO₂', v: data.spo2 ? (data.spo2 + ' %') : null },
      { l: 'Weight', v: data.weight_kg ? (data.weight_kg + ' kg') : null },
      { l: 'Fetal Heart Rate', v: data.fetal_heart_rate ? (data.fetal_heart_rate + ' bpm') : null },
      { l: 'Blood Sugar', v: data.blood_sugar ? (data.blood_sugar + ' mg/dL') : null },
      { l: 'Fetal Kicks', v: (data.fetal_movement !== null && data.fetal_movement !== undefined) ? (data.fetal_movement + ' kicks/hr') : null },
      { l: 'Sleep Duration', v: data.sleep_hours ? (data.sleep_hours + ' hrs') : null },
      { l: 'Water Intake', v: data.water_intake ? (data.water_intake + ' glasses') : null },
      { l: 'Mood', v: data.mood || null },
      { l: 'Activity Level', v: data.activity || null }
    ];
    rows.forEach(function(r){
      if (!r.v) return;
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;justify-content:space-between;padding:8px 12px;background:#f8fafc;border-radius:10px;font-size:13px;';
      d.innerHTML = '<span style="color:#64748b;font-weight:600;">' + r.l + '</span><span style="color:#1e293b;font-weight:700;">' + r.v + '</span>';
      content.appendChild(d);
    });
  } else {
    title.textContent = 'Initial Laboratory Detail';
    var labRows = [
      { l: 'Blood Type', v: data.blood_type ? (data.blood_type + (data.rh_factor ? ' (' + data.rh_factor + ')' : '')) : null },
      { l: 'Hemoglobin', v: data.cbc_hemoglobin ? (data.cbc_hemoglobin + ' g/dL') : null },
      { l: 'Hematocrit', v: data.cbc_hematocrit ? (data.cbc_hematocrit + ' %') : null },
      { l: 'WBC', v: data.cbc_wbc ? (data.cbc_wbc + ' x10³/µL') : null },
      { l: 'Platelets', v: data.cbc_platelets ? (data.cbc_platelets + ' x10³/µL') : null },
      { l: 'Urine Protein', v: data.urinalysis_protein || null },
      { l: 'Urine Glucose', v: data.urinalysis_glucose || null },
      { l: 'Fasting Blood Sugar', v: data.blood_glucose ? (data.blood_glucose + ' mg/dL') : null },
      { l: 'HIV Screening', v: data.hiv_screening || null },
      { l: 'Syphilis (VDRL)', v: data.syphilis_screening || null },
      { l: 'Hepatitis B (HBsAg)', v: data.hepb_screening || null },
      { l: 'Notes', v: data.notes || null }
    ];
    labRows.forEach(function(r){
      if (!r.v) return;
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;justify-content:space-between;padding:8px 12px;background:#f0f9ff;border-radius:10px;font-size:13px;';
      d.innerHTML = '<span style="color:#0369a1;font-weight:600;">' + r.l + '</span><span style="color:#1e293b;font-weight:700;">' + r.v + '</span>';
      content.appendChild(d);
    });
  }

  modal.style.display = 'flex';
}
function pcCloseDetailModal(){
  var m = document.getElementById('detailModal');
  if (m) m.style.display = 'none';
}
</script>

<?php render_footer(); ?>
