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

// Meal/recipe ideas per trimester. Each card pops up (reusing the Education Hub's
// icon-card + modal pattern) to show why it helps and a simple prep tip.
$meals = [
  1 => [
    'label' => 'First Trimester',
    'focus' => 'Nausea is common early on — these lean toward bland, folate-rich, and easy on the stomach.',
    'items' => [
      ['icon'=>'fa-mug-hot', 'title'=>'Ginger Tea & Crackers', 'why'=>'Ginger is commonly used to ease morning sickness, and plain crackers are gentle on an unsettled stomach.', 'tip'=>'Steep fresh ginger slices in hot water for 5–10 minutes. Sip slowly, first thing in the morning if nausea is worse then.'],
      ['icon'=>'fa-seedling', 'title'=>'Leafy Greens Salad', 'why'=>'Leafy greens like spinach and kangkong are rich in folate, important for your baby\'s early neural development.', 'tip'=>'Toss with a light vinaigrette and a handful of nuts for extra protein.'],
      ['icon'=>'fa-lemon', 'title'=>'Citrus Fruit Bowl', 'why'=>'Vitamin C from citrus helps your body absorb iron better, and the acidity can help settle some stomachs.', 'tip'=>'Mix orange, calamansi, or dalandan segments with a little honey.'],
      ['icon'=>'fa-egg', 'title'=>'Scrambled Eggs & Toast', 'why'=>'Eggs are an easy source of protein and choline, both important in early pregnancy, and are usually gentle on the stomach.', 'tip'=>'Cook eggs soft and pair with plain toast if nausea is an issue — avoid heavy spices for now.'],
      ['icon'=>'fa-bowl-rice', 'title'=>'Oatmeal with Berries', 'why'=>'Oats are gentle, high in fiber, and help with the constipation that can start early in pregnancy.', 'tip'=>'Top with a few berries and a drizzle of honey instead of sugar.'],
      ['icon'=>'fa-glass-water', 'title'=>'Hydration Reminder', 'why'=>'Staying hydrated can help reduce nausea and headaches, both common in the first trimester.', 'tip'=>'Keep a water bottle nearby and sip throughout the day rather than large amounts at once.'],
    ],
  ],
  2 => [
    'label' => 'Second Trimester',
    'focus' => 'Your baby is growing quickly now — protein, iron, and calcium needs go up.',
    'items' => [
      ['icon'=>'fa-fish', 'title'=>'Grilled Fish & Vegetables', 'why'=>'Fish like bangus or tilapia provide omega-3s and protein that support your baby\'s brain development.', 'tip'=>'Grill or bake instead of frying, and pair with a side of steamed vegetables.'],
      ['icon'=>'fa-carrot', 'title'=>'Bean & Lentil Soup (Munggo)', 'why'=>'Beans and lentils are a great plant-based source of iron and fiber, helping prevent anemia.', 'tip'=>'A classic monggo soup with a bit of malunggay leaves adds even more iron.'],
      ['icon'=>'fa-cookie-bite', 'title'=>'Yogurt & Nut Parfait', 'why'=>'Yogurt and nuts together provide calcium and protein for your baby\'s developing bones.', 'tip'=>'Layer plain yogurt with a handful of almonds or peanuts and a few slices of banana.'],
      ['icon'=>'fa-egg', 'title'=>'Spinach & Egg Omelette', 'why'=>'This combo doubles up on iron (spinach) and protein (egg) in one easy dish.', 'tip'=>'Add a slice of cheese for extra calcium if you tolerate dairy well.'],
      ['icon'=>'fa-glass-water', 'title'=>'Milk or Fortified Drinks', 'why'=>'Calcium needs increase this trimester as your baby\'s bones and teeth develop.', 'tip'=>'If you\'re lactose sensitive, try lactose-free milk or a calcium-fortified plant milk instead.'],
      ['icon'=>'fa-drumstick-bite', 'title'=>'Lean Meat Stir-fry', 'why'=>'Lean beef or chicken is a strong source of iron and protein to support your increasing blood volume.', 'tip'=>'Stir-fry with vegetables and a little garlic — quick, and pairs well with brown rice.'],
    ],
  ],
  3 => [
    'label' => 'Third Trimester',
    'focus' => 'Less room for big meals as baby grows — smaller, frequent meals with steady energy work best.',
    'items' => [
      ['icon'=>'fa-clock', 'title'=>'Small, Frequent Meals', 'why'=>'As your baby takes up more space, smaller meals spread through the day can feel a lot more comfortable than 3 big ones.', 'tip'=>'Try 5–6 small meals instead of 3 large ones if you\'re feeling full quickly or dealing with heartburn.'],
      ['icon'=>'fa-bread-slice', 'title'=>'Whole Grain Toast & Peanut Butter', 'why'=>'A mix of complex carbs and protein gives you steady energy without a sugar crash.', 'tip'=>'Good as a light meal or snack between your main meals.'],
      ['icon'=>'fa-cookie-bite', 'title'=>'Dates & Nuts', 'why'=>'A naturally sweet, energy-dense snack — some studies suggest dates in late pregnancy may be associated with easier labor, though more research is still needed.', 'tip'=>'A small handful of dates with a few nuts makes an easy on-the-go snack.'],
      ['icon'=>'fa-bowl-rice', 'title'=>'Chicken & Rice Bowl', 'why'=>'A balanced combination of protein and complex carbs to keep your energy steady as your due date approaches.', 'tip'=>'Keep portions moderate and pair with vegetables for fiber, which helps with third-trimester constipation.'],
      ['icon'=>'fa-blender', 'title'=>'Fruit Smoothie', 'why'=>'Easy to digest and hydrating — a good option if solid food feels like a lot with your baby taking up more space.', 'tip'=>'Blend banana, milk or yogurt, and a handful of berries for a quick, filling snack.'],
      ['icon'=>'fa-mug-hot', 'title'=>'Caffeine-Free Herbal Tea', 'why'=>'Staying hydrated matters as much as ever, and swapping in caffeine-free tea helps you cut back on caffeine before delivery.', 'tip'=>'Chamomile or ginger tea (check with your OB-GYN on any herbal tea first) can also help you wind down in the evening.'],
    ],
  ],
];

render_header('Meal Planner', 'meal_planner');
?>

<div class="card">
  <div class="eyebrow">Nutrition Guidance</div>
  <h3 style="margin:6px 0 14px;">Meal ideas by trimester</h3>

  <div class="trimester-tabs">
    <?php foreach ($meals as $tri => $g): ?>
      <button type="button" data-trimester="<?php echo $tri; ?>" class="<?php echo $tri === $currentTrimester ? 'active' : ''; ?>">
        <?php echo e($g['label']); ?>
      </button>
    <?php endforeach; ?>
  </div>

  <?php foreach ($meals as $tri => $g): ?>
    <div class="trimester-panel" data-trimester="<?php echo $tri; ?>" style="<?php echo $tri === $currentTrimester ? '' : 'display:none;'; ?>">
      <p class="muted" style="font-size:13px;margin:14px 0 4px;"><?php echo e($g['focus']); ?></p>

      <div class="ed-grid">
        <?php foreach ($g['items'] as $item):
          // Expected photo path — drop a matching image into img/meals/ and it
          // shows automatically; until then it quietly falls back to the icon.
          $slug = trim(strtolower(preg_replace('/[^a-z0-9]+/i', '-', $item['title'])), '-');
          $photoPath = 'img/meals/' . $slug . '.jpg';
        ?>
          <div class="ed-card">
            <div class="ed-card-summary">
              <div class="ed-icon" style="overflow:hidden;position:relative;">
                <img src="<?php echo e($photoPath); ?>" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:1;" onload="this.style.display='block';this.nextElementSibling.style.display='none';" onerror="this.style.display='none';">
                <i class="fa-solid <?php echo e($item['icon']); ?>"></i>
              </div>
              <div class="ed-title"><?php echo e($item['title']); ?></div>
            </div>
            <div class="ed-card-detail">
              <div class="ed-detail-header">
                <div class="ed-icon-lg" style="overflow:hidden;position:relative;">
                  <img src="<?php echo e($photoPath); ?>" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:1;" onload="this.style.display='block';this.nextElementSibling.style.display='none';" onerror="this.style.display='none';">
                  <i class="fa-solid <?php echo e($item['icon']); ?>"></i>
                </div>
                <div class="ed-detail-title"><?php echo e($item['title']); ?></div>
                <button type="button" class="ed-close" aria-label="Close"><i class="fa-solid fa-chevron-up"></i></button>
              </div>
              <p class="ed-explain"><?php echo e($item['why']); ?></p>
              <div class="ed-sub-title">Simple Prep Tip</div>
              <p style="font-size:13.5px;color:var(--ink);margin:0;"><?php echo e($item['tip']); ?></p>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endforeach; ?>

  <p class="muted" style="font-size:12px;margin-top:16px;">General guidance only — always confirm specific dietary changes and supplements with your OB-GYN, especially if you have any medical conditions.</p>
</div>

<div class="ed-modal-backdrop" id="edModalBackdrop">
  <div class="ed-modal" id="edModalBody"></div>
</div>

<?php render_footer(); ?>