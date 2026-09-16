import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

export const WellnessScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bag' | 'meds' | 'plan' | 'weight'>('bag');
  const [loading, setLoading] = useState(false);

  // Hospital Bag State
  const [bagCategories, setBagCategories] = useState<Record<string, any[]>>({});
  const [bagProgress, setBagProgress] = useState(0);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemCat, setNewItemCat] = useState('For Mom');

  // Medications State
  const [meds, setMeds] = useState<any[]>([]);

  // Birth Plan State
  const [birthPlan, setBirthPlan] = useState<any>({
    delivery_location: '',
    support_people: '',
    pain_management: '',
    feeding_preference: '',
    who_cuts_cord: '',
    skin_to_skin: 1,
    special_requests: '',
  });

  // Weight Gain State
  const [weightData, setWeightData] = useState<any>(null);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  const loadTabContent = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'bag') {
        const res = await api.getHospitalBag();
        setBagCategories(res.categories || {});
        setBagProgress(res.completionPercentage || 0);
      } else if (tab === 'meds') {
        const res = await api.getMedications();
        setMeds(res.medications || []);
      } else if (tab === 'plan') {
        const res = await api.getBirthPlan();
        if (res.birthPlan) setBirthPlan(res.birthPlan);
      } else if (tab === 'weight') {
        const res = await api.getWeightGain();
        setWeightData(res);
      }
    } catch (e: any) {
      console.warn('Wellness load error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Hospital Bag Actions ---
  const toggleBagItem = async (id: string) => {
    try {
      await api.toggleHospitalBagItem(id);
      loadTabContent('bag');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const addBagItem = async () => {
    if (!newItemLabel.trim()) return;
    try {
      await api.addHospitalBagItem(newItemLabel.trim(), newItemCat);
      setNewItemLabel('');
      loadTabContent('bag');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // --- Medication Actions ---
  const toggleMed = async (id: string) => {
    try {
      await api.toggleMedication(id);
      loadTabContent('meds');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // --- Birth Plan Actions ---
  const saveBirthPlan = async () => {
    try {
      await api.saveBirthPlan(birthPlan);
      Alert.alert('Saved', 'Your birth plan preferences have been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Wellness & Preparation</Text>
          <Text style={styles.headerSubtitle}>Hospital bag, medications, & birth plan</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <TouchableOpacity
          style={[styles.pillBtn, activeTab === 'bag' && styles.pillBtnActive]}
          onPress={() => setActiveTab('bag')}
        >
          <Ionicons name="bag-handle" size={14} color={activeTab === 'bag' ? Colors.white : Colors.textMuted} />
          <Text style={[styles.pillText, activeTab === 'bag' && styles.pillTextActive]}>Hospital Bag</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pillBtn, activeTab === 'meds' && styles.pillBtnActive]}
          onPress={() => setActiveTab('meds')}
        >
          <Ionicons name="medkit" size={14} color={activeTab === 'meds' ? Colors.white : Colors.textMuted} />
          <Text style={[styles.pillText, activeTab === 'meds' && styles.pillTextActive]}>Medications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pillBtn, activeTab === 'plan' && styles.pillBtnActive]}
          onPress={() => setActiveTab('plan')}
        >
          <Ionicons name="document-text" size={14} color={activeTab === 'plan' ? Colors.white : Colors.textMuted} />
          <Text style={[styles.pillText, activeTab === 'plan' && styles.pillTextActive]}>Birth Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pillBtn, activeTab === 'weight' && styles.pillBtnActive]}
          onPress={() => setActiveTab('weight')}
        >
          <Ionicons name="trending-up" size={14} color={activeTab === 'weight' ? Colors.white : Colors.textMuted} />
          <Text style={[styles.pillText, activeTab === 'weight' && styles.pillTextActive]}>Weight Guide</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />}

      {/* --- TAB 1: HOSPITAL BAG --- */}
      {activeTab === 'bag' && !loading && (
        <View>
          {/* Progress Card */}
          <View style={[styles.card, Shadows.small]}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Packing Readiness</Text>
              <Text style={styles.progressPct}>{bagProgress}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${bagProgress}%` }]} />
            </View>
          </View>

          {/* Add Item Box */}
          <View style={[styles.card, Shadows.small]}>
            <Text style={styles.addItemTitle}>Add Custom Item</Text>
            <View style={styles.addItemRow}>
              <TextInput
                style={styles.addInput}
                placeholder="e.g. Extra pillows, Nursing tea..."
                placeholderTextColor={Colors.textLight}
                value={newItemLabel}
                onChangeText={setNewItemLabel}
              />
              <TouchableOpacity style={styles.addPlusBtn} onPress={addBagItem}>
                <Ionicons name="add" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Categories */}
          {Object.entries(bagCategories).map(([cat, items]) => (
            <View key={cat} style={{ marginBottom: 16 }}>
              <Text style={styles.catHeader}>{cat}</Text>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.bagItemRow, Shadows.small]}
                  onPress={() => toggleBagItem(item.id)}
                >
                  <Ionicons
                    name={item.isChecked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.isChecked ? Colors.primary : Colors.textLight}
                  />
                  <Text style={[styles.bagItemText, item.isChecked && styles.bagItemTextChecked]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* --- TAB 2: MEDICATIONS --- */}
      {activeTab === 'meds' && !loading && (
        <View>
          <Text style={styles.catHeader}>Daily Prescribed Vitamins & Meds</Text>
          {meds.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active medications scheduled.</Text>
            </View>
          ) : (
            meds.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.medCard, Shadows.small]}
                onPress={() => toggleMed(m.id)}
              >
                <Ionicons
                  name={m.takenToday ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={m.takenToday ? Colors.riskLow : Colors.textLight}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{m.name}</Text>
                  <Text style={styles.medDosage}>
                    {m.dosage ? `${m.dosage} • ` : ''}
                    {m.scheduleTime || 'Daily'}
                  </Text>
                </View>
                {m.takenToday && (
                  <View style={styles.takenBadge}>
                    <Text style={styles.takenText}>Taken Today</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* --- TAB 3: BIRTH PLAN --- */}
      {activeTab === 'plan' && !loading && (
        <View style={[styles.card, Shadows.small]}>
          <Text style={styles.formTitle}>Birth Preferences Form</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Preferred Delivery Location</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.delivery_location || ''}
              placeholder="e.g. City Hospital, Birthing Clinic"
              onChangeText={(t) => setBirthPlan({ ...birthPlan, delivery_location: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Birth Support Persons</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.support_people || ''}
              placeholder="e.g. Husband, Doula, Mother"
              onChangeText={(t) => setBirthPlan({ ...birthPlan, support_people: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Pain Relief Preferences</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.pain_management || ''}
              placeholder="e.g. Natural breathing, Epidural if needed"
              onChangeText={(t) => setBirthPlan({ ...birthPlan, pain_management: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Who Cuts the Umbilical Cord?</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.who_cuts_cord || ''}
              placeholder="e.g. Partner / Doctor"
              onChangeText={(t) => setBirthPlan({ ...birthPlan, who_cuts_cord: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Special Delivery Requests</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80 }]}
              multiline
              value={birthPlan.special_requests || ''}
              placeholder="Music, delayed cord clamping, dim lights, etc."
              onChangeText={(t) => setBirthPlan({ ...birthPlan, special_requests: t })}
            />
          </View>

          <TouchableOpacity style={styles.savePlanBtn} onPress={saveBirthPlan}>
            <Text style={styles.savePlanBtnText}>Save Birth Preferences</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- TAB 4: WEIGHT GAIN GUIDANCE --- */}
      {activeTab === 'weight' && !loading && weightData && (
        <View>
          <View style={[styles.card, Shadows.small]}>
            <Text style={styles.weightCardTitle}>IOM Maternal Weight Guidance</Text>
            <View style={styles.weightStatGrid}>
              <View style={styles.weightTile}>
                <Text style={styles.weightTileLbl}>Pre-pregnancy BMI</Text>
                <Text style={styles.weightTileVal}>{weightData.prePregnancyBmi}</Text>
                <Text style={styles.weightTileSub}>{weightData.bmiCategoryLabel}</Text>
              </View>

              <View style={styles.weightTile}>
                <Text style={styles.weightTileLbl}>Starting Weight</Text>
                <Text style={styles.weightTileVal}>{weightData.prePregnancyWeightKg} kg</Text>
                <Text style={styles.weightTileSub}>Height: {weightData.heightCm} cm</Text>
              </View>
            </View>
          </View>

          <Text style={styles.catHeader}>Weight History & Trimester Ranges</Text>
          {(!weightData.weightHistory || weightData.weightHistory.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No weight records found in vitals logs.</Text>
            </View>
          ) : (
            weightData.weightHistory.map((w: any, idx: number) => (
              <View key={idx} style={[styles.weightLogRow, Shadows.small]}>
                <View>
                  <Text style={styles.weightLogVal}>{w.weightKg} kg</Text>
                  <Text style={styles.weightLogDate}>{w.date} (Week {w.gestationalWeek})</Text>
                </View>
                <View style={styles.weightGainBadge}>
                  <Text style={styles.weightGainText}>
                    {w.gainKg >= 0 ? `+${w.gainKg} kg` : `${w.gainKg} kg`}
                  </Text>
                  {w.recommendedRange && (
                    <Text style={styles.weightRangeText}>
                      Target: {w.recommendedRange[0]}–{w.recommendedRange[1]} kg
                    </Text>
                  )}
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
  tabScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  pillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  progressPct: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.surfaceSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  addItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  addItemRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  addPlusBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 6,
  },
  bagItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  bagItemText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  bagItemTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textLight,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  medDosage: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  takenBadge: {
    backgroundColor: Colors.riskLowLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  takenText: {
    fontSize: 11,
    color: Colors.riskLow,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
  },
  savePlanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  savePlanBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  weightCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  weightStatGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  weightTile: {
    flex: 1,
    backgroundColor: Colors.surfaceSoft,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  weightTileLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  weightTileVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  weightTileSub: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  weightLogRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weightLogVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  weightLogDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  weightGainBadge: {
    alignItems: 'flex-end',
  },
  weightGainText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  weightRangeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
