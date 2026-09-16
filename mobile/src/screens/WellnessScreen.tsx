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
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

type WellnessTabKey = 'education' | 'meals' | 'meds' | 'weight' | 'plan' | 'bag' | 'postpartum' | 'reminders';

interface WellnessScreenProps {
  initialTab?: WellnessTabKey;
  onNavigate?: (tab: string) => void;
}

export const WellnessScreen: React.FC<WellnessScreenProps> = ({ initialTab = 'education' }) => {
  const [activeTab, setActiveTab] = useState<WellnessTabKey>(initialTab);
  const [activeTrimester, setActiveTrimester] = useState<1 | 2 | 3>(2);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [selectedEdCard, setSelectedEdCard] = useState<any>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);

  // Education state
  const [educationData, setEducationData] = useState<any>(null);

  // Meals state
  const [mealsData, setMealsData] = useState<any>(null);

  // Hospital Bag State
  const [bagCategories, setBagCategories] = useState<Record<string, any[]>>({});
  const [bagProgress, setBagProgress] = useState(0);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemCat, setNewItemCat] = useState('For Mom');

  // Medications State
  const [meds, setMeds] = useState<any[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedSchedule, setNewMedSchedule] = useState('Daily');

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

  // Postpartum State
  const [postpartumData, setPostpartumData] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryType, setDeliveryType] = useState('Vaginal');
  const [babyName, setBabyName] = useState('');
  const [recoveryNotes, setRecoveryNotes] = useState('');

  // Reminders State
  const [remindersData, setRemindersData] = useState<any>(null);
  const [nextObDate, setNextObDate] = useState('');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  const loadTabContent = async (tab: WellnessTabKey) => {
    setLoading(true);
    try {
      if (tab === 'education') {
        const res = await api.getEducationGuidance();
        setEducationData(res.guidance);
      } else if (tab === 'meals') {
        const res = await api.getMealPlan();
        setMealsData(res.meals);
      } else if (tab === 'bag') {
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
      } else if (tab === 'postpartum') {
        const res = await api.getPostpartum();
        setPostpartumData(res);
        if (res.status?.recovery_notes) {
          setRecoveryNotes(res.status.recovery_notes);
        }
      } else if (tab === 'reminders') {
        const res = await api.getReminders();
        setRemindersData(res);
        if (res.nextObVisit) setNextObDate(res.nextObVisit);
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

  // --- Postpartum Actions ---
  const handleMarkDelivered = async () => {
    try {
      await api.markDelivered(deliveryDate, deliveryType, babyName.trim());
      Alert.alert('Congratulations! 🎉', 'Postpartum recovery tracking and baby vaccination schedule are now active.');
      loadTabContent('postpartum');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await api.updatePostpartumNotes(recoveryNotes);
      Alert.alert('Saved', 'Your recovery notes have been saved.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleToggleVaccine = async (vaxId: string, currentGiven: boolean) => {
    try {
      await api.toggleBabyVaccine(vaxId, !currentGiven);
      loadTabContent('postpartum');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // --- Reminders Actions ---
  const handleSaveObVisit = async () => {
    if (!nextObDate.trim()) return;
    try {
      await api.setObVisit(nextObDate.trim());
      Alert.alert('Saved', 'Your upcoming checkup date has been recorded.');
      loadTabContent('reminders');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const tabs: { key: WellnessTabKey; label: string; icon: any }[] = [
    { key: 'education', label: 'Education', icon: 'book-outline' },
    { key: 'meals', label: 'Meal Planner', icon: 'restaurant-outline' },
    { key: 'meds', label: 'Medications', icon: 'medkit-outline' },
    { key: 'weight', label: 'Weight', icon: 'speedometer-outline' },
    { key: 'plan', label: 'Birth Plan', icon: 'clipboard-outline' },
    { key: 'bag', label: 'Hospital Bag', icon: 'briefcase-outline' },
    { key: 'postpartum', label: 'Postpartum', icon: 'heart-circle-outline' },
    { key: 'reminders', label: 'Reminders', icon: 'calendar-outline' },
  ];

  const currentTrimesterGuidance = educationData?.[activeTrimester]?.categories || {};
  const currentTrimesterMeals = mealsData?.[activeTrimester] || { focus: '', items: [] };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerEyebrow}>WELLNESS & PREPARATION</Text>
        <Text style={styles.headerTitle}>Mom & Baby Toolkit</Text>
      </View>

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
              onPress={() => setActiveTab(t.key)}
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

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primaryDark} />
        </View>
      ) : (
        <>
          {/* ================= 1. EDUCATION HUB ================= */}
          {activeTab === 'education' && (
            <View>
              {/* Trimester Selector */}
              <View style={styles.triTabs}>
                {([1, 2, 3] as const).map((tri) => (
                  <TouchableOpacity
                    key={tri}
                    style={[styles.triTab, activeTrimester === tri && styles.triTabActive]}
                    onPress={() => setActiveTrimester(tri)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.triTabText, activeTrimester === tri && styles.triTabTextActive]}>
                      Trimester {tri}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category Cards */}
              <View style={styles.cardGrid}>
                {Object.keys(currentTrimesterGuidance).map((catKey) => {
                  const cat = currentTrimesterGuidance[catKey];
                  const titles: Record<string, { title: string; icon: any }> = {
                    healthy_living: { title: 'Healthy Living', icon: 'leaf-outline' },
                    prenatal_testing: { title: 'Prenatal Testing', icon: 'flask-outline' },
                    symptoms_emergencies: { title: 'Symptoms & Emergencies', icon: 'warning-outline' },
                    hospital_information: { title: 'Hospital Info', icon: 'business-outline' },
                    faqs: { title: 'Common FAQs', icon: 'help-circle-outline' },
                  };
                  const meta = titles[catKey] || { title: catKey, icon: 'book-outline' };

                  return (
                    <TouchableOpacity
                      key={catKey}
                      style={[styles.guideCard, Shadows.card]}
                      onPress={() => setSelectedEdCard({ ...cat, title: meta.title, icon: meta.icon })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.guideIconWrap}>
                        <Ionicons name={meta.icon} size={22} color={Colors.primaryDark} />
                      </View>
                      <Text style={styles.guideCardTitle}>{meta.title}</Text>
                      <Text style={styles.guideCardSnippet} numberOfLines={2}>
                        {cat.explain}
                      </Text>
                      <View style={styles.guideCardFooter}>
                        <Text style={styles.guideReadMore}>Tap for advice</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.primaryDark} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ================= 2. MEAL PLANNER ================= */}
          {activeTab === 'meals' && (
            <View>
              {/* Trimester Selector */}
              <View style={styles.triTabs}>
                {([1, 2, 3] as const).map((tri) => (
                  <TouchableOpacity
                    key={tri}
                    style={[styles.triTab, activeTrimester === tri && styles.triTabActive]}
                    onPress={() => setActiveTrimester(tri)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.triTabText, activeTrimester === tri && styles.triTabTextActive]}>
                      Trimester {tri}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Focus Banner */}
              <View style={[styles.focusCard, Shadows.card]}>
                <Ionicons name="sparkles" size={18} color={Colors.primaryDark} />
                <Text style={styles.focusText}>{currentTrimesterMeals.focus}</Text>
              </View>

              {/* Meals Grid */}
              <View style={styles.cardGrid}>
                {currentTrimesterMeals.items?.map((item: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.mealCard, Shadows.card]}
                    onPress={() => setSelectedMeal(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.mealIconCircle}>
                      <Ionicons name="restaurant-outline" size={22} color={Colors.primaryDark} />
                    </View>
                    <Text style={styles.mealTitle}>{item.title}</Text>
                    <Text style={styles.mealWhy} numberOfLines={2}>{item.why}</Text>
                    <View style={styles.guideCardFooter}>
                      <Text style={styles.guideReadMore}>View Prep Tip</Text>
                      <Ionicons name="arrow-forward" size={12} color={Colors.primaryDark} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ================= 3. MEDICATIONS & VITAMINS ================= */}
          {activeTab === 'meds' && (
            <View>
              <View style={[styles.card, Shadows.card]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.eyebrow}>ACTIVE SUPPLEMENTS</Text>
                </View>

                {meds.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="medkit-outline" size={36} color={Colors.primaryLight} />
                    <Text style={styles.emptyText}>No medications or vitamins logged.</Text>
                  </View>
                ) : (
                  meds.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.medRow, m.takenToday && styles.medRowTaken]}
                      onPress={() => toggleMed(m.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={m.takenToday ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={m.takenToday ? Colors.riskLow : Colors.textMuted}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.medName, m.takenToday && styles.medNameTaken]}>
                          {m.name}
                        </Text>
                        <Text style={styles.medDetail}>
                          {m.dosage} • {m.scheduleTime}
                        </Text>
                      </View>
                      {m.takenToday && (
                        <View style={styles.takenBadge}>
                          <Text style={styles.takenBadgeText}>Taken</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {/* ================= 4. WEIGHT GAIN TRACKER ================= */}
          {activeTab === 'weight' && (
            <View>
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.eyebrow}>PRE-PREGNANCY BASELINE</Text>
                <View style={styles.bmiRow}>
                  <View style={styles.bmiStat}>
                    <Text style={styles.bmiStatLabel}>Pre-weight</Text>
                    <Text style={styles.bmiStatVal}>{weightData?.prePregnancyWeightKg || 60} kg</Text>
                  </View>
                  <View style={styles.bmiStat}>
                    <Text style={styles.bmiStatLabel}>Height</Text>
                    <Text style={styles.bmiStatVal}>{weightData?.heightCm || 160} cm</Text>
                  </View>
                  <View style={styles.bmiStat}>
                    <Text style={styles.bmiStatLabel}>BMI Category</Text>
                    <Text style={[styles.bmiStatVal, { color: Colors.primaryDark }]}>
                      {weightData?.bmiCategoryLabel || 'Normal'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.eyebrow}>WEIGHT LOG HISTORY</Text>
                {weightData?.weightHistory?.length > 0 ? (
                  weightData.weightHistory.map((w: any, idx: number) => (
                    <View key={idx} style={styles.weightItem}>
                      <View>
                        <Text style={styles.weightDate}>{w.date?.slice(0, 10)}</Text>
                        <Text style={styles.weightWeek}>Week {w.gestationalWeek}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.weightVal}>{w.weightKg} kg</Text>
                        <Text style={styles.weightGain}>
                          {w.gainKg >= 0 ? `+${w.gainKg}` : w.gainKg} kg gain
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="speedometer-outline" size={32} color={Colors.primaryLight} />
                    <Text style={styles.emptyText}>Log your weight in the Vitals screen to track progress.</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ================= 5. BIRTH PLAN ================= */}
          {activeTab === 'plan' && (
            <View style={[styles.card, Shadows.card]}>
              <Text style={styles.eyebrow}>LABOR & DELIVERY PREFERENCES</Text>

              <Text style={styles.fieldLabel}>Delivery Location Preference</Text>
              <TextInput
                style={styles.input}
                value={birthPlan.delivery_location || ''}
                onChangeText={(t) => setBirthPlan({ ...birthPlan, delivery_location: t })}
                placeholder="e.g. City Hospital, Maternity Clinic, Water Birth Center"
              />

              <Text style={styles.fieldLabel}>Labor Support People</Text>
              <TextInput
                style={styles.input}
                value={birthPlan.support_people || ''}
                onChangeText={(t) => setBirthPlan({ ...birthPlan, support_people: t })}
                placeholder="e.g. Partner, Doula, Mother"
              />

              <Text style={styles.fieldLabel}>Pain Management Preferences</Text>
              <TextInput
                style={styles.input}
                value={birthPlan.pain_management || ''}
                onChangeText={(t) => setBirthPlan({ ...birthPlan, pain_management: t })}
                placeholder="e.g. Epidural, Nitrous Oxide, Breathing Exercises, Unmedicated"
              />

              <Text style={styles.fieldLabel}>Feeding Preference</Text>
              <TextInput
                style={styles.input}
                value={birthPlan.feeding_preference || ''}
                onChangeText={(t) => setBirthPlan({ ...birthPlan, feeding_preference: t })}
                placeholder="e.g. Exclusive Breastfeeding, Formula, Combination"
              />

              <Text style={styles.fieldLabel}>Special Requests or Instructions</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={birthPlan.special_requests || ''}
                onChangeText={(t) => setBirthPlan({ ...birthPlan, special_requests: t })}
                multiline
                placeholder="Any specific wishes, music, delayed cord clamping, or emergency preferences..."
              />

              <TouchableOpacity
                style={styles.btnSave}
                onPress={saveBirthPlan}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSaveText}>Save Birth Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= 6. HOSPITAL BAG CHECKLIST ================= */}
          {activeTab === 'bag' && (
            <View>
              {/* Progress Bar */}
              <View style={[styles.card, Shadows.card]}>
                <View style={styles.bagProgressRow}>
                  <Text style={styles.eyebrow}>CHECKLIST COMPLETION</Text>
                  <Text style={styles.bagProgressPct}>{bagProgress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${bagProgress}%` }]} />
                </View>
              </View>

              {/* Categorized Items */}
              {Object.keys(bagCategories).map((cat) => (
                <View key={cat} style={[styles.card, Shadows.card]}>
                  <Text style={styles.catHeader}>{cat}</Text>
                  {bagCategories[cat]?.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.bagItemRow}
                      onPress={() => toggleBagItem(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={item.isChecked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={item.isChecked ? Colors.primaryDark : Colors.textMuted}
                      />
                      <Text style={[styles.bagItemText, item.isChecked && styles.bagItemChecked]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              {/* Add Custom Item */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.eyebrow}>ADD CUSTOM PACKING ITEM</Text>
                <TextInput
                  style={styles.input}
                  value={newItemLabel}
                  onChangeText={setNewItemLabel}
                  placeholder="e.g. Extra baby blanket, slippers, camera"
                />
                <TouchableOpacity
                  style={styles.btnSave}
                  onPress={addBagItem}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= 7. POSTPARTUM & BABY CARE ================= */}
          {activeTab === 'postpartum' && (
            <View>
              {!postpartumData?.isPostpartum ? (
                <View style={[styles.card, Shadows.card]}>
                  <Text style={styles.eyebrow}>DELIVERY CONFIRMATION</Text>
                  <Text style={styles.deliveryDesc}>
                    When you deliver, mark your delivery date here. PregnaCare will switch to recovery tracking and set up your baby's vaccination calendar automatically.
                  </Text>

                  <Text style={styles.fieldLabel}>Delivery Date</Text>
                  <TextInput
                    style={styles.input}
                    value={deliveryDate}
                    onChangeText={setDeliveryDate}
                    placeholder="YYYY-MM-DD"
                  />

                  <Text style={styles.fieldLabel}>Delivery Type</Text>
                  <TextInput
                    style={styles.input}
                    value={deliveryType}
                    onChangeText={setDeliveryType}
                    placeholder="Vaginal or Cesarean"
                  />

                  <Text style={styles.fieldLabel}>Baby's Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={babyName}
                    onChangeText={setBabyName}
                    placeholder="e.g. Baby Salindo"
                  />

                  <TouchableOpacity
                    style={styles.btnSave}
                    onPress={handleMarkDelivered}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnSaveText}>Mark as Delivered</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Postpartum Hero Banner */}
                  <LinearGradient
                    colors={Gradients.hero}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.postpartumHero, Shadows.card]}
                  >
                    <Text style={styles.heroEyebrow}>POSTPARTUM RECOVERY</Text>
                    <Text style={styles.heroTitle}>Day {postpartumData?.daysSinceDelivery || 0} Postpartum</Text>
                    <Text style={styles.heroSub}>
                      {postpartumData?.status?.delivery_type || 'Delivery'} on {postpartumData?.status?.delivery_date}
                      {postpartumData?.status?.baby_name ? ` • Welcome, ${postpartumData.status.baby_name}!` : ''}
                    </Text>
                  </LinearGradient>

                  {/* Recovery Notes */}
                  <View style={[styles.card, Shadows.card]}>
                    <Text style={styles.eyebrow}>RECOVERY NOTES</Text>
                    <TextInput
                      style={[styles.input, { height: 80 }]}
                      value={recoveryNotes}
                      onChangeText={setRecoveryNotes}
                      multiline
                      placeholder="Record how your physical recovery is going, sleep, mood, pain levels..."
                    />
                    <TouchableOpacity
                      style={styles.btnSave}
                      onPress={handleSaveNotes}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnSaveText}>Save Notes</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Warning Signs Callout */}
                  <View style={[styles.warningBox, Shadows.card]}>
                    <Ionicons name="alert-circle" size={24} color={Colors.riskHigh} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.warningTitle}>Seek immediate care if you notice:</Text>
                      <Text style={styles.warningText}>
                        Heavy bleeding (soaking a pad in 1 hr), severe headache, high fever, or sharp chest pain.
                      </Text>
                    </View>
                  </View>

                  {/* Baby Vaccinations Checklist */}
                  <View style={[styles.card, Shadows.card]}>
                    <Text style={styles.eyebrow}>BABY VACCINATIONS (PHILIPPINE EPI)</Text>
                    {postpartumData?.vaccines?.map((v: any) => (
                      <TouchableOpacity
                        key={v.id}
                        style={styles.vaxRow}
                        onPress={() => handleToggleVaccine(v.id, !!v.given)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={v.given ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={v.given ? Colors.riskLow : Colors.textMuted}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.vaxName, v.given && styles.vaxNameGiven]}>
                            {v.vaccine_name}
                          </Text>
                          <Text style={styles.vaxAge}>Due: {v.due_age_label}</Text>
                        </View>
                        {v.given ? (
                          <View style={styles.vaxDoneBadge}>
                            <Text style={styles.vaxDoneText}>Given</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ================= 8. REMINDERS & CHECKUP ================= */}
          {activeTab === 'reminders' && (
            <View>
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.eyebrow}>OB-GYN VISIT REMINDER</Text>
                <Text style={styles.reminderCount}>
                  {remindersData?.daysToVisit !== null && remindersData?.daysToVisit !== undefined
                    ? remindersData.daysToVisit >= 0
                      ? `${remindersData.daysToVisit} days until visit`
                      : 'Visit date has passed'
                    : 'No checkup date scheduled'}
                </Text>

                <Text style={styles.fieldLabel}>Next Visit Date</Text>
                <TextInput
                  style={styles.input}
                  value={nextObDate}
                  onChangeText={setNextObDate}
                  placeholder="YYYY-MM-DD"
                />

                <TouchableOpacity
                  style={styles.btnSave}
                  onPress={handleSaveObVisit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveText}>Save Visit Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      {/* Detail Modal for Education */}
      <Modal
        visible={!!selectedEdCard}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedEdCard(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedEdCard(null)}>
          <Pressable style={[styles.modalCard, Shadows.large]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedEdCard?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedEdCard(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalExplain}>{selectedEdCard?.explain}</Text>

              <Text style={styles.modalSectionTitle}>Recommendations:</Text>
              {selectedEdCard?.recommendations?.map((r: string, idx: number) => (
                <Text key={idx} style={styles.modalBullet}>• {r}</Text>
              ))}

              <Text style={styles.modalSectionTitle}>Important Reminders:</Text>
              {selectedEdCard?.reminders?.map((r: string, idx: number) => (
                <Text key={idx} style={styles.modalBulletWarning}>⚠️ {r}</Text>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail Modal for Meals */}
      <Modal
        visible={!!selectedMeal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMeal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedMeal(null)}>
          <Pressable style={[styles.modalCard, Shadows.large]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMeal?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedMeal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Why this helps:</Text>
              <Text style={styles.modalExplain}>{selectedMeal?.why}</Text>

              <Text style={styles.modalSectionTitle}>Simple Preparation Tip:</Text>
              <Text style={styles.modalExplain}>{selectedMeal?.tip}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
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
    padding: 16,
    paddingBottom: 90,
  },
  centerContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
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
  triTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  triTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  triTabActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  triTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  triTabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  cardGrid: {
    gap: 12,
  },
  guideCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guideIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  guideCardSnippet: {
    fontSize: 13,
    color: Colors.textSoft,
    lineHeight: 18,
    marginBottom: 10,
  },
  guideCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  guideReadMore: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
    padding: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 14,
  },
  focusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
    flex: 1,
    lineHeight: 18,
  },
  mealCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  mealWhy: {
    fontSize: 13,
    color: Colors.textSoft,
    lineHeight: 18,
    marginBottom: 10,
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
    marginBottom: 10,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  medRowTaken: {
    opacity: 0.7,
  },
  medName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  medNameTaken: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  medDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  takenBadge: {
    backgroundColor: Colors.riskLowBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  takenBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.riskLow,
  },
  bmiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bmiStat: {
    alignItems: 'center',
  },
  bmiStatLabel: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  bmiStatVal: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  weightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  weightDate: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  weightWeek: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  weightVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  weightGain: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSoft,
    marginTop: 10,
    marginBottom: 4,
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
    marginBottom: 6,
  },
  btnSave: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bagProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bagProgressPct: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.backgroundSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  catHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  bagItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  bagItemText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  bagItemChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  deliveryDesc: {
    fontSize: 13,
    color: Colors.textSoft,
    lineHeight: 18,
    marginBottom: 10,
  },
  postpartumHero: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.riskHighBg,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  warningTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.riskHigh,
  },
  warningText: {
    fontSize: 12.5,
    color: Colors.text,
    marginTop: 2,
    lineHeight: 17,
  },
  vaxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  vaxName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  vaxNameGiven: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  vaxAge: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  vaxDoneBadge: {
    backgroundColor: Colors.riskLowBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vaxDoneText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.riskLow,
  },
  reminderCount: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.primaryDark,
    marginBottom: 8,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalExplain: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 8,
    marginBottom: 6,
  },
  modalBullet: {
    fontSize: 13.5,
    color: Colors.textSoft,
    lineHeight: 19,
    marginBottom: 4,
  },
  modalBulletWarning: {
    fontSize: 13.5,
    color: Colors.riskHigh,
    lineHeight: 19,
    marginBottom: 4,
  },
});
