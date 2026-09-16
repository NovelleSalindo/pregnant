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
import { Colors, Shadows } from '../theme/colors';
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Vitals Monitoring</Text>
            <Text style={styles.headerSubtitle}>Log & track clinical vital signs</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>Log Vitals</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, Shadows.small]}>
            <Text style={styles.statLabel}>AVG BLOOD PRESSURE</Text>
            <Text style={styles.statValue}>
              {stats.avgBpSys ? `${stats.avgBpSys}/${stats.avgBpDia}` : '—'}
            </Text>
            <Text style={styles.statUnit}>mmHg</Text>
          </View>

          <View style={[styles.statTile, Shadows.small]}>
            <Text style={styles.statLabel}>AVG BLOOD SUGAR</Text>
            <Text style={styles.statValue}>{stats.avgSugar || '—'}</Text>
            <Text style={styles.statUnit}>mg/dL</Text>
          </View>

          <View style={[styles.statTile, Shadows.small]}>
            <Text style={styles.statLabel}>TOTAL LOGS</Text>
            <Text style={styles.statValue}>{stats.totalEntries || 0}</Text>
            <Text style={styles.statUnit}>records</Text>
          </View>
        </View>

        {/* History List */}
        <Text style={styles.historyTitle}>Measurement History</Text>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : logs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="heart-dislike-outline" size={40} color={Colors.textMuted} />
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
              <View key={log.id} style={[styles.logCard, Shadows.small]}>
                <View style={styles.logHeader}>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.dateText}>{log.date}</Text>
                  </View>
                  {isHighBp && (
                    <View style={styles.warningPill}>
                      <Text style={styles.warningText}>High BP</Text>
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
                      <Text style={[styles.metricItemVal, isLowHb && { color: Colors.riskSevere }]}>
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

      {/* Log Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.large]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Daily Vitals</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.modalInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Systolic BP (mmHg)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. 120"
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
                    placeholder="e.g. 64.5"
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
                    keyboardType="decimal-pad"
                    value={temp}
                    onChangeText={setTemp}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Save Measurements</Text>
              )}
            </TouchableOpacity>
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
    padding: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  statUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
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
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  warningPill: {
    backgroundColor: Colors.riskSevereLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  warningText: {
    color: Colors.riskSevere,
    fontSize: 10,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metricItem: {
    backgroundColor: Colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metricItemVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  metricItemLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyAction: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyActionText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
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
  modalInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
