<?php
/* ============================================================
   PregnaCare — base.php
   Shared bootstrap: DB connection, session, helpers, risk engine.
   Every page starts with: require_once __DIR__ . '/base.php';
   ============================================================ */

// ---------- 1. DB CONNECTION ----------
// Automatically supports Railway MySQL environment variables, falling back to local XAMPP.
$dbHost = getenv('MYSQLHOST') ?: (getenv('DB_HOST') ?: 'localhost');
$dbName = getenv('MYSQLDATABASE') ?: (getenv('DB_NAME') ?: 'pregnacare');
$dbUser = getenv('MYSQLUSER') ?: (getenv('DB_USER') ?: 'root');
$dbPass = getenv('MYSQLPASSWORD') !== false ? getenv('MYSQLPASSWORD') : (getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');
$dbPort = getenv('MYSQLPORT') ?: (getenv('DB_PORT') ?: '3306');

define('DB_HOST', $dbHost);
define('DB_NAME', $dbName);
define('DB_USER', $dbUser);
define('DB_PASS', $dbPass);
define('DB_PORT', $dbPort);

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    die("Database connection failed. Import sql/schema.sql first and check the DB_* constants at the top of base.php.<br>Error: " . htmlspecialchars($e->getMessage()));
}

// ---------- 2. SESSION ----------
if (session_status() === PHP_SESSION_NONE) session_start();

// Auto-migration: create the clinical risk-scoring tables if they don't exist yet.
// Using CREATE TABLE IF NOT EXISTS (not ALTER TABLE) so this is safe to run on
// every request and works on both fresh installs and existing databases.
$pdo->exec("CREATE TABLE IF NOT EXISTS risk_history (
  user_id VARCHAR(20) PRIMARY KEY,
  parity INT NULL,
  prior_abortions_or_infertility TINYINT(1) DEFAULT 0,
  prev_pp_hemorrhage TINYINT(1) DEFAULT 0,
  prev_manual_placenta_removal TINYINT(1) DEFAULT 0,
  prev_baby_over_9lb TINYINT(1) DEFAULT 0,
  prev_baby_over_5lb8oz TINYINT(1) DEFAULT 0,
  prev_toxemia_hpn TINYINT(1) DEFAULT 0,
  prev_abnormal_labor TINYINT(1) DEFAULT 0,
  prev_gyn_disease TINYINT(1) DEFAULT 0,
  chronic_renal_disease TINYINT(1) DEFAULT 0,
  gestational_diabetes TINYINT(1) DEFAULT 0,
  class_b_diabetes_or_higher TINYINT(1) DEFAULT 0,
  cardiac_disease TINYINT(1) DEFAULT 0,
  other_significant_disease_score TINYINT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS pregnancy_problems (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  symptom_log_id VARCHAR(20) NULL,
  date DATETIME NOT NULL,
  bleeding_lt_20wks TINYINT(1) DEFAULT 0,
  bleeding_gt_20wks TINYINT(1) DEFAULT 0,
  postmaturity_prematurity TINYINT(1) DEFAULT 0,
  hypertension TINYINT(1) DEFAULT 0,
  prom TINYINT(1) DEFAULT 0,
  poly_oligohydramnios TINYINT(1) DEFAULT 0,
  iugr TINYINT(1) DEFAULT 0,
  multiple_pregnancy TINYINT(1) DEFAULT 0,
  breech_malpresentation TINYINT(1) DEFAULT 0,
  rh_isoimmunization TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

// Postpartum tracking — delivery status + baby vaccination schedule
$pdo->exec("CREATE TABLE IF NOT EXISTS postpartum_status (
  user_id VARCHAR(20) PRIMARY KEY,
  is_postpartum TINYINT(1) DEFAULT 0,
  delivery_date DATE NULL,
  delivery_type VARCHAR(30) NULL,
  baby_name VARCHAR(80) NULL,
  recovery_notes TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

$pdo->exec("CREATE TABLE IF NOT EXISTS baby_vaccinations (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  vaccine_name VARCHAR(120) NOT NULL,
  due_age_label VARCHAR(40) NOT NULL,
  due_date DATE NULL,
  given TINYINT(1) DEFAULT 0,
  given_date DATE NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

// Birth plan — one row per patient, free-form preference fields
$pdo->exec("CREATE TABLE IF NOT EXISTS birth_plans (
  user_id VARCHAR(20) PRIMARY KEY,
  delivery_location VARCHAR(160) NULL,
  support_people VARCHAR(200) NULL,
  pain_management VARCHAR(255) NULL,
  feeding_preference VARCHAR(60) NULL,
  who_cuts_cord VARCHAR(80) NULL,
  skin_to_skin TINYINT(1) DEFAULT 1,
  special_requests TEXT NULL,
  updated_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

// Hospital bag checklist — items persist and are checkable, not a static list
$pdo->exec("CREATE TABLE IF NOT EXISTS hospital_bag_items (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  label VARCHAR(160) NOT NULL,
  category VARCHAR(40) DEFAULT 'General',
  is_checked TINYINT(1) DEFAULT 0,
  is_custom TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

function e($s){ return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }

// Standard early-childhood vaccination schedule (Philippines EPI-based) used to
// seed a new baby's checklist once the mother marks herself as postpartum.
const DEFAULT_VACCINES = [
    ['name' => 'BCG',                         'age' => 'At birth',  'days' => 0],
    ['name' => 'Hepatitis B (1st dose)',      'age' => 'At birth',  'days' => 0],
    ['name' => 'Pentavalent (DPT-HepB-Hib) 1', 'age' => '6 weeks',   'days' => 42],
    ['name' => 'OPV 1st dose',                'age' => '6 weeks',   'days' => 42],
    ['name' => 'PCV 1st dose',                'age' => '6 weeks',   'days' => 42],
    ['name' => 'Pentavalent (DPT-HepB-Hib) 2', 'age' => '10 weeks',  'days' => 70],
    ['name' => 'OPV 2nd dose',                'age' => '10 weeks',  'days' => 70],
    ['name' => 'PCV 2nd dose',                'age' => '10 weeks',  'days' => 70],
    ['name' => 'Pentavalent (DPT-HepB-Hib) 3', 'age' => '14 weeks',  'days' => 98],
    ['name' => 'OPV 3rd dose',                'age' => '14 weeks',  'days' => 98],
    ['name' => 'PCV 3rd dose',                'age' => '14 weeks',  'days' => 98],
    ['name' => 'IPV',                         'age' => '14 weeks',  'days' => 98],
    ['name' => 'MMR (Measles, Mumps, Rubella)', 'age' => '9 months', 'days' => 270],
];
function seed_default_vaccinations($pdo, $userId, $deliveryDate){
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM baby_vaccinations WHERE user_id=?");
    $stmt->execute([$userId]);
    if ((int)$stmt->fetchColumn() > 0) return; // already seeded, don't duplicate

    $sort = 0;
    foreach (DEFAULT_VACCINES as $v){
        $dueDate = $deliveryDate ? date('Y-m-d', strtotime($deliveryDate . " + {$v['days']} days")) : null;
        $pdo->prepare("INSERT INTO baby_vaccinations (id, user_id, vaccine_name, due_age_label, due_date, sort_order) VALUES (?,?,?,?,?,?)")
            ->execute([uid('vax'), $userId, $v['name'], $v['age'], $dueDate, $sort++]);
    }
}

// Default hospital bag checklist — seeded once, then the user can check items
// off and add their own; nothing here is a static/unsaved list.
const DEFAULT_HOSPITAL_BAG = [
    'For Mom' => ['ID and hospital documents', 'Comfortable robe or nightgown', 'Nursing bra and pads', 'Toiletries', 'Going-home outfit', 'Phone charger'],
    'For Baby' => ['Going-home outfit', 'Diapers (newborn size)', 'Baby blanket', 'Baby wipes', 'Mittens and socks'],
    'For Partner/Support' => ['Snacks and water', 'Change of clothes', 'Camera or phone charger', 'Entertainment (book, tablet)'],
];
function seed_default_hospital_bag($pdo, $userId){
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM hospital_bag_items WHERE user_id=?");
    $stmt->execute([$userId]);
    if ((int)$stmt->fetchColumn() > 0) return;

    $sort = 0;
    foreach (DEFAULT_HOSPITAL_BAG as $cat => $items){
        foreach ($items as $label){
            $pdo->prepare("INSERT INTO hospital_bag_items (id, user_id, label, category, sort_order) VALUES (?,?,?,?,?)")
                ->execute([uid('bag'), $userId, $label, $cat, $sort++]);
        }
    }
}

// ---------- Language toggle (English / Bisaya) ----------
// Only the shared chrome (nav, topbar, bottom nav) and a few key labels are
// translated so far — t() falls back to the English key itself for anything
// not yet in the dictionary, so untranslated strings never break.
const TRANSLATIONS = [
    'Dashboard'            => ['bi' => 'Dashboard'],
    'Vitals Monitoring'    => ['bi' => 'Vitals'],
    'Symptom Check-in'     => ['bi' => 'Check-in sa Sintomas'],
    'Risk Analysis'        => ['bi' => 'Risk Analysis'],
    'Recommendations'      => ['bi' => 'Mga Sugyot'],
    'Education Hub'        => ['bi' => 'Education Hub'],
    'Notifications'        => ['bi' => 'Mga Notification'],
    'My Profile'           => ['bi' => 'Akong Profile'],
    'Log Out'              => ['bi' => 'Log Out'],
    'Home'                 => ['bi' => 'Home'],
    'Vitals'               => ['bi' => 'Vitals'],
    'Check-in'             => ['bi' => 'Check-in'],
    'Risk'                 => ['bi' => 'Risk'],
    'Advice'               => ['bi' => 'Tambag'],
    'Profile'              => ['bi' => 'Profile'],
    'Wellness Tools'       => ['bi' => 'Wellness Tools'],
    'Medications & Vitamins' => ['bi' => 'Tambal & Bitamina'],
    'Weight Gain Tracker'  => ['bi' => 'Timbang Tracker'],
    'Journal'              => ['bi' => 'Journal'],
    'Bump Photo Timeline'  => ['bi' => 'Litrato sa Bump'],
    'Toggle Dark Mode'     => ['bi' => 'Ilis og Dark Mode'],
    'Welcome back'         => ['bi' => 'Welcome balik'],
    'Log In'               => ['bi' => 'Log In'],
    'Sign Up'              => ['bi' => 'Pag-Sign Up'],
];
function t($key){
    global $pdo;
    $lang = $_SESSION['lang'] ?? 'en';
    if ($lang === 'bi' && isset(TRANSLATIONS[$key]['bi'])) return TRANSLATIONS[$key]['bi'];
    return $key;
}
function set_language($lang){
    $_SESSION['lang'] = in_array($lang, ['en','bi']) ? $lang : 'en';
}
function uid($prefix){ return $prefix . '_' . substr(bin2hex(random_bytes(5)), 0, 9); }
function now_iso(){ return date('Y-m-d H:i:s'); }
function today_iso(){ return date('Y-m-d'); }

// Checks the patient's saved OB-GYN visit date and, if it's within the
// reminder window (3 days or less away, including today), makes sure a
// notification exists for it — created once per visit date, not duplicated
// on every page load. Runs on every patient page load since this app has
// no background/cron job runner.
function check_ob_visit_reminder($pdo, $u){
    $stmt = $pdo->prepare("SELECT next_ob_visit, edd FROM patient_profiles WHERE user_id=?");
    $stmt->execute([$u['id']]);
    $profile = $stmt->fetch();
    if (!$profile) return;

    $nextVisit = $profile['next_ob_visit'] ?? null;
    if ($nextVisit){
        $daysToVisit = (int)ceil((strtotime($nextVisit) - time()) / 86400);
        if ($daysToVisit >= 0 && $daysToVisit <= 3){
            $visitLabel = date('M j, Y', strtotime($nextVisit));
            $body = $daysToVisit === 0
                ? "Your prenatal checkup is today ({$visitLabel})."
                : "Your prenatal checkup is in {$daysToVisit} day(s), on {$visitLabel}.";

            // Dedupe on the exact body text so each day (3, 2, 1, 0 days away) still
            // gets its own fresh reminder as the date gets closer, instead of only
            // ever firing once for the whole countdown.
            $stmt = $pdo->prepare("SELECT id FROM notifications WHERE user_id=? AND title=? AND body=?");
            $stmt->execute([$u['id'], 'OB-GYN Visit Reminder', $body]);
            if (!$stmt->fetch()){
                $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                    ->execute([uid('ntf'), $u['id'], 'OB-GYN Visit Reminder', $body, now_iso(), 'ob_visit']);
            }
        }
    }

    // Separate reminder for the pregnancy due date (EDD) itself.
    $edd = $profile['edd'] ?? null;
    if ($edd){
        $daysToEdd = (int)ceil((strtotime($edd) - time()) / 86400);
        if ($daysToEdd >= 0 && $daysToEdd <= 3){
            $eddLabel = date('M j, Y', strtotime($edd));
            $body = $daysToEdd === 0
                ? "Today is your expected due date ({$eddLabel})! Contact your OB-GYN if labor signs begin."
                : "Your expected due date is in {$daysToEdd} day(s), on {$eddLabel}.";

            $stmt = $pdo->prepare("SELECT id FROM notifications WHERE user_id=? AND title=? AND body=?");
            $stmt->execute([$u['id'], 'Due Date Reminder', $body]);
            if (!$stmt->fetch()){
                $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
                    ->execute([uid('ntf'), $u['id'], 'Due Date Reminder', $body, now_iso(), 'due_date']);
            }
        }
    }
}
function redirect($path){ header("Location: $path"); exit; }

function flash($msg = null, $kind = 'info'){
    if ($msg !== null){ $_SESSION['flash'][] = ['msg'=>$msg,'kind'=>$kind]; return; }
    $out = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $out;
}

function fmt_date($iso){
    if (!$iso) return '—';
    return date('M j, Y', strtotime($iso));
}
function fmt_datetime($iso){
    if (!$iso) return '—';
    return date('M j, g:i A', strtotime($iso));
}
function initials($name){
    $parts = preg_split('/\s+/', trim($name ?? '?'));
    $init = '';
    foreach (array_slice($parts, 0, 2) as $p) if ($p !== '') $init .= mb_strtoupper(mb_substr($p, 0, 1));
    return $init ?: '?';
}

// ---------- 4. AUTH HELPERS ----------
function current_user(){
    global $pdo;
    if (empty($_SESSION['user_id'])) return null;
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

function require_login(){
    if (empty($_SESSION['user_id'])) redirect('login.php');
}

function require_role($role){
    require_login();
    $u = current_user();
    if (!$u || $u['role'] !== $role){
        redirect($u ? role_home($u['role']) : 'login.php');
    }
    return $u;
}

function role_home($role){
    return 'dashboard.php';
}

function log_action($action){
    global $pdo;
    $email = $_SESSION['user_email'] ?? 'guest';
    $stmt = $pdo->prepare("INSERT INTO audit_logs (id, action, at, by_email) VALUES (?,?,?,?)");
    $stmt->execute([uid('log'), $action, now_iso(), $email]);
}

// ---------- 5. STATIC REFERENCE DATA ----------
const SEVERITY_LEVELS = ['None','Mild','Moderate','Severe'];
const DURATION_LEVELS = ['Today','1–3 Days','More than 3 Days'];
const FREQUENCY_LEVELS = ['Rare','Sometimes','Often','Always'];

// Clinical risk-scoring rules (Reproductive History, Medical/Surgical Conditions,
// Present Pregnancy Problems) — replaces the old AHP weighting scheme entirely.
// Each rule's 'points' are added to the total structural risk score when its
// condition is met; that total is then classified via fuzzy logic (see
// compute_structural_risk() / classify_structural_score() below).
const RULE_SCORES = [
    // ---- Reproductive History (RH) ----
    'RH-01' => ['label' => 'Maternal age ≤ 16',                         'points' => 1, 'cat' => 'RH'],
    'RH-02' => ['label' => 'Maternal age > 35',                         'points' => 2, 'cat' => 'RH'],
    'RH-03' => ['label' => 'Parity = 0 (first pregnancy)',              'points' => 1, 'cat' => 'RH'],
    'RH-05' => ['label' => 'Parity > 4',                                'points' => 2, 'cat' => 'RH'],
    'RH-06' => ['label' => '2+ prior abortions or infertility history', 'points' => 1, 'cat' => 'RH'],
    'RH-07' => ['label' => 'Previous postpartum hemorrhage',            'points' => 1, 'cat' => 'RH'],
    'RH-08' => ['label' => 'Previous manual removal of placenta',       'points' => 1, 'cat' => 'RH'],
    'RH-09' => ['label' => 'Previous baby over 9 lb',                   'points' => 1, 'cat' => 'RH'],
    'RH-10' => ['label' => 'Previous baby over 5 lb 8 oz',              'points' => 1, 'cat' => 'RH'],
    'RH-11' => ['label' => 'Previous toxemia / hypertension',           'points' => 1, 'cat' => 'RH'],
    'RH-12' => ['label' => 'Previous cesarean section',                 'points' => 2, 'cat' => 'RH'],
    'RH-13' => ['label' => 'Previous abnormal or difficult labor',      'points' => 2, 'cat' => 'RH'],
    // ---- Medical/Surgical Conditions (MC) ----
    'MC-01' => ['label' => 'Previous gynecological disease',            'points' => 1, 'cat' => 'MC'],
    'MC-02' => ['label' => 'Chronic renal disease',                     'points' => 1, 'cat' => 'MC'],
    'MC-03' => ['label' => 'Gestational diabetes',                      'points' => 1, 'cat' => 'MC'],
    'MC-04' => ['label' => 'Class B diabetes or higher',                'points' => 3, 'cat' => 'MC'],
    'MC-05' => ['label' => 'Cardiac disease',                           'points' => 3, 'cat' => 'MC'],
    // MC-06 (other significant medical disease) is variable (+1 to +5) and added separately.
    // ---- Present Pregnancy Problems (PP) ----
    'PP-01' => ['label' => 'Bleeding before 20 weeks',                  'points' => 3, 'cat' => 'PP'],
    'PP-02' => ['label' => 'Bleeding after 20 weeks',                   'points' => 1, 'cat' => 'PP'],
    'PP-03' => ['label' => 'Anemia (hemoglobin < 10 g%)',               'points' => 1, 'cat' => 'PP'],
    'PP-04' => ['label' => 'Postmaturity / prematurity',                'points' => 1, 'cat' => 'PP'],
    'PP-05' => ['label' => 'Hypertension',                              'points' => 2, 'cat' => 'PP'],
    'PP-06' => ['label' => 'Premature rupture of membrane',             'points' => 1, 'cat' => 'PP'],
    'PP-07' => ['label' => 'Polyhydramnios / oligohydramnios',          'points' => 1, 'cat' => 'PP'],
    'PP-08' => ['label' => 'Intrauterine growth restriction (IUGR)',    'points' => 1, 'cat' => 'PP'],
    'PP-09' => ['label' => 'Multiple pregnancy',                        'points' => 1, 'cat' => 'PP'],
    'PP-10' => ['label' => 'Breech / malpresentation',                  'points' => 1, 'cat' => 'PP'],
    'PP-11' => ['label' => 'Rh isoimmunization',                        'points' => 3, 'cat' => 'PP'],
];
const RULE_CAT_LABELS = ['RH' => 'Reproductive History', 'MC' => 'Medical/Surgical Conditions', 'PP' => 'Present Pregnancy Problems'];

const KNOWLEDGE_BASE = [
    ['cat'=>'Warning Signs','title'=>'Danger signs that need same-day care','body'=>'Severe headache with vision changes, heavy vaginal bleeding, sudden swelling of face/hands, reduced fetal movement, and convulsions are signs that should never wait for a scheduled visit.'],
    ['cat'=>'Nutrition','title'=>'Iron & folic acid basics','body'=>'Iron-rich foods (leafy greens, legumes, lean meat) plus prescribed supplements help prevent anemia, one of the most common contributors to moderate risk scores.'],
    ['cat'=>'Exercise','title'=>'Safe movement by trimester','body'=>'Walking, prenatal yoga, and swimming are generally safe. Avoid contact sports, activities with fall risk, and exercising flat on your back after the first trimester.'],
    ['cat'=>'Medication','title'=>'What to ask before taking anything','body'=>'Always confirm with your OB-GYN before starting any medication or supplement, including over-the-counter pain relief, during pregnancy.'],
    ['cat'=>'FAQ','title'=>'How is my risk score calculated?','body'=>'PregnaCare scores reproductive history, medical conditions, and present pregnancy problems using a clinical rule table, then classifies the total with fuzzy logic into Low/High/Severe — plus a rule-based safety layer that can escalate to Severe immediately when specific danger patterns appear.'],
    ['cat'=>'Hospital Contacts','title'=>'Keep this list handy','body'=>"Save your OB-GYN's direct line, your delivery hospital's labor & delivery unit, and a 24/7 nurse hotline in your emergency contacts."],
];

const EMERGENCY_HOTLINES = [
    ['name'=>'Local Emergency Services','number'=>'911'],
    ['name'=>'OB-GYN On-Call Line','number'=>'(555) 010-2288'],
    ['name'=>'Maternal Nurse Hotline (24/7)','number'=>'(555) 010-9100'],
];

function get_symptom_catalog(){
    global $pdo;
    return $pdo->query("SELECT * FROM symptom_catalog ORDER BY name")->fetchAll();
}
function get_risk_history($pdo, $userId){
    $stmt = $pdo->prepare("SELECT * FROM risk_history WHERE user_id=?");
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}
function get_latest_pregnancy_problems($pdo, $userId){
    $stmt = $pdo->prepare("SELECT * FROM pregnancy_problems WHERE user_id=? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: [];
}
function get_rule_base(){
    global $pdo;
    return $pdo->query("SELECT * FROM rule_base ORDER BY id")->fetchAll();
}

// ---------- 6. UI HELPERS ----------
function risk_badge_class($level){
    if ($level === 'Severe') return 'badge-high';
    if ($level === 'High') return 'badge-mod';
    return 'badge-low';
}
function risk_color_var($level){
    if ($level === 'Severe') return '--risk-high';
    if ($level === 'High') return '--risk-mod';
    return '--risk-low';
}
function polar_to_cartesian($cx,$cy,$r,$angleDeg){
    $a = deg2rad($angleDeg - 90);
    return ['x' => $cx + $r*cos($a), 'y' => $cy + $r*sin($a)];
}
function describe_arc($cx,$cy,$r,$startAngle,$endAngle){
    $start = polar_to_cartesian($cx,$cy,$r,$endAngle);
    $end   = polar_to_cartesian($cx,$cy,$r,$startAngle);
    $largeArcFlag = ($endAngle - $startAngle) <= 180 ? '0' : '1';
    return "M {$start['x']} {$start['y']} A $r $r 0 $largeArcFlag 0 {$end['x']} {$end['y']}";
}
function risk_gauge_svg($score, $level, $size = 190){
    $cx = $size/2; $cy = $size*0.58; $r = $size*0.42;
    $angle = -90 + ($score/100)*180;
    $rad = deg2rad($angle - 90);
    $nx = $cx + $r*0.78*cos($rad); $ny = $cy + $r*0.78*sin($rad);
    $colorVar = risk_color_var($level);
    $track = describe_arc($cx,$cy,$r,-90,90);
    $fillArc = describe_arc($cx,$cy,$r,-90,$angle);
    $h = $size*0.68;
    return "<svg width=\"$size\" height=\"$h\" viewBox=\"0 0 $size $h\">
        <path d=\"$track\" fill=\"none\" stroke=\"var(--bg-soft)\" stroke-width=\"16\" stroke-linecap=\"round\"/>
        <path d=\"$fillArc\" fill=\"none\" stroke=\"var($colorVar)\" stroke-width=\"16\" stroke-linecap=\"round\"/>
        <circle cx=\"$cx\" cy=\"$cy\" r=\"6\" fill=\"var(--ink)\"/>
        <line x1=\"$cx\" y1=\"$cy\" x2=\"$nx\" y2=\"$ny\" stroke=\"var(--ink)\" stroke-width=\"3.5\" stroke-linecap=\"round\"/>
    </svg>";
}

// ---------- Baby size by week (illustrative comparison, not a medical image) ----------
const BABY_SIZE_BY_WEEK = [
    4=>['Poppy Seed','🌱'], 5=>['Sesame Seed','🫘'], 6=>['Lentil','🫘'], 7=>['Blueberry','🫐'],
    8=>['Raspberry','🍇'], 9=>['Peanut','🥜'], 10=>['Kumquat','🟠'], 11=>['Fig','🟣'],
    12=>['Lime','🟢'], 13=>['Lemon','🍋'], 14=>['Peach','🍑'], 15=>['Apple','🍎'],
    16=>['Avocado','🥑'], 17=>['Pear','🍐'], 18=>['Bell Pepper','🫑'], 19=>['Mango','🥭'],
    20=>['Banana','🍌'], 21=>['Carrot','🥕'], 22=>['Papaya','🟠'], 23=>['Grapefruit','🍊'],
    24=>['Corn','🌽'], 25=>['Cauliflower','🥦'], 26=>['Lettuce','🥬'], 27=>['Rutabaga','🟤'],
    28=>['Eggplant','🍆'], 29=>['Butternut Squash','🎃'], 30=>['Cabbage','🥬'], 31=>['Coconut','🥥'],
    32=>['Jicama','🥔'], 33=>['Pineapple','🍍'], 34=>['Cantaloupe','🍈'], 35=>['Honeydew Melon','🍈'],
    36=>['Romaine Lettuce','🥬'], 37=>['Swiss Chard','🥬'], 38=>['Leek','🧅'], 39=>['Mini Watermelon','🍉'],
    40=>['Small Pumpkin','🎃'],
];
function baby_size_for_week($weeks){
    $weeks = max(4, min(40, (int)$weeks));
    return BABY_SIZE_BY_WEEK[$weeks] ?? ['Growing Baby','👶'];
}
// Simple abstract "curled up" silhouette -- illustrative only, not a real/medical image.
function baby_silhouette_svg($sizePx = 90, $colorVar = '--teal'){
    return "<svg width=\"$sizePx\" height=\"$sizePx\" viewBox=\"0 0 100 100\">
        <circle cx=\"50\" cy=\"50\" r=\"46\" fill=\"var($colorVar)\" opacity=\"0.12\"/>
        <path d=\"M62 28c10 4 14 16 10 27-3 8-2 15 4 20-9 6-22 4-29-4-6-7-14-9-18-6 1-11 8-19 16-23-4-7-2-16 5-20 4-2 9-1 12 6z\"
              fill=\"var($colorVar)\" opacity=\"0.85\"/>
        <circle cx=\"40\" cy=\"38\" r=\"7\" fill=\"var($colorVar)\"/>
    </svg>";
}

function contrib_bar($name, $pct){
    $pct = min(100, max(0,$pct));
    return "<div class=\"contrib-bar-row\">
        <div class=\"name\">" . e($name) . "</div>
        <div class=\"contrib-bar-track\"><div class=\"contrib-bar-fill\" style=\"width:{$pct}%\"></div></div>
        <div class=\"contrib-bar-pct\">" . number_format($pct,0) . "%</div>
    </div>";
}

// ---------- 7. LAYOUT (header / footer) ----------
function render_header($title, $active = ''){
    global $active_page, $pdo;
    $active_page = $active;
    $u = current_user();
    $flashes = flash();
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
<title><?php echo e($title); ?> — PregnaCare</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<link rel="stylesheet" href="css/style.css?v=<?php echo @filemtime(__DIR__.'/css/style.css') ?: time(); ?>" />
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0E9C8F">
<script>
  // Apply saved theme before paint, to avoid a light/dark flash
  (function(){
    if (localStorage.getItem('pregnacare_theme') === 'dark') document.documentElement.setAttribute('data-theme','dark');
  })();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
</script>
</head>
<body>
<div class="toast-root" id="toast-root">
<?php foreach ($flashes as $f): ?>
  <div class="toast"><i class="fa-solid <?php echo $f['kind']==='error'?'fa-circle-exclamation':($f['kind']==='success'?'fa-circle-check':'fa-circle-info'); ?>" style="margin-right:8px;"></i><?php echo e($f['msg']); ?></div>
<?php endforeach; ?>
</div>
<?php if ($u): ?>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <div class="mark"><i class="fa-solid fa-heart-pulse"></i></div>
      <div class="name">PregnaCare<small><?php echo e(ucfirst($u['role'])); ?> Panel</small></div>
    </div>
    <?php if ($u['role'] === 'patient'): ?>
      <div class="nav-group-label">Care</div>
      <a class="nav-link <?php echo $active==='dashboard'?'active':''; ?>" href="dashboard.php"><i class="fa-solid fa-gauge-high"></i> <?php echo t('Dashboard'); ?></a>
      <a class="nav-link <?php echo $active==='monitoring'?'active':''; ?>" href="monitoring.php"><i class="fa-solid fa-heart-pulse"></i> <?php echo t('Vitals Monitoring'); ?></a>
      <a class="nav-link <?php echo $active==='reminders'?'active':''; ?>" href="reminders.php"><i class="fa-solid fa-bell"></i> Reminders</a>
      <a class="nav-link <?php echo $active==='symptoms'?'active':''; ?>" href="symptoms.php"><i class="fa-solid fa-notes-medical"></i> <?php echo t('Symptom Check-in'); ?></a>
      <a class="nav-link <?php echo $active==='analyze'?'active':''; ?>" href="analyze.php"><i class="fa-solid fa-diagram-project"></i> <?php echo t('Risk Analysis'); ?></a>
      <a class="nav-link <?php echo $active==='recommendations'?'active':''; ?>" href="recommendations.php"><i class="fa-solid fa-lightbulb"></i> <?php echo t('Recommendations'); ?></a>
      <div class="nav-group-label">Wellness</div>
      <a class="nav-link <?php echo $active==='medications'?'active':''; ?>" href="medications.php"><i class="fa-solid fa-pills"></i> <?php echo t('Medications & Vitamins'); ?></a>
      <a class="nav-link <?php echo $active==='weight_tracker'?'active':''; ?>" href="weight_tracker.php"><i class="fa-solid fa-weight-scale"></i> <?php echo t('Weight Gain Tracker'); ?></a>
      <a class="nav-link <?php echo $active==='journal'?'active':''; ?>" href="journal.php"><i class="fa-solid fa-book"></i> <?php echo t('Journal'); ?></a>
      <a class="nav-link <?php echo $active==='bump_photos'?'active':''; ?>" href="bump_photos.php"><i class="fa-solid fa-camera"></i> <?php echo t('Bump Photo Timeline'); ?></a>
      <a class="nav-link <?php echo $active==='birth_plan'?'active':''; ?>" href="birth_plan.php"><i class="fa-solid fa-clipboard-list"></i> Birth Plan</a>
      <a class="nav-link <?php echo $active==='hospital_bag'?'active':''; ?>" href="hospital_bag.php"><i class="fa-solid fa-suitcase-medical"></i> Hospital Bag Checklist</a>
      <a class="nav-link <?php echo $active==='postpartum'?'active':''; ?>" href="postpartum.php"><i class="fa-solid fa-baby"></i> Postpartum &amp; Baby Care</a>
      <div class="nav-group-label">Learn</div>
      <a class="nav-link <?php echo $active==='education'?'active':''; ?>" href="education.php"><i class="fa-solid fa-book-medical"></i> <?php echo t('Education Hub'); ?></a>
      <a class="nav-link <?php echo $active==='meal_planner'?'active':''; ?>" href="meal_planner.php"><i class="fa-solid fa-utensils"></i> Meal Planner</a>
      <div class="nav-group-label">Account</div>
      <a class="nav-link <?php echo $active==='notifications'?'active':''; ?>" href="notifications.php"><i class="fa-solid fa-bell"></i> Notifications</a>
      <a class="nav-link <?php echo $active==='profile'?'active':''; ?>" href="profile.php"><i class="fa-solid fa-user"></i> Profile</a>
    <?php endif; ?>
    <div style="margin-top:auto;">
      <a class="nav-link js-logout" href="logout.php" onclick="return pcConfirmLogout(event)"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log Out</a>
    </div>
  </aside>
  <div class="main">
    <div class="topbar">
      <h2 style="margin:0;font-size:18px;"><?php echo e($title); ?></h2>
      <?php if ($u['role'] === 'patient'): ?>
      <div class="topbar-brand-row">
        <span class="wt-brand-mobile">PregnaCare</span>
      </div>
      <?php endif; ?>
      <div class="topbar-user-row">
        <?php if ($u['role'] === 'patient'):
            check_ob_visit_reminder($pdo, $u);
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0");
            $stmt->execute([$u['id']]);
            $unreadCount = (int)$stmt->fetchColumn();
        ?>
        <a class="icon-btn wt-hamburger-btn" href="javascript:void(0)" onclick="pcToggleWellnessDrawer()" title="Wellness Tools">
          <i class="fa-solid fa-bars"></i>
        </a>
        <a class="icon-btn" href="notifications.php" title="Notifications" style="position:relative;">
          <i class="fa-solid fa-bell"></i>
          <?php if ($unreadCount > 0): ?>
            <span style="position:absolute;top:-4px;right:-4px;background:var(--risk-high);color:#fff;font-size:10px;font-weight:800;min-width:16px;height:16px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0 4px;line-height:1;"><?php echo $unreadCount > 9 ? '9+' : $unreadCount; ?></span>
          <?php endif; ?>
        </a>
        <?php endif; ?>
        <div class="avatar"><?php echo e(initials($u['name'])); ?></div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw;"><?php echo e($u['name']); ?></div>
          <div class="muted" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw;"><?php echo e($u['email']); ?></div>
        </div>
      </div>
    </div>
    <div class="content">
<?php endif;
}

function render_bottom_nav($active, $role){
    if ($role !== 'patient') return;
?>
<nav class="bottom-nav">
  <a href="dashboard.php" class="<?php echo $active==='dashboard'?'active':''; ?>"><i class="fa-solid fa-gauge-high"></i><?php echo t('Home'); ?></a>
  <a href="monitoring.php" class="<?php echo $active==='monitoring'?'active':''; ?>"><i class="fa-solid fa-heart-pulse"></i><?php echo t('Vitals'); ?></a>
  <a href="symptoms.php" class="<?php echo $active==='symptoms'?'active':''; ?>"><i class="fa-solid fa-notes-medical"></i><?php echo t('Check-in'); ?></a>
  <a href="analyze.php" class="<?php echo $active==='analyze'?'active':''; ?>"><i class="fa-solid fa-diagram-project"></i><?php echo t('Risk'); ?></a>
  <a href="recommendations.php" class="<?php echo $active==='recommendations'?'active':''; ?>"><i class="fa-solid fa-lightbulb"></i><?php echo t('Advice'); ?></a>
  <a href="profile.php" class="<?php echo $active==='profile'?'active':''; ?>"><i class="fa-solid fa-user"></i><?php echo t('Profile'); ?></a>
</nav>
<?php
}

function render_footer(){
    $u = current_user();
    global $active_page; // set by each page before calling render_header, reused here for bottom nav
    if ($u):
?>
    </div>
  </div>
</div>
<?php if ($u['role'] === 'patient'): ?>
<div class="wt-drawer-backdrop" id="wtDrawerBackdrop" onclick="pcToggleWellnessDrawer()"></div>
<aside class="wt-drawer" id="wtDrawer">
  <div class="wt-drawer-header">
    <span>Wellness Tools</span>
    <button type="button" class="ed-close" onclick="pcToggleWellnessDrawer()" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
  </div>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='education'?'active':''; ?>" href="education.php"><i class="fa-solid fa-book-medical"></i> <?php echo t('Education Hub'); ?></a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='meal_planner'?'active':''; ?>" href="meal_planner.php"><i class="fa-solid fa-utensils"></i> Meal Planner</a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='medications'?'active':''; ?>" href="medications.php"><i class="fa-solid fa-pills"></i> <?php echo t('Medications & Vitamins'); ?></a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='weight_tracker'?'active':''; ?>" href="weight_tracker.php"><i class="fa-solid fa-weight-scale"></i> <?php echo t('Weight Gain Tracker'); ?></a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='journal'?'active':''; ?>" href="journal.php"><i class="fa-solid fa-book"></i> <?php echo t('Journal'); ?></a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='bump_photos'?'active':''; ?>" href="bump_photos.php"><i class="fa-solid fa-camera"></i> <?php echo t('Bump Photo Timeline'); ?></a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='birth_plan'?'active':''; ?>" href="birth_plan.php"><i class="fa-solid fa-clipboard-list"></i> Birth Plan</a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='hospital_bag'?'active':''; ?>" href="hospital_bag.php"><i class="fa-solid fa-suitcase-medical"></i> Hospital Bag Checklist</a>
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='postpartum'?'active':''; ?>" href="postpartum.php"><i class="fa-solid fa-baby"></i> Postpartum &amp; Baby Care</a>
  <div class="wt-drawer-divider"></div>
  <div class="wt-drawer-link" style="justify-content:space-between;cursor:default;">
    <span><i class="fa-solid fa-language"></i> Language</span>
    <span style="display:flex;gap:4px;">
      <a href="set_lang.php?lang=en" style="padding:4px 10px;border-radius:8px;font-size:12px;font-weight:800;<?php echo ($_SESSION['lang'] ?? 'en')==='en' ? 'background:var(--teal);color:#fff;' : 'color:var(--ink-soft);'; ?>">EN</a>
      <a href="set_lang.php?lang=bi" style="padding:4px 10px;border-radius:8px;font-size:12px;font-weight:800;<?php echo ($_SESSION['lang'] ?? 'en')==='bi' ? 'background:var(--teal);color:#fff;' : 'color:var(--ink-soft);'; ?>">BI</a>
    </span>
  </div>
  <button type="button" class="wt-drawer-link" style="width:100%;background:none;border:none;text-align:left;cursor:pointer;font-family:inherit;" onclick="toggleThemeMode()">
    <i class="fa-solid fa-circle-half-stroke"></i> <?php echo t('Toggle Dark Mode'); ?>
  </button>
  <a class="wt-drawer-link js-logout" href="logout.php" style="color:var(--risk-high);" onclick="return pcConfirmLogout(event)">
    <i class="fa-solid fa-arrow-right-from-bracket" style="color:var(--risk-high);"></i> <?php echo t('Log Out'); ?>
  </a>
</aside>
<?php endif; ?>
<div class="ed-modal-backdrop" id="logoutModalBackdrop">
  <div class="ed-modal" style="max-width:340px;text-align:center;">
    <div class="ed-icon-lg" style="margin:0 auto 14px;background:var(--risk-high-bg);color:var(--risk-high);">
      <i class="fa-solid fa-arrow-right-from-bracket"></i>
    </div>
    <div class="ed-detail-title" style="text-align:center;margin-bottom:6px;">Log Out?</div>
    <p class="ed-explain" style="text-align:center;">Are you sure you want to log out of PregnaCare?</p>
    <div style="display:flex;gap:10px;">
      <button type="button" class="btn btn-outline" style="flex:1;" onclick="pcCloseLogoutModal()">Cancel</button>
      <a href="logout.php" class="btn btn-danger" style="flex:1;">Log Out</a>
    </div>
  </div>
</div>
<?php render_bottom_nav($active_page ?? '', $u['role']); ?>
<a class="emergency-fab" href="tel:911"><i class="fa-solid fa-phone-volume"></i> Emergency</a>
<script>
function toggleThemeMode(){
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark){ document.documentElement.removeAttribute('data-theme'); localStorage.setItem('pregnacare_theme','light'); }
  else { document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('pregnacare_theme','dark'); }
}

// Used by "pick from a list, or type your own" fields (e.g. supplement name/dosage/schedule).
// selectEl: the <select> that was just changed. otherInputId: id of the paired text <input>.
function pcToggleOther(selectEl, otherInputId){
  const otherInput = document.getElementById(otherInputId);
  if (!otherInput) return;
  if (selectEl.value === '__other__'){
    selectEl.disabled = true;
    selectEl.style.display = 'none';
    otherInput.disabled = false;
    otherInput.style.display = '';
    otherInput.required = selectEl.required;
    otherInput.focus();
  } else {
    otherInput.disabled = true;
    otherInput.style.display = 'none';
    otherInput.value = '';
  }
}

// Replaces every <select class="select-pill"> with a fully custom, themed
// dropdown — the browser's native option list can't be restyled, so we
// build our own popup list instead (keeps the pink/coral theme even open).
function pcEnhanceSelectPills(){
  document.querySelectorAll('select.select-pill').forEach(function(sel){
    if (sel.dataset.pcEnhanced) return;
    sel.dataset.pcEnhanced = '1';

    var name = sel.getAttribute('name');
    var options = Array.prototype.map.call(sel.options, function(o){
      return { value: o.value, text: o.textContent, selected: o.selected };
    });
    var current = options.filter(function(o){ return o.selected; })[0] || options[0];

    var wrap = document.createElement('div');
    wrap.className = 'csel';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'csel-btn select-pill';
    btn.textContent = current ? current.text : '';

    var list = document.createElement('div');
    list.className = 'csel-list';
    list.hidden = true;

    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = name;
    hidden.value = current ? current.value : '';

    options.forEach(function(o){
      var item = document.createElement('div');
      item.className = 'csel-opt' + (o.selected ? ' is-selected' : '');
      item.textContent = o.text;
      item.addEventListener('click', function(){
        hidden.value = o.value;
        btn.textContent = o.text;
        list.hidden = true;
        list.querySelectorAll('.csel-opt').forEach(function(el){ el.classList.remove('is-selected'); });
        item.classList.add('is-selected');
      });
      list.appendChild(item);
    });

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      document.querySelectorAll('.csel-list').forEach(function(l){ if (l !== list) l.hidden = true; });
      list.hidden = !list.hidden;
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);
    wrap.appendChild(hidden);
    sel.replaceWith(wrap);
  });
}
document.addEventListener('DOMContentLoaded', pcEnhanceSelectPills);
document.addEventListener('click', function(){
  document.querySelectorAll('.csel-list').forEach(function(l){ l.hidden = true; });
});

// Education Hub — trimester tabs (fade+slide on switch) and icon-grid cards
// that pop their full detail up in a centered modal when tapped.
function pcInitEducationHub(){
  var tabs = document.querySelectorAll('.trimester-tabs button');
  if (!tabs.length) return;
  var panels = document.querySelectorAll('.trimester-panel');
  var modalBackdrop = document.getElementById('edModalBackdrop');
  var modalBody = document.getElementById('edModalBody');

  function openModal(card){
    if (!modalBackdrop || !modalBody) return;
    var detail = card.querySelector('.ed-card-detail');
    if (!detail) return;
    modalBody.innerHTML = detail.innerHTML;
    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(){
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = btn.dataset.trimester;
      tabs.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      closeModal();
      panels.forEach(function(p){
        if (p.dataset.trimester === target){
          p.style.display = 'block';
          p.classList.remove('pc-animate');
          void p.offsetWidth; // restart the animation each time it's shown
          p.classList.add('pc-animate');
        } else {
          p.style.display = 'none';
        }
      });
    });
  });

  document.querySelectorAll('.ed-card').forEach(function(card){
    card.querySelector('.ed-card-summary').addEventListener('click', function(){
      openModal(card);
    });
  });

  if (modalBackdrop){
    modalBackdrop.addEventListener('click', function(e){
      if (e.target === modalBackdrop) closeModal();
    });
  }
  if (modalBody){
    modalBody.addEventListener('click', function(e){
      if (e.target.closest('.ed-close')) closeModal();
    });
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closeModal();
  });
}
document.addEventListener('DOMContentLoaded', pcInitEducationHub);

// Confirms before logging out — every "Log Out" link routes through this instead
// of navigating straight to logout.php.
function pcConfirmLogout(e){
  e.preventDefault();
  // Close the Wellness Tools drawer first (if open) so only the confirmation shows.
  var wtDrawer = document.getElementById('wtDrawer');
  var wtBackdrop = document.getElementById('wtDrawerBackdrop');
  if (wtDrawer) wtDrawer.classList.remove('open');
  if (wtBackdrop) wtBackdrop.classList.remove('open');

  var modal = document.getElementById('logoutModalBackdrop');
  if (modal){
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  return false;
}
function pcCloseLogoutModal(){
  var modal = document.getElementById('logoutModalBackdrop');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('click', function(e){
  var modal = document.getElementById('logoutModalBackdrop');
  if (modal && e.target === modal) pcCloseLogoutModal();
});

// Wellness Tools dropdown — opened from the hamburger icon in the topbar (mobile).
// Positioned dynamically right below the topbar so it works whether the header
// is one row or has wrapped onto two (icon row on top, title below).
function pcToggleWellnessDrawer(){
  var drawer = document.getElementById('wtDrawer');
  var backdrop = document.getElementById('wtDrawerBackdrop');
  if (!drawer || !backdrop) return;
  var isOpen = drawer.classList.toggle('open');
  if (isOpen){
    var topbar = document.querySelector('.topbar');
    if (topbar){
      var rect = topbar.getBoundingClientRect();
      drawer.style.top = (rect.bottom + 6) + 'px';
    }
  }
  backdrop.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}
</script>
<?php endif; ?>
</body>
</html>
<?php
}

// ============================================================
// 8. RISK ENGINE — Clinical Rule-Based Scoring (RH/MC/PP) + Fuzzy Logic + Acute-Symptom Rules
// Ported 1:1 from riskEngine.js. Decision support only, not diagnosis.
// ============================================================

function tri_membership($x,$a,$b,$c){
    if ($x <= $a || $x >= $c) return 0;
    if ($x == $b) return 1;
    if ($x < $b) return ($x - $a) / ($b - $a);
    return ($c - $x) / ($c - $b);
}
function shoulder_low($x,$b,$c){ if ($x <= $b) return 1; if ($x >= $c) return 0; return ($c-$x)/($c-$b); }
function shoulder_high($x,$a,$b){ if ($x >= $b) return 1; if ($x <= $a) return 0; return ($x-$a)/($b-$a); }

function fuzzy_sets($indicator, $v){
    switch ($indicator){
        case 'maternal_age': return ['low'=>shoulder_low($v,18,22), 'medium'=>tri_membership($v,20,27,35), 'high'=>shoulder_high($v,33,40)];
        case 'bp_sys':       return ['low'=>shoulder_low($v,90,110), 'medium'=>tri_membership($v,100,118,138), 'high'=>shoulder_high($v,130,150)];
        case 'bmi':          return ['low'=>shoulder_low($v,16,18.5), 'medium'=>tri_membership($v,18,24,30), 'high'=>shoulder_high($v,28,35)];
        case 'hemoglobin':   return ['low'=>shoulder_low($v,7,10.5), 'medium'=>tri_membership($v,10,12,14), 'high'=>shoulder_high($v,13,15)];
        case 'blood_sugar':  return ['low'=>shoulder_low($v,60,85), 'medium'=>tri_membership($v,80,110,140), 'high'=>shoulder_high($v,130,180)];
        case 'symptom_load': return ['low'=>shoulder_low($v,0,0.15), 'medium'=>tri_membership($v,0.1,0.4,0.7), 'high'=>shoulder_high($v,0.55,1)];
    }
    return ['low'=>0,'medium'=>0,'high'=>0];
}
function risk_degree_for($indicator, $value){
    $sets = fuzzy_sets($indicator, $value);
    if ($indicator === 'hemoglobin') return $sets['low']; // low Hb -> anemia risk
    return $sets['high'];
}

const SEV_SCORE  = ['None'=>0, 'Mild'=>0.33, 'Moderate'=>0.66, 'Severe'=>1];
const FREQ_SCORE = ['Rare'=>0.2, 'Sometimes'=>0.45, 'Often'=>0.75, 'Always'=>1];
const DUR_SCORE  = ['Today'=>0.3, '1–3 Days'=>0.6, 'More than 3 Days'=>1];

function symptom_load($symptomEntries, $catalog){
    if (!$symptomEntries) return 0;
    $catByld = [];
    foreach ($catalog as $c) $catByld[$c['id']] = $c;
    $total = 0; $maxPossible = 0;
    foreach ($symptomEntries as $s){
        $def = $catByld[$s['id']] ?? ['weight'=>0.5];
        $sev  = SEV_SCORE[$s['severity']] ?? 0;
        $freq = FREQ_SCORE[$s['frequency']] ?? 0.2;
        $dur  = DUR_SCORE[$s['duration']] ?? 0.3;
        $intensity = ($sev*0.55) + ($freq*0.25) + ($dur*0.2);
        $total += $intensity * $def['weight'];
        $maxPossible += $def['weight'];
    }
    return $maxPossible ? min(1, $total / ($maxPossible * 0.6)) : 0;
}

// ---------- Weight gain guidance (IOM-style ranges by pre-pregnancy BMI category) ----------
function bmi_category($bmi){
    if ($bmi < 18.5) return 'underweight';
    if ($bmi < 25) return 'normal';
    if ($bmi < 30) return 'overweight';
    return 'obese';
}
function bmi_category_label($cat){
    $labels = ['underweight'=>'Underweight','normal'=>'Normal Weight','overweight'=>'Overweight','obese'=>'Obese'];
    return $labels[$cat] ?? 'Normal Weight';
}
// Returns [minKg, maxKg] cumulative recommended weight gain by the given gestational week.
function recommended_weight_gain_range($category, $week){
    $week = max(0, min(40, $week));
    $firstTri = ['underweight'=>[0.5,2],'normal'=>[0.5,2],'overweight'=>[0.5,2],'obese'=>[0.3,1.5]];
    $weeklyRate = [
        'underweight'=>[0.44,0.58], 'normal'=>[0.35,0.50], 'overweight'=>[0.23,0.33], 'obese'=>[0.17,0.27],
    ];
    [$ftMin,$ftMax] = $firstTri[$category] ?? $firstTri['normal'];
    [$rMin,$rMax] = $weeklyRate[$category] ?? $weeklyRate['normal'];
    if ($week <= 13){
        return [round(($week/13)*$ftMin,1), round(($week/13)*$ftMax,1)];
    }
    $extraWeeks = $week - 13;
    return [round($ftMin + $extraWeeks*$rMin, 1), round($ftMax + $extraWeeks*$rMax, 1)];
}

function bmi_of($weightKg, $heightCm){
    if (!$weightKg || !$heightCm) return 22;
    $h = $heightCm/100;
    return round($weightKg / ($h*$h), 1);
}

function evaluate_rules($input, $ruleBase){
    $hits = [];
    $sym = function($id) use ($input){
        foreach ($input['symptoms'] as $s) if ($s['id'] === $id) return $s;
        return null;
    };
    $sevOf = function($id) use ($sym){ $s = $sym($id); return $s['severity'] ?? 'None'; };

    $bpHigh = $input['bp_sys'] >= 140 || $input['bp_dia'] >= 90;
    $headacheSevere = $sevOf('headache') === 'Severe';
    $bleedingSevere = $sevOf('bleeding') === 'Severe';
    $anyConvulsion  = $sevOf('convulsions') !== 'None';
    $breathingBad   = in_array($sevOf('difficulty_breathing'), ['Moderate','Severe']);
    $movementBad    = in_array($sevOf('reduced_movement'), ['Moderate','Severe']);
    $sugarHigh      = $input['blood_sugar'] >= 140;
    $laterTrimester = $input['trimester'] >= 2;
    $hbLow          = $input['hemoglobin'] < 11;
    $swellingBad    = in_array($sevOf('swelling'), ['Moderate','Severe']);
    $noSymptoms = true;
    foreach ($input['symptoms'] as $s) if ($s['severity'] !== 'None') { $noSymptoms = false; break; }
    $vitalsOk = !$bpHigh && $input['hemoglobin'] >= 11 && $input['blood_sugar'] < 140;

    $activeMap = [];
    foreach ($ruleBase as $r) $activeMap[$r['rule_key']] = (bool)$r['active'];
    $on = function($key) use ($activeMap){ return $activeMap[$key] ?? true; };

    $forced = null;
    if ($bpHigh && $headacheSevere && $on('r1')) { $hits[] = ['id'=>'r1','text'=>'Blood Pressure is High AND Headache is Severe → Severe Risk']; $forced='Severe'; }
    if ($bleedingSevere && $on('r2')) { $hits[] = ['id'=>'r2','text'=>'Severe Bleeding reported → Severe Risk']; $forced='Severe'; }
    if ($anyConvulsion && $on('r3')) { $hits[] = ['id'=>'r3','text'=>'Convulsions reported → Severe Risk']; $forced='Severe'; }
    if ($breathingBad && $on('r4')) { $hits[] = ['id'=>'r4','text'=>'Difficulty Breathing is Moderate/Severe → Severe Risk']; $forced='Severe'; }
    if ($movementBad && $on('r5')) { $hits[] = ['id'=>'r5','text'=>'Reduced Baby Movement is Moderate/Severe → Severe Risk']; $forced='Severe'; }
    if ($sugarHigh && $laterTrimester && $on('r6')) { $hits[] = ['id'=>'r6','text'=>'Blood Sugar High in 2nd/3rd Trimester → High Risk']; if($forced!=='Severe') $forced='High'; }
    if ($hbLow && $on('r7')) { $hits[] = ['id'=>'r7','text'=>'Hemoglobin Low → High Risk, Iron Supplement advised']; if($forced!=='Severe') $forced='High'; }
    if ($swellingBad && $bpHigh && $on('r8')) { $hits[] = ['id'=>'r8','text'=>'Swelling + elevated BP → Severe Risk, preeclampsia screening']; $forced='Severe'; }
    if ($noSymptoms && $vitalsOk && $on('r9')) { $hits[] = ['id'=>'r9','text'=>'No symptoms, vitals in range → Low Risk supported']; }

    return ['hits'=>$hits, 'forcedLevel'=>$forced];
}

function build_recommendations($level, $input){
    $recs = [];
    if ($level === 'Severe'){
        $recs[] = ['text'=>'Contact your OB-GYN or go to the nearest hospital now','icon'=>'fa-truck-medical','urgent'=>true];
        $recs[] = ['text'=>'Do not wait for your next scheduled appointment','icon'=>'fa-clock','urgent'=>true];
    } elseif ($level === 'High'){
        $recs[] = ['text'=>'Schedule a prenatal checkup within the next few days','icon'=>'fa-calendar-check'];
        $recs[] = ['text'=>'Monitor blood pressure and symptoms daily','icon'=>'fa-heart-pulse'];
    } else {
        $recs[] = ['text'=>'Continue routine prenatal care and healthy habits','icon'=>'fa-leaf'];
    }
    if ($input['hemoglobin'] < 11) $recs[] = ['text'=>'Take Iron Supplement as prescribed, recheck hemoglobin','icon'=>'fa-capsules'];
    if ($input['bp_sys'] >= 130) $recs[] = ['text'=>'Monitor Blood Pressure twice daily and log results','icon'=>'fa-gauge-high'];
    if ($input['blood_sugar'] >= 130) $recs[] = ['text'=>'Monitor Blood Sugar and reduce refined sugar intake','icon'=>'fa-cube'];
    $recs[] = ['text'=>'Drink plenty of water and rest when tired','icon'=>'fa-droplet'];
    $recs[] = ['text'=>'Eat a balanced, nutrient-dense diet','icon'=>'fa-apple-whole'];
    $recs[] = ['text'=>'Exercise safely as approved by your provider','icon'=>'fa-person-walking'];
    return $recs;
}

/**
 * Master pipeline: Step1 collect -> Step2 rule-based clinical scoring (RH/MC/PP)
 * -> Step3 fuzzy classification -> Step4 acute-symptom safety-net rules.
 * $input = ['age','trimester','bp_sys','bp_dia','bmi','hemoglobin','blood_sugar',
 *           'riskHistory','pregnancyProblems','symptoms'=>[['id','severity','duration','frequency'],...]]
 */
// Sums points from the RH (reproductive history) + MC (medical/surgical conditions)
// + PP (present pregnancy problems) rule table. Returns the total and every rule
// that was actually matched, so the UI can show exactly what drove the score.
function compute_structural_risk($age, $riskHistory, $pp, $hemoglobin){
    $hits = [];
    $add = function($ruleId) use (&$hits){ $hits[$ruleId] = RULE_SCORES[$ruleId]; };

    // ---- Reproductive History ----
    if ($age <= 16) $add('RH-01');
    if ($age > 35) $add('RH-02');
    $parity = (int)($riskHistory['parity'] ?? 0);
    if ($parity === 0) $add('RH-03');
    if ($parity > 4) $add('RH-05');
    if (!empty($riskHistory['prior_abortions_or_infertility'])) $add('RH-06');
    if (!empty($riskHistory['prev_pp_hemorrhage'])) $add('RH-07');
    if (!empty($riskHistory['prev_manual_placenta_removal'])) $add('RH-08');
    if (!empty($riskHistory['prev_baby_over_9lb'])) $add('RH-09');
    if (!empty($riskHistory['prev_baby_over_5lb8oz'])) $add('RH-10');
    if (!empty($riskHistory['prev_toxemia_hpn'])) $add('RH-11');
    if (!empty($riskHistory['prev_cesarean'])) $add('RH-12');
    if (!empty($riskHistory['prev_abnormal_labor'])) $add('RH-13');

    // ---- Medical/Surgical Conditions ----
    if (!empty($riskHistory['prev_gyn_disease'])) $add('MC-01');
    if (!empty($riskHistory['chronic_renal_disease'])) $add('MC-02');
    if (!empty($riskHistory['gestational_diabetes'])) $add('MC-03');
    if (!empty($riskHistory['class_b_diabetes_or_higher'])) $add('MC-04');
    if (!empty($riskHistory['cardiac_disease'])) $add('MC-05');
    $otherScore = max(0, min(5, (int)($riskHistory['other_significant_disease_score'] ?? 0)));
    if ($otherScore > 0) $hits['MC-06'] = ['label' => 'Other significant medical disease', 'points' => $otherScore, 'cat' => 'MC'];

    // ---- Present Pregnancy Problems ----
    if (!empty($pp['bleeding_lt_20wks'])) $add('PP-01');
    if (!empty($pp['bleeding_gt_20wks'])) $add('PP-02');
    if ($hemoglobin !== null && $hemoglobin < 10) $add('PP-03'); // auto-derived from latest vitals
    if (!empty($pp['postmaturity_prematurity'])) $add('PP-04');
    if (!empty($pp['hypertension'])) $add('PP-05');
    if (!empty($pp['prom'])) $add('PP-06');
    if (!empty($pp['poly_oligohydramnios'])) $add('PP-07');
    if (!empty($pp['iugr'])) $add('PP-08');
    if (!empty($pp['multiple_pregnancy'])) $add('PP-09');
    if (!empty($pp['breech_malpresentation'])) $add('PP-10');
    if (!empty($pp['rh_isoimmunization'])) $add('PP-11');

    $total = array_sum(array_column($hits, 'points'));
    return ['total' => $total, 'hits' => array_values($hits)];
}

// Classifies a structural risk total (0, 1, 2, 3 ... points) into Low/High/Severe
// using fuzzy membership instead of a hard cutoff, so borderline totals don't
// snap arbitrarily to the wrong bucket.
function classify_structural_score($total){
    $membership = [
        'low'    => shoulder_low($total, 2, 5),
        'high'   => tri_membership($total, 3, 7, 11),
        'severe' => shoulder_high($total, 9, 14),
    ];
    $sum = max(0.0001, array_sum($membership));
    $centroid = ($membership['low']*15 + $membership['high']*50 + $membership['severe']*88) / $sum;
    $score = (int)round(min(100, max(2, $centroid)));
    $level = $score >= 62 ? 'Severe' : ($score >= 35 ? 'High' : 'Low');
    return ['score' => $score, 'level' => $level, 'membership' => $membership, 'centroid' => round($centroid)];
}

/**
 * Master pipeline: Step1 collect -> Step2 rule-based clinical scoring (RH/MC/PP)
 * -> Step3 fuzzy classification -> Step4 acute-symptom safety-net rules.
 * $input = ['age','trimester','bp_sys','bp_dia','bmi','hemoglobin','blood_sugar',
 *           'riskHistory', 'pregnancyProblems',
 *           'symptoms'=>[['id','severity','duration','frequency'],...]]
 */
function assess_risk($input, $ruleBase, $catalog){
    $structural = compute_structural_risk($input['age'], $input['riskHistory'], $input['pregnancyProblems'], $input['hemoglobin']);
    $classified = classify_structural_score($structural['total']);
    $score = $classified['score'];
    $level = $classified['level'];

    $rules = evaluate_rules($input, $ruleBase);
    if ($rules['forcedLevel'] === 'Severe') { $level = 'Severe'; $score = max($score, 70); }
    elseif ($rules['forcedLevel'] === 'High' && $level === 'Low') { $level = 'High'; $score = max($score, 40); }

    $recommendations = build_recommendations($level, $input);

    return [
        'score' => $score, 'level' => $level,
        'structural' => ['total' => $structural['total'], 'hits' => $structural['hits']],
        'fuzzy' => ['membership' => $classified['membership'], 'centroid' => $classified['centroid']],
        'rules' => $rules['hits'], 'recommendations' => $recommendations,
        'generatedAt' => now_iso(),
    ];
}