<?php
require_once __DIR__ . '/base.php';
$u = require_role('patient');

$stmt = $pdo->prepare("SELECT lmp FROM patient_profiles WHERE user_id = ?");
$stmt->execute([$u['id']]);
$lmp = $stmt->fetchColumn();
$currentTrimester = 1;
if ($lmp){
    $weeks = floor((time() - strtotime($lmp)) / (7*86400));
    $currentTrimester = $weeks < 14 ? 1 : ($weeks < 28 ? 2 : 3);
}

// Category shell — icon + display order shared across all trimesters.
$categoryMeta = [
  'healthy_living'       => ['icon' => 'fa-apple-whole',        'title' => 'Healthy Living'],
  'prenatal_testing'     => ['icon' => 'fa-vial-circle-check',  'title' => 'Prenatal Testing'],
  'symptoms_emergencies' => ['icon' => 'fa-triangle-exclamation','title' => 'Symptoms & Emergencies'],
  'hospital_information' => ['icon' => 'fa-hospital',           'title' => 'Hospital Information'],
  'faqs'                 => ['icon' => 'fa-circle-question',    'title' => 'FAQs'],
];

// Trimester-specific content for every category.
$guidance = [
  1 => [
    'label' => 'First Trimester',
    'categories' => [
      'healthy_living' => [
        'explain' => "Small changes now support your baby's earliest development.",
        'recommendations' => ['Eat balanced and nutrient-rich meals.', 'Include folate-rich foods.', 'Drink enough water.', 'Gentle walking and pregnancy-safe activities may be appropriate.'],
        'reminders' => ['Avoid alcohol, smoking, and unsafe medications.', 'Start prescribed prenatal vitamins with folic acid.'],
      ],
      'prenatal_testing' => [
        'explain' => 'Early testing confirms your pregnancy and sets a baseline for your care.',
        'recommendations' => ['Confirm pregnancy and estimate gestational age.', 'Schedule your first prenatal/OB visit.', 'Discuss existing medical conditions with your OB-GYN.', 'Ask about a dating ultrasound.'],
        'reminders' => ['Bring a list of current medications and supplements to your first visit.'],
      ],
      'symptoms_emergencies' => [
        'explain' => 'Most early symptoms are normal, but some need same-day care.',
        'recommendations' => ['Monitor early pregnancy symptoms like nausea and fatigue.', 'Track any spotting or cramping.'],
        'reminders' => ["Heavy bleeding, severe abdominal pain, fainting, or severe vomiting/dehydration need prompt medical attention — don't wait for your next visit."],
      ],
      'hospital_information' => [
        'explain' => "You likely won't need delivery logistics yet, but a little prep now helps.",
        'recommendations' => ["Save your OB-GYN's direct line.", 'Save your delivery hospital contact in your contacts.'],
        'reminders' => ["Confirm which hospital or birthing center your OB-GYN is affiliated with."],
      ],
      'faqs' => [
        'explain' => 'Answers to what most people ask in the first trimester.',
        'recommendations' => ['Is spotting normal? Light spotting can happen but should always be reported.', 'When will morning sickness improve? For most people, by around week 14.'],
        'reminders' => ["Any bleeding or severe pain should be reported to your OB-GYN, not just tracked at home."],
      ],
    ],
  ],
  2 => [
    'label' => 'Second Trimester',
    'categories' => [
      'healthy_living' => [
        'explain' => 'Your nutrient needs increase as your baby grows quickly this trimester.',
        'recommendations' => ['Continue iron, folic acid, calcium, and other prescribed supplements.', 'Eat protein-rich, iron-rich, and calcium-rich foods.', 'Maintain adequate hydration.', 'Walking, prenatal yoga, and other pregnancy-safe exercises may be appropriate.'],
        'reminders' => ['Avoid exercises flat on your back after the first trimester.'],
      ],
      'prenatal_testing' => [
        'explain' => 'Several key screenings happen in the second trimester.',
        'recommendations' => ['Follow recommended prenatal tests and screenings.', 'Attend your anatomy scan ultrasound (~18–20 weeks).', 'Complete glucose screening as scheduled.'],
        'reminders' => ["Ask your OB-GYN to explain any results you don't understand."],
      ],
      'symptoms_emergencies' => [
        'explain' => 'Fetal movement becomes a key thing to track this trimester.',
        'recommendations' => ['Monitor fetal movement as it becomes noticeable.', 'Monitor blood pressure and weight as advised.'],
        'reminders' => ['Vaginal bleeding, severe abdominal pain, severe headache with vision changes, sudden swelling, leaking fluid, or concerning changes in fetal movement should not be ignored.'],
      ],
      'hospital_information' => [
        'explain' => "Start getting familiar with where you'll deliver.",
        'recommendations' => ["Research your delivery hospital's labor & delivery unit.", 'Ask about registration or pre-admission paperwork.'],
        'reminders' => ["Save your OB-GYN's office number and emergency contact for quick access."],
      ],
      'faqs' => [
        'explain' => 'Common second-trimester questions.',
        'recommendations' => ['When will I feel the baby move? Most people start feeling movement between 18–22 weeks.', 'Is it safe to travel? Usually yes, but check with your OB-GYN for your specific situation.'],
        'reminders' => ["Get familiar with your baby's typical movement pattern so you'll notice changes."],
      ],
    ],
  ],
  3 => [
    'label' => 'Third Trimester',
    'categories' => [
      'healthy_living' => [
        'explain' => 'Comfort and preparation take priority as delivery approaches.',
        'recommendations' => ['Continue iron and calcium as prescribed.', 'Eat small frequent meals if more comfortable.', 'Gentle walking and pregnancy-safe exercises may be appropriate.'],
        'reminders' => ["Save higher-intensity activity for after delivery unless cleared by your OB-GYN."],
      ],
      'prenatal_testing' => [
        'explain' => 'Visits become more frequent to monitor you and your baby closely.',
        'recommendations' => ['Attend weekly/biweekly OB visits as advised.', 'Count/monitor fetal movements as instructed.'],
        'reminders' => ['Ask about Group B Strep testing, usually done around 36–37 weeks.'],
      ],
      'symptoms_emergencies' => [
        'explain' => 'Some symptoms this trimester are urgent and require immediate care.',
        'recommendations' => ['Count fetal movements as instructed.'],
        'reminders' => ['Severe headache with vision changes, heavy vaginal bleeding, sudden swelling of the face or hands, reduced fetal movement, or convulsions are urgent — seek immediate medical attention.'],
      ],
      'hospital_information' => [
        'explain' => "It's time to be fully ready for delivery.",
        'recommendations' => ['Pack your hospital bag.', 'Install your car seat.', "Confirm your delivery hospital's admission process."],
        'reminders' => ["Keep your OB-GYN's direct line and your hospital's labor & delivery unit number easy to find."],
      ],
      'faqs' => [
        'explain' => 'Common questions as you approach your due date.',
        'recommendations' => ["How do I know it's real labor? Contractions that get closer together, longer, and stronger, and don't ease with rest.", 'What if I go past my due date? Your OB-GYN will discuss monitoring or induction options.'],
        'reminders' => ["If you're ever unsure whether it's labor, call your OB-GYN or labor & delivery unit."],
      ],
    ],
  ],
];

render_header('Education Hub', 'education');
?>

<div class="card">
  <div class="eyebrow">Pregnancy Guidance</div>
  <h3 style="margin:6px 0 14px;">Explore recommendations by trimester</h3>

  <div class="trimester-tabs">
    <?php foreach ($guidance as $tri => $g): ?>
      <button type="button" data-trimester="<?php echo $tri; ?>" class="<?php echo $tri === $currentTrimester ? 'active' : ''; ?>">
        <?php echo e($g['label']); ?>
      </button>
    <?php endforeach; ?>
  </div>

  <?php foreach ($guidance as $tri => $g): ?>
    <div class="trimester-panel" data-trimester="<?php echo $tri; ?>" style="<?php echo $tri === $currentTrimester ? '' : 'display:none;'; ?>">
      <div class="ed-grid">
        <?php foreach ($categoryMeta as $key => $meta): $c = $g['categories'][$key]; ?>
          <div class="ed-card">
            <div class="ed-card-summary">
              <div class="ed-icon"><i class="fa-solid <?php echo e($meta['icon']); ?>"></i></div>
              <div class="ed-title"><?php echo e($meta['title']); ?></div>
            </div>
            <div class="ed-card-detail">
              <div class="ed-detail-header">
                <div class="ed-icon-lg"><i class="fa-solid <?php echo e($meta['icon']); ?>"></i></div>
                <div class="ed-detail-title"><?php echo e($meta['title']); ?></div>
                <button type="button" class="ed-close" aria-label="Close"><i class="fa-solid fa-chevron-up"></i></button>
              </div>
              <p class="ed-explain"><?php echo e($c['explain']); ?></p>
              <div class="ed-sub-title">Recommendations</div>
              <ul>
                <?php foreach ($c['recommendations'] as $item): ?><li><?php echo e($item); ?></li><?php endforeach; ?>
              </ul>
              <div class="ed-sub-title">Reminders</div>
              <ul class="ed-reminders">
                <?php foreach ($c['reminders'] as $item): ?><li><?php echo e($item); ?></li><?php endforeach; ?>
              </ul>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endforeach; ?>

  <p class="muted" style="font-size:12px;margin-top:16px;">General guidance only — always confirm specific recommendations with your OB-GYN.</p>
</div>

<div class="card" style="margin-top:16px;">
  <div class="eyebrow">Quick Reference</div>
  <h3 style="margin:6px 0 14px;">Tap a topic to read more</h3>
  <div class="ed-grid">
    <?php
    $kbIcons = [
      'Warning Signs'     => 'fa-triangle-exclamation',
      'Nutrition'         => 'fa-apple-whole',
      'Exercise'          => 'fa-person-walking',
      'Medication'        => 'fa-pills',
      'FAQ'               => 'fa-circle-question',
      'Hospital Contacts' => 'fa-hospital',
    ];
    foreach (KNOWLEDGE_BASE as $kb): $icon = $kbIcons[$kb['cat']] ?? 'fa-circle-info';
    ?>
      <div class="ed-card">
        <div class="ed-card-summary">
          <div class="ed-icon"><i class="fa-solid <?php echo e($icon); ?>"></i></div>
          <div class="ed-title"><?php echo e($kb['cat']); ?></div>
        </div>
        <div class="ed-card-detail">
          <div class="ed-detail-header">
            <div class="ed-icon-lg"><i class="fa-solid <?php echo e($icon); ?>"></i></div>
            <div class="ed-detail-title"><?php echo e($kb['title']); ?></div>
            <button type="button" class="ed-close" aria-label="Close"><i class="fa-solid fa-chevron-up"></i></button>
          </div>
          <p class="ed-explain" style="margin-bottom:0;"><?php echo e($kb['body']); ?></p>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<div class="ed-modal-backdrop" id="edModalBackdrop">
  <div class="ed-modal" id="edModalBody"></div>
</div>

<?php render_footer(); ?>