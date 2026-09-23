/**
 * PregnaCare Clinical Risk Engine — TypeScript Port
 * 1:1 Implementation of the 8-Stage Clinical Decision Engine defined in pregnacare.php.
 * 
 * Stages:
 * 1. Physical Bounds & Plausibility Validation
 * 2. Demographic Feature Set Classification (Age, BMI, Inter-pregnancy Interval)
 * 3. Cumulative Clinical Risk Scoring (RH, MC, PP rules)
 * 4. Demographic Risk Matrix Evaluation
 * 5. Real-Time Alert Evaluation (Red, Yellow, Green Alert)
 * 6. Overall Risk Status Synthesis (Low Risk, High Risk, Severe Risk)
 * 7. Personalized Recommendations Engine (Clinical directives + vitals + symptoms + demographics)
 * 8. Pipeline Controller (Master execution)
 * 
 * Decision support only, not medical diagnosis.
 */

export interface SymptomEntry {
  id: string;
  severity: 'None' | 'Mild' | 'Moderate' | 'Severe';
  duration?: 'Today' | '1–3 Days' | 'More than 3 Days';
  frequency?: 'Rare' | 'Sometimes' | 'Often' | 'Always';
}

export interface RiskEngineInput {
  age: number;
  trimester?: number;
  bp_sys: number;
  bp_dia: number;
  bmi: number;
  hemoglobin?: number;
  blood_sugar?: number;
  temp?: number;
  heart_rate?: number;
  fetal_heart_rate?: number;
  respiratory_rate?: number;
  glucose_timing?: string;
  inter_pregnancy_interval?: number;
  symptom_intensities?: Record<string, number>;
  swollen_locations_count?: number;
  swollen_locations?: string[];
  belly_pain_with_hard_abdomen?: boolean;
  belly_pain_with_bleeding?: boolean;
  loss_of_vaginal_fluid?: boolean;
  decreased_fetal_movement?: boolean;
  fever_with_chills?: boolean;
  fever_with_sweating?: boolean;
  breathing_difficulty?: boolean;
  breathing_with_sound?: boolean;
  discomfort_during_urination?: boolean;
  diabetes_symptoms_count?: number;
  preeclampsia_symptoms_count?: number;
  belly_pain_symptoms_count?: number;
  riskHistory?: Record<string, any>;
  pregnancyProblems?: Record<string, any>;
  symptoms: SymptomEntry[];
}

export interface PregnacarePayload {
  vitals: {
    sys_bp?: number;
    dia_bp?: number;
    temp?: number;
    hr?: number;
    timing?: string;
    glucose?: number;
    fhr?: number;
    rr?: number;
    hemoglobin?: number;
  };
  symptoms: {
    preeclampsia_symptoms_count?: number;
    swollen_locations_count?: number;
    headache_intensity?: number;
    headache_symptoms?: boolean;
    belly_pain_intensity?: number;
    belly_pain_symptoms_count?: number;
    belly_pain_hard_abdomen?: boolean;
    belly_pain_bleeding?: boolean;
    diabetes_symptoms_count?: number;
    vaginal_bleeding_intensity?: number;
    fever_chills?: boolean;
    fever_sweating?: boolean;
    breathing_diff?: boolean;
    breathing_sound?: boolean;
    loss_vaginal_fluid?: boolean;
    decreased_fetal_movement?: boolean;
    discomfort_urination?: boolean;
    [key: string]: any;
  };
  demographics: {
    age?: number;
    bmi?: number;
    inter_pregnancy_interval?: number;
  };
  medical_history: Record<string, any>;
  present_pregnancy: Record<string, any>;
}

export interface CooplandItem {
  id: string;
  label: string;
  points: number;
  cat: 'RH' | 'MC' | 'PP';
}

export interface CooplandEvaluation {
  total_score: number;
  classification: 'Low Risk' | 'High Risk' | 'Severe Risk';
  rh_score: number;
  mc_score: number;
  pp_score: number;
  categories: {
    reproductive_history: { name: string; subtotal: number; items: CooplandItem[] };
    medical_surgical: { name: string; subtotal: number; items: CooplandItem[] };
    present_pregnancy: { name: string; subtotal: number; items: CooplandItem[] };
  };
  items: CooplandItem[];
}

export const RULE_SCORES: Record<string, { label: string; points: number; cat: 'RH' | 'MC' | 'PP' }> = {
  // Reproductive History (RH)
  'RH-01': { label: 'Age < 16', points: 1, cat: 'RH' },
  'RH-02': { label: 'Age > 35', points: 2, cat: 'RH' },
  'RH-03': { label: 'Parity 0 (First Pregnancy)', points: 1, cat: 'RH' },
  'RH-05': { label: 'Parity > 4 (Grand Multipara)', points: 2, cat: 'RH' },
  'RH-06': { label: 'Abortions ≥ 2 / Infertility hx', points: 1, cat: 'RH' },
  'RH-07': { label: 'Postpartum Bleeding (PPH)', points: 1, cat: 'RH' },
  'RH-08': { label: 'Manual removal of placenta', points: 1, cat: 'RH' },
  'RH-09': { label: 'Previous pregnancy > 9 lbs.', points: 1, cat: 'RH' },
  'RH-10': { label: 'Previous pregnancy < 5 lbs. 8 oz (Low Birth Weight)', points: 1, cat: 'RH' },
  'RH-11': { label: 'Previous Toxemia or HPN', points: 1, cat: 'RH' },
  'RH-12': { label: 'Previous Cesarean Section (CS)', points: 2, cat: 'RH' },
  'RH-13': { label: 'Abnormal / Difficult Labor', points: 2, cat: 'RH' },

  // Medical/Surgical Conditions (MC)
  'MC-01': { label: 'Previous Gyne Disease / Surgery', points: 1, cat: 'MC' },
  'MC-02': { label: 'Chronic Renal Disease', points: 1, cat: 'MC' },
  'MC-03': { label: 'Gestational Diabetes (Class A)', points: 1, cat: 'MC' },
  'MC-04': { label: 'Class B Diabetes or Higher', points: 3, cat: 'MC' },
  'MC-05': { label: 'Cardiac Disease', points: 3, cat: 'MC' },

  // Present Pregnancy Problems (PP)
  'PP-01': { label: 'Bleeding < 20 wks.', points: 1, cat: 'PP' },
  'PP-02': { label: 'Bleeding > 20 weeks', points: 3, cat: 'PP' },
  'PP-03': { label: 'Anemia < 10 gm. %', points: 1, cat: 'PP' },
  'PP-04': { label: 'Postmaturity / Prematurity', points: 1, cat: 'PP' },
  'PP-05': { label: 'Hypertension', points: 2, cat: 'PP' },
  'PP-06': { label: 'Premature Rupture of Membrane (PROM)', points: 1, cat: 'PP' },
  'PP-07': { label: 'Polyhydramnios / Oligohydramnios', points: 1, cat: 'PP' },
  'PP-08': { label: 'Intrauterine Growth Restriction (IUGR)', points: 1, cat: 'PP' },
  'PP-09': { label: 'Multiple Pregnancy', points: 1, cat: 'PP' },
  'PP-10': { label: 'Breech / Malpresentation', points: 1, cat: 'PP' },
  'PP-11': { label: 'RH Isoimmunization', points: 3, cat: 'PP' },
};

// ============================================================================
// STAGE 1: PHYSICAL BOUNDS & PLAUSIBILITY VALIDATION
// ============================================================================
export function validateVitalsInput(vitals: Record<string, any>): { isValid: boolean; message: string } {
  if (vitals.sys_bp !== undefined && vitals.sys_bp !== null && vitals.sys_bp > 0) {
    if (vitals.sys_bp < 60 || vitals.sys_bp > 260) {
      return { isValid: false, message: `Systolic BP (${vitals.sys_bp} mmHg) outside plausible bounds [60-260].` };
    }
  }

  if (vitals.dia_bp !== undefined && vitals.dia_bp !== null && vitals.dia_bp > 0) {
    if (vitals.dia_bp < 30 || vitals.dia_bp > 160) {
      return { isValid: false, message: `Diastolic BP (${vitals.dia_bp} mmHg) outside plausible bounds [30-160].` };
    }
  }

  if (vitals.temp !== undefined && vitals.temp !== null && vitals.temp > 0) {
    if (vitals.temp < 30.0 || vitals.temp > 45.0) {
      return { isValid: false, message: `Body temperature (${vitals.temp} °C) outside plausible bounds [30-45].` };
    }
  }

  if (vitals.hr !== undefined && vitals.hr !== null && vitals.hr > 0) {
    if (vitals.hr < 30 || vitals.hr > 240) {
      return { isValid: false, message: `Heart rate (${vitals.hr} bpm) outside plausible bounds [30-240].` };
    }
  }

  if (vitals.glucose !== undefined && vitals.glucose !== null && vitals.glucose > 0) {
    if (vitals.glucose < 40 || vitals.glucose > 500) {
      return { isValid: false, message: `Blood glucose (${vitals.glucose} mg/dL) outside plausible bounds [40-500].` };
    }
  }

  return { isValid: true, message: 'Valid' };
}

// ============================================================================
// STAGE 2: DEMOGRAPHIC FEATURE SET CLASSIFICATION
// ============================================================================
export function classifyDemographicSets(demographics: { age?: number; bmi?: number; inter_pregnancy_interval?: number }): {
  age_set: 'Lower' | 'Normal' | 'Higher';
  bmi_set: 'Lower' | 'Normal' | 'Higher';
  interval_set: 'Lower' | 'Normal' | 'Higher';
} {
  const age = demographics.age ?? 25;
  const bmi = demographics.bmi ?? 22.0;
  const interval = demographics.inter_pregnancy_interval ?? 24;

  let age_set: 'Lower' | 'Normal' | 'Higher' = 'Normal';
  if (age < 18) age_set = 'Lower';
  else if (age <= 35) age_set = 'Normal';
  else age_set = 'Higher';

  let bmi_set: 'Lower' | 'Normal' | 'Higher' = 'Normal';
  if (bmi < 18.5) bmi_set = 'Lower';
  else if (bmi <= 24.9) bmi_set = 'Normal';
  else bmi_set = 'Higher';

  let interval_set: 'Lower' | 'Normal' | 'Higher' = 'Normal';
  if (interval < 2.0) interval_set = 'Lower';
  else if (interval <= 10.0) interval_set = 'Normal';
  else interval_set = 'Higher';

  return { age_set, bmi_set, interval_set };
}

// ============================================================================
// STAGE 3: CUMULATIVE CLINICAL RISK SCORING (RH / MC / PP - COOPLAND EVALUATION)
// ============================================================================
export function calculateCumulativeRiskScore(
  medicalHistory: Record<string, any> = {},
  presentPregnancy: Record<string, any> = {}
): { score: number; hits: CooplandItem[] } {
  const hits: CooplandItem[] = [];
  const add = (id: string) => {
    if (RULE_SCORES[id]) {
      hits.push({ id, ...RULE_SCORES[id] });
    }
  };

  const age = Number(medicalHistory.maternal_age ?? medicalHistory.age ?? 25);
  const parity = Number(medicalHistory.parity ?? 1);

  // Reproductive History (RH)
  if (age < 16) add('RH-01');
  else if (age > 35) add('RH-02');

  if (parity === 0) add('RH-03');
  else if (parity > 4) add('RH-05');

  if (Number(medicalHistory.abortions ?? medicalHistory.prior_abortions_or_infertility ?? 0) >= 2 || medicalHistory.infertility_history) add('RH-06');
  if (medicalHistory.previous_postpartum_bleeding || medicalHistory.prev_pp_hemorrhage) add('RH-07');
  if (medicalHistory.manual_removal_of_placenta || medicalHistory.prev_manual_placenta_removal) add('RH-08');
  
  const prevBabyWeight = Number(medicalHistory.previous_baby_weight_lbs ?? medicalHistory.prev_baby_weight_lbs ?? 0);
  if (prevBabyWeight > 9.0 || medicalHistory.prev_baby_over_9lb) add('RH-09');
  if (
    medicalHistory.prev_baby_under_5lb8oz ||
    medicalHistory.previous_baby_under_5lb8oz ||
    medicalHistory.prev_baby_over_5lb8oz || // backward compat
    (prevBabyWeight > 0 && prevBabyWeight < 5.5)
  ) {
    add('RH-10');
  }
  if (medicalHistory.previous_toxemia_or_hpn || medicalHistory.prev_toxemia_hpn) add('RH-11');
  if (medicalHistory.previous_cesarean || medicalHistory.prev_cesarean) add('RH-12');
  if (medicalHistory.previous_abnormal_difficult_labor || medicalHistory.prev_abnormal_labor) add('RH-13');

  // Medical Conditions (MC)
  if (medicalHistory.previous_gynecological_disease || medicalHistory.prev_gyn_disease) add('MC-01');
  if (medicalHistory.chronic_renal_disease) add('MC-02');
  if (medicalHistory.gestational_diabetes) add('MC-03');
  if (medicalHistory.class_b_diabetes_or_higher) add('MC-04');
  if (medicalHistory.cardiac_disease) add('MC-05');
  const otherScore = Math.max(0, Math.min(5, Number(medicalHistory.significant_medical_disease_score ?? medicalHistory.other_significant_disease_score ?? 0)));
  if (otherScore > 0) {
    hits.push({ id: 'MC-06', label: 'Other significant medical disease', points: otherScore, cat: 'MC' });
  }

  // Present Pregnancy Problems (PP)
  if (presentPregnancy.bleeding_less_than_20_weeks || presentPregnancy.bleeding_lt_20wks) add('PP-01');
  if (presentPregnancy.bleeding_greater_than_20_weeks || presentPregnancy.bleeding_gt_20wks) add('PP-02');
  if (presentPregnancy.anemia_less_than_10g || presentPregnancy.anemia) add('PP-03');
  if (presentPregnancy.postmaturity_or_prematurity || presentPregnancy.postmaturity_prematurity) add('PP-04');
  if (presentPregnancy.hypertension) add('PP-05');
  if (presentPregnancy.premature_rupture_of_membranes || presentPregnancy.prom) add('PP-06');
  if (presentPregnancy.poly_or_oligohydramnios || presentPregnancy.poly_oligohydramnios) add('PP-07');
  if (presentPregnancy.iugr) add('PP-08');
  if (presentPregnancy.multiple_pregnancy) add('PP-09');
  if (presentPregnancy.breech_or_malpresentation || presentPregnancy.breech_malpresentation) add('PP-10');
  if (presentPregnancy.rh_isoimmunization) add('PP-11');

  const score = hits.reduce((sum, h) => sum + h.points, 0);
  return { score, hits };
}

/**
 * Evaluates the full Coopland High-Risk Evaluation Form with column totals and classification.
 */
export function evaluateCooplandForm(
  medicalHistory: Record<string, any> = {},
  presentPregnancy: Record<string, any> = {}
): CooplandEvaluation {
  const clinical = calculateCumulativeRiskScore(medicalHistory, presentPregnancy);
  const hits = clinical.hits;

  const rhItems = hits.filter((h) => h.cat === 'RH');
  const mcItems = hits.filter((h) => h.cat === 'MC');
  const ppItems = hits.filter((h) => h.cat === 'PP');

  const rhScore = rhItems.reduce((s, h) => s + h.points, 0);
  const mcScore = mcItems.reduce((s, h) => s + h.points, 0);
  const ppScore = ppItems.reduce((s, h) => s + h.points, 0);
  const totalScore = rhScore + mcScore + ppScore;

  let classification: 'Low Risk' | 'High Risk' | 'Severe Risk' = 'Low Risk';
  if (totalScore >= 7) {
    classification = 'Severe Risk';
  } else if (totalScore >= 3) {
    classification = 'High Risk';
  }

  return {
    total_score: totalScore,
    classification,
    rh_score: rhScore,
    mc_score: mcScore,
    pp_score: ppScore,
    categories: {
      reproductive_history: {
        name: 'Reproductive History',
        subtotal: rhScore,
        items: rhItems,
      },
      medical_surgical: {
        name: 'Medical / Surgical Condition',
        subtotal: mcScore,
        items: mcItems,
      },
      present_pregnancy: {
        name: 'Present Pregnancy',
        subtotal: ppScore,
        items: ppItems,
      },
    },
    items: hits,
  };
}

// ============================================================================
// STAGE 4: DEMOGRAPHIC RISK MATRIX
// ============================================================================
export function evaluateDemographicRiskMatrix(demographics: { age?: number; bmi?: number; inter_pregnancy_interval?: number }): 'High' | 'Moderate' | 'Low' {
  const classified = classifyDemographicSets(demographics);
  const { age_set, bmi_set, interval_set } = classified;

  // High-Risk Combinations
  if (
    (age_set === 'Normal' && bmi_set === 'Higher' && interval_set === 'Higher') ||
    (age_set === 'Higher' && bmi_set === 'Higher' && interval_set === 'Higher') ||
    (age_set === 'Lower' && bmi_set === 'Higher' && interval_set === 'Higher') ||
    (age_set === 'Lower' && bmi_set === 'Higher' && interval_set === 'Lower') ||
    (age_set === 'Lower' && bmi_set === 'Normal' && interval_set === 'Higher')
  ) {
    return 'High';
  }

  // Moderate-Risk Combinations
  if (
    (age_set === 'Normal' && bmi_set === 'Higher' && (interval_set === 'Normal' || interval_set === 'Lower')) ||
    (age_set === 'Normal' && bmi_set === 'Lower' && interval_set === 'Higher') ||
    (age_set === 'Higher' && interval_set === 'Normal' && (bmi_set === 'Normal' || bmi_set === 'Higher')) ||
    (age_set === 'Higher' && bmi_set === 'Higher' && interval_set === 'Lower') ||
    (age_set === 'Higher' && interval_set === 'Higher' && (bmi_set === 'Normal' || bmi_set === 'Lower')) ||
    (age_set === 'Higher' && bmi_set === 'Lower' && interval_set === 'Lower') ||
    (age_set === 'Lower' && bmi_set === 'Lower' && interval_set === 'Lower') ||
    (age_set === 'Lower' && interval_set === 'Normal' && (bmi_set === 'Normal' || bmi_set === 'Higher')) ||
    (age_set === 'Lower' && bmi_set === 'Lower' && interval_set === 'Higher')
  ) {
    return 'Moderate';
  }

  return 'Low';
}

// ============================================================================
// STAGE 5: REAL-TIME ALERT EVALUATION
// ============================================================================
export function processMaternalVitalsAndSymptoms(
  vitals: Record<string, any>,
  symptoms: Record<string, any>
): { alertLevel: 'Red_Alert' | 'Yellow_Alert' | 'Green_Alert'; triggers: string[] } {
  const sysBp = Number(vitals.sys_bp ?? 0);
  const diaBp = Number(vitals.dia_bp ?? 0);
  const temp = Number(vitals.temp ?? 0.0);
  const hr = Number(vitals.hr ?? 0);
  const timing = String(vitals.timing ?? 'preprandial').toLowerCase();
  const glucose = Number(vitals.glucose ?? 0);

  const preeclampsiaCount = Number(symptoms.preeclampsia_symptoms_count ?? 0);
  const swollenCount = Number(symptoms.swollen_locations_count ?? 0);
  const headacheIntensity = Number(symptoms.headache_intensity ?? 0);
  const bellyPainIntensity = Number(symptoms.belly_pain_intensity ?? 0);
  const bellyPainCount = Number(symptoms.belly_pain_symptoms_count ?? 0);
  const diabetesCount = Number(symptoms.diabetes_symptoms_count ?? 0);
  const bleedingIntensity = Number(symptoms.vaginal_bleeding_intensity ?? 0);

  const triggers: string[] = [];

  // Red Alert Checks
  if (sysBp > 0 && (sysBp < 110 || sysBp > 130)) triggers.push(`Systolic BP (${sysBp} mmHg) outside 110-130`);
  if (diaBp > 0 && (diaBp < 75 || diaBp > 85)) triggers.push(`Diastolic BP (${diaBp} mmHg) outside 75-85`);
  if (temp >= 38.0) triggers.push(`Body temperature (${temp} °C) indicates fever`);
  if (hr > 0 && (hr < 60 || hr > 100)) triggers.push(`Heart rate (${hr} bpm) outside 60-100`);
  if (glucose > 0) {
    if (timing === 'preprandial' && (glucose < 70 || glucose > 120)) triggers.push(`Fasting glucose (${glucose} mg/dL) outside 70-120`);
    else if (timing === 'postprandial' && glucose > 180) triggers.push(`Postprandial glucose (${glucose} mg/dL) > 180`);
  }
  if (symptoms.fever_chills || symptoms.fever_sweating) triggers.push('Fever with chills or sweating');
  if (symptoms.breathing_diff || symptoms.breathing_sound) triggers.push('Breathing difficulty or abnormal breath sounds');
  if (headacheIntensity >= 6) triggers.push(`Severe headache intensity (${headacheIntensity}/10)`);
  if (swollenCount >= 4) triggers.push(`Swelling across multiple body locations (${swollenCount})`);
  if (symptoms.belly_pain_hard_abdomen || symptoms.belly_pain_bleeding) triggers.push('Abdominal pain with rigidity or bleeding');
  if (bellyPainIntensity > 6) triggers.push(`Severe abdominal pain (${bellyPainIntensity}/10)`);
  if (symptoms.loss_vaginal_fluid || symptoms.decreased_fetal_movement) triggers.push('Loss of vaginal fluid or decreased baby movement');
  if (diabetesCount >= 4) triggers.push('Multiple active diabetes symptoms');

  if (triggers.length > 0) {
    return { alertLevel: 'Red_Alert', triggers };
  }

  // Yellow Alert Checks
  const yellowTriggers: string[] = [];
  if (preeclampsiaCount >= 2) yellowTriggers.push('Multiple preeclampsia warning signs');
  if (swollenCount === 2 || swollenCount === 3) yellowTriggers.push(`Swelling in ${swollenCount} locations`);
  if (symptoms.headache_symptoms && headacheIntensity < 6) yellowTriggers.push('Mild to moderate headache');
  if (bleedingIntensity > 0) yellowTriggers.push('Mild vaginal spotting or bleeding');
  if (symptoms.discomfort_urination) yellowTriggers.push('Urinary discomfort or burning sensation');
  if (bellyPainCount >= 3 && bellyPainIntensity <= 6) yellowTriggers.push('Frequent abdominal discomfort');
  if (diabetesCount >= 1 && diabetesCount <= 3) yellowTriggers.push('Mild glycemic symptoms');

  if (yellowTriggers.length > 0) {
    return { alertLevel: 'Yellow_Alert', triggers: yellowTriggers };
  }

  return { alertLevel: 'Green_Alert', triggers: [] };
}

// ============================================================================
// STAGE 6: OVERALL RISK STATUS SYNTHESIS
// ============================================================================
export function determineOverallRiskStatus(
  alertLevel: 'Red_Alert' | 'Yellow_Alert' | 'Green_Alert',
  demographicRisk: 'High' | 'Moderate' | 'Low',
  cumulativeScore: number
): 'Severe Risk' | 'High Risk' | 'Low Risk' {
  // 1. Acute emergency safety override (crisis BP, severe bleeding, convulsions)
  if (alertLevel === 'Red_Alert') {
    return 'Severe Risk';
  }

  // 2. Coopland High-Risk Evaluation Cutoffs:
  // Low Risk: 0 - 2 | High Risk: 3 - 6 | Severe Risk: >= 7
  if (cumulativeScore >= 7) {
    return 'Severe Risk';
  }

  if (cumulativeScore >= 3 || alertLevel === 'Yellow_Alert' || demographicRisk === 'High') {
    return 'High Risk';
  }

  return 'Low Risk';
}

// ============================================================================
// STAGE 7: PERSONALIZED RECOMMENDATIONS ENGINE
// ============================================================================
export function generatePersonalizedRecommendations(
  overallRisk: 'Severe Risk' | 'High Risk' | 'Low Risk',
  vitals: Record<string, any>,
  symptoms: Record<string, any>,
  demographics: Record<string, any>
): Array<{ category: string; text: string; urgent?: boolean; icon?: string }> {
  const recommendations: Array<{ category: string; text: string; urgent?: boolean; icon?: string }> = [];

  // High-level directive
  if (overallRisk === 'Severe Risk') {
    recommendations.push({
      category: 'Urgent Action',
      text: 'Seek immediate evaluation at the nearest triage, hospital, or maternal clinic.',
      urgent: true,
      icon: 'ambulance',
    });
  } else if (overallRisk === 'High Risk') {
    recommendations.push({
      category: 'Action Required',
      text: 'Schedule a follow-up appointment with your healthcare provider within 24–48 hours.',
      icon: 'calendar-check',
    });
  } else {
    recommendations.push({
      category: 'Routine Care',
      text: 'Continue standard prenatal visit schedule and daily monitoring.',
      icon: 'leaf',
    });
  }

  // Vital-Specific Advice
  const sysBp = Number(vitals.sys_bp ?? 120);
  const diaBp = Number(vitals.dia_bp ?? 80);
  if (sysBp > 130 || diaBp > 85) {
    recommendations.push({
      category: 'Blood Pressure Management',
      text: 'Elevated Blood Pressure: Rest on your left side for 30 minutes, avoid salt-heavy foods, and re-check BP in 2 hours.',
      icon: 'activity',
      urgent: sysBp >= 140 || diaBp >= 90,
    });
  } else if ((sysBp > 0 && sysBp < 110) || (diaBp > 0 && diaBp < 75)) {
    recommendations.push({
      category: 'Blood Pressure Management',
      text: 'Slightly Low Blood Pressure: Ensure adequate hydration (8–10 glasses of water daily) and avoid standing up too quickly.',
      icon: 'droplet',
    });
  }

  const glucose = Number(vitals.glucose ?? 90);
  const timing = String(vitals.timing ?? 'preprandial').toLowerCase();
  if ((timing === 'preprandial' && glucose > 120) || (timing === 'postprandial' && glucose > 180)) {
    recommendations.push({
      category: 'Glycemic Control',
      text: 'Blood Glucose Spike: Maintain a low-glycemic meal plan, log your food intake, and contact your doctor if spikes persist.',
      icon: 'coffee',
    });
  }

  const temp = Number(vitals.temp ?? 37.0);
  if (temp >= 38.0) {
    recommendations.push({
      category: 'Temperature Warning',
      text: 'Fever Detected (≥38.0°C): Stay hydrated, apply cold compresses, and inform your clinic immediately to rule out infection.',
      icon: 'thermometer',
      urgent: true,
    });
  }

  // --- Symptom-Specific Advice ---
  // 1. Abdominal Pain
  if (symptoms.belly_pain_hard_abdomen || symptoms.belly_pain_bleeding || (symptoms.belly_pain_intensity ?? 0) > 6) {
    recommendations.push({
      category: 'Abdominal Pain Care',
      text: 'Severe Abdominal Pain: Intense pain or abdominal tightness requires urgent medical evaluation to rule out placental abruption or preterm complications.',
      icon: 'activity',
      urgent: true,
    });
  } else if (symptoms.belly_pain_symptoms_count || (symptoms.belly_pain_intensity ?? 0) > 0 || symptoms.abdominal_pain) {
    recommendations.push({
      category: 'Abdominal Pain Care',
      text: 'Mild Abdominal Discomfort: Monitor mild cramps. Rest on your left side, drink warm water, and contact your clinic if cramps become rhythmic or increase in pain.',
      icon: 'activity',
    });
  }

  // 2. Difficulty Breathing
  if (symptoms.breathing_diff || symptoms.breathing_sound || symptoms.difficulty_breathing) {
    recommendations.push({
      category: 'Respiratory Care',
      text: 'Breathing Difficulty: Sit upright in a comfortable position, rest, and seek clinical evaluation to check oxygen levels and rule out respiratory or cardiac strain.',
      icon: 'alert-triangle',
      urgent: true,
    });
  }

  // 3. Bleeding
  if ((symptoms.vaginal_bleeding_intensity ?? 0) > 4 || symptoms.bleeding_severe) {
    recommendations.push({
      category: 'Vaginal Bleeding Alert',
      text: 'Active Vaginal Bleeding: Any heavy bleeding requires immediate emergency evaluation. Avoid tampons or intercourse and proceed to your nearest maternity triage.',
      icon: 'alert-circle',
      urgent: true,
    });
  } else if ((symptoms.vaginal_bleeding_intensity ?? 0) > 0 || symptoms.bleeding) {
    recommendations.push({
      category: 'Vaginal Bleeding Alert',
      text: 'Vaginal Spotting: Rest with feet elevated, avoid strenuous activity, track pad count, and contact your doctor for prompt evaluation.',
      icon: 'alert-circle',
      urgent: true,
    });
  }

  // 4. Headache
  const headacheInt = symptoms.headache_intensity ?? 0;
  if (headacheInt >= 6) {
    recommendations.push({
      category: 'Headache Management',
      text: 'Severe Headache (≥6/10): Rest in a dark, quiet room. If accompanied by blurred vision, spots, or swelling, seek immediate medical assessment for blood pressure evaluation.',
      icon: 'alert-circle',
      urgent: true,
    });
  } else if (symptoms.headache_symptoms || headacheInt > 0) {
    recommendations.push({
      category: 'Headache Management',
      text: 'Mild Headache: Rest in a calm environment, ensure you are drinking enough water, and apply a cool cloth to your forehead.',
      icon: 'moon',
    });
  }

  // 5. Blurred Vision
  if (symptoms.blurred_vision) {
    recommendations.push({
      category: 'Visual Changes',
      text: 'Vision Changes: Blurred vision, floaters, or light sensitivity can indicate elevated blood pressure. Rest quietly and have your blood pressure checked promptly.',
      icon: 'eye',
      urgent: true,
    });
  }

  // 6. Convulsions
  if (symptoms.convulsions) {
    recommendations.push({
      category: 'Emergency Neurological',
      text: 'Convulsions / Seizures: Call emergency services immediately. Ensure the mother is safely resting on her left side away from hard objects to protect airway.',
      icon: 'alert-circle',
      urgent: true,
    });
  }

  // 7. Dizziness
  if (symptoms.dizziness) {
    recommendations.push({
      category: 'Circulation & Dizziness',
      text: 'Dizziness Relief: Lie down on your left side immediately to restore blood flow. Drink fluids with electrolytes and avoid standing up suddenly.',
      icon: 'alert-triangle',
    });
  }

  // 8. Fatigue
  if (symptoms.fatigue) {
    recommendations.push({
      category: 'Maternal Rest & Nutrition',
      text: 'Fatigue Support: Aim for 8+ hours of sleep, take short daytime rests, and eat iron-rich foods (spinach, beans, eggs) to maintain healthy red blood cell levels.',
      icon: 'moon',
    });
  }

  // 9. Swelling
  const swollenCount = symptoms.swollen_locations_count ?? 0;
  if (swollenCount >= 4) {
    recommendations.push({
      category: 'Swelling Management',
      text: 'Generalized Swelling: Rapid swelling across face, hands, and legs requires prompt medical evaluation to check blood pressure and kidney function.',
      icon: 'alert-circle',
      urgent: true,
    });
  } else if (swollenCount >= 2 || symptoms.swelling) {
    recommendations.push({
      category: 'Swelling Management',
      text: 'Mild to Moderate Swelling: Elevate your feet above heart level for 20–30 minutes, wear comfortable footwear, and reduce sodium intake.',
      icon: 'droplet',
    });
  }

  // 10. Vomiting / Nausea
  if (symptoms.vomiting) {
    recommendations.push({
      category: 'Nausea & Hydration',
      text: 'Vomiting & Nausea: Sip cold water, electrolyte drinks, or ginger tea in small, frequent amounts. Eat dry crackers before getting out of bed and avoid an empty stomach.',
      icon: 'coffee',
    });
  }

  // 11. Back Pain
  if (symptoms.back_pain) {
    recommendations.push({
      category: 'Back Care',
      text: 'Back Discomfort: Practice gentle pelvic tilts, apply a warm compress, wear supportive flat shoes, and avoid heavy lifting. If pain is rhythmic, contact your provider.',
      icon: 'activity',
    });
  }

  // 12. Urinary Discomfort
  if (symptoms.discomfort_urination || symptoms.urinary_discomfort) {
    recommendations.push({
      category: 'Urinary Care',
      text: 'Urinary Discomfort: Burning or pain during urination may indicate a urinary tract infection. Drink plenty of water and seek a urine test from your clinic.',
      icon: 'droplet',
    });
  }

  // 13. Decreased Fetal Movement
  if (symptoms.decreased_fetal_movement) {
    recommendations.push({
      category: 'Fetal Monitoring',
      text: 'Decreased Fetal Movement: Drink cold water or juice, lie on your left side, and count kicks for 1 hour. If fewer than 10 movements occur, contact triage immediately.',
      icon: 'heart',
      urgent: true,
    });
  }

  // 14. Loss of Vaginal Fluid
  if (symptoms.loss_vaginal_fluid) {
    recommendations.push({
      category: 'Membrane Care',
      text: 'Fluid Leakage: Leaking clear vaginal fluid may indicate premature water breaking. Contact your maternity facility or doctor immediately.',
      icon: 'droplet',
      urgent: true,
    });
  }

  // Demographic Personalization
  const age = Number(demographics.age ?? 25);
  if (age < 18) {
    recommendations.push({
      category: 'Adolescent Care Track',
      text: 'Adolescent Pregnancy Support: Ensure daily prenatal iron and folic acid intake are logged, and attend dedicated young-maternal wellness sessions.',
      icon: 'user-check',
    });
  }

  return recommendations;
}

// ============================================================================
// STAGE 8: PIPELINE CONTROLLER (Master Execution)
// ============================================================================
export function runPregnacareDecisionEngine(payload: PregnacarePayload) {
  const vitals = payload.vitals ?? {};
  const symptoms = payload.symptoms ?? {};
  const demographics = payload.demographics ?? {};
  const medicalHistory = payload.medical_history ?? {};
  const presentPregnancy = payload.present_pregnancy ?? {};

  // 1. Validation
  const validation = validateVitalsInput(vitals);
  if (!validation.isValid) {
    return {
      status: 'REJECTED' as const,
      error: validation.message,
    };
  }

  // 2. Compute metrics
  const alertEvaluation = processMaternalVitalsAndSymptoms(vitals, symptoms);
  const alertLevel = alertEvaluation.alertLevel;
  const demographicRisk = evaluateDemographicRiskMatrix(demographics);
  const coopland = evaluateCooplandForm(medicalHistory, presentPregnancy);
  const clinicalResult = { score: coopland.total_score, hits: coopland.items };

  // 3. Synthesize risk
  const overallRisk = determineOverallRiskStatus(alertLevel, demographicRisk, clinicalResult.score);

  // 4. Personalized recommendations
  const recommendations = generatePersonalizedRecommendations(overallRisk, vitals, symptoms, demographics);

  // 5. System actions
  const notifyDoctor = overallRisk === 'High Risk' || overallRisk === 'Severe Risk';
  const hideVisualAlarm = overallRisk === 'Severe Risk';

  return {
    status: 'SUCCESS' as const,
    overall_risk: overallRisk,
    alert_level: alertLevel,
    demographic_risk: demographicRisk,
    cumulative_risk_score: clinicalResult.score,
    cumulative_hits: clinicalResult.hits,
    coopland,
    alert_triggers: alertEvaluation.triggers,
    recommendations,
    system_actions: {
      notify_doctor_dashboard: notifyDoctor,
      hide_visual_alarm_indicator: hideVisualAlarm,
      display_localized_advice: true,
    },
  };
}

// ============================================================================
// GRANULAR SYMPTOM-BASED RECOMMENDATIONS (User Personalized Matching)
// ============================================================================
export function getSymptomBasedRecommendations(
  symptomId: string,
  severityLevel: string,
  hasHighBP: boolean
): { text: string; icon: string; urgent?: boolean } | null {
  let advice = null;
  const isSevere = severityLevel === 'Severe' || severityLevel === 'High';

  switch (symptomId) {
    case 'bleeding':
      advice = { text: 'Any bleeding requires medical evaluation. Please contact your OB-GYN immediately.', icon: 'alert-circle', urgent: true };
      break;
    case 'abdominal_pain':
      advice = isSevere
        ? { text: 'Severe abdominal pain needs immediate assessment to rule out complications.', icon: 'activity', urgent: true }
        : { text: 'Monitor mild abdominal cramps. Rest and hydrate, but report if pain worsens.', icon: 'activity' };
      break;
    case 'swelling':
      if (hasHighBP) {
        advice = { text: 'Swelling combined with high blood pressure is a warning sign. Seek medical attention.', icon: 'alert-triangle', urgent: true };
      } else {
        advice = isSevere
          ? { text: 'Severe sudden swelling needs medical evaluation.', icon: 'alert-triangle', urgent: true }
          : { text: 'Elevate your feet and stay well-hydrated to help reduce mild swelling.', icon: 'droplet' };
      }
      break;
    case 'headache':
      if (hasHighBP) {
        advice = { text: 'Headache combined with high blood pressure requires immediate evaluation.', icon: 'alert-circle', urgent: true };
      } else {
        advice = isSevere
          ? { text: 'A severe, unrelenting headache should be checked by a provider.', icon: 'alert-circle', urgent: true }
          : { text: 'Rest in a quiet room and ensure you are fully hydrated to relieve your headache.', icon: 'moon' };
      }
      break;
    case 'vomiting':
      advice = isSevere
        ? { text: 'Severe vomiting can lead to dehydration. Please seek medical advice.', icon: 'alert-triangle', urgent: true }
        : { text: 'Eat small, frequent meals and sip fluids to manage nausea and vomiting.', icon: 'coffee' };
      break;
    case 'reduced_movement':
      advice = { text: 'Reduced baby movement should always be checked. Please contact your provider.', icon: 'activity', urgent: true };
      break;
    case 'fluid_loss':
      advice = { text: 'Loss of fluid may indicate your water broke. Contact your birthing facility.', icon: 'droplet', urgent: true };
      break;
    case 'fever':
      advice = isSevere
        ? { text: 'A high fever can be dangerous during pregnancy. Seek immediate medical care.', icon: 'thermometer', urgent: true }
        : { text: 'Monitor your temperature and stay hydrated. Contact your provider if fever persists.', icon: 'thermometer' };
      break;
    case 'blurred_vision':
      advice = { text: 'Changes in vision can be a sign of blood pressure complications. Seek evaluation.', icon: 'eye', urgent: true };
      break;
    case 'urinary_discomfort':
      advice = { text: 'Discomfort when urinating may indicate a UTI. Drink water and contact your provider.', icon: 'droplet' };
      break;
    case 'back_pain':
      advice = isSevere
        ? { text: 'Severe or rhythmic back pain might indicate preterm labor. Contact your provider.', icon: 'activity', urgent: true }
        : { text: 'For mild back pain, use a warm compress, practice good posture, and rest.', icon: 'activity' };
      break;
    case 'fatigue':
      advice = { text: 'Fatigue is common. Prioritize sleep, eat iron-rich foods, and listen to your body.', icon: 'moon' };
      break;
    case 'difficulty_breathing':
      advice = { text: 'Difficulty breathing requires medical evaluation. Sit upright in a comfortable position and contact your healthcare provider.', icon: 'alert-triangle', urgent: true };
      break;
    case 'dizziness':
      advice = { text: 'Dizziness can result from low blood pressure or dehydration. Lie down on your left side and drink fluids.', icon: 'alert-triangle' };
      break;
    case 'convulsions':
      advice = { text: 'Convulsions or seizures require immediate emergency medical evaluation. Ensure safety on left side.', icon: 'alert-circle', urgent: true };
      break;
  }
  return advice;
}

// Backward-compatible structural calculation
export function computeStructuralRisk(
  age: number,
  riskHistory: Record<string, any> = {},
  pp: Record<string, any> = {},
  hemoglobin?: number
) {
  const medHist = { ...riskHistory, maternal_age: age };
  const presPreg = { ...pp, anemia_less_than_10g: hemoglobin !== undefined && hemoglobin !== null && hemoglobin < 10 };
  const res = calculateCumulativeRiskScore(medHist, presPreg);
  return { total: res.score, hits: res.hits };
}

export function classifyStructuralScore(total: number) {
  const level: 'Low' | 'High' | 'Severe' = total >= 6 ? 'Severe' : total >= 3 ? 'High' : 'Low';
  const score = total >= 6 ? Math.min(100, 65 + total * 3) : total >= 3 ? 35 + total * 4 : Math.min(30, 5 + total * 5);
  return { score, level, centroid: score, membership: { low: total < 3 ? 1 : 0, high: total >= 3 && total < 6 ? 1 : 0, severe: total >= 6 ? 1 : 0 } };
}

export function evaluateAcuteRules(input: RiskEngineInput) {
  const vitals = {
    sys_bp: input.bp_sys,
    dia_bp: input.bp_dia,
    temp: input.temp ?? 37.0,
    hr: input.heart_rate ?? 75,
    timing: input.glucose_timing || 'preprandial',
    glucose: input.blood_sugar ?? 90,
  };
  const symptoms: Record<string, any> = {
    preeclampsia_symptoms_count: input.preeclampsia_symptoms_count,
    swollen_locations_count: input.swollen_locations_count ?? input.swollen_locations?.length,
    fever_chills: input.fever_with_chills,
    fever_sweating: input.fever_with_sweating,
    breathing_diff: input.breathing_difficulty,
    breathing_sound: input.breathing_with_sound,
    belly_pain_hard_abdomen: input.belly_pain_with_hard_abdomen,
    belly_pain_bleeding: input.belly_pain_with_bleeding,
    loss_vaginal_fluid: input.loss_of_vaginal_fluid,
    decreased_fetal_movement: input.decreased_fetal_movement,
    discomfort_urination: input.discomfort_during_urination,
    diabetes_symptoms_count: input.diabetes_symptoms_count,
  };
  const res = processMaternalVitalsAndSymptoms(vitals, symptoms);
  const hits = res.triggers.map((t, idx) => ({ id: `TRIGGER_${idx + 1}`, text: t }));
  const forcedLevel = res.alertLevel === 'Red_Alert' ? 'Severe' : res.alertLevel === 'Yellow_Alert' ? 'High' : null;
  return { hits, forcedLevel };
}

export function buildRecommendations(level: 'Low' | 'High' | 'Severe', input: RiskEngineInput) {
  const recs: Array<{ text: string; icon: string; urgent?: boolean }> = [];
  let hasHighBP = input.bp_sys >= 130;
  if (input.symptoms) {
    for (const s of input.symptoms) {
      if (s.id === 'high_bp_feel' && ['Moderate', 'High', 'Severe'].includes(s.severity)) {
        hasHighBP = true;
      }
    }
  }

  const symptomRecs: Record<string, { text: string; icon: string; urgent?: boolean }> = {};
  if (input.symptoms) {
    for (const s of input.symptoms) {
      if (s.severity === 'None') continue;
      const advice = getSymptomBasedRecommendations(s.id, s.severity, hasHighBP);
      if (advice) {
        symptomRecs[advice.text] = advice;
      }
    }
  }

  if (level === 'Severe') {
    recs.push({ text: 'Contact your OB-GYN or go to the nearest hospital now to evaluate your symptoms', icon: 'ambulance', urgent: true });
  } else if (level === 'High') {
    recs.push({ text: 'Schedule a prenatal checkup within the next few days', icon: 'calendar-check' });
  }

  for (const key in symptomRecs) {
    recs.push(symptomRecs[key]);
  }

  if (Object.keys(symptomRecs).length === 0 && level === 'Low') {
    recs.push({ text: 'Continue routine prenatal care and healthy habits', icon: 'leaf' });
  }

  if (input.hemoglobin !== undefined && input.hemoglobin < 11) {
    recs.push({ text: 'Take Iron Supplement as prescribed, recheck hemoglobin', icon: 'pill' });
  }
  if (input.bp_sys >= 130) {
    recs.push({ text: 'Monitor Blood Pressure twice daily and log results', icon: 'activity' });
  }
  if (input.blood_sugar !== undefined && input.blood_sugar >= 130) {
    recs.push({ text: 'Monitor Blood Sugar and reduce refined sugar intake', icon: 'coffee' });
  }

  const urgentRecs = recs.filter((r) => r.urgent);
  const normalRecs = recs.filter((r) => !r.urgent);
  return [...urgentRecs, ...normalRecs.slice(0, 6 - urgentRecs.length)];
}

// ============================================================================
// ADAPTER: evaluateMaternalRisk
// ============================================================================
export function evaluateMaternalRisk(input: RiskEngineInput) {
  // Construct 8-stage PregnaCare payload
  const sevMap = new Map<string, string>();
  if (input.symptoms) {
    input.symptoms.forEach((s) => sevMap.set(s.id, s.severity));
  }
  const sevOf = (id: string) => sevMap.get(id) || 'None';
  const intensityOf = (id: string) => {
    if (input.symptom_intensities && input.symptom_intensities[id] !== undefined) {
      return Number(input.symptom_intensities[id]);
    }
    const s = sevOf(id);
    if (s === 'Severe') return 8.0;
    if (s === 'Moderate') return 5.0;
    if (s === 'Mild') return 2.5;
    return 0.0;
  };

  const payload: PregnacarePayload = {
    vitals: {
      sys_bp: input.bp_sys,
      dia_bp: input.bp_dia,
      temp: input.temp,
      hr: input.heart_rate,
      timing: input.glucose_timing || 'preprandial',
      glucose: input.blood_sugar,
      fhr: input.fetal_heart_rate,
      rr: input.respiratory_rate,
      hemoglobin: input.hemoglobin,
    },
    symptoms: {
      preeclampsia_symptoms_count: input.preeclampsia_symptoms_count,
      swollen_locations_count: input.swollen_locations_count ?? (input.swollen_locations ? input.swollen_locations.length : 0),
      headache_intensity: intensityOf('headache'),
      headache_symptoms: sevOf('headache') !== 'None',
      belly_pain_intensity: intensityOf('abdominal_pain'),
      belly_pain_symptoms_count: input.belly_pain_symptoms_count,
      belly_pain_hard_abdomen: input.belly_pain_with_hard_abdomen,
      belly_pain_bleeding: input.belly_pain_with_bleeding,
      diabetes_symptoms_count: input.diabetes_symptoms_count,
      vaginal_bleeding_intensity: intensityOf('bleeding'),
      fever_chills: input.fever_with_chills,
      fever_sweating: input.fever_with_sweating,
      breathing_diff: input.breathing_difficulty || ['Moderate', 'Severe'].includes(sevOf('difficulty_breathing')),
      breathing_sound: input.breathing_with_sound,
      loss_vaginal_fluid: input.loss_of_vaginal_fluid || ['Moderate', 'Severe'].includes(sevOf('fluid_loss')),
      decreased_fetal_movement: input.decreased_fetal_movement || ['Moderate', 'Severe'].includes(sevOf('reduced_movement')),
      discomfort_urination: input.discomfort_during_urination || sevOf('urinary_discomfort') !== 'None',
      abdominal_pain: sevOf('abdominal_pain') !== 'None' || intensityOf('abdominal_pain') > 0,
      difficulty_breathing: input.breathing_difficulty || ['Moderate', 'Severe'].includes(sevOf('difficulty_breathing')) || sevOf('difficulty_breathing') !== 'None',
      bleeding: sevOf('bleeding') !== 'None' || intensityOf('bleeding') > 0,
      blurred_vision: sevOf('blurred_vision') !== 'None',
      convulsions: sevOf('convulsions') !== 'None',
      dizziness: sevOf('dizziness') !== 'None',
      fatigue: sevOf('fatigue') !== 'None',
      vomiting: sevOf('vomiting') !== 'None',
      back_pain: sevOf('back_pain') !== 'None',
      swelling: sevOf('swelling') !== 'None' || (input.swollen_locations_count ?? 0) > 0,
    },
    demographics: {
      age: input.age,
      bmi: input.bmi,
      inter_pregnancy_interval: input.inter_pregnancy_interval ?? 24,
    },
    medical_history: input.riskHistory ?? {},
    present_pregnancy: input.pregnancyProblems ?? {},
  };

  const engineRes = runPregnacareDecisionEngine(payload);

  let level: 'Low' | 'High' | 'Severe' = 'Low';
  let alertLevel: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let score = 15;

  if (engineRes.status === 'SUCCESS') {
    if (engineRes.overall_risk === 'Severe Risk') {
      level = 'Severe';
      alertLevel = 'RED';
      score = Math.min(100, Math.max(75, 70 + engineRes.cumulative_risk_score * 3));
    } else if (engineRes.overall_risk === 'High Risk') {
      level = 'High';
      alertLevel = engineRes.alert_level === 'Yellow_Alert' ? 'YELLOW' : 'GREEN';
      score = Math.min(70, Math.max(45, 36 + engineRes.cumulative_risk_score * 5));
    } else {
      level = 'Low';
      alertLevel = 'GREEN';
      score = Math.min(35, Math.max(10, 10 + engineRes.cumulative_risk_score * 8));
    }
  }

  // Combine recommendations with granular symptom recommendations
  const mergedRecs: Array<{ text: string; icon: string; urgent?: boolean }> = [];
  if (engineRes.status === 'SUCCESS') {
    engineRes.recommendations.forEach((r) => {
      mergedRecs.push({ text: r.text, icon: r.icon || (r.urgent ? 'alert-circle' : 'checkmark-circle'), urgent: r.urgent });
    });
  }

  // Symptom-specific personalized advice
  const hasHighBP = input.bp_sys >= 130;
  if (input.symptoms) {
    for (const s of input.symptoms) {
      if (s.severity === 'None') continue;
      const advice = getSymptomBasedRecommendations(s.id, s.severity, hasHighBP);
      if (advice && !mergedRecs.some((r) => r.text === advice.text)) {
        mergedRecs.push(advice);
      }
    }
  }

  // Sort urgent recommendations first, capped at 6
  const urgentRecs = mergedRecs.filter((r) => r.urgent);
  const regularRecs = mergedRecs.filter((r) => !r.urgent);
  const finalRecs = [...urgentRecs, ...regularRecs].slice(0, 6);

  const coopland = engineRes.status === 'SUCCESS' ? engineRes.coopland : null;

  return {
    score,
    level,
    alertLevel,
    structural: {
      total: engineRes.status === 'SUCCESS' ? engineRes.cumulative_risk_score : 0,
      coopland_score: coopland?.total_score ?? (engineRes.status === 'SUCCESS' ? engineRes.cumulative_risk_score : 0),
      coopland_classification: coopland?.classification ?? engineRes.overall_risk,
      coopland_categories: coopland?.categories ?? null,
      hits: engineRes.status === 'SUCCESS' ? engineRes.cumulative_hits : [],
    },
    coopland,
    fuzzy: {
      score,
      level,
      centroid: score,
    },
    rules: (engineRes.status === 'SUCCESS' ? engineRes.alert_triggers : []).map((t, i) => ({ id: `TRIGGER_${i + 1}`, text: t })),
    recommendations: finalRecs,
    engineResult: engineRes,
  };
}
