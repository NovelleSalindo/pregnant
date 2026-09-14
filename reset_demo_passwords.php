<?php
/* ============================================================
   reset_demo_passwords.php
   Run this ONCE in your browser after importing sql/schema.sql.
   It sets the demo patient account's password to: demo123
   using PHP's own password_hash(), so login works out of the box.
   Delete this file afterwards (or it will just keep resetting it).
   ============================================================ */
require_once __DIR__ . '/base.php';

$hash = password_hash('demo123', PASSWORD_DEFAULT);
$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = 'ana@demo.com'");
$stmt->execute([$hash]);

echo "Demo account password reset. The demo account now uses password: demo123<br>";
echo "- ana@demo.com (patient)<br><br>";
echo "You can delete reset_demo_passwords.php now. <a href='login.php'>Go to login</a>";