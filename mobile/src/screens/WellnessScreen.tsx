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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPhoneNotification, scheduleObVisitNotification } from '../services/notifications';

type WellnessTabKey = 'education' | 'meals' | 'meds' | 'weight' | 'plan' | 'bag' | 'postpartum' | 'reminders';

interface WellnessScreenProps {
  initialTab?: WellnessTabKey;
  onNavigate?: (tab: string) => void;
  onTabChange?: (tab: WellnessTabKey) => void;
  isDarkMode?: boolean;
}

const CATEGORY_META: { key: string; title: string; icon: any }[] = [
  { key: 'healthy_living', title: 'Healthy Living', icon: 'nutrition-outline' },
  { key: 'prenatal_testing', title: 'Prenatal Testing', icon: 'flask-outline' },
  { key: 'symptoms_emergencies', title: 'Symptoms & Emergencies', icon: 'warning-outline' },
  { key: 'hospital_information', title: 'Hospital Information', icon: 'business-outline' },
  { key: 'faqs', title: 'FAQs', icon: 'help-circle-outline' },
];

const KNOWLEDGE_BASE_ITEMS = [
  {
    cat: 'Warning Signs',
    icon: 'warning-outline',
    title: 'Danger signs that need same-day care',
    body: 'Severe headache with vision changes, heavy vaginal bleeding, sudden swelling of face/hands, reduced fetal movement, and convulsions are signs that should never wait for a scheduled visit.',
  },
  {
    cat: 'Nutrition',
    icon: 'nutrition-outline',
    title: 'Iron & folic acid basics',
    body: 'Iron-rich foods (leafy greens, legumes, lean meat) plus prescribed supplements help prevent anemia, one of the most common contributors to moderate risk scores.',
  },
  {
    cat: 'Exercise',
    icon: 'walk-outline',
    title: 'Safe movement by trimester',
    body: 'Walking, prenatal yoga, and swimming are generally safe. Avoid contact sports, activities with fall risk, and exercising flat on your back after the first trimester.',
  },
  {
    cat: 'Medication',
    icon: 'medkit-outline',
    title: 'What to ask before taking anything',
    body: 'Always confirm with your OB-GYN before starting any medication or supplement, including over-the-counter pain relief, during pregnancy.',
  },
  {
    cat: 'FAQ',
    icon: 'help-circle-outline',
    title: 'How is my risk score calculated?',
    body: 'PregnaCare scores reproductive history, medical conditions, and present pregnancy problems using a clinical rule table, then classifies the total with fuzzy logic into Low/High/Severe — plus a rule-based safety layer that can escalate to Severe immediately when specific danger patterns appear.',
  },
  {
    cat: 'Hospital Contacts',
    icon: 'business-outline',
    title: 'Keep this list handy',
    body: "Save your OB-GYN's direct line and your delivery hospital's labor & delivery unit in your emergency contacts.",
  },
];

const MED_NAME_OPTIONS = [
  'Prenatal Vitamin',
  'Iron Supplement',
  'Folic Acid',
  'Calcium',
  'Vitamin D',
  'DHA / Omega-3',
  'Vitamin B6',
  'Other (type it in)',
];

const MED_DOSAGE_OPTIONS = [
  '1 tablet',
  '2 tablets',
  '1 capsule',
  '250mg',
  '500mg',
  '1000mg',
  'Other (type it in)',
];

const MED_SCHEDULE_OPTIONS = [
  'Morning, before breakfast',
  'Morning, after breakfast',
  'Afternoon, after lunch',
  'Evening, after dinner',
  'Before bedtime',
  'Other (type it in)',
];

const PLAN_LOCATION_OPTIONS = [
  'City Hospital / Tertiary Medical Center',
  'Private Hospital',
  'Public District Hospital',
  'Maternity / Lying-in Clinic',
  'Birthing Center / Water Birth Center',
  'Home Birth (with licensed midwife)',
];

const PLAN_SUPPORT_OPTIONS = [
  'Partner / Husband',
  'Partner & Mother',
  'Partner & Doula',
  'Mother only',
  'Doula only',
  'Family Member / Sister',
  'Medical Staff only',
];

const PLAN_PAIN_OPTIONS = [
  'Unmedicated / Natural (Breathing & Movement)',
  'Epidural',
  'Nitrous Oxide (Gas & Air)',
  'IV Pain Relief / Analgesics',
  'Water Immersion / Warm Bath',
  'Open to options as labor progresses',
];

const PLAN_REQUESTS_OPTIONS = [
  'Immediate skin-to-skin contact & delayed cord clamping',
  'Quiet, dim room with soothing music',
  'Delayed cord clamping only',
  'Partner to cut the umbilical cord',
  'No episiotomy unless medically necessary',
  'Breastfeeding support within the first hour',
  'Standard hospital protocol (no special requests)',
];

export interface PrenatalLabItem {
  id: string;
  name: string;
  trimester: '1st Tri' | '2nd Tri' | '3rd Tri';
  timing: string;
  purpose: string;
  isCustom?: boolean;
}

export const DEFAULT_PRENATAL_LABS: PrenatalLabItem[] = [
  {
    id: 'lab-cbc-1',
    name: 'Complete Blood Count (CBC)',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Evaluates hemoglobin and hematocrit to screen for maternal anemia and baseline infection status.',
  },
  {
    id: 'lab-blood-type',
    name: 'Blood Typing & Rh Factor Screen',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Determines ABO blood group and Rh status to prevent Rh isoimmunization / hemolytic disease in the fetus.',
  },
  {
    id: 'lab-urinalysis-1',
    name: 'Urinalysis & Urine Culture',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Screens for asymptomatic bacteriuria and urinary tract infection to prevent kidney complications and preterm labor.',
  },
  {
    id: 'lab-fbs',
    name: 'Fasting Blood Sugar (FBS)',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Baseline glucose test to screen for overt pre-existing diabetes in early pregnancy.',
  },
  {
    id: 'lab-hbsag',
    name: 'Hepatitis B Surface Antigen (HBsAg)',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Screens for maternal Hepatitis B carriage to protect baby with birth-dose immunoglobulin & vaccine.',
  },
  {
    id: 'lab-vdrl',
    name: 'Syphilis Serology (VDRL / RPR)',
    trimester: '1st Tri',
    timing: '6–12 Weeks (Initial Visit)',
    purpose: 'Early detection of maternal syphilis for prompt penicillin treatment to protect the unborn child.',
  },
  {
    id: 'lab-us-early',
    name: 'Early Dating Ultrasound Scan',
    trimester: '1st Tri',
    timing: '6–12 Weeks',
    purpose: 'Confirms intrauterine viability, heartbeat, and accurately establishes the Estimated Due Date (EDD).',
  },
  {
    id: 'lab-cas-us',
    name: 'Anatomy Ultrasound Scan (CAS)',
    trimester: '2nd Tri',
    timing: '18–22 Weeks',
    purpose: 'Detailed anatomical assessment of fetal organs, spine, placental location, and amniotic fluid volume.',
  },
  {
    id: 'lab-ogtt',
    name: '75g Oral Glucose Tolerance Test (OGTT)',
    trimester: '2nd Tri',
    timing: '24–28 Weeks',
    purpose: 'Gold standard diagnostic screening to detect and manage Gestational Diabetes Mellitus (GDM).',
  },
  {
    id: 'lab-cbc-2',
    name: 'Repeat CBC (Hemoglobin & Platelets)',
    trimester: '2nd Tri',
    timing: '24–28 Weeks',
    purpose: 'Checks for physiological dilution anemia as maternal blood volume peaks in the second trimester.',
  },
  {
    id: 'lab-gbs',
    name: 'Group B Streptococcus (GBS) Screen',
    trimester: '3rd Tri',
    timing: '35–37 Weeks',
    purpose: 'Vaginal-rectal swab culture to determine need for protective intrapartum antibiotics during labor.',
  },
  {
    id: 'lab-urinalysis-3',
    name: 'Urinalysis (Protein & Ketones)',
    trimester: '3rd Tri',
    timing: '32–36 Weeks',
    purpose: 'Screens for proteinuria (critical sign of preeclampsia) and late gestational kidney stress.',
  },
];

export interface MaternalVaccineItem {
  id: string;
  name: string;
  timing: string;
  dosage: string;
  purpose: string;
  isCustom?: boolean;
}

export const DEFAULT_MATERNAL_VACCINES: MaternalVaccineItem[] = [
  {
    id: 'vax-tdap',
    name: 'Tdap (Tetanus, Diphtheria, Pertussis)',
    timing: '27–36 Weeks (Every Pregnancy)',
    dosage: '0.5 mL IM',
    purpose: 'Provides vital maternal antibodies to shield the baby against whooping cough (pertussis) during the first 2 months of life.',
  },
  {
    id: 'vax-tt1',
    name: 'Tetanus Toxoid Dose 1 (TT1)',
    timing: '1st Contact / 1st Trimester',
    dosage: '0.5 mL IM',
    purpose: 'First immunizing dose; establishes baseline protection against maternal and neonatal tetanus.',
  },
  {
    id: 'vax-tt2',
    name: 'Tetanus Toxoid Dose 2 (TT2)',
    timing: 'At least 4 weeks after TT1',
    dosage: '0.5 mL IM',
    purpose: 'Provides 80% protection for 3 years; critical in preventing neonatal tetanus at birth.',
  },
  {
    id: 'vax-tt3',
    name: 'Tetanus Toxoid Booster (TT3 / TT4 / TT5)',
    timing: 'At least 6 months after TT2',
    dosage: '0.5 mL IM',
    purpose: 'Extends protection to 5 years (TT3), 10 years (TT4), or lifetime protection (TT5) for future pregnancies.',
  },
  {
    id: 'vax-flu',
    name: 'Inactivated Influenza (Flu) Vaccine',
    timing: 'Any Trimester (Flu Season)',
    dosage: 'Annual Dose (0.5 mL IM)',
    purpose: 'Protects against severe maternal respiratory infection and passes immune protection to baby for the first 6 months.',
  },
];

const DEFAULT_EDUCATION_GUIDANCE: Record<number, { label: string; categories: Record<string, any> }> = {
  1: {
    label: 'First Trimester',
    categories: {
      healthy_living: {
        explain: "Small changes now support your baby's earliest development.",
        recommendations: [
          'Eat balanced and nutrient-rich meals.',
          'Include folate-rich foods.',
          'Drink enough water.',
          'Gentle walking and pregnancy-safe activities may be appropriate.',
        ],
        reminders: [
          'Avoid alcohol, smoking, and unsafe medications.',
          'Start prescribed prenatal vitamins with folic acid.',
        ],
      },
      prenatal_testing: {
        explain: 'Early testing confirms your pregnancy and sets a baseline for your care.',
        recommendations: [
          'Confirm pregnancy and estimate gestational age.',
          'Schedule your first prenatal/OB visit.',
          'Discuss existing medical conditions with your OB-GYN.',
          'Ask about a dating ultrasound.',
        ],
        reminders: [
          'Bring a list of current medications and supplements to your first visit.',
        ],
      },
      symptoms_emergencies: {
        explain: 'Most early symptoms are normal, but some need same-day care.',
        recommendations: [
          'Monitor early pregnancy symptoms like nausea and fatigue.',
          'Track any spotting or cramping.',
        ],
        reminders: [
          "Heavy bleeding, severe abdominal pain, fainting, or severe vomiting/dehydration need prompt medical attention — don't wait for your next visit.",
        ],
      },
      hospital_information: {
        explain: "You likely won't need delivery logistics yet, but a little prep now helps.",
        recommendations: [
          "Save your OB-GYN's direct line.",
          'Save your delivery hospital contact in your contacts.',
        ],
        reminders: [
          'Confirm which hospital or birthing center your OB-GYN is affiliated with.',
        ],
      },
      faqs: {
        explain: 'Answers to what most people ask in the first trimester.',
        recommendations: [
          'Is spotting normal? Light spotting can happen but should always be reported.',
          'When will morning sickness improve? For most people, by around week 14.',
        ],
        reminders: [
          'Any bleeding or severe pain should be reported to your OB-GYN, not just tracked at home.',
        ],
      },
    },
  },
  2: {
    label: 'Second Trimester',
    categories: {
      healthy_living: {
        explain: 'Your nutrient needs increase as your baby grows quickly this trimester.',
        recommendations: [
          'Continue iron, folic acid, calcium, and other prescribed supplements.',
          'Eat protein-rich, iron-rich, and calcium-rich foods.',
          'Maintain adequate hydration.',
          'Walking, prenatal yoga, and other pregnancy-safe exercises may be appropriate.',
        ],
        reminders: [
          'Avoid exercises flat on your back after the first trimester.',
        ],
      },
      prenatal_testing: {
        explain: 'Several key screenings happen in the second trimester.',
        recommendations: [
          'Follow recommended prenatal tests and screenings.',
          'Attend your anatomy scan ultrasound (~18–20 weeks).',
          'Complete glucose screening as scheduled.',
        ],
        reminders: [
          "Ask your OB-GYN to explain any results you don't understand.",
        ],
      },
      symptoms_emergencies: {
        explain: 'Fetal movement becomes a key thing to track this trimester.',
        recommendations: [
          'Monitor fetal movement as it becomes noticeable.',
          'Monitor blood pressure and weight as advised.',
        ],
        reminders: [
          'Vaginal bleeding, severe abdominal pain, severe headache with vision changes, sudden swelling, leaking fluid, or concerning changes in fetal movement should not be ignored.',
        ],
      },
      hospital_information: {
        explain: "Start getting familiar with where you'll deliver.",
        recommendations: [
          "Research your delivery hospital's labor & delivery unit.",
          'Ask about registration or pre-admission paperwork.',
        ],
        reminders: [
          "Save your OB-GYN's office number and emergency contact for quick access.",
        ],
      },
      faqs: {
        explain: 'Common second-trimester questions.',
        recommendations: [
          'When will I feel the baby move? Most people start feeling movement between 18–22 weeks.',
          'Is it safe to travel? Usually yes, but check with your OB-GYN for your specific situation.',
        ],
        reminders: [
          "Get familiar with your baby's typical movement pattern so you'll notice changes.",
        ],
      },
    },
  },
  3: {
    label: 'Third Trimester',
    categories: {
      healthy_living: {
        explain: 'Comfort and preparation take priority as delivery approaches.',
        recommendations: [
          'Continue iron and calcium as prescribed.',
          'Eat small frequent meals if more comfortable.',
          'Gentle walking and pregnancy-safe exercises may be appropriate.',
        ],
        reminders: [
          'Save higher-intensity activity for after delivery unless cleared by your OB-GYN.',
        ],
      },
      prenatal_testing: {
        explain: 'Visits become more frequent to monitor you and your baby closely.',
        recommendations: [
          'Attend weekly/biweekly OB visits as advised.',
          'Count/monitor fetal movements as instructed.',
        ],
        reminders: [
          'Ask about Group B Strep testing, usually done around 36–37 weeks.',
        ],
      },
      symptoms_emergencies: {
        explain: 'Some symptoms this trimester are urgent and require immediate care.',
        recommendations: [
          'Count fetal movements as instructed.',
        ],
        reminders: [
          'Severe headache with vision changes, heavy vaginal bleeding, sudden swelling of the face or hands, reduced fetal movement, or convulsions are urgent — seek immediate medical attention.',
        ],
      },
      hospital_information: {
        explain: "It's time to be fully ready for delivery.",
        recommendations: [
          'Pack your hospital bag.',
          'Install your car seat.',
          "Confirm your delivery hospital's admission process.",
        ],
        reminders: [
          "Keep your OB-GYN's direct line and your hospital's labor & delivery unit number easy to find.",
        ],
      },
      faqs: {
        explain: 'Common questions as you approach your due date.',
        recommendations: [
          "How do I know it's real labor? Contractions that get closer together, longer, and stronger, and don't ease with rest.",
          'What if I go past my due date? Your OB-GYN will discuss monitoring or induction options.',
        ],
        reminders: [
          "If you're ever unsure whether it's labor, call your OB-GYN or labor & delivery unit.",
        ],
      },
    },
  },
};

export const WellnessScreen: React.FC<WellnessScreenProps> = ({
  initialTab = 'education',
  onNavigate,
  onTabChange,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<WellnessTabKey>(initialTab);
  const [activeTrimester, setActiveTrimester] = useState<1 | 2 | 3>(2);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [selectedEdCard, setSelectedEdCard] = useState<any>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);

  // Education state
  const [educationData, setEducationData] = useState<any>(DEFAULT_EDUCATION_GUIDANCE);

  // Meals state
  const [mealsData, setMealsData] = useState<any>(null);

  // Hospital Bag State
  const [bagCategories, setBagCategories] = useState<Record<string, any[]>>({});
  const [bagProgress, setBagProgress] = useState(0);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemCat, setNewItemCat] = useState('The Grab-and-Go Folder');

  // Medications State
  const [meds, setMeds] = useState<any[]>([]);
  const [selectedMedName, setSelectedMedName] = useState('');
  const [customMedName, setCustomMedName] = useState('');
  const [selectedDosage, setSelectedDosage] = useState('');
  const [customDosage, setCustomDosage] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [customSchedule, setCustomSchedule] = useState('');
  const [activePicker, setActivePicker] = useState<
    | 'name'
    | 'dosage'
    | 'schedule'
    | 'rem_name'
    | 'rem_dosage'
    | 'rem_schedule'
    | 'plan_location'
    | 'plan_support'
    | 'plan_pain'
    | 'plan_requests'
    | null
  >(null);
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);

  // Birth Plan State & Custom Inputs
  const [customPlanLocation, setCustomPlanLocation] = useState('');
  const [customPlanSupport, setCustomPlanSupport] = useState('');
  const [customPlanPain, setCustomPlanPain] = useState('');
  const [customPlanRequests, setCustomPlanRequests] = useState('');
  const [isOtherLocation, setIsOtherLocation] = useState(false);
  const [isOtherSupport, setIsOtherSupport] = useState(false);
  const [isOtherPain, setIsOtherPain] = useState(false);
  const [isOtherRequests, setIsOtherRequests] = useState(false);

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
  const [newbornCareFilter, setNewbornCareFilter] = useState<'all' | 'todo' | 'done'>('all');

  // Reminders State (matching reminders.php)
  const [remindersData, setRemindersData] = useState<any>(null);
  const [nextObDate, setNextObDate] = useState('');
  const [obVisitsList, setObVisitsList] = useState<any[]>([]);
  const [newObVisitDate, setNewObVisitDate] = useState('');
  const [newObVisitTitle, setNewObVisitTitle] = useState('Routine Prenatal Checkup');
  const [newObVisitNotes, setNewObVisitNotes] = useState('');
  const [showAddSupp, setShowAddSupp] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [customSuppName, setCustomSuppName] = useState('');
  const [suppDosage, setSuppDosage] = useState('');
  const [customSuppDosage, setCustomSuppDosage] = useState('');
  const [suppSchedule, setSuppSchedule] = useState('');
  const [customSuppSchedule, setCustomSuppSchedule] = useState('');
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);
  const [isSavingObVisit, setIsSavingObVisit] = useState(false);

  // Reminders Category & Laboratory / Vaccine State
  const [reminderCategory, setReminderCategory] = useState<'all' | 'supplements' | 'laboratories' | 'vaccination'>('all');
  const [labStatusMap, setLabStatusMap] = useState<Record<string, { completed: boolean; date?: string }>>({});
  const [customLabs, setCustomLabs] = useState<PrenatalLabItem[]>([]);
  const [labTriFilter, setLabTriFilter] = useState<'all' | '1st Tri' | '2nd Tri' | '3rd Tri'>('all');
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [newLabTrimester, setNewLabTrimester] = useState<'1st Tri' | '2nd Tri' | '3rd Tri'>('1st Tri');
  const [newLabTiming, setNewLabTiming] = useState('');
  const [newLabPurpose, setNewLabPurpose] = useState('');

  const [vaxStatusMap, setVaxStatusMap] = useState<Record<string, { completed: boolean; date?: string }>>({});
  const [customVaxes, setCustomVaxes] = useState<MaternalVaccineItem[]>([]);
  const [showAddVaxModal, setShowAddVaxModal] = useState(false);
  const [newVaxName, setNewVaxName] = useState('');
  const [newVaxTiming, setNewVaxTiming] = useState('');
  const [newVaxDosage, setNewVaxDosage] = useState('');
  const [newVaxPurpose, setNewVaxPurpose] = useState('');

  // Calendar Modal State
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const openCalendarModal = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dateToInspect = newObVisitDate || nextObDate;
    if (dateToInspect) {
      const parts = dateToInspect.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const target = new Date(y, m, d);
        target.setHours(0, 0, 0, 0);
        if (target.getTime() > now.getTime()) {
          setCalYear(y);
          setCalMonth(m);
        } else {
          setCalYear(now.getFullYear());
          setCalMonth(now.getMonth());
        }
      }
    } else {
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
    }
    setShowCalendarModal(true);
  };

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
        if (res.birthPlan) {
          setBirthPlan(res.birthPlan);
          if (res.birthPlan.delivery_location && !PLAN_LOCATION_OPTIONS.slice(0, -1).includes(res.birthPlan.delivery_location)) {
            setIsOtherLocation(true);
            setCustomPlanLocation(res.birthPlan.delivery_location);
          }
          if (res.birthPlan.support_people && !PLAN_SUPPORT_OPTIONS.slice(0, -1).includes(res.birthPlan.support_people)) {
            setIsOtherSupport(true);
            setCustomPlanSupport(res.birthPlan.support_people);
          }
          if (res.birthPlan.pain_management && !PLAN_PAIN_OPTIONS.slice(0, -1).includes(res.birthPlan.pain_management)) {
            setIsOtherPain(true);
            setCustomPlanPain(res.birthPlan.pain_management);
          }
          if (res.birthPlan.special_requests && !PLAN_REQUESTS_OPTIONS.slice(0, -1).includes(res.birthPlan.special_requests)) {
            setIsOtherRequests(true);
            setCustomPlanRequests(res.birthPlan.special_requests);
          }
        }
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
        if (Array.isArray(res.obVisits)) {
          setObVisitsList(res.obVisits);
          try {
            await AsyncStorage.setItem(api.getUserStorageKey('ob_visits_list'), JSON.stringify(res.obVisits));
          } catch (e) {}
        }

        // Load persisted lab status & custom labs
        try {
          const storedObVisits = await AsyncStorage.getItem(api.getUserStorageKey('ob_visits_list'));
          if (storedObVisits && (!res.obVisits || res.obVisits.length === 0)) {
            setObVisitsList(JSON.parse(storedObVisits));
          } else if (!storedObVisits && (!res.obVisits || res.obVisits.length === 0)) {
            setObVisitsList([]);
          }
          const storedLabs = await AsyncStorage.getItem(api.getUserStorageKey('lab_reminders_status'));
          if (storedLabs) setLabStatusMap(JSON.parse(storedLabs));
          else setLabStatusMap({});

          const storedCustomLabs = await AsyncStorage.getItem(api.getUserStorageKey('custom_lab_reminders'));
          if (storedCustomLabs) setCustomLabs(JSON.parse(storedCustomLabs));
          else setCustomLabs([]);

          const storedVax = await AsyncStorage.getItem(api.getUserStorageKey('maternal_vax_reminders_status'));
          if (storedVax) setVaxStatusMap(JSON.parse(storedVax));
          else setVaxStatusMap({});

          const storedCustomVax = await AsyncStorage.getItem(api.getUserStorageKey('custom_vax_reminders'));
          if (storedCustomVax) setCustomVaxes(JSON.parse(storedCustomVax));
          else setCustomVaxes([]);
        } catch (err) {
          console.warn('Error reading reminders storage:', err);
        }
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

  const handleAddMedication = async () => {
    const finalName = selectedMedName === 'Other (type it in)' ? customMedName.trim() : selectedMedName.trim();
    const finalDosage = selectedDosage === 'Other (type it in)' ? customDosage.trim() : selectedDosage.trim();
    const finalSchedule = selectedSchedule === 'Other (type it in)' ? customSchedule.trim() : selectedSchedule.trim();

    if (!finalName) {
      Alert.alert('Required', 'Please select or enter a medication/vitamin name.');
      return;
    }

    setIsSubmittingMed(true);
    try {
      await api.addMedication(finalName, finalDosage, finalSchedule || 'Daily');
      setSelectedMedName('');
      setCustomMedName('');
      setSelectedDosage('');
      setCustomDosage('');
      setSelectedSchedule('');
      setCustomSchedule('');
      Alert.alert('Success', `${finalName} added to your list.`);
      loadTabContent('meds');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add medication.');
    } finally {
      setIsSubmittingMed(false);
    }
  };

  const handleDeleteMed = (id: string, name: string) => {
    Alert.alert('Remove Item', `Remove ${name} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMedication(id);
            loadTabContent('meds');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not remove medication.');
          }
        },
      },
    ]);
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

  const handleToggleNewbornCare = async (itemId: string, currentCompleted: boolean) => {
    try {
      const newCompleted = !currentCompleted;
      setPostpartumData((prev: any) => {
        if (!prev) return prev;
        const updatedList = (prev.newbornCareChecklist || []).map((item: any) => {
          if (item.id === itemId) {
            return {
              ...item,
              is_completed: newCompleted ? 1 : 0,
              completed_at: newCompleted ? new Date().toISOString() : null,
            };
          }
          return item;
        });
        const total = updatedList.length;
        const completed = updatedList.filter((i: any) => i.is_completed).length;
        return {
          ...prev,
          newbornCareChecklist: updatedList,
          newbornCareStats: {
            total,
            completed,
            pending: total - completed,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          },
        };
      });

      const res = await api.toggleNewbornCare(itemId, newCompleted);
      if (res && res.newbornCareChecklist) {
        setPostpartumData((prev: any) => ({
          ...prev,
          newbornCareChecklist: res.newbornCareChecklist,
          newbornCareStats: res.newbornCareStats,
        }));
      }
      loadTabContent('postpartum');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // --- Reminders Actions (matching reminders.php) ---
  const handleSaveObVisit = async () => {
    const targetDate = (newObVisitDate.trim() || nextObDate.trim());
    if (!targetDate) {
      Alert.alert('Select Date', 'Please select an upcoming checkup date using the calendar.');
      return;
    }

    const parts = targetDate.split('-');
    if (parts.length === 3) {
      const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      target.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (target.getTime() <= today.getTime()) {
        Alert.alert('Invalid Date', 'Please select an upcoming future date for your prenatal checkup. Today and past dates cannot be scheduled.');
        return;
      }
    }

    // Check duplicate
    const isDuplicate = obVisitsList.some((v) => v.visit_date === targetDate);
    if (isDuplicate) {
      Alert.alert('Already Scheduled', `A prenatal checkup on ${formatReminderDate(targetDate)} is already in your schedule.`);
      return;
    }

    setIsSavingObVisit(true);
    try {
      const visitTitle = newObVisitTitle.trim() || 'Prenatal Checkup';
      const visitNotes = newObVisitNotes.trim();

      const res = await api.addObVisit(targetDate, visitTitle, visitNotes);

      if (Array.isArray(res.obVisits)) {
        setObVisitsList(res.obVisits);
        try {
          await AsyncStorage.setItem(api.getUserStorageKey('ob_visits_list'), JSON.stringify(res.obVisits));
        } catch (e) {}
      }
      if (res.nextObVisit !== undefined) {
        setNextObDate(res.nextObVisit || '');
      }

      // Trigger phone system notification
      if (parts.length === 3) {
        const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        const dateLabel = formatReminderDate(targetDate);
        const bodyText = diffDays === 1
          ? `Your ${visitTitle} is scheduled for TOMORROW (${dateLabel})!`
          : `Your ${visitTitle} is scheduled in ${diffDays} day(s), on ${dateLabel}.`;

        await sendPhoneNotification('OB-GYN Visit Reminder 🩺', bodyText, { date: targetDate });
        await scheduleObVisitNotification(targetDate, dateLabel);
      }

      // Reset form
      setNewObVisitDate('');
      setNewObVisitNotes('');
      setNewObVisitTitle('Routine Prenatal Checkup');

      Alert.alert('Visit Scheduled', 'Checkup date saved. A reminder notification has been scheduled.');
      loadTabContent('reminders');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save checkup date.');
    } finally {
      setIsSavingObVisit(false);
    }
  };

  const handleDeleteObVisit = (visitId: string, visitDate: string, visitTitle?: string) => {
    Alert.alert(
      'Remove Checkup',
      `Are you sure you want to remove the visit on ${formatReminderDate(visitDate)}${visitTitle ? ` (${visitTitle})` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.deleteObVisit(visitId);
              if (Array.isArray(res.obVisits)) {
                setObVisitsList(res.obVisits);
                try {
                  await AsyncStorage.setItem(api.getUserStorageKey('ob_visits_list'), JSON.stringify(res.obVisits));
                } catch (e) {}
              }
              if (res.nextObVisit !== undefined) {
                setNextObDate(res.nextObVisit || '');
              }
              loadTabContent('reminders');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not remove checkup visit.');
            }
          },
        },
      ]
    );
  };

  const toggleReminderMed = async (medId: string) => {
    try {
      await api.toggleMedicationTaken(medId);
      loadTabContent('reminders');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update status.');
    }
  };

  const handleAddReminderSupp = async () => {
    const finalName = suppName === 'Other (type it in)' ? customSuppName.trim() : suppName.trim();
    const finalDosage = suppDosage === 'Other (type it in)' ? customSuppDosage.trim() : suppDosage.trim();
    const finalSchedule = suppSchedule === 'Other (type it in)' ? customSuppSchedule.trim() : suppSchedule.trim();

    if (!finalName) {
      Alert.alert('Required', 'Please select or enter a supplement/vitamin name.');
      return;
    }

    setIsSubmittingSupp(true);
    try {
      await api.addSupplement(finalName, finalDosage, finalSchedule || 'Daily with breakfast');
      setSuppName('');
      setCustomSuppName('');
      setSuppDosage('');
      setCustomSuppDosage('');
      setSuppSchedule('');
      setCustomSuppSchedule('');
      setShowAddSupp(false);
      Alert.alert('Success', `${finalName} added to your checklist.`);
      loadTabContent('reminders');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add supplement.');
    } finally {
      setIsSubmittingSupp(false);
    }
  };

  // --- Prenatal Laboratory Reminders Actions ---
  const toggleLabReminder = async (labId: string) => {
    try {
      const isCompleted = !!labStatusMap[labId]?.completed;
      const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const updated = {
        ...labStatusMap,
        [labId]: {
          completed: !isCompleted,
          date: !isCompleted ? todayFormatted : undefined,
        },
      };
      setLabStatusMap(updated);
      await AsyncStorage.setItem(api.getUserStorageKey('lab_reminders_status'), JSON.stringify(updated));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update laboratory reminder.');
    }
  };

  const handleAddCustomLab = async () => {
    if (!newLabName.trim()) {
      Alert.alert('Required', 'Please enter a laboratory test name.');
      return;
    }
    const item: PrenatalLabItem = {
      id: `custom-lab-${Date.now()}`,
      name: newLabName.trim(),
      trimester: newLabTrimester,
      timing: newLabTiming.trim() || `${newLabTrimester} Scheduled`,
      purpose: newLabPurpose.trim() || 'Clinical laboratory evaluation as advised by your healthcare provider.',
      isCustom: true,
    };
    const updated = [...customLabs, item];
    setCustomLabs(updated);
    await AsyncStorage.setItem(api.getUserStorageKey('custom_lab_reminders'), JSON.stringify(updated));
    setNewLabName('');
    setNewLabTiming('');
    setNewLabPurpose('');
    setShowAddLabModal(false);
    Alert.alert('Reminder Added', `${item.name} added to your laboratory reminders.`);
  };

  const handleDeleteCustomLab = (id: string, name: string) => {
    Alert.alert('Remove Reminder', `Remove "${name}" from your laboratory reminders?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = customLabs.filter((c) => c.id !== id);
          setCustomLabs(updated);
          await AsyncStorage.setItem(api.getUserStorageKey('custom_lab_reminders'), JSON.stringify(updated));
        },
      },
    ]);
  };

  // --- Maternal Vaccination Reminders Actions ---
  const toggleVaxReminder = async (vaxId: string) => {
    try {
      const isCompleted = !!vaxStatusMap[vaxId]?.completed;
      const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const updated = {
        ...vaxStatusMap,
        [vaxId]: {
          completed: !isCompleted,
          date: !isCompleted ? todayFormatted : undefined,
        },
      };
      setVaxStatusMap(updated);
      await AsyncStorage.setItem(api.getUserStorageKey('maternal_vax_reminders_status'), JSON.stringify(updated));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update vaccination reminder.');
    }
  };

  const handleAddCustomVax = async () => {
    if (!newVaxName.trim()) {
      Alert.alert('Required', 'Please enter a vaccine name.');
      return;
    }
    const item: MaternalVaccineItem = {
      id: `custom-vax-${Date.now()}`,
      name: newVaxName.trim(),
      timing: newVaxTiming.trim() || 'As advised by OB-GYN',
      dosage: newVaxDosage.trim() || 'Recommended Dose',
      purpose: newVaxPurpose.trim() || 'Maternal immunization for infection protection.',
      isCustom: true,
    };
    const updated = [...customVaxes, item];
    setCustomVaxes(updated);
    await AsyncStorage.setItem(api.getUserStorageKey('custom_vax_reminders'), JSON.stringify(updated));
    setNewVaxName('');
    setNewVaxTiming('');
    setNewVaxDosage('');
    setNewVaxPurpose('');
    setShowAddVaxModal(false);
    Alert.alert('Reminder Added', `${item.name} added to your vaccination reminders.`);
  };

  const handleDeleteCustomVax = (id: string, name: string) => {
    Alert.alert('Remove Reminder', `Remove "${name}" from your vaccination reminders?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = customVaxes.filter((c) => c.id !== id);
          setCustomVaxes(updated);
          await AsyncStorage.setItem(api.getUserStorageKey('custom_vax_reminders'), JSON.stringify(updated));
        },
      },
    ]);
  };

  const formatReminderDate = (rawDate?: string | null) => {
    if (!rawDate) return '';
    try {
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      const d = new Date(rawDate);
      return !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : rawDate;
    } catch {
      return rawDate;
    }
  };

  const CALENDAR_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderCalendarGrid = () => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTime = now.getTime();

    const cells: React.ReactNode[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      cells.push(
        <View key={`prev-${prevDayNum}`} style={styles.calCell}>
          <Text style={[styles.calCellMutedText, isDarkMode && { color: '#444' }]}>{prevDayNum}</Text>
        </View>
      );
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSelected = (newObVisitDate === dateStr) || (!newObVisitDate && nextObDate === dateStr);
      const isAlreadyScheduled = obVisitsList.some((v) => v.visit_date === dateStr);

      const cellDate = new Date(calYear, calMonth, d);
      cellDate.setHours(0, 0, 0, 0);
      const cellTime = cellDate.getTime();
      const isPast = cellTime < todayTime;
      const isToday = cellTime === todayTime;
      const isDisabled = isPast || isToday;

      cells.push(
        <TouchableOpacity
          key={`day-${d}`}
          style={[
            styles.calCell,
            isDisabled && styles.calCellDisabled,
            isToday && styles.calCellToday,
            isSelected && !isDisabled && styles.calCellSelected,
          ]}
          onPress={() => {
            if (isDisabled) return;
            setNewObVisitDate(dateStr);
            setNextObDate(dateStr);
            setShowCalendarModal(false);
          }}
          disabled={isDisabled}
          activeOpacity={isDisabled ? 1 : 0.7}
        >
          <Text
            style={[
              styles.calCellText,
              isDarkMode && { color: '#FFF' },
              isDisabled && (isDarkMode ? { color: '#4A4A52' } : styles.calCellDisabledText),
              isToday && (isDarkMode ? { color: '#FF94B8' } : styles.calCellTodayText),
              isSelected && !isDisabled && styles.calCellSelectedText,
            ]}
          >
            {d}
          </Text>
          {isToday ? (
            <View style={[styles.todayIndicatorDot, isDarkMode && { backgroundColor: '#FF94B8' }]} />
          ) : isAlreadyScheduled ? (
            <View style={[styles.scheduledIndicatorDot, isDarkMode && { backgroundColor: '#34D399' }]} />
          ) : null}
        </TouchableOpacity>
      );
    }

    // Next month padding
    const totalCells = cells.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let n = 1; n <= remaining; n++) {
      cells.push(
        <View key={`next-${n}`} style={styles.calCell}>
          <Text style={[styles.calCellMutedText, isDarkMode && { color: '#444' }]}>{n}</Text>
        </View>
      );
    }

    return cells;
  };

  const currentTrimesterGuidance =
    educationData?.[activeTrimester]?.categories ||
    DEFAULT_EDUCATION_GUIDANCE[activeTrimester]?.categories ||
    {};
  const currentTrimesterMeals = mealsData?.[activeTrimester] || { focus: '', items: [] };

  const allLabs = [...DEFAULT_PRENATAL_LABS, ...customLabs];
  const completedLabCount = allLabs.filter((l) => !!labStatusMap[l.id]?.completed).length;
  const pendingLabCount = allLabs.length - completedLabCount;

  const allVaxes = [...DEFAULT_MATERNAL_VACCINES, ...customVaxes];
  const completedVaxCount = allVaxes.filter((v) => !!vaxStatusMap[v.id]?.completed).length;
  const pendingVaxCount = allVaxes.length - completedVaxCount;

  const filteredLabs = allLabs.filter((lab) => {
    if (labTriFilter === 'all') return true;
    return lab.trimester === labTriFilter;
  });

  const renderNewbornCareChecklistCard = () => {
    const list = postpartumData?.newbornCareChecklist || [];
    const stats = postpartumData?.newbornCareStats || {
      total: list.length || 12,
      completed: list.filter((i: any) => i.is_completed).length,
      pending: list.filter((i: any) => !i.is_completed).length,
      percent: 0,
    };
    const filteredList = list.filter((item: any) => {
      if (newbornCareFilter === 'todo') return !item.is_completed;
      if (newbornCareFilter === 'done') return !!item.is_completed;
      return true;
    });

    return (
      <View style={[styles.card, Shadows.card, { marginTop: 14 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.eyebrow}>ESSENTIAL NEWBORN CARE CHECKLIST</Text>
            <Text style={[styles.cardTitle, isDarkMode && { color: '#FFF' }]}>Unang Yakap & Clinical Protocol</Text>
            <Text style={styles.deliveryDesc}>
              Monitor what has been done and what still needs to be done according to WHO & Philippine DOH guidelines.
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingTop: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primaryDark }}>
              {stats.completed} of {stats.total} Done
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>
              {stats.percent}% Completed
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { marginVertical: 10 }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${stats.percent}%`, backgroundColor: '#059669' },
            ]}
          />
        </View>

        {/* Filter Pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              newbornCareFilter === 'all' && styles.filterPillActive,
              isDarkMode && { borderColor: '#333' },
            ]}
            onPress={() => setNewbornCareFilter('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                newbornCareFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              All ({stats.total})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              newbornCareFilter === 'todo' && styles.filterPillActive,
              isDarkMode && { borderColor: '#333' },
            ]}
            onPress={() => setNewbornCareFilter('todo')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                newbornCareFilter === 'todo' && styles.filterPillTextActive,
              ]}
            >
              To Do ({stats.pending})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterPill,
              newbornCareFilter === 'done' && styles.filterPillActive,
              isDarkMode && { borderColor: '#333' },
            ]}
            onPress={() => setNewbornCareFilter('done')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                newbornCareFilter === 'done' && styles.filterPillTextActive,
              ]}
            >
              Completed ({stats.completed})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Checklist items */}
        {filteredList.map((item: any) => {
          const isDone = !!item.is_completed;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.encCardRow,
                isDone && { backgroundColor: isDarkMode ? '#18181D' : '#F8FAFC' },
                isDarkMode && { borderColor: '#2C2C31', backgroundColor: '#131316' },
              ]}
              onPress={() => handleToggleNewbornCare(item.id, isDone)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isDone ? 'checkbox' : 'square-outline'}
                size={23}
                color={isDone ? Colors.riskLow : Colors.textMuted}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.encTitle,
                    isDone && styles.encTitleDone,
                    isDarkMode && { color: isDone ? '#888' : '#FFF' },
                  ]}
                >
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4, flexWrap: 'wrap' }}>
                  <View style={[styles.encBadge, isDarkMode && { backgroundColor: '#202026', borderColor: '#333' }]}>
                    <Text style={[styles.encBadgeText, isDarkMode && { color: '#CCC' }]}>{item.timing_label}</Text>
                  </View>
                  <View style={[styles.encBadge, isDarkMode && { backgroundColor: '#202026', borderColor: '#333' }]}>
                    <Text style={[styles.encBadgeText, isDarkMode && { color: '#CCC' }]}>{item.category}</Text>
                  </View>
                </View>
                <Text style={[styles.encDesc, isDarkMode && { color: '#A0A0A5' }]}>
                  {item.description}
                </Text>
                <View style={{ marginTop: 6 }}>
                  {isDone ? (
                    <View style={styles.vaxDoneBadge}>
                      <Ionicons name="checkmark" size={13} color={Colors.riskLow} style={{ marginRight: 3 }} />
                      <Text style={styles.vaxDoneText}>Completed</Text>
                    </View>
                  ) : (
                    <View style={[styles.vaxDoneBadge, { backgroundColor: isDarkMode ? '#202026' : '#F1F5F9', borderColor: isDarkMode ? '#333' : '#CBD5E1' }]}>
                      <Ionicons name="time-outline" size={13} color={isDarkMode ? '#AAA' : '#64748B'} style={{ marginRight: 3 }} />
                      <Text style={[styles.vaxDoneText, { color: isDarkMode ? '#AAA' : '#64748B' }]}>To Do / Pending</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, isDarkMode && { backgroundColor: '#0A0A0C' }]} contentContainerStyle={styles.content}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
        </View>
      ) : (
        <>
          {/* ================= 1. EDUCATION HUB ================= */}
          {activeTab === 'education' && (
            <View>
              {/* Pregnancy Guidance Card */}
              <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                <Text style={[styles.eyebrow, isDarkMode && { color: '#FF94B8' }]}>PREGNANCY GUIDANCE</Text>
                <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Explore recommendations by trimester</Text>

                {/* Trimester Tabs */}
                <View style={styles.trimesterTabs}>
                  {([1, 2, 3] as const).map((tri) => {
                    const label = tri === 1 ? 'First Trimester' : tri === 2 ? 'Second Trimester' : 'Third Trimester';
                    const isActive = activeTrimester === tri;
                    return (
                      <TouchableOpacity
                        key={tri}
                        style={[styles.trimesterBtn, isActive ? styles.trimesterBtnActive : (isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' })]}
                        onPress={() => setActiveTrimester(tri)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.trimesterBtnText, isActive ? styles.trimesterBtnTextActive : (isDarkMode && { color: '#85818A' })]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 2-Column Category Grid */}
                <View style={styles.edGrid}>
                  {CATEGORY_META.map((meta, idx) => {
                    const catData = currentTrimesterGuidance[meta.key] || DEFAULT_EDUCATION_GUIDANCE[activeTrimester]?.categories[meta.key];
                    const isLastOdd = idx === CATEGORY_META.length - 1 && CATEGORY_META.length % 2 !== 0;
                    return (
                      <TouchableOpacity
                        key={meta.key}
                        style={[
                          styles.edCard,
                          isLastOdd && styles.edCardFullWidth,
                          Shadows.card,
                          isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }
                        ]}
                        onPress={() => setSelectedEdCard({
                          ...catData,
                          title: meta.title,
                          icon: meta.icon,
                        })}
                        activeOpacity={0.7}
                      >
                        {isLastOdd ? (
                          <View style={styles.edCardFullContent}>
                            <View style={[styles.edIconBox, isDarkMode && { backgroundColor: '#2A1F26' }, { marginBottom: 0 }]}>
                              <Ionicons name={meta.icon} size={22} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                              <Text style={[styles.edCardTitle, { textAlign: 'left' }, isDarkMode && { color: '#F0EEF0' }]}>{meta.title}</Text>
                              <Text style={[styles.edCardSubtitle, isDarkMode && { color: '#85818A' }]} numberOfLines={1}>
                                Common pregnancy questions &amp; answers
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                          </View>
                        ) : (
                          <>
                            <View style={[styles.edIconBox, isDarkMode && { backgroundColor: '#2A1F26' }]}>
                              <Ionicons name={meta.icon} size={22} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                            </View>
                            <Text style={[styles.edCardTitle, isDarkMode && { color: '#F0EEF0' }]}>{meta.title}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.cardFooterMuted, isDarkMode && { color: '#85818A' }]}>
                  General guidance only — always confirm specific recommendations with your OB-GYN.
                </Text>
              </View>

              {/* Quick Reference Card */}
              <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }, { marginTop: 14 }]}>
                <Text style={[styles.eyebrow, isDarkMode && { color: '#FF94B8' }]}>QUICK REFERENCE</Text>
                <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Tap a topic to read more</Text>

                <View style={styles.edGrid}>
                  {KNOWLEDGE_BASE_ITEMS.map((kb, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.edCard, Shadows.card, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}
                      onPress={() => setSelectedEdCard({
                        title: kb.title,
                        category: kb.cat,
                        icon: kb.icon,
                        explain: kb.body,
                        recommendations: [],
                        reminders: [],
                      })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.edIconBox, isDarkMode && { backgroundColor: '#2A1F26' }]}>
                        <Ionicons name={kb.icon as any} size={22} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                      </View>
                      <Text style={[styles.edCardTitle, isDarkMode && { color: '#F0EEF0' }]}>{kb.cat}</Text>
                      <Text style={[styles.edCardTapHint, isDarkMode && { color: '#85818A' }]} numberOfLines={1}>
                        {kb.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
              {/* Card 1: Add a Medication or Vitamin */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.medCardHeading}>Add a Medication or Vitamin</Text>

                {/* Name */}
                <View style={styles.medFieldWrap}>
                  <Text style={styles.medFieldLabel}>Name</Text>
                  <TouchableOpacity
                    style={styles.medDropdownBtn}
                    onPress={() => setActivePicker('name')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.medDropdownText,
                        !selectedMedName && styles.medDropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedMedName || 'Select an item...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.text} />
                  </TouchableOpacity>
                  {selectedMedName === 'Other (type it in)' && (
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      placeholder="Enter medication/vitamin name"
                      value={customMedName}
                      onChangeText={setCustomMedName}
                    />
                  )}
                </View>

                {/* Dosage */}
                <View style={styles.medFieldWrap}>
                  <Text style={styles.medFieldLabel}>Dosage</Text>
                  <TouchableOpacity
                    style={styles.medDropdownBtn}
                    onPress={() => setActivePicker('dosage')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.medDropdownText,
                        !selectedDosage && styles.medDropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedDosage || 'Select a dosage...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.text} />
                  </TouchableOpacity>
                  {selectedDosage === 'Other (type it in)' && (
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      placeholder="Enter dosage"
                      value={customDosage}
                      onChangeText={setCustomDosage}
                    />
                  )}
                </View>

                {/* Schedule */}
                <View style={styles.medFieldWrap}>
                  <Text style={styles.medFieldLabel}>Schedule</Text>
                  <TouchableOpacity
                    style={styles.medDropdownBtn}
                    onPress={() => setActivePicker('schedule')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.medDropdownText,
                        !selectedSchedule && styles.medDropdownPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedSchedule || 'Select a schedule...'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={Colors.text} />
                  </TouchableOpacity>
                  {selectedSchedule === 'Other (type it in)' && (
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      placeholder="Enter schedule"
                      value={customSchedule}
                      onChangeText={setCustomSchedule}
                    />
                  )}
                </View>

                {/* Add to List Button */}
                <TouchableOpacity
                  style={styles.btnAddMed}
                  onPress={handleAddMedication}
                  disabled={isSubmittingMed}
                  activeOpacity={0.85}
                >
                  {isSubmittingMed ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add" size={19} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.btnAddMedText}>Add to My List</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Card 2: Today's Checklist */}
              <View style={[styles.card, Shadows.card, { marginTop: 14 }]}>
                <Text style={styles.medCardHeading}>Today's Checklist</Text>

                {meds.length === 0 ? (
                  <View style={styles.medEmptyWrap}>
                    <View style={styles.twoPillsRow}>
                      <Ionicons
                        name="medical"
                        size={36}
                        color="#FFAFCC"
                        style={{ transform: [{ rotate: '-25deg' }], marginRight: -8 }}
                      />
                      <Ionicons
                        name="ellipse"
                        size={26}
                        color="#FFC8DD"
                        style={{ transform: [{ rotate: '45deg' }] }}
                      />
                    </View>
                    <Text style={styles.medEmptyText}>No medications/vitamins added yet.</Text>
                  </View>
                ) : (
                  meds.map((m) => {
                    const isTaken = !!m.takenToday;
                    return (
                      <View
                        key={m.id}
                        style={[styles.medChecklistRow, isTaken && styles.medChecklistRowTaken]}
                      >
                        <TouchableOpacity
                          style={styles.medCheckBtn}
                          onPress={() => toggleMed(m.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isTaken ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={isTaken ? Colors.primaryDark : Colors.textMuted}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text
                              style={[styles.medItemName, isTaken && styles.medItemNameTaken]}
                            >
                              {m.name}
                            </Text>
                            {(m.dosage || m.scheduleTime || m.schedule_time) && (
                              <Text style={styles.medItemMeta}>
                                {m.dosage}
                                {m.dosage && (m.scheduleTime || m.schedule_time) ? ' · ' : ''}
                                {m.scheduleTime || m.schedule_time}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.medDeleteBtn}
                          onPress={() => handleDeleteMed(m.id, m.name)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={17} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  })
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

              {/* 1. Delivery Location Preference */}
              <Text style={styles.fieldLabel}>Delivery Location Preference</Text>
              <View
                style={[
                  styles.comboboxField,
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                ]}
              >
                <TextInput
                  style={[styles.comboboxInputField, isDarkMode && { color: '#FFF' }]}
                  value={birthPlan.delivery_location}
                  onChangeText={(t) => setBirthPlan({ ...birthPlan, delivery_location: t })}
                  placeholder="e.g. City Hospital, Maternity Clinic, Water Birth"
                  placeholderTextColor={isDarkMode ? '#666' : '#8E8294'}
                />
                <TouchableOpacity
                  style={styles.comboboxChevronBtn}
                  onPress={() => setActivePicker('plan_location')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={18} color={isDarkMode ? '#888' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

              {/* 2. Labor Support People */}
              <Text style={styles.fieldLabel}>Labor Support People</Text>
              <View
                style={[
                  styles.comboboxField,
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                ]}
              >
                <TextInput
                  style={[styles.comboboxInputField, isDarkMode && { color: '#FFF' }]}
                  value={birthPlan.support_people}
                  onChangeText={(t) => setBirthPlan({ ...birthPlan, support_people: t })}
                  placeholder="e.g. Partner, Doula, Mother"
                  placeholderTextColor={isDarkMode ? '#666' : '#8E8294'}
                />
                <TouchableOpacity
                  style={styles.comboboxChevronBtn}
                  onPress={() => setActivePicker('plan_support')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={18} color={isDarkMode ? '#888' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

              {/* 3. Pain Management Preferences */}
              <Text style={styles.fieldLabel}>Pain Management Preferences</Text>
              <View
                style={[
                  styles.comboboxField,
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                ]}
              >
                <TextInput
                  style={[styles.comboboxInputField, isDarkMode && { color: '#FFF' }]}
                  value={birthPlan.pain_management}
                  onChangeText={(t) => setBirthPlan({ ...birthPlan, pain_management: t })}
                  placeholder="e.g. Epidural, Nitrous Oxide, Breathing Exercises"
                  placeholderTextColor={isDarkMode ? '#666' : '#8E8294'}
                />
                <TouchableOpacity
                  style={styles.comboboxChevronBtn}
                  onPress={() => setActivePicker('plan_pain')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={18} color={isDarkMode ? '#888' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

              {/* 4. Special Requests or Instructions */}
              <Text style={styles.fieldLabel}>Special Requests or Instructions</Text>
              <View
                style={[
                  styles.comboboxField,
                  { minHeight: 74, alignItems: 'flex-start' },
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                ]}
              >
                <TextInput
                  style={[
                    styles.comboboxInputField,
                    { height: 60, textAlignVertical: 'top', paddingTop: 8 },
                    isDarkMode && { color: '#FFF' },
                  ]}
                  value={birthPlan.special_requests}
                  multiline
                  onChangeText={(t) => setBirthPlan({ ...birthPlan, special_requests: t })}
                  placeholder="Any specific wishes, music, delayed cord clamping, or emergency preferences..."
                  placeholderTextColor={isDarkMode ? '#666' : '#8E8294'}
                />
                <TouchableOpacity
                  style={[styles.comboboxChevronBtn, { paddingTop: 10 }]}
                  onPress={() => setActivePicker('plan_requests')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-down" size={18} color={isDarkMode ? '#888' : Colors.textSoft} />
                </TouchableOpacity>
              </View>

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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
                  {['The Grab-and-Go Folder', '2. For Mom', '3. For Baby', 'General'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setNewItemCat(c)}
                      style={[
                        {
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: newItemCat === c ? Colors.primaryDark : Colors.border,
                          backgroundColor: newItemCat === c ? Colors.primaryDark : Colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: newItemCat === c ? '#fff' : Colors.text,
                          fontWeight: newItemCat === c ? '700' : '500',
                        }}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                <>
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

                  {/* Essential Newborn Care Interactive Checklist */}
                  {renderNewbornCareChecklistCard()}
                </>
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

                  {/* Essential Newborn Care Interactive Checklist */}
                  {renderNewbornCareChecklistCard()}

                  {/* Baby Vaccinations & Routine EPI Checklist */}
                  <View style={[styles.card, Shadows.card, { marginTop: 14 }]}>
                    <Text style={styles.eyebrow}>BABY'S ROUTINE VACCINATIONS (PHILIPPINE EPI)</Text>
                    <Text style={[styles.cardTitle, isDarkMode && { color: '#FFF' }]}>Childhood Immunization Schedule</Text>
                    <Text style={styles.deliveryDesc}>
                      Track routine EPI vaccine doses across weeks and months as your baby grows.
                    </Text>
                    {postpartumData?.vaccines?.map((v: any) => {
                      const isAtBirth = v.vaccine_name?.includes('Screening') || v.vaccine_name?.includes('BCG') || (v.due_age_days !== undefined && v.due_age_days <= 1);
                      return (
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
                            <Text style={styles.vaxAge}>Due: {v.due_age_label}{v.due_date ? ` — ${v.due_date}` : ''}</Text>
                          </View>
                          {v.given ? (
                            <View style={styles.vaxDoneBadge}>
                              <Text style={styles.vaxDoneText}>Completed</Text>
                            </View>
                          ) : isAtBirth ? (
                            <View style={[styles.vaxDoneBadge, { backgroundColor: isDarkMode ? '#202026' : '#F1F5F9', borderColor: isDarkMode ? '#333' : '#CBD5E1' }]}>
                              <Text style={[styles.vaxDoneText, { color: isDarkMode ? '#AAA' : '#475569' }]}>At-Birth Essential</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ================= 8. REMINDERS & CHECKUP ================= */}
          {activeTab === 'reminders' && (
            <View>
              {/* Card 1: OB-GYN VISIT REMINDER */}
              <View style={[styles.card, Shadows.card, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                <Text style={[styles.eyebrow, { color: '#C2577D' }]}>OB-GYN VISIT REMINDER</Text>
                <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Prenatal Care Schedule</Text>
                <Text style={[styles.cardSubtitle, isDarkMode && { color: '#A79AA0' }]}>
                  Schedule and track all your upcoming OB-GYN checkups, scans, and doctor consultations.
                </Text>

                {(() => {
                  const nowZero = new Date();
                  nowZero.setHours(0, 0, 0, 0);

                  const parseDate = (dStr: string) => {
                    if (!dStr) return null;
                    const p = dStr.split('-');
                    if (p.length === 3) {
                      const dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                      dt.setHours(0, 0, 0, 0);
                      return dt;
                    }
                    return null;
                  };

                  // Find nearest upcoming visit from list or fallback to nextObDate
                  const sortedVisits = [...obVisitsList].sort((a, b) => {
                    const da = parseDate(a.visit_date)?.getTime() || 0;
                    const db = parseDate(b.visit_date)?.getTime() || 0;
                    return da - db;
                  });

                  const upcoming = sortedVisits.find((v) => {
                    const dt = parseDate(v.visit_date);
                    return dt && dt.getTime() >= nowZero.getTime();
                  });

                  const heroDate = upcoming ? upcoming.visit_date : nextObDate;
                  const heroTitle = upcoming?.title || 'Prenatal Checkup';
                  const heroDateObj = heroDate ? parseDate(heroDate) : null;
                  const daysToVisit = heroDateObj
                    ? Math.round((heroDateObj.getTime() - nowZero.getTime()) / 86400000)
                    : null;

                  if (heroDate && daysToVisit !== null) {
                    return (
                      <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                        {daysToVisit >= 0 ? (
                          <>
                            <Text style={[styles.obBigCountdown, isDarkMode && { color: '#FF94B8' }]}>
                              {daysToVisit}
                            </Text>
                            <Text style={[styles.obMutedLabel, isDarkMode && { color: '#A79AA0' }]}>
                              {daysToVisit === 0 ? "That's today!" : daysToVisit === 1 ? 'day until your visit (Tomorrow)' : 'day(s) until your next checkup'}
                            </Text>
                          </>
                        ) : (
                          <View style={[styles.passedBadge, isDarkMode && { backgroundColor: '#3A1F26' }]}>
                            <Text style={[styles.passedBadgeText, isDarkMode && { color: '#FF94B8' }]}>
                              Previous date has passed — schedule your next visit below
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.obDateBold, isDarkMode && { color: '#F0EEF0' }]}>
                          {formatReminderDate(heroDate)}
                        </Text>
                        <View style={[styles.heroVisitTitleBadge, isDarkMode && { backgroundColor: '#2C1D24' }]}>
                          <Ionicons name="medical" size={13} color="#C2577D" style={{ marginRight: 4 }} />
                          <Text style={styles.heroVisitTitleText}>{heroTitle}</Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View style={styles.emptyWrap}>
                      <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
                      <Text style={styles.emptyText}>No upcoming checkup set yet.</Text>
                      <Text style={[styles.emptySubText, isDarkMode && { color: '#888' }]}>
                        Add your next prenatal visit date below to get automatic countdowns and notifications.
                      </Text>
                    </View>
                  );
                })()}

                {/* List of Scheduled Visits (Multiple) */}
                {obVisitsList.length > 0 && (
                  <View style={{ marginTop: 10, marginBottom: 14 }}>
                    <View style={styles.obSectionHeaderRow}>
                      <Ionicons name="calendar" size={16} color="#C2577D" style={{ marginRight: 6 }} />
                      <Text style={[styles.obSectionTitle, isDarkMode && { color: '#F0EEF0' }]}>
                        Scheduled Visits ({obVisitsList.length})
                      </Text>
                    </View>

                    {obVisitsList.map((item) => {
                      const p = item.visit_date ? item.visit_date.split('-') : [];
                      const monthAbbr = p.length === 3 ? CALENDAR_MONTHS[parseInt(p[1], 10) - 1].slice(0, 3).toUpperCase() : '';
                      const dayNum = p.length === 3 ? parseInt(p[2], 10) : '';

                      const nowZero = new Date();
                      nowZero.setHours(0, 0, 0, 0);
                      const targetObj = p.length === 3 ? new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)) : null;
                      if (targetObj) targetObj.setHours(0, 0, 0, 0);
                      const diff = targetObj ? Math.round((targetObj.getTime() - nowZero.getTime()) / 86400000) : null;

                      let pillLabel = '';
                      let pillBg = '#F3F4F6';
                      let pillColor = '#4B5563';
                      if (diff !== null) {
                        if (diff < 0) {
                          pillLabel = 'Passed';
                          pillBg = isDarkMode ? '#2E151A' : '#FDE8E8';
                          pillColor = '#E02424';
                        } else if (diff === 0) {
                          pillLabel = 'Today';
                          pillBg = isDarkMode ? '#3A1F26' : '#FCE7F0';
                          pillColor = '#C2577D';
                        } else if (diff === 1) {
                          pillLabel = 'Tomorrow';
                          pillBg = isDarkMode ? '#2E2218' : '#FEF3C7';
                          pillColor = '#D97706';
                        } else {
                          pillLabel = `In ${diff}d`;
                          pillBg = isDarkMode ? '#14291F' : '#DEF7EC';
                          pillColor = '#057A55';
                        }
                      }

                      return (
                        <View
                          key={item.id || item.visit_date}
                          style={[
                            styles.obVisitCard,
                            isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                            diff === 0 && { borderColor: '#C2577D', borderWidth: 1.5 },
                          ]}
                        >
                          <View style={[styles.obVisitCalendarBadge, isDarkMode && { backgroundColor: '#2C1D24', borderColor: '#4A2A38' }]}>
                            <Text style={styles.obVisitBadgeMonth}>{monthAbbr}</Text>
                            <Text style={styles.obVisitBadgeDay}>{dayNum}</Text>
                          </View>

                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text style={[styles.obVisitTitle, isDarkMode && { color: '#F0EEF0' }]} numberOfLines={1}>
                              {item.title || 'Prenatal Checkup'}
                            </Text>
                            <Text style={[styles.obVisitDateFormatted, isDarkMode && { color: '#A79AA0' }]}>
                              {formatReminderDate(item.visit_date)}
                            </Text>
                            {!!item.notes && (
                              <Text style={[styles.obVisitNotes, isDarkMode && { color: '#888490' }]} numberOfLines={2}>
                                {item.notes}
                              </Text>
                            )}
                          </View>

                          <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 44 }}>
                            {pillLabel ? (
                              <View style={[styles.obVisitStatusPill, { backgroundColor: pillBg }]}>
                                <Text style={[styles.obVisitStatusPillText, { color: pillColor }]}>
                                  {pillLabel}
                                </Text>
                              </View>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => handleDeleteObVisit(item.id, item.visit_date, item.title)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={styles.obVisitDeleteBtn}
                            >
                              <Ionicons name="trash-outline" size={16} color={isDarkMode ? '#F87171' : '#DC2626'} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Form to Add Another / Next Checkup */}
                <View style={[styles.obAddVisitContainer, isDarkMode && { backgroundColor: '#16161A', borderColor: '#2C2C31' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Ionicons name="add-circle" size={18} color="#C2577D" style={{ marginRight: 6 }} />
                    <Text style={[styles.obAddVisitHeader, isDarkMode && { color: '#FF94B8' }]}>
                      Schedule A Checkup Date
                    </Text>
                  </View>

                  <Text style={[styles.fieldLabel, isDarkMode && { color: '#A79AA0' }]}>Select Visit Date *</Text>
                  <TouchableOpacity
                    style={[styles.dateInputContainer, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}
                    onPress={openCalendarModal}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ flex: 1, fontSize: 14, color: newObVisitDate ? (isDarkMode ? '#FFF' : '#2D2D3A') : Colors.textMuted, fontWeight: newObVisitDate ? '600' : '400' }]}>
                      {newObVisitDate ? `${formatReminderDate(newObVisitDate)} (${newObVisitDate})` : 'Tap to choose checkup date...'}
                    </Text>
                    <Ionicons name="calendar" size={22} color="#C2577D" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>

                  {/* Quick Purpose Chips */}
                  <Text style={[styles.fieldLabel, { marginTop: 6 }, isDarkMode && { color: '#A79AA0' }]}>Visit Purpose</Text>
                  <View style={styles.obPurposeChipsRow}>
                    {['Routine Checkup', 'Ultrasound Scan', 'Lab Review', 'Specialist Consultation', 'High-Risk Care'].map((pName) => {
                      const isActive = newObVisitTitle === pName;
                      return (
                        <TouchableOpacity
                          key={pName}
                          style={[
                            styles.obPurposeChip,
                            isActive && styles.obPurposeChipActive,
                            isDarkMode && !isActive && { backgroundColor: '#1F1F24', borderColor: '#2C2C31' },
                          ]}
                          onPress={() => setNewObVisitTitle(pName)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.obPurposeChipText, isActive && styles.obPurposeChipTextActive, isDarkMode && !isActive && { color: '#BBB' }]}>
                            {pName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 8 }, isDarkMode && { color: '#A79AA0' }]}>Doctor & Clinical Notes (Optional)</Text>
                  <TextInput
                    style={[styles.obNotesInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                    placeholder="e.g., Dr. Reyes, bring urinalysis result, clinic room 204"
                    placeholderTextColor={isDarkMode ? '#666' : '#9CA3AF'}
                    value={newObVisitNotes}
                    onChangeText={setNewObVisitNotes}
                  />

                  <TouchableOpacity
                    style={[
                      styles.btnSaveReminder,
                      { marginTop: 12 },
                      !newObVisitDate && { opacity: 0.65 },
                      isDarkMode && { backgroundColor: '#C2577D' },
                    ]}
                    onPress={handleSaveObVisit}
                    disabled={isSavingObVisit}
                    activeOpacity={0.8}
                  >
                    {isSavingObVisit ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="calendar-outline" size={17} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.btnSaveReminderText}>+ Save Checkup Date</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Calendar Date Picker Modal */}
              <Modal
                visible={showCalendarModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCalendarModal(false)}
              >
                <Pressable
                  style={styles.calModalOverlay}
                  onPress={() => setShowCalendarModal(false)}
                >
                  <Pressable
                    style={[styles.calModalCard, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
                    onPress={(e) => e.stopPropagation()}
                  >
                    {/* Month Header with Navigation */}
                    <View style={styles.calHeaderRow}>
                      <Text style={[styles.calMonthTitle, isDarkMode && { color: '#FFF' }]}>
                        {CALENDAR_MONTHS[calMonth]} {calYear}
                      </Text>
                      {(() => {
                        const now = new Date();
                        const isPrevMonthDisabled = calYear < now.getFullYear() || (calYear === now.getFullYear() && calMonth <= now.getMonth());
                        return (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              disabled={isPrevMonthDisabled}
                              onPress={() => {
                                if (isPrevMonthDisabled) return;
                                if (calMonth === 0) {
                                  setCalMonth(11);
                                  setCalYear(calYear - 1);
                                } else {
                                  setCalMonth(calMonth - 1);
                                }
                              }}
                              style={[
                                styles.calNavBtn,
                                isDarkMode && { backgroundColor: '#2C2C31' },
                                isPrevMonthDisabled && { opacity: 0.25 },
                              ]}
                              activeOpacity={isPrevMonthDisabled ? 1 : 0.7}
                            >
                              <Ionicons name="chevron-back" size={16} color={isDarkMode ? '#FFF' : '#2D2D3A'} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                if (calMonth === 11) {
                                  setCalMonth(0);
                                  setCalYear(calYear + 1);
                                } else {
                                  setCalMonth(calMonth + 1);
                                }
                              }}
                              style={[styles.calNavBtn, isDarkMode && { backgroundColor: '#2C2C31' }]}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="chevron-forward" size={16} color={isDarkMode ? '#FFF' : '#2D2D3A'} />
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>

                    <Text style={[styles.calHintText, isDarkMode && { color: '#A79AA0' }]}>
                      Past dates and today are disabled (upcoming visits only)
                    </Text>

                    {/* Day of Week Headers */}
                    <View style={styles.calDaysHeaderRow}>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                        <Text key={i} style={[styles.calDayHeaderCell, isDarkMode && { color: '#A79AA0' }]}>{d}</Text>
                      ))}
                    </View>

                    {/* Day Grid */}
                    <View style={styles.calGrid}>
                      {renderCalendarGrid()}
                    </View>

                    {/* Footer Actions: Clear & Close */}
                    <View style={[styles.calFooterRow, isDarkMode && { borderTopColor: '#2C2C31' }]}>
                      <TouchableOpacity
                        onPress={() => {
                          setNewObVisitDate('');
                          setNextObDate('');
                          setShowCalendarModal(false);
                        }}
                      >
                        <Text style={[styles.calFooterActionText, { color: '#9CA3AF' }]}>Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCalendarModal(false);
                        }}
                      >
                        <Text style={[styles.calFooterActionText, { color: isDarkMode ? '#FF94B8' : '#C2577D' }]}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>

              {/* Reminder Category Filter Chips */}
              <View style={styles.remFilterRow}>
                <TouchableOpacity
                  style={[
                    styles.remFilterChip,
                    reminderCategory === 'all' && styles.remFilterChipActive,
                    isDarkMode && reminderCategory !== 'all' && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                  ]}
                  onPress={() => setReminderCategory('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.remFilterChipText,
                      reminderCategory === 'all' && styles.remFilterChipTextActive,
                      isDarkMode && reminderCategory !== 'all' && { color: '#E0DEE0' },
                    ]}
                  >
                    All Reminders
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.remFilterChip,
                    reminderCategory === 'supplements' && styles.remFilterChipActive,
                    isDarkMode && reminderCategory !== 'supplements' && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                  ]}
                  onPress={() => setReminderCategory('supplements')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="medical"
                    size={13}
                    color={reminderCategory === 'supplements' ? '#FFF' : '#C2577D'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.remFilterChipText,
                      reminderCategory === 'supplements' && styles.remFilterChipTextActive,
                      isDarkMode && reminderCategory !== 'supplements' && { color: '#E0DEE0' },
                    ]}
                  >
                    Supplements
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.remFilterChip,
                    reminderCategory === 'laboratories' && styles.remFilterChipActive,
                    isDarkMode && reminderCategory !== 'laboratories' && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                  ]}
                  onPress={() => setReminderCategory('laboratories')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="flask"
                    size={13}
                    color={reminderCategory === 'laboratories' ? '#FFF' : '#C2577D'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.remFilterChipText,
                      reminderCategory === 'laboratories' && styles.remFilterChipTextActive,
                      isDarkMode && reminderCategory !== 'laboratories' && { color: '#E0DEE0' },
                    ]}
                  >
                    Laboratories
                  </Text>
                  {pendingLabCount > 0 && (
                    <View
                      style={[
                        styles.remCountBadge,
                        reminderCategory === 'laboratories' && { backgroundColor: 'rgba(255,255,255,0.3)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.remCountBadgeText,
                          reminderCategory === 'laboratories' && { color: '#FFF' },
                        ]}
                      >
                        {pendingLabCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.remFilterChip,
                    reminderCategory === 'vaccination' && styles.remFilterChipActive,
                    isDarkMode && reminderCategory !== 'vaccination' && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
                  ]}
                  onPress={() => setReminderCategory('vaccination')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={13}
                    color={reminderCategory === 'vaccination' ? '#FFF' : '#C2577D'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.remFilterChipText,
                      reminderCategory === 'vaccination' && styles.remFilterChipTextActive,
                      isDarkMode && reminderCategory !== 'vaccination' && { color: '#E0DEE0' },
                    ]}
                  >
                    Vaccination
                  </Text>
                  {pendingVaxCount > 0 && (
                    <View
                      style={[
                        styles.remCountBadge,
                        reminderCategory === 'vaccination' && { backgroundColor: 'rgba(255,255,255,0.3)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.remCountBadgeText,
                          reminderCategory === 'vaccination' && { color: '#FFF' },
                        ]}
                      >
                        {pendingVaxCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Card 2: SUPPLEMENT & VITAMIN REMINDER */}
              {(reminderCategory === 'all' || reminderCategory === 'supplements') && (
                <View style={[styles.card, Shadows.card, { marginTop: 14 }, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                  <Text style={[styles.eyebrow, { color: '#C2577D' }]}>SUPPLEMENT &amp; VITAMIN REMINDER</Text>
                  <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Today's Checklist</Text>

                  {(!remindersData?.medications || remindersData.medications.length === 0) ? (
                    <View style={styles.emptyWrap}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="medical" size={34} color="#FFAFCC" style={{ transform: [{ rotate: '-25deg' }], marginRight: -6 }} />
                        <Ionicons name="ellipse" size={26} color="#FFC8DD" style={{ transform: [{ rotate: '45deg' }] }} />
                      </View>
                      <Text style={styles.emptyText}>No supplements/vitamins added yet.</Text>
                    </View>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      {remindersData.medications.map((m: any) => {
                        const isTaken = !!(m.taken_today || m.takenToday);
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[
                              styles.suppCheckRow,
                              isTaken && styles.suppCheckRowTaken,
                              isDarkMode && { backgroundColor: isTaken ? '#2B1A24' : '#131316', borderColor: isTaken ? '#C2577D' : '#2C2C31' },
                            ]}
                            onPress={() => toggleReminderMed(m.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={isTaken ? 'checkmark-circle' : 'ellipse-outline'}
                              size={22}
                              color={isTaken ? '#C2577D' : Colors.textMuted}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={[styles.suppName, isTaken && styles.suppNameTaken, isDarkMode && { color: '#F0EEF0' }]}>
                                {m.name}
                              </Text>
                              {(m.dosage || m.schedule_time || m.scheduleTime) ? (
                                <Text style={[styles.suppMeta, isDarkMode && { color: '#A79AA0' }]}>
                                  — {m.dosage}{m.dosage && (m.schedule_time || m.scheduleTime) ? ' · ' : ''}{m.schedule_time || m.scheduleTime}
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={[styles.divider, isDarkMode && { backgroundColor: '#2C2C31' }]} />

                  {/* + Add a supplement/vitamin -> navigate to Medications & Vitamins */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                    onPress={() => {
                      setActiveTab('meds');
                      onTabChange?.('meds');
                      onNavigate?.('meds');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={15} color="#C2577D" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#C2577D' }}>
                      + Add a supplement/vitamin
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                    <Text style={[styles.footerMutedText, isDarkMode && { color: '#A79AA0' }]}>
                      Manage your full list (remove items, etc.) in{' '}
                    </Text>
                    <TouchableOpacity onPress={() => { setActiveTab('meds'); onTabChange?.('meds'); }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#C2577D' }}>
                        Medications &amp; Vitamins
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.footerMutedText, isDarkMode && { color: '#A79AA0' }]}>.</Text>
                  </View>
                </View>
              )}

              {/* Card 3: PRENATAL LABORATORY REMINDER */}
              {(reminderCategory === 'all' || reminderCategory === 'laboratories') && (
                <View style={[styles.card, Shadows.card, { marginTop: 14 }, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.eyebrow, { color: '#C2577D' }]}>PRENATAL LABORATORY REMINDER</Text>
                    <View style={[styles.progressCounterPill, isDarkMode && { backgroundColor: '#2C2C31' }]}>
                      <Text style={[styles.progressCounterText, isDarkMode && { color: '#FF94B8' }]}>
                        {completedLabCount}/{allLabs.length} Done
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Essential Diagnostic Screenings</Text>
                  <Text style={[styles.remSubtitle, isDarkMode && { color: '#A79AA0' }]}>
                    Track recommended prenatal laboratory screenings to safeguard maternal and fetal health.
                  </Text>

                  {/* Progress Bar */}
                  <View style={[styles.progressBarTrack, isDarkMode && { backgroundColor: '#2A2A30' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${allLabs.length > 0 ? (completedLabCount / allLabs.length) * 100 : 0}%` },
                      ]}
                    />
                  </View>

                  {/* Trimester Filter Tabs */}
                  <View style={styles.subFilterRow}>
                    {(['all', '1st Tri', '2nd Tri', '3rd Tri'] as const).map((tri) => (
                      <TouchableOpacity
                        key={tri}
                        style={[
                          styles.subFilterChip,
                          labTriFilter === tri && styles.subFilterChipActive,
                          isDarkMode && labTriFilter !== tri && { backgroundColor: '#22232B', borderColor: '#2C2C31' },
                        ]}
                        onPress={() => setLabTriFilter(tri)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.subFilterChipText,
                            labTriFilter === tri && styles.subFilterChipTextActive,
                            isDarkMode && labTriFilter !== tri && { color: '#A79AA0' },
                          ]}
                        >
                          {tri === 'all' ? 'All Trimesters' : tri}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Lab Test Checklist */}
                  <View style={{ marginTop: 8 }}>
                    {filteredLabs.map((lab) => {
                      const isDone = !!labStatusMap[lab.id]?.completed;
                      const doneDate = labStatusMap[lab.id]?.date;
                      return (
                        <TouchableOpacity
                          key={lab.id}
                          style={[
                            styles.remCheckRow,
                            isDone && styles.remCheckRowDone,
                            isDarkMode && {
                              backgroundColor: isDone ? '#1C2920' : '#131316',
                              borderColor: isDone ? '#2E7D32' : '#2C2C31',
                            },
                          ]}
                          onPress={() => toggleLabReminder(lab.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={isDone ? '#2E7D32' : (isDarkMode ? '#FF94B8' : '#C2577D')}
                            style={{ marginTop: 2 }}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text
                                style={[
                                  styles.remItemTitle,
                                  isDone && styles.remItemTitleDone,
                                  isDarkMode && { color: isDone ? '#A0B8A4' : '#F0EEF0' },
                                ]}
                              >
                                {lab.name}
                              </Text>
                              {lab.isCustom && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteCustomLab(lab.id, lab.name)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 4 }}>
                              <View style={[styles.triBadge, isDarkMode && { backgroundColor: '#2C2C31' }]}>
                                <Text style={[styles.triBadgeText, isDarkMode && { color: '#FF94B8' }]}>{lab.trimester}</Text>
                              </View>
                              <View style={[styles.timingBadge, isDarkMode && { backgroundColor: '#22232B' }]}>
                                <Ionicons name="time-outline" size={11} color={isDarkMode ? '#A79AA0' : '#6B7280'} style={{ marginRight: 3 }} />
                                <Text style={[styles.timingBadgeText, isDarkMode && { color: '#A79AA0' }]}>{lab.timing}</Text>
                              </View>
                              {isDone && (
                                <View style={styles.donePill}>
                                  <Text style={styles.donePillText}>Completed{doneDate ? ` · ${doneDate}` : ''}</Text>
                                </View>
                              )}
                            </View>

                            <Text style={[styles.remItemDesc, isDarkMode && { color: '#A79AA0' }]}>
                              {lab.purpose}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.divider, isDarkMode && { backgroundColor: '#2C2C31' }]} />

                  {/* Lab Footer Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setShowAddLabModal(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={17} color="#C2577D" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#C2577D' }}>
                        + Add Custom Lab Reminder
                      </Text>
                    </TouchableOpacity>

                    {onNavigate && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                        onPress={() => onNavigate('vitals')}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="folder-open-outline" size={15} color="#C2577D" style={{ marginRight: 5 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#C2577D' }}>
                          View Lab Records in Vitals →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Card 4: MATERNAL VACCINATION REMINDER */}
              {(reminderCategory === 'all' || reminderCategory === 'vaccination') && (
                <View style={[styles.card, Shadows.card, { marginTop: 14 }, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.eyebrow, { color: '#C2577D' }]}>MATERNAL VACCINATION REMINDER</Text>
                    <View style={[styles.progressCounterPill, isDarkMode && { backgroundColor: '#2C2C31' }]}>
                      <Text style={[styles.progressCounterText, isDarkMode && { color: '#FF94B8' }]}>
                        {completedVaxCount}/{allVaxes.length} Received
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, isDarkMode && { color: '#F0EEF0' }]}>Recommended Pregnancy Immunizations</Text>
                  <Text style={[styles.remSubtitle, isDarkMode && { color: '#A79AA0' }]}>
                    Safe and recommended vaccines to protect you and your newborn against serious preventable infections.
                  </Text>

                  {/* Progress Bar */}
                  <View style={[styles.progressBarTrack, isDarkMode && { backgroundColor: '#2A2A30' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${allVaxes.length > 0 ? (completedVaxCount / allVaxes.length) * 100 : 0}%`, backgroundColor: '#10B981' },
                      ]}
                    />
                  </View>

                  {/* Vaccines Checklist */}
                  <View style={{ marginTop: 8 }}>
                    {allVaxes.map((vax) => {
                      const isDone = !!vaxStatusMap[vax.id]?.completed;
                      const doneDate = vaxStatusMap[vax.id]?.date;
                      return (
                        <TouchableOpacity
                          key={vax.id}
                          style={[
                            styles.remCheckRow,
                            isDone && styles.remCheckRowDone,
                            isDarkMode && {
                              backgroundColor: isDone ? '#1C2920' : '#131316',
                              borderColor: isDone ? '#2E7D32' : '#2C2C31',
                            },
                          ]}
                          onPress={() => toggleVaxReminder(vax.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={isDone ? '#2E7D32' : (isDarkMode ? '#FF94B8' : '#C2577D')}
                            style={{ marginTop: 2 }}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text
                                style={[
                                  styles.remItemTitle,
                                  isDone && styles.remItemTitleDone,
                                  isDarkMode && { color: isDone ? '#A0B8A4' : '#F0EEF0' },
                                ]}
                              >
                                {vax.name}
                              </Text>
                              {vax.isCustom && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteCustomVax(vax.id, vax.name)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 4 }}>
                              <View style={[styles.triBadge, isDarkMode && { backgroundColor: '#2C2C31' }]}>
                                <Ionicons name="shield-outline" size={11} color={isDarkMode ? '#FF94B8' : '#C2577D'} style={{ marginRight: 3 }} />
                                <Text style={[styles.triBadgeText, isDarkMode && { color: '#FF94B8' }]}>{vax.dosage}</Text>
                              </View>
                              <View style={[styles.timingBadge, isDarkMode && { backgroundColor: '#22232B' }]}>
                                <Ionicons name="calendar-outline" size={11} color={isDarkMode ? '#A79AA0' : '#6B7280'} style={{ marginRight: 3 }} />
                                <Text style={[styles.timingBadgeText, isDarkMode && { color: '#A79AA0' }]}>{vax.timing}</Text>
                              </View>
                              {isDone && (
                                <View style={styles.donePill}>
                                  <Text style={styles.donePillText}>Received{doneDate ? ` · ${doneDate}` : ''}</Text>
                                </View>
                              )}
                            </View>

                            <Text style={[styles.remItemDesc, isDarkMode && { color: '#A79AA0' }]}>
                              {vax.purpose}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.divider, isDarkMode && { backgroundColor: '#2C2C31' }]} />

                  {/* Vaccine Footer Actions */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => setShowAddVaxModal(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={17} color="#C2577D" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#C2577D' }}>
                        + Add Custom Vaccine Reminder
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      onPress={() => {
                        setActiveTab('postpartum');
                        onTabChange?.('postpartum');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="bandage-outline" size={15} color="#C2577D" style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#C2577D' }}>
                        Baby EPI Vaccines (Postpartum) →
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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

      {/* Dropdown Selection Modal for Medications and Reminders */}
      <Modal
        visible={activePicker !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActivePicker(null)}>
          <Pressable style={[styles.modalCard, Shadows.large]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activePicker === 'name' || activePicker === 'rem_name'
                  ? 'Select Item'
                  : activePicker === 'dosage' || activePicker === 'rem_dosage'
                  ? 'Select Dosage'
                  : activePicker === 'schedule' || activePicker === 'rem_schedule'
                  ? 'Select Schedule'
                  : activePicker === 'plan_location'
                  ? 'Select Delivery Location'
                  : activePicker === 'plan_support'
                  ? 'Select Labor Support People'
                  : activePicker === 'plan_pain'
                  ? 'Select Pain Management'
                  : 'Select Special Request'}
              </Text>
              <TouchableOpacity onPress={() => setActivePicker(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textSoft} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {(activePicker === 'name' || activePicker === 'rem_name'
                ? MED_NAME_OPTIONS
                : activePicker === 'dosage' || activePicker === 'rem_dosage'
                ? MED_DOSAGE_OPTIONS
                : activePicker === 'schedule' || activePicker === 'rem_schedule'
                ? MED_SCHEDULE_OPTIONS
                : activePicker === 'plan_location'
                ? PLAN_LOCATION_OPTIONS
                : activePicker === 'plan_support'
                ? PLAN_SUPPORT_OPTIONS
                : activePicker === 'plan_pain'
                ? PLAN_PAIN_OPTIONS
                : PLAN_REQUESTS_OPTIONS
              ).map((opt, idx) => {
                const isSelected =
                  (activePicker === 'name' && selectedMedName === opt) ||
                  (activePicker === 'rem_name' && suppName === opt) ||
                  (activePicker === 'dosage' && selectedDosage === opt) ||
                  (activePicker === 'rem_dosage' && suppDosage === opt) ||
                  (activePicker === 'schedule' && selectedSchedule === opt) ||
                  (activePicker === 'rem_schedule' && suppSchedule === opt) ||
                  (activePicker === 'plan_location' && birthPlan.delivery_location === opt) ||
                  (activePicker === 'plan_support' && birthPlan.support_people === opt) ||
                  (activePicker === 'plan_pain' && birthPlan.pain_management === opt) ||
                  (activePicker === 'plan_requests' && birthPlan.special_requests === opt);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                    onPress={() => {
                      if (activePicker === 'name') setSelectedMedName(opt);
                      else if (activePicker === 'rem_name') setSuppName(opt);
                      else if (activePicker === 'dosage') setSelectedDosage(opt);
                      else if (activePicker === 'rem_dosage') setSuppDosage(opt);
                      else if (activePicker === 'schedule') setSelectedSchedule(opt);
                      else if (activePicker === 'rem_schedule') setSuppSchedule(opt);
                      else if (activePicker === 'plan_location') {
                        setBirthPlan({ ...birthPlan, delivery_location: opt });
                      } else if (activePicker === 'plan_support') {
                        setBirthPlan({ ...birthPlan, support_people: opt });
                      } else if (activePicker === 'plan_pain') {
                        setBirthPlan({ ...birthPlan, pain_management: opt });
                      } else if (activePicker === 'plan_requests') {
                        setBirthPlan({ ...birthPlan, special_requests: opt });
                      }
                      setActivePicker(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
                      {opt}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.primaryDark} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Custom Lab Reminder Modal */}
      <Modal
        visible={showAddLabModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddLabModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddLabModal(false)}>
          <Pressable
            style={[styles.modalCard, Shadows.large, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Add Custom Lab Reminder</Text>
              <TouchableOpacity onPress={() => setShowAddLabModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#FFF' : Colors.textSoft} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.fieldLabel, isDarkMode && { color: '#A79AA0' }]}>Test Name *</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. Thyroid TSH Panel, Rubella IgG, Quad Screen"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newLabName}
                onChangeText={setNewLabName}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Trimester</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {(['1st Tri', '2nd Tri', '3rd Tri'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.modalOptionChip,
                      newLabTrimester === t && styles.modalOptionChipActive,
                      isDarkMode && newLabTrimester !== t && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                    ]}
                    onPress={() => setNewLabTrimester(t)}
                  >
                    <Text
                      style={[
                        styles.modalOptionChipText,
                        newLabTrimester === t && styles.modalOptionChipTextActive,
                        isDarkMode && newLabTrimester !== t && { color: '#A79AA0' },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Recommended Timing</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. 10–12 Weeks, Week 28, or As Advised"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newLabTiming}
                onChangeText={setNewLabTiming}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Clinical Purpose / Note</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70, textAlignVertical: 'top' },
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' },
                ]}
                placeholder="e.g. Advised by OB to monitor thyroid antibodies and TSH level."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newLabPurpose}
                onChangeText={setNewLabPurpose}
                multiline
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.btnCancelModal, isDarkMode && { backgroundColor: '#2C2C31' }]}
                  onPress={() => setShowAddLabModal(false)}
                >
                  <Text style={[styles.btnCancelModalText, isDarkMode && { color: '#E0DEE0' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSubmitModal}
                  onPress={handleAddCustomLab}
                >
                  <Text style={styles.btnSubmitModalText}>Add Reminder</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Custom Vaccine Reminder Modal */}
      <Modal
        visible={showAddVaxModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddVaxModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddVaxModal(false)}>
          <Pressable
            style={[styles.modalCard, Shadows.large, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#F0EEF0' }]}>Add Custom Vaccine Reminder</Text>
              <TouchableOpacity onPress={() => setShowAddVaxModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#FFF' : Colors.textSoft} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={[styles.fieldLabel, isDarkMode && { color: '#A79AA0' }]}>Vaccine Name *</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. Hepatitis B Vaccine, Meningococcal, RSV"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newVaxName}
                onChangeText={setNewVaxName}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Recommended Timing</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. 32–36 Weeks, or 2nd Trimester"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newVaxTiming}
                onChangeText={setNewVaxTiming}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Dosage / Route</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' }]}
                placeholder="e.g. 0.5 mL IM, Single Dose"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newVaxDosage}
                onChangeText={setNewVaxDosage}
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }, isDarkMode && { color: '#A79AA0' }]}>Protection Notes</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70, textAlignVertical: 'top' },
                  isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31', color: '#FFF' },
                ]}
                placeholder="e.g. Recommended due to occupational or travel exposure."
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
                value={newVaxPurpose}
                onChangeText={setNewVaxPurpose}
                multiline
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.btnCancelModal, isDarkMode && { backgroundColor: '#2C2C31' }]}
                  onPress={() => setShowAddVaxModal(false)}
                >
                  <Text style={[styles.btnCancelModalText, isDarkMode && { color: '#E0DEE0' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSubmitModal}
                  onPress={handleAddCustomVax}
                >
                  <Text style={styles.btnSubmitModalText}>Add Reminder</Text>
                </TouchableOpacity>
              </View>
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
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
    marginTop: 2,
    marginBottom: 14,
  },
  trimesterTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  trimesterBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trimesterBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  trimesterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    textAlign: 'center',
  },
  trimesterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  edGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  edCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 126,
  },
  edCardFullWidth: {
    width: '100%',
    minHeight: 70,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  edCardFullContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  edCardSubtitle: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  edCardTapHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    lineHeight: 15,
  },
  edIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  edIconBoxSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 17,
  },
  cardFooterMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 16,
    lineHeight: 17,
  },
  medCardHeading: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
    marginBottom: 14,
  },
  medFieldWrap: {
    marginBottom: 12,
  },
  medFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 6,
  },
  medDropdownBtn: {
    backgroundColor: '#F3E9F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EADFF0',
  },
  medDropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  medDropdownPlaceholder: {
    color: Colors.textSoft,
    fontWeight: '500',
  },
  btnAddMed: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnAddMedText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  medEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  twoPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  medEmptyText: {
    fontSize: 13.5,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  medChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EADFF0',
  },
  medChecklistRowTaken: {
    backgroundColor: '#F7F2F9',
    opacity: 0.8,
  },
  medCheckBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  medItemName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  medItemNameTaken: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  medItemMeta: {
    fontSize: 12,
    color: Colors.textSoft,
    marginTop: 2,
  },
  medDeleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  pickerRowSelected: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 10,
  },
  pickerText: {
    fontSize: 14.5,
    color: Colors.text,
  },
  pickerTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
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
  comboboxField: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#EFE6F7',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: 10,
  },
  comboboxInputField: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 10,
  },
  comboboxChevronBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comboboxBtn: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#EFE6F7',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: 6,
  },
  comboboxBtnText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  comboboxPlaceholder: {
    color: '#8E8294',
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
  obBigCountdown: {
    fontFamily: 'serif',
    fontSize: 52,
    fontWeight: '800',
    color: '#C2577D',
    textAlign: 'center',
  },
  obMutedLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 17,
  },
  obDateBold: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  passedBadge: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 4,
  },
  passedBadgeText: {
    color: '#C2577D',
    fontSize: 12.5,
    fontWeight: '700',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  btnSaveReminder: {
    backgroundColor: '#C2577D',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveReminderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroVisitTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2F6',
    borderWidth: 1,
    borderColor: '#F8D7E3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  heroVisitTitleText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#C2577D',
  },
  emptySubText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  obSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  obSectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#2D2D3A',
  },
  obVisitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECECEC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  obVisitCalendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FDF2F6',
    borderWidth: 1,
    borderColor: '#F8D7E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  obVisitBadgeMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2577D',
    letterSpacing: 0.5,
  },
  obVisitBadgeDay: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C2577D',
    lineHeight: 18,
  },
  obVisitTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F242E',
  },
  obVisitDateFormatted: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  obVisitNotes: {
    fontSize: 11.5,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  obVisitStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  obVisitStatusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  obVisitDeleteBtn: {
    padding: 4,
    marginTop: 4,
  },
  obAddVisitContainer: {
    backgroundColor: '#FDF9FB',
    borderWidth: 1,
    borderColor: '#F8D7E3',
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },
  obAddVisitHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C2577D',
  },
  obPurposeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  obPurposeChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8DCE2',
  },
  obPurposeChipActive: {
    backgroundColor: '#C2577D',
    borderColor: '#C2577D',
  },
  obPurposeChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B6673',
  },
  obPurposeChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  obNotesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#1F242E',
    marginTop: 4,
  },
  suppCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  suppCheckRowTaken: {
    borderColor: '#C2577D',
    backgroundColor: '#FFF5F8',
  },
  suppName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
  },
  suppNameTaken: {
    color: '#9B2C52',
  },
  suppMeta: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginVertical: 14,
  },
  inlineAddSuppBox: {
    backgroundColor: '#FDF7F9',
    borderWidth: 1,
    borderColor: '#F8D7E3',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  fieldLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 4,
  },
  dropdownSelect: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  dropdownSelectText: {
    fontSize: 13.5,
    color: Colors.text,
  },
  btnAddSuppBtn: {
    backgroundColor: '#C2577D',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 12,
  },
  btnAddSuppBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  footerMutedText: {
    fontSize: 12,
    color: Colors.textMuted,
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
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calModalCard: {
    width: 330,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8ED',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  calHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F242E',
  },
  calNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  calDaysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calDayHeaderCell: {
    width: 38,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calCell: {
    width: '14.285%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 8,
  },
  calCellSelected: {
    backgroundColor: '#C2577D',
    borderWidth: 2,
    borderColor: '#FF94B8',
  },
  calCellDisabled: {
    opacity: 0.35,
  },
  calCellDisabledText: {
    color: '#9CA3AF',
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: '#C2577D',
    borderRadius: 8,
  },
  calCellTodayText: {
    color: '#C2577D',
    fontWeight: '800',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C2577D',
    position: 'absolute',
    bottom: 3,
  },
  scheduledIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    position: 'absolute',
    bottom: 3,
  },
  calHintText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  calCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F242E',
  },
  calCellSelectedText: {
    color: '#FFF',
    fontWeight: '800',
  },
  calCellMutedText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  calFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 8,
  },
  calFooterActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C2577D',
  },
  // --- Reminders Filter & Laboratories / Vaccination Styles ---
  remFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 2,
  },
  remFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8DCE2',
  },
  remFilterChipActive: {
    backgroundColor: '#C2577D',
    borderColor: '#C2577D',
  },
  remFilterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#6B6673',
  },
  remFilterChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  remCountBadge: {
    marginLeft: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(194,87,125,0.12)',
  },
  remCountBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#C2577D',
  },
  progressCounterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#FCE7F0',
  },
  progressCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2577D',
  },
  remSubtitle: {
    fontSize: 12.5,
    color: '#6B6673',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 17,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3E8EE',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#C2577D',
  },
  subFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  subFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F9F5F7',
    borderWidth: 1,
    borderColor: '#EDE0E6',
  },
  subFilterChipActive: {
    backgroundColor: '#C2577D',
    borderColor: '#C2577D',
  },
  subFilterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7D7A89',
  },
  subFilterChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  remCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFE6EB',
    backgroundColor: '#FFF',
    marginBottom: 8,
  },
  remCheckRowDone: {
    borderColor: '#C8E6C9',
    backgroundColor: '#F1F8F2',
  },
  remItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2D2D3A',
    flex: 1,
  },
  remItemTitleDone: {
    color: '#388E3C',
    textDecorationLine: 'line-through',
  },
  triBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FDF2F6',
  },
  triBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C2577D',
  },
  timingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  timingBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  donePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
  },
  donePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2E7D32',
  },
  remItemDesc: {
    fontSize: 11.5,
    color: '#6B6673',
    lineHeight: 16,
    marginTop: 2,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#1F242E',
    marginTop: 4,
  },
  modalOptionChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  modalOptionChipActive: {
    backgroundColor: '#C2577D',
    borderColor: '#C2577D',
  },
  modalOptionChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  modalOptionChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  btnCancelModal: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  btnCancelModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  btnSubmitModal: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#C2577D',
  },
  btnSubmitModalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  encCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE6F7',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  encTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  encTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  encBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  encBadgeText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  encDesc: {
    fontSize: 12.5,
    color: Colors.textSoft,
    lineHeight: 17,
  },
});
