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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
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
        `You recorded 10 kicks in ${formatTime(kickSeconds)}. Good fetal movement is a positive sign of well-being.`
      );
    }
  };

  const resetKickSession = () => {
    if (kickTimerRef.current) clearInterval(kickTimerRef.current);
    kickTimerRef.current = null;
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
      contractionTimerRef.current = null;
      setContractionActive(false);

      const duration = contractionSeconds;
      try {
        await api.logContraction(duration);
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
        <Text style={styles.headerEyebrow}>TRACKERS</Text>
        <Text style={styles.headerTitle}>Pregnancy Trackers</Text>
        <Text style={styles.headerSubtitle}>Fetal kick counter & labor contraction timer</Text>
      </View>

      {/* Segmented Switch (.auth-tabs style) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'kick' && styles.tabBtnActive]}
          onPress={() => setActiveTab('kick')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="footsteps"
            size={16}
            color={activeTab === 'kick' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'kick' && styles.tabTextActive]}>
            Kick Counter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'contraction' && styles.tabBtnActive]}
          onPress={() => setActiveTab('contraction')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="timer-outline"
            size={16}
            color={activeTab === 'contraction' ? Colors.primaryDark : Colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'contraction' && styles.tabTextActive]}>
            Contraction Timer
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- KICK COUNTER TAB --- */}
      {activeTab === 'kick' && (
        <View>
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.goalLabel}>TARGET: 10 KICKS IN 2 HOURS</Text>
              <View style={styles.todayPill}>
                <Text style={styles.todayPillText}>{todayTotalKicks} Total Today</Text>
              </View>
            </View>

            {/* Tap Button with Pink Gradient */}
            <View style={styles.kickButtonContainer}>
              <TouchableOpacity
                onPress={handleKickTap}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={Gradients.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.kickCircle, Shadows.glow]}
                >
                  <Ionicons name="footsteps" size={40} color="#FFFFFF" />
                  <Text style={styles.kickCountBig}>{kickCount}</Text>
                  <Text style={styles.kickPrompt}>TAP TO RECORD</Text>
                </LinearGradient>
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
              <TouchableOpacity style={styles.resetBtn} onPress={resetKickSession} activeOpacity={0.7}>
                <Ionicons name="refresh" size={14} color={Colors.textSoft} />
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
            <View style={[styles.alert511Box, Shadows.card]}>
              <Ionicons name="medical" size={22} color={Colors.riskHigh} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alert511Title}>5-1-1 Rule Triggered!</Text>
                <Text style={styles.alert511Desc}>
                  Your contractions are ~5 minutes apart, lasting 1 minute each. Time to call your hospital or OB-GYN!
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.card, Shadows.card]}>
            <View style={styles.contractionTimerBox}>
              <Text style={styles.contractionTimerDigits}>
                {formatTime(contractionSeconds)}
              </Text>
              <Text style={styles.contractionTimerLabel}>
                {contractionActive ? 'Contraction in progress...' : 'Ready to time next contraction'}
              </Text>

              <TouchableOpacity
                onPress={toggleContractionTimer}
                activeOpacity={0.85}
                style={{ marginTop: 16 }}
              >
                <LinearGradient
                  colors={contractionActive ? Gradients.emergency : Gradients.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.contractionActionBtn, Shadows.glow]}
                >
                  <Ionicons
                    name={contractionActive ? 'stop' : 'play'}
                    size={20}
                    color={Colors.white}
                  />
                  <Text style={styles.contractionActionBtnText}>
                    {contractionActive ? 'Stop Contraction' : 'Start Contraction'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* History List */}
          <Text style={styles.sectionTitle}>Recent Contractions</Text>
          {contractions.length === 0 ? (
            <View style={[styles.emptyBox, Shadows.card]}>
              <Text style={styles.emptyText}>No contractions recorded yet.</Text>
            </View>
          ) : (
            contractions.map((c) => (
              <View key={c.id} style={[styles.contRow, Shadows.card]}>
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
                    <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
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
    padding: 16,
    paddingBottom: 40,
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
    marginTop: 2,
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
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
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  todayPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  todayPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  kickButtonContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  kickCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickCountBig: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -1,
  },
  kickPrompt: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
    marginTop: 2,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
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
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSoft,
  },
  resetBtnText: {
    fontSize: 12.5,
    color: Colors.textSoft,
    fontWeight: '700',
  },
  alert511Box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.riskHighBg,
    borderWidth: 1.5,
    borderColor: Colors.riskHigh,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  alert511Title: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.riskHigh,
  },
  alert511Desc: {
    fontSize: 12.5,
    color: Colors.riskHigh,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
  contractionTimerBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  contractionTimerDigits: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  contractionTimerLabel: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 4,
    fontWeight: '600',
  },
  contractionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 14,
  },
  contractionActionBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  emptyBox: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  contRow: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contDuration: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  contTime: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  contIntervalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contInterval: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});
