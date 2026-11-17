<?php
/* ============================================================
   PregnaCare — milestones_data.php
   Full 9-month development data & 40-week milestone tips
   ============================================================ */

const PREGNANCY_MONTH_DATA = [
    1 => [
        'month' => 1,
        'weeks' => 'Weeks 1 - 4',
        'sizeLength' => '~0.2 cm',
        'weight' => '< 1 g',
        'fruitCompare' => 'Poppy Seed',
        'highlights' => 'Fertilization and implantation in the uterine lining. The amniotic sac and placenta start forming.',
        'anatomy' => 'Rapid cell division transforms the blastocyst into an embryo. Foundations for neural tube begin.',
    ],
    2 => [
        'month' => 2,
        'weeks' => 'Weeks 5 - 8',
        'sizeLength' => '~1.6 cm',
        'weight' => '~1 g',
        'fruitCompare' => 'Raspberry',
        'highlights' => 'Heart begins beating at 100-160 bpm! Tiny limb buds for arms and legs appear and develop.',
        'anatomy' => 'Neural tube closes; facial features including eyes, nose, and tiny jaw start shaping.',
    ],
    3 => [
        'month' => 3,
        'weeks' => 'Weeks 9 - 13',
        'sizeLength' => '~7.4 cm',
        'weight' => '~23 g',
        'fruitCompare' => 'Lemon',
        'highlights' => 'All essential organs and limbs are formed. Baby can open and close tiny fists and curl toes.',
        'anatomy' => 'Unique fingerprints are established. Reflexes develop as baby swallows amniotic fluid.',
    ],
    4 => [
        'month' => 4,
        'weeks' => 'Weeks 14 - 17',
        'sizeLength' => '~13 cm',
        'weight' => '~140 g',
        'fruitCompare' => 'Avocado',
        'highlights' => 'Baby can suck their thumb and make cute facial expressions! Genitals are discernible on ultrasound.',
        'anatomy' => 'Fine downy hair (lanugo) covers the body. Cartilage skeleton begins transforming into bone.',
    ],
    5 => [
        'month' => 5,
        'weeks' => 'Weeks 18 - 21',
        'sizeLength' => '~26 cm',
        'weight' => '~360 g',
        'fruitCompare' => 'Banana',
        'highlights' => 'Quickening! You can feel the first flutter kicks. Baby develops regular sleep-wake cycles.',
        'anatomy' => 'Vernix caseosa coating protects baby’s skin. Eyebrows, eyelashes, and head hair start growing.',
    ],
    6 => [
        'month' => 6,
        'weeks' => 'Weeks 22 - 26',
        'sizeLength' => '~35 cm',
        'weight' => '~760 g',
        'fruitCompare' => 'Eggplant',
        'highlights' => 'Baby hears your voice and heartbeat! Eyelids flutter open and baby responds to music and belly touch.',
        'anatomy' => 'Lungs begin producing surfactant for breathing. Finger and toe nails are fully developed.',
    ],
    7 => [
        'month' => 7,
        'weeks' => 'Weeks 27 - 30',
        'sizeLength' => '~40 cm',
        'weight' => '~1.3 kg',
        'fruitCompare' => 'Cabbage',
        'highlights' => 'Baby’s eyes open and perceive light. Rapid brain growth and REM sleep (dreaming) begins.',
        'anatomy' => 'Billions of brain neurons form. Subcutaneous fat deposits increase to regulate body temperature.',
    ],
    8 => [
        'month' => 8,
        'weeks' => 'Weeks 31 - 35',
        'sizeLength' => '~46 cm',
        'weight' => '~2.4 kg',
        'fruitCompare' => 'Honeydew Melon',
        'highlights' => 'Rapid weight gain. Kicks and turns are strong and visible. Most babies begin turning head-down.',
        'anatomy' => 'Bones are fully developed though skull remains pliable for birth. Immune antibodies absorb from mother.',
    ],
    9 => [
        'month' => 9,
        'weeks' => 'Weeks 36 - 40',
        'sizeLength' => '~51 cm',
        'weight' => '~3.4 kg',
        'fruitCompare' => 'Small Pumpkin',
        'highlights' => 'Full term! Lungs and reflexes are mature. Baby drops lower into the pelvis getting ready for birth.',
        'anatomy' => 'Vernix and lanugo shed; brain and lung maturation complete. Ready to meet the world!',
    ],
];

function get_week_milestone_details($week) {
    $w = max(4, min(40, (int)$week));
    $milestones = [
        32 => [
            'week' => 32,
            'sizeName' => 'Jicama',
            'emoji' => '🥔',
            'lengthApprox' => '42.4 cm',
            'weightApprox' => '1700 g',
            'babyDevelopment' => 'Baby is practicing breathing movements continuously. Most babies begin turning into the head-down position.',
            'momSymptoms' => 'Braxton Hicks tightenings become more frequent; mild pelvic heaviness and shortness of breath.',
            'weeklyTip' => 'Your prenatal visits will now typically occur every 2 weeks until delivery. Keep monitoring daily fetal kick counts.',
        ],
        28 => [
            'week' => 28,
            'sizeName' => 'Eggplant',
            'emoji' => '🍆',
            'lengthApprox' => '37.6 cm',
            'weightApprox' => '1000 g',
            'babyDevelopment' => 'Baby can now blink and has eyelashes! Brain development is accelerating rapidly.',
            'momSymptoms' => 'Mild leg cramps, lower back fatigue, and mild swelling in ankles.',
            'weeklyTip' => 'Welcome to Trimester 3! Time to start tracking daily kick counts after meals.',
        ],
        36 => [
            'week' => 36,
            'sizeName' => 'Romaine Lettuce',
            'emoji' => '🥬',
            'lengthApprox' => '47.4 cm',
            'weightApprox' => '2600 g',
            'babyDevelopment' => 'Baby is fully formed and shedding lanugo. Taking up nearly all available room in the uterus.',
            'momSymptoms' => 'Pelvic pressure increases as baby drops. Frequent bathroom trips.',
            'weeklyTip' => 'Pack your hospital bag checklist and have your birth preferences plan ready.',
        ]
    ];
    if (isset($milestones[$w])) return $milestones[$w];

    $fruit = baby_size_for_week($w);
    return [
        'week' => $w,
        'sizeName' => $fruit[0] ?? 'Baby',
        'emoji' => $fruit[1] ?? '👶',
        'lengthApprox' => '~' . round($w * 1.3, 1) . ' cm',
        'weightApprox' => '~' . round(pow($w, 2.15)) . ' g',
        'babyDevelopment' => "Baby's vital organs, neural circuits, and sensory reflexes are developing steadily this week.",
        'momSymptoms' => "Body changes, healthy weight gain, and occasional fatigue are natural as your belly grows.",
        'weeklyTip' => "Ensure adequate daily hydration, balanced nutrition, and record your vitals and symptoms regularly.",
    ];
}
