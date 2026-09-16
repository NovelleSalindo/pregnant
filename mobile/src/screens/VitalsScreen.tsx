import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

export const VitalsScreen: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [weight, setWeight] = useState('');
  const [sugar, setSugar] = useState('');
  const [hb, setHb] = useState('');
  const [temp, setTemp] = useState('');

  const fetchVitals = useCallback(async () => {
    try {
      const res = await api.getVitals(40);
      setLogs(res.logs || []);
      setStats(res.stats || {});
    } catch (e: any) {
      console.warn('Vitals fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVitals();
  }, [fetchVitals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVitals();
  };

  const handleSave = async () => {
    if (!bpSys && !sugar && !hb && !weight && !temp) {
      Alert.alert('Empty Form', 'Please enter at least one measurement.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.logVitals({
        bp_sys: bpSys ? parseInt(bpSys, 10) : undefined,
        bp_dia: bpDia ? parseInt(bpDia, 10) : undefined,
        weight_kg: weight ? parseFloat(weight) : undefined,
        blood_sugar: sugar ? parseInt(sugar, 10) : undefined,
        hemoglobin: hb ? parseFloat(hb) : undefined,
        temp: temp ? parseFloat(temp) : undefined,
      });

      if (res.warnings && res.warnings.length > 0) {
        Alert.alert('Clinical Threshold Warning', res.warnings.join('\n\n'));
      } else {
        Alert.alert('Success', 'Vitals logged successfully.');
      }

      setShowModal(false);
      setBpSys('');
      setBpDia('');
      setWeight('');
      setSugar('');
      setHb('');
      setTemp('');
      fetchVitals();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save vitals.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryDark} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>MONITORING</Text>
            <Text style={styles.headerTitle}>Vitals Tracking</Text>
            <Text style={styles.headerSubtitle}>Record and track clinical vital signs</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={18} color={Colors.white} />
              <Text style={styles.addBtnText}>Log Vitals</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats Strip (.stat from style.css) */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, Shadows.card]}>
            <Text style={styles.statLabel}>AVG BP</Text>
            <Text style={styles.statValue}>
              {stats.avgBpSys ? `${stats.avgBpSys}/${stats.avgBpDia}` : '—'}
            </Text>
            <Text style={styles.statUnit}>mmHg</Text>
          </View>

          <View style={[styles.statTile, Shadows.card]}>
            <Text style={styles.statLabel}>AVG SUGAR</Text>
            <Text style={styles.statValue}>{stats.avgSugar || '—'}</Text>
            <Text style={styles.statUnit}>mg/dL</Text>
          </View>

          <View style={[styles.statTile, Shadows.card]}>
            <Text style={styles.statLabel}>TOTAL LOGS</Text>
            <Text style={styles.statValue}>{stats.totalEntries || 0}</Text>
            <Text style={styles.statUnit}>entries</Text>
          </View>
        </View>

        {/* History List */}
        <Text style={styles.sectionTitle}>Measurement History</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 20 }} />
        ) : logs.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.card]}>
            <Ionicons name="heart-dislike-outline" size={40} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>No vitals logged yet.</Text>
            <TouchableOpacity style={styles.emptyAction} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyActionText}>Add Your First Record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          logs.map((log) => {
            const isHighBp = log.bp_sys >= 140 || log.bp_dia >= 90;
            const isLowHb = log.hemoglobin && log.hemoglobin < 10;
            return (
              <View key={log.id} style={[styles.logCard, Shadows.card]}>
                <View style={styles.logHeader}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.dateText}>{log.date}</Text>
                  </View>
                  {isHighBp && (
                    <View style={styles.warningPill}>
                      <Text style={styles.warningText}>Elevated BP</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metricsRow}>
                  {log.bp_sys ? (
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemVal}>{log.bp_sys}/{log.bp_dia}</Text>
                      <Text style={styles.metricItemLbl}>BP (mmHg)</Text>
                    </View>
                  ) : null}

                  {log.blood_sugar ? (
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemVal}>{log.blood_sugar}</Text>
                      <Text style={styles.metricItemLbl}>Sugar (mg/dL)</Text>
                    </View>
                  ) : null}

                  {log.hemoglobin ? (
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricItemVal, isLowHb && { color: Colors.riskHigh }]}>
                        {log.hemoglobin}
                      </Text>
                      <Text style={styles.metricItemLbl}>Hb (g/dL)</Text>
                    </View>
                  ) : null}

                  {log.weight_kg ? (
                    <View style={styles.metricItem}>
                      <Text style={styles.metricItemVal}>{log.weight_kg} kg</Text>
                      <Text style={styles.metricItemLbl}>Weight {log.bmi ? `(${log.bmi} BMI)` : ''}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Log Modal (.ed-modal in style.css) */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.soft]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Daily Vitals</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Systolic BP (mmHg)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 120"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={bpSys}
                    onChangeText={setBpSys}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Diastolic BP (mmHg)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 80"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={bpDia}
                    onChangeText={setBpDia}
                  />
                </View>
              </View>

              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Blood Sugar (mg/dL)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 95"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={sugar}
                    onChangeText={setSugar}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Hemoglobin (g/dL)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 12.5"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={hb}
                    onChangeText={setHb}
                  />
                </View>
              </View>

              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 62.5"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Temperature (°C)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 36.8"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={temp}
                    onChangeText={setTemp}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.85}
                style={{ marginTop: 14 }}
              >
                <LinearGradient
                  colors={Gradients.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.modalSaveBtn, submitting && { opacity: 0.7 }]}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save Measurements</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    ...Shadows.glow,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
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
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  emptyActionText: {
    color: Colors.primaryDark,
    fontSize: 13,
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
    marginBottom: 12,
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
    gap: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: 70,
    backgroundColor: Colors.backgroundSoft,
    padding: 10,
    borderRadius: 12,
  },
  metricItemVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  metricItemLbl: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
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
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  modalSaveBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  modalSaveBtnText: {
    color: Colors.white,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
