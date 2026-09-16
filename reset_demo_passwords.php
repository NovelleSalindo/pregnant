<?php
/* ============================================================
   reset_demo_passwords.php
   Run this ONCE in your browser after importing sql/schema.sql.
   It sets the 2 demo accounts' password to: demo123
   using PHP's own password_hash(), so login works out of the box.
   Delete this file afterwards (or it will just keep resetting them).
   ============================================================ */
require_once __DIR__ . '/base.php';

$hash = password_hash('demo123', PASSWORD_DEFAULT);
$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email IN ('ana@demo.com','admin@demo.com')");
$stmt->execute([$hash]);

echo "Demo account passwords reset. Both demo accounts now use password: demo123<br>";
echo "- ana@demo.com (patient)<br>";
echo "- admin@demo.com (admin)<br><br>";
echo "You can delete reset_demo_passwords.php now. <a href='login.php'>Go to login</a>";
