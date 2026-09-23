import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import { evaluateMaternalRisk, SymptomEntry } from '../services/riskEngine';
import { RiskGauge } from '../components/RiskGauge';
import { sendPhoneNotification } from '../services/notifications';

const ALL_APP_SYMPTOMS = [
  { id: 'headache', name: 'Headache (Severe / Persistent)', icon: 'head-outline', weight: 0.75 },
  { id: 'abdominal_pain', name: 'Abdominal Pain / Cramping', icon: 'fitness-outline', weight: 0.8 },
  { id: 'bleeding', name: 'Vaginal Bleeding / Spotting', icon: 'water-outline', weight: 1.0 },
  { id: 'fluid_loss', name: 'Loss of Vaginal Fluid / Leakage', icon: 'water-outline', weight: 1.0 },
  { id: 'difficulty_breathing', name: 'Difficulty Breathing / Shortness of Breath', icon: 'pulse-outline', weight: 0.95 },
  { id: 'chest_pain', name: 'Chest Pain / Tightness', icon: 'heart-outline', weight: 0.9 },
  { id: 'dizziness', name: 'Dizziness / Lightheadedness', icon: 'reload-outline', weight: 0.5 },
  { id: 'fainting', name: 'Fainting / Loss of Consciousness', icon: 'alert-circle-outline', weight: 0.9 },
  { id: 'blurred_vision', name: 'Blurred Vision / Visual Disturbances', icon: 'eye-outline', weight: 0.8 },
  { id: 'convulsions', name: 'Seizure / Convulsions', icon: 'flash-outline', weight: 1.0 },
  { id: 'fever', name: 'Fever / Chills', icon: 'thermometer-outline', weight: 0.6 },
  { id: 'vomiting', name: 'Nausea & Vomiting', icon: 'restaurant-outline', weight: 0.4 },
  { id: 'swelling', name: 'Swelling (Face, Hands, Feet, Legs)', icon: 'body-outline', weight: 0.6 },
  { id: 'leg_swelling_pain', name: 'One-sided Leg Swelling or Pain', icon: 'walk-outline', weight: 0.85 },
  { id: 'urinary_discomfort', name: 'Painful Urination / Burning', icon: 'medkit-outline', weight: 0.6 },
  { id: 'reduced_movement', name: 'Decreased Fetal Movement', icon: 'heart-half-outline', weight: 0.9 },
  { id: 'fatigue', name: 'Fatigue / Severe Weakness', icon: 'bed-outline', weight: 0.3 },
  { id: 'back_pain', name: 'Back Pain', icon: 'body-outline', weight: 0.25 },
];

interface SymptomsScreenProps {
  onNavigate?: (tab: string) => void;
}

export const SymptomsScreen: React.FC<SymptomsScreenProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'submit_symptoms' | 'assess_risk'>('submit_symptoms');
  const [catalog, setCatalog] = useState<any[]>(ALL_APP_SYMPTOMS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Selected state: symptomId -> 'None' | 'Mild' | 'Moderate' | 'Severe'
  const [selectedSeverities, setSelectedSeverities] = useState<Record<string, 'None' | 'Mild' | 'Moderate' | 'Severe'>>({});
  const [selectedDurations, setSelectedDurations] = useState<Record<string, 'Today' | '1–3 Days' | 'More than 3 Days'>>({});
  const [selectedFrequencies, setSelectedFrequencies] = useState<Record<string, 'Rare' | 'Sometimes' | 'Often' | 'Always'>>({});

  // 10 Present Pregnancy Problems (PP Rules from base.php & symptoms.php)
  const [ppFactors, setPpFactors] = useState<Record<string, boolean>>({
    bleeding_lt_20wks: false,
    bleeding_gt_20wks: false,
    postmaturity_prematurity: false,
    hypertension: false,
    prom: false,
    poly_oligohydramnios: false,
    iugr: false,
    multiple_pregnancy: false,
    breech_malpresentation: false,
    rh_isoimmunization: false,
  });

  // ── Coopland Form Factors (Mayor Hilarion A. Ramiro Sr. Medical Center Form) ──
  // Reproductive History
  const [cooplandAgeGroup, setCooplandAgeGroup] = useState<'17_35' | 'le_16' | 'gt_35'>('17_35');
  const [cooplandParity, setCooplandParity] = useState<'1_4' | '0' | 'gt_4'>('1_4');
  const [cooplandAbortions, setCooplandAbortions] = useState(false);
  const [cooplandPostpartumBleeding, setCooplandPostpartumBleeding] = useState(false);
  const [cooplandManualPlacenta, setCooplandManualPlacenta] = useState(false);
  const [cooplandBabyOver9lb, setCooplandBabyOver9lb] = useState(false);
  const [cooplandBabyUnder5lb8oz, setCooplandBabyUnder5lb8oz] = useState(false);
  const [cooplandToxemiaHpn, setCooplandToxemiaHpn] = useState(false);
  const [cooplandPreviousCs, setCooplandPreviousCs] = useState(false);
  const [cooplandAbnormalLabor, setCooplandAbnormalLabor] = useState(false);

  // Medical / Surgical Condition
  const [cooplandPrevGyne, setCooplandPrevGyne] = useState(false);
  const [cooplandChronicRenal, setCooplandChronicRenal] = useState(false);
  const [cooplandGestationalDiabetes, setCooplandGestationalDiabetes] = useState(false);
  const [cooplandClassBDiabetes, setCooplandClassBDiabetes] = useState(false);
  const [cooplandCardiac, setCooplandCardiac] = useState(false);
  const [cooplandAsthma, setCooplandAsthma] = useState(false);
  const [cooplandTb, setCooplandTb] = useState(false);
  const [cooplandPulmonaryEmbolism, setCooplandPulmonaryEmbolism] = useState(false);
  const [cooplandThyroid, setCooplandThyroid] = useState<'none' | 'history' | 'medication'>('none');
  const [cooplandCollagen, setCooplandCollagen] = useState<'none' | 'remission' | 'active'>('none');
  const [cooplandTorch, setCooplandTorch] = useState(false);
  const [cooplandPyelonephritis, setCooplandPyelonephritis] = useState(false);
  const [cooplandSevereInfection, setCooplandSevereInfection] = useState(false);
  const [cooplandEpilepsy, setCooplandEpilepsy] = useState<'none' | 'history' | 'medication'>('none');

  // Present Pregnancy
  const [cooplandBleedingLt20, setCooplandBleedingLt20] = useState(false);
  const [cooplandBleedingGt20, setCooplandBleedingGt20] = useState(false);
  const [cooplandAnemia, setCooplandAnemia] = useState(false);
  const [cooplandPrematurity, setCooplandPrematurity] = useState(false);
  const [cooplandHpn, setCooplandHpn] = useState(false);
  const [cooplandProm, setCooplandProm] = useState(false);
  const [cooplandPolyOligo, setCooplandPolyOligo] = useState(false);
  const [cooplandIugr, setCooplandIugr] = useState(false);
  const [cooplandMultiple, setCooplandMultiple] = useState(false);
  const [cooplandBreech, setCooplandBreech] = useState(false);
  const [cooplandRh, setCooplandRh] = useState(false);

  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // ── Engine Sub-detail States ──────────────────────────────────────
  const [feverWithChills, setFeverWithChills]     = useState(false);
  const [feverWithSweating, setFeverWithSweating] = useState(false);
  const [bellyPainHardAbdomen, setBellyPainHardAbdomen] = useState(false);
  const [bellyPainBleeding, setBellyPainBleeding]       = useState(false);

  const SWELLING_LOCATIONS = ['Face', 'Hands', 'Feet', 'Legs'] as const;
  const [swellingLocations, setSwellingLocations] = useState<string[]>([]);
  const toggleSwellingLocation = (loc: string) =>
    setSwellingLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );

  const [urinaryDiscomfort, setUrinaryDiscomfort]       = useState(false);
  const [lossVaginalFluid, setLossVaginalFluid]         = useState(false);
  const [decreasedFetalMovement, setDecreasedFetalMovement] = useState(false);

  const [preeclampsiaCount, setPreeclampsiaCount] = useState(0);
  const [bellyPainCount, setBellyPainCount]       = useState(0);
  const [diabetesCount, setDiabetesCount]         = useState(0);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await api.getSymptomCatalog();
        const serverCatalog = res.catalog || [];
        const mergedMap: Record<string, any> = {};
        ALL_APP_SYMPTOMS.forEach((s) => { mergedMap[s.id] = s; });
        serverCatalog.forEach((s: any) => {
          mergedMap[s.id] = { ...mergedMap[s.id], ...s };
        });
        setCatalog(Object.values(mergedMap));
      } catch {
        setCatalog(ALL_APP_SYMPTOMS);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Real-time live Coopland High-Risk calculation (1:1 with hospital form)
  const liveCoopland = useMemo(() => {
    let score = 0;
    const factors: { label: string; points: number }[] = [];

    // Reproductive History
    if (cooplandAgeGroup === 'le_16') { score += 1; factors.push({ label: 'Age <= 16', points: 1 }); }
    if (cooplandAgeGroup === 'gt_35') { score += 2; factors.push({ label: 'Age > 35', points: 2 }); }

    if (cooplandParity === '0') { score += 1; factors.push({ label: 'Parity = 0 (First Pregnancy)', points: 1 }); }
    if (cooplandParity === 'gt_4') { score += 2; factors.push({ label: 'Parity > 4 (Grand Multipara)', points: 2 }); }

    if (cooplandAbortions) { score += 1; factors.push({ label: 'Abortions >= 2 / Infertility hx', points: 1 }); }
    if (cooplandPostpartumBleeding) { score += 1; factors.push({ label: 'Postpartum Bleeding', points: 1 }); }
    if (cooplandManualPlacenta) { score += 1; factors.push({ label: 'Manual Removal of Placenta', points: 1 }); }
    if (cooplandBabyOver9lb) { score += 1; factors.push({ label: 'Previous Baby > 9 lbs', points: 1 }); }
    if (cooplandBabyUnder5lb8oz) { score += 1; factors.push({ label: 'Previous Baby < 5 lbs 8 oz / > 5 lbs 8 oz', points: 1 }); }
    if (cooplandToxemiaHpn) { score += 1; factors.push({ label: 'Previous Toxemia or HPN', points: 1 }); }
    if (cooplandPreviousCs) { score += 2; factors.push({ label: 'Previous Cesarean Section (CS)', points: 2 }); }
    if (cooplandAbnormalLabor) { score += 2; factors.push({ label: 'Previous Abnormal/Difficult Labor', points: 2 }); }

    // Medical / Surgical
    if (cooplandPrevGyne) { score += 1; factors.push({ label: 'Previous Gynecologic Condition', points: 1 }); }
    if (cooplandChronicRenal) { score += 1; factors.push({ label: 'Chronic Renal Disease', points: 1 }); }
    if (cooplandGestationalDiabetes) { score += 1; factors.push({ label: 'Gestational Diabetes (Class A)', points: 1 }); }
    if (cooplandClassBDiabetes) { score += 3; factors.push({ label: 'Class B Diabetes or Higher', points: 3 }); }
    if (cooplandCardiac) { score += 3; factors.push({ label: 'Cardiac Disease', points: 3 }); }
    if (cooplandAsthma) { score += 1; factors.push({ label: 'Asthma', points: 1 }); }
    if (cooplandTb) { score += 1; factors.push({ label: 'Tuberculosis', points: 1 }); }
    if (cooplandPulmonaryEmbolism) { score += 3; factors.push({ label: 'Pulmonary Embolism', points: 3 }); }
    if (cooplandThyroid === 'history') { score += 2; factors.push({ label: 'Hyperthyroidism (History)', points: 2 }); }
    if (cooplandThyroid === 'medication') { score += 3; factors.push({ label: 'Hyperthyroidism (On Medication)', points: 3 }); }
    if (cooplandCollagen === 'remission') { score += 1; factors.push({ label: 'Collagen Vascular (Remission)', points: 1 }); }
    if (cooplandCollagen === 'active') { score += 3; factors.push({ label: 'Collagen Vascular (Active)', points: 3 }); }
    if (cooplandTorch) { score += 2; factors.push({ label: 'TORCH Infection (Present Pregnancy)', points: 2 }); }
    if (cooplandPyelonephritis) { score += 2; factors.push({ label: 'Pyelonephritis / UTI', points: 2 }); }
    if (cooplandSevereInfection) { score += 3; factors.push({ label: 'Other Severe Systemic Infection', points: 3 }); }
    if (cooplandEpilepsy === 'history') { score += 1; factors.push({ label: 'Epilepsy (History)', points: 1 }); }
    if (cooplandEpilepsy === 'medication') { score += 2; factors.push({ label: 'Epilepsy (On Medication)', points: 2 }); }

    // Present Pregnancy
    if (cooplandBleedingLt20) { score += 1; factors.push({ label: 'Bleeding < 20 weeks', points: 1 }); }
    if (cooplandBleedingGt20) { score += 3; factors.push({ label: 'Bleeding > 20 weeks', points: 3 }); }
    if (cooplandAnemia) { score += 1; factors.push({ label: 'Anemia < 10 gm%', points: 1 }); }
    if (cooplandPrematurity) { score += 1; factors.push({ label: 'Postmaturity / Prematurity', points: 1 }); }
    if (cooplandHpn) { score += 2; factors.push({ label: 'Hypertension', points: 2 }); }
    if (cooplandProm) { score += 1; factors.push({ label: 'Premature Rupture of Membrane (PROM)', points: 1 }); }
    if (cooplandPolyOligo) { score += 1; factors.push({ label: 'Polyhydramnios / Oligohydramnios', points: 1 }); }
    if (cooplandIugr) { score += 1; factors.push({ label: 'IUGR (Growth Restriction)', points: 1 }); }
    if (cooplandMultiple) { score += 1; factors.push({ label: 'Multiple Pregnancy (Twins+)', points: 1 }); }
    if (cooplandBreech) { score += 1; factors.push({ label: 'Breech / Malpresentation', points: 1 }); }
    if (cooplandRh) { score += 3; factors.push({ label: 'Rh Isoimmunization', points: 3 }); }

    let level: 'Low' | 'High' | 'Severe' = 'Low';
    if (score >= 3 && score <= 6) level = 'High';
    else if (score >= 7) level = 'Severe';

    return { score, level, factors };
  }, [
    cooplandAgeGroup, cooplandParity, cooplandAbortions, cooplandPostpartumBleeding, cooplandManualPlacenta,
    cooplandBabyOver9lb, cooplandBabyUnder5lb8oz, cooplandToxemiaHpn, cooplandPreviousCs, cooplandAbnormalLabor,
    cooplandPrevGyne, cooplandChronicRenal, cooplandGestationalDiabetes, cooplandClassBDiabetes, cooplandCardiac,
    cooplandAsthma, cooplandTb, cooplandPulmonaryEmbolism, cooplandThyroid, cooplandCollagen, cooplandTorch,
    cooplandPyelonephritis, cooplandSevereInfection, cooplandEpilepsy,
    cooplandBleedingLt20, cooplandBleedingGt20, cooplandAnemia, cooplandPrematurity, cooplandHpn, cooplandProm,
    cooplandPolyOligo, cooplandIugr, cooplandMultiple, cooplandBreech, cooplandRh
  ]);

  // Real-time live client-side risk calculation (offline capable)
  const liveRisk = useMemo(() => {
    const symptomEntries: SymptomEntry[] = catalog.map((c) => ({
      id: c.id,
      severity: selectedSeverities[c.id] || 'None',
    }));

    return evaluateMaternalRisk({
      age: 28,
      trimester: 2,
      bp_sys: ppFactors.hypertension ? 145 : 120,
      bp_dia: ppFactors.hypertension ? 95 : 80,
      bmi: 23,
      hemoglobin: 12,
      blood_sugar: 95,
      pregnancyProblems: ppFactors,
      symptoms: symptomEntries,
    });
  }, [catalog, selectedSeverities, ppFactors]);

  const setSeverity = (symptomId: string, level: 'None' | 'Mild' | 'Moderate' | 'Severe') => {
    setSelectedSeverities((prev) => ({
      ...prev,
      [symptomId]: level,
    }));
    if (!selectedDurations[symptomId]) {
      setSelectedDurations((prev) => ({ ...prev, [symptomId]: 'Today' }));
    }
    if (!selectedFrequencies[symptomId]) {
      setSelectedFrequencies((prev) => ({ ...prev, [symptomId]: 'Rare' }));
    }
  };

  const setDuration = (symptomId: string, dur: 'Today' | '1–3 Days' | 'More than 3 Days') => {
    setSelectedDurations((prev) => ({ ...prev, [symptomId]: dur }));
  };

  const setFrequency = (symptomId: string, freq: 'Rare' | 'Sometimes' | 'Often' | 'Always') => {
    setSelectedFrequencies((prev) => ({ ...prev, [symptomId]: freq }));
  };

  const togglePP = (key: string) => {
    setPpFactors((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const buildCriticalRecommendations = (selected: Record<string, string>) => {
    const recs: string[] = [];
    const activeEntries = Object.entries(selected).filter(([_, sev]) => sev !== 'None');

    for (const [id, sev] of activeEntries) {
      if (id === 'bleeding') {
        recs.push(sev === 'Severe'
          ? '⚠️ Active Vaginal Bleeding: Any heavy bleeding requires immediate emergency medical evaluation. Avoid tampons or intercourse and proceed to your nearest maternity triage immediately.'
          : '⚠️ Vaginal Spotting: Rest with feet elevated, avoid strenuous activity, track pad count, and contact your doctor or midwife for prompt clinical assessment.');
      } else if (id === 'headache') {
        recs.push(sev === 'Severe' || sev === 'Moderate'
          ? '⚠️ Persistent / Severe Headache: Rest in a dark, quiet room. If accompanied by blurred vision, spots, or swelling, seek immediate clinical assessment to rule out pre-eclampsia.'
          : 'Headache Care: Rest in a calm environment, stay well-hydrated, and apply a cool cloth to your forehead.');
      } else if (id === 'blurred_vision') {
        recs.push('⚠️ Visual Changes: Blurred vision, floaters, or flashes of light can be critical signs of elevated blood pressure. Have your blood pressure checked promptly.');
      } else if (id === 'convulsions') {
        recs.push('🚨 Emergency Neurological: Call emergency medical services immediately. Ensure the mother is safely resting on her left side away from hard objects to protect airway.');
      } else if (id === 'difficulty_breathing') {
        recs.push('⚠️ Respiratory Strain: Sit upright in a comfortable position, rest, and seek urgent clinical evaluation to assess oxygenation and maternal heart/lung function.');
      } else if (id === 'chest_pain') {
        recs.push('⚠️ Chest Discomfort: Sit quietly and seek urgent medical evaluation to rule out cardiac strain or pulmonary complications.');
      } else if (id === 'abdominal_pain') {
        recs.push(bellyPainHardAbdomen || bellyPainBleeding || sev === 'Severe'
          ? '🚨 Critical Abdominal Pain: A rigid, board-like abdomen or severe cramping with bleeding requires immediate emergency hospital evaluation.'
          : 'Abdominal Discomfort: Rest on your left side and drink warm water. If cramps become rhythmic or increase in pain, contact your maternity unit.');
      } else if (id === 'fluid_loss') {
        recs.push('🚨 Amniotic Fluid Leakage: Leaking clear fluid may indicate premature rupture of membranes (water breaking). Contact your maternity unit or healthcare provider immediately.');
      } else if (id === 'reduced_movement') {
        recs.push('⚠️ Reduced Fetal Activity: Lie on your left side, drink a cold glass of water or juice, and count kicks for 1 hour. If fewer than 10 movements occur, go to maternity triage immediately.');
      } else if (id === 'fever') {
        recs.push(feverWithChills || feverWithSweating || sev === 'Severe'
          ? '⚠️ High Fever / Chills: Elevated maternal temperature can affect baby and may indicate infection. Drink plenty of fluids, rest, and consult your doctor for safe antipyretic care and infection screening.'
          : 'Fever Management: Keep hydrated with cool water, rest, and notify your healthcare provider if fever reaches 38°C (100.4°F).');
      } else if (id === 'dizziness' || id === 'fainting') {
        recs.push('Dizziness / Fainting: Lie down on your left side immediately to restore blood circulation. Drink electrolyte fluids and avoid getting up quickly.');
      } else if (id === 'swelling') {
        recs.push(swellingLocations.includes('Face') || swellingLocations.includes('Hands') || swellingLocations.length >= 3
          ? '⚠️ Sudden Swelling (Preeclampsia Warning): Rapid swelling across face, hands, or eyes requires prompt clinical blood pressure and urine protein evaluation.'
          : 'Maternal Swelling: Elevate your feet above heart level for 20–30 minutes, wear comfortable footwear, and stay hydrated.');
      } else if (id === 'leg_swelling_pain') {
        recs.push('⚠️ Unilateral Leg Swelling/Pain: One-sided swelling, warmth, or tenderness in calf may indicate a deep vein blood clot (DVT). Avoid massaging the leg and seek clinical evaluation immediately.');
      } else if (id === 'urinary_discomfort') {
        recs.push('Urinary Discomfort: Burning or pain during urination may signal a urinary tract infection (UTI). Drink plenty of water and seek a urine culture test from your clinic.');
      } else if (id === 'vomiting') {
        recs.push(sev === 'Severe'
          ? '⚠️ Hyperemesis Warning: Severe vomiting and inability to keep fluids down requires clinical assessment for IV hydration.'
          : 'Nausea & Vomiting: Sip cold water, electrolyte drinks, or ginger tea in small, frequent amounts. Eat dry crackers and avoid an empty stomach.');
      } else if (id === 'fatigue') {
        recs.push('Severe Fatigue: Aim for 8+ hours of sleep, rest between daily tasks, and consult your provider to check hemoglobin levels for anemia.');
      } else if (id === 'back_pain') {
        recs.push('Back Care: Practice gentle pelvic tilts, apply a warm compress, wear supportive flat shoes, and avoid heavy lifting. If pain is rhythmic, contact your provider.');
      }
    }

    if (recs.length === 0) {
      recs.push('No active critical symptoms reported. Continue monitoring daily and report any sudden headache, bleeding, vision changes, or fluid leakage immediately.');
    }

    return recs;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formattedSymptoms = catalog.map((c) => ({
        id: c.id,
        severity: selectedSeverities[c.id] || 'None',
        duration: selectedDurations[c.id] || 'Today',
        frequency: selectedFrequencies[c.id] || 'Rare',
      }));

      const activeSymptomsList = catalog
        .filter((c) => (selectedSeverities[c.id] || 'None') !== 'None')
        .map((c) => ({
          name: c.name,
          severity: selectedSeverities[c.id],
        }));

      const criticalRecs = buildCriticalRecommendations(selectedSeverities);

      const res = await api.submitSymptoms({
        symptoms: formattedSymptoms,
        pregnancy_problems: ppFactors,
        // Engine sub-details
        fever_with_chills: feverWithChills,
        fever_with_sweating: feverWithSweating,
        belly_pain_with_hard_abdomen: bellyPainHardAbdomen,
        belly_pain_with_bleeding: bellyPainBleeding,
        swollen_locations: swellingLocations,
        discomfort_during_urination: urinaryDiscomfort,
        loss_of_vaginal_fluid: lossVaginalFluid,
        decreased_fetal_movement: decreasedFetalMovement,
        preeclampsia_symptoms_count: preeclampsiaCount,
        belly_pain_symptoms_count: bellyPainCount,
        diabetes_symptoms_count: diabetesCount,
      });

      await AsyncStorage.removeItem('@pregnacare_resolved_visit').catch(() => {});

      // Use critical recommendations only (not general risk recommendations)
      const mergedResult = {
        source: 'symptoms' as const,
        score: res?.score ?? 0,
        level: activeSymptomsList.some(s => s.severity === 'Severe') ? 'Severe' : (activeSymptomsList.length > 0 ? 'High' : 'Low'),
        activeSymptoms: activeSymptomsList,
        recommendations: criticalRecs,
        clinical_alerts: {
          triggered_symptoms: activeSymptomsList.filter(s => s.severity === 'Severe' || s.severity === 'Moderate').map(s => `${s.name} (${s.severity})`),
        },
      };

      setAssessmentResult(mergedResult);
      setShowResultModal(true);
    } catch (e: any) {
      const activeSymptomsList = catalog
        .filter((c) => (selectedSeverities[c.id] || 'None') !== 'None')
        .map((c) => ({
          name: c.name,
          severity: selectedSeverities[c.id],
        }));
      const criticalRecs = buildCriticalRecommendations(selectedSeverities);

      setAssessmentResult({
        source: 'symptoms' as const,
        score: 0,
        level: activeSymptomsList.some(s => s.severity === 'Severe') ? 'Severe' : (activeSymptomsList.length > 0 ? 'High' : 'Low'),
        activeSymptoms: activeSymptomsList,
        recommendations: criticalRecs,
        clinical_alerts: {
          triggered_symptoms: activeSymptomsList.filter(s => s.severity === 'Severe' || s.severity === 'Moderate').map(s => `${s.name} (${s.severity})`),
        },
      });
      setShowResultModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCooplandSubmit = async () => {
    setSubmitting(true);
    try {
      const matchedFactorLabels = liveCoopland.factors.map(f => `${f.label} (+${f.points})`);
      const res = await api.submitCooplandAssessment({
        score: liveCoopland.score,
        risk_level: liveCoopland.level.toUpperCase(),
        matched_factors: matchedFactorLabels,
        pregnancy_problems: {
          bleeding_lt_20wks: cooplandBleedingLt20,
          bleeding_gt_20wks: cooplandBleedingGt20,
          postmaturity_prematurity: cooplandPrematurity,
          hypertension: cooplandHpn,
          prom: cooplandProm,
          poly_oligohydramnios: cooplandPolyOligo,
          iugr: cooplandIugr,
          multiple_pregnancy: cooplandMultiple,
          breech_malpresentation: cooplandBreech,
          rh_isoimmunization: cooplandRh,
        },
      });

      const recs = liveCoopland.level === 'Severe'
        ? [
            `Severe Risk identified (Coopland Score: ${liveCoopland.score}). Urgent evaluation by an obstetrician is recommended.`,
            'Frequent clinical monitoring of maternal vital signs and fetal well-being is required.',
            'Adhere strictly to specialized medical protocols and hospital guidance.'
          ]
        : liveCoopland.level === 'High'
        ? [
            `High Risk identified (Coopland Score: ${liveCoopland.score}). Schedule an OB-GYN checkup within 24 to 48 hours.`,
            'Monitor blood pressure, blood glucose, fetal activity, and report any warning signs.',
            'Ensure timely ultrasound screenings and diagnostic laboratory tests as instructed.'
          ]
        : [
            `Low Risk profile (Coopland Score: ${liveCoopland.score}). Maintain your routine prenatal visit schedule.`,
            'Continue daily prenatal vitamins, balanced nutrition, and hydration.',
            'Regularly log daily symptoms to keep track of your pregnancy wellness.'
          ];

      const assessmentPayload = {
        source: 'coopland' as const,
        score: liveCoopland.score,
        level: liveCoopland.level,
        coopland: {
          coopland_score: liveCoopland.score,
          coopland_risk: liveCoopland.level.toUpperCase(),
          factors: matchedFactorLabels,
        },
        clinical_alerts: {
          triggered_symptoms: matchedFactorLabels,
        },
        recommendations: recs,
      };

      // Instantly persist latest Coopland assessment locally for Dashboard & Risk screens
      const localCoopData = {
        score: liveCoopland.score,
        level: liveCoopland.level,
        factors: matchedFactorLabels,
        date: new Date().toISOString(),
        recommendations: recs,
      };
      await AsyncStorage.setItem('@pregnacare_latest_coopland', JSON.stringify(localCoopData));

      setAssessmentResult(assessmentPayload);
      setShowResultModal(true);

      // Trigger user notification based on evaluated risk level
      if (liveCoopland.level === 'Severe') {
        sendPhoneNotification(
          '🚨 Urgent: Severe Maternal Risk Detected',
          `Your Coopland score is ${liveCoopland.score} (Severe Risk). Immediate medical evaluation by an obstetrician or hospital triage is strongly advised.`
        ).catch(() => {});
      } else if (liveCoopland.level === 'High') {
        sendPhoneNotification(
          '⚠️ Maternal Risk Alert: High Risk',
          `Your Coopland score is ${liveCoopland.score} (High Risk). Please schedule an OB-GYN checkup within 24 to 48 hours.`
        ).catch(() => {});
      } else {
        sendPhoneNotification(
          '✅ Risk Assessment Completed: Low Risk',
          `Your Coopland score is ${liveCoopland.score} (Low Risk). Routine prenatal care supported.`
        ).catch(() => {});
      }
    } catch (e: any) {
      const fallbackRecs = [
        liveCoopland.level === 'Severe'
          ? `Severe Risk identified (Coopland Score: ${liveCoopland.score}). Urgent evaluation by an obstetrician is recommended.`
          : (liveCoopland.level === 'High'
              ? `High Risk identified (Coopland Score: ${liveCoopland.score}). Schedule an OB-GYN checkup within 24 to 48 hours.`
              : `Low Risk profile (Coopland Score: ${liveCoopland.score}). Maintain your routine prenatal visit schedule.`)
      ];

      AsyncStorage.setItem('@pregnacare_latest_coopland', JSON.stringify({
        score: liveCoopland.score,
        level: liveCoopland.level,
        factors: liveCoopland.factors.map(f => `${f.label} (+${f.points})`),
        date: new Date().toISOString(),
        recommendations: fallbackRecs,
      })).catch(() => {});

      setAssessmentResult({
        source: 'coopland' as const,
        score: liveCoopland.score,
        level: liveCoopland.level,
        coopland: {
          coopland_score: liveCoopland.score,
          coopland_risk: liveCoopland.level.toUpperCase(),
          factors: liveCoopland.factors.map(f => `${f.label} (+${f.points})`),
        },
        clinical_alerts: {
          triggered_symptoms: liveCoopland.factors.map(f => f.label),
        },
        recommendations: fallbackRecs,
      });
      setShowResultModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Loading clinical symptom catalog...</Text>
      </View>
    );
  }

  const ppRulesList = [
    {
      key: 'bleeding_lt_20wks',
      title: 'Bleeding or spotting early in pregnancy',
      desc: 'Any light or heavy vaginal bleeding during the first 20 weeks (first 5 months).',
      tag: 'First 20 Weeks',
    },
    {
      key: 'bleeding_gt_20wks',
      title: 'Bleeding later in pregnancy',
      desc: 'Any vaginal bleeding after 20 weeks (in the second half of your pregnancy).',
      tag: 'After 20 Weeks',
    },
    {
      key: 'postmaturity_prematurity',
      title: 'Early contractions or overdue baby',
      desc: 'Labor signs starting before 37 weeks, or pregnancy lasting past 41–42 weeks.',
      tag: 'Labor Timing',
    },
    {
      key: 'hypertension',
      title: 'High blood pressure',
      desc: 'Blood pressure reading of 140/90 or higher diagnosed by your doctor.',
      tag: 'Blood Pressure',
    },
    {
      key: 'prom',
      title: 'Water broke or fluid leaking early',
      desc: 'Amniotic fluid leaking or your water bag breaking before labor begins.',
      tag: 'Water Leaking',
    },
    {
      key: 'poly_oligohydramnios',
      title: 'Too much or too little fluid around baby',
      desc: 'Ultrasound showed high or low amniotic fluid levels.',
      tag: 'Fluid Levels',
    },
    {
      key: 'iugr',
      title: 'Baby is smaller or growing slower than expected',
      desc: 'Doctor or ultrasound noted baby is smaller than expected for their gestational age.',
      tag: 'Baby Growth',
    },
    {
      key: 'multiple_pregnancy',
      title: 'Expecting twins or triplets',
      desc: 'You are carrying more than one baby.',
      tag: 'Twins / Multiples',
    },
    {
      key: 'breech_malpresentation',
      title: 'Baby is feet-first or sideways',
      desc: 'Baby is positioned bottom-down (breech) or lying sideways instead of head-down.',
      tag: 'Baby Position',
    },
    {
      key: 'rh_isoimmunization',
      title: 'Rh blood type mismatch',
      desc: 'Mother has Rh-negative blood requiring special antibody care (like RhoGAM shots).',
      tag: 'Blood Match',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Top Segmented Tab Switcher: Submit Symptoms vs Assess Risk ── */}
      <View style={styles.topTabBar}>
        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'submit_symptoms' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('submit_symptoms')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="medkit-outline"
            size={18}
            color={activeTab === 'submit_symptoms' ? Colors.white : Colors.primaryDark}
          />
          <Text
            style={[
              styles.topTabText,
              activeTab === 'submit_symptoms' && styles.topTabTextActive,
            ]}
          >
            Submit Symptoms
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'assess_risk' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('assess_risk')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={activeTab === 'assess_risk' ? Colors.white : Colors.primaryDark}
          />
          <Text
            style={[
              styles.topTabText,
              activeTab === 'assess_risk' && styles.topTabTextActive,
            ]}
          >
            Assess Risk
          </Text>
        </TouchableOpacity>
      </View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: SUBMIT SYMPTOMS (ALL APP SYMPTOMS)                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'submit_symptoms' && (
        <>
          <View style={styles.tabIntroBox}>
            <Text style={styles.tabIntroTitle}>Daily Maternal Symptoms Check-in</Text>
            <Text style={styles.tabIntroDesc}>
              Select any symptoms you are experiencing today, choose their severity, and submit for instant clinical analysis.
            </Text>
          </View>

          {/* Symptoms Checklist */}
          <Text style={styles.sectionHeader}>How are you feeling today?</Text>
          {catalog.map((item) => {
            const currentSev = selectedSeverities[item.id] || 'None';
            const isSelected = currentSev !== 'None';
            const currentDur = selectedDurations[item.id] || 'Today';
            const currentFreq = selectedFrequencies[item.id] || 'Rare';

            return (
              <View
                key={item.id}
                style={[
                  styles.symptomCard,
                  isSelected && styles.symptomCardActive,
                  Shadows.card,
                ]}
              >
                <View style={styles.symptomInfoRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      isSelected && { backgroundColor: Colors.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name={item.weight >= 0.8 ? 'warning-outline' : 'medkit-outline'}
                      size={18}
                      color={item.weight >= 0.8 ? Colors.riskHigh : Colors.primaryDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.symptomName}>{item.name}</Text>
                  </View>
                </View>

                {/* Severity Selector Chips (1:1 with style.css .chip & .chip.on) */}
                <View style={styles.severityRow}>
                  {(['None', 'Mild', 'Moderate', 'Severe'] as const).map((sev) => {
                    const isActive = currentSev === sev;
                    const isSevHigh = sev === 'Severe';
                    return (
                      <TouchableOpacity
                        key={sev}
                        style={[
                          styles.chip,
                          isActive && (isSevHigh ? styles.chipSevere : styles.chipActive),
                        ]}
                        onPress={() => setSeverity(item.id, sev)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isActive && (isSevHigh ? styles.chipTextSevere : styles.chipTextActive),
                          ]}
                        >
                          {sev}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Duration & Frequency Select Pills (.select-pill in style.css) */}
                {isSelected && (
                  <View style={styles.extraPillSection}>
                    {/* Duration */}
                    <View style={styles.pillGroup}>
                      <Text style={styles.subPillLabel}>Duration:</Text>
                      <View style={styles.pillRow}>
                        {(['Today', '1–3 Days', 'More than 3 Days'] as const).map((dur) => (
                          <TouchableOpacity
                            key={dur}
                            style={[
                              styles.selectPillBtn,
                              currentDur === dur && styles.selectPillBtnActive,
                            ]}
                            onPress={() => setDuration(item.id, dur)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.selectPillText,
                                currentDur === dur && styles.selectPillTextActive,
                              ]}
                            >
                              {dur}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Frequency */}
                    <View style={styles.pillGroup}>
                      <Text style={styles.subPillLabel}>Frequency:</Text>
                      <View style={styles.pillRow}>
                        {(['Rare', 'Sometimes', 'Often', 'Always'] as const).map((freq) => (
                          <TouchableOpacity
                            key={freq}
                            style={[
                              styles.selectPillBtn,
                              currentFreq === freq && styles.selectPillBtnActive,
                            ]}
                            onPress={() => setFrequency(item.id, freq)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.selectPillText,
                                currentFreq === freq && styles.selectPillTextActive,
                              ]}
                            >
                              {freq}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* ── Engine Sub-detail Sections ── */}

                    {/* Fever: chills / sweating qualifier */}
                    {item.id === 'fever' && (
                      <View style={styles.subDetailBox}>
                        <Text style={styles.subDetailLabel}>Fever type (select all that apply):</Text>
                        <View style={styles.pillRow}>
                          {[
                            { key: 'chills', label: '🥶 With Chills', val: feverWithChills, set: setFeverWithChills },
                            { key: 'sweating', label: '🥵 With Sweating', val: feverWithSweating, set: setFeverWithSweating },
                          ].map(({ key, label, val, set }) => (
                            <TouchableOpacity
                              key={key}
                              style={[styles.selectPillBtn, val && styles.selectPillBtnActive]}
                              onPress={() => set(!val)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectPillText, val && styles.selectPillTextActive]}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Abdominal Pain: hard abdomen / bleeding qualifiers */}
                    {item.id === 'abdominal_pain' && (
                      <View style={styles.subDetailBox}>
                        <Text style={styles.subDetailLabel}>Additional signs (select if present):</Text>
                        <View style={styles.pillRow}>
                          {[
                            { key: 'hard', label: '⚠️ Hard/Rigid Abdomen', val: bellyPainHardAbdomen, set: setBellyPainHardAbdomen },
                            { key: 'bleed', label: '🩸 Associated Bleeding', val: bellyPainBleeding, set: setBellyPainBleeding },
                          ].map(({ key, label, val, set }) => (
                            <TouchableOpacity
                              key={key}
                              style={[styles.selectPillBtn, val && styles.chipSevere, { borderRadius: 11 }]}
                              onPress={() => set(!val)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.selectPillText, val && { color: Colors.riskHigh, fontWeight: '800' }]}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {/* Belly pain cluster count */}
                        <Text style={[styles.subDetailLabel, { marginTop: 8 }]}>How many abdominal symptoms? (0–5)</Text>
                        <View style={styles.pillRow}>
                          {[0, 1, 2, 3, 4, 5].map((n) => (
                            <TouchableOpacity
                              key={n}
                              style={[styles.countChip, bellyPainCount === n && styles.countChipActive]}
                              onPress={() => setBellyPainCount(n)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.countChipText, bellyPainCount === n && styles.countChipTextActive]}>{n}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Swelling: location multi-select */}
                    {item.id === 'swelling' && (
                      <View style={styles.subDetailBox}>
                        <Text style={styles.subDetailLabel}>Where is the swelling?</Text>
                        <View style={styles.pillRow}>
                          {SWELLING_LOCATIONS.map((loc) => (
                            <TouchableOpacity
                              key={loc}
                              style={[
                                styles.selectPillBtn,
                                swellingLocations.includes(loc) && styles.selectPillBtnActive,
                              ]}
                              onPress={() => toggleSwellingLocation(loc)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.selectPillText,
                                swellingLocations.includes(loc) && styles.selectPillTextActive,
                              ]}>{loc}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Submit Action Button (.btn-primary) */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            style={{ marginTop: 12, marginBottom: 20 }}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Symptom Check-in & Assess</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: ASSESS RISK (COOPLAND HIGH RISK EVALUATION FORM)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'assess_risk' && (
        <>
          {/* Hospital Header Banner */}
          <View style={[styles.hospitalHeaderCard, Shadows.card]}>
            <View style={styles.hospitalTopBadge}>
              <Text style={styles.hospitalRepublicText}>Republic of the Philippines</Text>
              <Text style={styles.hospitalDocCode}>MD08-FM-011/Rev.0/5Jul2023</Text>
            </View>
            <Text style={styles.hospitalName}>MAYOR HILARION A. RAMIRO SR. MEDICAL CENTER</Text>
            <Text style={styles.hospitalCity}>Ozamiz City • Department of OB-GYN</Text>
            <View style={styles.hospitalDivider} />
            <Text style={styles.hospitalFormTitle}>HIGH RISK EVALUATION FORMS (COOPLAND)</Text>
          </View>

          {/* Live Coopland Risk Score Card */}
          <View style={[styles.cooplandScoreCard, Shadows.card]}>
            <View style={styles.scoreRow}>
              <View>
                <Text style={styles.scoreEyebrow}>CURRENT COOPLAND SCORE</Text>
                <Text style={styles.scoreNumber}>{liveCoopland.score}</Text>
              </View>
              <View
                style={[
                  styles.riskBadge,
                  liveCoopland.level === 'Low' && styles.riskBadgeLow,
                  liveCoopland.level === 'High' && styles.riskBadgeHigh,
                  liveCoopland.level === 'Severe' && styles.riskBadgeSevere,
                ]}
              >
                <Ionicons
                  name={
                    liveCoopland.level === 'Severe'
                      ? 'alert-circle'
                      : liveCoopland.level === 'High'
                      ? 'warning'
                      : 'shield-checkmark'
                  }
                  size={16}
                  color={
                    liveCoopland.level === 'Severe'
                      ? Colors.riskHigh
                      : liveCoopland.level === 'High'
                      ? '#d97706'
                      : '#059669'
                  }
                />
                <Text
                  style={[
                    styles.riskBadgeText,
                    liveCoopland.level === 'Severe' && styles.riskBadgeTextSevere,
                    liveCoopland.level === 'High' && styles.riskBadgeTextHigh,
                    liveCoopland.level === 'Low' && styles.riskBadgeTextLow,
                  ]}
                >
                  {liveCoopland.level.toUpperCase()} RISK
                </Text>
              </View>
            </View>

            {/* Threshold Guide */}
            <View style={styles.thresholdGuideRow}>
              <Text style={[styles.thresholdItem, liveCoopland.level === 'Low' && styles.thresholdActive]}>
                Low Risk: 0–2
              </Text>
              <Text style={styles.thresholdDot}>•</Text>
              <Text style={[styles.thresholdItem, liveCoopland.level === 'High' && styles.thresholdActive]}>
                High Risk: 3–6
              </Text>
              <Text style={styles.thresholdDot}>•</Text>
              <Text style={[styles.thresholdItem, liveCoopland.level === 'Severe' && styles.thresholdActive]}>
                Severe Risk: ≥ 7
              </Text>
            </View>

            {/* Triggered Factors List */}
            {liveCoopland.factors.length > 0 ? (
              <View style={styles.matchedFactorsBox}>
                <Text style={styles.matchedFactorsTitle}>Identified Factors ({liveCoopland.factors.length}):</Text>
                <View style={styles.factorChipsWrap}>
                  {liveCoopland.factors.map((f, i) => (
                    <View key={i} style={styles.factorChip}>
                      <Text style={styles.factorChipText}>{f.label}</Text>
                      <View style={styles.factorPointsPill}>
                        <Text style={styles.factorPointsText}>+{f.points}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.noFactorsText}>No high-risk criteria selected. Score is 0 (Low Risk).</Text>
            )}
          </View>

          {/* ── SECTION 1: REPRODUCTIVE HISTORY ── */}
          <View style={[styles.cooplandSectionCard, Shadows.card]}>
            <View style={styles.cooplandSectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} />
              </View>
              <Text style={styles.cooplandSectionTitle}>1. REPRODUCTIVE HISTORY</Text>
            </View>

            {/* Age */}
            <View style={styles.cooplandItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cooplandItemLabel}>Maternal Age</Text>
                <Text style={styles.cooplandItemSub}>Age &le; 16 (+1) • 17–35 (0) • &gt; 35 (+2)</Text>
              </View>
              <View style={styles.radioGroup}>
                {[
                  { key: 'le_16', label: '≤ 16 (+1)' },
                  { key: '17_35', label: '17–35 (0)' },
                  { key: 'gt_35', label: '> 35 (+2)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.radioPill, cooplandAgeGroup === opt.key && styles.radioPillActive]}
                    onPress={() => setCooplandAgeGroup(opt.key as any)}
                  >
                    <Text style={[styles.radioPillText, cooplandAgeGroup === opt.key && styles.radioPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Parity */}
            <View style={styles.cooplandItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cooplandItemLabel}>Parity (Number of Previous Births)</Text>
                <Text style={styles.cooplandItemSub}>0 (+1) • 1–4 (0) • &gt; 4 (+2)</Text>
              </View>
              <View style={styles.radioGroup}>
                {[
                  { key: '0', label: '0 (+1)' },
                  { key: '1_4', label: '1–4 (0)' },
                  { key: 'gt_4', label: '> 4 (+2)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.radioPill, cooplandParity === opt.key && styles.radioPillActive]}
                    onPress={() => setCooplandParity(opt.key as any)}
                  >
                    <Text style={[styles.radioPillText, cooplandParity === opt.key && styles.radioPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Abortions */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Abortions &ge; 2 / Infertility History</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>History of 2 or more miscarriages, abortions, or infertility</Text>
              </View>
              <Switch
                value={cooplandAbortions}
                onValueChange={setCooplandAbortions}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Postpartum Bleeding */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Postpartum Bleeding (PPH)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Severe hemorrhage following a previous delivery</Text>
              </View>
              <Switch
                value={cooplandPostpartumBleeding}
                onValueChange={setCooplandPostpartumBleeding}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Manual Removal of Placenta */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Manual Removal of Placenta</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Required manual extraction of placenta in prior pregnancy</Text>
              </View>
              <Switch
                value={cooplandManualPlacenta}
                onValueChange={setCooplandManualPlacenta}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Baby > 9 lbs */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Previous Baby &gt; 9 lbs (Macrosomia)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Birth weight greater than 4,000 grams</Text>
              </View>
              <Switch
                value={cooplandBabyOver9lb}
                onValueChange={setCooplandBabyOver9lb}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Baby < 5 lbs 8 oz */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Previous Baby &lt; 5 lbs 8 oz (Low Birth Weight)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Birth weight less than 2,500 grams</Text>
              </View>
              <Switch
                value={cooplandBabyUnder5lb8oz}
                onValueChange={setCooplandBabyUnder5lb8oz}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Toxemia or HPN */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Previous Toxemia or HPN</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Pre-eclampsia or gestational hypertension in prior pregnancy</Text>
              </View>
              <Switch
                value={cooplandToxemiaHpn}
                onValueChange={setCooplandToxemiaHpn}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Previous CS */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Previous Cesarean Section (CS)</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+2</Text>
                </View>
                <Text style={styles.cooplandItemSub}>One or more surgical cesarean deliveries</Text>
              </View>
              <Switch
                value={cooplandPreviousCs}
                onValueChange={setCooplandPreviousCs}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Abnormal/Difficult Labor */}
            <View style={[styles.cooplandSwitchRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Abnormal / Difficult Labor</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+2</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Prolonged labor, shoulder dystocia, or vacuum/forceps delivery</Text>
              </View>
              <Switch
                value={cooplandAbnormalLabor}
                onValueChange={setCooplandAbnormalLabor}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* ── SECTION 2: MEDICAL / SURGICAL CONDITION ── */}
          <View style={[styles.cooplandSectionCard, Shadows.card]}>
            <View style={styles.cooplandSectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="fitness-outline" size={16} color={Colors.primaryDark} />
              </View>
              <Text style={styles.cooplandSectionTitle}>2. MEDICAL / SURGICAL CONDITION</Text>
            </View>

            {/* Previous Gyne */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Previous Gynecological Surgery</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Myomectomy, cone biopsy, or uterine repair</Text>
              </View>
              <Switch
                value={cooplandPrevGyne}
                onValueChange={setCooplandPrevGyne}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Chronic Renal Disease */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Chronic Renal Disease</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Pre-existing kidney disorder or nephritis</Text>
              </View>
              <Switch
                value={cooplandChronicRenal}
                onValueChange={setCooplandChronicRenal}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Gestational Diabetes */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Gestational Diabetes (Class A)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Diet-controlled pregnancy diabetes</Text>
              </View>
              <Switch
                value={cooplandGestationalDiabetes}
                onValueChange={setCooplandGestationalDiabetes}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Class B Diabetes or Higher */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Class B Diabetes or Higher</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Pre-gestational diabetes or insulin-dependent</Text>
              </View>
              <Switch
                value={cooplandClassBDiabetes}
                onValueChange={setCooplandClassBDiabetes}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Cardiac Disease */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Cardiac Disease</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Congenital, valvular, or rheumatic heart condition</Text>
              </View>
              <Switch
                value={cooplandCardiac}
                onValueChange={setCooplandCardiac}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Pulmonary Subsection */}
            <Text style={styles.subCategoryHeader}>Pulmonary Disorders</Text>
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Asthma</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
              </View>
              <Switch
                value={cooplandAsthma}
                onValueChange={setCooplandAsthma}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Tuberculosis</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
              </View>
              <Switch
                value={cooplandTb}
                onValueChange={setCooplandTb}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Pulmonary Embolism</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
              </View>
              <Switch
                value={cooplandPulmonaryEmbolism}
                onValueChange={setCooplandPulmonaryEmbolism}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Endocrine & Immunologic */}
            <Text style={styles.subCategoryHeader}>Endocrine & Immunologic</Text>
            <View style={styles.cooplandItemRow}>
              <View style={{ flex: 1, marginBottom: 8 }}>
                <Text style={styles.cooplandItemLabel}>Hyperthyroidism</Text>
                <Text style={styles.cooplandItemSub}>None (0) • History (+2) • On Medication (+3)</Text>
              </View>
              <View style={styles.radioGroup}>
                {[
                  { key: 'none', label: 'None (0)' },
                  { key: 'history', label: 'History (+2)' },
                  { key: 'medication', label: 'On Meds (+3)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.radioPill, cooplandThyroid === opt.key && styles.radioPillActive]}
                    onPress={() => setCooplandThyroid(opt.key as any)}
                  >
                    <Text style={[styles.radioPillText, cooplandThyroid === opt.key && styles.radioPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Collagen Vascular */}
            <View style={styles.cooplandItemRow}>
              <View style={{ flex: 1, marginBottom: 8 }}>
                <Text style={styles.cooplandItemLabel}>Collagen Vascular Disease (Lupus, etc.)</Text>
                <Text style={styles.cooplandItemSub}>None (0) • Remission (+1) • Active (+3)</Text>
              </View>
              <View style={styles.radioGroup}>
                {[
                  { key: 'none', label: 'None (0)' },
                  { key: 'remission', label: 'Remission (+1)' },
                  { key: 'active', label: 'Active (+3)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.radioPill, cooplandCollagen === opt.key && styles.radioPillActive]}
                    onPress={() => setCooplandCollagen(opt.key as any)}
                  >
                    <Text style={[styles.radioPillText, cooplandCollagen === opt.key && styles.radioPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Infection */}
            <Text style={styles.subCategoryHeader}>Infections</Text>
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>TORCH Infection (Present Pregnancy)</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+2</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Toxoplasmosis, Rubella, Cytomegalovirus, Herpes</Text>
              </View>
              <Switch
                value={cooplandTorch}
                onValueChange={setCooplandTorch}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Pyelonephritis / Severe UTI</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+2</Text>
                </View>
              </View>
              <Switch
                value={cooplandPyelonephritis}
                onValueChange={setCooplandPyelonephritis}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Other Severe Systemic Infection</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
              </View>
              <Switch
                value={cooplandSevereInfection}
                onValueChange={setCooplandSevereInfection}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Epilepsy */}
            <Text style={styles.subCategoryHeader}>Neurological</Text>
            <View style={[styles.cooplandItemRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, marginBottom: 8 }}>
                <Text style={styles.cooplandItemLabel}>Epilepsy</Text>
                <Text style={styles.cooplandItemSub}>None (0) • History (+1) • On Medication (+2)</Text>
              </View>
              <View style={styles.radioGroup}>
                {[
                  { key: 'none', label: 'None (0)' },
                  { key: 'history', label: 'History (+1)' },
                  { key: 'medication', label: 'On Meds (+2)' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.radioPill, cooplandEpilepsy === opt.key && styles.radioPillActive]}
                    onPress={() => setCooplandEpilepsy(opt.key as any)}
                  >
                    <Text style={[styles.radioPillText, cooplandEpilepsy === opt.key && styles.radioPillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── SECTION 3: PRESENT PREGNANCY ── */}
          <View style={[styles.cooplandSectionCard, Shadows.card]}>
            <View style={styles.cooplandSectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="heart-outline" size={16} color={Colors.primaryDark} />
              </View>
              <Text style={styles.cooplandSectionTitle}>3. PRESENT PREGNANCY</Text>
            </View>

            {/* Bleeding < 20 weeks */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Bleeding &lt; 20 Weeks</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Light or heavy bleeding in first half of pregnancy</Text>
              </View>
              <Switch
                value={cooplandBleedingLt20}
                onValueChange={setCooplandBleedingLt20}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Bleeding > 20 weeks */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Bleeding &gt; 20 Weeks</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Bleeding in second half (placenta previa/abruption)</Text>
              </View>
              <Switch
                value={cooplandBleedingGt20}
                onValueChange={setCooplandBleedingGt20}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Anemia */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Anemia &lt; 10 gm. %</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Low hemoglobin blood test</Text>
              </View>
              <Switch
                value={cooplandAnemia}
                onValueChange={setCooplandAnemia}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Postmaturity/Prematurity */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Postmaturity / Prematurity</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Labor signs &lt; 37 weeks or pregnancy &gt; 41 weeks</Text>
              </View>
              <Switch
                value={cooplandPrematurity}
                onValueChange={setCooplandPrematurity}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Hypertension */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Hypertension</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+2</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Blood pressure &ge; 140/90 mmHg</Text>
              </View>
              <Switch
                value={cooplandHpn}
                onValueChange={setCooplandHpn}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* PROM */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Premature Rupture of Membrane (PROM)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Amniotic fluid leaking or water breaking before labor</Text>
              </View>
              <Switch
                value={cooplandProm}
                onValueChange={setCooplandProm}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Polyhydramnios / Oligohydramnios */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Polyhydramnios / Oligohydramnios</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Excess or deficient amniotic fluid on ultrasound</Text>
              </View>
              <Switch
                value={cooplandPolyOligo}
                onValueChange={setCooplandPolyOligo}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* IUGR */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>IUGR (Intrauterine Growth Restriction)</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Baby smaller than expected for gestational age</Text>
              </View>
              <Switch
                value={cooplandIugr}
                onValueChange={setCooplandIugr}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Multiple Pregnancy */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Multiple Pregnancy</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Carrying twins, triplets, or higher-order multiples</Text>
              </View>
              <Switch
                value={cooplandMultiple}
                onValueChange={setCooplandMultiple}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Breech / Malpresentation */}
            <View style={styles.cooplandSwitchRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>Breech / Malpresentation</Text>
                  <Text style={styles.scorePointsBadge}>+1</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Baby feet-first, butt-first, or transverse</Text>
              </View>
              <Switch
                value={cooplandBreech}
                onValueChange={setCooplandBreech}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>

            {/* Rh Isoimmunization */}
            <View style={[styles.cooplandSwitchRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.cooplandItemLabel}>RH Isoimmunization</Text>
                  <Text style={[styles.scorePointsBadge, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>+3</Text>
                </View>
                <Text style={styles.cooplandItemSub}>Rh blood type antibody mismatch requiring special care</Text>
              </View>
              <Switch
                value={cooplandRh}
                onValueChange={setCooplandRh}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Evaluate Coopland Risk Button */}
          <TouchableOpacity
            onPress={handleCooplandSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            style={{ marginTop: 8, marginBottom: 24 }}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Evaluate Coopland Risk & View Recommendations</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* Clinical Assessment Breakdown Modal (1:1 with analyze.php & recommendations.php) */}
      <Modal visible={showResultModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.soft]}>
            {(() => {
              const isSymptomsSource = assessmentResult?.source === 'symptoms';
              const displayLevel = assessmentResult?.level ?? liveRisk?.level ?? 'Low';
              const rawRecs = (assessmentResult?.recommendations && assessmentResult.recommendations.length > 0)
                ? assessmentResult.recommendations
                : (liveRisk?.recommendations && liveRisk.recommendations.length > 0 ? liveRisk.recommendations : []);

              const normalizedModalLevel = displayLevel.toString().toLowerCase();
              const isSevereModal = normalizedModalLevel.includes('severe');
              const isHighModal = !isSevereModal && (normalizedModalLevel.includes('high') || normalizedModalLevel.includes('mod'));
              const modalThemeColor = isSevereModal ? '#DC2626' : (isHighModal ? '#D97706' : '#15803D');
              const modalThemeBg = isSevereModal ? '#FEE2E2' : (isHighModal ? '#FEF3C7' : '#DCFCE7');
              const modalThemeBorder = isSevereModal ? '#FCA5A5' : (isHighModal ? '#FCD34D' : '#BBF7D0');
              const modalThemeTitle = isSevereModal ? 'SEVERE RISK STATUS' : (isHighModal ? 'HIGH RISK STATUS' : 'LOW RISK STATUS');

              return (
                <>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalEyebrow}>
                        {isSymptomsSource ? 'SYMPTOM CHECK-IN COMPLETE' : 'COOPLAND EVALUATION COMPLETE'}
                      </Text>
                      <Text style={[styles.modalTitle, !isSymptomsSource && { color: modalThemeColor }]}>
                        {isSymptomsSource ? 'Critical Clinical Guidance' : modalThemeTitle}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowResultModal(false)}
                      style={styles.modalCloseBtn}
                    >
                      <Ionicons name="close" size={20} color={Colors.textSoft} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                    
                    {/* Styled Card Layout */}
                    <View style={{ padding: 16, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: !isSymptomsSource ? modalThemeBorder : Colors.primaryLight, marginBottom: 20, ...Shadows.soft }}>
                      
                      <LinearGradient
                        colors={!isSymptomsSource ? [modalThemeBg, Colors.surface] : [Colors.primaryLight, Colors.surface]}
                        style={{ margin: -16, marginBottom: 16, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 1, borderColor: !isSymptomsSource ? modalThemeBorder : Colors.primaryLight, alignItems: 'center' }}
                      >
                        <Text style={{ fontWeight: '800', fontSize: 15, letterSpacing: 1, color: !isSymptomsSource ? modalThemeColor : Colors.primaryDark }}>
                          {isSymptomsSource ? 'CRITICAL RECOMMENDATIONS' : `PREGNACARE ${displayLevel.toUpperCase()} RISK EVALUATION`}
                        </Text>
                      </LinearGradient>

                      {/* Coopland Score & Risk (ONLY for Assess Risk tab) */}
                      {!isSymptomsSource && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                          <View style={{ flex: 1, backgroundColor: modalThemeBg, padding: 12, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: modalThemeBorder }}>
                            <Text style={{ fontWeight: '800', fontSize: 12, color: modalThemeColor, marginBottom: 4, textTransform: 'uppercase' }}>Coopland Score</Text>
                            <Text style={{ fontSize: 24, fontWeight: '800', color: modalThemeColor }}>
                              {assessmentResult?.coopland ? assessmentResult.coopland.coopland_score : (assessmentResult?.score ?? '0')}
                            </Text>
                          </View>
                          <View style={{ flex: 1, backgroundColor: modalThemeBg, padding: 12, borderRadius: 12, marginLeft: 8, borderWidth: 1, borderColor: modalThemeBorder }}>
                            <Text style={{ fontWeight: '800', fontSize: 12, color: modalThemeColor, marginBottom: 4, textTransform: 'uppercase' }}>Coopland Risk</Text>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: modalThemeColor }}>
                              {assessmentResult?.coopland ? assessmentResult.coopland.coopland_risk : (isSevereModal ? 'SEVERE' : (isHighModal ? 'HIGH' : 'LOW'))}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Symptoms Logged (for Submit Symptoms tab) */}
                      {isSymptomsSource && (
                        <View style={{ marginBottom: 14 }}>
                          <Text style={{ fontWeight: '800', fontSize: 12.5, color: Colors.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Reported Symptoms</Text>
                          {assessmentResult?.activeSymptoms && assessmentResult.activeSymptoms.length > 0 ? (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              {assessmentResult.activeSymptoms.map((sym: any, idx: number) => {
                                const isHighSev = sym.severity === 'Severe' || sym.severity === 'Moderate';
                                return (
                                  <View
                                    key={idx}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      backgroundColor: isHighSev ? Colors.riskHighBg : Colors.backgroundSoft,
                                      paddingHorizontal: 9,
                                      paddingVertical: 5,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: isHighSev ? Colors.riskHigh : Colors.border,
                                    }}
                                  >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: isHighSev ? Colors.riskHigh : Colors.text }}>
                                      {sym.name}:{' '}
                                    </Text>
                                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: isHighSev ? Colors.riskHigh : Colors.primaryDark }}>
                                      {sym.severity}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={{ fontSize: 13.5, color: Colors.textSoft }}>No active symptoms reported</Text>
                          )}
                        </View>
                      )}

                      {/* Identified Factors for Coopland */}
                      {!isSymptomsSource && (
                        <>
                          <Text style={{ fontWeight: '800', fontSize: 12.5, color: Colors.textSoft, marginBottom: 6, textTransform: 'uppercase' }}>Identified Risk Factors</Text>
                          {assessmentResult?.clinical_alerts?.triggered_symptoms && assessmentResult.clinical_alerts.triggered_symptoms.length > 0 ? (
                            <View style={{ marginBottom: 16, backgroundColor: modalThemeBg, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: modalThemeBorder }}>
                              {assessmentResult.clinical_alerts.triggered_symptoms.map((sym: string, idx: number) => (
                                <Text key={idx} style={{ fontSize: 14, fontWeight: '600', color: modalThemeColor, marginBottom: 2 }}>• {sym}</Text>
                              ))}
                            </View>
                          ) : (
                            <View style={{ marginBottom: 16, backgroundColor: '#DCFCE7', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#15803D' }}>No high-risk criteria selected. Score is 0 (Low Risk).</Text>
                            </View>
                          )}
                        </>
                      )}

                      {/* Recommendations Block */}
                      <View style={{ backgroundColor: modalThemeBg, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: modalThemeBorder }}>
                        <Text style={{ fontWeight: '800', fontSize: 12.5, color: modalThemeColor, marginBottom: 8, textTransform: 'uppercase' }}>
                          {isSymptomsSource ? 'Critical Guidance & Actions' : 'Obstetric Recommendation'}
                        </Text>
                        {rawRecs.map((r: any, idx: number) => {
                          const text = typeof r === 'string' ? r : (r.text || '');
                          return (
                            <View key={idx} style={{ flexDirection: 'row', marginBottom: idx === rawRecs.length - 1 ? 0 : 8, alignItems: 'flex-start' }}>
                              <Ionicons
                                name={isSevereModal ? 'alert-circle' : (isHighModal ? 'warning' : 'checkmark-circle')}
                                size={16}
                                color={modalThemeColor}
                                style={{ marginRight: 8, marginTop: 2 }}
                              />
                              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: isSevereModal || isHighModal ? '700' : '500', color: isSevereModal ? '#991B1B' : (isHighModal ? '#92400E' : '#166534'), lineHeight: 20 }}>
                                {text}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowResultModal(false);
                          if (onNavigate) onNavigate('home');
                        }}
                        style={[styles.modalDoneBtn, { flex: 1, backgroundColor: modalThemeColor }]}
                      >
                        <Text style={[styles.modalDoneBtnText, { color: '#FFF' }]}>View on Dashboard</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowResultModal(false)}
                        style={[styles.modalDoneBtn, { flex: 1, backgroundColor: Colors.backgroundSoft, borderWidth: 1, borderColor: Colors.border }]}
                      >
                        <Text style={[styles.modalDoneBtnText, { color: Colors.text }]}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  headerRow: {
    marginBottom: 16,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 4,
  },
  liveCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primaryDark,
  },
  liveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.7,
  },
  calcNote: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  gaugeContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  rulesAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.riskHighBg,
    borderWidth: 1,
    borderColor: Colors.riskHigh,
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  rulesAlertText: {
    fontSize: 11.5,
    color: Colors.riskHigh,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  symptomCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  symptomCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  symptomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  symptomWeight: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipSevere: {
    backgroundColor: Colors.riskHighBg,
    borderColor: Colors.riskHigh,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  chipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  chipTextSevere: {
    color: Colors.riskHigh,
    fontWeight: '800',
  },
  extraPillSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    gap: 8,
  },
  pillGroup: {
    gap: 4,
  },
  subPillLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft,
  },
  selectPillBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  selectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  selectPillTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  // ── Sub-detail box (engine-specific qualifiers inside a symptom card) ──
  subDetailBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    gap: 6,
  },
  subDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  // ── Count chips (0-5 selector) ──
  countChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  countChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  countChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSoft,
  },
  countChipTextActive: {
    color: Colors.primaryDark,
  },
  ppCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  ppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 12,
    lineHeight: 18,
  },
  ppCodeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ppLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
    lineHeight: 18,
  },
  ppDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginVertical: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    gap: 10,
  },
  recItemUrgent: {
    backgroundColor: Colors.riskHighBg,
    borderWidth: 1,
    borderColor: Colors.riskHigh,
  },
  recCategory: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  recText: {
    fontSize: 12.5,
    color: Colors.text,
    flex: 1,
    fontWeight: '600',
  },
  recTextUrgent: {
    color: Colors.riskHigh,
    fontWeight: '700',
  },
  modalDoneBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalDoneBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Tab Switcher Styles ──
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginBottom: 16,
    gap: 6,
  },
  topTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6,
  },
  topTabBtnActive: {
    backgroundColor: Colors.primaryDark,
  },
  topTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  topTabTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  tabIntroBox: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  tabIntroTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  tabIntroDesc: {
    fontSize: 12,
    color: Colors.textSoft,
    lineHeight: 17,
  },

  // Sub-detail specifics in Tab 1
  subDetailContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  subDetailHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  subDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  checkboxItemActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryLight + '20',
  },
  checkboxLabel: {
    fontSize: 12,
    color: Colors.textSoft,
    fontWeight: '600',
  },
  checkboxLabelActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },

  // Hospital Banner Card
  hospitalHeaderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginBottom: 14,
    alignItems: 'center',
  },
  hospitalTopBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  hospitalRepublicText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hospitalDocCode: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  hospitalName: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primaryDark,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  hospitalCity: {
    fontSize: 11,
    color: Colors.textSoft,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  hospitalDivider: {
    height: 1,
    width: '80%',
    backgroundColor: Colors.primaryLight,
    marginVertical: 8,
  },
  hospitalFormTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },

  // Coopland Live Score Card
  cooplandScoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.textSoft,
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: Colors.primaryDark,
    lineHeight: 38,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  riskBadgeLow: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  riskBadgeHigh: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  riskBadgeSevere: {
    backgroundColor: Colors.riskHighBg,
    borderColor: Colors.riskHigh,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  riskBadgeTextLow: {
    color: '#059669',
  },
  riskBadgeTextHigh: {
    color: '#d97706',
  },
  riskBadgeTextSevere: {
    color: Colors.riskHigh,
  },
  thresholdGuideRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: 10,
  },
  thresholdItem: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  thresholdActive: {
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  thresholdDot: {
    color: Colors.border,
  },
  matchedFactorsBox: {
    marginTop: 4,
  },
  matchedFactorsTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 8,
  },
  factorChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    paddingLeft: 9,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  factorChipText: {
    fontSize: 11.5,
    color: Colors.text,
    fontWeight: '600',
  },
  factorPointsPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  factorPointsText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  noFactorsText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },

  // Coopland Section Cards
  cooplandSectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cooplandSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cooplandSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  cooplandItemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cooplandItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  cooplandItemSub: {
    fontSize: 11,
    color: Colors.textSoft,
    marginTop: 2,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  radioPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  radioPillActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryLight + '40',
  },
  radioPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textSoft,
  },
  radioPillTextActive: {
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  cooplandSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  labelWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  scorePointsBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    backgroundColor: Colors.primaryLight + '60',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  subCategoryHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
});
