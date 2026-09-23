import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { BabySizeCard } from '../components/BabySizeCard';
import { RiskGauge } from '../components/RiskGauge';
import { api } from '../services/api';
import { sendPhoneNotification, scheduleObVisitNotification } from '../services/notifications';
import { getMilestoneForWeek } from '../data/pregnancyMilestones';
import { buildRecommendations } from '../services/riskEngine';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  onOpenDrawer?: () => void;
  onOpenNotifications?: () => void;
  currentUser?: any;
  isDarkMode?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenDrawer,
  onOpenNotifications,
  currentUser,
  isDarkMode = false,
}) => {
  const [data, setData] = useState<any>(null);
  const [latestCoopland, setLatestCoopland] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localResolved, setLocalResolved] = useState<any>(null);

  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [facilityInput, setFacilityInput] = useState('');
  const [doctorInput, setDoctorInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  const [obVisitInput, setObVisitInput] = useState('');
  const [savingObVisit, setSavingObVisit] = useState(false);

  // Pink Bubble Flash State
  const [bubbleFlash, setBubbleFlash] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon?: string;
    buttonText?: string;
  } | null>(null);

  const showBubbleFlash = (
    title: string,
    message: string,
    icon: string = 'checkmark-circle',
    buttonText: string = 'Got it ✨'
  ) => {
    setBubbleFlash({
      visible: true,
      title,
      message,
      icon,
      buttonText,
    });
  };

  useEffect(() => {
    AsyncStorage.getItem('@pregnacare_latest_coopland').then((val) => {
      if (val) {
        try {
          setLatestCoopland(JSON.parse(val));
        } catch {}
      }
    });
    AsyncStorage.getItem('@pregnacare_resolved_visit').then((val) => {
      if (val) {
        try {
          setLocalResolved(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const fetchDashboard = useCallback(async () => {
    // 1. Immediately read latest local Coopland assessment so UI updates instantaneously
    try {
      const val = await AsyncStorage.getItem('@pregnacare_latest_coopland');
      if (val) {
        setLatestCoopland(JSON.parse(val));
      }
      const resVisit = await AsyncStorage.getItem('@pregnacare_resolved_visit');
      if (resVisit) {
        setLocalResolved(JSON.parse(resVisit));
      } else {
        setLocalResolved(null);
      }
    } catch {}

    try {
      // 2. Sync pending offline mutations if back online
      await api.syncOfflineQueue().catch(() => {});

      // 3. Fetch dashboard records
      const res = await api.getDashboard();
      setData(res);

      // Check for gestational milestone notification
      const weeks = res?.pregnancy?.weeks !== null && res?.pregnancy?.weeks !== undefined ? res.pregnancy.weeks : 32;
      const lastNotified = await AsyncStorage.getItem('@pregnacare_last_notified_week');
      if (lastNotified !== String(weeks)) {
        await AsyncStorage.setItem('@pregnacare_last_notified_week', String(weeks));
        const milestone = getMilestoneForWeek(weeks);
        sendPhoneNotification(
          `🎉 Week ${weeks} Milestone!`,
          `Baby is now the size of a ${milestone.sizeName} (${milestone.emoji}). Check your dashboard for baby's new developmental milestones & care tips!`,
          { type: 'milestone', week: weeks }
        ).catch(() => {});
      }
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

  useEffect(() => {
    if (data?.pregnancy?.nextObVisit) {
      setObVisitInput(data.pregnancy.nextObVisit);
    }
  }, [data?.pregnancy?.nextObVisit]);

  const handleSaveObReminder = async () => {
    const val = obVisitInput.trim();
    if (!val) {
      showBubbleFlash('Required Date', 'Please enter your next OB-GYN checkup date (YYYY-MM-DD).', 'calendar-outline', 'OK');
      return;
    }
    setSavingObVisit(true);
    try {
      await api.setObVisit(val);

      // Trigger phone system notification
      const parts = val.split('-');
      let bodyText = `Your prenatal checkup has been scheduled for ${val}.`;
      if (parts.length === 3) {
        const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        target.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        const dateLabel = formatEddDate(val);
        bodyText = diffDays === 0
          ? `Your prenatal checkup is TODAY (${dateLabel})! Please visit your clinic.`
          : `Your prenatal checkup is in ${diffDays} day(s), on ${dateLabel}.`;
      }
      await sendPhoneNotification('OB-GYN Visit Reminder 🩺', bodyText, { date: val });
      await scheduleObVisitNotification(val, formatEddDate(val));

      showBubbleFlash(
        'Reminder Saved! 📅',
        `Your next prenatal checkup has been scheduled for ${val}. A phone notification has been set.`,
        'calendar-outline',
        'Got it ✨'
      );
      fetchDashboard();
    } catch (e: any) {
      showBubbleFlash('Notice', e.message || 'Unable to save reminder', 'alert-circle', 'OK');
    } finally {
      setSavingObVisit(false);
    }
  };

  const handleToggleHomeMed = async (medId: string) => {
    try {
      await api.toggleMedicationTaken(medId);
      fetchDashboard();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status');
    }
  };

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
  const coopScore = latestCoopland?.score !== undefined ? latestCoopland.score : (risk?.cooplandScore ?? 0);
  const coopLevelStr = latestCoopland?.level || risk?.level || 'Low';
  const rawLevel = coopLevelStr.toString().toLowerCase();
  const isSevereLevel = rawLevel.includes('severe');
  const isHighLevel = !isSevereLevel && (rawLevel.includes('high') || rawLevel.includes('mod'));
  const isLowLevel = !isSevereLevel && !isHighLevel;

  const localResolvedDate = localResolved?.date ? new Date(localResolved.date).getTime() : 0;
  const assessmentDate = latestCoopland?.date
    ? new Date(latestCoopland.date).getTime()
    : (risk?.assessmentDate ? new Date(risk.assessmentDate).getTime() : 0);

  // Only consider resolved if the doctor visit resolution occurred strictly AFTER the current assessment date
  const isResolved = Boolean(localResolved) && localResolvedDate > assessmentDate;

  const isSevere = !isResolved && isSevereLevel;
  const isHigh = !isResolved && isHighLevel;

  const activeLevelStr = isSevereLevel ? 'Severe' : (isHighLevel ? 'High' : 'Low');
  const riskPrimaryColor = isSevereLevel ? '#DC2626' : (isHighLevel ? '#D97706' : '#15803D');
  const riskBgColor = isSevereLevel ? '#FEE2E2' : (isHighLevel ? '#FEF3C7' : '#DCFCE7');
  const riskBorderColor = isSevereLevel ? '#FCA5A5' : (isHighLevel ? '#FCD34D' : '#BBF7D0');

  let recs = (latestCoopland?.recommendations && latestCoopland.recommendations.length > 0)
    ? latestCoopland.recommendations.map((r: string, idx: number) => ({
        text: r,
        urgent: isSevereLevel || (isHighLevel && idx === 0),
        category: isSevereLevel ? 'Urgent Action' : (isHighLevel ? 'Priority Care' : 'Routine Care'),
        icon: isSevereLevel ? 'alert-circle' : (isHighLevel ? 'warning' : 'checkmark-circle'),
      }))
    : (risk?.topRecommendations || []);

  if (recs.length === 0) {
    const defaultLevel = isSevereLevel ? 'Severe' : (isHighLevel ? 'High' : 'Low');
    recs = buildRecommendations(defaultLevel as any, {
      age: 28,
      bp_sys: 120,
      bp_dia: 80,
      bmi: 22,
      symptoms: [],
    });
  }

  const effectiveFactors = latestCoopland?.factors || risk?.factors || [];

  const handleSaveVisit = async () => {
    if (!facilityInput.trim()) {
      showBubbleFlash('Required Field', 'Please enter the hospital or clinic name.', 'alert-circle', 'OK');
      return;
    }
    setSubmittingVisit(true);
    const resolvedRecord = {
      facility: facilityInput.trim(),
      doctor: doctorInput.trim(),
      notes: notesInput.trim(),
      date: new Date().toISOString(),
      archivedScore: risk?.latestScore || 70,
    };
    try {
      // 1. Immediately store to local storage so UI transitions instantly
      await AsyncStorage.setItem('@pregnacare_resolved_visit', JSON.stringify(resolvedRecord));
      setLocalResolved(resolvedRecord);

      // 2. Sync with backend API
      try {
        await api.resolveClinicalVisit({
          assessment_id: risk?.assessmentId,
          facility: facilityInput.trim(),
          doctor_name: doctorInput.trim(),
          notes: notesInput.trim(),
        });
      } catch (syncErr: any) {
        console.warn('Backend sync failed, stored locally:', syncErr.message);
      }

      setVisitModalVisible(false);
      setFacilityInput('');
      setDoctorInput('');
      setNotesInput('');
      fetchDashboard();

      // Show beautiful Pink Bubble Flash Dialog
      showBubbleFlash(
        'Visit Recorded',
        'Your medical consultation has been archived into your clinical history. The severe risk is now in your records, and you can start a fresh assessment anytime!',
        'checkmark-circle',
        'Got it ✨'
      );
    } catch (e: any) {
      showBubbleFlash('Notice', e.message || 'Unable to save medical visit', 'alert-circle', 'OK');
    } finally {
      setSubmittingVisit(false);
    }
  };

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
      style={[styles.container, isDarkMode && { backgroundColor: '#0A0A0C' }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
    >
      {/* Body Cards Container */}
      <View style={styles.bodyContent}>
        {/* Offline Mode Status Banner */}
        {Boolean(data?._isOffline || api.getIsOffline()) && (
          <View style={[styles.offlineBanner, isDarkMode && { backgroundColor: '#261F18', borderColor: '#4A3723' }]}>
            <Ionicons name="cloud-offline" size={16} color="#D97706" />
            <Text style={[styles.offlineBannerText, isDarkMode && { color: '#FBBF24' }]}>
              Offline Mode • Showing cached health records
            </Text>
          </View>
        )}

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
          <View
            style={[
              styles.reminderBanner,
              Shadows.card,
              isDarkMode && {
                backgroundColor: '#1A1A1E',
                borderColor: '#2C2C31',
              },
            ]}
          >
            <View style={styles.reminderContent}>
              <View style={[styles.reminderIconCircle, isDarkMode && { backgroundColor: '#1D2836' }]}>
                <Ionicons name="notifications" size={20} color={isDarkMode ? '#A2D2FF' : Colors.secondaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.reminderTitle, isDarkMode && { color: '#F0EEF0' }]}>
                  Daily check-in reminder
                </Text>
                <Text style={[styles.reminderDesc, isDarkMode && { color: '#B8B4BA' }]}>
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
                  style={[styles.btnOutlineSm, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
                  onPress={() => onNavigate('vitals')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnOutlineSmText, isDarkMode && { color: '#F0EEF0' }]}>Log Vitals</Text>
                </TouchableOpacity>
              )}
              {!checkin.symptomsLoggedToday && (
                <TouchableOpacity
                  style={[styles.btnPrimarySm, isDarkMode && { backgroundColor: '#C2577D' }]}
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
          isDarkMode={isDarkMode}
        />

        {/* Active Severe or High Maternal Risk Alert Banner */}
        {isSevere && (
          <View
            style={[
              styles.riskBanner,
              {
                backgroundColor: isDarkMode ? '#2E1419' : '#FEE2E2',
                borderColor: isDarkMode ? '#E15D74' : '#F87171',
              },
              Shadows.card,
            ]}
          >
            <View style={styles.riskBannerContent}>
              <View style={[styles.riskBannerIconCircle, { backgroundColor: isDarkMode ? '#3A1F26' : '#FECACA' }]}>
                <Ionicons name="alert-circle" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskBannerTitle, { color: '#DC2626' }]}>
                  🚨 URGENT: SEVERE MATERNAL RISK DETECTED
                </Text>
                <Text style={[styles.riskBannerDesc, { color: isDarkMode ? '#FCA5A5' : '#991B1B' }]}>
                  Coopland Score: {coopScore}. Immediate medical evaluation at the nearest hospital triage or consultation with your OB-GYN is strongly advised.
                </Text>
              </View>
            </View>
            <View style={styles.riskBannerActions}>
              <TouchableOpacity
                style={[styles.riskBannerBtn, { backgroundColor: '#DC2626' }]}
                onPress={() => onNavigate('analyze')}
                activeOpacity={0.8}
              >
                <Text style={styles.riskBannerBtnText}>View Risk Analysis</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.riskBannerBtnOutline, { borderColor: '#DC2626' }]}
                onPress={() => setVisitModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.riskBannerBtnOutlineText, { color: '#DC2626' }]}>Record Doctor Visit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isHigh && (
          <View
            style={[
              styles.riskBanner,
              {
                backgroundColor: isDarkMode ? '#2B2310' : '#FEF3C7',
                borderColor: isDarkMode ? '#F0B254' : '#FCD34D',
              },
              Shadows.card,
            ]}
          >
            <View style={styles.riskBannerContent}>
              <View style={[styles.riskBannerIconCircle, { backgroundColor: isDarkMode ? '#3A2C15' : '#FDE68A' }]}>
                <Ionicons name="warning" size={24} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskBannerTitle, { color: '#B45309' }]}>
                  ⚠️ HIGH MATERNAL RISK DETECTED
                </Text>
                <Text style={[styles.riskBannerDesc, { color: isDarkMode ? '#FCD34D' : '#92400E' }]}>
                  Coopland Score: {coopScore}. One or more high-risk criteria were identified. Please schedule an OB-GYN checkup within 24 to 48 hours.
                </Text>
              </View>
            </View>
            <View style={styles.riskBannerActions}>
              <TouchableOpacity
                style={[styles.riskBannerBtn, { backgroundColor: '#D97706' }]}
                onPress={() => onNavigate('analyze')}
                activeOpacity={0.8}
              >
                <Text style={styles.riskBannerBtnText}>View Clinical Breakdown</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Current Maternal Risk Status Card */}
        <View
          style={[
            styles.card,
            Shadows.card,
            !isResolved && isSevere && { borderColor: isDarkMode ? '#E15D74' : '#FCA5A5', borderWidth: 1.5, backgroundColor: isDarkMode ? '#1E1215' : '#FFFBFB' },
            !isResolved && isHigh && { borderColor: isDarkMode ? '#F0B254' : '#FCD34D', borderWidth: 1.5, backgroundColor: isDarkMode ? '#1C1910' : '#FFFDF7' },
            !isResolved && isLowLevel && { borderColor: isDarkMode ? '#2C2C31' : '#E8F5EB' },
            isDarkMode && !isSevere && !isHigh && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[
                styles.eyebrow,
                !isResolved && isSevere && { color: '#DC2626' },
                !isResolved && isHigh && { color: '#D97706' },
                !isResolved && isLowLevel && { color: '#15803D' },
                isDarkMode && isResolved && { color: '#FF94B8' },
              ]}
            >
              CURRENT COOPLAND RISK {!isResolved ? `— ${activeLevelStr.toUpperCase()}` : ''}
            </Text>
            <TouchableOpacity onPress={() => onNavigate('symptoms')} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: riskPrimaryColor }]}>Assess Risk</Text>
              <Ionicons name="chevron-forward" size={14} color={riskPrimaryColor} />
            </TouchableOpacity>
          </View>

          {isResolved ? (
            <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
              <View style={[styles.resolvedCircle, isDarkMode && { backgroundColor: '#3A1F26', borderColor: '#FF94B8' }]}>
                <Ionicons name="shield-checkmark" size={48} color={isDarkMode ? '#FF94B8' : '#C2577D'} />
              </View>
              <Text style={[styles.resolvedTitleText, isDarkMode ? { color: '#FF94B8' } : { color: '#C2577D' }]}>
                ATTENDED BY DOCTOR
              </Text>
              <Text style={[styles.resolvedSubText, isDarkMode ? { color: '#E8D5DD' } : { color: '#6B5C63' }]}>
                Previous Severe Alert has been safely archived into your Medical History.
              </Text>
              {localResolved?.facility ? (
                <View style={[styles.facilityPill, isDarkMode && { backgroundColor: '#331B23', borderColor: '#FF94B8' }]}>
                  <Ionicons name="business" size={13} color={isDarkMode ? '#FF94B8' : '#C2577D'} />
                  <Text style={[styles.facilityPillText, isDarkMode && { color: '#FFB8CF' }]}>
                    {localResolved.facility}{localResolved.doctor ? ` • Dr. ${localResolved.doctor}` : ''}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.makeNewAssessmentBtn, isDarkMode && { backgroundColor: '#C2577D' }]}
                onPress={() => onNavigate('symptoms')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.makeNewAssessmentBtnText}>Start New Risk Assessment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Single Current Coopland Risk Card */}
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.singleCooplandCard,
                    Shadows.card,
                    !isResolved && isSevere && { borderColor: '#FCA5A5', backgroundColor: isDarkMode ? '#251418' : '#FFF5F5' },
                    !isResolved && isHigh && { borderColor: '#FCD34D', backgroundColor: isDarkMode ? '#251F14' : '#FFFDF5' },
                    isDarkMode && !isSevere && !isHigh && { backgroundColor: '#141416', borderColor: '#2C2C31' },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => onNavigate('analyze')}
                >
                  <Text style={[styles.compareLabel, { color: riskPrimaryColor }]}>
                    CURRENT COOPLAND
                  </Text>
                  <RiskGauge
                    score={isSevereLevel ? 80 : (isHighLevel ? 55 : 20)}
                    level={activeLevelStr}
                    size={150}
                    cooplandScore={coopScore}
                  />
                  <Text style={[styles.compareDate, isDarkMode && { color: '#B8B4BA' }]}>
                    {latestCoopland?.date ? latestCoopland.date.split('T')[0] : (risk.assessmentDate ? risk.assessmentDate.split(' ')[0] : 'Current')}
                  </Text>
                  <Text style={[styles.compareScoreText, { color: riskPrimaryColor, fontWeight: '800' }]}>
                    Score: {coopScore}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 6,
                      backgroundColor: riskBgColor,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: riskPrimaryColor }}>
                      Tap to view breakdown
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={riskPrimaryColor} />
                  </View>
                </TouchableOpacity>
              </View>

              {effectiveFactors && effectiveFactors.length > 0 && (
                <View style={{ marginTop: 6, marginBottom: 8, paddingHorizontal: 4, alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDarkMode ? '#85818A' : Colors.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>
                    Active Contributing Factors
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
                    {effectiveFactors.slice(0, 4).map((f: string, i: number) => {
                      const is3pt = f.includes('+3');
                      const is2pt = f.includes('+2');
                      return (
                        <View
                          key={i}
                          style={{
                            backgroundColor: is3pt ? (isDarkMode ? '#3A1F26' : '#FEE2E2') : (is2pt ? (isDarkMode ? '#3A2C15' : '#FEF3C7') : (isDarkMode ? '#2C2C31' : '#F4F0F2')),
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 12,
                            borderWidth: (is3pt || is2pt) ? 1 : 0,
                            borderColor: is3pt ? '#FCA5A5' : '#FCD34D',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: is3pt ? '#DC2626' : (is2pt ? '#B45309' : (isDarkMode ? '#F0EEF0' : Colors.text)),
                            }}
                          >
                            {f}
                          </Text>
                        </View>
                      );
                    })}
                    {risk.factors.length > 3 && (
                      <View style={{ backgroundColor: isDarkMode ? '#2C2C31' : '#F4F0F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: riskPrimaryColor }}>+{risk.factors.length - 3} more</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* "I Already Visited Hospital / OB-GYN" Action Button */}
              {isSevere && (
                <View style={styles.visitedBtnWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.visitedHospitalBtn,
                      isDarkMode ? { backgroundColor: '#E15D74' } : { backgroundColor: '#C2577D' },
                    ]}
                    onPress={() => setVisitModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="medkit" size={17} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.visitedHospitalBtnText}>I Already Visited Hospital / OB-GYN</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Priority Recommendations */}
          {isResolved ? (
            <View style={[styles.recsSection, isDarkMode && { borderTopColor: '#2C2C31' }]}>
              <Text style={[styles.recsEyebrow, isDarkMode && { color: '#85818A' }]}>POST-VISIT CARE &amp; RECOVERY</Text>
              <View style={[styles.recItem, isDarkMode ? { backgroundColor: '#331B23', borderColor: '#FF94B8', borderWidth: 1 } : { backgroundColor: '#FFF5F8', borderColor: '#F8B4C8', borderWidth: 1 }]}>
                <Ionicons name="checkmark-circle" size={18} color={isDarkMode ? '#FF94B8' : '#C2577D'} />
                <Text style={[styles.recText, isDarkMode ? { color: '#F8E8EE' } : { color: '#9B2C52' }]}>
                  Consultation logged at {localResolved?.facility || 'Healthcare Provider'}.
                </Text>
              </View>
              <View style={[styles.recItem, isDarkMode && { backgroundColor: '#131316' }]}>
                <Ionicons name="medkit" size={18} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                <Text style={[styles.recText, isDarkMode && { color: '#F0EEF0' }]}>
                  Follow doctor's prescribed rest, hydration, and treatment guidelines.
                </Text>
              </View>
              <View style={[styles.recItem, isDarkMode && { backgroundColor: '#131316' }]}>
                <Ionicons name="add-circle" size={18} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                <Text style={[styles.recText, isDarkMode && { color: '#F0EEF0' }]}>
                  When ready, start a fresh check-in to evaluate your recovery.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnBlockOutline, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
                onPress={() => onNavigate('analyze')}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={16} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                <Text style={[styles.btnBlockOutlineText, { color: isDarkMode ? '#FF94B8' : Colors.primaryDark }]}>
                  View Archived Risk History
                </Text>
              </TouchableOpacity>
            </View>
          ) : recs.length > 0 ? (
            <View style={[styles.recsSection, isDarkMode && { borderTopColor: '#2C2C31' }]}>
              <Text style={[styles.recsEyebrow, isDarkMode && { color: '#85818A' }]}>TOP CLINICAL RECOMMENDATIONS</Text>
              {recs.slice(0, 3).map((rec: any, idx: number) => {
                const recText = typeof rec === 'string' ? rec : (rec.text || '');
                const isUrgent = typeof rec === 'object' ? Boolean(rec.urgent || rec.category === 'Urgent Action') : false;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.recItem,
                      isDarkMode && { backgroundColor: '#131316' },
                      isUrgent && (isDarkMode ? { backgroundColor: '#3A1F26', borderColor: '#F06E84', borderWidth: 1 } : styles.recItemUrgent),
                    ]}
                  >
                    <Ionicons
                      name={isUrgent ? 'alert-circle' : 'checkmark-circle'}
                      size={18}
                      color={isUrgent ? Colors.riskHigh : (isDarkMode ? '#FF94B8' : Colors.primaryDark)}
                    />
                    <View style={{ flex: 1 }}>
                      {rec.category && (
                        <Text style={[styles.recCategory, isDarkMode && { color: isUrgent ? '#F06E84' : '#FF94B8' }]}>
                          {rec.category}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.recText,
                          isDarkMode && { color: '#F0EEF0' },
                          isUrgent && (isDarkMode ? { color: '#F06E84' } : styles.recTextUrgent),
                        ]}
                      >
                        {recText}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.btnBlockOutline, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
                onPress={() => onNavigate('analyze')}
                activeOpacity={0.7}
              >
                <Ionicons name="analytics-outline" size={16} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                <Text style={[styles.btnBlockOutlineText, { color: isDarkMode ? '#FF94B8' : Colors.primaryDark }]}>
                  View Factor Analysis &amp; Guidance
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Reminders Card (matching dashboard.php exactly) */}
        <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.eyebrow, { color: isDarkMode ? '#FF94B8' : '#C2577D' }]}>REMINDERS</Text>
            <TouchableOpacity onPress={() => onNavigate('reminders')} style={styles.linkRow} activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: isDarkMode ? '#FF94B8' : '#C2577D', fontWeight: '700' }]}>Manage</Text>
              <Ionicons name="chevron-forward" size={13} color={isDarkMode ? '#FF94B8' : '#C2577D'} />
            </TouchableOpacity>
          </View>

          {Boolean(preg.nextObVisit) && (() => {
            const calculateDaysUntil = (dStr: string) => {
              if (!dStr) return null;
              const parts = dStr.split('-');
              if (parts.length === 3) {
                const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                target.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return Math.round((target.getTime() - today.getTime()) / 86400000);
              }
              return null;
            };

            const days = (preg.daysToVisit !== null && preg.daysToVisit !== undefined)
              ? preg.daysToVisit
              : calculateDaysUntil(preg.nextObVisit);

            return (
              <View style={[styles.dashVisitPill, isDarkMode && { backgroundColor: '#251820', borderColor: '#3E202C' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <View style={[styles.dashVisitIconBox, isDarkMode && { backgroundColor: '#3A1F2B' }]}>
                    <Ionicons name="calendar" size={18} color="#C2577D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dashVisitTitle, isDarkMode && { color: '#F0EEF0' }]}>
                      Next OB-GYN Visit
                    </Text>
                    <Text style={[styles.dashVisitDate, isDarkMode && { color: '#A79AA0' }]}>
                      {formatEddDate(preg.nextObVisit)}
                    </Text>
                  </View>
                </View>
                <View style={styles.dashVisitBadge}>
                  <Text style={styles.dashVisitBadgeText}>
                    {days === 0 ? 'Today!' : (days !== null && days > 0 ? `${days}d left` : 'Passed')}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Today's Supplements Checklist (shown once added) */}
          {Boolean(data?.medications && data.medications.length > 0) ? (
            <View style={{ marginTop: 4, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#F0EEF0' : Colors.text }]}>
                  Today's Checklist
                </Text>
                <Text style={{ fontSize: 11.5, color: Colors.textMuted, fontWeight: '600' }}>
                  {data.medications.filter((m: any) => m.taken_today || m.takenToday).length} / {data.medications.length} taken
                </Text>
              </View>
              {data.medications.map((m: any) => {
                const isTaken = !!(m.taken_today || m.takenToday);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.dashMedRow,
                      isTaken && styles.dashMedRowTaken,
                      isDarkMode && { backgroundColor: isTaken ? '#2B1A24' : '#131316', borderColor: isTaken ? '#C2577D' : '#2C2C31' },
                    ]}
                    onPress={() => handleToggleHomeMed(m.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isTaken ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={isTaken ? '#C2577D' : Colors.textMuted}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        { fontSize: 13, fontWeight: isTaken ? '700' : '600', color: isTaken ? '#9B2C52' : (isDarkMode ? '#F0EEF0' : Colors.text), flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {m.name}
                      {m.dosage ? <Text style={{ color: Colors.textMuted, fontWeight: '400' }}> — {m.dosage}</Text> : null}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.dashReminderSubtext, isDarkMode && { color: '#A79AA0' }]}>
              Track your next OB-GYN visit and mark off today's supplements/vitamins.
            </Text>
          )}

          {/* Open Reminders Button */}
          <TouchableOpacity
            onPress={() => onNavigate('reminders')}
            activeOpacity={0.8}
            style={{ marginTop: 4 }}
          >
            <LinearGradient
              colors={['#E8729A', '#C2577D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dashOpenRemindersBtn}
            >
              <Ionicons name="notifications" size={16} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.dashOpenRemindersBtnText}>Open Reminders</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Latest Vitals Card (.kv layout from dashboard.php) */}
        <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.eyebrow, isDarkMode && { color: '#FF94B8' }]}>LATEST VITALS</Text>
            <TouchableOpacity onPress={() => onNavigate('vitals')} style={styles.linkRow}>
              <Text style={[styles.linkText, isDarkMode && { color: '#FF94B8' }]}>View History</Text>
              <Ionicons name="chevron-forward" size={14} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
            </TouchableOpacity>
          </View>

          {vitals.bp_sys ? (
            <View style={styles.kvList}>
              <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Blood Pressure</Text>
                <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.bp_sys}/{vitals.bp_dia} mmHg</Text>
              </View>
              <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Hemoglobin</Text>
                <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.hemoglobin || '—'} g/dL</Text>
              </View>
              <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Blood Sugar</Text>
                <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.blood_sugar || '—'} mg/dL</Text>
              </View>
              <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Weight</Text>
                <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.weight_kg || '—'} kg</Text>
              </View>
              {vitals.heart_rate ? (
                <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                  <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Heart Rate</Text>
                  <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.heart_rate} bpm</Text>
                </View>
              ) : null}
              {vitals.fetal_movement !== null && vitals.fetal_movement !== undefined && vitals.fetal_movement !== '' ? (
                <View style={[styles.kvRow, isDarkMode && { borderBottomColor: '#2C2C31' }]}>
                  <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Fetal Movement</Text>
                  <Text style={[styles.kvVal, isDarkMode && { color: '#F0EEF0' }]}>{vitals.fetal_movement} kicks/hr</Text>
                </View>
              ) : null}
              <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.kvKey, isDarkMode && { color: '#85818A' }]}>Logged</Text>
                <Text style={[styles.kvVal, { color: isDarkMode ? '#85818A' : Colors.textSoft }]}>{vitals.date || 'Today'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="pulse-outline" size={28} color={isDarkMode ? '#3A2530' : Colors.primaryLight} />
              <Text style={[styles.emptyText, isDarkMode && { color: '#85818A' }]}>No vitals logged yet.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnBlockOutline, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={() => onNavigate('vitals')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={isDarkMode ? '#F0EEF0' : Colors.text} />
            <Text style={[styles.btnBlockOutlineText, isDarkMode && { color: '#F0EEF0' }]}>Log Vitals</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Navigation Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.quickTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={() => onNavigate('kick')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: isDarkMode ? '#3A2530' : Colors.primaryLight }]}>
              <Ionicons name="footsteps" size={20} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
            </View>
            <Text style={[styles.quickTitle, isDarkMode && { color: '#F0EEF0' }]}>Kick Counter</Text>
            <Text style={[styles.quickSub, isDarkMode && { color: '#85818A' }]}>Track movement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={() => onNavigate('education')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: isDarkMode ? '#2A2434' : Colors.lavenderLight }]}>
              <Ionicons name="library" size={20} color={isDarkMode ? '#CDB4DB' : Colors.lavender} />
            </View>
            <Text style={[styles.quickTitle, isDarkMode && { color: '#F0EEF0' }]}>Education Hub</Text>
            <Text style={[styles.quickSub, isDarkMode && { color: '#85818A' }]}>Trimester tips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={() => onNavigate('bag')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: isDarkMode ? '#1D2836' : Colors.secondaryLight }]}>
              <Ionicons name="bag-handle" size={20} color={isDarkMode ? '#A2D2FF' : Colors.secondaryDark} />
            </View>
            <Text style={[styles.quickTitle, isDarkMode && { color: '#F0EEF0' }]}>Hospital Bag</Text>
            <Text style={[styles.quickSub, isDarkMode && { color: '#85818A' }]}>Checklist gear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hospital / OB-GYN Visit Modal */}
      <Modal
        visible={visitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.modalIconCircle, isDarkMode && { backgroundColor: '#3A1820' }]}>
                  <Ionicons name="medkit" size={20} color={isDarkMode ? '#F06E84' : Colors.primaryDark} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>
                    Record Medical Visit
                  </Text>
                  <Text style={[styles.modalSub, isDarkMode && { color: '#85818A' }]}>
                    Archive severe alert &amp; unlock fresh assessment
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setVisitModalVisible(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#85818A' : Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#E0D6DC' }]}>
                Hospital / Clinic Name <Text style={{ color: '#E15D74' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. Cebu Doctors Hospital, City Health Center"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={facilityInput}
                onChangeText={setFacilityInput}
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#E0D6DC' }]}>
                Doctor / OB-GYN Name
              </Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. Dr. Maria Santos"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={doctorInput}
                onChangeText={setDoctorInput}
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#E0D6DC' }]}>
                Doctor's Advice / Notes
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 75, textAlignVertical: 'top' },
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' },
                ]}
                placeholder="e.g. BP stabilized with medication, advised bed rest."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                multiline
                numberOfLines={3}
                value={notesInput}
                onChangeText={setNotesInput}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDarkMode && { borderColor: '#2C2C31' }]}
                onPress={() => setVisitModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, isDarkMode && { color: '#85818A' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, isDarkMode && { backgroundColor: '#E15D74' }]}
                onPress={handleSaveVisit}
                disabled={submittingVisit}
              >
                {submittingVisit ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save &amp; Archive</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pink Bubble Flash Dialog */}
      <Modal
        visible={!!bubbleFlash?.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setBubbleFlash(null)}
      >
        <View style={styles.bubbleModalOverlay}>
          <View style={[styles.bubbleCard, isDarkMode && styles.bubbleCardDark]}>
            {/* Decorative Floating Mini-Bubbles */}
            <View style={styles.floatingBubble1} />
            <View style={styles.floatingBubble2} />
            <View style={styles.floatingBubble3} />

            {/* Main Central Bubble Icon */}
            <View style={[styles.bubbleIconContainer, isDarkMode && styles.bubbleIconContainerDark]}>
              <Ionicons
                name={(bubbleFlash?.icon as any) || 'checkmark-circle'}
                size={36}
                color={isDarkMode ? '#F472B6' : '#BE185D'}
              />
            </View>

            {/* Bubble Title */}
            <Text style={[styles.bubbleTitle, isDarkMode && styles.bubbleTitleDark]}>
              {bubbleFlash?.title || 'Notice'}
            </Text>

            {/* Bubble Message */}
            <Text style={[styles.bubbleMessage, isDarkMode && styles.bubbleMessageDark]}>
              {bubbleFlash?.message || ''}
            </Text>

            {/* Bubbly Gradient Action Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.bubbleActionBtnWrapper}
              onPress={() => setBubbleFlash(null)}
            >
              <LinearGradient
                colors={Gradients.primaryBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bubbleActionBtn}
              >
                <Text style={styles.bubbleActionBtnText}>
                  {bubbleFlash?.buttonText || 'Got it ✨'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
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
  riskBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  riskBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  riskBannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  riskBannerDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16.5,
  },
  riskBannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  riskBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  riskBannerBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  riskBannerBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  riskBannerBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
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
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
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
  singleCooplandCard: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 20,
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
    textAlign: 'center',
  },
  compareDate: {
    fontSize: 11,
    color: Colors.textSoft,
    marginTop: 4,
    fontWeight: '600',
  },
  compareScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 4,
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
  recCategory: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
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
  visitedBtnWrapper: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  visitedHospitalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E15D74',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#E15D74',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  visitedHospitalBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  resolvedBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  resolvedBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  resolvedBannerSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalBody: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalSubmitBtn: {
    backgroundColor: '#E15D74',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 11,
  },
  modalSubmitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  resolvedCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#F8B4C8',
  },
  resolvedTitleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
    color: '#C2577D',
  },
  resolvedSubText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 12,
    color: '#6B5C63',
  },
  facilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#F8B4C8',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  facilityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2577D',
  },
  makeNewAssessmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C2577D',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 14,
    elevation: 3,
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  makeNewAssessmentBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
  },
  obDaysNum: {
    fontSize: 44,
    fontWeight: '800',
    color: '#C2577D',
    lineHeight: 48,
  },
  obDaysText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  obDateDisplay: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
  },
  passedPill: {
    backgroundColor: '#FCE4E9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  passedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.riskHigh,
  },
  dashVisitPill: {
    backgroundColor: '#FBF0F5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F5D3E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  dashVisitIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashVisitTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2D2D3A',
  },
  dashVisitDate: {
    fontSize: 12,
    color: '#7A757E',
    marginTop: 2,
  },
  dashVisitBadge: {
    backgroundColor: '#C2577D',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  dashVisitBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  dashReminderSubtext: {
    fontSize: 13,
    color: '#7A757E',
    lineHeight: 18,
    marginVertical: 10,
  },
  dashOpenRemindersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dashOpenRemindersBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dashMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFF',
    marginTop: 6,
  },
  dashMedRowTaken: {
    backgroundColor: '#FFF5F8',
    borderColor: '#C2577D',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  offlineBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  bubbleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bubbleCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF5F8',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F9A8D4',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  bubbleCardDark: {
    backgroundColor: '#26131F',
    borderColor: '#831843',
    shadowColor: '#000000',
  },
  floatingBubble1: {
    position: 'absolute',
    top: -12,
    right: 20,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FCE7F3',
    borderWidth: 1.5,
    borderColor: '#F9A8D4',
  },
  floatingBubble2: {
    position: 'absolute',
    top: 14,
    left: 18,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FBCFE8',
  },
  floatingBubble3: {
    position: 'absolute',
    bottom: -8,
    left: 45,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FCE7F3',
    borderWidth: 1,
    borderColor: '#F472B6',
  },
  bubbleIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FCE7F3',
    borderWidth: 2,
    borderColor: '#F9A8D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleIconContainerDark: {
    backgroundColor: '#4A1D32',
    borderColor: '#831843',
  },
  bubbleTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#9D174D',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  bubbleTitleDark: {
    color: '#F472B6',
  },
  bubbleMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4A1D32',
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  bubbleMessageDark: {
    color: '#FCE7F3',
  },
  bubbleActionBtnWrapper: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  bubbleActionBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
