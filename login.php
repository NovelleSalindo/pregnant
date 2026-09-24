<?php
require_once __DIR__ . '/base.php';

if (current_user()) redirect(role_home(current_user()['role']));

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
    $login = trim($_POST['email'] ?? $_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    try {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? OR username = ?");
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();
    } catch (Throwable $e) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$login]);
        $user = $stmt->fetch();
    }

    if ($user && password_verify($password, $user['password_hash'])){
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_email'] = $user['email'];
        log_action('login');
        redirect(role_home($user['role']));
    } else {
        $error = 'Invalid email/username or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
<title>Log In — PregnaCare</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="css/style.css" />
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="brand" style="padding:0 0 18px;">
      <div class="mark"><i class="fa-solid fa-heart-pulse"></i></div>
      <div class="name">PregnaCare<small>Maternal Risk Monitoring</small></div>
    </div>
    <div class="auth-tabs">
      <button type="button" class="active">Log In</button>
      <button type="button" onclick="location.href='register.php'">Register</button>
    </div>

    <?php if ($error): ?>
      <div class="badge badge-high" style="width:100%;justify-content:flex-start;margin-bottom:14px;padding:10px 12px;"><i class="fa-solid fa-circle-exclamation"></i> <?php echo e($error); ?></div>
    <?php endif; ?>

    <form method="post" action="login.php">
      <div class="field">
        <label>Email or Username</label>
        <input type="text" name="email" required placeholder="you@example.com or username" value="<?php echo e($_POST['email'] ?? ''); ?>">
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" required placeholder="••••••••">
      </div>
      <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-right-to-bracket"></i> Log In</button>
    </form>

    <div class="divider"></div>
    <div class="hint">
      
    </div>
  </div>
</div>
</body>
</html>
