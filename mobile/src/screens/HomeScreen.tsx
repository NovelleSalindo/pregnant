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
import { Colors, Shadows } from '../theme/colors';
import { BabySizeCard } from '../components/BabySizeCard';
import { RiskGauge } from '../components/RiskGauge';
import { api } from '../services/api';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your pregnancy dashboard...</Text>
      </View>
    );
  }

  const preg = data?.pregnancy || {};
  const risk = data?.risk || {};
  const vitals = data?.vitals?.latest || {};
  const checkin = data?.checkin || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Welcome Bar */}
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.welcomeLabel}>Hello,</Text>
          <Text style={styles.userName}>{data?.user?.name || 'Mom'}</Text>
        </View>

        <TouchableOpacity style={styles.notifBtn} onPress={() => onNavigate('profile')}>
          <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          {(data?.notifications?.unreadCount || 0) > 0 && (
            <View style={styles.badgeDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Baby Milestone Card */}
      <BabySizeCard
        weeks={preg.weeks}
        days={preg.days}
        trimester={preg.trimester}
        babyFruit={preg.babyFruit}
        babyEmoji={preg.babyEmoji}
        daysToEdd={preg.daysToEdd}
        edd={preg.edd}
      />

      {/* Daily Check-in Alert */}
      {(!checkin.vitalsLoggedToday || !checkin.symptomsLoggedToday) && (
        <View style={[styles.reminderCard, Shadows.small]}>
          <View style={styles.reminderIconCircle}>
            <Ionicons name="notifications" size={20} color={Colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Daily Check-in Reminder</Text>
            <Text style={styles.reminderDesc}>
              {!checkin.vitalsLoggedToday && !checkin.symptomsLoggedToday
                ? "Don't forget to log your vitals and symptom check-in today."
                : !checkin.vitalsLoggedToday
                ? "You haven't recorded today's vitals."
                : "You haven't completed today's symptom check-in."}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reminderActionBtn}
            onPress={() => onNavigate(!checkin.symptomsLoggedToday ? 'symptoms' : 'vitals')}
          >
            <Text style={styles.reminderActionText}>Start</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Maternal Risk Assessment Card */}
      <View style={[styles.card, Shadows.small]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardPreTitle}>CLINICAL DECISION SUPPORT</Text>
            <Text style={styles.cardTitle}>Maternal Risk Status</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('symptoms')} style={styles.checkinLink}>
            <Text style={styles.checkinLinkText}>New Check-in</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.gaugeWrapper}>
          <RiskGauge
            score={risk.latestScore !== null ? risk.latestScore : 0}
            level={risk.level || 'None'}
            size={200}
          />
        </View>

        {/* Top Recommendations */}
        {risk.topRecommendations && risk.topRecommendations.length > 0 && (
          <View style={styles.recsContainer}>
            <Text style={styles.recsHeader}>Priority Clinical Recommendations:</Text>
            {risk.topRecommendations.map((rec: any, idx: number) => (
              <View key={idx} style={[styles.recItem, rec.urgent && styles.recItemUrgent]}>
                <Ionicons
                  name={rec.urgent ? 'alert-circle' : 'checkmark-circle'}
                  size={18}
                  color={rec.urgent ? Colors.riskSevere : Colors.primary}
                />
                <Text style={[styles.recText, rec.urgent && styles.recTextUrgent]}>
                  {rec.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Latest Vitals Overview */}
      <View style={[styles.card, Shadows.small]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardPreTitle}>MONITORING</Text>
            <Text style={styles.cardTitle}>Latest Vitals</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('vitals')} style={styles.checkinLink}>
            <Text style={styles.checkinLinkText}>History & Log</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.vitalsGrid}>
          <View style={styles.vitalTile}>
            <Ionicons name="heart-circle-outline" size={22} color={Colors.accent} />
            <Text style={styles.vitalValue}>
              {vitals.bp_sys ? `${vitals.bp_sys}/${vitals.bp_dia}` : '—'}
            </Text>
            <Text style={styles.vitalLabel}>Blood Pressure (mmHg)</Text>
          </View>

          <View style={styles.vitalTile}>
            <Ionicons name="water-outline" size={22} color={Colors.secondary} />
            <Text style={styles.vitalValue}>
              {vitals.blood_sugar ? `${vitals.blood_sugar} mg/dL` : '—'}
            </Text>
            <Text style={styles.vitalLabel}>Blood Sugar</Text>
          </View>

          <View style={styles.vitalTile}>
            <Ionicons name="medkit-outline" size={22} color={Colors.primary} />
            <Text style={styles.vitalValue}>
              {vitals.hemoglobin ? `${vitals.hemoglobin} g/dL` : '—'}
            </Text>
            <Text style={styles.vitalLabel}>Hemoglobin</Text>
          </View>

          <View style={styles.vitalTile}>
            <Ionicons name="speedometer-outline" size={22} color={Colors.riskHigh} />
            <Text style={styles.vitalValue}>
              {vitals.weight_kg ? `${vitals.weight_kg} kg` : '—'}
            </Text>
            <Text style={styles.vitalLabel}>Weight</Text>
          </View>
        </View>
      </View>

      {/* Quick Action Hub */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity style={[styles.quickTile, Shadows.small]} onPress={() => onNavigate('trackers')}>
          <View style={[styles.quickIconCircle, { backgroundColor: Colors.primaryLight }]}>
            <Ionicons name="footsteps" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.quickTitle}>Kick Counter</Text>
          <Text style={styles.quickSub}>{checkin.kicksToday || 0} logged today</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.quickTile, Shadows.small]} onPress={() => onNavigate('wellness')}>
          <View style={[styles.quickIconCircle, { backgroundColor: Colors.secondaryLight }]}>
            <Ionicons name="bag-handle" size={22} color={Colors.secondary} />
          </View>
          <Text style={styles.quickTitle}>Hospital Bag</Text>
          <Text style={styles.quickSub}>Checklist & Gear</Text>
        </TouchableOpacity>
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
    padding: 18,
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
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  welcomeLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.riskSevere,
  },
  reminderCard: {
    backgroundColor: Colors.secondaryLight,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.secondary,
    gap: 12,
  },
  reminderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  reminderDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reminderActionBtn: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reminderActionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardPreTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  checkinLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  checkinLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  gaugeWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  recsContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  recsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSoft,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    gap: 8,
  },
  recItemUrgent: {
    backgroundColor: Colors.riskSevereLight,
  },
  recText: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
    fontWeight: '500',
  },
  recTextUrgent: {
    color: Colors.riskSevere,
    fontWeight: '700',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalTile: {
    width: '48%',
    backgroundColor: Colors.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  vitalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  quickIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  quickSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
