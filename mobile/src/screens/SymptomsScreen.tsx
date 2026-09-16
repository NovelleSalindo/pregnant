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

  // Present Pregnancy Problems (PP) switches
  const [ppFactors, setPpFactors] = useState<Record<string, boolean>>({
    bleeding_lt_20wks: false,
    bleeding_gt_20wks: false,
    hypertension: false,
    prom: false,
    iugr: false,
    multiple_pregnancy: false,
    rh_isoimmunization: false,
  });

  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await api.getSymptomCatalog();
        setCatalog(res.catalog || []);
        if (res.history && res.history.length > 0) {
          setLastResult(res.history[0]);
        }
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
        duration: 'Today',
        frequency: 'Rare',
      }));

      const res = await api.submitSymptoms({
        symptoms: formattedSymptoms,
        pregnancy_problems: ppFactors,
      });

      setLastResult(res);
      Alert.alert(
        `Assessment Complete: ${res.level} Risk`,
        `Clinical Score: ${res.score}/100\n\n${res.recommendations?.[0]?.text || 'Review recommendations below.'}`
      );
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerEyebrow}>CLINICAL DECISION SUPPORT</Text>
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
      <Text style={styles.sectionHeader}>Select Current Symptoms</Text>
      {catalog.map((item) => {
        const currentSev = selectedSeverities[item.id] || 'None';
        const isSelected = currentSev !== 'None';

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
          </View>
        );
      })}

      {/* Present Pregnancy Conditions (PP Rules) */}
      <Text style={[styles.sectionHeader, { marginTop: 24 }]}>
        Present Pregnancy Conditions (PP Rules)
      </Text>
      <View style={[styles.ppCard, Shadows.card]}>
        {[
          { key: 'bleeding_lt_20wks', label: 'Vaginal bleeding before 20 weeks' },
          { key: 'bleeding_gt_20wks', label: 'Vaginal bleeding after 20 weeks' },
          { key: 'hypertension', label: 'Diagnosed gestational hypertension' },
          { key: 'prom', label: 'Premature rupture of membrane (PROM)' },
          { key: 'multiple_pregnancy', label: 'Multiple pregnancy (twins / triplets)' },
        ].map((item, idx, arr) => (
          <View
            key={item.key}
            style={[
              styles.ppRow,
              idx === arr.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <Text style={styles.ppLabel}>{item.label}</Text>
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
            <Text style={styles.submitBtnText}>Submit Clinical Assessment</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
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
    borderRadius: 16,
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
    marginBottom: 12,
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
  ppLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 10,
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
});
