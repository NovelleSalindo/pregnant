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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import { evaluateMaternalRisk, SymptomEntry } from '../services/riskEngine';
import { RiskGauge } from '../components/RiskGauge';

export const SymptomsScreen: React.FC = () => {
  const [catalog, setCatalog] = useState<any[]>([]);
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

  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await api.getSymptomCatalog();
        setCatalog(res.catalog || []);
      } catch (e: any) {
        console.warn('Error loading symptom catalog:', e.message);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formattedSymptoms = catalog.map((c) => ({
        id: c.id,
        severity: selectedSeverities[c.id] || 'None',
        duration: selectedDurations[c.id] || 'Today',
        frequency: selectedFrequencies[c.id] || 'Rare',
      }));

      const res = await api.submitSymptoms({
        symptoms: formattedSymptoms,
        pregnancy_problems: ppFactors,
      });

      setAssessmentResult(res);
      setShowResultModal(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Could not submit assessment.');
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
    { key: 'bleeding_lt_20wks', label: 'Vaginal bleeding before 20 weeks', cat: 'PP-01' },
    { key: 'bleeding_gt_20wks', label: 'Vaginal bleeding after 20 weeks', cat: 'PP-02' },
    { key: 'postmaturity_prematurity', label: 'Premature labor or post-term pregnancy', cat: 'PP-03' },
    { key: 'hypertension', label: 'Gestational hypertension (BP ≥ 140/90)', cat: 'PP-04' },
    { key: 'prom', label: 'Premature rupture of membrane (PROM)', cat: 'PP-05' },
    { key: 'poly_oligohydramnios', label: 'Amniotic fluid imbalance (Poly / Oligo)', cat: 'PP-06' },
    { key: 'iugr', label: 'Intrauterine growth restriction (IUGR)', cat: 'PP-07' },
    { key: 'multiple_pregnancy', label: 'Multiple pregnancy (twins / triplets)', cat: 'PP-08' },
    { key: 'breech_malpresentation', label: 'Breech or transverse fetal presentation', cat: 'PP-09' },
    { key: 'rh_isoimmunization', label: 'Rh negative isoimmunization', cat: 'PP-10' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerEyebrow}>STEP 1 OF THE CLINICAL RISK PIPELINE</Text>
        <Text style={styles.headerTitle}>Symptom Check-in</Text>
        <Text style={styles.headerSubtitle}>AHP + Fuzzy Inference + Clinical Safety Rule Engine</Text>
      </View>

      {/* Real-time Live Risk Preview Card */}
      <View style={[styles.liveCard, Shadows.card]}>
        <View style={styles.liveBadgeRow}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REAL-TIME RISK PREVIEW</Text>
          </View>
          <Text style={styles.calcNote}>Offline-ready</Text>
        </View>

        <View style={styles.gaugeContainer}>
          <RiskGauge score={liveRisk.score} level={liveRisk.level} size={170} />
        </View>

        {liveRisk.rules.length > 0 && (
          <View style={styles.rulesAlertBox}>
            <Ionicons name="warning" size={16} color={Colors.riskHigh} />
            <Text style={styles.rulesAlertText}>{liveRisk.rules[0].text}</Text>
          </View>
        )}
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
                <Text style={styles.symptomWeight}>
                  Clinical weight: {Math.round(item.weight * 100)}%
                </Text>
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
              </View>
            )}
          </View>
        );
      })}

      {/* Present Pregnancy Conditions (PP Rules 1:1 with symptoms.php) */}
      <Text style={[styles.sectionHeader, { marginTop: 24 }]}>
        Present Pregnancy Conditions (PP Rules)
      </Text>
      <View style={[styles.ppCard, Shadows.card]}>
        {ppRulesList.map((item, idx, arr) => (
          <View
            key={item.key}
            style={[
              styles.ppRow,
              idx === arr.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.ppCodeBadge}>{item.cat}</Text>
              <Text style={styles.ppLabel}>{item.label}</Text>
            </View>
            <Switch
              value={!!ppFactors[item.key]}
              onValueChange={() => togglePP(item.key)}
              trackColor={{ false: Colors.border, true: Colors.primaryDark }}
              thumbColor={Colors.white}
            />
          </View>
        ))}
      </View>

      {/* Submit Action Button (.btn-primary) */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
        style={{ marginTop: 6 }}
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

      {/* Clinical Assessment Breakdown Modal (1:1 with analyze.php & recommendations.php) */}
      <Modal visible={showResultModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.soft]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>CLINICAL ASSESSMENT COMPLETE</Text>
                <Text style={styles.modalTitle}>
                  {assessmentResult?.level || 'Low'} Risk Status
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
              <View style={styles.gaugeContainer}>
                <RiskGauge
                  score={assessmentResult?.score || 0}
                  level={assessmentResult?.level || 'Low'}
                  size={160}
                />
              </View>

              {/* Priority Recommendations */}
              <Text style={styles.modalSubHeader}>Personalized Recommendations</Text>
              {(assessmentResult?.recommendations || []).map((rec: any, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.recItem,
                    rec.urgent && styles.recItemUrgent,
                  ]}
                >
                  <Ionicons
                    name={rec.urgent ? 'alert-circle' : 'checkmark-circle'}
                    size={18}
                    color={rec.urgent ? Colors.riskHigh : Colors.primaryDark}
                  />
                  <Text style={[styles.recText, rec.urgent && styles.recTextUrgent]}>
                    {rec.text}
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                onPress={() => setShowResultModal(false)}
                style={styles.modalDoneBtn}
              >
                <Text style={styles.modalDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
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
  ppCodeBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  ppLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 1,
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
});
