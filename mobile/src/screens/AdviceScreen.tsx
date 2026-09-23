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
import { RefreshControl } from 'react-native';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import { buildRecommendations } from '../services/riskEngine';

interface AdviceScreenProps {
  onNavigate?: (tab: string) => void;
}

export const AdviceScreen: React.FC<AdviceScreenProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAdvice = async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (e: any) {
      console.warn('Advice load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdvice();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAdvice();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Loading clinical advice...</Text>
      </View>
    );
  }

  const risk = data?.risk || {};
  let recs: any[] = risk.topRecommendations || [];

  // Fallback to offline engine if recs is empty
  if (recs.length === 0) {
    const defaultLevel = risk.level === 'Severe' || risk.level === 'High' ? risk.level : 'Low';
    recs = buildRecommendations(defaultLevel as any, {
      age: 28,
      bp_sys: 120,
      bp_dia: 80,
      bmi: 22,
      symptoms: [],
    });
  }

  const urgentRecs = recs.filter((r: any) =>
    Boolean(r.urgent || r.category === 'Urgent Action' || (typeof r === 'string' && r.toLowerCase().includes('urgent')))
  );
  const generalRecs = recs.filter(
    (r: any) => !r.urgent && r.category !== 'Urgent Action' && !(typeof r === 'string' && r.toLowerCase().includes('urgent'))
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
    >
      {/* Hero Assessment Summary */}
      <LinearGradient
        colors={Gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroCard, Shadows.card]}
      >
        <Text style={styles.heroEyebrow}>BASED ON YOUR LATEST ASSESSMENT</Text>
        <Text style={styles.heroTitle}>
          {risk.level || 'Low'} Risk — {risk.latestScore !== null ? risk.latestScore : 0}/100
        </Text>
        <TouchableOpacity
          onPress={() => onNavigate?.('analyze')}
          activeOpacity={0.7}
          style={styles.heroLinkRow}
        >
          <Text style={styles.heroLinkText}>View full clinical risk breakdown</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Urgent Recommendations */}
      {urgentRecs.length > 0 && (
        <View style={[styles.card, styles.urgentCard, Shadows.card]}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning" size={18} color={Colors.riskHigh} />
            <Text style={[styles.eyebrow, { color: Colors.riskHigh }]}>
              URGENT — ACT ON THESE FIRST
            </Text>
          </View>
          {urgentRecs.map((rec: any, idx: number) => {
            const text = typeof rec === 'string' ? rec : (rec.text || '');
            return (
              <View key={idx} style={styles.recItem}>
                <Ionicons name="alert-circle" size={18} color={Colors.riskHigh} />
                <View style={{ flex: 1 }}>
                  {rec.category && (
                    <Text style={[styles.recCategory, { color: Colors.riskHigh }]}>
                      {rec.category}
                    </Text>
                  )}
                  <Text style={styles.urgentRecText}>{text}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Daily Care Recommendations */}
      <View style={[styles.card, Shadows.card]}>
        <Text style={styles.eyebrow}>DAILY CARE RECOMMENDATIONS</Text>
        {generalRecs.length > 0 ? (
          generalRecs.map((rec: any, idx: number) => {
            const text = typeof rec === 'string' ? rec : (rec.text || '');
            return (
              <View key={idx} style={styles.recItem}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  {rec.category && (
                    <Text style={styles.recCategory}>
                      {rec.category}
                    </Text>
                  )}
                  <Text style={styles.recText}>{text}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={24} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>
              Keep logging your daily vitals to receive tailored daily care guidance.
            </Text>
          </View>
        )}
      </View>

      {/* Danger Signs Guide */}
      <View style={[styles.card, Shadows.card]}>
        <Text style={styles.eyebrow}>DANGER SIGNS TO WATCH FOR</Text>
        <Text style={styles.guideText}>
          Contact your healthcare provider or emergency hotline immediately if you experience:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Severe persistent headache with blurred vision</Text>
          <Text style={styles.bulletItem}>• Any bright red vaginal bleeding</Text>
          <Text style={styles.bulletItem}>• Sudden swelling in hands, feet, or face</Text>
          <Text style={styles.bulletItem}>• Noticeable decrease in fetal movement (after 28 weeks)</Text>
          <Text style={styles.bulletItem}>• High fever with chills or severe lower back pain</Text>
        </View>
      </View>


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
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSoft,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    color: '#FFFFFF',
    marginTop: 6,
    marginBottom: 8,
  },
  heroLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLinkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  urgentCard: {
    borderColor: Colors.riskHigh,
    backgroundColor: '#FFF8F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    marginBottom: 12,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  recCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  recText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  urgentRecText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.riskHigh,
    flex: 1,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  guideText: {
    fontSize: 13.5,
    color: Colors.textSoft,
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  contactNumber: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
