<?php
/* ============================================================
   test_connection.php
   BUKSI NI SIYA UNA sa browser para ma-check kung naka-connect
   na ang database ug makita ang links sa tanang pages.

   URL: http://localhost/pregnacare_php/test_connection.php
   ============================================================ */

$dbOk = false;
$dbError = '';
$tableCount = 0;

$msg = '';
try {
    require_once __DIR__ . '/base.php';
    $dbOk = true;

    // One-click import for Railway / fresh setup
    if (isset($_GET['action']) && $_GET['action'] === 'init_schema') {
        $sql = file_get_contents(__DIR__ . '/sql/schema.sql');
        // Remove CREATE DATABASE and USE statements for environments like Railway where DB is pre-selected
        $sql = preg_replace('/CREATE DATABASE[^;]+;/i', '', $sql);
        $sql = preg_replace('/USE[^;]+;/i', '', $sql);
        $pdo->exec($sql);

        // Also hash demo passwords
        $hash = password_hash('demo123', PASSWORD_DEFAULT);
        $pdo->prepare("UPDATE users SET password_hash = ? WHERE email IN ('ana@demo.com', 'admin@demo.com')")->execute([$hash]);

        $msg = "Schema imported and demo accounts (ana@demo.com / admin@demo.com, pw: demo123) initialized successfully!";
    }

    $tableCount = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" . DB_NAME . "'")->fetchColumn();
} catch (Throwable $e) {
    $dbError = $e->getMessage();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PregnaCare — Connection Check</title>
<style>
  body{ font-family: Arial, sans-serif; background:#F5FAFB; color:#123734; padding:30px; max-width:720px; margin:0 auto; }
  h1{ font-size:22px; }
  .box{ background:#fff; border:1px solid #DCEEEC; border-radius:14px; padding:20px; margin-bottom:18px; }
  .ok{ color:#0E9C8F; font-weight:bold; }
  .fail{ color:#E0574E; font-weight:bold; }
  a.btn{ display:inline-block; background:#0E9C8F; color:#fff; padding:10px 16px; border-radius:10px; text-decoration:none; margin:4px 6px 4px 0; font-size:14px; }
  a.btn.outline{ background:#fff; color:#0E9C8F; border:1px solid #0E9C8F; }
  code{ background:#EEF7F6; padding:2px 6px; border-radius:6px; }
  ul{ line-height:1.9; }
</style>
</head>
<body>
<h1>🩺 PregnaCare — Connection Check</h1>

<div class="box">
  <?php if ($dbOk): ?>
    <div class="ok">✅ Database connected successfully!</div>
    <?php if (!empty($msg)): ?>
      <div style="background:#E6F6F4;border:1px solid #0E9C8F;padding:12px;border-radius:10px;margin-top:10px;color:#0B7A70;font-weight:bold;">
        🎉 <?php echo htmlspecialchars($msg); ?>
      </div>
    <?php endif; ?>
    <?php if ($tableCount === 0): ?>
      <p class="fail">⚠️ 0 tables found — your database is connected but empty.</p>
      <a class="btn" href="test_connection.php?action=init_schema" onclick="return confirm('Initialize database schema and demo accounts now?');">🚀 Initialize Database Tables Now</a>
    <?php endif; ?>
  <?php else: ?>
    <div class="fail">❌ Database connection FAILED.</div>
    <p>Error: <code><?php echo htmlspecialchars($dbError); ?></code></p>
    <p><strong>Common fixes:</strong></p>
    <ul>
      <li>Is MySQL started (green) in the XAMPP Control Panel?</li>
      <li>Did you create a database named exactly <code>pregnacare</code> in phpMyAdmin?</li>
      <li>Did you import <code>sql/schema.sql</code> into it?</li>
      <li>Check the DB_HOST / DB_NAME / DB_USER / DB_PASS constants at the top of <code>base.php</code> match your setup.</li>
    </ul>
  <?php endif; ?>
</div>

<?php if ($dbOk && $tableCount > 0): ?>
<div class="box">
  <h3>1️⃣ First time only — reset demo passwords</h3>
  <p>Run this once so the 3 demo accounts' passwords work:</p>
  <a class="btn" href="reset_demo_passwords.php">Reset Demo Passwords</a>
</div>

<div class="box">
  <h3>2️⃣ Log in</h3>
  <a class="btn" href="login.php">Go to Login</a>
  <a class="btn outline" href="register.php">Register New Patient</a>
  <p>Demo account (password: <code>demo123</code>):</p>
  <ul>
    <li><code>ana@demo.com</code> — patient</li>
  </ul>
</div>

<div class="box">
  <h3>3️⃣ All pages (for reference — most require login first)</h3>
  <ul>
    <li><a href="dashboard.php">dashboard.php</a> — patient home</li>
    <li><a href="monitoring.php">monitoring.php</a> — vitals</li>
    <li><a href="symptoms.php">symptoms.php</a> — symptom check-in</li>
    <li><a href="analyze.php">analyze.php</a> — risk analysis</li>
    <li><a href="recommendations.php">recommendations.php</a></li>
    <li><a href="reminders.php">reminders.php</a> — OB visit &amp; supplement reminders</li>
    <li><a href="notifications.php">notifications.php</a></li>
    <li><a href="medications.php">medications.php</a> — medication &amp; vitamin reminders</li>
    <li><a href="weight_tracker.php">weight_tracker.php</a> — weight gain tracker</li>
    <li><a href="journal.php">journal.php</a> — pregnancy journal</li>
    <li><a href="bump_photos.php">bump_photos.php</a> — bump photo timeline</li>
    <li><a href="birth_plan.php">birth_plan.php</a> — birth plan builder</li>
    <li><a href="hospital_bag.php">hospital_bag.php</a> — hospital bag checklist</li>
    <li><a href="postpartum.php">postpartum.php</a> — postpartum &amp; baby care</li>
    <li><a href="education.php">education.php</a></li>
    <li><a href="profile.php">profile.php</a></li>
  </ul>
</div>
<?php endif; ?>

</body>
</html>