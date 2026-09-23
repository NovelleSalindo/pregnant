<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $assessmentId = trim($_POST['assessment_id'] ?? '');
    $facility = trim($_POST['facility'] ?? '');
    $doctorName = trim($_POST['doctor_name'] ?? '');
    $visitDate = trim($_POST['visit_date'] ?? '');
    $notes = trim($_POST['notes'] ?? '');
    $redirectTo = trim($_POST['redirect_to'] ?? 'dashboard');

    if (!$assessmentId) {
        flash("Assessment record not found.", "danger");
        redirect('dashboard.php');
    }

    try {
        record_clinical_visit($pdo, $u['id'], $assessmentId, [
            'facility' => $facility,
            'doctor_name' => $doctorName,
            'visit_date' => $visitDate ?: now_iso(),
            'notes' => $notes,
        ]);

        flash("Medical visit recorded successfully! Your severe alert has been archived into your clinical history. You can now start a fresh risk assessment.", "success");
    } catch (Exception $e) {
        flash("Unable to record medical visit: " . $e->getMessage(), "danger");
    }

    if ($redirectTo === 'analyze') {
        redirect("analyze.php?a=" . urlencode($assessmentId));
    } else {
        redirect("dashboard.php");
    }
}

redirect("dashboard.php");
