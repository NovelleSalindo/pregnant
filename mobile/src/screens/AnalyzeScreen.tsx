import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getSymptomCatalog();
        setHistory(res.history || []);
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

  const urgentRecs = (current?.recommendations || []).filter((r: any) => !!r.urgent);
  const generalRecs = (current?.recommendations || []).filter((r: any) => !r.urgent);

  // Score delta calculation matching analyze.php delta_badge()
  const scoreDiff = (current && previous) ? (current.score - previous.score) : 0;
  const improved = scoreDiff < 0;

  const hotlines = [
    { name: 'National Emergency Services', number: '911', icon: 'call' },
    { name: 'OB-GYN On-Call Line', number: '(555) 010-2288', icon: 'medkit' },
    { name: 'Maternal Nurse Hotline (24/7)', number: '(555) 010-9100', icon: 'heart' },
  ];

  const callNumber = (num: string) => {
    Linking.openURL(`tel:${num.replace(/[^0-9]/g, '')}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => onNavigate('home')}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>CLINICAL DECISION SUPPORT</Text>
          <Text style={styles.headerTitle}>Risk Breakdown</Text>
        </View>
      </View>

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

      {!current ? (
        <View style={[styles.card, Shadows.card, styles.emptyCard]}>
          <Ionicons name="analytics-outline" size={40} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>No Assessments Yet</Text>
          <Text style={styles.emptyDesc}>
            Complete your first symptom check-in to see your clinical risk breakdown and recommendations.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => onNavigate('symptoms')}
          >
            <Text style={styles.emptyBtnText}>Start Symptom Check-in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* --- SUBTAB 1: FACTOR BREAKDOWN & COMPARISON --- */}
          {activeSubTab === 'breakdown' && (
            <View>
              {/* Current Assessment Hero */}
              <LinearGradient
                colors={Gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroCard, Shadows.card]}
              >
                <Text style={styles.heroEyebrow}>LATEST RISK ASSESSMENT</Text>
                <Text style={styles.heroTitle}>{current.level} Risk — {current.score}/100</Text>
                <Text style={styles.heroDate}>
                  Assessed on {current.date}
                </Text>
              </LinearGradient>

              {/* Comparison Gauges (Current vs Previous matching analyze.php) */}
              {previous && (
                <View style={styles.compareRow}>
                  <View style={[styles.compareCard, Shadows.card]}>
                    <Text style={styles.compareLabel}>CURRENT</Text>
                    <RiskGauge score={current.score} level={current.level} size={140} />
                    <Text style={styles.compareDate}>{current.date.split(' ')[0]}</Text>
                  </View>

                  <View style={[styles.compareCard, Shadows.card]}>
                    <Text style={styles.compareLabel}>PREVIOUS</Text>
                    <RiskGauge score={previous.score} level={previous.level} size={140} />
                    <Text style={styles.compareDate}>{previous.date.split(' ')[0]}</Text>
                  </View>
                </View>
              )}

              {/* Delta Badge (.delta-badge in analyze.php) */}
              {previous && (
                <View style={[styles.card, Shadows.card, { alignItems: 'center', paddingVertical: 14 }]}>
                  <Text style={styles.deltaEyebrow}>SCORE CHANGE SINCE LAST CHECK-IN</Text>
                  <View style={styles.deltaRow}>
                    <Ionicons
                      name={scoreDiff === 0 ? 'remove' : (improved ? 'arrow-down' : 'arrow-up')}
                      size={20}
                      color={scoreDiff === 0 ? Colors.textMuted : (improved ? Colors.riskLow : Colors.riskHigh)}
                    />
                    <Text
                      style={[
                        styles.deltaValue,
                        { color: scoreDiff === 0 ? Colors.textMuted : (improved ? Colors.riskLow : Colors.riskHigh) },
                      ]}
                    >
                      {scoreDiff === 0 ? 'No change' : `${scoreDiff > 0 ? '+' : ''}${scoreDiff} pts`}
                    </Text>
                  </View>
                  <Text style={styles.deltaDesc}>
                    {current.level === previous.level
                      ? `Risk category remained stable at ${current.level}.`
                      : `Risk category shifted from ${previous.level} to ${current.level}.`}
                  </Text>
                </View>
              )}

              {/* Contributing Factor Hits (RH / MC / PP rules from base.php) */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardEyebrow}>RISK FACTOR BREAKDOWN</Text>
                <Text style={styles.cardSectionTitle}>Triggered Clinical Criteria</Text>

                {current.structural?.hits && current.structural.hits.length > 0 ? (
                  current.structural.hits.map((hit: any, idx: number) => (
                    <View key={idx} style={styles.factorRow}>
                      <View style={styles.factorBadge}>
                        <Text style={styles.factorBadgeText}>{hit.cat || 'RULE'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.factorLabel}>{hit.label || hit.name}</Text>
                        <Text style={styles.factorSub}>Points: +{hit.points || 1}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyFactors}>
                    <Ionicons name="checkmark-circle-outline" size={28} color={Colors.riskLow} />
                    <Text style={styles.emptyFactorsText}>
                      No high-risk reproductive history or chronic condition rules triggered.
                    </Text>
                  </View>
                )}
              </View>

              {/* Acute Safety Trigger Rules */}
              {current.rules && current.rules.length > 0 && (
                <View style={[styles.card, Shadows.card, { borderColor: Colors.riskHigh }]}>
                  <Text style={[styles.cardEyebrow, { color: Colors.riskHigh }]}>
                    ACUTE CLINICAL SAFETY RULES
                  </Text>
                  {current.rules.map((r: any, idx: number) => (
                    <View key={idx} style={styles.ruleAlertItem}>
                      <Ionicons name="warning" size={18} color={Colors.riskHigh} />
                      <Text style={styles.ruleAlertText}>{r.text || r.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* --- SUBTAB 2: FULL RECOMMENDATIONS & EMERGENCY CONTACTS --- */}
          {activeSubTab === 'recommendations' && (
            <View>
              {/* Urgent Action Banner */}
              {urgentRecs.length > 0 && (
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
                {generalRecs.length > 0 ? (
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
                {history.slice(0, 5).map((h, idx) => (
                  <View key={h.id || idx} style={styles.timelineItem}>
                    <View style={[styles.timelineScoreBadge, { backgroundColor: Colors.primaryLight }]}>
                      <Text style={styles.timelineScoreText}>{h.score}</Text>
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
});
