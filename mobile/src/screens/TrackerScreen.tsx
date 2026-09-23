import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

type TrackerTab = 'kick' | 'contraction' | 'journal' | 'bump';

interface TrackerScreenProps {
  initialTab?: TrackerTab;
  onTabChange?: (tab: TrackerTab) => void;
}

const MOODS = [
  { key: 'Happy', emoji: '😊' },
  { key: 'Grateful', emoji: '🥰' },
  { key: 'Tired', emoji: '😴' },
  { key: 'Anxious', emoji: '😟' },
  { key: 'Emotional', emoji: '🥺' },
  { key: 'Excited', emoji: '🤩' },
  { key: 'Uncomfortable', emoji: '😣' },
];

export const TrackerScreen: React.FC<TrackerScreenProps> = ({ initialTab = 'kick', onTabChange }) => {
  const [activeTab, setActiveTab] = useState<TrackerTab>(initialTab);

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

  // --- Journal State ---
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [selectedMood, setSelectedMood] = useState('Happy');
  const [journalText, setJournalText] = useState('');

  // --- Bump Photo State ---
  const [bumpPhotos, setBumpPhotos] = useState<any[]>([]);
  const [bumpWeek, setBumpWeek] = useState('27');
  const [bumpNote, setBumpNote] = useState('');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab: TrackerTab) => {
    try {
      if (tab === 'kick') {
        const kickRes = await api.getKicks();
        setTodayTotalKicks(kickRes.todayCount || 0);
      } else if (tab === 'contraction') {
        const contRes = await api.getContractions();
        setContractions(contRes.contractions || []);
        setAlert511(contRes.alert511 || false);
      } else if (tab === 'journal') {
        const jrnRes = await api.getJournalEntries();
        setJournalEntries(jrnRes.entries || []);
      } else if (tab === 'bump') {
        const bumpRes = await api.getBumpPhotos();
        setBumpPhotos(bumpRes.photos || []);
      }
    } catch (e: any) {
      console.warn('Tracker data load error:', e.message);
    }
  };

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

    setKickCount((c) => c + 1);
    setTodayTotalKicks((c) => c + 1);

    try {
      await api.logKick();
    } catch (e: any) {
      console.warn('Kick log failed:', e.message);
    }
  };

  const handleEndKickSession = () => {
    if (kickTimerRef.current) clearInterval(kickTimerRef.current);
    setKickSessionActive(false);
    setKickCount(0);
    setKickSeconds(0);
  };

  // --- Contraction Logic ---
  const toggleContraction = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    if (contractionActive) {
      if (contractionTimerRef.current) clearInterval(contractionTimerRef.current);
      setContractionActive(false);

      try {
        await api.logContraction(contractionSeconds);
        const contRes = await api.getContractions();
        setContractions(contRes.contractions || []);
        setAlert511(contRes.alert511 || false);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
      setContractionSeconds(0);
    } else {
      setContractionActive(true);
      setContractionSeconds(0);
      contractionTimerRef.current = setInterval(() => {
        setContractionSeconds((s) => s + 1);
      }, 1000);
    }
  };

  // --- Journal Logic ---
  const handleSaveJournal = async () => {
    if (!journalText.trim()) {
      Alert.alert('Required', 'Please write your thoughts before saving.');
      return;
    }
    try {
      await api.addJournalEntry(selectedMood, journalText.trim());
      setJournalText('');
      loadTabData('journal');
      Alert.alert('Saved', 'Your pregnancy journal entry has been recorded.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteJournal = async (id: string) => {
    try {
      await api.deleteJournalEntry(id);
      loadTabData('journal');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // --- Bump Photo Logic ---
  const handleAddBump = async () => {
    const wk = parseInt(bumpWeek, 10);
    if (isNaN(wk) || wk < 1 || wk > 42) {
      Alert.alert('Invalid Week', 'Please enter a gestational week between 1 and 42.');
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'You need to grant camera permissions to log a bump photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        
        await api.addBumpPhoto(wk, bumpNote.trim(), base64Data);
        
        // Optimistically add to UI so it displays instantly
        setBumpPhotos((prev) => {
          const newPhoto = {
            id: `temp_${Date.now()}`,
            user_id: null,
            week_number: wk,
            date: new Date().toISOString().split('T')[0],
            note: bumpNote.trim(),
            filename: localUri,
          };
          return [...prev, newPhoto].sort((a, b) => a.week_number - b.week_number);
        });

        setBumpNote('');
        // Re-fetch data (may return [] if offline, but optimistic update keeps it visible)
        loadTabData('bump');
        Alert.alert('Uploaded', `Bump photo recorded for Week ${wk}.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteBump = async (id: string) => {
    try {
      await api.deleteBumpPhoto(id);
      loadTabData('bump');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const tabs: { key: TrackerTab; label: string; icon: any }[] = [
    { key: 'kick', label: 'Kick Counter', icon: 'footsteps-outline' },
    { key: 'contraction', label: 'Contractions', icon: 'timer-outline' },
    { key: 'journal', label: 'Journal', icon: 'journal-outline' },
    { key: 'bump', label: 'Bump Photos', icon: 'camera-outline' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Horizontal Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => {
                setActiveTab(t.key);
                onTabChange?.(t.key);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={isActive ? '#FFFFFF' : Colors.textSoft}
              />
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ================= 1. KICK COUNTER ================= */}
      {activeTab === 'kick' && (
        <View>
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>BABY MOVEMENT</Text>
              <View style={styles.todayPill}>
                <Text style={styles.todayPillText}>{todayTotalKicks} kicks today</Text>
              </View>
            </View>

            <View style={styles.kickButtonContainer}>
              <TouchableOpacity onPress={handleKickTap} activeOpacity={0.8}>
                <LinearGradient
                  colors={Gradients.brandMark}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.kickCircle, Shadows.glow]}
                >
                  <Ionicons name="footsteps" size={40} color="#FFFFFF" />
                  <Text style={styles.kickCountBig}>{kickCount}</Text>
                  <Text style={styles.kickPrompt}>TAP ON KICK</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.sessionStatsRow}>
              <View style={styles.sessionItem}>
                <Text style={styles.sessionValue}>{formatTimer(kickSeconds)}</Text>
                <Text style={styles.sessionLabel}>Session Duration</Text>
              </View>
              <View style={styles.sessionItem}>
                <Text style={styles.sessionValue}>{kickCount}</Text>
                <Text style={styles.sessionLabel}>Kicks in Session</Text>
              </View>
            </View>

            {kickSessionActive && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleEndKickSession}
                activeOpacity={0.7}
              >
                <Ionicons name="stop-circle-outline" size={16} color={Colors.textSoft} />
                <Text style={styles.resetBtnText}>End Kick Session</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ================= 2. CONTRACTION TIMER ================= */}
      {activeTab === 'contraction' && (
        <View>
          {alert511 && (
            <View style={styles.alert511Box}>
              <Ionicons name="warning" size={24} color={Colors.riskHigh} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alert511Title}>5-1-1 Rule Triggered!</Text>
                <Text style={styles.alert511Desc}>
                  Your contractions are about 5 minutes apart, lasting 1 minute. Call your OB-GYN or head to Labor & Delivery.
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.eyebrow}>CONTRACTION TIMER</Text>
            <View style={styles.contractionTimerBox}>
              <Text style={styles.contractionTimerDigits}>{formatTimer(contractionSeconds)}</Text>
              <Text style={styles.contractionTimerLabel}>
                {contractionActive ? 'Contraction in progress...' : 'Ready for next contraction'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleContraction}
              activeOpacity={0.8}
              style={{ alignItems: 'center', marginTop: 10 }}
            >
              <LinearGradient
                colors={contractionActive ? ['#E15D74', '#C43F58'] : ['#FFAFCC', '#C2577D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.contractionActionBtn, Shadows.glow]}
              >
                <Ionicons name={contractionActive ? 'stop' : 'play'} size={20} color="#FFFFFF" />
                <Text style={styles.contractionActionBtnText}>
                  {contractionActive ? 'Stop Contraction' : 'Start Contraction'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Past Contractions */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Contraction Log</Text>
            {contractions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No contractions recorded yet.</Text>
              </View>
            ) : (
              contractions.map((c: any) => (
                <View key={c.id} style={styles.contRow}>
                  <View>
                    <Text style={styles.contDuration}>{c.durationSeconds}s duration</Text>
                    <Text style={styles.contTime}>{c.at?.slice(11, 16)}</Text>
                  </View>
                  <Text style={styles.contInterval}>
                    {c.intervalMinutes ? `${c.intervalMinutes}m apart` : '—'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* ================= 3. PREGNANCY JOURNAL ================= */}
      {activeTab === 'journal' && (
        <View>
          {/* New Entry Card */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.eyebrow}>HOW ARE YOU FEELING TODAY?</Text>

            {/* Mood Emojis */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
              {MOODS.map((m) => {
                const isSelected = selectedMood === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.moodChip, isSelected && styles.moodChipSelected]}
                    onPress={() => setSelectedMood(m.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, isSelected && styles.moodLabelSelected]}>
                      {m.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={[styles.input, { height: 90, marginTop: 12 }]}
              value={journalText}
              onChangeText={setJournalText}
              multiline
              placeholder="Write about your day, cravings, emotions, baby's kicks, milestones..."
            />

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleSaveJournal}
              activeOpacity={0.8}
            >
              <Text style={styles.btnPrimaryText}>Save Journal Entry</Text>
            </TouchableOpacity>
          </View>

          {/* Past Journal Entries */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Past Journal Entries</Text>
            {journalEntries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="journal-outline" size={32} color={Colors.primaryLight} />
                <Text style={styles.emptyText}>No journal entries yet. Write your first one above!</Text>
              </View>
            ) : (
              journalEntries.map((j) => (
                <View key={j.id} style={[styles.journalCard, Shadows.card]}>
                  <View style={styles.journalHeader}>
                    <View style={styles.journalMoodWrap}>
                      <Text style={styles.journalEmoji}>
                        {MOODS.find((m) => m.key === j.mood)?.emoji || '📝'}
                      </Text>
                      <Text style={styles.journalMoodText}>{j.mood || 'Entry'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.journalDate}>{j.date?.slice(0, 16)}</Text>
                      <TouchableOpacity onPress={() => handleDeleteJournal(j.id)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.journalContent}>{j.content}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* ================= 4. BUMP PHOTO TIMELINE ================= */}
      {activeTab === 'bump' && (
        <View>
          {/* Add Bump Card */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.eyebrow}>ADD A BUMP PHOTO</Text>

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Week Number (1-42)</Text>
                <TextInput
                  style={styles.input}
                  value={bumpWeek}
                  onChangeText={setBumpWeek}
                  keyboardType="numeric"
                  placeholder="27"
                />
              </View>
              <View style={{ flex: 2, marginLeft: 12 }}>
                <Text style={styles.fieldLabel}>Caption or Note</Text>
                <TextInput
                  style={styles.input}
                  value={bumpNote}
                  onChangeText={setBumpNote}
                  placeholder="e.g. Starting to show!"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleAddBump}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrimaryText}>Log Bump Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Photos Timeline Gallery */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Your Bump Timeline</Text>
            {bumpPhotos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="images-outline" size={32} color={Colors.primaryLight} />
                <Text style={styles.emptyText}>No bump photos uploaded yet.</Text>
              </View>
            ) : (
              <View style={styles.bumpGrid}>
                {bumpPhotos.map((p) => (
                  <View key={p.id} style={[styles.bumpCard, Shadows.card]}>
                    <View style={styles.bumpVisualBox}>
                      {p.filename ? (
                        <Image 
                          source={{ uri: p.filename.startsWith('file://') ? p.filename : `${api.getBaseUrl().replace('/api', '')}/uploads/bumps/${p.user_id || ''}/${p.filename}` }} 
                          style={{ width: '100%', height: '100%', borderRadius: 12, position: 'absolute' }} 
                        />
                      ) : null}
                      <Ionicons name="camera-outline" size={36} color={Colors.primaryDark} style={{ opacity: p.filename ? 0.3 : 1 }} />
                      <Text style={[styles.bumpVisualWeek, p.filename ? { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 4 } : {}]}>Week {p.week_number}</Text>
                    </View>
                    <View style={styles.bumpCardBody}>
                      <View style={styles.bumpWeekBadge}>
                        <Text style={styles.bumpWeekBadgeText}>Week {p.week_number}</Text>
                      </View>
                      {p.note ? <Text style={styles.bumpNoteText}>{p.note}</Text> : null}
                      <Text style={styles.bumpDateText}>{p.date}</Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteBump(p.id)}
                        style={styles.bumpDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={14} color={Colors.riskHigh} />
                        <Text style={styles.bumpDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
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
    paddingBottom: 90,
  },
  headerRow: {
    marginBottom: 14,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  tabChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
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
    letterSpacing: 0.8,
    color: Colors.primaryDark,
  },
  todayPill: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
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
  },
  contractionTimerBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  contractionTimerDigits: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
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
  },
  contInterval: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  moodRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  moodChip: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  moodChipSelected: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryMuted,
  },
  moodEmoji: {
    fontSize: 22,
  },
  moodLabel: {
    fontSize: 11,
    color: Colors.textSoft,
    fontWeight: '600',
    marginTop: 2,
  },
  moodLabelSelected: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  fieldRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 4,
  },
  btnPrimary: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  journalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  journalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  journalMoodWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  journalEmoji: {
    fontSize: 18,
  },
  journalMoodText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  journalDate: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  journalContent: {
    fontSize: 13.5,
    color: Colors.text,
    lineHeight: 19,
  },
  bumpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bumpCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bumpVisualBox: {
    height: 120,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bumpVisualWeek: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 4,
  },
  bumpCardBody: {
    padding: 10,
  },
  bumpWeekBadge: {
    backgroundColor: Colors.secondarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bumpWeekBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.secondaryDark,
  },
  bumpNoteText: {
    fontSize: 12,
    color: Colors.text,
    marginBottom: 2,
  },
  bumpDateText: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  bumpDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  bumpDeleteText: {
    fontSize: 11,
    color: Colors.riskHigh,
    fontWeight: '700',
  },
});
