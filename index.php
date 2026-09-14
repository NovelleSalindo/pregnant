<?php
try {
    require_once __DIR__ . '/base.php';
    $u = current_user();
    redirect($u ? role_home($u['role']) : 'front.php');
} catch (Throwable $e) {
    // DB not set up yet, or something's wrong — send them to the connection hub instead of a blank error.
    redirect('test_connection.php');
}