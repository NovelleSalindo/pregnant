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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

export const WellnessScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'education' | 'bag' | 'meds' | 'plan' | 'weight'>('education');
  const [activeTrimester, setActiveTrimester] = useState<1 | 2 | 3>(2);
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

  // Trimester education guidelines from web
  const trimesterGuides = {
    1: [
      { icon: 'nutrition-outline', title: 'Folic Acid & Nutrition', text: 'Start taking 400-800mcg of folic acid daily to prevent neural tube defects.' },
      { icon: 'water-outline', title: 'Hydration & Morning Sickness', text: 'Drink 8-10 glasses of water; eat small frequent snacks like ginger or crackers.' },
      { icon: 'calendar-outline', title: 'First Prenatal Checkup', text: 'Schedule your initial blood panel, ultrasound, and confirmation visit.' },
      { icon: 'warning-outline', title: 'Warning Signs', text: 'Contact your doctor immediately if experiencing heavy bleeding or severe cramping.' },
    ],
    2: [
      { icon: 'fitness-outline', title: 'Gentle Exercise & Walking', text: 'Pelvic floor exercises (Kegels), light prenatal yoga, and daily walking.' },
      { icon: 'footsteps-outline', title: 'First Baby Kicks', text: 'You will start feeling fluttering movements between weeks 18 to 22.' },
      { icon: 'pulse-outline', title: 'Anatomy Scan (Week 20)', text: 'Detailed ultrasound checking fetal development, organs, and placenta position.' },
      { icon: 'medkit-outline', title: 'Glucose Screening', text: 'Screening for gestational diabetes between weeks 24 and 28.' },
    ],
    3: [
      { icon: 'bag-handle-outline', title: 'Hospital Bag Packing', text: 'Pack baby clothes, nursing essentials, documents, and hospital slippers.' },
      { icon: 'timer-outline', title: 'Contraction Timing (5-1-1)', text: 'Head to the hospital when contractions are 5 min apart, 1 min long, for 1 hour.' },
      { icon: 'document-text-outline', title: 'Birth Preferences & Plan', text: 'Discuss labor pain relief, delivery location, and partner support with your OB.' },
      { icon: 'bed-outline', title: 'Sleep & Left Side Rest', text: 'Sleep on your left side to optimize blood flow to the placenta and baby.' },
    ],
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerEyebrow}>WELLNESS & PREPARATION</Text>
        <Text style={styles.headerTitle}>Pregnancy Wellness</Text>
        <Text style={styles.headerSubtitle}>Education hub, hospital checklist, medications, and birth plan</Text>
      </View>

      {/* Top Tab Bar (.tabs from style.css) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {[
          { key: 'education', label: 'Education Hub', icon: 'library' },
          { key: 'bag', label: 'Hospital Bag', icon: 'bag-handle' },
          { key: 'meds', label: 'Medications', icon: 'medkit' },
          { key: 'plan', label: 'Birth Plan', icon: 'document-text' },
          { key: 'weight', label: 'Weight Guide', icon: 'trending-up' },
        ].map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.pillBtn, isActive && styles.pillBtnActive]}
              onPress={() => setActiveTab(t.key as any)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={isActive ? Colors.white : Colors.textSoft}
              />
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && (
        <ActivityIndicator color={Colors.primaryDark} style={{ marginVertical: 20 }} />
      )}

      {/* --- TAB 0: EDUCATION HUB (.ed-grid & .trimester-tabs from style.css) --- */}
      {activeTab === 'education' && !loading && (
        <View>
          {/* Trimester Tabs */}
          <View style={styles.trimesterTabBar}>
            {[1, 2, 3].map((tri) => {
              const isTriActive = activeTrimester === tri;
              return (
                <TouchableOpacity
                  key={tri}
                  style={[styles.trimesterBtn, isTriActive && styles.trimesterBtnActive]}
                  onPress={() => setActiveTrimester(tri as 1 | 2 | 3)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.trimesterBtnText, isTriActive && styles.trimesterBtnTextActive]}>
                    Trimester {tri}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Educational Guidance Cards */}
          <Text style={styles.sectionTitle}>
            Key Milestones for Trimester {activeTrimester}
          </Text>
          <View style={styles.edGrid}>
            {trimesterGuides[activeTrimester].map((guide, idx) => (
              <View key={idx} style={[styles.edCard, Shadows.card]}>
                <View style={styles.edIconWrap}>
                  <Ionicons name={guide.icon as any} size={20} color={Colors.primaryDark} />
                </View>
                <Text style={styles.edCardTitle}>{guide.title}</Text>
                <Text style={styles.edCardDesc}>{guide.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* --- TAB 1: HOSPITAL BAG --- */}
      {activeTab === 'bag' && !loading && (
        <View>
          {/* Progress Card (.progress-track & .progress-fill) */}
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Packing Readiness</Text>
              <Text style={styles.progressPct}>{bagProgress}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <LinearGradient
                colors={Gradients.hero}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${bagProgress}%` }]}
              />
            </View>
          </View>

          {/* Add Item Box */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.addItemTitle}>Add Custom Item</Text>
            <View style={styles.addItemRow}>
              <TextInput
                style={styles.addInput}
                placeholder="e.g. Extra pillows, Nursing tea..."
                placeholderTextColor={Colors.textMuted}
                value={newItemLabel}
                onChangeText={setNewItemLabel}
              />
              <TouchableOpacity
                onPress={addBagItem}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={Gradients.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addPlusBtn}
                >
                  <Ionicons name="add" size={20} color={Colors.white} />
                </LinearGradient>
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
                  style={[styles.bagItemRow, Shadows.card]}
                  onPress={() => toggleBagItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.isChecked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.isChecked ? Colors.primaryDark : Colors.textMuted}
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
          <Text style={styles.sectionTitle}>Daily Prescribed Vitamins & Meds</Text>
          {meds.length === 0 ? (
            <View style={[styles.emptyCard, Shadows.card]}>
              <Text style={styles.emptyText}>No active medications scheduled.</Text>
            </View>
          ) : (
            meds.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.medCard, Shadows.card]}
                onPress={() => toggleMed(m.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={m.takenToday ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={m.takenToday ? Colors.riskLow : Colors.textMuted}
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
        <View style={[styles.card, Shadows.card]}>
          <Text style={styles.formTitle}>Birth Preferences Form</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Preferred Delivery Location</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.delivery_location || ''}
              placeholder="e.g. St. Luke's Medical Center, Birthing Clinic"
              placeholderTextColor={Colors.textMuted}
              onChangeText={(t) => setBirthPlan({ ...birthPlan, delivery_location: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Birth Support Persons</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.support_people || ''}
              placeholder="e.g. Husband, Doula, Mother"
              placeholderTextColor={Colors.textMuted}
              onChangeText={(t) => setBirthPlan({ ...birthPlan, support_people: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Pain Relief Preferences</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.pain_management || ''}
              placeholder="e.g. Natural breathing, Epidural if necessary"
              placeholderTextColor={Colors.textMuted}
              onChangeText={(t) => setBirthPlan({ ...birthPlan, pain_management: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Who Cuts the Umbilical Cord?</Text>
            <TextInput
              style={styles.fieldInput}
              value={birthPlan.who_cuts_cord || ''}
              placeholder="e.g. Partner / Doctor"
              placeholderTextColor={Colors.textMuted}
              onChangeText={(t) => setBirthPlan({ ...birthPlan, who_cuts_cord: t })}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLbl}>Special Delivery Requests</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80 }]}
              multiline
              value={birthPlan.special_requests || ''}
              placeholder="Music, delayed cord clamping, skin-to-skin contact, dim lighting..."
              placeholderTextColor={Colors.textMuted}
              onChangeText={(t) => setBirthPlan({ ...birthPlan, special_requests: t })}
            />
          </View>

          <TouchableOpacity
            onPress={saveBirthPlan}
            activeOpacity={0.85}
            style={{ marginTop: 10 }}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.savePlanBtn, Shadows.glow]}
            >
              <Text style={styles.savePlanBtnText}>Save Birth Preferences</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* --- TAB 4: WEIGHT GAIN GUIDANCE --- */}
      {activeTab === 'weight' && !loading && weightData && (
        <View>
          <View style={[styles.card, Shadows.card]}>
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

          <Text style={styles.sectionTitle}>Weight History & Trimester Ranges</Text>
          {(!weightData.weightHistory || weightData.weightHistory.length === 0) ? (
            <View style={[styles.emptyCard, Shadows.card]}>
              <Text style={styles.emptyText}>No weight records logged in vitals yet.</Text>
            </View>
          ) : (
            weightData.weightHistory.map((w: any, idx: number) => (
              <View key={idx} style={[styles.weightLogRow, Shadows.card]}>
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
  tabScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 8,
  },
  pillBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  trimesterTabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  trimesterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  trimesterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadows.glow,
  },
  trimesterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  trimesterBtnTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  edGrid: {
    gap: 10,
  },
  edCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  edIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  edCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  edCardDesc: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
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
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  addItemTitle: {
    fontSize: 12.5,
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
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: Colors.text,
  },
  addPlusBtn: {
    width: 42,
    height: 42,
    borderRadius: 11,
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
    borderRadius: 14,
    padding: 13,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  bagItemText: {
    fontSize: 13.5,
    color: Colors.text,
    fontWeight: '600',
    flex: 1,
  },
  bagItemTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
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
    backgroundColor: Colors.riskLowBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  takenText: {
    fontSize: 11.5,
    color: Colors.riskLow,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 5,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: Colors.text,
  },
  savePlanBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  savePlanBtnText: {
    color: Colors.white,
    fontSize: 14.5,
    fontWeight: '800',
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
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  weightTileLbl: {
    fontSize: 10.5,
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
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 2,
  },
  weightLogRow: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weightLogVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  weightLogDate: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  weightGainBadge: {
    alignItems: 'flex-end',
  },
  weightGainText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  weightRangeText: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
