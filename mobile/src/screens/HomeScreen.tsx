import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { BabySizeCard } from '../components/BabySizeCard';
import { RiskGauge } from '../components/RiskGauge';
import { HeaderBar } from '../components/HeaderBar';
import { api } from '../services/api';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  onOpenDrawer?: () => void;
  onOpenNotifications?: () => void;
  currentUser?: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenDrawer,
  onOpenNotifications,
  currentUser,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (e: any) {
      console.warn('Dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={styles.loadingText}>Loading your pregnancy dashboard...</Text>
      </View>
    );
  }

  const defaultWeeks = 32;
  const defaultEdd = 'Nov 8, 2026';
  const defaultDaysToEdd = 53;

  const preg = data?.pregnancy || {};
  const risk = data?.risk || {};
  const vitals = data?.vitals?.latest || {};
  const checkin = data?.checkin || {};
  const user = data?.user || currentUser || {
    name: 'Novelle B. Salindo',
    email: 'novelle2023.salindo@gmail.com',
  };
  const recs = risk?.topRecommendations || [];

  const displayWeeks = preg.weeks !== null && preg.weeks !== undefined ? preg.weeks : defaultWeeks;
  const displayTrimester = preg.trimester || (displayWeeks < 14 ? 1 : displayWeeks < 28 ? 2 : 3);

  const formatEddDate = (rawEdd?: string | null) => {
    if (!rawEdd) return defaultEdd;
    if (rawEdd.includes(',') || rawEdd.length > 10) return rawEdd;
    try {
      const parts = rawEdd.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      const d = new Date(rawEdd);
      return !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : rawEdd;
    } catch {
      return rawEdd;
    }
  };

  const displayEdd = preg.formattedEdd || formatEddDate(preg.edd);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
    >
      {/* Top Header Bar matching Screenshot 1 1:1 */}
      <HeaderBar
        title="Dashboard"
        user={user?.name ? user : currentUser}
        unreadCount={data?.notifications?.unreadCount || 0}
        onOpenDrawer={onOpenDrawer || (() => {})}
        onOpenNotifications={onOpenNotifications || (() => {})}
      />

      {/* Body Cards Container */}
      <View style={styles.bodyContent}>
        {/* Hero Gradient Banner (.hero-gradient in style.css) */}
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, Shadows.card]}
        >
          <View style={styles.heroDecorCircle} />
          <Text style={styles.heroEyebrow}>WELCOME BACK</Text>
          <Text style={styles.heroName}>{user.name || 'Novelle B. Salindo'}</Text>
          <Text style={styles.heroText}>
            You're about <Text style={styles.heroBold}>{displayWeeks} weeks</Text> along — Trimester {displayTrimester}.
            {'\n'}Expected due date: {displayEdd}.
          </Text>
        </LinearGradient>

        {/* Daily Check-in Reminder Banner (#dailyReminderBanner in dashboard.php) */}
        {(!checkin.vitalsLoggedToday || !checkin.symptomsLoggedToday) && (
          <View style={[styles.reminderBanner, Shadows.card]}>
            <View style={styles.reminderContent}>
              <View style={styles.reminderIconCircle}>
              <Ionicons name="notifications" size={20} color={Colors.secondaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>Daily check-in reminder</Text>
              <Text style={styles.reminderDesc}>
                {!checkin.vitalsLoggedToday && !checkin.symptomsLoggedToday
                  ? "You haven't logged your vitals or symptoms today."
                  : !checkin.vitalsLoggedToday
                  ? "You haven't logged your vitals today."
                  : "You haven't done your symptom check-in today."}
              </Text>
            </View>
          </View>

          <View style={styles.reminderActions}>
            {!checkin.vitalsLoggedToday && (
              <TouchableOpacity
                style={styles.btnOutlineSm}
                onPress={() => onNavigate('vitals')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnOutlineSmText}>Log Vitals</Text>
              </TouchableOpacity>
            )}
            {!checkin.symptomsLoggedToday && (
              <TouchableOpacity
                style={styles.btnPrimarySm}
                onPress={() => onNavigate('symptoms')}
                activeOpacity={0.7}
              >
                <Text style={styles.btnPrimarySmText}>Check-in Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Baby Milestone & Due Date Countdown Card */}
      <BabySizeCard
        weeks={displayWeeks}
        days={preg.days || 227}
        trimester={displayTrimester}
        babyFruit={preg.babyFruit || 'Rutabaga'}
        babyEmoji={preg.babyEmoji || '🥬'}
        daysToEdd={preg.daysToEdd !== null && preg.daysToEdd !== undefined ? preg.daysToEdd : defaultDaysToEdd}
        edd={displayEdd}
      />

      {/* Current Maternal Risk Status Card */}
      <View style={[styles.card, Shadows.card]}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>CURRENT RISK LEVEL</Text>
          <TouchableOpacity onPress={() => onNavigate('symptoms')} style={styles.linkRow}>
            <Text style={styles.linkText}>New Check-in</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.gaugeWrapper}>
          <RiskGauge
            score={risk.latestScore !== null ? risk.latestScore : 0}
            level={risk.level || 'Low'}
            size={180}
          />
        </View>

        {/* Priority Recommendations */}
        {recs.length > 0 && (
          <View style={styles.recsSection}>
            <Text style={styles.recsEyebrow}>TOP CLINICAL RECOMMENDATIONS</Text>
            {recs.slice(0, 3).map((rec: any, idx: number) => (
              <View key={idx} style={[styles.recItem, rec.urgent && styles.recItemUrgent]}>
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
              style={styles.btnBlockOutline}
              onPress={() => onNavigate('analyze')}
              activeOpacity={0.7}
            >
              <Ionicons name="analytics-outline" size={16} color={Colors.primaryDark} />
              <Text style={[styles.btnBlockOutlineText, { color: Colors.primaryDark }]}>
                View Full Breakdown &amp; Guidance
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Latest Vitals Card (.kv layout from dashboard.php) */}
      <View style={[styles.card, Shadows.card]}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>LATEST VITALS</Text>
          <TouchableOpacity onPress={() => onNavigate('vitals')} style={styles.linkRow}>
            <Text style={styles.linkText}>View History</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        {vitals.bp_sys ? (
          <View style={styles.kvList}>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Blood Pressure</Text>
              <Text style={styles.kvVal}>{vitals.bp_sys}/{vitals.bp_dia} mmHg</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Hemoglobin</Text>
              <Text style={styles.kvVal}>{vitals.hemoglobin || '—'} g/dL</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Blood Sugar</Text>
              <Text style={styles.kvVal}>{vitals.blood_sugar || '—'} mg/dL</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Weight</Text>
              <Text style={styles.kvVal}>{vitals.weight_kg || '—'} kg</Text>
            </View>
            <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.kvKey}>Logged</Text>
              <Text style={[styles.kvVal, { color: Colors.textSoft }]}>{vitals.date || 'Today'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="pulse-outline" size={28} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>No vitals logged yet.</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.btnBlockOutline}
          onPress={() => onNavigate('vitals')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={Colors.text} />
          <Text style={styles.btnBlockOutlineText}>Log Vitals</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Navigation Grid */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={[styles.quickTile, Shadows.card]}
          onPress={() => onNavigate('trackers')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="footsteps" size={20} color={Colors.primaryDark} />
          </View>
          <Text style={styles.quickTitle}>Kick Counter</Text>
          <Text style={styles.quickSub}>Track movement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickTile, Shadows.card]}
          onPress={() => onNavigate('wellness')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: Colors.lavenderLight }]}>
            <Ionicons name="library" size={20} color={Colors.lavender} />
          </View>
          <Text style={styles.quickTitle}>Education Hub</Text>
          <Text style={styles.quickSub}>Trimester tips</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickTile, Shadows.card]}
          onPress={() => onNavigate('wellness')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIconCircle, { backgroundColor: Colors.secondaryLight }]}>
            <Ionicons name="bag-handle" size={20} color={Colors.secondaryDark} />
          </View>
          <Text style={styles.quickTitle}>Hospital Bag</Text>
          <Text style={styles.quickSub}>Checklist gear</Text>
        </TouchableOpacity>
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
    paddingBottom: 90,
  },
  bodyContent: {
    paddingHorizontal: 16,
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
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.riskHigh,
  },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle: {
    position: 'absolute',
    right: -30,
    top: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: 'rgba(255, 255, 255, 0.88)',
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'serif',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroText: {
    fontSize: 13.5,
    color: 'rgba(255, 255, 255, 0.94)',
    lineHeight: 20,
    fontWeight: '500',
  },
  heroBold: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reminderBanner: {
    backgroundColor: Colors.secondarySoft,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.secondaryDark,
  },
  reminderDesc: {
    fontSize: 12,
    color: Colors.textSoft,
    marginTop: 2,
    lineHeight: 16,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  btnOutlineSm: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnOutlineSmText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  btnPrimarySm: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: Colors.primaryDark,
  },
  btnPrimarySmText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: Colors.primaryDark,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  gaugeWrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  recsSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    paddingTop: 12,
  },
  recsEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 8,
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
  kvList: {
    marginVertical: 4,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  kvKey: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  kvVal: {
    fontSize: 13.5,
    color: Colors.text,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  btnBlockOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  btnBlockOutlineText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 4,
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  quickSub: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
