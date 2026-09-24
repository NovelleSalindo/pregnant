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
try {
    $pdo->exec("ALTER TABLE assessments MODIFY COLUMN level VARCHAR(40) NOT NULL");
    $pdo->exec("INSERT IGNORE INTO symptom_catalog (id, name, icon, weight) VALUES
        ('urinary_discomfort', 'Urinary Discomfort', 'fa-toilet', 0.60),
        ('fluid_loss', 'Loss of Vaginal Fluid', 'fa-water', 0.95)");
    $pdo->exec("INSERT INTO rule_base (rule_key, if_text, then_text, active)
        SELECT 'r_bp_red', 'systolic_blood_pressure is outside 110–130 mmHg OR diastolic_blood_pressure is outside 75–85 mmHg', 'Trigger Red_Alert (Severe Risk)', 1
        WHERE NOT EXISTS (SELECT 1 FROM rule_base WHERE rule_key = 'r_bp_red')");
} catch (Throwable $ignored) {}

// Auto-migration: ensure users table has username, first_name, middle_name, last_name
try {
    $uCols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('username', $uCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN username VARCHAR(80) NULL UNIQUE AFTER role");
    }
    if (!in_array('first_name', $uCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN first_name VARCHAR(80) NULL AFTER username");
    }
    if (!in_array('middle_name', $uCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN middle_name VARCHAR(80) NULL AFTER first_name");
    }
    if (!in_array('last_name', $uCols)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN last_name VARCHAR(80) NULL AFTER middle_name");
    }
    $pdo->exec("UPDATE users SET username = SUBSTRING_INDEX(email, '@', 1) WHERE (username IS NULL OR username = '')");
} catch (Throwable $ignored) {}

// Auto-migration: ensure patient_profiles table has all expected columns
try {
    $pCols = $pdo->query("SHOW COLUMNS FROM patient_profiles")->fetchAll(PDO::FETCH_COLUMN);
    $neededProfileCols = [
        'pre_pregnancy_weight_kg' => 'DECIMAL(5,1) NULL',
        'occupation' => 'VARCHAR(100) NULL',
        'gravida' => 'INT NULL',
        'prior_miscarriage' => 'TINYINT(1) DEFAULT 0',
        'prior_csection' => 'TINYINT(1) DEFAULT 0',
        'emergency_name' => 'VARCHAR(120) NULL',
        'emergency_relation' => 'VARCHAR(60) NULL',
        'emergency_phone' => 'VARCHAR(30) NULL'
    ];
    foreach ($neededProfileCols as $col => $def) {
        if (!in_array($col, $pCols)) {
            $pdo->exec("ALTER TABLE patient_profiles ADD COLUMN $col $def");
        }
    }
} catch (Throwable $ignored) {}
$pdo->exec("CREATE TABLE IF NOT EXISTS risk_history (
  user_id VARCHAR(20) PRIMARY KEY,
  parity INT NULL,
  prior_abortions_or_infertility TINYINT(1) DEFAULT 0,
  prev_pp_hemorrhage TINYINT(1) DEFAULT 0,
  prev_manual_placenta_removal TINYINT(1) DEFAULT 0,
  prev_baby_over_9lb TINYINT(1) DEFAULT 0,
  prev_baby_over_5lb8oz TINYINT(1) DEFAULT 0,
  prev_baby_under_5lb8oz TINYINT(1) DEFAULT 0,
  prev_toxemia_hpn TINYINT(1) DEFAULT 0,
  prev_cesarean TINYINT(1) DEFAULT 0,
  prev_abnormal_labor TINYINT(1) DEFAULT 0,
  prev_gyn_disease TINYINT(1) DEFAULT 0,
  chronic_renal_disease TINYINT(1) DEFAULT 0,
  gestational_diabetes TINYINT(1) DEFAULT 0,
  class_b_diabetes_or_higher TINYINT(1) DEFAULT 0,
  cardiac_disease TINYINT(1) DEFAULT 0,
  other_significant_disease_score TINYINT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB");

// Safe column migrations for existing risk_history tables
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN prev_cesarean TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN prev_baby_under_5lb8oz TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN asthma TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN tuberculosis TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN pulmonary_embolism TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN hyperthyroidism TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN hypothyroidism TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN epilepsy TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN torch_infection TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE risk_history ADD COLUMN pyelonephritis_uti TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}

$pdo->exec("CREATE TABLE IF NOT EXISTS pregnancy_problems (
  id VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  symptom_log_id VARCHAR(20) NULL,
  date DATETIME NOT NULL,
  bleeding_lt_20wks TINYINT(1) DEFAULT 0,
  bleeding_gt_20wks TINYINT(1) DEFAULT 0,
  anemia TINYINT(1) DEFAULT 0,
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

// Safe column migrations for existing pregnancy_problems tables
try { $pdo->exec("ALTER TABLE pregnancy_problems ADD COLUMN anemia TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
try { $pdo->exec("ALTER TABLE assessments ADD COLUMN recommendations_json JSON NULL"); } catch (Throwable $e) {}

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

// Prenatal Laboratory & Daily Vitals auto-migration
try {
    $cols = $pdo->query("SHOW COLUMNS FROM monitoring")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('respiratory_rate', $cols)) {
        $pdo->exec("ALTER TABLE monitoring ADD COLUMN respiratory_rate INT NULL");
    }
    if (!in_array('spo2', $cols)) {
        $pdo->exec("ALTER TABLE monitoring ADD COLUMN spo2 INT NULL");
    }
    if (!in_array('fetal_heart_rate', $cols)) {
        $pdo->exec("ALTER TABLE monitoring ADD COLUMN fetal_heart_rate INT NULL");
    }
} catch (Throwable $ignored) {}

$pdo->exec("CREATE TABLE IF NOT EXISTS prenatal_laboratories (
  id VARCHAR(30) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  date DATETIME NOT NULL,
  lab_type VARCHAR(30) NOT NULL DEFAULT 'initial',
  cbc_hemoglobin DECIMAL(5,2) NULL,
  cbc_hematocrit DECIMAL(5,2) NULL,
  cbc_wbc DECIMAL(6,2) NULL,
  cbc_platelets INT NULL,
  blood_type VARCHAR(10) NULL,
  rh_factor VARCHAR(15) NULL,
  urinalysis_protein VARCHAR(20) NULL,
  urinalysis_glucose VARCHAR(20) NULL,
  urinalysis_ketones VARCHAR(20) NULL,
  blood_glucose DECIMAL(6,2) NULL,
  hiv_screening VARCHAR(20) NULL,
  syphilis_screening VARCHAR(20) NULL,
  hepb_screening VARCHAR(20) NULL,
  urine_culture VARCHAR(80) NULL,
  other_tests TEXT NULL,
  ultrasound_notes TEXT NULL,
  fetal_heart_rate INT NULL,
  fundal_height_cm DECIMAL(5,1) NULL,
  fetal_movement INT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
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
    'For Mom' => ['Phil Health/ MDR/Marriage Contract and PSA Birth Certificate', 'Comfortable robe or nightgown', 'Nursing bra and pads', 'Toiletries', 'Going-home outfit', 'Phone charger'],
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
        if ($daysToVisit >= 0 && $daysToVisit <= 7){
            $visitLabel = date('M j, Y', strtotime($nextVisit));
            $body = $daysToVisit === 0
                ? "Your prenatal checkup is today ({$visitLabel})! Please visit your clinic/OB-GYN."
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
    if (empty($_SESSION['user_id'])) redirect('front.php');
}

function require_role($role){
    require_login();
    $u = current_user();
    if (!$u || $u['role'] !== $role){
        redirect($u ? role_home($u['role']) : 'front.php');
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
    ['cat'=>'Hospital Contacts','title'=>'Keep this list handy','body'=>"Save your OB-GYN's direct line and your delivery hospital's labor & delivery unit in your emergency contacts."],
];

const EMERGENCY_HOTLINES = [
    ['name'=>'OB-GYN On-Call Line','number'=>''],
];

function get_symptom_catalog(){
    global $pdo;
    return $pdo->query("SELECT * FROM symptom_catalog WHERE id NOT IN ('high_bp_feel', 'reduced_movement', 'shortness_of_breath') ORDER BY name")->fetchAll();
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
    $l = strtoupper($level ?? '');
    if (strpos($l, 'SEVERE') !== false) return 'badge-high';
    if (strpos($l, 'MODERATE') !== false || strpos($l, 'HIGH') !== false) return 'badge-mod';
    return 'badge-low';
}
function risk_color_var($level){
    $l = strtoupper($level ?? '');
    if (strpos($l, 'SEVERE') !== false) return '--risk-high';
    if (strpos($l, 'MODERATE') !== false || strpos($l, 'HIGH') !== false) return '--risk-mod';
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
    $lvlStr = strtoupper($level);
    $gaugePercent = (float)$score;
    if ($gaugePercent <= 15) {
        if ($lvlStr === 'SEVERE' || strpos($lvlStr, 'SEVERE') !== false) {
            $gaugePercent = min(95, 72 + max(0, $gaugePercent - 7) * 4);
        } elseif ($lvlStr === 'HIGH' || strpos($lvlStr, 'HIGH') !== false) {
            $gaugePercent = min(64, max(40, 40 + max(0, $gaugePercent - 3) * 8));
        } else {
            $gaugePercent = min(30, max(10, 10 + $gaugePercent * 10));
        }
    }
    $cx = $size/2; $cy = $size*0.58; $r = $size*0.42;
    $angle = -90 + ($gaugePercent/100)*180;
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

  // Device / Phone System Notification Helper
  window.pcNotifyPhone = function(title, body, url, tag) {
    if (!('Notification' in window)) return Promise.resolve(false);
    var options = {
      body: body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      vibrate: [200, 100, 200],
      tag: tag || 'ob_visit',
      renotify: true,
      data: { url: url || 'reminders.php' }
    };

    function show() {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        return navigator.serviceWorker.ready.then(function(reg) {
          return reg.showNotification(title, options);
        }).catch(function() {
          try { new Notification(title, options); } catch(e){}
        });
      } else {
        try { new Notification(title, options); } catch(e){}
      }
    }

    if (Notification.permission === 'granted') {
      return Promise.resolve(show());
    } else if (Notification.permission !== 'denied') {
      return Notification.requestPermission().then(function(p) {
        if (p === 'granted') {
          return show();
        }
      });
    }
    return Promise.resolve(false);
  };

  window.pcRequestPhoneNotifications = function(onSuccess) {
    if (!('Notification' in window)) {
      alert('Phone notifications are not supported on this browser.');
      return;
    }
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        pcNotifyPhone(
          'Phone Notifications Enabled! 🔔',
          'PregnaCare will now send alerts directly to your phone for upcoming OB-GYN visits and daily supplements.',
          'reminders.php'
        );
        if (typeof onSuccess === 'function') onSuccess(true);
      } else if (perm === 'denied') {
        alert('Notifications are blocked in your browser settings. Please allow notifications for this site in your phone settings.');
        if (typeof onSuccess === 'function') onSuccess(false);
      }
    });
  };
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
      <a class="nav-link <?php echo $active==='dashboard'?'active':''; ?>" href="dashboard.php"><i class="fa-solid fa-house"></i> <?php echo t('Dashboard'); ?></a>
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
  <a href="dashboard.php" class="<?php echo $active==='dashboard'?'active':''; ?>"><i class="fa-solid fa-house"></i><?php echo t('Home'); ?></a>
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
  <a class="wt-drawer-link <?php echo ($active_page ?? '')==='reminders'?'active':''; ?>" href="reminders.php"><i class="fa-solid fa-bell"></i> Reminders &amp; OB Visit</a>
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

  <button type="button" class="wt-drawer-link" id="themeToggleBtn" style="width:100%;background:none;border:none;text-align:left;cursor:pointer;font-family:inherit;" onclick="toggleThemeMode()">
    <i class="fa-solid fa-circle-half-stroke" id="themeToggleIcon"></i> <span id="themeToggleText"><?php echo t('Toggle Dark Mode'); ?></span>
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
<?php
$fabHref = 'recommendations.php';
if ($u && ($u['role'] ?? '') === 'patient') {
    try {
        $stmtFab = $pdo->prepare("SELECT emergency_phone FROM patient_profiles WHERE user_id = ?");
        $stmtFab->execute([$u['id']]);
        $fabProf = $stmtFab->fetch();
        if (!empty($fabProf['emergency_phone'])) {
            $fabHref = 'tel:' . preg_replace('/[^0-9+]/', '', $fabProf['emergency_phone']);
        }
    } catch (Exception $e) {}
}
?>
<a class="emergency-fab" href="<?php echo htmlspecialchars($fabHref); ?>"><i class="fa-solid fa-phone-volume"></i> Emergency</a>
<script>
function updateThemeToggleUI(isDark){
  var icon = document.getElementById('themeToggleIcon');
  var txt = document.getElementById('themeToggleText');
  if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-circle-half-stroke';
  if (txt) txt.textContent = isDark ? 'Switch to Light Mode' : 'Toggle Dark Mode';
}
function toggleThemeMode(){
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark){
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('pregnacare_theme','light');
    updateThemeToggleUI(false);
  } else {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('pregnacare_theme','dark');
    updateThemeToggleUI(true);
  }
}
document.addEventListener('DOMContentLoaded', function(){
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  updateThemeToggleUI(isDark);
});

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

// ---------- Programmatic Boundary Validation (RULES.docx Rule 24) ----------
function validate_maternal_inputs($data){
    $errors = [];
    if (isset($data['temp']) && $data['temp'] !== '' && $data['temp'] !== null){
        $t = (float)$data['temp'];
        if ($t < 34.0 || $t > 43.0){
            $errors['temp'] = 'Body temperature must be between 34.0°C and 43.0°C (typical normal range is 36.5°C–37.5°C).';
        }
    }
    if (isset($data['bp_sys']) && $data['bp_sys'] !== '' && $data['bp_sys'] !== null){
        $s = (int)$data['bp_sys'];
        if ($s < 60 || $s > 240){
            $errors['bp_sys'] = 'Systolic blood pressure must be between 60 and 240 mmHg (target range is 110–130 mmHg).';
        }
    }
    if (isset($data['bp_dia']) && $data['bp_dia'] !== '' && $data['bp_dia'] !== null){
        $d = (int)$data['bp_dia'];
        if ($d < 30 || $d > 150){
            $errors['bp_dia'] = 'Diastolic blood pressure must be between 30 and 150 mmHg (target range is 75–85 mmHg).';
        }
    }
    if (isset($data['heart_rate']) && $data['heart_rate'] !== '' && $data['heart_rate'] !== null){
        $hr = (int)$data['heart_rate'];
        if ($hr < 40 || $hr > 200){
            $errors['heart_rate'] = 'Heart rate must be between 40 and 200 bpm (target range is 60–100 bpm).';
        }
    }
    if (isset($data['blood_sugar']) && $data['blood_sugar'] !== '' && $data['blood_sugar'] !== null){
        $bs = (int)$data['blood_sugar'];
        if ($bs < 40 || $bs > 500){
            $errors['blood_sugar'] = 'Blood glucose must be between 40 and 500 mg/dL (target range is 70–120 mg/dL fasting, < 140 mg/dL post-meal).';
        }
    }
    if (!empty($data['symptom_intensities']) && is_array($data['symptom_intensities'])){
        foreach ($data['symptom_intensities'] as $sid => $val){
            $v = (float)$val;
            if ($v < 0 || $v > 10){
                $errors['symptom_' . $sid] = "Intensity for {$sid} must be between 0 and 10.";
            }
        }
    }
    return $errors;
}

// ---------- Fuzzy Symptom Severity Calculation (LOW, HIGH, SEVERE) ----------
// Each symptom is evaluated into LOW (0.00-0.39), HIGH (0.40-0.69), and SEVERE (0.70-1.00)
// using smooth transitions. At intensity 4: LOW = 0.20, HIGH = 0.70, SEVERE = 0.10.
function fuzzy_symptom_membership($intensity){
    $x = max(0.0, min(10.0, (float)$intensity));

    // LOW membership (dominant for 0.00 - 0.39)
    if ($x <= 1.0) {
        $low = 1.0;
    } elseif ($x <= 4.0) {
        $low = 1.0 - (($x - 1.0) / 3.0) * 0.80; // at x=4 -> 0.20
    } elseif ($x <= 5.0) {
        $low = 0.20 * (5.0 - $x);
    } else {
        $low = 0.0;
    }

    // HIGH membership (dominant for 0.40 - 0.69)
    if ($x <= 1.5) {
        $high = 0.0;
    } elseif ($x <= 4.0) {
        $high = (($x - 1.5) / 2.5) * 0.70; // at x=4 -> 0.70
    } elseif ($x <= 5.5) {
        $high = 0.70 + (($x - 4.0) / 1.5) * 0.15;
    } elseif ($x <= 8.5) {
        $high = 0.85 * (8.5 - $x) / 3.0;
    } else {
        $high = 0.0;
    }

    // SEVERE membership (dominant for 0.70 - 1.00)
    if ($x <= 3.0) {
        $severe = 0.0;
    } elseif ($x <= 4.0) {
        $severe = (($x - 3.0) / 1.0) * 0.10; // at x=4 -> 0.10
    } elseif ($x <= 8.0) {
        $severe = 0.10 + (($x - 4.0) / 4.0) * 0.70;
    } else {
        $severe = 0.80 + (($x - 8.0) / 2.0) * 0.20;
    }

    $low = round(max(0.0, min(1.0, $low)), 2);
    $high = round(max(0.0, min(1.0, $high)), 2);
    $severe = round(max(0.0, min(1.0, $severe)), 2);

    $dominant = 'LOW';
    if ($severe >= $high && $severe >= $low && $severe > 0.35) {
        $dominant = 'SEVERE';
    } elseif ($high >= $low && $high > 0.30) {
        $dominant = 'HIGH';
    }

    return [
        'low' => $low,
        'high' => $high,
        'severe' => $severe,
        'dominant' => $dominant,
        'intensity' => round($x, 1)
    ];
}

// Convert discrete label ('None','Mild','Moderate','Severe') into numeric intensity (0-10)
function severity_label_to_intensity($label){
    switch (strtolower(trim($label ?? ''))){
        case 'severe': return 9.0;
        case 'moderate': return 6.0;
        case 'mild': return 3.0;
        default: return 0.0;
    }
}

// Vital signs fuzzy memberships
function fuzzy_vital_memberships($vitals){
    $sys = (float)($vitals['bp_sys'] ?? 118);
    $dia = (float)($vitals['bp_dia'] ?? 76);
    $temp = (float)($vitals['temp'] ?? 36.8);
    $hr = (float)($vitals['heart_rate'] ?? 78);
    $glu = (float)($vitals['blood_sugar'] ?? 95);
    $gluTiming = strtolower($vitals['glucose_timing'] ?? 'preprandial');

    // Blood pressure membership
    $bpLow = ($sys >= 110 && $sys <= 130 && $dia >= 75 && $dia <= 85) ? 1.0 : (
        ($sys >= 90 && $sys <= 135 && $dia >= 65 && $dia <= 88) ? 0.60 : 0.10
    );
    $bpHigh = ($sys > 130 && $sys < 140) || ($dia > 85 && $dia < 90) ? 0.80 : (
        ($sys >= 125 || $dia >= 82) ? 0.45 : 0.05
    );
    $bpSevere = ($sys >= 140 || $dia >= 90 || $sys < 85 || $dia < 50) ? 0.95 : (
        ($sys >= 135 || $dia >= 88) ? 0.40 : 0.0
    );

    // Temperature membership
    $tempLow = ($temp < 37.5) ? 1.0 : shoulder_low($temp, 37.3, 37.8);
    $tempHigh = tri_membership($temp, 37.4, 37.7, 38.0);
    $tempSevere = shoulder_high($temp, 37.8, 38.2);

    // Heart rate membership
    $hrLow = ($hr >= 60 && $hr <= 100) ? 1.0 : 0.15;
    $hrHigh = (($hr > 100 && $hr <= 110) || ($hr >= 55 && $hr < 60)) ? 0.70 : 0.10;
    $hrSevere = ($hr > 110 || $hr < 55) ? 0.90 : 0.05;

    // Blood glucose membership
    if ($gluTiming === 'postprandial'){
        $gluLow = ($glu <= 140 && $glu >= 70) ? 1.0 : 0.20;
        $gluHigh = ($glu > 140 && $glu <= 180) ? 0.75 : 0.15;
        $gluSevere = ($glu > 180 || $glu < 60) ? 0.95 : 0.05;
    } else {
        $gluLow = ($glu >= 70 && $glu <= 120) ? 1.0 : 0.20;
        $gluHigh = ($glu > 120 && $glu <= 140) ? 0.75 : 0.15;
        $gluSevere = ($glu > 140 || $glu < 70) ? 0.95 : 0.05;
    }

    return [
        'bp' => ['low' => round($bpLow, 2), 'high' => round($bpHigh, 2), 'severe' => round($bpSevere, 2)],
        'temp' => ['low' => round($tempLow, 2), 'high' => round($tempHigh, 2), 'severe' => round($tempSevere, 2)],
        'heart_rate' => ['low' => round($hrLow, 2), 'high' => round($hrHigh, 2), 'severe' => round($hrSevere, 2)],
        'blood_sugar' => ['low' => round($gluLow, 2), 'high' => round($gluHigh, 2), 'severe' => round($gluSevere, 2)],
    ];
}

// ---------- Multi-Symptom Fuzzy Inference & Defuzzification ----------
function evaluate_fuzzy_symptom_rules($symptomMemberships, $vitalMemberships, $structuralPoints = 0){
    $getM = function($key) use ($symptomMemberships){
        return $symptomMemberships[$key] ?? ['low'=>1.0,'high'=>0.0,'severe'=>0.0];
    };

    $headache = $getM('headache');
    $swelling = $getM('swelling');
    $pain     = $getM('abdominal_pain');
    $bleeding = $getM('bleeding');
    $breath   = $getM('difficulty_breathing');
    $movement = $getM('reduced_movement');
    $fluid    = $getM('fluid_loss');
    $bp       = $vitalMemberships['bp'] ?? ['low'=>1.0,'high'=>0.0,'severe'=>0.0];
    $tempM    = $vitalMemberships['temp'] ?? ['low'=>1.0,'high'=>0.0,'severe'=>0.0];
    $hrM      = $vitalMemberships['heart_rate'] ?? ['low'=>1.0,'high'=>0.0,'severe'=>0.0];
    $gluM     = $vitalMemberships['blood_sugar'] ?? ['low'=>1.0,'high'=>0.0,'severe'=>0.0];

    // Fuzzy IF-THEN Rules (AND = min, OR = max)
    $ruleResults = [];

    // Rule 1: IF headache is HIGH AND bp is HIGH THEN overall risk is HIGH
    $r1 = min($headache['high'], $bp['high']);
    $ruleResults[] = ['rule' => 'Headache is HIGH AND Blood Pressure is HIGH', 'then' => 'HIGH', 'firing' => $r1];

    // Rule 2: IF headache is SEVERE AND bp is HIGH THEN overall risk is SEVERE
    $r2 = min($headache['severe'], $bp['high']);
    $ruleResults[] = ['rule' => 'Headache is SEVERE AND Blood Pressure is HIGH', 'then' => 'SEVERE', 'firing' => $r2];

    // Rule 3: IF abdominal pain is HIGH AND vaginal bleeding is HIGH THEN overall risk is SEVERE
    $r3 = min($pain['high'], $bleeding['high']);
    $ruleResults[] = ['rule' => 'Abdominal Pain is HIGH AND Vaginal Bleeding is HIGH', 'then' => 'SEVERE', 'firing' => $r3];

    // Rule 4: IF difficulty breathing is SEVERE THEN overall risk is SEVERE
    $r4 = $breath['severe'];
    $ruleResults[] = ['rule' => 'Difficulty Breathing is SEVERE', 'then' => 'SEVERE', 'firing' => $r4];

    // Rule 5: IF decreased fetal movement is SEVERE THEN overall risk is SEVERE
    $r5 = $movement['severe'];
    $ruleResults[] = ['rule' => 'Decreased Fetal Movement is SEVERE', 'then' => 'SEVERE', 'firing' => $r5];

    // Rule 6: IF loss of vaginal fluid is SEVERE THEN overall risk is SEVERE
    $r6 = $fluid['severe'];
    $ruleResults[] = ['rule' => 'Loss of Vaginal Fluid is SEVERE', 'then' => 'SEVERE', 'firing' => $r6];

    // Rule 7: IF headache is LOW AND swelling is LOW AND vitals are safe THEN overall risk is LOW
    $vitalsSafeMin = min($bp['low'], $tempM['low'], $hrM['low'], $gluM['low']);
    $r7 = min($headache['low'], $swelling['low'], $vitalsSafeMin);
    $ruleResults[] = ['rule' => 'Headache LOW AND Swelling LOW AND Vitals safe', 'then' => 'LOW', 'firing' => $r7];

    // Aggregate general severe degrees across all symptoms
    $maxSymptomSevere = 0.0;
    $sumHighMemberships = 0.0;
    $countHighMemberships = 0;
    foreach ($symptomMemberships as $sm){
        if ($sm['severe'] > $maxSymptomSevere) $maxSymptomSevere = $sm['severe'];
        if ($sm['high'] > 0.20){
            $sumHighMemberships += $sm['high'];
            $countHighMemberships++;
        }
    }
    $avgHigh = $countHighMemberships > 0 ? ($sumHighMemberships / $countHighMemberships) : 0.0;

    // Structural risk factor weighting
    $structHigh = ($structuralPoints >= 3 && $structuralPoints <= 8) ? 0.50 : 0.0;
    $structSevere = ($structuralPoints > 8) ? 0.70 : 0.0;

    // Combine into overall fuzzy memberships
    $overallSevere = max($r2, $r3, $r4, $r5, $r6, $bp['severe'], $tempM['severe'], $maxSymptomSevere * 0.85, $structSevere);
    $overallHigh   = max($r1, $avgHigh, $bp['high'], $tempM['high'], $gluM['high'], $structHigh);
    $overallLow    = max($r7, min(1.0 - $overallSevere, 1.0 - $overallHigh));

    // Normalize so memberships represent valid degree distributions
    $overallLow = round(max(0.0, min(1.0, $overallLow)), 2);
    $overallHigh = round(max(0.0, min(1.0, $overallHigh)), 2);
    $overallSevere = round(max(0.0, min(1.0, $overallSevere)), 2);

    // Defuzzification: Centroid Method using singletons (LOW=15, HIGH=55, SEVERE=90)
    $sumMu = max(0.0001, $overallLow + $overallHigh + $overallSevere);
    $centroid = ($overallLow * 15 + $overallHigh * 55 + $overallSevere * 90) / $sumMu;
    $centroid = (int)round(min(100, max(5, $centroid)));

    // Dominant Classification
    $dominant = 'LOW';
    if ($overallSevere >= $overallHigh && $overallSevere >= $overallLow && $overallSevere >= 0.40){
        $dominant = 'SEVERE';
    } elseif ($overallHigh >= $overallLow && $overallHigh >= 0.35){
        $dominant = 'HIGH';
    }

    return [
        'membership' => [
            'low' => $overallLow,
            'high' => $overallHigh,
            'severe' => $overallSevere,
        ],
        'dominant' => $dominant,
        'centroid' => $centroid,
        'rules' => $ruleResults,
    ];
}

// ---------- Safety-Rule Override & Alert Evaluation (RULES.docx) ----------
function evaluate_emergency_overrides($input, $catalog = []){
    $redAlertHits = [];
    $yellowAlertHits = [];

    $sys = (int)($input['bp_sys'] ?? 0);
    $dia = (int)($input['bp_dia'] ?? 0);
    $temp = (float)($input['temp'] ?? 0);
    $hr = (int)($input['heart_rate'] ?? 0);
    $glucose = (int)($input['blood_sugar'] ?? 0);
    $glucoseTiming = strtolower($input['glucose_timing'] ?? 'preprandial');

    // Helper to get severity of a catalog symptom
    $symMap = [];
    if (!empty($input['symptoms'])){
        foreach ($input['symptoms'] as $s){
            $symMap[$s['id']] = $s;
        }
    }
    $sevOf = function($id) use ($symMap){ return $symMap[$id]['severity'] ?? 'None'; };
    $intensityOf = function($id) use ($input, $sevOf){
        if (isset($input['symptom_intensities'][$id])){
            return (float)$input['symptom_intensities'][$id];
        }
        return severity_label_to_intensity($sevOf($id));
    };

    // 1. Blood Pressure optimal boundaries: outside 110–130 mmHg sys OR 75–85 mmHg dia -> Red Alert
    if (($sys > 0 && ($sys < 110 || $sys > 130)) || ($dia > 0 && ($dia < 75 || $dia > 85))){
        $redAlertHits[] = 'Systolic blood pressure is outside 110–130 mmHg OR diastolic blood pressure is outside 75–85 mmHg → Red_Alert (Severe Risk)';
    }

    // 2. Body temperature >= 38°C -> Red Alert
    if ($temp >= 38.0){
        $redAlertHits[] = 'Body temperature is elevated (≥ 38°C)';
    }

    // 3. Heart rate outside 60–100 bpm -> Red Alert
    if ($hr > 0 && ($hr < 60 || $hr > 100)){
        $redAlertHits[] = 'Heart rate is outside target window (60–100 bpm)';
    }

    // 4 & 5. Blood glucose target limits
    if ($glucose > 0){
        if ($glucoseTiming === 'postprandial' && $glucose > 180){
            $redAlertHits[] = 'Postprandial blood glucose exceeds 180 mg/dL';
        } elseif ($glucoseTiming === 'preprandial' && ($glucose < 70 || $glucose > 120)){
            $redAlertHits[] = 'Preprandial blood glucose is outside target limits (70–120 mg/dL)';
        } elseif ($glucose < 70 || $glucose > 180){
            $redAlertHits[] = 'Blood glucose is outside safe clinical limits';
        }
    }

    // 6. Fever with chills or sweating -> Red Alert
    if (!empty($input['fever_with_chills']) || !empty($input['fever_with_sweating'])){
        $redAlertHits[] = 'Fever accompanied by chills or profuse sweating';
    }

    // 7. Breathing difficulty or breathing with sound -> Red Alert
    if (!empty($input['breathing_difficulty']) || !empty($input['breathing_with_sound']) || in_array($sevOf('difficulty_breathing'), ['Moderate','Severe'])){
        $redAlertHits[] = 'Difficulty breathing or stridor/abnormal breathing sound';
    }

    // 8. Headache intensity >= 6 -> Red Alert
    $headacheInt = $intensityOf('headache');
    if ($headacheInt >= 6.0 || $sevOf('headache') === 'Severe'){
        $redAlertHits[] = 'Headache intensity is severe (≥ 6/10)';
    }

    // 9. Swollen locations count >= 4 (legs, arms, face, hands) -> Red Alert
    $swollenLocationsCount = (int)($input['swollen_locations_count'] ?? 0);
    if (!empty($input['swollen_locations']) && is_array($input['swollen_locations'])){
        $swollenLocationsCount = count(array_filter($input['swollen_locations']));
    }
    if ($swollenLocationsCount >= 4){
        $redAlertHits[] = 'Generalized swelling across 4 body locations (legs, arms, face, hands)';
    }

    // 10 & 11. Belly pain with hard abdomen, bleeding, or intensity > 6 -> Red Alert
    $bellyPainInt = $intensityOf('abdominal_pain');
    if (!empty($input['belly_pain_with_hard_abdomen']) || !empty($input['belly_pain_with_bleeding'])){
        $redAlertHits[] = 'Abdominal pain accompanied by hard/rigid abdomen or bleeding';
    }
    if ($bellyPainInt > 6.0 || $sevOf('abdominal_pain') === 'Severe'){
        $redAlertHits[] = 'Abdominal pain intensity is severe (> 6/10)';
    }

    // 12. Loss of vaginal fluid == True OR decreased fetal movement == True -> Red Alert
    if (!empty($input['loss_of_vaginal_fluid']) || !empty($input['decreased_fetal_movement']) || in_array($sevOf('reduced_movement'), ['Moderate','Severe']) || in_array($sevOf('fluid_loss'), ['Moderate','Severe'])){
        $redAlertHits[] = 'Loss of vaginal fluid or decreased baby movement reported';
    }

    // 13. Diabetes symptoms count >= 4 -> Red Alert
    $diabetesSymptomsCount = (int)($input['diabetes_symptoms_count'] ?? 0);
    if ($diabetesSymptomsCount >= 4){
        $redAlertHits[] = 'Multiple indicators of glucose dysregulation (≥ 4 diabetes symptoms)';
    }

    // ---------- Yellow Alert Conditions ----------
    // 14. Preeclampsia symptoms count >= 2
    $preeclampsiaSymptomsCount = (int)($input['preeclampsia_symptoms_count'] ?? 0);
    if ($preeclampsiaSymptomsCount >= 2){
        $yellowAlertHits[] = 'Multiple preeclampsia risk signs present';
    }

    // 15. Swollen locations count == 2 or 3
    if ($swollenLocationsCount === 2 || $swollenLocationsCount === 3){
        $yellowAlertHits[] = "Localized swelling reported in {$swollenLocationsCount} body areas";
    }

    // 16. Headache present AND intensity < 6
    if ($headacheInt > 0 && $headacheInt < 6.0){
        $yellowAlertHits[] = 'Mild to moderate headache reported';
    }

    // 17. Vaginal bleeding intensity > 0 (if not already severe)
    $bleedingInt = $intensityOf('bleeding');
    if ($bleedingInt > 0 && $sevOf('bleeding') !== 'Severe'){
        $yellowAlertHits[] = 'Vaginal bleeding or spotting reported';
    }

    // 18. Discomfort during urination (pain, burning, bloody urine)
    if (!empty($input['discomfort_during_urination']) || !empty($input['urinary_discomfort']) || $sevOf('urinary_discomfort') !== 'None'){
        $yellowAlertHits[] = 'Urinary discomfort or burning sensation reported';
    }

    // 19. Belly pain symptoms count >= 3 AND intensity < 6
    $bellyPainSymptomsCount = (int)($input['belly_pain_symptoms_count'] ?? 0);
    if ($bellyPainSymptomsCount >= 3 && $bellyPainInt < 6.0){
        $yellowAlertHits[] = 'Frequent or recurring abdominal discomfort';
    }

    // 20. Diabetes symptoms count <= 3 and > 0
    if ($diabetesSymptomsCount >= 1 && $diabetesSymptomsCount <= 3){
        $yellowAlertHits[] = 'Mild indicators of blood sugar fluctuation';
    }

    // Count reported symptoms
    $activeSymptomsCount = 0;
    if (!empty($input['symptoms'])){
        foreach ($input['symptoms'] as $s){
            if (!empty($s['severity']) && $s['severity'] !== 'None') $activeSymptomsCount++;
        }
    }

    // 21. Green Alert Condition (Informational Only)
    // blood pressure is within 110–130 / 75–85 mmHg, AND body_temperature < 38°C, AND heart_rate 60–100, AND blood_glucose within target limits, AND reported_symptoms_count == 0
    $vitalsSafe = ($sys >= 110 && $sys <= 130 && $dia >= 75 && $dia <= 85)
               && ($temp > 0 ? $temp < 38.0 : true)
               && ($hr > 0 ? ($hr >= 60 && $hr <= 100) : true)
               && ($glucose > 0 ? ($glucoseTiming === 'postprandial' ? $glucose <= 140 : ($glucose >= 70 && $glucose <= 120)) : true);

    $isGreenAlert = ($vitalsSafe && $activeSymptomsCount === 0 && empty($redAlertHits) && empty($yellowAlertHits));

    // Determine alert status
    $alertType = 'GREEN';
    $overrideApplied = false;
    $overrideLevel = null;
    $overrideSeverity = null;

    if (!empty($redAlertHits)){
        $alertType = 'RED';
        $overrideApplied = true;
        $overrideSeverity = 'SEVERE';
        $overrideLevel = 'HIGH RISK';
    } elseif (!empty($yellowAlertHits)){
        $alertType = 'YELLOW';
        $overrideApplied = true;
        $overrideSeverity = 'HIGH';
        $overrideLevel = 'MODERATE RISK';
    } elseif ($isGreenAlert){
        $alertType = 'GREEN';
        $overrideApplied = true;
        $overrideSeverity = 'LOW';
        $overrideLevel = 'LOW RISK';
    }

    return [
        'alertType' => $alertType,
        'overrideApplied' => $overrideApplied,
        'overrideSeverity' => $overrideSeverity,
        'overrideLevel' => $overrideLevel,
        'redHits' => $redAlertHits,
        'yellowHits' => $yellowAlertHits,
        'isGreen' => $isGreenAlert,
    ];
}

// ---------- Continuous Monitoring & Severity Progression Detection ----------
function detect_severity_progression($pdo, $userId, $currentSeverity, $currentRiskLevel){
    if (!$pdo || empty($userId)) return ['detected' => false];

    // Fetch the previous assessment
    $stmt = $pdo->prepare("SELECT id, score, level, fuzzy_json, date FROM assessments WHERE user_id = ? ORDER BY date DESC LIMIT 1");
    $stmt->execute([$userId]);
    $prev = $stmt->fetch();
    if (!$prev) return ['detected' => false];

    $prevFuzzy = json_decode($prev['fuzzy_json'] ?? '{}', true);
    $prevSeverity = strtoupper($prevFuzzy['overall_severity'] ?? $prev['level'] ?? 'LOW');
    if ($prevSeverity === 'LOW RISK') $prevSeverity = 'LOW';
    if ($prevSeverity === 'MODERATE RISK') $prevSeverity = 'HIGH';
    if ($prevSeverity === 'HIGH RISK') $prevSeverity = 'SEVERE';

    $currSeverity = strtoupper($currentSeverity);
    $detected = false;
    $message = '';

    // Detect progressions: LOW -> HIGH, HIGH -> SEVERE, LOW -> SEVERE
    if ($prevSeverity === 'LOW' && in_array($currSeverity, ['HIGH', 'SEVERE'])){
        $detected = true;
        $message = "Increasing symptom severity detected: Your assessment transitioned from LOW to {$currSeverity}. Please follow the personalized guidance below and consult your healthcare provider if symptoms persist.";
    } elseif ($prevSeverity === 'HIGH' && $currSeverity === 'SEVERE'){
        $detected = true;
        $message = "Increasing symptom severity detected: Your assessment progressed to SEVERE. Please contact your OB-GYN or proceed to the nearest maternal health clinic.";
    }

    if ($detected){
        // Save notification for the patient
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
            ->execute([uid('ntf'), $userId, 'Monitoring Alert: Severity Increased', $message, now_iso(), 'severity_increase']);
    }

    return [
        'detected' => $detected,
        'previous_severity' => $prevSeverity,
        'current_severity' => $currSeverity,
        'previous_date' => $prev['date'],
        'message' => $message,
    ];
}

function get_symptom_based_recommendations($symptomId, $severityLevel, $hasHighBP) {
    $advice = [];
    $isSevere = ($severityLevel === 'Severe' || $severityLevel === 'High');

    switch ($symptomId) {
        case 'bleeding':
            $advice = ['text' => 'Any bleeding requires medical evaluation. Please contact your OB-GYN immediately.', 'icon' => 'fa-droplet', 'urgent' => true];
            break;
        case 'abdominal_pain':
            $advice = $isSevere 
                ? ['text' => 'Severe abdominal pain needs immediate assessment to rule out complications.', 'icon' => 'fa-user-injured', 'urgent' => true]
                : ['text' => 'Monitor mild abdominal cramps. Rest and hydrate, but report if pain worsens.', 'icon' => 'fa-user-injured', 'urgent' => false];
            break;
        case 'swelling':
            if ($hasHighBP) {
                $advice = ['text' => 'Swelling combined with high blood pressure is a warning sign. Seek medical attention.', 'icon' => 'fa-hand-dots', 'urgent' => true];
            } else {
                $advice = $isSevere
                    ? ['text' => 'Severe sudden swelling needs medical evaluation.', 'icon' => 'fa-hand-dots', 'urgent' => true]
                    : ['text' => 'Elevate your feet and stay well-hydrated to help reduce mild swelling.', 'icon' => 'fa-hand-dots', 'urgent' => false];
            }
            break;
        case 'headache':
            if ($hasHighBP) {
                $advice = ['text' => 'Headache combined with high blood pressure requires immediate evaluation.', 'icon' => 'fa-head-side-cough', 'urgent' => true];
            } else {
                $advice = $isSevere
                    ? ['text' => 'A severe, unrelenting headache should be checked by a provider.', 'icon' => 'fa-head-side-cough', 'urgent' => true]
                    : ['text' => 'Rest in a quiet room and ensure you are fully hydrated to relieve your headache.', 'icon' => 'fa-head-side-cough', 'urgent' => false];
            }
            break;
        case 'vomiting':
            $advice = $isSevere
                ? ['text' => 'Severe vomiting can lead to dehydration. Please seek medical advice.', 'icon' => 'fa-face-dizzy', 'urgent' => true]
                : ['text' => 'Eat small, frequent meals and sip fluids to manage nausea and vomiting.', 'icon' => 'fa-face-dizzy', 'urgent' => false];
            break;
        case 'reduced_movement':
            $advice = ['text' => 'Reduced baby movement should always be checked. Please contact your provider.', 'icon' => 'fa-baby', 'urgent' => true];
            break;
        case 'fluid_loss':
            $advice = ['text' => 'Loss of fluid may indicate your water broke. Contact your birthing facility.', 'icon' => 'fa-water', 'urgent' => true];
            break;
        case 'fever':
            $advice = $isSevere
                ? ['text' => 'A high fever can be dangerous during pregnancy. Seek immediate medical care.', 'icon' => 'fa-temperature-high', 'urgent' => true]
                : ['text' => 'Monitor your temperature and stay hydrated. Contact your provider if fever persists.', 'icon' => 'fa-temperature-high', 'urgent' => false];
            break;
        case 'blurred_vision':
            $advice = ['text' => 'Changes in vision can be a sign of blood pressure complications. Seek evaluation.', 'icon' => 'fa-eye', 'urgent' => true];
            break;
        case 'urinary_discomfort':
            $advice = ['text' => 'Discomfort when urinating may indicate a UTI. Drink water and contact your provider.', 'icon' => 'fa-toilet', 'urgent' => false];
            break;
        case 'back_pain':
            $advice = $isSevere
                ? ['text' => 'Severe or rhythmic back pain might indicate preterm labor. Contact your provider.', 'icon' => 'fa-bone', 'urgent' => true]
                : ['text' => 'For mild back pain, use a warm compress, practice good posture, and rest.', 'icon' => 'fa-bone', 'urgent' => false];
            break;
        case 'fatigue':
            $advice = ['text' => 'Fatigue is common. Prioritize sleep, eat iron-rich foods, and listen to your body.', 'icon' => 'fa-battery-quarter', 'urgent' => false];
            break;
        case 'difficulty_breathing':
            $advice = ['text' => 'Difficulty breathing requires medical evaluation. Sit upright in a comfortable position and contact your healthcare provider.', 'icon' => 'fa-lungs', 'urgent' => true];
            break;
        case 'dizziness':
            $advice = ['text' => 'Dizziness can result from low blood pressure or dehydration. Lie down on your left side and drink fluids.', 'icon' => 'fa-compass', 'urgent' => false];
            break;
        case 'convulsions':
            $advice = ['text' => 'Convulsions or seizures require immediate emergency medical evaluation. Ensure safety on left side.', 'icon' => 'fa-triangle-exclamation', 'urgent' => true];
            break;
    }
    return $advice;
}

// Reassuring, symptom-based recommendations
function build_recommendations($level, $input, $alertType = 'GREEN'){
    $recs = [];
    $lvl = strtoupper($level);

    $hasHighBP = false;
    if (!empty($input['bp_sys']) && $input['bp_sys'] >= 130) {
        $hasHighBP = true;
    }
    if (!empty($input['symptoms'])) {
        foreach ($input['symptoms'] as $s) {
            if ($s['id'] === 'high_bp_feel' && in_array($s['severity'], ['Moderate', 'High', 'Severe'])) {
                $hasHighBP = true;
            }
        }
    }

    $symptomRecs = [];
    if (!empty($input['symptoms'])) {
        foreach ($input['symptoms'] as $s) {
            $severity = $s['severity'] ?? 'Mild';
            if ($severity === 'None') continue;
            
            $advice = get_symptom_based_recommendations($s['id'], $severity, $hasHighBP);
            if (!empty($advice)) {
                $hash = md5($advice['text']);
                if (!isset($symptomRecs[$hash])) {
                    $symptomRecs[$hash] = $advice;
                }
            }
        }
    }

    if ($lvl === 'HIGH RISK' || $lvl === 'SEVERE' || $alertType === 'RED'){
        $recs[] = ['text'=>'Please connect with your OB-GYN or visit your birthing facility for evaluation of your symptoms.','icon'=>'fa-hospital-user','urgent'=>true];
    } elseif ($lvl === 'MODERATE RISK' || $lvl === 'HIGH' || $alertType === 'YELLOW'){
        $recs[] = ['text'=>'Schedule a check-in with your prenatal care provider over the coming days.','icon'=>'fa-calendar-check','urgent'=>false];
    }

    foreach ($symptomRecs as $sr) {
        $recs[] = $sr;
    }

    if (empty($symptomRecs) && $lvl === 'LOW RISK' && $alertType === 'GREEN') {
        $recs[] = ['text'=>'Continue your regular prenatal checkups, hydration, and restful routine.','icon'=>'fa-circle-check','urgent'=>false];
    }

    if (!empty($input['hemoglobin']) && $input['hemoglobin'] < 11){
        $recs[] = ['text'=>'Take your iron & folic acid supplement with vitamin C-rich foods to support hemoglobin.','icon'=>'fa-capsules','urgent'=>false];
    }
    if (!empty($input['bp_sys']) && $input['bp_sys'] >= 130){
        $recs[] = ['text'=>'Log blood pressure readings morning and evening in a quiet, seated position.','icon'=>'fa-heart-pulse','urgent'=>false];
    }
    if (!empty($input['blood_sugar']) && $input['blood_sugar'] >= 130){
        $recs[] = ['text'=>'Choose complex whole grains and maintain a consistent meal schedule.','icon'=>'fa-utensils','urgent'=>false];
    }

    $recs[] = ['text'=>'Stay well hydrated with clean water and rest whenever you feel fatigued.','icon'=>'fa-glass-water','urgent'=>false];
    $recs[] = ['text'=>'Decision support only. Always seek personalized advice from your licensed OB-GYN.','icon'=>'fa-user-doctor','urgent'=>false];

    $urgentRecs = array_filter($recs, function($r){ return !empty($r['urgent']); });
    $normalRecs = array_filter($recs, function($r){ return empty($r['urgent']); });
    
    // Keep top 6 recommendations to avoid overwhelming the user (prioritize urgent)
    return array_merge($urgentRecs, array_slice($normalRecs, 0, 6 - count($urgentRecs)));
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
    $heightCm = (float)$heightCm;
    if ($heightCm > 0 && $heightCm < 3.0) {
        $heightCm *= 100; // was entered in meters (e.g. 1.6m -> 160cm)
    }
    if ($heightCm < 50 || $heightCm > 250) return 22;
    $h = $heightCm / 100;
    $val = round((float)$weightKg / ($h * $h), 1);
    if ($val < 8 || $val > 150) return 22;
    return $val;
}

// Sums clinical risk factor points (RH / MC / PP)
function compute_structural_risk($age, $riskHistory, $pp, $hemoglobin){
    $hits = [];
    $add = function($ruleId) use (&$hits){ $hits[$ruleId] = RULE_SCORES[$ruleId]; };

    // Reproductive History
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

    // Medical/Surgical Conditions
    if (!empty($riskHistory['prev_gyn_disease'])) $add('MC-01');
    if (!empty($riskHistory['chronic_renal_disease'])) $add('MC-02');
    if (!empty($riskHistory['gestational_diabetes'])) $add('MC-03');
    if (!empty($riskHistory['class_b_diabetes_or_higher'])) $add('MC-04');
    if (!empty($riskHistory['cardiac_disease'])) $add('MC-05');
    $otherScore = max(0, min(5, (int)($riskHistory['other_significant_disease_score'] ?? 0)));
    if ($otherScore > 0) $hits['MC-06'] = ['label' => 'Other significant medical disease', 'points' => $otherScore, 'cat' => 'MC'];

    // Present Pregnancy Problems
    if (!empty($pp['bleeding_lt_20wks'])) $add('PP-01');
    if (!empty($pp['bleeding_gt_20wks'])) $add('PP-02');
    if ($hemoglobin !== null && $hemoglobin < 10) $add('PP-03');
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

/**
 * MASTER DECISION SUPPORT PIPELINE (FUZZY LOGIC + RULES.docx SAFETY OVERRIDE)
 * Steps:
 * 1. Input Validation
 * 2. Calculate Fuzzy Degrees for every symptom & vital (LOW, HIGH, SEVERE)
 * 3. Multi-symptom Fuzzy Rule Inference & Centroid Defuzzification
 * 4. Safety-Rule Override from RULES.docx (Red / Yellow / Green Alerts)
 * 5. Final Risk Classification (LOW RISK, MODERATE RISK, HIGH RISK)
 * 6. Continuous Monitoring Progression Detection
 * 7. Explainable Result Generation
/**
 * PREGNACARE CLINICAL RISK & MONITORING ENGINE (PORTED FROM pregnacare.php)
 * Evaluates physiological bounds, demographic sets, cumulative obstetric scoring,
 * demographic risk matrix, real-time vital & symptom alerts, and personalized recommendations.
 */
function assess_risk($input, $ruleBase = [], $catalog = [], $pdo = null){
    require_once __DIR__ . '/pregnacare.php';

    // 1. Build standardized user payload for pregnacare.php engine
    $age = (int)($input['age'] ?? 25);
    $bmi = (float)($input['bmi'] ?? 22.0);
    $intervalYears = (float)($input['pregnancy_interval_years'] ?? 3.0);

    $vitals = [
        'sys_bp'  => (int)($input['bp_sys'] ?? 120),
        'dia_bp'  => (int)($input['bp_dia'] ?? 80),
        'temp'    => (float)($input['temp'] ?? 37.0),
        'hr'      => (int)($input['heart_rate'] ?? 75),
        'timing'  => $input['glucose_timing'] ?? 'preprandial',
        'glucose' => (int)($input['blood_sugar'] ?? 90),
    ];

    // Symptom intensities and counts
    $intensities = $input['symptom_intensities'] ?? [];
    $headacheIntensity = (float)($intensities['headache'] ?? 0);
    $bellyPainIntensity = (float)($intensities['abdominal_pain'] ?? 0);
    $bleedingIntensity = (float)($intensities['bleeding'] ?? 0);

    // Extract all symptom selections from the catalog input
    $hasHeadache = false;
    $hasBleeding = false;
    $hasAbdominalPain = false;
    $hasBreathingDiff = !empty($input['breathing_difficulty']);
    $hasFeverChills = !empty($input['fever_with_chills']);
    $hasFeverSweating = !empty($input['fever_with_sweating']);
    $hasLossFluid = !empty($input['loss_of_vaginal_fluid']);
    $hasDecreasedMovement = !empty($input['decreased_fetal_movement']);
    $hasDiscomfortUrination = !empty($input['discomfort_during_urination']);
    $hasBlurredVision = !empty($input['blurred_vision']);
    $hasConvulsions = !empty($input['convulsions']);
    $hasDizziness = !empty($input['dizziness']);
    $hasVomiting = !empty($input['vomiting']);
    $hasBackPain = !empty($input['back_pain']);
    $hasFatigue = !empty($input['fatigue']);
    $hasSwelling = !empty($input['swelling']);

    if (!empty($input['symptoms'])) {
        foreach ($input['symptoms'] as $s) {
            $sev = $s['severity'] ?? 'None';
            if ($sev === 'None') continue;
            $sid = $s['id'];
            if ($sid === 'headache') {
                $hasHeadache = true;
                if ($headacheIntensity === 0.0) $headacheIntensity = severity_label_to_intensity($sev);
            }
            if ($sid === 'bleeding') {
                $hasBleeding = true;
                if ($bleedingIntensity === 0.0) $bleedingIntensity = severity_label_to_intensity($sev);
            }
            if ($sid === 'abdominal_pain') {
                $hasAbdominalPain = true;
                if ($bellyPainIntensity === 0.0) $bellyPainIntensity = severity_label_to_intensity($sev);
            }
            if ($sid === 'difficulty_breathing') {
                $hasBreathingDiff = true;
            }
            if ($sid === 'fever') {
                if ($sev === 'Severe' || $sev === 'Moderate') $hasFeverChills = true;
            }
            if ($sid === 'fluid_loss') {
                $hasLossFluid = true;
            }
            if ($sid === 'reduced_movement') {
                $hasDecreasedMovement = true;
            }
            if ($sid === 'urinary_discomfort') {
                $hasDiscomfortUrination = true;
            }
            if ($sid === 'blurred_vision') {
                $hasBlurredVision = true;
            }
            if ($sid === 'convulsions') {
                $hasConvulsions = true;
            }
            if ($sid === 'dizziness') {
                $hasDizziness = true;
            }
            if ($sid === 'vomiting') {
                $hasVomiting = true;
            }
            if ($sid === 'back_pain') {
                $hasBackPain = true;
            }
            if ($sid === 'fatigue') {
                $hasFatigue = true;
            }
            if ($sid === 'swelling') {
                $hasSwelling = true;
            }
        }
    }

    $symptoms = [
        'preeclampsia_symptoms_count' => (int)($input['preeclampsia_symptoms_count'] ?? (($hasHeadache && $hasBlurredVision) ? 2 : 0)),
        'swollen_locations_count' => (int)($input['swollen_locations_count'] ?? ($hasSwelling ? 2 : 0)),
        'headache_intensity' => $headacheIntensity,
        'headache_symptoms' => $hasHeadache || $headacheIntensity > 0,
        'belly_pain_intensity' => $bellyPainIntensity,
        'belly_pain_symptoms_count' => (int)($input['belly_pain_symptoms_count'] ?? ($hasAbdominalPain ? 1 : 0)),
        'belly_pain_hard_abdomen' => !empty($input['belly_pain_with_hard_abdomen']),
        'belly_pain_bleeding' => !empty($input['belly_pain_with_bleeding']),
        'diabetes_symptoms_count' => (int)($input['diabetes_symptoms_count'] ?? 0),
        'vaginal_bleeding_intensity' => $bleedingIntensity,
        'fever_chills' => $hasFeverChills,
        'fever_sweating' => $hasFeverSweating,
        'breathing_diff' => $hasBreathingDiff,
        'breathing_sound' => !empty($input['breathing_with_sound']),
        'loss_vaginal_fluid' => $hasLossFluid,
        'decreased_fetal_movement' => $hasDecreasedMovement,
        'discomfort_urination' => $hasDiscomfortUrination,
        // Individual symptom flags for comprehensive personalization
        'abdominal_pain' => $hasAbdominalPain || $bellyPainIntensity > 0,
        'difficulty_breathing' => $hasBreathingDiff,
        'bleeding' => $hasBleeding || $bleedingIntensity > 0,
        'blurred_vision' => $hasBlurredVision,
        'convulsions' => $hasConvulsions,
        'dizziness' => $hasDizziness,
        'fatigue' => $hasFatigue,
        'vomiting' => $hasVomiting,
        'back_pain' => $hasBackPain,
        'swelling' => $hasSwelling,
    ];

    $demographics = [
        'age' => $age,
        'bmi' => $bmi,
        'pregnancy_interval_years' => $intervalYears,
    ];

    $riskHistory = $input['riskHistory'] ?? [];
    $medicalHistory = [
        'maternal_age' => $age,
        'parity' => (int)($riskHistory['parity'] ?? 1),
        'abortions' => !empty($riskHistory['prior_abortions_or_infertility']) ? 2 : 0,
        'infertility_history' => !empty($riskHistory['prior_abortions_or_infertility']),
        'previous_postpartum_bleeding' => !empty($riskHistory['prev_pp_hemorrhage']),
        'manual_removal_of_placenta' => !empty($riskHistory['prev_manual_placenta_removal']),
        'previous_baby_weight_lbs' => !empty($riskHistory['prev_baby_over_9lb']) ? 9.5 : 0,
        'prev_baby_over_9lb' => !empty($riskHistory['prev_baby_over_9lb']),
        'prev_baby_under_5lb8oz' => !empty($riskHistory['prev_baby_under_5lb8oz']) || !empty($riskHistory['prev_baby_over_5lb8oz']),
        'previous_toxemia_or_hpn' => !empty($riskHistory['prev_toxemia_hpn']),
        'previous_cesarean' => !empty($riskHistory['prev_cesarean']),
        'prev_cesarean' => !empty($riskHistory['prev_cesarean']),
        'previous_abnormal_difficult_labor' => !empty($riskHistory['prev_abnormal_labor']),
        'previous_gynecological_disease' => !empty($riskHistory['prev_gyn_disease']),
        'chronic_renal_disease' => !empty($riskHistory['chronic_renal_disease']),
        'gestational_diabetes' => !empty($riskHistory['gestational_diabetes']),
        'class_b_diabetes_or_higher' => !empty($riskHistory['class_b_diabetes_or_higher']),
        'cardiac_disease' => !empty($riskHistory['cardiac_disease']),
        'significant_medical_disease_score' => (int)($riskHistory['other_significant_disease_score'] ?? 0),
    ];

    $pp = $input['pregnancyProblems'] ?? [];
    $presentPregnancy = [
        'bleeding_less_than_20_weeks' => !empty($pp['bleeding_lt_20wks']),
        'bleeding_greater_than_20_weeks' => !empty($pp['bleeding_gt_20wks']),
        'anemia_less_than_10g' => (!empty($pp['anemia']) || ($input['hemoglobin'] !== null && (float)$input['hemoglobin'] < 10.0)),
        'anemia' => (!empty($pp['anemia']) || ($input['hemoglobin'] !== null && (float)$input['hemoglobin'] < 10.0)),
        'postmaturity_or_prematurity' => !empty($pp['postmaturity_prematurity']),
        'hypertension' => !empty($pp['hypertension']),
        'premature_rupture_of_membranes' => !empty($pp['prom']),
        'poly_or_oligohydramnios' => !empty($pp['poly_oligohydramnios']),
        'iugr' => !empty($pp['iugr']),
        'multiple_pregnancy' => !empty($pp['multiple_pregnancy']),
        'breech_or_malpresentation' => !empty($pp['breech_malpresentation']),
        'rh_isoimmunization' => !empty($pp['rh_isoimmunization']),
    ];

    $payload = [
        'vitals' => $vitals,
        'symptoms' => $symptoms,
        'demographics' => $demographics,
        'medical_history' => $medicalHistory,
        'present_pregnancy' => $presentPregnancy,
    ];

    // 2. Run pregnacare.php Master Engine
    $engineResult = runPregnacareDecisionEngine($payload);

    // Fallback if rejected (bounds error)
    if ($engineResult['status'] === 'REJECTED') {
        $overallRisk = 'High Risk';
        $alertLevel = 'Yellow_Alert';
        $demographicRisk = 'Moderate';
        $cumulativeScore = 3;
        $coopland = [
            'total_score' => 3,
            'classification' => 'High Risk',
            'rh_score' => 0,
            'mc_score' => 0,
            'pp_score' => 0,
            'categories' => [],
            'items' => []
        ];
        $recommendations = [
            ['category' => 'Validation Notice', 'text' => $engineResult['error'] ?? 'Please check vital entries.']
        ];
    } else {
        $overallRisk = $engineResult['overall_risk'];
        $alertLevel = $engineResult['alert_level'];
        $demographicRisk = $engineResult['demographic_risk'];
        $cumulativeScore = $engineResult['cumulative_risk_score'];
        $coopland = $engineResult['coopland'] ?? [
            'total_score' => $cumulativeScore,
            'classification' => $overallRisk,
            'rh_score' => 0,
            'mc_score' => 0,
            'pp_score' => 0,
            'categories' => [],
            'items' => []
        ];
        $recommendations = $engineResult['recommendations'] ?? [];
    }

    // 3. Map overall risk and score to gauge values (0-100 scale aligned with Coopland)
    // Low Risk: 10 - 35 | High Risk: 45 - 70 | Severe Risk: 75 - 100
    $gaugeScore = 20;
    if ($overallRisk === 'Severe Risk') {
        $gaugeScore = max(75, min(100, 70 + $cumulativeScore * 3));
    } elseif ($overallRisk === 'High Risk') {
        $gaugeScore = max(45, min(70, 36 + $cumulativeScore * 5));
    } else {
        $gaugeScore = max(10, min(35, 10 + $cumulativeScore * 8));
    }

    // Legacy string ('Low', 'High', 'Severe')
    $legacyLevel = 'Low';
    if ($overallRisk === 'Severe Risk') $legacyLevel = 'Severe';
    elseif ($overallRisk === 'High Risk') $legacyLevel = 'High';

    // Map Alert Level to Alert Type ('RED', 'YELLOW', 'GREEN')
    $alertType = 'GREEN';
    if ($alertLevel === 'Red_Alert') $alertType = 'RED';
    elseif ($alertLevel === 'Yellow_Alert') $alertType = 'YELLOW';

    // 4. Main Contributors for explainability
    $mainContributors = [];
    if ($alertLevel === 'Red_Alert') {
        $mainContributors[] = 'Emergency Red Alert: Critical clinical thresholds or severe symptoms detected requiring urgent triage.';
    } elseif ($alertLevel === 'Yellow_Alert') {
        $mainContributors[] = 'Yellow Alert: Moderate symptom indicators or vital deviations noted.';
    }

    $coopScore = $coopland['total_score'] ?? $cumulativeScore;
    $coopClass = $coopland['classification'] ?? $overallRisk;
    $rhS = $coopland['rh_score'] ?? 0;
    $mcS = $coopland['mc_score'] ?? 0;
    $ppS = $coopland['pp_score'] ?? 0;

    $mainContributors[] = "Coopland Evaluation: Total Score {$coopScore} ({$coopClass}) [Reproductive: {$rhS} pt(s), Medical/Surgical: {$mcS} pt(s), Present Pregnancy: {$ppS} pt(s)].";

    if ($demographicRisk === 'High') {
        $mainContributors[] = "High Baseline Demographic Risk: Based on maternal age ({$age}), BMI ({$bmi}), and pregnancy interval.";
    } elseif ($demographicRisk === 'Moderate') {
        $mainContributors[] = "Moderate Demographic Risk: Based on maternal age ({$age}) and BMI ({$bmi}).";
    }

    if (empty($mainContributors)) {
        $mainContributors[] = 'All vital signs, symptoms, and obstetric evaluation items remain within safe normal limits.';
    }

    // 5. Merge symptom-based granular recommendations
    $formattedRecs = [];
    foreach ($recommendations as $r) {
        $isUrgent = !empty($r['urgent']) || ($r['category'] === 'Urgent Action');
        $formattedRecs[] = [
            'text' => $r['text'],
            'category' => $r['category'] ?? 'Care Guidance',
            'icon' => $r['icon'] ?? ($isUrgent ? 'fa-triangle-exclamation' : 'fa-circle-check'),
            'urgent' => $isUrgent
        ];
    }

    // Add granular symptom-specific advice for each reported symptom if not already addressed
    $hasHighBP = ($vitals['sys_bp'] >= 130 || $vitals['dia_bp'] >= 85);
    if (!empty($input['symptoms'])) {
        foreach ($input['symptoms'] as $s) {
            $sev = $s['severity'] ?? 'Mild';
            if ($sev === 'None') continue;
            $advice = get_symptom_based_recommendations($s['id'], $sev, $hasHighBP);
            if (!empty($advice)) {
                $alreadyHas = false;
                $keyWord = str_replace('_', ' ', $s['id']);
                foreach ($formattedRecs as $existing) {
                    if (stripos($existing['text'], $keyWord) !== false ||
                        (stripos($existing['text'], 'abdominal') !== false && $s['id'] === 'abdominal_pain') ||
                        (stripos($existing['text'], 'breathing') !== false && $s['id'] === 'difficulty_breathing')) {
                        $alreadyHas = true;
                        break;
                    }
                }
                if (!$alreadyHas) {
                    $formattedRecs[] = $advice;
                }
            }
        }
    }

    // General reassurance and disclaimer
    $formattedRecs[] = ['text' => 'Stay well hydrated with clean water and rest whenever you feel fatigued.', 'icon' => 'fa-glass-water', 'urgent' => false];
    $formattedRecs[] = ['text' => 'Decision support only. Evaluated using Coopland High-Risk Pregnancy Scoring System.', 'icon' => 'fa-user-doctor', 'urgent' => false];

    // Deduplicate
    $seenTexts = [];
    $uniqueRecs = [];
    foreach ($formattedRecs as $fr) {
        $hash = md5($fr['text']);
        if (!isset($seenTexts[$hash])) {
            $seenTexts[$hash] = true;
            $uniqueRecs[] = $fr;
        }
    }

    // Detect progression
    $userId = $input['user_id'] ?? ($_SESSION['user_id'] ?? null);
    $overallSeverity = ($overallRisk === 'Severe Risk') ? 'SEVERE' : (($overallRisk === 'High Risk') ? 'HIGH' : 'LOW');
    $progression = detect_severity_progression($pdo, $userId, $overallSeverity, $overallRisk);

    return [
        'score' => $gaugeScore,
        'level' => $legacyLevel,
        'risk_level' => strtoupper($overallRisk),
        'overall_risk' => $overallRisk,
        'overall_severity' => $overallSeverity,
        'alert_type' => $alertType,
        'alert_level' => $alertLevel,
        'demographic_risk' => $demographicRisk,
        'cumulative_score' => $cumulativeScore,
        'coopland' => $coopland,
        'override_applied' => ($alertLevel !== 'Green_Alert'),
        'structural' => [
            'total' => $cumulativeScore,
            'coopland_score' => $coopScore,
            'coopland_classification' => $coopClass,
            'coopland_categories' => $coopland['categories'] ?? [],
            'hits' => $coopland['items'] ?? [],
        ],
        'fuzzy' => [
            'centroid' => $gaugeScore,
            'alert_level' => $alertLevel,
            'demographic_risk' => $demographicRisk,
            'coopland_score' => $coopScore,
        ],
        'main_contributors' => $mainContributors,
        'progression' => $progression,
        'recommendations' => array_slice($uniqueRecs, 0, 8),
        'system_actions' => $engineResult['system_actions'] ?? [],
        'generatedAt' => now_iso(),
    ];
}

/**
 * Record an OB-GYN / Hospital visit for a severe or high risk assessment,
 * archiving the incident into clinical history and marking the assessment resolved.
 */
function record_clinical_visit($pdo, $userId, $assessmentId, array $data) {
    // 1. Verify the assessment belongs to this user
    $stmt = $pdo->prepare("SELECT * FROM assessments WHERE id = ? AND user_id = ?");
    $stmt->execute([$assessmentId, $userId]);
    $asm = $stmt->fetch();
    if (!$asm) {
        throw new InvalidArgumentException("Assessment record not found.");
    }

    $facility = trim($data['facility'] ?? '');
    $doctorName = trim($data['doctor_name'] ?? '');
    $visitDate = !empty($data['visit_date']) ? date('Y-m-d H:i:s', strtotime($data['visit_date'])) : now_iso();
    $notes = trim($data['notes'] ?? '');
    $visitId = uid('cv');
    $createdAt = now_iso();

    // 2. Insert into clinical_visits table
    $stmt = $pdo->prepare("
        INSERT INTO clinical_visits (id, user_id, assessment_id, facility, doctor_name, visit_date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$visitId, $userId, $assessmentId, $facility, $doctorName, $visitDate, $notes, $createdAt]);

    // 3. Mark the assessment as resolved
    $stmt = $pdo->prepare("
        UPDATE assessments 
        SET status = 'resolved',
            visited_facility = ?,
            doctor_name = ?,
            visit_date = ?,
            doctor_notes = ?,
            resolved_at = ?
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([$facility, $doctorName, $visitDate, $notes, $createdAt, $assessmentId, $userId]);

    // 4. Create patient notification
    $facilityText = $facility ? " at {$facility}" : "";
    $title = "Clinical Visit Logged";
    $body = "Your medical consultation{$facilityText} has been recorded and your severe alert has been archived in your clinical history.";
    $pdo->prepare("INSERT INTO notifications (id, user_id, title, body, date, is_read, kind) VALUES (?,?,?,?,?,0,?)")
        ->execute([uid('ntf'), $userId, $title, $body, now_iso(), 'visit_resolved']);

    // 5. Audit log
    log_action('clinical_visit_recorded');

    return [
        'success' => true,
        'visit_id' => $visitId,
        'assessment_id' => $assessmentId,
    ];
}

/**
 * Fetch all past clinical visits for a patient with linked assessment information.
 */
function get_clinical_visits_history($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT cv.*, a.score as assessment_score, a.level as assessment_level, a.date as assessment_date, a.rules_json
        FROM clinical_visits cv
        JOIN assessments a ON cv.assessment_id = a.id
        WHERE cv.user_id = ?
        ORDER BY cv.visit_date DESC, cv.created_at DESC
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
}

/**
 * Render the modal dialog for pregnant patients to record their hospital / OB-GYN visit.
 */
function render_clinical_visit_modal($assessmentId, $redirectTo = 'dashboard') {
    ?>
    <div id="pcVisitModal" class="pc-modal-backdrop" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);">
      <div class="card" style="max-width:540px;width:100%;background:var(--surface);border-radius:18px;box-shadow:0 20px 40px rgba(0,0,0,0.25);position:relative;animation:pcModalFadeIn .2s ease-out;">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(20,184,166,0.15);display:flex;align-items:center;justify-content:center;color:var(--teal-dark);font-size:18px;">
              <i class="fa-solid fa-hospital-user"></i>
            </div>
            <div>
              <h3 style="margin:0;font-size:18px;color:var(--ink);">Record Hospital / OB-GYN Visit</h3>
              <div class="muted" style="font-size:12px;">Archive severe alert &amp; unlock fresh assessment</div>
            </div>
          </div>
          <button type="button" onclick="pcCloseVisitModal()" class="icon-btn" style="border:none;background:transparent;cursor:pointer;font-size:18px;color:var(--muted);">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form method="post" action="resolve_visit.php">
          <input type="hidden" name="assessment_id" value="<?php echo e($assessmentId); ?>">
          <input type="hidden" name="redirect_to" value="<?php echo e($redirectTo); ?>">

          <div class="field">
            <label><i class="fa-solid fa-hospital" style="color:var(--teal);margin-right:6px;"></i>Hospital / Clinic Name <span style="color:var(--risk-high); font-weight:bold;">*</span></label>
            <input type="text" name="facility" required placeholder="e.g. Cebu Doctors Hospital, City Health Office" class="input" />
          </div>

          <div class="grid grid-2" style="gap:12px;">
            <div class="field">
              <label><i class="fa-solid fa-user-doctor" style="color:var(--teal);margin-right:6px;"></i>Doctor / OB-GYN Name</label>
              <input type="text" name="doctor_name" placeholder="e.g. Dr. Maria Santos" class="input" />
            </div>
            <div class="field">
              <label><i class="fa-solid fa-calendar-day" style="color:var(--teal);margin-right:6px;"></i>Date &amp; Time of Visit <span style="color:var(--risk-high); font-weight:bold;">*</span></label>
              <input type="datetime-local" name="visit_date" required value="<?php echo date('Y-m-d\TH:i'); ?>" class="input" />
            </div>
          </div>

          <div class="field">
            <label><i class="fa-solid fa-notes-medical" style="color:var(--teal);margin-right:6px;"></i>Doctor's Findings / Advice / Treatment</label>
            <textarea name="notes" rows="3" class="input" placeholder="e.g. BP stabilized at 120/80 with medication. Advised bed rest and hydration. Cleared to monitor at home."></textarea>
            <span class="hint">This information is safely stored in your permanent medical history.</span>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;border-top:1px solid var(--border);padding-top:14px;">
            <button type="button" onclick="pcCloseVisitModal()" class="btn btn-outline btn-sm">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-check"></i> Save Visit &amp; Archive Alert</button>
          </div>
        </form>
      </div>
    </div>
    <script>
      function pcOpenVisitModal(){
        const m = document.getElementById('pcVisitModal');
        if (m) { m.style.display = 'flex'; }
      }
      function pcCloseVisitModal(){
        const m = document.getElementById('pcVisitModal');
        if (m) { m.style.display = 'none'; }
      }
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') pcCloseVisitModal();
      });
    </script>
    <style>
      @keyframes pcModalFadeIn {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    </style>
    <?php
}
