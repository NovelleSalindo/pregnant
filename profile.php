<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT * FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$p = $stmt->fetch() ?: [];

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $height = (float)$_POST['height_cm'];
    $weight = (float)$_POST['weight_kg'];
    $stmt = $pdo->prepare("REPLACE INTO patient_profiles
        (user_id, dob, age, height_cm, weight_kg, blood_type, occupation, lmp, edd, gravida, prior_miscarriage, prior_csection, conditions, phone, address, emergency_name, emergency_relation, emergency_phone, medical_history_score, prior_complications_score)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $age = $_POST['dob'] ? (int)((time() - strtotime($_POST['dob'])) / (365.25*86400)) : null;
    $edd = $_POST['lmp'] ? date('Y-m-d', strtotime($_POST['lmp'].' + 280 days')) : null;
    $stmt->execute([
        $u['id'], $_POST['dob'] ?: null, $age, $height ?: null, $weight ?: null,
        trim($_POST['blood_type']), trim($_POST['occupation']), $_POST['lmp'] ?: null, $edd,
        (int)$_POST['gravida'], isset($_POST['prior_miscarriage'])?1:0, isset($_POST['prior_csection'])?1:0,
        trim($_POST['conditions']), trim($_POST['phone']), trim($_POST['address']),
        trim($_POST['emergency_name']), trim($_POST['emergency_relation']), trim($_POST['emergency_phone']),
        (float)($_POST['medical_history_score'] ?: 0), (float)($_POST['prior_complications_score'] ?: 0),
    ]);
    $pdo->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([trim($_POST['name']), $u['id']]);
    flash('Profile updated.', 'success');
    log_action('profile_update');
    redirect('profile.php');
}

render_header('Profile', 'profile');
?>

<div class="card">
  <h3 style="margin-top:0;">My Profile</h3>
  <form method="post" action="profile.php">
    <div class="grid grid-2">
      <div class="field"><label>Full Name</label><input type="text" name="name" value="<?php echo e($u['name']); ?>" required></div>
      <div class="field"><label>Email</label><input type="email" value="<?php echo e($u['email']); ?>" disabled></div>
    </div>
    <div class="grid grid-3">
      <div class="field"><label>Date of Birth</label><input type="date" name="dob" value="<?php echo e($p['dob'] ?? ''); ?>"></div>
      <div class="field"><label>Height (cm)</label><input type="number" step="0.1" name="height_cm" value="<?php echo e($p['height_cm'] ?? ''); ?>"></div>
      <div class="field"><label>Weight (kg)</label><input type="number" step="0.1" name="weight_kg" value="<?php echo e($p['weight_kg'] ?? ''); ?>"></div>
    </div>
    <div class="grid grid-3">
      <div class="field"><label>Blood Type</label><input type="text" name="blood_type" value="<?php echo e($p['blood_type'] ?? ''); ?>"></div>
      <div class="field"><label>Occupation</label><input type="text" name="occupation" value="<?php echo e($p['occupation'] ?? ''); ?>"></div>
      <div class="field"><label>Gravida (# pregnancies)</label><input type="number" name="gravida" value="<?php echo e($p['gravida'] ?? 1); ?>"></div>
    </div>
    <div class="grid grid-2">
      <div class="field"><label>Last Menstrual Period</label><input type="date" name="lmp" value="<?php echo e($p['lmp'] ?? ''); ?>"></div>
      <div class="field"><label>Known Conditions</label><input type="text" name="conditions" value="<?php echo e($p['conditions'] ?? 'None'); ?>"></div>
    </div>
    <div class="grid grid-2">
      <label class="chip <?php echo !empty($p['prior_miscarriage'])?'on':''; ?>" style="cursor:pointer;">
        <input type="checkbox" name="prior_miscarriage" <?php echo !empty($p['prior_miscarriage'])?'checked':''; ?> style="margin-right:8px;"> Prior Miscarriage
      </label>
      <label class="chip <?php echo !empty($p['prior_csection'])?'on':''; ?>" style="cursor:pointer;">
        <input type="checkbox" name="prior_csection" <?php echo !empty($p['prior_csection'])?'checked':''; ?> style="margin-right:8px;"> Prior C-Section
      </label>
    </div>
    <div class="grid grid-2">
      <div class="field"><label>Medical History Risk Score (0–1)</label><input type="number" step="0.05" min="0" max="1" name="medical_history_score" value="<?php echo e($p['medical_history_score'] ?? 0); ?>"></div>
      <div class="field"><label>Prior Complications Risk Score (0–1)</label><input type="number" step="0.05" min="0" max="1" name="prior_complications_score" value="<?php echo e($p['prior_complications_score'] ?? 0); ?>"></div>
    </div>
    <div class="divider"></div>
    <div class="grid grid-2">
      <div class="field"><label>Phone</label><input type="text" name="phone" value="<?php echo e($p['phone'] ?? ''); ?>"></div>
      <div class="field"><label>Address</label><input type="text" name="address" value="<?php echo e($p['address'] ?? ''); ?>"></div>
    </div>
    <div class="grid grid-3">
      <div class="field"><label>Emergency Contact Name</label><input type="text" name="emergency_name" value="<?php echo e($p['emergency_name'] ?? ''); ?>"></div>
      <div class="field"><label>Relation</label><input type="text" name="emergency_relation" value="<?php echo e($p['emergency_relation'] ?? ''); ?>"></div>
      <div class="field"><label>Emergency Phone</label><input type="text" name="emergency_phone" value="<?php echo e($p['emergency_phone'] ?? ''); ?>"></div>
    </div>
    <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Profile</button>
  </form>
</div>

<?php render_footer(); ?>
