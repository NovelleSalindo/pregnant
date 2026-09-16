<?php
require_once __DIR__ . '/base.php';
log_action('logout');
$_SESSION = [];
session_destroy();
redirect('login.php');
