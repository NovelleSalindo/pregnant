import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import { RiskGauge } from '../components/RiskGauge';

interface AnalyzeScreenProps {
  onNavigate: (tab: string) => void;
}

export const AnalyzeScreen: React.FC<AnalyzeScreenProps> = ({ onNavigate }) => {
  const [activeSubTab, setActiveSubTab] = useState<'breakdown' | 'recommendations'>('breakdown');
  const [history, setHistory] = useState<any[]>([]);
  const [coopland, setCoopland] = useState<any>(null);
  const [cooplandHistory, setCooplandHistory] = useState<any[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [localResolved, setLocalResolved] = useState<any>(null);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const savedVisit = await AsyncStorage.getItem('@pregnacare_resolved_visit');
        if (savedVisit) {
          try {
            setLocalResolved(JSON.parse(savedVisit));
          } catch {}
        }
        
        // Fetch history, coopland & clinical alerts
        const res = await api.getSymptomCatalog();
        setHistory(res.history || []);
        if (res.coopland) setCoopland(res.coopland);
        if (res.coopland_history) setCooplandHistory(res.coopland_history);
        if (res.clinical_alerts) setClinicalAlerts(res.clinical_alerts);

        // Check for local latest Coopland assessment
        try {
          const localCoopStr = await AsyncStorage.getItem('@pregnacare_latest_coopland');
          if (localCoopStr) {
            const localCoop = JSON.parse(localCoopStr);
            if (localCoop && localCoop.score !== undefined) {
              const localRecord = {
                id: 'local-latest',
                score: localCoop.score,
                risk_level: localCoop.level,
                date: localCoop.date || new Date().toISOString(),
                factors_json: JSON.stringify(localCoop.factors || []),
              };
              setCoopland({
                coopland_score: localCoop.score,
                coopland_risk: localCoop.level,
                date: localRecord.date,
                contributing_factors: localCoop.factors || [],
                factors: localCoop.factors || [],
              });
              setCooplandHistory((prev: any[]) => {
                const filtered = (prev || []).filter(p => p.id !== 'local-latest');
                return [localRecord, ...filtered];
              });
            }
          }
        } catch {}
      } catch (e: any) {
        console.warn('Error loading assessment history:', e.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Loading risk analysis & breakdown...</Text>
      </View>
    );
  }

  const current = history[0] || null;
  const previous = history[1] || null;

  const isCurrentResolved = (current?.status === 'resolved') || (current?.isResolved === true) || (localResolved !== null);

  const urgentRecs = (current?.recommendations || []).filter((r: any) => !!r.urgent);
  const generalRecs = (current?.recommendations || []).filter((r: any) => !r.urgent);

  // Score delta calculation matching analyze.php delta_badge()
  const scoreDiff = (current && previous) ? (current.score - previous.score) : 0;
  const improved = scoreDiff < 0;

  const hotlines = [
    { name: 'OB-GYN On-Call Line', number: '', icon: 'medkit' },
  ];

  const callNumber = (num: string) => {
    Linking.openURL(`tel:${num.replace(/[^0-9]/g, '')}`);
  };

  const formatSymptomName = (id?: string) => {
    if (!id) return '';
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Active Coopland Assessment computation (definitive classifier for maternal risk)
  const activeCoopRecord = cooplandHistory[0] || (coopland ? {
    score: coopland.coopland_score ?? 0,
    risk_level: coopland.coopland_risk ?? 'Low',
    date: coopland.date ?? '',
    factors_json: JSON.stringify(coopland.contributing_factors || coopland.factors || []),
  } : null);

  const prevCoopRecord = cooplandHistory[1] || null;

  const rawCoopScore: number = activeCoopRecord ? (activeCoopRecord.score ?? coopland?.coopland_score ?? 0) : (coopland?.coopland_score ?? 0);
  const rawCoopRiskLvl: string = activeCoopRecord ? (activeCoopRecord.risk_level ?? coopland?.coopland_risk ?? 'Low') : (coopland?.coopland_risk ?? 'Low');
  const coopLevel: 'Low' | 'High' | 'Severe' = (rawCoopRiskLvl.charAt(0).toUpperCase() + rawCoopRiskLvl.slice(1).toLowerCase()) as any;
  const isSevereCoop = coopLevel === 'Severe';
  const isHighCoop = coopLevel === 'High';
  const isLowCoop = !isSevereCoop && !isHighCoop;

  const coopColor = isSevereCoop ? '#DC2626' : (isHighCoop ? '#D97706' : '#15803D');
  const coopBgColor = isSevereCoop ? '#FEF2F2' : (isHighCoop ? '#FFFBEB' : '#F0FDF4');
  const coopBorderColor = isSevereCoop ? '#FCA5A5' : (isHighCoop ? '#FCD34D' : '#BBF7D0');
  const coopTextColor = isSevereCoop ? '#991B1B' : (isHighCoop ? '#92400E' : '#166534');

  // Contributing factors extraction
  const rawFactorsList: string[] = (() => {
    if (activeCoopRecord?.factors_json) {
      try {
        const parsed = typeof activeCoopRecord.factors_json === 'string' ? JSON.parse(activeCoopRecord.factors_json) : activeCoopRecord.factors_json;
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    if (Array.isArray(coopland?.contributing_factors)) return coopland.contributing_factors;
    if (Array.isArray(coopland?.factors)) return coopland.factors;
    return [];
  })();

  const reproductiveFactors: { label: string; points: number }[] = [];
  const medicalFactors: { label: string; points: number }[] = [];
  const presentPregnancyFactors: { label: string; points: number }[] = [];

  rawFactorsList.forEach((fStr) => {
    const pointsMatch = fStr.match(/\(\+(\d+)\)/);
    const points = pointsMatch ? parseInt(pointsMatch[1], 10) : 1;
    const cleanLabel = fStr.replace(/\s*\(\+\d+\)/, '').trim();
    const fl = fStr.toLowerCase();

    if (
      fl.includes('age') ||
      fl.includes('parity') ||
      fl.includes('abortion') ||
      fl.includes('infertility') ||
      fl.includes('postpartum') ||
      fl.includes('placenta') ||
      fl.includes('baby >') ||
      fl.includes('toxemia') ||
      fl.includes('cesarean') ||
      fl.includes('labor')
    ) {
      reproductiveFactors.push({ label: cleanLabel, points });
    } else if (
      fl.includes('gynecologic') ||
      fl.includes('renal') ||
      fl.includes('diabetes') ||
      fl.includes('cardiac') ||
      fl.includes('asthma') ||
      fl.includes('tuberculosis') ||
      fl.includes('pulmonary') ||
      fl.includes('thyroid') ||
      fl.includes('epilepsy') ||
      fl.includes('torch') ||
      fl.includes('uti') ||
      fl.includes('pyelonephritis')
    ) {
      medicalFactors.push({ label: cleanLabel, points });
    } else {
      presentPregnancyFactors.push({ label: cleanLabel, points });
    }
  });

  const totalFactorsCount = reproductiveFactors.length + medicalFactors.length + presentPregnancyFactors.length;

  const cooplandRecommendations = coopLevel === 'Severe'
    ? [
        `Severe High-Risk maternal profile identified (Coopland Score: ${rawCoopScore} ≥ 7).`,
        'Urgent consultation and physical evaluation by an obstetrician at a tertiary hospital facility is strongly advised.',
        'Continuous maternal-fetal monitoring and specialized delivery planning are required.',
      ]
    : coopLevel === 'High'
    ? [
        `High Risk maternal profile identified (Coopland Score: ${rawCoopScore}).`,
        'Schedule an OB-GYN checkup within 24 to 48 hours for clinical evaluation.',
        'More frequent prenatal visits, targeted laboratory tests, and ultrasound screenings recommended.',
        'Closely monitor blood pressure, blood glucose, and daily fetal movements.',
      ]
    : [
        `Low Risk maternal profile identified (Coopland Score: ${rawCoopScore} ≤ 2).`,
        'Maintain routine prenatal visit schedule (monthly until 28 wks, every 2 wks until 36 wks, weekly after).',
        'Continue daily prenatal vitamins, iron, and folic acid supplements.',
        'Drink plenty of water and rest when tired. Continue logging daily vitals and symptoms.',
      ];

  const handleOpenBreakdown = () => {
    const breakdownPayload = {
      date: activeCoopRecord?.date || current?.date || new Date().toISOString().replace('T', ' ').slice(0, 19),
      score: rawCoopScore,
      coopland_score: rawCoopScore,
      level: coopLevel,
      logged_symptoms: current?.logged_symptoms || [],
      pregnancy_problems: current?.pregnancy_problems || [],
      rules: rawFactorsList.length > 0
        ? rawFactorsList.map((f) => `Detected risk factor: ${f}`)
        : ['No symptoms, vitals in range → Low Risk supported'],
      recommendations: cooplandRecommendations.map((text) => ({ text })),
    };
    setSelectedHistory(breakdownPayload);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
      {/* Segmented Switch */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeSubTab === 'breakdown' && styles.tabBtnActive]}
          onPress={() => setActiveSubTab('breakdown')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="analytics-outline"
            size={16}
            color={activeSubTab === 'breakdown' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeSubTab === 'breakdown' && styles.tabTextActive]}>
            Factor Analysis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeSubTab === 'recommendations' && styles.tabBtnActive]}
          onPress={() => setActiveSubTab('recommendations')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="list-circle-outline"
            size={16}
            color={activeSubTab === 'recommendations' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeSubTab === 'recommendations' && styles.tabTextActive]}>
            Recommendations
          </Text>
        </TouchableOpacity>
      </View>

      {!current && !coopland ? (
        <View style={[styles.card, Shadows.card, styles.emptyCard]}>
          <Ionicons name="analytics-outline" size={40} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>No Assessments Yet</Text>
          <Text style={styles.emptyDesc}>
            Complete your first risk assessment to see your clinical Coopland risk breakdown and recommendations.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => onNavigate('symptoms')}
          >
            <Text style={styles.emptyBtnText}>Start Risk Assessment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* --- SUBTAB 1: FACTOR BREAKDOWN & COMPARISON --- */}
          {activeSubTab === 'breakdown' && (
            <View>
              {/* Hospital Standard Banner */}
              <View style={[styles.card, Shadows.card, { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.primaryLight, marginTop: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8 }}>
                    REPUBLIC OF THE PHILIPPINES
                  </Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '700', color: Colors.primaryDark }}>
                    MD08-FM-011/Rev.0/5Jul2023
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, textTransform: 'uppercase' }}>
                  Mayor Hilarion A. Ramiro Sr. Medical Center
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textSoft, marginBottom: 12 }}>
                  Ozamiz City • Department of OB-GYN
                </Text>

                <LinearGradient
                  colors={[Colors.primaryLight, Colors.surface]}
                  style={{ marginHorizontal: -16, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.primaryLight, alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 15, letterSpacing: 0.8, color: Colors.primaryDark }}>
                    HIGH RISK EVALUATION (COOPLAND)
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textSoft, marginTop: 2 }}>
                    Standardized Maternal Risk Factor Classification
                  </Text>
                </LinearGradient>

                {/* Score & Risk Badge Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 14 }}>
                  <View style={{ flex: 1, backgroundColor: Colors.backgroundSoft, padding: 14, borderRadius: 14, marginRight: 8 }}>
                    <Text style={{ fontWeight: '800', fontSize: 11, color: Colors.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>
                      Coopland Score
                    </Text>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: Colors.primaryDark }}>
                      {rawCoopScore}
                    </Text>
                  </View>
                  <View style={{ flex: 1.2, backgroundColor: Colors.backgroundSoft, padding: 14, borderRadius: 14, marginLeft: 8 }}>
                    <Text style={{ fontWeight: '800', fontSize: 11, color: Colors.textSoft, marginBottom: 4, textTransform: 'uppercase' }}>
                      Risk Level
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleOpenBreakdown}
                      style={[
                        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
                        coopLevel === 'Severe' && { backgroundColor: Colors.riskHighBg },
                        coopLevel === 'High' && { backgroundColor: Colors.riskModBg },
                        coopLevel === 'Low' && { backgroundColor: Colors.riskLowBg },
                      ]}
                    >
                      <Ionicons
                        name={coopLevel === 'Severe' ? 'alert-circle' : (coopLevel === 'High' ? 'warning' : 'shield-checkmark')}
                        size={16}
                        color={coopLevel === 'Severe' ? Colors.riskHigh : (coopLevel === 'High' ? '#d97706' : '#059669')}
                      />
                      <Text
                        style={[
                          { fontSize: 13, fontWeight: '800' },
                          coopLevel === 'Severe' && { color: Colors.riskHigh },
                          coopLevel === 'High' && { color: '#d97706' },
                          coopLevel === 'Low' && { color: '#059669' },
                        ]}
                      >
                        {coopLevel.toUpperCase()} RISK
                      </Text>
                      <Ionicons name="information-circle-outline" size={14} color={coopLevel === 'Low' ? '#059669' : (coopLevel === 'High' ? '#d97706' : Colors.riskHigh)} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Coopland Criteria Guide */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.backgroundSoft, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginBottom: 14 }}>
                  <Text style={[{ fontSize: 11.5, fontWeight: '600', color: Colors.textMuted }, coopLevel === 'Low' && { color: '#059669', fontWeight: '800' }]}>
                    Low: 0–2
                  </Text>
                  <Text style={{ fontSize: 11.5, color: Colors.border }}>•</Text>
                  <Text style={[{ fontSize: 11.5, fontWeight: '600', color: Colors.textMuted }, coopLevel === 'High' && { color: '#d97706', fontWeight: '800' }]}>
                    High: 3–6
                  </Text>
                  <Text style={{ fontSize: 11.5, color: Colors.border }}>•</Text>
                  <Text style={[{ fontSize: 11.5, fontWeight: '600', color: Colors.textMuted }, coopLevel === 'Severe' && { color: Colors.riskHigh, fontWeight: '800' }]}>
                    Severe: ≥ 7
                  </Text>
                </View>

                {/* ── COOPLAND CONTRIBUTING FACTOR BREAKDOWN ── */}
                <Text style={{ fontWeight: '800', fontSize: 13, color: Colors.textSoft, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Contributing Risk Factors ({totalFactorsCount})
                </Text>

                {/* Reproductive History Factors */}
                {reproductiveFactors.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="calendar-outline" size={15} color={Colors.primaryDark} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primaryDark, textTransform: 'uppercase' }}>
                        Reproductive History
                      </Text>
                    </View>
                    {reproductiveFactors.map((f, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundSoft, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: Colors.borderSoft }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 }}>
                          {f.label}
                        </Text>
                        <View style={{ backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primaryDark }}>
                            +{f.points}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Associated Medical & Surgical Conditions */}
                {medicalFactors.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="medkit-outline" size={15} color={Colors.primaryDark} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primaryDark, textTransform: 'uppercase' }}>
                        Medical / Surgical Conditions
                      </Text>
                    </View>
                    {medicalFactors.map((f, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundSoft, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: Colors.borderSoft }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 }}>
                          {f.label}
                        </Text>
                        <View style={{ backgroundColor: f.points >= 3 ? '#fee2e2' : Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: f.points >= 3 ? '#dc2626' : Colors.primaryDark }}>
                            +{f.points}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Present Pregnancy Problems */}
                {presentPregnancyFactors.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="heart-outline" size={15} color={Colors.primaryDark} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primaryDark, textTransform: 'uppercase' }}>
                        Present Pregnancy Conditions
                      </Text>
                    </View>
                    {presentPregnancyFactors.map((f, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundSoft, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: Colors.borderSoft }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 }}>
                          {f.label}
                        </Text>
                        <View style={{ backgroundColor: f.points >= 3 ? '#fee2e2' : Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: f.points >= 3 ? '#dc2626' : Colors.primaryDark }}>
                            +{f.points}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* No Factors Detected */}
                {totalFactorsCount === 0 && (
                  <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="shield-checkmark" size={18} color="#15803D" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803D' }}>
                        No High-Risk Factors Identified
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#166534', marginTop: 4, lineHeight: 17 }}>
                      Your reproductive history, medical profile, and present pregnancy meet the criteria for baseline Low Risk routine prenatal care.
                    </Text>
                  </View>
                )}

                {/* ── CLINICAL RATIONALE: WHY THIS RESULTED IN THIS LEVEL ── */}
                <View
                  style={[
                    styles.whyCard,
                    coopLevel === 'Severe' && { backgroundColor: Colors.riskHighBg, borderColor: Colors.riskHigh },
                    coopLevel === 'High' && { backgroundColor: Colors.riskModBg, borderColor: Colors.riskMod },
                    coopLevel === 'Low' && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons
                      name={coopLevel === 'Severe' ? 'alert-circle' : (coopLevel === 'High' ? 'warning' : 'shield-checkmark')}
                      size={18}
                      color={coopLevel === 'Severe' ? Colors.riskHigh : (coopLevel === 'High' ? '#b45309' : '#15803D')}
                    />
                    <Text
                      style={[
                        styles.whyTitle,
                        coopLevel === 'Severe' && { color: Colors.riskHigh },
                        coopLevel === 'High' && { color: '#b45309' },
                        coopLevel === 'Low' && { color: '#15803D' },
                      ]}
                    >
                      Why this resulted in {coopLevel} Risk
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.whyText,
                      coopLevel === 'Severe' && { color: '#991b1b' },
                      coopLevel === 'High' && { color: '#92400e' },
                      coopLevel === 'Low' && { color: '#166534' },
                    ]}
                  >
                    {coopLevel === 'Severe'
                      ? `• Your accumulated Coopland score is ${rawCoopScore} (Score ≥ 7 points).\n• In clinical obstetrics, scores in this tier carry high risk of antepartum complications.\n• Tertiary medical facility evaluation and OB-GYN specialist consultation are required immediately.`
                      : coopLevel === 'High'
                      ? `• Your accumulated Coopland score is ${rawCoopScore} (Score 3 to 6 points).\n• High-risk factors were detected that require increased prenatal surveillance.\n• Please schedule an OB-GYN checkup within 24 to 48 hours for clinical evaluation.`
                      : `• Your accumulated Coopland score is ${rawCoopScore} (Score 0 to 2 points).\n• No critical high-risk indicators were detected in your clinical profile.\n• Standard routine outpatient prenatal care and monthly visits are recommended.`}
                  </Text>
                </View>

                {/* ── CLINICAL RECOMMENDATIONS ── */}
                <View
                  style={{
                    backgroundColor: coopBgColor,
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: coopBorderColor,
                    marginBottom: 14,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 12,
                      color: coopColor,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    Obstetric Care Guidance {isSevereCoop ? '— Severe Risk' : (isHighCoop ? '— High Risk' : '')}
                  </Text>
                  {cooplandRecommendations.map((rec, rIdx) => (
                    <Text
                      key={rIdx}
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: coopTextColor,
                        lineHeight: 19,
                        marginBottom: 4,
                      }}
                    >
                      • {rec}
                    </Text>
                  ))}
                </View>

                {/* Update Coopland Risk Button */}
                <TouchableOpacity
                  style={[
                    styles.viewSymptomDetailsBtn,
                    { backgroundColor: isSevereCoop ? '#DC2626' : (isHighCoop ? '#D97706' : Colors.primaryDark), marginTop: 4 },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onNavigate('symptoms')}
                >
                  <Ionicons name="clipboard-outline" size={17} color="#FFF" />
                  <Text style={styles.viewSymptomDetailsBtnText}>
                    Update Assess Risk (Coopland Form)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Attended & Archived Banner */}
              {isCurrentResolved && (
                <View style={[styles.card, Shadows.card, { backgroundColor: '#FFF5F8', borderColor: '#F8B4C8', borderWidth: 1, marginTop: 12, padding: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="shield-checkmark" size={26} color="#C2577D" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#A83863' }}>
                        Medical Visit Recorded &amp; Stored in History
                      </Text>
                      <Text style={{ fontSize: 12, color: '#6B5C63', marginTop: 2 }}>
                        {localResolved?.facility ? `Clinic: ${localResolved.facility}` : 'Hospital / Clinic visit logged.'} This severe alert has been safely archived in your records.
                      </Text>
                      {localResolved?.notes ? (
                        <Text style={{ fontSize: 11.5, color: '#9B2C52', fontStyle: 'italic', marginTop: 3 }}>
                          Doctor Advice: "{localResolved.notes}"
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      backgroundColor: '#C2577D',
                      paddingVertical: 10,
                      borderRadius: 11,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={() => onNavigate('symptoms')}
                  >
                    <Ionicons name="add-circle" size={17} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Start New Risk Assessment</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Comparison Gauges (Current vs Previous Coopland Assessment) */}
              <View style={styles.compareRow}>
                <TouchableOpacity
                  style={[
                    styles.compareCard,
                    Shadows.card,
                    isSevereCoop && { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
                    isHighCoop && { borderColor: '#FCD34D', backgroundColor: '#FFFDF5' },
                  ]}
                  activeOpacity={0.8}
                  onPress={handleOpenBreakdown}
                >
                  <Text style={[styles.compareLabel, { color: coopColor }]}>CURRENT COOPLAND</Text>
                  <RiskGauge
                    score={rawCoopScore}
                    level={coopLevel}
                    size={140}
                    cooplandScore={rawCoopScore}
                  />
                  <Text style={styles.compareDate}>
                    {activeCoopRecord?.date ? activeCoopRecord.date.split(' ')[0] : 'Current'}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: coopColor, marginTop: 4 }}>
                    Score: {rawCoopScore}
                  </Text>
                  <View style={[styles.tapToViewBadge, { backgroundColor: isSevereCoop ? '#FEE2E2' : (isHighCoop ? '#FEF3C7' : '#DCFCE7') }]}>
                    <Text style={[styles.tapToViewText, { color: coopColor }]}>Tap for breakdown</Text>
                    <Ionicons name="chevron-forward" size={11} color={coopColor} />
                  </View>
                </TouchableOpacity>

                {prevCoopRecord ? (
                  <View style={[styles.compareCard, Shadows.card]}>
                    <Text style={styles.compareLabel}>PREVIOUS COOPLAND</Text>
                    <RiskGauge
                      score={prevCoopRecord.score}
                      level={prevCoopRecord.risk_level}
                      size={140}
                      cooplandScore={prevCoopRecord.score}
                    />
                    <Text style={styles.compareDate}>
                      {prevCoopRecord.date ? prevCoopRecord.date.split(' ')[0] : ''}
                    </Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: Colors.primaryDark, marginTop: 4 }}>
                      Score: {prevCoopRecord.score}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.compareCard, Shadows.card, { justifyContent: 'center', opacity: 0.8 }]}>
                    <Ionicons name="time-outline" size={32} color={Colors.primaryDark} />
                    <Text style={[styles.compareLabel, { marginTop: 6 }]}>NO PREVIOUS</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 6 }}>
                      Previous Coopland evaluation will appear here after your next check-in.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* --- SUBTAB 2: FULL RECOMMENDATIONS & EMERGENCY CONTACTS --- */}
          {activeSubTab === 'recommendations' && (
            <View>
              {/* Urgent Action Banner */}
              {!isCurrentResolved && coopLevel !== 'Low' && urgentRecs.length > 0 && (
                <View style={[styles.card, Shadows.card, { borderColor: Colors.riskHigh }]}>
                  <View style={styles.urgentHeader}>
                    <Ionicons name="warning" size={20} color={Colors.riskHigh} />
                    <Text style={styles.urgentTitle}>Urgent — Act On These First</Text>
                  </View>
                  {urgentRecs.map((r: any, idx: number) => (
                    <View key={idx} style={styles.urgentItem}>
                      <Ionicons name="alert-circle" size={18} color={Colors.riskHigh} />
                      <Text style={styles.urgentItemText}>{r.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* General Care Recommendations */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardEyebrow}>DAILY CLINICAL CARE</Text>
                <Text style={styles.cardSectionTitle}>Personalized Guidance</Text>
                {cooplandRecommendations.length > 0 ? (
                  cooplandRecommendations.map((recText: string, idx: number) => (
                    <View key={idx} style={styles.recRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
                      <Text style={styles.recRowText}>{recText}</Text>
                    </View>
                  ))
                ) : generalRecs.length > 0 ? (
                  generalRecs.map((r: any, idx: number) => (
                    <View key={idx} style={styles.recRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
                      <Text style={styles.recRowText}>{r.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyFactorsText}>No general recommendations logged.</Text>
                )}
              </View>

              {/* Emergency Contacts Hotlines (EMERGENCY_HOTLINES in base.php) */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardEyebrow}>EMERGENCY CONTACTS</Text>
                <Text style={styles.cardSectionTitle}>Quick Dial Hotlines</Text>
                {hotlines.map((h, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.hotlineRow}
                    onPress={() => callNumber(h.number)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.hotlineIcon}>
                      <Ionicons name={h.icon as any} size={18} color={Colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hotlineName}>{h.name}</Text>
                      <Text style={styles.hotlineNumber}>{h.number}</Text>
                    </View>
                    <Ionicons name="call" size={18} color={Colors.primaryDark} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Historical Timeline */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardEyebrow}>RECOMMENDATION TIMELINE</Text>
                <Text style={styles.cardSectionTitle}>Past Check-in Assessments</Text>
                {history.slice(0, 5).map((h: any, idx: number) => (
                  <View key={h.id || idx} style={styles.timelineItem}>
                    <View style={[styles.timelineScoreBadge, { backgroundColor: h.level === 'Severe' ? Colors.riskHighBg : (h.level === 'High' ? Colors.riskModBg : Colors.riskLowBg) }]}>
                      <Ionicons
                        name={h.level === 'Severe' ? 'alert-circle' : (h.level === 'High' ? 'warning' : 'checkmark-circle')}
                        size={18}
                        color={h.level === 'Severe' ? Colors.riskHigh : (h.level === 'High' ? Colors.riskMod : Colors.riskLow)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineLevel}>{h.level} Risk</Text>
                        <Text style={styles.timelineDate}>{h.date}</Text>
                      </View>
                      <Text style={styles.timelineExcerpt} numberOfLines={2}>
                        {h.recommendations?.[0]?.text || 'No recommendation noted'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
      </ScrollView>

      {/* Symptoms Breakdown Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Assessment Breakdown</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedHistory?.date ? `Check-in: ${selectedHistory.date}` : 'Assessment Details'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Overall Risk Level Summary Card */}
              {(() => {
                const rawLvl = (selectedHistory?.level || 'Low').toLowerCase();
                const isLow = rawLvl === 'low';
                const isHigh = rawLvl === 'high';
                const isSevere = rawLvl === 'severe';

                const bannerBg = isSevere ? Colors.riskHighBg : (isHigh ? Colors.riskModBg : Colors.riskLowBg);
                const bannerBorder = isSevere ? Colors.riskHigh : (isHigh ? Colors.riskMod : Colors.riskLow);
                const bannerTextColor = isSevere ? Colors.riskHigh : (isHigh ? '#B45309' : '#15803D');

                return (
                  <View style={[styles.resultSummaryBanner, { backgroundColor: bannerBg, borderColor: bannerBorder, borderWidth: 1 }]}>
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: bannerTextColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Resulting Clinical Level
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: bannerTextColor, marginTop: 2 }}>
                        {(selectedHistory?.level || 'LOW').toUpperCase()} RISK
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: bannerTextColor }}>Overall Score</Text>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: bannerTextColor, marginTop: 2 }}>
                        {selectedHistory?.coopland_score !== undefined
                          ? selectedHistory.coopland_score
                          : (typeof selectedHistory?.score === 'number' && selectedHistory.score <= 15
                              ? selectedHistory.score
                              : rawCoopScore)}
                        <Text style={{ fontSize: 13, fontWeight: '600' }}> / 8</Text>
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* WHY THIS RESULTED IN THIS RISK LEVEL */}
              {(() => {
                const rawLvl = (selectedHistory?.level || 'Low').toLowerCase();
                const isLow = rawLvl === 'low';
                const isHigh = rawLvl === 'high';

                if (isLow) {
                  return (
                    <View style={[styles.whyCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="shield-checkmark" size={19} color="#15803D" />
                        <Text style={[styles.whyTitle, { color: '#15803D' }]}>Why this resulted in Low Risk</Text>
                      </View>
                      <Text style={[styles.whyText, { color: '#166534' }]}>
                        • All symptoms you selected are mild or within routine, manageable limits.{'\n'}
                        • No critical emergency red-flag triggers (such as vaginal bleeding, fluid leakage, severe headache, convulsions, or severe abdominal pain) were detected.{'\n'}
                        • Coopland high-risk score is in the safe baseline range, meaning you qualify for routine prenatal monitoring.
                      </Text>
                    </View>
                  );
                } else if (isHigh) {
                  return (
                    <View style={[styles.whyCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="warning" size={19} color="#B45309" />
                        <Text style={[styles.whyTitle, { color: '#B45309' }]}>Why this resulted in High Risk</Text>
                      </View>
                      <Text style={[styles.whyText, { color: '#92400E' }]}>
                        • Moderate or persistent symptoms were reported that require prompt medical review.{'\n'}
                        • Elevated Coopland risk factors or clinical alerts were detected above normal baseline levels.
                      </Text>
                    </View>
                  );
                } else {
                  return (
                    <View style={[styles.whyCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="alert-circle" size={19} color="#DC2626" />
                        <Text style={[styles.whyTitle, { color: '#DC2626' }]}>Why this resulted in Severe Risk</Text>
                      </View>
                      <Text style={[styles.whyText, { color: '#991B1B' }]}>
                        • Acute clinical warning flags or critical Coopland risk indicators were detected.{'\n'}
                        • Immediate OB-GYN or emergency clinical consultation is advised.
                      </Text>
                    </View>
                  );
                }
              })()}

              {/* SYMPTOMS YOU CHOSE */}
              <Text style={styles.sectionHeading}>Symptoms You Chose</Text>
              {selectedHistory?.logged_symptoms && selectedHistory.logged_symptoms.length > 0 ? (
                selectedHistory.logged_symptoms.map((item: any, idx: number) => {
                  const sev = item.severity || 'Mild';
                  const isSevSevere = sev === 'Severe';
                  const isSevMod = sev === 'Moderate';
                  const badgeBg = isSevSevere ? Colors.riskHighBg : (isSevMod ? Colors.riskModBg : '#DCFCE7');
                  const badgeText = isSevSevere ? Colors.riskHigh : (isSevMod ? '#B45309' : '#15803D');

                  return (
                    <View key={idx} style={styles.symptomItemCard}>
                      <View style={styles.symptomItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Ionicons name="medical" size={16} color={Colors.primaryDark} />
                          <Text style={styles.symptomItemName}>
                            {item.name || formatSymptomName(item.id)}
                          </Text>
                        </View>
                        <View style={[styles.symptomSeverityBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.symptomSeverityText, { color: badgeText }]}>
                            {sev}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.symptomItemDetails}>
                        Duration: {item.duration || 'Recent'} • Frequency: {item.frequency || 'Occasional'}
                      </Text>
                      {sev === 'Mild' && (
                        <Text style={styles.symptomHelpNote}>
                          ✓ Mild intensity — manageable via routine prenatal hydration & rest.
                        </Text>
                      )}
                    </View>
                  );
                })
              ) : (
                <View style={[styles.symptomItemCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-done-circle" size={22} color="#15803D" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.symptomItemName, { color: '#15803D' }]}>
                        No Adverse Symptoms Logged
                      </Text>
                      <Text style={[styles.symptomItemDetails, { color: '#166534', marginTop: 2 }]}>
                        You reported feeling well without adverse symptoms for this assessment, keeping your risk score in the Low Risk category.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* PRESENT PREGNANCY FACTORS IF ANY */}
              {selectedHistory?.pregnancy_problems && selectedHistory.pregnancy_problems.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.sectionHeading}>Present Pregnancy Factors</Text>
                  <View style={[styles.symptomItemCard, { borderColor: Colors.riskMod }]}>
                    {selectedHistory.pregnancy_problems.map((prob: string, pIdx: number) => (
                      <Text key={pIdx} style={{ fontSize: 13, color: Colors.text, marginBottom: 4, fontWeight: '600' }}>
                        • {prob}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* CONTRIBUTING CLINICAL FACTORS */}
              {((selectedHistory?.rules && selectedHistory.rules.length > 0) || (selectedHistory?.main_contributors && selectedHistory.main_contributors.length > 0)) && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.sectionHeading}>Clinical Contributor Notes</Text>
                  <View style={[styles.symptomItemCard, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
                    {(selectedHistory?.rules || selectedHistory?.main_contributors).map((rule: any, rIdx: number) => (
                      <View key={rIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="information-circle" size={16} color={Colors.primaryDark} style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12.5, color: Colors.text, flex: 1, lineHeight: 18 }}>
                          {typeof rule === 'string' ? rule : (rule.text || rule.label || '')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* PERSONALIZED RECOMMENDATION */}
              {selectedHistory?.recommendations && selectedHistory.recommendations.length > 0 && (
                <View style={{ marginTop: 10, marginBottom: 8 }}>
                  <Text style={styles.sectionHeading}>Personalized Guidance</Text>
                  <View style={[styles.symptomItemCard, { backgroundColor: Colors.primaryLight + '35', borderColor: Colors.primaryLight }]}>
                    <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 19 }}>
                      {typeof selectedHistory.recommendations[0] === 'string'
                        ? selectedHistory.recommendations[0]
                        : (selectedHistory.recommendations[0]?.text || '')}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.modalCloseActionBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseActionBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.88)',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroDate: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 4,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  compareCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  compareLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  compareDate: {
    fontSize: 11,
    color: Colors.textSoft,
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  deltaEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  deltaValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  deltaDesc: {
    fontSize: 12,
    color: Colors.textSoft,
    fontWeight: '500',
  },
  cardEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
    marginBottom: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  factorBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  factorBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  factorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  factorSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  emptyFactors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  emptyFactorsText: {
    fontSize: 12.5,
    color: Colors.textSoft,
    flex: 1,
    fontWeight: '500',
  },
  ruleAlertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.riskHighBg,
    padding: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  ruleAlertText: {
    fontSize: 12.5,
    color: Colors.riskHigh,
    fontWeight: '700',
    flex: 1,
  },
  urgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.riskHigh,
  },
  urgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.riskHighBg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  urgentItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.riskHigh,
    flex: 1,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  recRowText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
    flex: 1,
  },
  hotlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  hotlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  hotlineNumber: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  timelineScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineScoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLevel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  timelineDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  timelineExcerpt: {
    fontSize: 12,
    color: Colors.textSoft,
    marginTop: 3,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  emptyBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  tapToViewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: Colors.primaryLight + '40',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tapToViewText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  viewSymptomDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 14,
  },
  viewSymptomDetailsBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginBottom: 10,
  },
  resultSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  whyCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  whyTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  whyText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSoft,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  symptomItemCard: {
    backgroundColor: Colors.backgroundSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  symptomItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symptomItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  symptomSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  symptomSeverityText: {
    fontSize: 11,
    fontWeight: '800',
  },
  symptomItemDetails: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 4,
  },
  symptomHelpNote: {
    fontSize: 11,
    color: Colors.primaryDark,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalCloseActionBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalCloseActionBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
