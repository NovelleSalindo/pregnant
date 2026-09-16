/**
 * PregnaCare Risk Engine — TypeScript Port
 * Matches base.php clinical scoring (RH/MC/PP) + Fuzzy Logic + Safety-Net Rules.
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
  trimester: number;
  bp_sys: number;
  bp_dia: number;
  bmi: number;
  hemoglobin: number;
  blood_sugar: number;
  riskHistory?: Record<string, any>;
  pregnancyProblems?: Record<string, any>;
  symptoms: SymptomEntry[];
}

export const RULE_SCORES: Record<string, { label: string; points: number; cat: 'RH' | 'MC' | 'PP' }> = {
  // Reproductive History (RH)
  'RH-01': { label: 'Maternal age ≤ 16', points: 1, cat: 'RH' },
  'RH-02': { label: 'Maternal age > 35', points: 2, cat: 'RH' },
  'RH-03': { label: 'Parity = 0 (first pregnancy)', points: 1, cat: 'RH' },
  'RH-05': { label: 'Parity > 4', points: 2, cat: 'RH' },
  'RH-06': { label: '2+ prior abortions or infertility history', points: 1, cat: 'RH' },
  'RH-07': { label: 'Previous postpartum hemorrhage', points: 1, cat: 'RH' },
  'RH-08': { label: 'Previous manual removal of placenta', points: 1, cat: 'RH' },
  'RH-09': { label: 'Previous baby over 9 lb', points: 1, cat: 'RH' },
  'RH-10': { label: 'Previous baby over 5 lb 8 oz', points: 1, cat: 'RH' },
  'RH-11': { label: 'Previous toxemia / hypertension', points: 1, cat: 'RH' },
  'RH-12': { label: 'Previous cesarean section', points: 2, cat: 'RH' },
  'RH-13': { label: 'Previous abnormal or difficult labor', points: 2, cat: 'RH' },

  // Medical/Surgical Conditions (MC)
  'MC-01': { label: 'Previous gynecological disease', points: 1, cat: 'MC' },
  'MC-02': { label: 'Chronic renal disease', points: 1, cat: 'MC' },
  'MC-03': { label: 'Gestational diabetes', points: 1, cat: 'MC' },
  'MC-04': { label: 'Class B diabetes or higher', points: 3, cat: 'MC' },
  'MC-05': { label: 'Cardiac disease', points: 3, cat: 'MC' },

  // Present Pregnancy Problems (PP)
  'PP-01': { label: 'Bleeding before 20 weeks', points: 3, cat: 'PP' },
  'PP-02': { label: 'Bleeding after 20 weeks', points: 1, cat: 'PP' },
  'PP-03': { label: 'Anemia (hemoglobin < 10 g%)', points: 1, cat: 'PP' },
  'PP-04': { label: 'Postmaturity / prematurity', points: 1, cat: 'PP' },
  'PP-05': { label: 'Hypertension', points: 2, cat: 'PP' },
  'PP-06': { label: 'Premature rupture of membrane', points: 1, cat: 'PP' },
  'PP-07': { label: 'Polyhydramnios / oligohydramnios', points: 1, cat: 'PP' },
  'PP-08': { label: 'Intrauterine growth restriction (IUGR)', points: 1, cat: 'PP' },
  'PP-09': { label: 'Multiple pregnancy', points: 1, cat: 'PP' },
  'PP-10': { label: 'Breech / malpresentation', points: 1, cat: 'PP' },
  'PP-11': { label: 'Rh isoimmunization', points: 3, cat: 'PP' },
};

function triMembership(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

function shoulderLow(x: number, b: number, c: number): number {
  if (x <= b) return 1;
  if (x >= c) return 0;
  return (c - x) / (c - b);
}

function shoulderHigh(x: number, a: number, b: number): number {
  if (x >= b) return 1;
  if (x <= a) return 0;
  return (x - a) / (b - a);
}

export function computeStructuralRisk(
  age: number,
  riskHistory: Record<string, any> = {},
  pp: Record<string, any> = {},
  hemoglobin: number
) {
  const hits: Array<{ id: string; label: string; points: number; cat: string }> = [];
  const add = (id: string) => {
    if (RULE_SCORES[id]) {
      hits.push({ id, ...RULE_SCORES[id] });
    }
  };

  // Reproductive History
  if (age <= 16) add('RH-01');
  if (age > 35) add('RH-02');
  const parity = Number(riskHistory['parity'] ?? 0);
  if (parity === 0) add('RH-03');
  if (parity > 4) add('RH-05');
  if (riskHistory['prior_abortions_or_infertility']) add('RH-06');
  if (riskHistory['prev_pp_hemorrhage']) add('RH-07');
  if (riskHistory['prev_manual_placenta_removal']) add('RH-08');
  if (riskHistory['prev_baby_over_9lb']) add('RH-09');
  if (riskHistory['prev_baby_over_5lb8oz']) add('RH-10');
  if (riskHistory['prev_toxemia_hpn']) add('RH-11');
  if (riskHistory['prev_cesarean']) add('RH-12');
  if (riskHistory['prev_abnormal_labor']) add('RH-13');

  // Medical/Surgical Conditions
  if (riskHistory['prev_gyn_disease']) add('MC-01');
  if (riskHistory['chronic_renal_disease']) add('MC-02');
  if (riskHistory['gestational_diabetes']) add('MC-03');
  if (riskHistory['class_b_diabetes_or_higher']) add('MC-04');
  if (riskHistory['cardiac_disease']) add('MC-05');
  const otherScore = Math.max(0, Math.min(5, Number(riskHistory['other_significant_disease_score'] ?? 0)));
  if (otherScore > 0) {
    hits.push({ id: 'MC-06', label: 'Other significant medical disease', points: otherScore, cat: 'MC' });
  }

  // Present Pregnancy Problems
  if (pp['bleeding_lt_20wks']) add('PP-01');
  if (pp['bleeding_gt_20wks']) add('PP-02');
  if (hemoglobin !== null && hemoglobin < 10) add('PP-03');
  if (pp['postmaturity_prematurity']) add('PP-04');
  if (pp['hypertension']) add('PP-05');
  if (pp['prom']) add('PP-06');
  if (pp['poly_oligohydramnios']) add('PP-07');
  if (pp['iugr']) add('PP-08');
  if (pp['multiple_pregnancy']) add('PP-09');
  if (pp['breech_malpresentation']) add('PP-10');
  if (pp['rh_isoimmunization']) add('PP-11');

  const total = hits.reduce((sum, h) => sum + h.points, 0);
  return { total, hits };
}

export function classifyStructuralScore(total: number) {
  const membership = {
    low: shoulderLow(total, 2, 5),
    high: triMembership(total, 3, 7, 11),
    severe: shoulderHigh(total, 9, 14),
  };
  const sum = Math.max(0.0001, membership.low + membership.high + membership.severe);
  const centroid = (membership.low * 15 + membership.high * 50 + membership.severe * 88) / sum;
  const score = Math.round(Math.min(100, Math.max(2, centroid)));
  const level: 'Low' | 'High' | 'Severe' = score >= 62 ? 'Severe' : score >= 35 ? 'High' : 'Low';
  return { score, level, membership, centroid: Math.round(centroid) };
}

export function evaluateAcuteRules(input: RiskEngineInput) {
  const hits: Array<{ id: string; text: string }> = [];
  const sevMap = new Map<string, string>();
  input.symptoms.forEach(s => sevMap.set(s.id, s.severity));

  const sevOf = (id: string) => sevMap.get(id) || 'None';

  const bpHigh = input.bp_sys >= 140 || input.bp_dia >= 90;
  const headacheSevere = sevOf('headache') === 'Severe';
  const bleedingSevere = sevOf('bleeding') === 'Severe';
  const anyConvulsion = sevOf('convulsions') !== 'None';
  const breathingBad = ['Moderate', 'Severe'].includes(sevOf('difficulty_breathing'));
  const movementBad = ['Moderate', 'Severe'].includes(sevOf('reduced_movement'));
  const sugarHigh = input.blood_sugar >= 140;
  const laterTrimester = input.trimester >= 2;
  const hbLow = input.hemoglobin < 11;
  const swellingBad = ['Moderate', 'Severe'].includes(sevOf('swelling'));

  let forcedLevel: 'Severe' | 'High' | null = null;

  if (bpHigh && headacheSevere) {
    hits.push({ id: 'r1', text: 'Blood Pressure is High AND Headache is Severe → Severe Risk' });
    forcedLevel = 'Severe';
  }
  if (bleedingSevere) {
    hits.push({ id: 'r2', text: 'Severe Bleeding reported → Severe Risk' });
    forcedLevel = 'Severe';
  }
  if (anyConvulsion) {
    hits.push({ id: 'r3', text: 'Convulsions reported → Severe Risk' });
    forcedLevel = 'Severe';
  }
  if (breathingBad) {
    hits.push({ id: 'r4', text: 'Difficulty Breathing is Moderate/Severe → Severe Risk' });
    forcedLevel = 'Severe';
  }
  if (movementBad) {
    hits.push({ id: 'r5', text: 'Reduced Baby Movement is Moderate/Severe → Severe Risk' });
    forcedLevel = 'Severe';
  }
  if (sugarHigh && laterTrimester) {
    hits.push({ id: 'r6', text: 'Blood Sugar High in 2nd/3rd Trimester → High Risk' });
    if (forcedLevel !== 'Severe') forcedLevel = 'High';
  }
  if (hbLow) {
    hits.push({ id: 'r7', text: 'Hemoglobin Low → High Risk, Iron Supplement advised' });
    if (forcedLevel !== 'Severe') forcedLevel = 'High';
  }
  if (swellingBad && bpHigh) {
    hits.push({ id: 'r8', text: 'Swelling + elevated BP → Severe Risk, preeclampsia screening' });
    forcedLevel = 'Severe';
  }

  return { hits, forcedLevel };
}

export function buildRecommendations(level: 'Low' | 'High' | 'Severe', input: RiskEngineInput) {
  const recs: Array<{ text: string; icon: string; urgent?: boolean }> = [];
  if (level === 'Severe') {
    recs.push({ text: 'Contact your OB-GYN or go to the nearest hospital now', icon: 'ambulance', urgent: true });
    recs.push({ text: 'Do not wait for your next scheduled appointment', icon: 'clock', urgent: true });
  } else if (level === 'High') {
    recs.push({ text: 'Schedule a prenatal checkup within the next few days', icon: 'calendar-check' });
    recs.push({ text: 'Monitor blood pressure and symptoms daily', icon: 'heart-pulse' });
  } else {
    recs.push({ text: 'Continue routine prenatal care and healthy habits', icon: 'leaf' });
  }

  if (input.hemoglobin < 11) {
    recs.push({ text: 'Take Iron Supplement as prescribed, recheck hemoglobin', icon: 'pill' });
  }
  if (input.bp_sys >= 130) {
    recs.push({ text: 'Monitor Blood Pressure twice daily and log results', icon: 'activity' });
  }
  if (input.blood_sugar >= 130) {
    recs.push({ text: 'Monitor Blood Sugar and reduce refined sugar intake', icon: 'coffee' });
  }
  recs.push({ text: 'Drink plenty of water and rest when tired', icon: 'droplet' });
  recs.push({ text: 'Eat a balanced, nutrient-dense diet', icon: 'apple' });
  recs.push({ text: 'Exercise safely as approved by your provider', icon: 'user-check' });

  return recs;
}

export function evaluateMaternalRisk(input: RiskEngineInput) {
  const structural = computeStructuralRisk(input.age, input.riskHistory, input.pregnancyProblems, input.hemoglobin);
  const classified = classifyStructuralScore(structural.total);

  let score = classified.score;
  let level = classified.level;

  const acute = evaluateAcuteRules(input);
  if (acute.forcedLevel === 'Severe') {
    level = 'Severe';
    score = Math.max(score, 70);
  } else if (acute.forcedLevel === 'High' && level === 'Low') {
    level = 'High';
    score = Math.max(score, 40);
  }

  const recommendations = buildRecommendations(level, input);

  return {
    score,
    level,
    structural,
    fuzzy: classified,
    rules: acute.hits,
    recommendations,
  };
}
