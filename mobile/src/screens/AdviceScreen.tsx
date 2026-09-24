import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import { buildRecommendations } from '../services/riskEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedRecommendationItem {
  id: string;
  text: string;
  category?: string;
  urgent: boolean;
  icon?: string;
  completed?: boolean;
}

export interface ReportedSymptom {
  name: string;
  severity: string;
}

export interface SavedAdviceEntry {
  id: string;
  source: 'symptoms' | 'coopland' | 'engine';
  title?: string;
  date: string;
  riskLevel: string;
  riskScore: number;
  symptomsReported: ReportedSymptom[];
  recommendations: SavedRecommendationItem[];
  notes?: string;
}

interface AdviceScreenProps {
  onNavigate?: (tab: string) => void;
  isDarkMode?: boolean;
}

export const AdviceScreen: React.FC<AdviceScreenProps> = ({ onNavigate, isDarkMode = false }) => {
  const [activeSegment, setActiveSegment] = useState<'current' | 'history'>('current');
  const [savedAdvice, setSavedAdvice] = useState<SavedAdviceEntry | null>(null);
  const [savedHistory, setSavedHistory] = useState<SavedAdviceEntry[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'daily' | 'completed'>('all');
  
  // Note editing modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Expanded card state in history
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const loadAdviceData = async () => {
    try {
      // 1. Load latest saved advice from AsyncStorage
      const latestSavedStr = await AsyncStorage.getItem('@pregnacare_latest_saved_advice');
      let currentActive: SavedAdviceEntry | null = null;
      if (latestSavedStr) {
        try {
          currentActive = JSON.parse(latestSavedStr);
          setSavedAdvice(currentActive);
        } catch {}
      }

      // 2. Load saved advice history
      const historyStr = await AsyncStorage.getItem('@pregnacare_saved_advice_history');
      if (historyStr) {
        try {
          const parsedHistory = JSON.parse(historyStr);
          if (Array.isArray(parsedHistory)) {
            setSavedHistory(parsedHistory);
          }
        } catch {}
      }

      // 3. Also fetch latest dashboard from API
      const res = await api.getDashboard().catch(() => null);
      if (res) {
        setData(res);
      }

      // 4. Fallback if no explicitly saved advice yet
      if (!currentActive) {
        const cachedCoopStr = await AsyncStorage.getItem('@pregnacare_latest_coopland');
        const localCoop = cachedCoopStr ? JSON.parse(cachedCoopStr) : null;
        const risk = res?.risk || {};

        const displayLevel = risk.level || localCoop?.level || 'Low';
        const displayScore = (risk.latestScore !== null && risk.latestScore !== undefined)
          ? risk.latestScore
          : (localCoop?.score ?? 0);

        let recsList = (risk.topRecommendations && risk.topRecommendations.length > 0)
          ? risk.topRecommendations
          : (localCoop?.recommendations || []);

        if (recsList.length === 0) {
          const defaultLevel = (displayLevel === 'Severe' || displayLevel === 'High') ? displayLevel : 'Low';
          recsList = buildRecommendations(defaultLevel as any, {
            age: 28,
            bp_sys: 120,
            bp_dia: 80,
            bmi: 22,
            symptoms: [],
          });
        }

        const formattedRecs: SavedRecommendationItem[] = recsList.map((r: any, idx: number) => {
          const text = typeof r === 'string' ? r : (r.text || '');
          const isUrgent = typeof r === 'string'
            ? (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('immediate') || text.toLowerCase().includes('hospital') || text.startsWith('🚨') || text.startsWith('⚠️') || displayLevel === 'Severe')
            : Boolean(r.urgent || (r.category && r.category.toLowerCase().includes('urgent')));
          const category = typeof r === 'string'
            ? (isUrgent ? 'Urgent Action' : 'Daily Care')
            : (r.category || (isUrgent ? 'Urgent Action' : 'Daily Care'));
          const icon = typeof r === 'string'
            ? (isUrgent ? 'alert-circle' : 'checkmark-circle')
            : (r.icon || (isUrgent ? 'alert-circle' : 'checkmark-circle'));

          return {
            id: `rec_init_${idx}`,
            text,
            category,
            urgent: isUrgent,
            icon,
            completed: false,
          };
        });

        const symptomsFromApi: ReportedSymptom[] = (risk.reportedSymptoms || []).map((s: any) => ({
          name: s.name || s.id,
          severity: s.severity || 'Mild',
        }));

        const initialEntry: SavedAdviceEntry = {
          id: `adv_init_${Date.now()}`,
          source: symptomsFromApi.length > 0 ? 'symptoms' : 'engine',
          title: symptomsFromApi.length > 0 ? 'Latest Symptom Check-in Guidance' : 'Personalized Clinical Guidance',
          date: risk.assessmentDate || new Date().toISOString(),
          riskLevel: displayLevel,
          riskScore: displayScore,
          symptomsReported: symptomsFromApi.length > 0 ? symptomsFromApi : (localCoop?.factors || []).map((f: string) => {
            const parts = f.split(' (');
            return { name: parts[0], severity: parts[1] ? parts[1].replace(')', '') : 'Present' };
          }),
          recommendations: formattedRecs,
          notes: '',
        };

        setSavedAdvice(initialEntry);
      }
    } catch (e: any) {
      console.warn('Advice load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdviceData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAdviceData();
  };

  // Toggle recommendation completion checkbox
  const handleToggleCheck = async (recId: string) => {
    if (!savedAdvice) return;
    const updatedRecs = savedAdvice.recommendations.map((r) => {
      if (r.id === recId) {
        return { ...r, completed: !r.completed };
      }
      return r;
    });

    const updatedAdvice: SavedAdviceEntry = {
      ...savedAdvice,
      recommendations: updatedRecs,
    };

    setSavedAdvice(updatedAdvice);
    await AsyncStorage.setItem('@pregnacare_latest_saved_advice', JSON.stringify(updatedAdvice)).catch(() => {});

    // Update in history list as well
    const updatedHistory = savedHistory.map((item) => {
      if (item.id === updatedAdvice.id) {
        return updatedAdvice;
      }
      return item;
    });
    setSavedHistory(updatedHistory);
    await AsyncStorage.setItem('@pregnacare_saved_advice_history', JSON.stringify(updatedHistory)).catch(() => {});
  };

  // Mark all recommendations complete or reset
  const handleMarkAll = async (completed: boolean) => {
    if (!savedAdvice) return;
    const updatedRecs = savedAdvice.recommendations.map((r) => ({
      ...r,
      completed,
    }));

    const updatedAdvice: SavedAdviceEntry = {
      ...savedAdvice,
      recommendations: updatedRecs,
    };

    setSavedAdvice(updatedAdvice);
    await AsyncStorage.setItem('@pregnacare_latest_saved_advice', JSON.stringify(updatedAdvice)).catch(() => {});

    const updatedHistory = savedHistory.map((item) => (item.id === updatedAdvice.id ? updatedAdvice : item));
    setSavedHistory(updatedHistory);
    await AsyncStorage.setItem('@pregnacare_saved_advice_history', JSON.stringify(updatedHistory)).catch(() => {});
  };

  // Save personal notes for this advice
  const handleSaveNote = async () => {
    if (!savedAdvice) return;
    const updatedAdvice: SavedAdviceEntry = {
      ...savedAdvice,
      notes: noteText.trim(),
    };

    setSavedAdvice(updatedAdvice);
    await AsyncStorage.setItem('@pregnacare_latest_saved_advice', JSON.stringify(updatedAdvice)).catch(() => {});

    const updatedHistory = savedHistory.map((item) => (item.id === updatedAdvice.id ? updatedAdvice : item));
    setSavedHistory(updatedHistory);
    await AsyncStorage.setItem('@pregnacare_saved_advice_history', JSON.stringify(updatedHistory)).catch(() => {});

    setShowNoteModal(false);
  };

  // Set past history record as active advice
  const handleRestoreFromHistory = async (entry: SavedAdviceEntry) => {
    setSavedAdvice(entry);
    await AsyncStorage.setItem('@pregnacare_latest_saved_advice', JSON.stringify(entry)).catch(() => {});
    setActiveSegment('current');
    Alert.alert('Guidance Activated', 'This assessment has been restored as your current active advice.');
  };

  // Delete past history entry
  const handleDeleteHistoryEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Saved Record',
      'Are you sure you want to remove this recommendation from your saved history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const filtered = savedHistory.filter((item) => item.id !== entryId);
            setSavedHistory(filtered);
            await AsyncStorage.setItem('@pregnacare_saved_advice_history', JSON.stringify(filtered)).catch(() => {});
          },
        },
      ]
    );
  };

  // Clear all history
  const handleClearAllHistory = () => {
    Alert.alert(
      'Clear All Saved History',
      'This will remove all stored past recommendation records from your history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setSavedHistory([]);
            await AsyncStorage.removeItem('@pregnacare_saved_advice_history').catch(() => {});
          },
        },
      ]
    );
  };

  // Share advice text with caregiver or doctor
  const handleShareAdvice = async () => {
    if (!savedAdvice) return;
    try {
      const recsText = savedAdvice.recommendations
        .map((r, i) => `${i + 1}. [${r.completed ? 'COMPLETED' : 'PENDING'}] ${r.text}`)
        .join('\n');
      
      const symptomsText = savedAdvice.symptomsReported.length > 0
        ? savedAdvice.symptomsReported.map(s => `• ${s.name}: ${s.severity}`).join('\n')
        : 'No acute symptoms reported';

      const message = `PregnaCare Maternal Recommendations\n` +
        `Date: ${new Date(savedAdvice.date).toLocaleDateString()}\n\n` +
        `Reported Symptoms:\n${symptomsText}\n\n` +
        `Clinical Guidance & Action Items:\n${recsText}` +
        (savedAdvice.notes ? `\n\nNotes:\n${savedAdvice.notes}` : '');

      await Share.share({ message });
    } catch {}
  };

  // Risk styling helpers
  const displayLevel = savedAdvice?.riskLevel || 'Low';
  const displayScore = savedAdvice?.riskScore ?? 0;
  const isSevere = displayLevel.toLowerCase().includes('severe');
  const isHigh = !isSevere && (displayLevel.toLowerCase().includes('high') || displayLevel.toLowerCase().includes('mod'));
  
  const riskColor = isSevere ? Colors.riskHigh : (isHigh ? Colors.riskMod : Colors.primaryDark);
  const riskBg = isSevere ? '#FEE2E2' : (isHigh ? '#FEF3C7' : '#DCFCE7');
  const riskBorder = isSevere ? '#FCA5A5' : (isHigh ? '#FCD34D' : '#BBF7D0');

  // Filter recommendations
  const allRecs = savedAdvice?.recommendations || [];
  const filteredRecs = useMemo(() => {
    switch (filter) {
      case 'urgent':
        return allRecs.filter((r) => r.urgent);
      case 'daily':
        return allRecs.filter((r) => !r.urgent);
      case 'completed':
        return allRecs.filter((r) => r.completed);
      default:
        return allRecs;
    }
  }, [allRecs, filter]);

  const urgentCount = allRecs.filter((r) => r.urgent).length;
  const dailyCount = allRecs.filter((r) => !r.urgent).length;
  const completedCount = allRecs.filter((r) => r.completed).length;
  const progressPercent = allRecs.length > 0 ? Math.round((completedCount / allRecs.length) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.centerContainer, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
        <Text style={[styles.loadingText, isDarkMode && { color: '#BBB' }]}>Loading clinical advice &amp; recommendations...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
      {/* ── Top Segment Selector: Active Advice vs Saved History ── */}
      <View style={[styles.segmentContainer, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
        <TouchableOpacity
          onPress={() => setActiveSegment('current')}
          style={[
            styles.segmentBtn,
            activeSegment === 'current' && styles.segmentBtnActive,
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="bulb-outline"
            size={16}
            color={activeSegment === 'current' ? '#FFF' : (isDarkMode ? '#AAA' : Colors.textSoft)}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSegment === 'current' && styles.segmentBtnTextActive,
              isDarkMode && activeSegment !== 'current' && { color: '#AAA' },
            ]}
          >
            Active Guidance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveSegment('history')}
          style={[
            styles.segmentBtn,
            activeSegment === 'history' && styles.segmentBtnActive,
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeSegment === 'history' ? '#FFF' : (isDarkMode ? '#AAA' : Colors.textSoft)}
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSegment === 'history' && styles.segmentBtnTextActive,
              isDarkMode && activeSegment !== 'current' && { color: '#AAA' },
            ]}
          >
            Saved History ({savedHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
      >
        {activeSegment === 'current' && (
          <>
            {/* 1. Hero Care Plan Guidance Banner */}
            <LinearGradient
              colors={Gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCard, Shadows.card]}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroEyebrowBadge}>
                  <Ionicons name="bulb-outline" size={13} color="#FFF" />
                  <Text style={styles.heroEyebrow}>
                    CARE & CLINICAL RECOMMENDATIONS
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleShareAdvice}
                  activeOpacity={0.8}
                  style={styles.heroShareBtn}
                >
                  <Ionicons name="share-outline" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.heroTitle}>Personalized Care Plan</Text>
              <Text style={styles.heroSubtitle}>
                Actionable maternal guidance and recommendations tailored to your reported symptoms and check-in.
              </Text>

              <Text style={styles.heroTimestamp}>
                Logged {savedAdvice?.date ? new Date(savedAdvice.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
              </Text>

              <View style={styles.heroLinkRow}>
                <TouchableOpacity
                  onPress={() => onNavigate?.('symptoms')}
                  activeOpacity={0.7}
                  style={[styles.heroLinkBtn, { marginLeft: 'auto' }]}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.heroLinkText}>New Check-in</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* 2. Reported Symptoms Section (SEEN & STORED) */}
            <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.iconPill, { backgroundColor: isDarkMode ? '#2C2C31' : '#E6F4F1' }]}>
                    <Ionicons name="medkit" size={16} color={Colors.primaryDark} />
                  </View>
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#FFF' }]}>
                    Reported Symptoms During Check-in
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onNavigate?.('symptoms')}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Update</Text>
                </TouchableOpacity>
              </View>

              {savedAdvice?.symptomsReported && savedAdvice.symptomsReported.length > 0 ? (
                <View style={styles.symptomsWrap}>
                  {savedAdvice.symptomsReported.map((sym, idx) => {
                    const sev = (sym.severity || 'Mild').toLowerCase();
                    const isSymSevere = sev.includes('severe');
                    const isSymMod = sev.includes('mod');

                    const symBadgeBg = isSymSevere ? '#FEE2E2' : (isSymMod ? '#FEF3C7' : (isDarkMode ? '#2C2C31' : '#E6F4F1'));
                    const symBadgeBorder = isSymSevere ? '#FCA5A5' : (isSymMod ? '#FCD34D' : (isDarkMode ? '#3A3A40' : '#B2DFDB'));
                    const symTextColor = isSymSevere ? '#DC2626' : (isSymMod ? '#D97706' : Colors.primaryDark);

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.symptomChip,
                          { backgroundColor: symBadgeBg, borderColor: symBadgeBorder },
                        ]}
                      >
                        <Ionicons
                          name={isSymSevere ? 'alert-circle' : (isSymMod ? 'warning' : 'checkmark-circle')}
                          size={14}
                          color={symTextColor}
                        />
                        <Text style={[styles.symptomChipName, isDarkMode && !isSymSevere && !isSymMod && { color: '#FFF' }]}>
                          {sym.name}:{' '}
                        </Text>
                        <Text style={[styles.symptomChipSeverity, { color: symTextColor }]}>
                          {sym.severity}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptySymptomsBox}>
                  <Ionicons name="checkmark-done-circle-outline" size={24} color={Colors.primaryDark} />
                  <Text style={[styles.emptySymptomsText, isDarkMode && { color: '#AAA' }]}>
                    Routine Check-in: No acute maternal symptoms reported.
                  </Text>
                </View>
              )}
            </View>

            {/* 3. Action Checklist Management Bar (MANAGE) */}
            <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#FFF' }]}>
                    Care Actions Checklist
                  </Text>
                  <Text style={[styles.checklistSubtitle, isDarkMode && { color: '#888' }]}>
                    {completedCount} of {allRecs.length} recommendations followed ({progressPercent}%)
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleMarkAll(completedCount < allRecs.length)}
                    style={[styles.smallActionBtn, { backgroundColor: isDarkMode ? '#2C2C31' : '#F0F9F8' }]}
                  >
                    <Text style={styles.smallActionBtnText}>
                      {completedCount < allRecs.length ? 'Check All' : 'Reset'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent === 100 ? '#10B981' : Colors.primaryDark,
                    },
                  ]}
                />
              </View>

              {/* Filter Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterRow}
              >
                <TouchableOpacity
                  onPress={() => setFilter('all')}
                  style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
                    All ({allRecs.length})
                  </Text>
                </TouchableOpacity>

                {urgentCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setFilter('urgent')}
                    style={[
                      styles.filterChip,
                      filter === 'urgent' && [styles.filterChipActive, { backgroundColor: '#DC2626' }],
                    ]}
                  >
                    <Text style={[styles.filterChipText, filter === 'urgent' && styles.filterChipTextActive]}>
                      Urgent ({urgentCount})
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setFilter('daily')}
                  style={[styles.filterChip, filter === 'daily' && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filter === 'daily' && styles.filterChipTextActive]}>
                    Daily Care ({dailyCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilter('completed')}
                  style={[
                    styles.filterChip,
                    filter === 'completed' && [styles.filterChipActive, { backgroundColor: '#10B981' }],
                  ]}
                >
                  <Text style={[styles.filterChipText, filter === 'completed' && styles.filterChipTextActive]}>
                    Completed ({completedCount})
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Recommendations Items List */}
              <View style={styles.recsListContainer}>
                {filteredRecs.length > 0 ? (
                  filteredRecs.map((rec) => {
                    return (
                      <TouchableOpacity
                        key={rec.id}
                        onPress={() => handleToggleCheck(rec.id)}
                        activeOpacity={0.85}
                        style={[
                          styles.recItemCard,
                          rec.completed && styles.recItemCardCompleted,
                          rec.urgent && !rec.completed && styles.recItemCardUrgent,
                          isDarkMode && { backgroundColor: rec.completed ? '#1E2922' : '#23232A', borderColor: rec.completed ? '#059669' : '#333' },
                        ]}
                      >
                        <View style={styles.recItemCheckRow}>
                          <TouchableOpacity
                            onPress={() => handleToggleCheck(rec.id)}
                            style={[
                              styles.checkbox,
                              rec.completed && styles.checkboxChecked,
                              rec.urgent && !rec.completed && styles.checkboxUrgent,
                            ]}
                          >
                            {rec.completed ? (
                              <Ionicons name="checkmark" size={14} color="#FFF" />
                            ) : rec.urgent ? (
                              <Ionicons name="alert" size={12} color="#DC2626" />
                            ) : null}
                          </TouchableOpacity>

                          <View style={{ flex: 1 }}>
                            <View style={styles.recHeaderRow}>
                              <Text
                                style={[
                                  styles.recCategoryBadge,
                                  rec.urgent ? { color: '#DC2626' } : { color: Colors.primaryDark },
                                  rec.completed && { color: '#10B981' },
                                ]}
                              >
                                {rec.category || (rec.urgent ? 'URGENT ACTION' : 'DAILY CARE')}
                              </Text>
                              {rec.completed && (
                                <View style={styles.completedPill}>
                                  <Text style={styles.completedPillText}>Followed ✓</Text>
                                </View>
                              )}
                            </View>

                            <Text
                              style={[
                                styles.recItemText,
                                rec.completed && styles.recItemTextCompleted,
                                rec.urgent && !rec.completed && styles.recItemTextUrgent,
                                isDarkMode && !rec.completed && { color: '#EEE' },
                              ]}
                            >
                              {rec.text}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyFilteredState}>
                    <Ionicons name="checkbox-outline" size={28} color={Colors.textMuted} />
                    <Text style={[styles.emptyFilteredText, isDarkMode && { color: '#888' }]}>
                      No recommendations in this filter.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 4. Personal Clinical Note Box (MANAGE) */}
            <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.iconPill, { backgroundColor: isDarkMode ? '#2C2C31' : '#F0F9F8' }]}>
                    <Ionicons name="clipboard-outline" size={16} color={Colors.primaryDark} />
                  </View>
                  <Text style={[styles.sectionTitle, isDarkMode && { color: '#FFF' }]}>
                    Personal Notes &amp; Follow-up
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setNoteText(savedAdvice?.notes || '');
                    setShowNoteModal(true);
                  }}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>
                    {savedAdvice?.notes ? 'Edit Note' : '+ Add Note'}
                  </Text>
                </TouchableOpacity>
              </View>

              {savedAdvice?.notes ? (
                <View style={[styles.noteDisplayBox, isDarkMode && { backgroundColor: '#23232A', borderColor: '#333' }]}>
                  <Text style={[styles.noteDisplayText, isDarkMode && { color: '#EEE' }]}>
                    {savedAdvice.notes}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.notePlaceholder, isDarkMode && { color: '#888' }]}>
                  Record instructions given by your doctor/midwife, or log personal reminders about this guidance.
                </Text>
              )}
            </View>

            {/* 5. Danger Signs Guide */}
            <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="warning" size={18} color={Colors.riskHigh} />
                <Text style={[styles.sectionTitle, { color: Colors.riskHigh }]}>
                  Maternal Warning Signs
                </Text>
              </View>
              <Text style={[styles.guideText, isDarkMode && { color: '#AAA' }]}>
                Contact your obstetrician or hospital emergency triage immediately if you experience:
              </Text>
              <View style={styles.bulletList}>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Severe persistent headache not relieved by rest</Text>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Any bright red vaginal bleeding or spotting</Text>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Sudden visual disturbances, blurring, or spots</Text>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Sudden swelling of face, hands, or around eyes</Text>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Noticeable decrease in baby kicks or fetal activity</Text>
                <Text style={[styles.bulletItem, isDarkMode && { color: '#DDD' }]}>• Clear or watery fluid leaking from vagina</Text>
              </View>
            </View>
          </>
        )}

        {/* ── SEGMENT 2: SAVED HISTORY (STORED & MANAGED) ── */}
        {activeSegment === 'history' && (
          <View>
            <View style={styles.historyHeaderRow}>
              <Text style={[styles.historyHeaderTitle, isDarkMode && { color: '#FFF' }]}>
                Saved Assessment Records
              </Text>
              {savedHistory.length > 0 && (
                <TouchableOpacity onPress={handleClearAllHistory} style={styles.clearHistoryBtn}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text style={styles.clearHistoryText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {savedHistory.length > 0 ? (
              savedHistory.map((item, index) => {
                const isExpanded = expandedHistoryId === item.id;
                const isCurrentlyActive = savedAdvice?.id === item.id;

                const completedInItem = item.recommendations.filter((r) => r.completed).length;

                return (
                  <View
                    key={item.id || index}
                    style={[
                      styles.historyCard,
                      Shadows.card,
                      isCurrentlyActive && { borderColor: Colors.primaryDark, borderWidth: 2 },
                      isDarkMode && { backgroundColor: '#1A1A1E', borderColor: isCurrentlyActive ? Colors.primaryDark : '#2C2C31' },
                    ]}
                  >
                    <View style={styles.historyCardTopRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View style={[styles.historyRiskPill, { backgroundColor: isDarkMode ? '#2C2C31' : '#E6F4F1' }]}>
                            <Text style={[styles.historyRiskPillText, { color: Colors.primaryDark }]}>
                              RECOMMENDATION PLAN
                            </Text>
                          </View>
                          {isCurrentlyActive && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.historyDate, isDarkMode && { color: '#AAA' }]}>
                          {new Date(item.date).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        <Text style={[styles.historyRecsCount, { fontSize: 13, fontWeight: '600' }, isDarkMode && { color: '#BBB' }]}>
                          {completedInItem}/{item.recommendations.length} followed
                        </Text>
                      </View>
                    </View>

                    {/* Reported Symptoms Summary in History */}
                    {item.symptomsReported && item.symptomsReported.length > 0 && (
                      <View style={styles.historySymptomsRow}>
                        <Text style={[styles.historySymTitle, isDarkMode && { color: '#AAA' }]}>Symptoms:</Text>
                        <View style={styles.historySymChips}>
                          {item.symptomsReported.map((s, si) => (
                            <View key={si} style={[styles.historySymChip, isDarkMode && { backgroundColor: '#2C2C31', borderColor: '#333' }]}>
                              <Text style={[styles.historySymChipText, isDarkMode && { color: '#EEE' }]}>
                                {s.name} ({s.severity})
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Expand/Collapse Recommendations Details */}
                    {isExpanded && (
                      <View style={[styles.historyExpandedContent, isDarkMode && { borderTopColor: '#2C2C31' }]}>
                        <Text style={[styles.expandedRecsTitle, isDarkMode && { color: '#FFF' }]}>
                          Recommendations Stored:
                        </Text>
                        {item.recommendations.map((r, ri) => (
                          <View key={ri} style={styles.historyRecRow}>
                            <Ionicons
                              name={r.completed ? 'checkmark-circle' : 'ellipse-outline'}
                              size={15}
                              color={r.completed ? '#10B981' : Colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.historyRecText,
                                r.completed && { textDecorationLine: 'line-through', color: Colors.textMuted },
                                isDarkMode && !r.completed && { color: '#DDD' },
                              ]}
                            >
                              {r.text}
                            </Text>
                          </View>
                        ))}

                        {item.notes ? (
                          <View style={[styles.historyNoteBox, isDarkMode && { backgroundColor: '#23232A', borderColor: '#333' }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 2 }}>NOTE:</Text>
                            <Text style={[{ fontSize: 13, color: Colors.text }, isDarkMode && { color: '#EEE' }]}>{item.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* History Card Actions */}
                    <View style={styles.historyActionsRow}>
                      <TouchableOpacity
                        onPress={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        style={styles.historyActionBtn}
                      >
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.primaryDark} />
                        <Text style={styles.historyActionText}>{isExpanded ? 'Hide Details' : 'View Details'}</Text>
                      </TouchableOpacity>

                      {!isCurrentlyActive && (
                        <TouchableOpacity
                          onPress={() => handleRestoreFromHistory(item)}
                          style={[styles.historyActionBtn, styles.restoreBtn]}
                        >
                          <Ionicons name="refresh" size={14} color="#FFF" />
                          <Text style={[styles.historyActionText, { color: '#FFF' }]}>Set as Active</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleDeleteHistoryEntry(item.id)}
                        style={[styles.historyActionBtn, { marginLeft: 'auto' }]}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={[styles.emptyHistoryBox, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                <Ionicons name="bookmark-outline" size={42} color={Colors.textMuted} />
                <Text style={[styles.emptyHistoryTitle, isDarkMode && { color: '#FFF' }]}>
                  No Saved Recommendations Yet
                </Text>
                <Text style={[styles.emptyHistoryDesc, isDarkMode && { color: '#888' }]}>
                  When you submit your symptoms in the Check-in tab and tap &ldquo;Save to Advice&rdquo;, the full clinical assessment and recommendations will be stored and managed here.
                </Text>
                <TouchableOpacity
                  onPress={() => onNavigate?.('symptoms')}
                  style={styles.startCheckinBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.startCheckinBtnText}>Start Symptom Check-in</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Note Editing Modal */}
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.noteModalCard, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#FFF' }]}>Clinical Advice Notes</Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#FFF' : Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, isDarkMode && { color: '#AAA' }]}>
              Add clinical instructions, doctor advice, or personal notes for this symptom recommendation session.
            </Text>

            <TextInput
              style={[styles.noteInput, isDarkMode && { backgroundColor: '#23232A', borderColor: '#333', color: '#FFF' }]}
              placeholder="e.g. Spoke with midwife Dr. Santos. Advised to rest with feet elevated and take prescribed hydration salts..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              multiline
              numberOfLines={4}
              value={noteText}
              onChangeText={setNoteText}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                onPress={() => setShowNoteModal(false)}
                style={[styles.modalBtn, { backgroundColor: isDarkMode ? '#2C2C31' : '#EEE' }]}
              >
                <Text style={[styles.modalBtnText, { color: isDarkMode ? '#FFF' : Colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveNote}
                style={[styles.modalBtn, { backgroundColor: Colors.primaryDark }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Save Note</Text>
              </TouchableOpacity>
            </View>
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
  scroll: {
    flex: 1,
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primaryDark,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  segmentBtnTextActive: {
    color: '#FFF',
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroEyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroShareBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 4,
  },
  heroTimestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  heroLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroLinkText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.text,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  symptomsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  symptomChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  symptomChipSeverity: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptySymptomsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  emptySymptomsText: {
    fontSize: 13,
    color: Colors.textSoft,
    flex: 1,
  },
  checklistSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  smallActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  recsListContainer: {
    gap: 10,
  },
  recItemCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recItemCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0',
  },
  recItemCardUrgent: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECACA',
  },
  recItemCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxUrgent: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  recHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recCategoryBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  completedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  completedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  recItemText: {
    fontSize: 13.5,
    color: Colors.text,
    lineHeight: 19,
  },
  recItemTextCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  recItemTextUrgent: {
    fontWeight: '700',
    color: '#991B1B',
  },
  emptyFilteredState: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  emptyFilteredText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  noteDisplayBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteDisplayText: {
    fontSize: 13.5,
    color: Colors.text,
    lineHeight: 19,
  },
  notePlaceholder: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  guideText: {
    fontSize: 13,
    color: Colors.textSoft,
    lineHeight: 19,
    marginBottom: 8,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    fontSize: 12.5,
    color: Colors.text,
    lineHeight: 18,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearHistoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyRiskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  historyRiskPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  historyScore: {
    fontSize: 18,
    fontWeight: '800',
  },
  historyRecsCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  historySymptomsRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  historySymTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  historySymChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historySymChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historySymChipText: {
    fontSize: 11,
    color: Colors.text,
  },
  historyExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  expandedRecsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  historyRecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  historyRecText: {
    fontSize: 12.5,
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
  historyNoteBox: {
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  historyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  historyActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  restoreBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emptyHistoryBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyHistoryDesc: {
    fontSize: 13,
    color: Colors.textSoft,
    textAlign: 'center',
    lineHeight: 19,
  },
  startCheckinBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  startCheckinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  noteModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: Colors.textSoft,
    lineHeight: 18,
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 13.5,
    color: Colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
