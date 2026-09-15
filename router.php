<?php
// Enable error display and logging for debugging
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

try {
    // Route incoming requests to the appropriate PHP file
    $request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $request_uri = trim($request_uri, '/');

    // Map common routes
    $routes = [
        '' => 'front.php',
        '/' => 'front.php',
        'login' => 'login.php',
        'register' => 'register.php',
        'dashboard' => 'dashboard.php',
        'profile' => 'profile.php',
    ];

    // Serve static files as-is
    if (preg_match('/\.(css|js|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf)$/i', $request_uri)) {
        return false;
    }

    // Check if route exists, otherwise serve front.php
    $file = isset($routes[$request_uri]) ? $routes[$request_uri] : 'front.php';
    if (file_exists($file)) {
        require $file;
    } else {
        require 'front.php';
    }
} catch (Exception $e) {
    http_response_code(500);
    echo "Error: " . htmlspecialchars($e->getMessage());
    error_log("Router error: " . $e->getMessage());
}
?>
