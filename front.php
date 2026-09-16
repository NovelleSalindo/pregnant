<?php
require_once __DIR__ . '/base.php';
// If already logged in, skip the landing page entirely.
$u = current_user();
if ($u) redirect(role_home($u['role']));
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
<title>PregnaCare — Pregnancy Risk Monitoring &amp; Recommendations</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png" type="image/png">
<meta name="theme-color" content="#FFAFCC">
<link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>" />
<style>
  .front-wrap{ min-height:100vh; display:flex; flex-direction:column; }
  .front-hero{
    background: linear-gradient(135deg, var(--teal) 0%, var(--sky) 100%);
    color:#fff; padding:24px; text-align:center; position:relative; overflow:hidden;
    min-height:48vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
  }
  .front-hero::after{ content:''; position:absolute; right:-60px; top:-80px; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.22), transparent 70%); }
  .front-hero::before{ content:''; position:absolute; left:-60px; bottom:-90px; width:260px; height:260px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.16), transparent 70%); }
  .front-mark{ width:64px;height:64px;border-radius:20px; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 16px; }
  .front-title{ font-family:var(--font-display); font-size:32px; font-weight:700; margin:0 0 8px; }
  .front-tag{ font-size:15px; opacity:.92; max-width:420px; margin:0 auto; line-height:1.5; }
  .front-actions{ display:flex; gap:12px; justify-content:center; margin-top:26px; flex-wrap:wrap; }
  .front-actions .btn{ min-width:150px; padding:13px 22px; font-size:15px; }
  .btn-white{ background:#fff; color:var(--teal-dark); box-shadow:0 8px 20px -8px rgba(0,0,0,.25); }
  .btn-outline-white{ background:transparent; color:#fff; border:1.5px solid rgba(255,255,255,.7); }

  .front-features{ flex:1; padding:44px 20px 40px; max-width:1000px; margin:0 auto; width:100%; }
  .front-features h2{ text-align:center; font-size:22px; margin-bottom:28px; }
  .feature-card{ text-align:center; padding:22px 10px; cursor:pointer; transition: border-color .15s, box-shadow .15s, transform .1s; }
  .feature-card:hover{ border-color: var(--teal); }
  .feature-card:active{ border-color: var(--teal); box-shadow: 0 4px 12px -4px rgba(210,83,111,.35); transform: scale(.97); }
  .feature-card .fi{ width:42px;height:42px;border-radius:13px; background:var(--teal-light); color:var(--teal-dark); display:flex; align-items:center; justify-content:center; font-size:17px; margin:0 auto 9px; transition: background-color .15s, color .15s; }
  .feature-card:hover .fi, .feature-card:active .fi{ background: var(--teal); color:#fff; }
  .feature-card h4{ margin:0; font-size:12.5px; font-weight:700; }
  .feature-desc{
    max-height:0; opacity:0; overflow:hidden; margin:0; font-size:12.5px; color:var(--ink-soft); line-height:1.5;
    transition: max-height .3s ease, opacity .25s ease, margin-top .3s ease;
  }
  .feature-card.open .feature-desc{ max-height:100px; opacity:1; margin-top:8px; }

  .front-footer{ text-align:center; padding:20px; font-size:12px; color:var(--muted); border-top:1px solid var(--border); }
</style>
</head>
<body>
<div class="front-wrap">

  <div class="front-hero">
    <div class="front-mark"><i class="fa-solid fa-heart-pulse"></i></div>
    <h1 class="front-title">PregnaCare</h1>
    <div class="front-actions">
      <a class="btn btn-white" href="login.php"><i class="fa-solid fa-right-to-bracket"></i> Log In</a>
      <a class="btn btn-outline-white" href="register.php"><i class="fa-solid fa-user-plus"></i> Sign Up</a>
    </div>
  </div>

  <div class="front-features">
    <h2 class="font-display">Everything you need, in one place</h2>
    <div class="grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
      <div class="card feature-card" onclick="this.classList.toggle('open')">
        <div class="fi"><i class="fa-solid fa-gauge-high"></i></div>
        <h4>Risk Monitoring</h4>
        <p class="feature-desc">Log vitals and symptoms, get a clear Low / High / Severe risk score.</p>
      </div>
      <div class="card feature-card" onclick="this.classList.toggle('open')">
        <div class="fi"><i class="fa-solid fa-lightbulb"></i></div>
        <h4>Recommendations</h4>
        <p class="feature-desc">Personalized guidance based on your latest assessment.</p>
      </div>
      <div class="card feature-card" onclick="this.classList.toggle('open')">
        <div class="fi"><i class="fa-solid fa-book-medical"></i></div>
        <h4>Trimester Guidance</h4>
        <p class="feature-desc">Checklists, nutrition, and tips tailored to each stage.</p>
      </div>
      <div class="card feature-card" onclick="this.classList.toggle('open')">
        <div class="fi"><i class="fa-solid fa-heart"></i></div>
        <h4>Wellness Tools</h4>
        <p class="feature-desc">Medication reminders, weight tracking, journal, and more.</p>
      </div>
    </div>
  </div>

  <div class="front-footer">PregnaCare is a decision-support tool, not a medical diagnosis. &copy; <?php echo date('Y'); ?></div>
</div>
</body>
</html>