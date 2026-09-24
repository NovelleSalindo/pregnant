<?php
require_once __DIR__ . '/base.php';

if (current_user()) redirect(role_home(current_user()['role']));

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $username = trim($_POST['username'] ?? '');
    $firstName = trim($_POST['first_name'] ?? '');
    $middleName = trim($_POST['middle_name'] ?? '');
    $lastName = trim($_POST['last_name'] ?? '');
    $name = trim($firstName . ($middleName !== '' ? ' ' . $middleName : '') . ' ' . $lastName);
    if ($name === '') {
        $name = trim($_POST['name'] ?? '');
    }
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $dob = $_POST['dob'] ?? '';
    $lmp = $_POST['lmp'] ?? '';

    if ($username === '' || $firstName === '' || $lastName === '' || $email === '' || strlen($password) < 6){
        $error = 'Please fill in username, first name, last name, email, and a password of at least 6 characters.';
    } else {
        try {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
            $stmt->execute([$email, $username]);
        } catch (Throwable $e) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
        }
        if ($stmt->fetch()){
            $error = 'An account with that email or username already exists.';
        } else {
            $id = uid('u');
            $age = $dob ? (int)((strtotime('now') - strtotime($dob)) / (365.25*86400)) : null;
            $edd = $lmp ? date('Y-m-d', strtotime($lmp . ' + 280 days')) : null;

            $pdo->beginTransaction();
            try {
                $pdo->prepare("INSERT INTO users (id, role, username, first_name, middle_name, last_name, name, email, password_hash) VALUES (?, 'patient', ?, ?, ?, ?, ?, ?, ?)")
                    ->execute([$id, $username, $firstName, $middleName ?: null, $lastName, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            } catch (Throwable $e) {
                $pdo->prepare("INSERT INTO users (id, role, name, email, password_hash) VALUES (?, 'patient', ?, ?, ?)")
                    ->execute([$id, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            }
            $pdo->prepare("INSERT INTO patient_profiles (user_id, dob, age, height_cm, weight_kg, lmp, edd, gravida, conditions)
                           VALUES (?,?,?,NULL,NULL,?,?,1,'None')")
                ->execute([$id, $dob ?: null, $age, $lmp ?: null, $edd]);
            $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, kind) VALUES (?,?,?,?,?,?)")
                ->execute([uid('ntf'), $id, 'Welcome to PregnaCare', 'Complete your profile and log your first symptom check-in to see your risk assessment.', now_iso(), 'info']);
            $pdo->commit();

            $_SESSION['user_id'] = $id;
            $_SESSION['user_email'] = $email;
            log_action('register');
            redirect('dashboard.php');
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
<title>Register — PregnaCare</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="css/style.css" />
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card" style="max-width:480px;">
    <div class="brand" style="padding:0 0 18px;">
      <div class="mark"><i class="fa-solid fa-heart-pulse"></i></div>
      <div class="name">PregnaCare<small>Maternal Risk Monitoring</small></div>
    </div>
    <div class="auth-tabs">
      <button type="button" onclick="location.href='login.php'">Log In</button>
      <button type="button" class="active">Register</button>
    </div>

    <?php if ($error): ?>
      <div class="badge badge-high" style="width:100%;justify-content:flex-start;margin-bottom:14px;padding:10px 12px;"><i class="fa-solid fa-circle-exclamation"></i> <?php echo e($error); ?></div>
    <?php endif; ?>

    <form method="post" action="register.php">
      <div class="field">
        <label>Username</label>
        <input type="text" name="username" required placeholder="e.g. maria_santos" value="<?php echo e($_POST['username'] ?? ''); ?>">
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label>First Name</label>
          <input type="text" name="first_name" required placeholder="e.g. Maria" value="<?php echo e($_POST['first_name'] ?? ''); ?>">
        </div>
        <div class="field">
          <label>Middle Name</label>
          <input type="text" name="middle_name" placeholder="Optional" value="<?php echo e($_POST['middle_name'] ?? ''); ?>">
        </div>
      </div>
      <div class="field">
        <label>Last Name</label>
        <input type="text" name="last_name" required placeholder="e.g. Santos" value="<?php echo e($_POST['last_name'] ?? ''); ?>">
      </div>
      <div class="field">
        <label>Email</label>
        <input type="email" name="email" required placeholder="you@example.com" value="<?php echo e($_POST['email'] ?? ''); ?>">
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" required minlength="6" placeholder="At least 6 characters">
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Date of Birth</label><input type="date" name="dob" value="<?php echo e($_POST['dob'] ?? ''); ?>"></div>
        <div class="field"><label>Last Menstrual Period</label><input type="date" name="lmp" value="<?php echo e($_POST['lmp'] ?? ''); ?>"></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-user-plus"></i> Create Account</button>
    </form>
  </div>
</div>
</body>
</html>
