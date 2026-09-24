import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOOD_OPTIONS = [
  { value: 'Good', label: 'Good', emoji: '😊' },
  { value: 'Okay', label: 'Okay', emoji: '🙂' },
  { value: 'Tired', label: 'Tired', emoji: '😴' },
  { value: 'Anxious', label: 'Anxious', emoji: '😟' },
  { value: 'Low', label: 'Low', emoji: '😔' },
];

const ACTIVITY_OPTIONS = [
  { value: 'Resting', label: 'Resting', emoji: '🛋️' },
  { value: 'Light', label: 'Light', emoji: '🚶' },
  { value: 'Moderate', label: 'Moderate', emoji: '🏃' },
  { value: 'Active', label: 'Active', emoji: '⚡' },
];

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['Positive (+)', 'Negative (-)'];
const URINE_RESULTS = ['Negative', 'Trace', '1+', '2+', '3+', '4+'];
const KETONE_RESULTS = ['Negative', 'Trace', 'Positive'];
const SCREENING_RESULTS = ['Non-Reactive', 'Reactive', 'Pending'];

interface FormattedError {
  title: string;
  reasons: string[];
}

const formatSaveError = (raw: string): FormattedError => {
  if (!raw) {
    return {
      title: 'Save Failed',
      reasons: ['An unexpected issue occurred while saving your record.'],
    };
  }

  let text = raw.replace(/^Save Failed:\s*/i, '').trim();

  if (text.includes('PDOException') || text.includes('SQLSTATE') || text.includes('Fatal error')) {
    const colMatch = text.match(/column ['"]([^'"]+)['"]/i);
    if (colMatch && colMatch[1]) {
      return {
        title: 'Save Failed',
        reasons: [
          `Out of range value for "${colMatch[1]}".`,
          'Please check your entered measurement numbers and try again.',
        ],
      };
    }
    return {
      title: 'Save Failed',
      reasons: [
        'Database could not process the entry.',
        'Please verify all entered measurements are within normal values.',
      ],
    };
  }

  if (/network|fetch|timeout|offline/i.test(text)) {
    return {
      title: 'Save Failed',
      reasons: [
        'Could not connect to the PregnaCare server.',
        'Please check your internet connection or try again in a few moments.',
      ],
    };
  }

  const clean = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  return {
    title: 'Save Failed',
    reasons: [clean || 'Unable to record data. Please try again.'],
  };
};

interface VitalsScreenProps {
  isDarkMode?: boolean;
}

export const VitalsScreen: React.FC<VitalsScreenProps> = ({ isDarkMode = false }) => {
  // Data states
  const [logs, setLogs] = useState<any[]>([]);
  const [labLogs, setLabLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'vitals' | 'initial_lab'>('all');

  // Modal visibilities
  const [showModal, setShowModal] = useState(false); // Daily Vitals modal
  const [showLabModal, setShowLabModal] = useState(false); // Prenatal Lab modal
  const [submitting, setSubmitting] = useState(false);
  const [submittingLab, setSubmittingLab] = useState(false);

  // Daily Vitals Form State
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respRate, setRespRate] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [fetalHeartRate, setFetalHeartRate] = useState('');
  const [sugar, setSugar] = useState('');
  const [glucoseTiming, setGlucoseTiming] = useState<'preprandial' | 'postprandial'>('preprandial');
  const [fetalMovement, setFetalMovement] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [waterIntake, setWaterIntake] = useState('');
  const [mood, setMood] = useState('');
  const [activity, setActivity] = useState('');
  const [saveError, setSaveError] = useState('');

  // Prenatal Laboratory Form State
  const [labTypeTab, setLabTypeTab] = useState<'initial' | 'followup' | 'investigation'>('initial');
  const [labDate, setLabDate] = useState('');
  // CBC
  const [cbcHb, setCbcHb] = useState('');
  const [cbcHct, setCbcHct] = useState('');
  const [cbcWbc, setCbcWbc] = useState('');
  const [cbcPlt, setCbcPlt] = useState('');
  // Blood group
  const [bloodType, setBloodType] = useState('');
  const [rhFactor, setRhFactor] = useState('');
  // Urinalysis
  const [urinalysisProtein, setUrinalysisProtein] = useState('');
  const [urinalysisGlucose, setUrinalysisGlucose] = useState('');
  const [urinalysisKetones, setUrinalysisKetones] = useState('');
  // Blood Glucose
  const [labBloodGlucose, setLabBloodGlucose] = useState('');
  // Screenings
  const [hivScreening, setHivScreening] = useState('');
  const [syphilisScreening, setSyphilisScreening] = useState('');
  const [hepbScreening, setHepbScreening] = useState('');
  // Follow-up
  const [urineCulture, setUrineCulture] = useState('');
  const [otherTests, setOtherTests] = useState('');
  // Investigations
  const [ultrasoundNotes, setUltrasoundNotes] = useState('');
  const [investigationFhr, setInvestigationFhr] = useState('');
  const [fundalHeight, setFundalHeight] = useState('');
  const [investigationFetalMovement, setInvestigationFetalMovement] = useState('');
  const [labNotes, setLabNotes] = useState('');
  const [labSaveError, setLabSaveError] = useState('');

  // Engine Result Modal
  const [engineResult, setEngineResult] = useState<{
    overallRisk: string;
    alertLevel: string;
    recommendations: { category: string; text: string; urgent: boolean }[];
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Selected Log Modals
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedLabLog, setSelectedLabLog] = useState<any>(null);

  // Dropdown Pickers
  const [moodModalVisible, setMoodModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);

  const fetchVitals = useCallback(async () => {
    try {
      const [vitalsRes, labRes] = await Promise.allSettled([
        api.getVitals(40),
        api.getLaboratoryResults(40),
      ]);

      if (vitalsRes.status === 'fulfilled') {
        const fetchedLogs = vitalsRes.value.logs || [];
        setLogs(fetchedLogs);
        setStats(vitalsRes.value.stats || {});
        AsyncStorage.setItem('@pregnacare_cached_vitals', JSON.stringify(fetchedLogs)).catch(() => {});
      }
      if (labRes.status === 'fulfilled') {
        const fetchedLabs = labRes.value.labs || [];
        setLabLogs(fetchedLabs);
        AsyncStorage.setItem('@pregnacare_cached_labs', JSON.stringify(fetchedLabs)).catch(() => {});
      }
    } catch (e: any) {
      console.warn('Vitals fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Instantly hydrate from local cache so Daily Vitals and Initial Lab folders never start blank
    AsyncStorage.getItem('@pregnacare_cached_vitals').then((val) => {
      if (val) {
        try { setLogs(JSON.parse(val)); } catch {}
      }
    }).catch(() => {});

    AsyncStorage.getItem('@pregnacare_cached_labs').then((val) => {
      if (val) {
        try { setLabLogs(JSON.parse(val)); } catch {}
      }
    }).catch(() => {});

    fetchVitals();
  }, [fetchVitals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVitals();
  };

  // ── Initial Lab Filtered Sub-list ──
  const initialLabs = useMemo(() => {
    return labLogs.filter((l) => (l.lab_type || 'initial') === 'initial');
  }, [labLogs]);

  // ── Combined History Feed ──
  const combinedHistory = useMemo(() => {
    const vitalsWithTag = logs.map((l) => ({ ...l, _kind: 'vital' }));
    const labsWithTag = labLogs.map((l) => ({ ...l, _kind: 'lab' }));
    return [...vitalsWithTag, ...labsWithTag].sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });
  }, [logs, labLogs]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'vitals') return combinedHistory.filter((i) => i._kind === 'vital');
    if (historyFilter === 'initial_lab') {
      return combinedHistory.filter((i) => i._kind === 'lab' && (i.lab_type || 'initial') === 'initial');
    }
    return combinedHistory;
  }, [combinedHistory, historyFilter]);

  // ── Save Daily Vitals ──
  const handleSaveDailyVitals = async () => {
    const hasAny =
      bpSys || bpDia || heartRate || respRate || temp || spo2 ||
      weight || fetalHeartRate || sugar || fetalMovement ||
      sleepHours || waterIntake || mood || activity;

    if (!hasAny) {
      Alert.alert('Empty Form', 'Please enter at least one measurement or entry.');
      return;
    }

    setSubmitting(true);
    setSaveError('');
    try {
      const parsedSys = bpSys ? parseInt(bpSys, 10) : undefined;
      const parsedDia = bpDia ? parseInt(bpDia, 10) : undefined;
      const parsedHr = heartRate ? parseInt(heartRate, 10) : undefined;
      const parsedResp = respRate ? parseInt(respRate, 10) : undefined;
      const parsedTemp = temp ? parseFloat(temp) : undefined;
      const parsedSpo2 = spo2 ? parseInt(spo2, 10) : undefined;
      const parsedWeight = weight ? parseFloat(weight) : undefined;
      const parsedFhr = fetalHeartRate ? parseInt(fetalHeartRate, 10) : undefined;
      const parsedSugar = sugar ? parseFloat(sugar) : undefined;
      const parsedMovement = fetalMovement !== '' ? parseInt(fetalMovement, 10) : undefined;
      const parsedSleep = sleepHours ? parseFloat(sleepHours) : undefined;
      const parsedWater = waterIntake ? parseFloat(waterIntake) : undefined;

      const res = await api.logVitals({
        bp_sys: parsedSys,
        bp_dia: parsedDia,
        heart_rate: parsedHr,
        respiratory_rate: parsedResp,
        temp: parsedTemp,
        spo2: parsedSpo2,
        weight_kg: parsedWeight,
        fetal_heart_rate: parsedFhr,
        blood_sugar: parsedSugar,
        glucose_timing: glucoseTiming,
        fetal_movement: parsedMovement,
        sleep_hours: parsedSleep,
        water_intake: parsedWater,
        mood: mood || undefined,
        activity: activity || undefined,
      });

      // Optimistically record entry so it immediately appears in Daily Vitals Folder
      const newVitalsRecord = {
        id: res?.id || 'mon_' + Date.now(),
        date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        bp_sys: parsedSys ?? null,
        bp_dia: parsedDia ?? null,
        heart_rate: parsedHr ?? null,
        respiratory_rate: parsedResp ?? null,
        temp: parsedTemp ?? null,
        spo2: parsedSpo2 ?? null,
        weight_kg: parsedWeight ?? null,
        fetal_heart_rate: parsedFhr ?? null,
        blood_sugar: parsedSugar ?? null,
        glucose_timing: glucoseTiming,
        fetal_movement: parsedMovement ?? null,
        sleep_hours: parsedSleep ?? null,
        water_intake: parsedWater ?? null,
        mood: mood || null,
        activity: activity || null,
      };

      setLogs((prev) => {
        const updated = [newVitalsRecord, ...prev];
        AsyncStorage.setItem('@pregnacare_cached_vitals', JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      // Instantly open the Daily Vitals Folder in History
      setHistoryFilter('vitals');

      setShowModal(false);
      // Reset form
      setBpSys(''); setBpDia(''); setHeartRate(''); setRespRate('');
      setTemp(''); setSpo2(''); setWeight(''); setFetalHeartRate('');
      setSugar(''); setFetalMovement(''); setSleepHours('');
      setWaterIntake(''); setMood(''); setActivity('');
      fetchVitals();

      if (res.overall_risk && res.recommendations) {
        setEngineResult({
          overallRisk: res.overall_risk,
          alertLevel: res.alert_level || 'Green_Alert',
          recommendations: res.recommendations || [],
        });
        setShowResultModal(true);
      } else if (res.warnings && res.warnings.length > 0) {
        Alert.alert('Clinical Threshold Warning', res.warnings.join('\n\n'));
      } else {
        Alert.alert('Recorded in History', 'Daily vitals recorded successfully in the Daily Vitals Folder.');
      }
    } catch (e: any) {
      setSaveError(e.message || 'Could not save daily vitals.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save Prenatal Laboratory ──
  const handleSaveLaboratory = async () => {
    const hasAny =
      cbcHb || cbcHct || cbcWbc || cbcPlt || bloodType || rhFactor ||
      urinalysisProtein || urinalysisGlucose || urinalysisKetones ||
      labBloodGlucose || hivScreening || syphilisScreening || hepbScreening ||
      urineCulture || otherTests || ultrasoundNotes || investigationFhr ||
      fundalHeight || investigationFetalMovement || labNotes;

    if (!hasAny) {
      Alert.alert('Empty Form', 'Please enter at least one laboratory test result or investigation note.');
      return;
    }

    setSubmittingLab(true);
    setLabSaveError('');
    try {
      const parsedHb = cbcHb ? parseFloat(cbcHb) : undefined;
      const parsedHct = cbcHct ? parseFloat(cbcHct) : undefined;
      const parsedWbc = cbcWbc ? parseFloat(cbcWbc) : undefined;
      const parsedPlt = cbcPlt ? parseInt(cbcPlt, 10) : undefined;
      const parsedGlucose = labBloodGlucose ? parseFloat(labBloodGlucose) : undefined;
      const parsedFhr = investigationFhr ? parseInt(investigationFhr, 10) : undefined;
      const parsedFundal = fundalHeight ? parseFloat(fundalHeight) : undefined;
      const parsedMovement = investigationFetalMovement ? parseInt(investigationFetalMovement, 10) : undefined;

      const payload = {
        date: labDate ? labDate : undefined,
        lab_type: labTypeTab,
        cbc_hemoglobin: parsedHb,
        cbc_hematocrit: parsedHct,
        cbc_wbc: parsedWbc,
        cbc_platelets: parsedPlt,
        blood_type: bloodType || undefined,
        rh_factor: rhFactor || undefined,
        urinalysis_protein: urinalysisProtein || undefined,
        urinalysis_glucose: urinalysisGlucose || undefined,
        urinalysis_ketones: urinalysisKetones || undefined,
        blood_glucose: parsedGlucose,
        hiv_screening: hivScreening || undefined,
        syphilis_screening: syphilisScreening || undefined,
        hepb_screening: hepbScreening || undefined,
        urine_culture: urineCulture || undefined,
        other_tests: otherTests || undefined,
        ultrasound_notes: ultrasoundNotes || undefined,
        fetal_heart_rate: parsedFhr,
        fundal_height_cm: parsedFundal,
        fetal_movement: parsedMovement,
        notes: labNotes || undefined,
      };

      const res = await api.logLaboratoryResult(payload);

      // Optimistically record entry so it immediately appears in Initial Lab Folder
      const newLab = {
        id: res?.id || 'lab_' + Date.now(),
        date: labDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
        lab_type: labTypeTab || 'initial',
        cbc_hemoglobin: parsedHb ?? null,
        cbc_hematocrit: parsedHct ?? null,
        cbc_wbc: parsedWbc ?? null,
        cbc_platelets: parsedPlt ?? null,
        blood_type: bloodType || null,
        rh_factor: rhFactor || null,
        urinalysis_protein: urinalysisProtein || null,
        urinalysis_glucose: urinalysisGlucose || null,
        urinalysis_ketones: urinalysisKetones || null,
        blood_glucose: parsedGlucose ?? null,
        hiv_screening: hivScreening || null,
        syphilis_screening: syphilisScreening || null,
        hepb_screening: hepbScreening || null,
        urine_culture: urineCulture || null,
        other_tests: otherTests || null,
        ultrasound_notes: ultrasoundNotes || null,
        fetal_heart_rate: parsedFhr ?? null,
        fundal_height_cm: parsedFundal ?? null,
        fetal_movement: parsedMovement ?? null,
        notes: labNotes || null,
      };

      setLabLogs((prev) => {
        const updated = [newLab, ...prev];
        AsyncStorage.setItem('@pregnacare_cached_labs', JSON.stringify(updated)).catch(() => {});
        return updated;
      });

      // Instantly open the Initial Lab Folder in History
      setHistoryFilter('initial_lab');

      setShowLabModal(false);
      // Reset form
      setCbcHb(''); setCbcHct(''); setCbcWbc(''); setCbcPlt('');
      setBloodType(''); setRhFactor(''); setUrinalysisProtein('');
      setUrinalysisGlucose(''); setUrinalysisKetones(''); setLabBloodGlucose('');
      setHivScreening(''); setSyphilisScreening(''); setHepbScreening('');
      setUrineCulture(''); setOtherTests(''); setUltrasoundNotes('');
      setInvestigationFhr(''); setFundalHeight(''); setInvestigationFetalMovement('');
      setLabNotes(''); setLabDate('');
      fetchVitals();

      Alert.alert('Recorded in History', 'Initial laboratory record successfully recorded in the Initial Lab Folder.');
    } catch (e: any) {
      setLabSaveError(e.message || 'Could not save laboratory record.');
    } finally {
      setSubmittingLab(false);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isDarkMode && { color: '#F0EEF0' }]}>Vital Tracking</Text>
            <Text style={[styles.headerSubtitle, isDarkMode && { color: '#85818A' }]}>
              Record and monitor daily vitals and prenatal laboratory tests
            </Text>
          </View>
        </View>

        {/* Action Buttons: 1. Daily Vitals  2. Initial Laboratory */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={() => setShowModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="heart-circle" size={20} color={Colors.white} />
              <View>
                <Text style={styles.headerActionBtnTitle}>Daily Vitals</Text>
                <Text style={styles.headerActionBtnSub}>Log BP, HR, SpO₂, Sugar</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnWrapper}
            onPress={() => setShowLabModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#0284C7', '#0369A1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerActionBtn}
            >
              <Ionicons name="flask" size={19} color={Colors.white} />
              <View>
                <Text style={styles.headerActionBtnTitle}>Initial Laboratory</Text>
                <Text style={styles.headerActionBtnSub}>CBC, Urine, Screenings</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statLabel, isDarkMode && { color: '#85818A' }]}>AVG BP</Text>
            <Text style={[styles.statValue, isDarkMode && { color: '#F0EEF0' }]}>
              {stats.avgBpSys ? `${stats.avgBpSys}/${stats.avgBpDia}` : '—'}
            </Text>
            <Text style={[styles.statUnit, isDarkMode && { color: '#85818A' }]}>mmHg</Text>
          </View>

          <View style={[styles.statTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statLabel, isDarkMode && { color: '#85818A' }]}>AVG SUGAR</Text>
            <Text style={[styles.statValue, isDarkMode && { color: '#F0EEF0' }]}>{stats.avgSugar || '—'}</Text>
            <Text style={[styles.statUnit, isDarkMode && { color: '#85818A' }]}>mg/dL</Text>
          </View>

          <View style={[styles.statTile, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <Text style={[styles.statLabel, isDarkMode && { color: '#85818A' }]}>TOTAL LOGS</Text>
            <Text style={[styles.statValue, isDarkMode && { color: '#F0EEF0' }]}>
              {(stats.totalEntries || 0) + (labLogs.length || 0)}
            </Text>
            <Text style={[styles.statUnit, isDarkMode && { color: '#85818A' }]}>entries</Text>
          </View>
        </View>

        {/* History Header & Folder Pills */}
        <View style={styles.historyHeaderRow}>
          <Text style={[styles.sectionTitle, isDarkMode && { color: '#F0EEF0' }]}>History Folders</Text>
        </View>

        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              historyFilter === 'all' && styles.filterPillActive,
              isDarkMode && styles.filterPillDark,
              historyFilter === 'all' && isDarkMode && styles.filterPillActiveDark,
            ]}
            onPress={() => setHistoryFilter('all')}
          >
            <Text
              style={[
                styles.filterPillText,
                historyFilter === 'all' && styles.filterPillTextActive,
                isDarkMode && { color: '#A09CA8' },
                historyFilter === 'all' && isDarkMode && { color: '#FFFFFF' },
              ]}
            >
              All Records ({combinedHistory.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              historyFilter === 'vitals' && styles.filterPillActive,
              isDarkMode && styles.filterPillDark,
              historyFilter === 'vitals' && isDarkMode && styles.filterPillActiveDark,
            ]}
            onPress={() => setHistoryFilter('vitals')}
          >
            <Text
              style={[
                styles.filterPillText,
                historyFilter === 'vitals' && styles.filterPillTextActive,
                isDarkMode && { color: '#A09CA8' },
                historyFilter === 'vitals' && isDarkMode && { color: '#FFFFFF' },
              ]}
            >
              📁 Daily Vitals Folder ({logs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              historyFilter === 'initial_lab' && styles.filterPillActive,
              isDarkMode && styles.filterPillDark,
              historyFilter === 'initial_lab' && isDarkMode && styles.filterPillActiveDark,
            ]}
            onPress={() => setHistoryFilter('initial_lab')}
          >
            <Text
              style={[
                styles.filterPillText,
                historyFilter === 'initial_lab' && styles.filterPillTextActive,
                isDarkMode && { color: '#A09CA8' },
                historyFilter === 'initial_lab' && isDarkMode && { color: '#FFFFFF' },
              ]}
            >
              📁 Initial Lab Folder ({initialLabs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* History Feed */}
        {loading ? (
          <ActivityIndicator color={isDarkMode ? '#FF94B8' : Colors.primaryDark} style={{ marginTop: 20 }} />
        ) : filteredHistory.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <Ionicons name="folder-open-outline" size={40} color={isDarkMode ? '#3A2530' : Colors.primaryLight} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#85818A' }]}>
              {historyFilter === 'initial_lab'
                ? 'No initial laboratory tests recorded in this folder yet.'
                : historyFilter === 'vitals'
                ? 'No daily vitals recorded in this folder yet.'
                : 'No records logged yet.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={styles.emptyAction} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyActionText}>+ Daily Vitals</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyAction, { backgroundColor: '#E0F2FE' }]}
                onPress={() => setShowLabModal(true)}
              >
                <Text style={[styles.emptyActionText, { color: '#0284C7' }]}>+ Initial Lab</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          filteredHistory.map((item) => {
            if (item._kind === 'vital') {
              const isHighBp = item.bp_sys >= 140 || item.bp_dia >= 90;
              return (
                <TouchableOpacity
                  key={`vital-${item.id}`}
                  activeOpacity={0.75}
                  onPress={() => setSelectedLog(item)}
                  style={[styles.logCard, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
                >
                  <View style={styles.logHeader}>
                    <View style={styles.dateRow}>
                      <View style={[styles.tagBadge, { backgroundColor: isDarkMode ? '#341B26' : '#FCE7F3' }]}>
                        <Ionicons name="pulse" size={11} color="#D45D79" />
                        <Text style={[styles.tagBadgeText, { color: '#D45D79' }]}>DAILY VITALS</Text>
                      </View>
                      <Ionicons name="calendar-outline" size={13} color={isDarkMode ? '#85818A' : Colors.textMuted} />
                      <Text style={[styles.dateText, isDarkMode && { color: '#F0EEF0' }]}>{item.date}</Text>
                    </View>
                    {isHighBp && (
                      <View style={styles.warningPill}>
                        <Text style={styles.warningText}>Elevated BP</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.metricsRow}>
                    {item.bp_sys ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.bp_sys}/{item.bp_dia}</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>BP (mmHg)</Text>
                      </View>
                    ) : null}

                    {item.heart_rate ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.heart_rate} bpm</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Heart Rate</Text>
                      </View>
                    ) : null}

                    {item.respiratory_rate ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.respiratory_rate} /min</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Resp. Rate</Text>
                      </View>
                    ) : null}

                    {item.temp ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.temp} °C</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Temperature</Text>
                      </View>
                    ) : null}

                    {item.spo2 ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.spo2}%</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>SpO₂</Text>
                      </View>
                    ) : null}

                    {item.weight_kg ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.weight_kg} kg</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Weight</Text>
                      </View>
                    ) : null}

                    {item.fetal_heart_rate ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, { color: '#D45D79' }]}>{item.fetal_heart_rate} bpm</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Fetal HR</Text>
                      </View>
                    ) : null}

                    {item.blood_sugar ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.blood_sugar}</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Sugar (mg/dL)</Text>
                      </View>
                    ) : null}

                    {item.fetal_movement !== null && item.fetal_movement !== undefined && item.fetal_movement !== '' ? (
                      <View style={styles.metricItem}>
                        <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.fetal_movement}/hr</Text>
                        <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Kicks</Text>
                      </View>
                    ) : null}
                  </View>

                  {(item.mood || item.activity) && (
                    <View style={styles.tagsContainer}>
                      {item.mood ? (
                        <View style={[styles.tagPill, { backgroundColor: isDarkMode ? '#2D1B28' : '#FCE7F3' }]}>
                          <Text style={[styles.tagPillText, { color: isDarkMode ? '#FF94B8' : '#BE185D' }]}>
                            {MOOD_OPTIONS.find((m) => m.value === item.mood)?.emoji || '😊'} {item.mood}
                          </Text>
                        </View>
                      ) : null}
                      {item.activity ? (
                        <View style={[styles.tagPill, { backgroundColor: isDarkMode ? '#1E293B' : '#E0E7FF' }]}>
                          <Text style={[styles.tagPillText, { color: isDarkMode ? '#818CF8' : '#4338CA' }]}>
                            {ACTIVITY_OPTIONS.find((a) => a.value === item.activity)?.emoji || '🏃'} {item.activity}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }

            // Prenatal Laboratory Card
            const labTypeLabels: Record<string, string> = {
              initial: 'INITIAL LAB',
              followup: 'FOLLOW-UP LAB',
              investigation: 'INVESTIGATION',
            };
            return (
              <TouchableOpacity
                key={`lab-${item.id}`}
                activeOpacity={0.75}
                onPress={() => setSelectedLabLog(item)}
                style={[
                  styles.logCard,
                  { borderLeftWidth: 4, borderLeftColor: '#0284C7' },
                  Shadows.card,
                  isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                ]}
              >
                <View style={styles.logHeader}>
                  <View style={styles.dateRow}>
                    <View style={[styles.tagBadge, { backgroundColor: isDarkMode ? '#13283B' : '#E0F2FE' }]}>
                      <Ionicons name="flask" size={11} color="#0284C7" />
                      <Text style={[styles.tagBadgeText, { color: '#0284C7' }]}>
                        {labTypeLabels[item.lab_type] || 'PRENATAL LAB'}
                      </Text>
                    </View>
                    <Ionicons name="calendar-outline" size={13} color={isDarkMode ? '#85818A' : Colors.textMuted} />
                    <Text style={[styles.dateText, isDarkMode && { color: '#F0EEF0' }]}>{item.date}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#85818A' : '#A09CA8'} />
                </View>

                <View style={styles.metricsRow}>
                  {item.blood_type ? (
                    <View style={[styles.metricItem, { backgroundColor: isDarkMode ? '#1E2430' : '#EFF6FF' }]}>
                      <Text style={[styles.metricItemVal, { color: '#2563EB' }]}>
                        {item.blood_type} {item.rh_factor ? (item.rh_factor.includes('+') ? 'Rh+' : 'Rh-') : ''}
                      </Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Blood Group</Text>
                    </View>
                  ) : null}

                  {item.cbc_hemoglobin ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.cbc_hemoglobin} g/dL</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>CBC Hb</Text>
                    </View>
                  ) : null}

                  {item.cbc_platelets ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.cbc_platelets}</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Platelets</Text>
                    </View>
                  ) : null}

                  {item.urinalysis_protein ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.urinalysis_protein}</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Urine Protein</Text>
                    </View>
                  ) : null}

                  {item.blood_glucose ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.blood_glucose}</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Glucose (mg/dL)</Text>
                    </View>
                  ) : null}

                  {item.fetal_heart_rate ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, { color: '#D45D79' }]}>{item.fetal_heart_rate} bpm</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Fetal HR</Text>
                    </View>
                  ) : null}

                  {item.fundal_height_cm ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isDarkMode && { color: '#F0EEF0' }]}>{item.fundal_height_cm} cm</Text>
                      <Text style={[styles.metricItemLbl, isDarkMode && { color: '#85818A' }]}>Fundal Height</Text>
                    </View>
                  ) : null}
                </View>

                {/* Screening Badges Strip */}
                {(item.hiv_screening || item.syphilis_screening || item.hepb_screening) && (
                  <View style={styles.tagsContainer}>
                    {item.hiv_screening ? (
                      <View style={[styles.tagPill, { backgroundColor: item.hiv_screening === 'Non-Reactive' ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[styles.tagPillText, { color: item.hiv_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' }]}>
                          HIV: {item.hiv_screening}
                        </Text>
                      </View>
                    ) : null}
                    {item.syphilis_screening ? (
                      <View style={[styles.tagPill, { backgroundColor: item.syphilis_screening === 'Non-Reactive' ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[styles.tagPillText, { color: item.syphilis_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' }]}>
                          Syphilis: {item.syphilis_screening}
                        </Text>
                      </View>
                    ) : null}
                    {item.hepb_screening ? (
                      <View style={[styles.tagPill, { backgroundColor: item.hepb_screening === 'Non-Reactive' ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[styles.tagPillText, { color: item.hepb_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' }]}>
                          Hep B: {item.hepb_screening}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {item.ultrasound_notes ? (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 12, color: isDarkMode ? '#A09CA8' : Colors.textSoft, marginTop: 8, fontStyle: 'italic' }}
                  >
                    Ultrasound: {item.ultrasound_notes}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────
          1. DAILY VITALS MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.soft, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Record Daily Vitals</Text>
                <Text style={[styles.modalSubhead, isDarkMode && { color: '#85818A' }]}>
                  Log your daily physiological measurements
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#F0EEF0' : Colors.textSoft} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Clinical Measurements */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>PHYSICAL VITALS</Text>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
              </View>

              {/* BP Systolic & Diastolic */}
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Systolic BP (mmHg)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 118"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={bpSys}
                    onChangeText={setBpSys}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Diastolic BP (mmHg)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 76"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={bpDia}
                    onChangeText={setBpDia}
                  />
                </View>
              </View>

              {/* Heart Rate & Respiratory Rate */}
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Heart Rate (bpm)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 78"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={heartRate}
                    onChangeText={setHeartRate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Respiratory Rate (/min)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 18"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={respRate}
                    onChangeText={setRespRate}
                  />
                </View>
              </View>

              {/* Temperature & SpO2 */}
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Temperature (°C)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 36.8"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="decimal-pad"
                    value={temp}
                    onChangeText={setTemp}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>SpO₂ Oxygen (%)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 98"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={spo2}
                    onChangeText={setSpo2}
                  />
                </View>
              </View>

              {/* Weight & Fetal Heart Rate */}
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Weight (kg)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 62.5"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fetal Heart Rate (bpm)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 145"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={fetalHeartRate}
                    onChangeText={setFetalHeartRate}
                  />
                </View>
              </View>

              {/* Diabetes / Blood Sugar Section */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>DIABETES & BLOOD GLUCOSE</Text>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
              </View>

              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Blood Sugar (mg/dL)</Text>
                <TextInput
                  style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                  placeholder="e.g. 95"
                  placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                  keyboardType="numeric"
                  value={sugar}
                  onChangeText={setSugar}
                />
              </View>

              {/* Glucose Timing Toggle */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Blood Sugar Timing</Text>
                <View style={styles.timingToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.timingBtn,
                      glucoseTiming === 'preprandial' && styles.timingBtnActive,
                      isDarkMode && styles.timingBtnDark,
                    ]}
                    onPress={() => setGlucoseTiming('preprandial')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timingBtnText, glucoseTiming === 'preprandial' && styles.timingBtnTextActive]}>
                      🍽️ Preprandial
                    </Text>
                    <Text style={[styles.timingBtnSub, glucoseTiming === 'preprandial' && { color: '#D45D79' }]}>
                      Fasting / Before meal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.timingBtn,
                      glucoseTiming === 'postprandial' && styles.timingBtnActive,
                      isDarkMode && styles.timingBtnDark,
                    ]}
                    onPress={() => setGlucoseTiming('postprandial')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timingBtnText, glucoseTiming === 'postprandial' && styles.timingBtnTextActive]}>
                      🥗 Postprandial
                    </Text>
                    <Text style={[styles.timingBtnSub, glucoseTiming === 'postprandial' && { color: '#D45D79' }]}>
                      After meal (2 hrs)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Wellness & Lifestyle (Optional) */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>WELLNESS & BABY (OPTIONAL)</Text>
                <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
              </View>

              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fetal Kicks (/hr)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 8"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={fetalMovement}
                    onChangeText={setFetalMovement}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Sleep (hours)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 7"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="decimal-pad"
                    value={sleepHours}
                    onChangeText={setSleepHours}
                  />
                </View>
              </View>

              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Water (glasses)</Text>
                  <TextInput
                    style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                    placeholder="e.g. 8"
                    placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                    keyboardType="numeric"
                    value={waterIntake}
                    onChangeText={setWaterIntake}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Mood</Text>
                  <TouchableOpacity
                    style={[styles.selectBox, isDarkMode && styles.selectBoxDark]}
                    onPress={() => setMoodModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.selectBoxText,
                        !mood && styles.placeholderText,
                        isDarkMode && { color: mood ? '#F0EEF0' : '#85818A' },
                      ]}
                    >
                      {mood ? `${MOOD_OPTIONS.find((m) => m.value === mood)?.emoji || ''} ${mood}` : 'Select mood...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={isDarkMode ? '#85818A' : '#5C5463'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Failed Error Pink Bubble */}
              {saveError ? (() => {
                const formatted = formatSaveError(saveError);
                return (
                  <View style={[styles.pinkBubble, isDarkMode && styles.pinkBubbleDark]}>
                    <View style={styles.pinkBubbleHeader}>
                      <View style={[styles.pinkBubbleIconCircle, isDarkMode && styles.pinkBubbleIconCircleDark]}>
                        <Ionicons name="alert-circle" size={18} color={isDarkMode ? '#F472B6' : '#BE185D'} />
                      </View>
                      <Text style={[styles.pinkBubbleTitle, isDarkMode && styles.pinkBubbleTitleDark]}>
                        {formatted.title}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSaveError('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.pinkBubbleDismiss}
                      >
                        <Ionicons name="close" size={18} color={isDarkMode ? '#F472B6' : '#9D174D'} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.pinkBubbleContent}>
                      <Text style={[styles.pinkBubbleSubhead, isDarkMode && styles.pinkBubbleSubheadDark]}>
                        Reason{formatted.reasons.length > 1 ? 's' : ''}:
                      </Text>
                      {formatted.reasons.map((r, idx) => (
                        <View key={idx} style={styles.pinkBubbleReasonRow}>
                          <View style={[styles.pinkBubbleBullet, isDarkMode && styles.pinkBubbleBulletDark]} />
                          <Text style={[styles.pinkBubbleReasonText, isDarkMode && styles.pinkBubbleReasonTextDark]}>
                            {r}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })() : null}

              <TouchableOpacity
                onPress={handleSaveDailyVitals}
                disabled={submitting}
                activeOpacity={0.85}
                style={[styles.saveEntryBtn, submitting && { opacity: 0.7 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveEntryBtnText}>Save Daily Vitals</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          2. PRENATAL LABORATORY MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal visible={showLabModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.soft, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Prenatal Laboratory</Text>
                <Text style={[styles.modalSubhead, isDarkMode && { color: '#85818A' }]}>
                  Clinical tests, screenings & investigations
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowLabModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#F0EEF0' : Colors.textSoft} />
              </TouchableOpacity>
            </View>

            {/* Segmented Tab Switcher */}
            <View style={styles.labTabContainer}>
              <TouchableOpacity
                style={[
                  styles.labTabBtn,
                  labTypeTab === 'initial' && styles.labTabBtnActive,
                  isDarkMode && styles.labTabBtnDark,
                  labTypeTab === 'initial' && isDarkMode && styles.labTabBtnActiveDark,
                ]}
                onPress={() => setLabTypeTab('initial')}
              >
                <Text style={[styles.labTabBtnText, labTypeTab === 'initial' && styles.labTabBtnTextActive]}>
                  Initial Lab
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.labTabBtn,
                  labTypeTab === 'followup' && styles.labTabBtnActive,
                  isDarkMode && styles.labTabBtnDark,
                  labTypeTab === 'followup' && isDarkMode && styles.labTabBtnActiveDark,
                ]}
                onPress={() => setLabTypeTab('followup')}
              >
                <Text style={[styles.labTabBtnText, labTypeTab === 'followup' && styles.labTabBtnTextActive]}>
                  Follow-up Lab
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.labTabBtn,
                  labTypeTab === 'investigation' && styles.labTabBtnActive,
                  isDarkMode && styles.labTabBtnDark,
                  labTypeTab === 'investigation' && isDarkMode && styles.labTabBtnActiveDark,
                ]}
                onPress={() => setLabTypeTab('investigation')}
              >
                <Text style={[styles.labTabBtnText, labTypeTab === 'investigation' && styles.labTabBtnTextActive]}>
                  Investigations
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* ── INITIAL LABORATORY TAB ── */}
              {labTypeTab === 'initial' && (
                <>
                  {/* Complete Blood Count (CBC) */}
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>COMPLETE BLOOD COUNT (CBC)</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={styles.modalInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Hemoglobin (g/dL)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 12.5"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={cbcHb}
                        onChangeText={setCbcHb}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Hematocrit (%)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 38.0"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={cbcHct}
                        onChangeText={setCbcHct}
                      />
                    </View>
                  </View>

                  <View style={styles.modalInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>WBC (x10⁹/L)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 8.5"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={cbcWbc}
                        onChangeText={setCbcWbc}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Platelets (x10⁹/L)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 250"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="numeric"
                        value={cbcPlt}
                        onChangeText={setCbcPlt}
                      />
                    </View>
                  </View>

                  {/* Blood Type & Rh Factor */}
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>BLOOD GROUP & RH FACTOR</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Blood Type</Text>
                    <View style={styles.chipsRow}>
                      {BLOOD_TYPES.map((bt) => (
                        <TouchableOpacity
                          key={bt}
                          style={[
                            styles.chipBtn,
                            bloodType === bt && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setBloodType(bloodType === bt ? '' : bt)}
                        >
                          <Text style={[styles.chipBtnText, bloodType === bt && styles.chipBtnTextActive]}>
                            Type {bt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Rh Factor</Text>
                    <View style={styles.chipsRow}>
                      {RH_FACTORS.map((rh) => (
                        <TouchableOpacity
                          key={rh}
                          style={[
                            styles.chipBtn,
                            rhFactor === rh && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setRhFactor(rhFactor === rh ? '' : rh)}
                        >
                          <Text style={[styles.chipBtnText, rhFactor === rh && styles.chipBtnTextActive]}>
                            {rh}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Urinalysis */}
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>URINALYSIS</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Protein</Text>
                    <View style={styles.chipsRow}>
                      {URINE_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`prot-${res}`}
                          style={[
                            styles.chipBtn,
                            urinalysisProtein === res && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setUrinalysisProtein(urinalysisProtein === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, urinalysisProtein === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Glucose (Urine)</Text>
                    <View style={styles.chipsRow}>
                      {URINE_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`glu-${res}`}
                          style={[
                            styles.chipBtn,
                            urinalysisGlucose === res && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setUrinalysisGlucose(urinalysisGlucose === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, urinalysisGlucose === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Ketones</Text>
                    <View style={styles.chipsRow}>
                      {KETONE_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`ket-${res}`}
                          style={[
                            styles.chipBtn,
                            urinalysisKetones === res && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setUrinalysisKetones(urinalysisKetones === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, urinalysisKetones === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Blood Glucose */}
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>BLOOD GLUCOSE</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fasting / Random Blood Glucose (mg/dL)</Text>
                    <TextInput
                      style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. 92"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      keyboardType="numeric"
                      value={labBloodGlucose}
                      onChangeText={setLabBloodGlucose}
                    />
                  </View>

                  {/* Screenings */}
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>INFECTIOUS DISEASE SCREENINGS</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>HIV Screening</Text>
                    <View style={styles.chipsRow}>
                      {SCREENING_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`hiv-${res}`}
                          style={[
                            styles.chipBtn,
                            hivScreening === res && (res === 'Non-Reactive' ? styles.chipBtnSuccess : styles.chipBtnActive),
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setHivScreening(hivScreening === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, hivScreening === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Syphilis Screening (VDRL/RPR)</Text>
                    <View style={styles.chipsRow}>
                      {SCREENING_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`syph-${res}`}
                          style={[
                            styles.chipBtn,
                            syphilisScreening === res && (res === 'Non-Reactive' ? styles.chipBtnSuccess : styles.chipBtnActive),
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setSyphilisScreening(syphilisScreening === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, syphilisScreening === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Hepatitis B Screening (HBsAg)</Text>
                    <View style={styles.chipsRow}>
                      {SCREENING_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`hepb-${res}`}
                          style={[
                            styles.chipBtn,
                            hepbScreening === res && (res === 'Non-Reactive' ? styles.chipBtnSuccess : styles.chipBtnActive),
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setHepbScreening(hepbScreening === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, hepbScreening === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* ── FOLLOW-UP LABORATORY TAB ── */}
              {labTypeTab === 'followup' && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>FOLLOW-UP CBC</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={styles.modalInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Hemoglobin (g/dL)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 12.0"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={cbcHb}
                        onChangeText={setCbcHb}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Hematocrit (%)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 36.5"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={cbcHct}
                        onChangeText={setCbcHct}
                      />
                    </View>
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>URINALYSIS & GLUCOSE / OGTT</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Urine Protein</Text>
                    <View style={styles.chipsRow}>
                      {URINE_RESULTS.map((res) => (
                        <TouchableOpacity
                          key={`fu-prot-${res}`}
                          style={[
                            styles.chipBtn,
                            urinalysisProtein === res && styles.chipBtnActive,
                            isDarkMode && styles.chipBtnDark,
                          ]}
                          onPress={() => setUrinalysisProtein(urinalysisProtein === res ? '' : res)}
                        >
                          <Text style={[styles.chipBtnText, urinalysisProtein === res && styles.chipBtnTextActive]}>
                            {res}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Glucose / OGTT (mg/dL)</Text>
                    <TextInput
                      style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. 135 (Oral Glucose Tolerance Test)"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      keyboardType="numeric"
                      value={labBloodGlucose}
                      onChangeText={setLabBloodGlucose}
                    />
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>CULTURE & OTHER TESTS</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Urine Culture Result</Text>
                    <TextInput
                      style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. No significant growth / Normal flora"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      value={urineCulture}
                      onChangeText={setUrineCulture}
                    />
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Other OB-GYN Ordered Tests</Text>
                    <TextInput
                      style={[styles.fieldInput, { height: 60, textAlignVertical: 'top' }, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. Thyroid TSH: 1.8 mIU/L; Rubella IgG: Immune"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      multiline
                      value={otherTests}
                      onChangeText={setOtherTests}
                    />
                  </View>
                </>
              )}

              {/* ── PRENATAL INVESTIGATIONS TAB ── */}
              {labTypeTab === 'investigation' && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>ULTRASOUND EXAMINATION</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Ultrasound Findings</Text>
                    <TextInput
                      style={[styles.fieldInput, { height: 75, textAlignVertical: 'top' }, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. Single live intrauterine pregnancy, 22 weeks, cephalic, grade I posterior placenta, normal amniotic fluid index (AFI 14cm)"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      multiline
                      value={ultrasoundNotes}
                      onChangeText={setUltrasoundNotes}
                    />
                  </View>

                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                    <Text style={[styles.dividerLabel, isDarkMode && { color: '#85818A' }]}>FETAL INVESTIGATIONS</Text>
                    <View style={[styles.dividerLine, isDarkMode && { backgroundColor: '#2C2C31' }]} />
                  </View>

                  <View style={styles.modalInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fetal Heart Rate (bpm)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 142"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="numeric"
                        value={investigationFhr}
                        onChangeText={setInvestigationFhr}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fundal Height (cm)</Text>
                      <TextInput
                        style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                        placeholder="e.g. 24.0"
                        placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                        keyboardType="decimal-pad"
                        value={fundalHeight}
                        onChangeText={setFundalHeight}
                      />
                    </View>
                  </View>

                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Fetal Movement (kicks/hr)</Text>
                    <TextInput
                      style={[styles.fieldInput, isDarkMode && styles.fieldInputDark]}
                      placeholder="e.g. 6"
                      placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                      keyboardType="numeric"
                      value={investigationFetalMovement}
                      onChangeText={setInvestigationFetalMovement}
                    />
                  </View>
                </>
              )}

              {/* General Remarks / Notes */}
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.fieldLabel, isDarkMode && { color: '#85818A' }]}>Doctor / Midwife Remarks</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 50 }, isDarkMode && styles.fieldInputDark]}
                  placeholder="Optional clinical notes or next steps..."
                  placeholderTextColor={isDarkMode ? '#85818A' : '#8A8490'}
                  value={labNotes}
                  onChangeText={setLabNotes}
                />
              </View>

              {/* Error pink bubble */}
              {labSaveError ? (() => {
                const formatted = formatSaveError(labSaveError);
                return (
                  <View style={[styles.pinkBubble, isDarkMode && styles.pinkBubbleDark]}>
                    <View style={styles.pinkBubbleHeader}>
                      <View style={[styles.pinkBubbleIconCircle, isDarkMode && styles.pinkBubbleIconCircleDark]}>
                        <Ionicons name="alert-circle" size={18} color={isDarkMode ? '#F472B6' : '#BE185D'} />
                      </View>
                      <Text style={[styles.pinkBubbleTitle, isDarkMode && styles.pinkBubbleTitleDark]}>
                        {formatted.title}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setLabSaveError('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.pinkBubbleDismiss}
                      >
                        <Ionicons name="close" size={18} color={isDarkMode ? '#F472B6' : '#9D174D'} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.pinkBubbleContent}>
                      {formatted.reasons.map((r, idx) => (
                        <View key={idx} style={styles.pinkBubbleReasonRow}>
                          <View style={[styles.pinkBubbleBullet, isDarkMode && styles.pinkBubbleBulletDark]} />
                          <Text style={[styles.pinkBubbleReasonText, isDarkMode && styles.pinkBubbleReasonTextDark]}>
                            {r}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })() : null}

              <TouchableOpacity
                onPress={handleSaveLaboratory}
                disabled={submittingLab}
                activeOpacity={0.85}
                style={[styles.saveEntryBtn, { backgroundColor: '#0284C7' }, submittingLab && { opacity: 0.7 }]}
              >
                {submittingLab ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flask" size={18} color="#FFFFFF" />
                    <Text style={styles.saveEntryBtnText}>Save Laboratory Record</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          3. PREGNACARE DECISION ENGINE RESULT MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal visible={showResultModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          {engineResult && (() => {
            const isSevere = engineResult.overallRisk === 'Severe Risk';
            const isHigh = engineResult.overallRisk === 'High Risk';
            const accentColor = isSevere ? '#DC2626' : isHigh ? '#D97706' : '#16A34A';
            const bgColor = isSevere ? '#FEF2F2' : isHigh ? '#FFFBEB' : '#F0FDF4';
            const bgColorDark = isSevere ? '#1C0A0A' : isHigh ? '#1C1408' : '#0A1C10';
            const riskIcon = isSevere ? '🚨' : isHigh ? '⚠️' : '✅';
            const topRecs = engineResult.recommendations.slice(0, 3);
            return (
              <View
                style={[
                  styles.resultCard,
                  Shadows.large,
                  { backgroundColor: isDarkMode ? bgColorDark : bgColor, borderColor: accentColor },
                ]}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultEmoji}>{riskIcon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.resultTitle, { color: accentColor }]}>{engineResult.overallRisk}</Text>
                    <Text style={[styles.resultSubtitle, isDarkMode && { color: '#9CA3AF' }]}>
                      Alert Level: {engineResult.alertLevel.replace('_', ' ')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowResultModal(false)}>
                    <Ionicons name="close" size={20} color={accentColor} />
                  </TouchableOpacity>
                </View>

                {topRecs.length > 0 && (
                  <View style={{ marginTop: 14, gap: 10 }}>
                    <Text style={[styles.resultRecsTitle, isDarkMode && { color: '#D1D5DB' }]}>
                      Personalized Recommendations
                    </Text>
                    {topRecs.map((rec, i) => (
                      <View key={i} style={[styles.resultRecItem, { borderLeftColor: accentColor }]}>
                        <Text style={[styles.resultRecCategory, { color: accentColor }]}>{rec.category}</Text>
                        <Text style={[styles.resultRecText, isDarkMode && { color: '#E5E7EB' }]}>{rec.text}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.resultDismissBtn, { backgroundColor: accentColor }]}
                  onPress={() => setShowResultModal(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.resultDismissBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          4. DAILY VITALS DETAIL MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal visible={!!selectedLog} animationType="slide" transparent onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalBackdrop}>
          {selectedLog && (() => {
            const log = selectedLog;
            const isHighBp = log.bp_sys >= 140 || log.bp_dia >= 90;

            const rows: { label: string; value: string; warn?: boolean }[] = [
              log.bp_sys ? { label: 'Blood Pressure', value: `${log.bp_sys}/${log.bp_dia} mmHg`, warn: isHighBp } : null,
              log.heart_rate ? { label: 'Heart Rate', value: `${log.heart_rate} bpm` } : null,
              log.respiratory_rate ? { label: 'Respiratory Rate', value: `${log.respiratory_rate} breaths/min` } : null,
              log.temp ? { label: 'Temperature', value: `${log.temp} °C` } : null,
              log.spo2 ? { label: 'SpO₂ Oxygen', value: `${log.spo2} %` } : null,
              log.weight_kg ? { label: 'Weight', value: `${log.weight_kg} kg` } : null,
              log.fetal_heart_rate ? { label: 'Fetal Heart Rate', value: `${log.fetal_heart_rate} bpm` } : null,
              log.blood_sugar ? { label: 'Blood Sugar / Diabetes', value: `${log.blood_sugar} mg/dL` } : null,
              log.fetal_movement !== null && log.fetal_movement !== undefined && log.fetal_movement !== ''
                ? { label: 'Fetal Kicks', value: `${log.fetal_movement} kicks/hr` }
                : null,
              log.sleep_hours ? { label: 'Sleep', value: `${log.sleep_hours} hrs` } : null,
              log.water_intake ? { label: 'Water Intake', value: `${log.water_intake} glasses` } : null,
              log.mood ? { label: 'Mood', value: `${MOOD_OPTIONS.find((m) => m.value === log.mood)?.emoji || ''} ${log.mood}` } : null,
              log.activity ? { label: 'Activity', value: `${ACTIVITY_OPTIONS.find((a) => a.value === log.activity)?.emoji || ''} ${log.activity}` } : null,
            ].filter(Boolean) as { label: string; value: string; warn?: boolean }[];

            return (
              <View style={[styles.modalCard, Shadows.soft, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Daily Vitals Detail</Text>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#85818A' : Colors.textMuted, marginTop: 2, fontWeight: '600' }}>
                      {log.date}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedLog(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={isDarkMode ? '#F0EEF0' : Colors.textSoft} />
                  </TouchableOpacity>
                </View>

                {isHighBp && (
                  <View style={[styles.detailWarnBanner, { marginBottom: 12 }]}>
                    <Ionicons name="warning" size={14} color={Colors.riskHigh} />
                    <Text style={styles.detailWarnBannerText}>Elevated blood pressure recorded</Text>
                  </View>
                )}

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {rows.map((row, i) => (
                    <View
                      key={i}
                      style={[
                        styles.detailRow,
                        i === rows.length - 1 && { borderBottomWidth: 0 },
                        isDarkMode && { borderBottomColor: '#2C2C31' },
                      ]}
                    >
                      <Text style={[styles.detailRowLabel, isDarkMode && { color: '#85818A' }]}>{row.label}</Text>
                      <Text
                        style={[
                          styles.detailRowValue,
                          isDarkMode && { color: '#F0EEF0' },
                          row.warn && { color: Colors.riskHigh, fontWeight: '800' },
                        ]}
                      >
                        {row.value}
                      </Text>
                    </View>
                  ))}

                  {rows.length === 0 && (
                    <Text style={{ textAlign: 'center', color: Colors.textMuted, paddingVertical: 20, fontSize: 13 }}>
                      No detailed vitals recorded.
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.saveEntryBtn, { marginTop: 16, marginBottom: 0 }]}
                  onPress={() => setSelectedLog(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveEntryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          5. PRENATAL LABORATORY DETAIL MODAL
      ───────────────────────────────────────────────────────────── */}
      <Modal visible={!!selectedLabLog} animationType="slide" transparent onRequestClose={() => setSelectedLabLog(null)}>
        <View style={styles.modalBackdrop}>
          {selectedLabLog && (() => {
            const lab = selectedLabLog;
            const labTypeLabels: Record<string, string> = {
              initial: 'Initial Laboratory',
              followup: 'Follow-up Laboratory',
              investigation: 'Prenatal Investigation',
            };

            const rows: { label: string; value: string; isBadge?: boolean; badgeColor?: string }[] = [
              lab.blood_type ? { label: 'Blood Group', value: `Type ${lab.blood_type} (${lab.rh_factor || 'Rh unknown'})` } : null,
              lab.cbc_hemoglobin ? { label: 'Hemoglobin', value: `${lab.cbc_hemoglobin} g/dL` } : null,
              lab.cbc_hematocrit ? { label: 'Hematocrit', value: `${lab.cbc_hematocrit} %` } : null,
              lab.cbc_wbc ? { label: 'WBC Count', value: `${lab.cbc_wbc} x10⁹/L` } : null,
              lab.cbc_platelets ? { label: 'Platelets', value: `${lab.cbc_platelets} x10⁹/L` } : null,
              lab.urinalysis_protein ? { label: 'Urine Protein', value: lab.urinalysis_protein } : null,
              lab.urinalysis_glucose ? { label: 'Urine Glucose', value: lab.urinalysis_glucose } : null,
              lab.urinalysis_ketones ? { label: 'Urine Ketones', value: lab.urinalysis_ketones } : null,
              lab.blood_glucose ? { label: 'Blood Glucose', value: `${lab.blood_glucose} mg/dL` } : null,
              lab.hiv_screening ? { label: 'HIV Screening', value: lab.hiv_screening, isBadge: true, badgeColor: lab.hiv_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' } : null,
              lab.syphilis_screening ? { label: 'Syphilis (VDRL)', value: lab.syphilis_screening, isBadge: true, badgeColor: lab.syphilis_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' } : null,
              lab.hepb_screening ? { label: 'Hepatitis B (HBsAg)', value: lab.hepb_screening, isBadge: true, badgeColor: lab.hepb_screening === 'Non-Reactive' ? '#16A34A' : '#DC2626' } : null,
              lab.urine_culture ? { label: 'Urine Culture', value: lab.urine_culture } : null,
              lab.other_tests ? { label: 'Other Tests', value: lab.other_tests } : null,
              lab.fetal_heart_rate ? { label: 'Fetal Heart Rate', value: `${lab.fetal_heart_rate} bpm` } : null,
              lab.fundal_height_cm ? { label: 'Fundal Height', value: `${lab.fundal_height_cm} cm` } : null,
              lab.fetal_movement ? { label: 'Fetal Kicks', value: `${lab.fetal_movement} /hr` } : null,
              lab.ultrasound_notes ? { label: 'Ultrasound Notes', value: lab.ultrasound_notes } : null,
              lab.notes ? { label: 'Clinical Remarks', value: lab.notes } : null,
            ].filter(Boolean) as { label: string; value: string; isBadge?: boolean; badgeColor?: string }[];

            return (
              <View style={[styles.modalCard, Shadows.soft, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <View style={[styles.tagBadge, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.tagBadgeText, { color: '#0284C7' }]}>
                          {labTypeLabels[lab.lab_type] || 'LABORATORY'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Laboratory Results</Text>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#85818A' : Colors.textMuted, marginTop: 2, fontWeight: '600' }}>
                      Recorded on {lab.date}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedLabLog(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={isDarkMode ? '#F0EEF0' : Colors.textSoft} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {rows.map((row, i) => (
                    <View
                      key={i}
                      style={[
                        styles.detailRow,
                        i === rows.length - 1 && { borderBottomWidth: 0 },
                        isDarkMode && { borderBottomColor: '#2C2C31' },
                      ]}
                    >
                      <Text style={[styles.detailRowLabel, isDarkMode && { color: '#85818A' }]}>{row.label}</Text>
                      {row.isBadge ? (
                        <View style={[styles.tagPill, { backgroundColor: row.badgeColor === '#16A34A' ? '#DCFCE7' : '#FEE2E2' }]}>
                          <Text style={[styles.tagPillText, { color: row.badgeColor }]}>{row.value}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.detailRowValue, isDarkMode && { color: '#F0EEF0' }]}>{row.value}</Text>
                      )}
                    </View>
                  ))}

                  {rows.length === 0 && (
                    <Text style={{ textAlign: 'center', color: Colors.textMuted, paddingVertical: 20, fontSize: 13 }}>
                      No detailed laboratory findings recorded.
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.saveEntryBtn, { backgroundColor: '#0284C7', marginTop: 16, marginBottom: 0 }]}
                  onPress={() => setSelectedLabLog(null)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveEntryBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* Mood Picker Modal */}
      <Modal visible={moodModalVisible} transparent animationType="fade">
        <Pressable style={styles.pickerBackdrop} onPress={() => setMoodModalVisible(false)}>
          <View style={[styles.pickerCard, isDarkMode && styles.pickerCardDark]}>
            <Text style={[styles.pickerTitle, isDarkMode && { color: '#F0EEF0' }]}>Select Mood</Text>
            {MOOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pickerOption, mood === opt.value && styles.pickerOptionActive]}
                onPress={() => {
                  setMood(opt.value);
                  setMoodModalVisible(false);
                }}
              >
                <Text style={styles.pickerOptionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDarkMode && { color: '#F0EEF0' },
                    mood === opt.value && styles.pickerOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {mood === opt.value && <Ionicons name="checkmark-circle" size={20} color="#D45D79" />}
              </TouchableOpacity>
            ))}
            {mood ? (
              <TouchableOpacity
                style={styles.pickerClearBtn}
                onPress={() => {
                  setMood('');
                  setMoodModalVisible(false);
                }}
              >
                <Text style={styles.pickerClearText}>Clear Selection</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      {/* Activity Picker Modal */}
      <Modal visible={activityModalVisible} transparent animationType="fade">
        <Pressable style={styles.pickerBackdrop} onPress={() => setActivityModalVisible(false)}>
          <View style={[styles.pickerCard, isDarkMode && styles.pickerCardDark]}>
            <Text style={[styles.pickerTitle, isDarkMode && { color: '#F0EEF0' }]}>Select Activity Level</Text>
            {ACTIVITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pickerOption, activity === opt.value && styles.pickerOptionActive]}
                onPress={() => {
                  setActivity(opt.value);
                  setActivityModalVisible(false);
                }}
              >
                <Text style={styles.pickerOptionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDarkMode && { color: '#F0EEF0' },
                    activity === opt.value && styles.pickerOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {activity === opt.value && <Ionicons name="checkmark-circle" size={20} color="#D45D79" />}
              </TouchableOpacity>
            ))}
            {activity ? (
              <TouchableOpacity
                style={styles.pickerClearBtn}
                onPress={() => {
                  setActivity('');
                  setActivityModalVisible(false);
                }}
              >
                <Text style={styles.pickerClearText}>Clear Selection</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Pressable>
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
  headerRow: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 2,
    lineHeight: 17,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtnWrapper: {
    flex: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    ...Shadows.glow,
  },
  headerActionBtnTitle: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  headerActionBtnSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 10.5,
    color: Colors.textSoft,
    fontWeight: '600',
    marginTop: 2,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3EEF6',
  },
  filterPillDark: {
    backgroundColor: '#231D2A',
  },
  filterPillActive: {
    backgroundColor: '#D45D79',
  },
  filterPillActiveDark: {
    backgroundColor: '#D45D79',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E6775',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 13.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  emptyActionText: {
    color: Colors.primaryDark,
    fontSize: 12.5,
    fontWeight: '700',
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  warningPill: {
    backgroundColor: Colors.riskHighBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  warningText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.riskHigh,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    minWidth: 70,
    backgroundColor: Colors.backgroundSoft,
    padding: 9,
    borderRadius: 12,
  },
  metricItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  metricItemLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubhead: {
    fontSize: 12,
    color: Colors.textSoft,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: '#F4EFF6',
    borderWidth: 1,
    borderColor: '#E8DFEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#201A1B',
  },
  fieldInputDark: {
    backgroundColor: '#1E1924',
    borderColor: '#342B3E',
    color: '#F0EEF0',
  },
  selectBox: {
    backgroundColor: '#F4EFF6',
    borderWidth: 1,
    borderColor: '#E8DFEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBoxDark: {
    backgroundColor: '#1E1924',
    borderColor: '#342B3E',
  },
  selectBoxText: {
    fontSize: 13.5,
    color: '#201A1B',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#8A8490',
    fontWeight: '400',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8DFEC',
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  timingToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timingBtn: {
    flex: 1,
    backgroundColor: '#F4EFF6',
    borderWidth: 1,
    borderColor: '#E8DFEC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  timingBtnDark: {
    backgroundColor: '#1E1924',
    borderColor: '#342B3E',
  },
  timingBtnActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#D45D79',
    borderWidth: 1.5,
  },
  timingBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C5463',
  },
  timingBtnTextActive: {
    color: '#D45D79',
  },
  timingBtnSub: {
    fontSize: 10,
    color: '#8A8490',
    marginTop: 2,
  },
  saveEntryBtn: {
    backgroundColor: '#D45D79',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
    shadowColor: '#D45D79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  saveEntryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Lab Tab Selector
  labTabContainer: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F0EAF2',
    padding: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  labTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  labTabBtnDark: {
    backgroundColor: 'transparent',
  },
  labTabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  labTabBtnActiveDark: {
    backgroundColor: '#2A2232',
  },
  labTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E6775',
  },
  labTabBtnTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipBtn: {
    backgroundColor: '#F4EFF6',
    borderWidth: 1,
    borderColor: '#E8DFEC',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  chipBtnDark: {
    backgroundColor: '#1E1924',
    borderColor: '#342B3E',
  },
  chipBtnActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  chipBtnSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C5463',
  },
  chipBtnTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  // Detail Modal Rows
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBF4',
  },
  detailRowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSoft,
    flex: 1,
  },
  detailRowValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    flex: 1,
  },
  detailWarnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.riskHighBg,
    borderWidth: 1,
    borderColor: Colors.riskHigh,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailWarnBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.riskHigh,
    flex: 1,
  },
  // Error Pink Bubble
  pinkBubble: {
    backgroundColor: '#FDF2F8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F9A8D4',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#F472B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  pinkBubbleDark: {
    backgroundColor: '#2D1522',
    borderColor: '#BE185D',
  },
  pinkBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pinkBubbleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinkBubbleIconCircleDark: {
    backgroundColor: '#4A1D36',
  },
  pinkBubbleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#BE185D',
    flex: 1,
    letterSpacing: -0.2,
  },
  pinkBubbleTitleDark: {
    color: '#F472B6',
  },
  pinkBubbleDismiss: {
    padding: 2,
  },
  pinkBubbleContent: {
    paddingLeft: 4,
  },
  pinkBubbleSubhead: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9D174D',
    marginBottom: 4,
  },
  pinkBubbleSubheadDark: {
    color: '#F472B6',
  },
  pinkBubbleReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  pinkBubbleBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DB2777',
    marginTop: 5,
  },
  pinkBubbleBulletDark: {
    backgroundColor: '#F472B6',
  },
  pinkBubbleReasonText: {
    fontSize: 12.5,
    color: '#831843',
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  pinkBubbleReasonTextDark: {
    color: '#FBCFE8',
  },
  // Engine Result Modal styles
  resultCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultEmoji: {
    fontSize: 28,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 2,
  },
  resultRecsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultRecItem: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    gap: 2,
  },
  resultRecCategory: {
    fontSize: 11.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultRecText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
    fontWeight: '500',
  },
  resultDismissBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  resultDismissBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  // Picker dropdown modal styles
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    ...Shadows.large,
  },
  pickerCardDark: {
    backgroundColor: '#1E1924',
    borderColor: '#342B3E',
    borderWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#201A1B',
    marginBottom: 14,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8F5FA',
  },
  pickerOptionActive: {
    backgroundColor: '#FCE7F3',
  },
  pickerOptionEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  pickerOptionText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#201A1B',
    flex: 1,
  },
  pickerOptionTextActive: {
    color: '#D45D79',
    fontWeight: '800',
  },
  pickerClearBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  pickerClearText: {
    color: '#8A8490',
    fontSize: 13,
    fontWeight: '600',
  },
});
