import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export const TrackerScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kick' | 'contraction'>('kick');

  // --- Kick Counter State ---
  const [kickCount, setKickCount] = useState(0);
  const [todayTotalKicks, setTodayTotalKicks] = useState(0);
  const [kickSessionActive, setKickSessionActive] = useState(false);
  const [kickSeconds, setKickSeconds] = useState(0);
  const kickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Contraction Timer State ---
  const [contractionActive, setContractionActive] = useState(false);
  const [contractionSeconds, setContractionSeconds] = useState(0);
  const contractionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [contractions, setContractions] = useState<any[]>([]);
  const [alert511, setAlert511] = useState(false);

  // Load initial tracker data
  useEffect(() => {
    async function loadData() {
      try {
        const kickRes = await api.getKicks();
        setTodayTotalKicks(kickRes.todayCount || 0);

        const contRes = await api.getContractions();
        setContractions(contRes.contractions || []);
        setAlert511(contRes.alert511 || false);
      } catch (e: any) {
        console.warn('Tracker load error:', e.message);
      }
    }
    loadData();
  }, []);

  // --- Kick Logic ---
  const handleKickTap = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    if (!kickSessionActive) {
      setKickSessionActive(true);
      kickTimerRef.current = setInterval(() => {
        setKickSeconds((s) => s + 1);
      }, 1000);
    }

    const nextCount = kickCount + 1;
    setKickCount(nextCount);
    setTodayTotalKicks((t) => t + 1);

    // Save to API
    try {
      await api.logKick();
    } catch (e: any) {
      console.warn('Failed to sync kick:', e.message);
    }

    if (nextCount === 10) {
      Alert.alert(
        'Goal Reached! 🎉',
        `You felt 10 kicks in ${formatTime(kickSeconds)}. Good fetal movement is a healthy sign!`
      );
    }
  };

  const resetKickSession = () => {
    if (kickTimerRef.current) clearInterval(kickTimerRef.current);
    setKickSessionActive(false);
    setKickCount(0);
    setKickSeconds(0);
  };

  // --- Contraction Logic ---
  const toggleContractionTimer = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    if (!contractionActive) {
      // Start
      setContractionActive(true);
      setContractionSeconds(0);
      contractionTimerRef.current = setInterval(() => {
        setContractionSeconds((s) => s + 1);
      }, 1000);
    } else {
      // Stop & save
      if (contractionTimerRef.current) clearInterval(contractionTimerRef.current);
      setContractionActive(false);

      const duration = contractionSeconds;
      try {
        await api.logContraction(duration);
        // Refresh contractions
        const contRes = await api.getContractions();
        setContractions(contRes.contractions || []);
        setAlert511(contRes.alert511 || false);
      } catch (e: any) {
        console.warn('Failed to sync contraction:', e.message);
      }
    }
  };

  const deleteContraction = async (id: string) => {
    try {
      await api.deleteTracker(id);
      setContractions((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      Alert.alert('Error', 'Could not delete item.');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Pregnancy Trackers</Text>
          <Text style={styles.headerSubtitle}>Kick counter & labor contraction timer</Text>
        </View>
      </View>

      {/* Segmented Switch */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'kick' && styles.tabBtnActive]}
          onPress={() => setActiveTab('kick')}
        >
          <Ionicons
            name="footsteps"
            size={16}
            color={activeTab === 'kick' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'kick' && styles.tabTextActive]}>
            Kick Counter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'contraction' && styles.tabBtnActive]}
          onPress={() => setActiveTab('contraction')}
        >
          <Ionicons
            name="timer-outline"
            size={16}
            color={activeTab === 'contraction' ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'contraction' && { color: Colors.accent, fontWeight: '700' }]}>
            Contraction Timer
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- KICK COUNTER TAB --- */}
      {activeTab === 'kick' && (
        <View>
          <View style={[styles.card, Shadows.small]}>
            <View style={styles.cardHeader}>
              <Text style={styles.goalLabel}>CLINICAL TARGET: 10 KICKS IN 2 HOURS</Text>
              <View style={styles.todayPill}>
                <Text style={styles.todayPillText}>{todayTotalKicks} Total Today</Text>
              </View>
            </View>

            {/* Tap Button */}
            <View style={styles.kickButtonContainer}>
              <TouchableOpacity
                style={[styles.kickCircle, Shadows.medium]}
                onPress={handleKickTap}
                activeOpacity={0.8}
              >
                <Ionicons name="footsteps" size={44} color={Colors.white} />
                <Text style={styles.kickCountBig}>{kickCount}</Text>
                <Text style={styles.kickPrompt}>TAP TO RECORD</Text>
              </TouchableOpacity>
            </View>

            {/* Session Stats */}
            <View style={styles.sessionStatsRow}>
              <View style={styles.sessionItem}>
                <Text style={styles.sessionValue}>{formatTime(kickSeconds)}</Text>
                <Text style={styles.sessionLabel}>Session Elapsed</Text>
              </View>
              <View style={styles.sessionItem}>
                <Text style={styles.sessionValue}>{kickCount}/10</Text>
                <Text style={styles.sessionLabel}>Count Progress</Text>
              </View>
            </View>

            {/* Reset Button */}
            {kickCount > 0 && (
              <TouchableOpacity style={styles.resetBtn} onPress={resetKickSession}>
                <Ionicons name="refresh" size={14} color={Colors.textMuted} />
                <Text style={styles.resetBtnText}>Reset Current Session</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* --- CONTRACTION TIMER TAB --- */}
      {activeTab === 'contraction' && (
        <View>
          {alert511 && (
            <View style={styles.alert511Box}>
              <Ionicons name="medical" size={22} color={Colors.riskSevere} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alert511Title}>5-1-1 Rule Triggered!</Text>
                <Text style={styles.alert511Desc}>
                  Your contractions are ~5 minutes apart, lasting 1 minute each. Time to call your hospital or OB-GYN!
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.card, Shadows.small]}>
            <View style={styles.contractionTimerBox}>
              <Text style={styles.contractionTimerDigits}>
                {formatTime(contractionSeconds)}
              </Text>
              <Text style={styles.contractionTimerLabel}>
                {contractionActive ? 'Contraction in progress...' : 'Ready to time next contraction'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.contractionActionBtn,
                  contractionActive ? styles.contractionBtnStop : styles.contractionBtnStart,
                  Shadows.medium,
                ]}
                onPress={toggleContractionTimer}
              >
                <Ionicons
                  name={contractionActive ? 'stop' : 'play'}
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.contractionActionBtnText}>
                  {contractionActive ? 'Stop Contraction' : 'Start Contraction'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* History List */}
          <Text style={styles.historyTitle}>Recent Contractions</Text>
          {contractions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No contractions recorded yet.</Text>
            </View>
          ) : (
            contractions.map((c) => (
              <View key={c.id} style={[styles.contRow, Shadows.small]}>
                <View>
                  <Text style={styles.contDuration}>{c.durationSeconds}s duration</Text>
                  <Text style={styles.contTime}>{c.at}</Text>
                </View>

                <View style={styles.contIntervalBox}>
                  {c.intervalMinutes !== null ? (
                    <Text style={styles.contInterval}>{c.intervalMinutes}m apart</Text>
                  ) : (
                    <Text style={styles.contInterval}>First in set</Text>
                  )}
                  <TouchableOpacity onPress={() => deleteContraction(c.id)}>
                    <Ionicons name="trash-outline" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
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
    padding: 18,
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.small,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
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
    marginBottom: 16,
  },
  goalLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  todayPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  kickButtonContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  kickCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: Colors.primaryLight,
  },
  kickCountBig: {
    fontSize: 38,
    fontWeight: '900',
    color: Colors.white,
    marginTop: 2,
  },
  kickPrompt: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 14,
    marginTop: 10,
  },
  sessionItem: {
    alignItems: 'center',
  },
  sessionValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  sessionLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 4,
  },
  resetBtnText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  alert511Box: {
    flexDirection: 'row',
    backgroundColor: Colors.riskSevereLight,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.riskSevere,
  },
  alert511Title: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.riskSevere,
  },
  alert511Desc: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
  },
  contractionTimerBox: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  contractionTimerDigits: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  contractionTimerLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
  contractionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  contractionBtnStart: {
    backgroundColor: Colors.accent,
  },
  contractionBtnStop: {
    backgroundColor: Colors.text,
  },
  contractionActionBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  contRow: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contDuration: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  contTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  contIntervalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contInterval: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
