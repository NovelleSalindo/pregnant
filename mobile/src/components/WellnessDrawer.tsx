import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';

interface WellnessDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSelectTool: (toolKey: string) => void;
  onLogout: () => void;
  onToggleDarkMode?: () => void;
  isDarkMode?: boolean;
}

const HELP_SECTIONS = [
  {
    icon: 'home' as const,
    title: 'Home',
    content:
      'Your home dashboard gives a quick overview of your pregnancy health. You can see your latest risk status, recent vitals, and upcoming reminders. Tap any card to jump to that feature.',
  },
  {
    icon: 'pulse' as const,
    title: 'Vitals',
    content:
      'Log your daily health readings here — blood pressure, temperature, heart rate, blood sugar, hemoglobin, fetal movement, sleep, and water intake.\n\nFor blood sugar, select the timing (Before meal / After meal) so the engine can evaluate it accurately.\n\nAfter saving, you will see a color-coded Risk Result showing your alert level and personalized recommendations based on your readings.',
  },
  {
    icon: 'fitness' as const,
    title: 'Symptoms Check-In',
    content:
      'Report any symptoms you are experiencing. For each symptom, choose how severe it feels (None → Severe), how long it has lasted, and how often it occurs.\n\nSome symptoms reveal extra detail fields:\n• Fever — whether it comes with chills or sweating\n• Abdominal Pain — whether the abdomen is rigid or if there is associated bleeding\n• Swelling — which body parts are affected (Face, Hands, Feet, Legs)\n\nThe Special Pregnancy Conditions section at the bottom lets you flag any conditions your doctor has diagnosed (e.g. high blood pressure, water breaking early, twins).\n\nTap "Submit Symptom Check-in & Assess" to receive your full clinical risk assessment with personalized recommendations.',
  },
  {
    icon: 'person' as const,
    title: 'Profile',
    content:
      'View and edit your personal information — name, email, date of birth, blood type, and pregnancy details (Last Menstrual Period, gestational age).\n\nKeep your LMP up to date so the app can correctly calculate your trimester and adjust recommendations accordingly.',
  },
  {
    icon: 'alarm' as const,
    title: 'OB-GYN & Health Reminders',
    content:
      'Set reminders for prenatal check-ups, medications, or any important appointment. Each reminder can have a time and repeat schedule.',
  },
  {
    icon: 'book' as const,
    title: 'Education Hub',
    content:
      'Browse pregnancy health articles, trimester guides, and nutrition tips. Articles are organized by trimester and topic so you can quickly find relevant information.',
  },
  {
    icon: 'restaurant' as const,
    title: 'Meal Planner',
    content:
      'Find pregnancy-safe meal ideas and nutritional guidance. The planner helps you meet your daily nutrient goals for iron, folic acid, calcium, and protein.',
  },
  {
    icon: 'medkit' as const,
    title: 'Medications & Vitamins',
    content:
      'Keep a log of your prescribed medications and prenatal vitamins. You can record dosage, frequency, and start/end dates for each item.',
  },
  {
    icon: 'journal' as const,
    title: 'Journal',
    content:
      'Write daily notes about how you are feeling, milestones, or anything you want to remember about your pregnancy journey.',
  },
  {
    icon: 'camera' as const,
    title: 'Bump Photo Timeline',
    content:
      'Capture weekly bump photos to create a visual timeline of your pregnancy. Photos are stored privately on your account.',
  },
  {
    icon: 'clipboard' as const,
    title: 'Birth Plan',
    content:
      'Document your preferences for labor and delivery — pain management, support people, delivery environment, and postpartum wishes. Share this with your care team.',
  },
  {
    icon: 'briefcase' as const,
    title: 'Hospital Bag Checklist',
    content:
      'A ready-made checklist of items to pack for your hospital stay. Check off items as you pack them so you are fully prepared before labor.',
  },
  {
    icon: 'heart-circle' as const,
    title: 'Postpartum & Baby Care',
    content:
      'After delivery, use this section for postpartum recovery tips, newborn care guides, and breastfeeding support resources.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Understanding Your Risk Level',
    content:
      'PregnaCare evaluates your vitals and symptoms using a clinical decision engine:\n\n✅ Low Risk — Readings are within normal range. Continue routine prenatal care.\n\n⚠️ High Risk — One or more readings are outside recommended ranges. Follow the personalized recommendations and consult your doctor soon.\n\n🚨 Severe Risk — Urgent clinical thresholds have been reached. Seek medical attention promptly.\n\nRisk levels are not a diagnosis. Always follow your doctor\'s advice.',
  },
];

export const WellnessDrawer: React.FC<WellnessDrawerProps> = ({
  visible,
  onClose,
  onSelectTool,
  onLogout,
  onToggleDarkMode,
  isDarkMode = false,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const tools = [
    { key: 'reminders', label: 'OB-GYN & Health Reminders', icon: 'alarm' as const },
    { key: 'education', label: 'Education Hub', icon: 'book' as const },
    { key: 'meal_planner', label: 'Meal Planner', icon: 'restaurant' as const },
    { key: 'medications', label: 'Medications & Vitamins', icon: 'medkit' as const },
    { key: 'weight_tracker', label: 'Weight Gain Tracker', icon: 'speedometer' as const },
    { key: 'journal', label: 'Journal', icon: 'journal' as const },
    { key: 'bump_photos', label: 'Bump Photo Timeline', icon: 'camera' as const },
    { key: 'birth_plan', label: 'Birth Plan', icon: 'clipboard' as const },
    { key: 'hospital_bag', label: 'Hospital Bag Checklist', icon: 'briefcase' as const },
    { key: 'postpartum', label: 'Postpartum & Baby Care', icon: 'heart-circle' as const },
  ];

  const handleToolPress = (key: string) => {
    onClose();
    onSelectTool(key);
  };

  const bg = isDarkMode ? '#1A1A1E' : Colors.surface;
  const border = isDarkMode ? '#2C2C31' : Colors.border;
  const textColor = isDarkMode ? '#F0EEF0' : Colors.text;
  const mutedColor = isDarkMode ? '#85818A' : Colors.textMuted;

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.drawerCard,
              Shadows.large,
              isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* 9 Wellness Tools */}
              {tools.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => handleToolPress(item.key)}
                  activeOpacity={0.65}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={20} color={Colors.primary} />
                  </View>
                  <Text style={[styles.menuLabel, isDarkMode && { color: '#F0EEF0' }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Divider */}
              <View style={[styles.divider, isDarkMode && { backgroundColor: '#2C2C31' }]} />

              {/* Dark Mode Toggle */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onToggleDarkMode?.();
                }}
                activeOpacity={0.65}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isDarkMode ? 'sunny-outline' : 'contrast'}
                    size={20}
                    color={isDarkMode ? '#FFD166' : Colors.primary}
                  />
                </View>
                <Text style={[styles.menuLabel, isDarkMode && { color: '#F0EEF0' }]}>
                  {isDarkMode ? 'Switch to Light Mode' : 'Toggle Dark Mode'}
                </Text>
              </TouchableOpacity>

              {/* Help */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  setShowHelp(true);
                }}
                activeOpacity={0.65}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="help-circle-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={[styles.menuLabel, isDarkMode && { color: '#F0EEF0' }]}>
                  Help & User Manual
                </Text>
              </TouchableOpacity>

              {/* Log Out */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                activeOpacity={0.65}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.riskHigh} />
                </View>
                <Text style={[styles.menuLabel, styles.logoutLabel]}>Log Out</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Help & User Manual Modal ── */}
      <Modal
        visible={showHelp}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={[styles.helpContainer, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.helpHeader, { borderBottomColor: border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.helpEyebrow, { color: Colors.primaryDark }]}>PREGNACARE</Text>
              <Text style={[styles.helpTitle, { color: textColor }]}>Help & User Manual</Text>
            </View>
            <TouchableOpacity
              style={[styles.helpCloseBtn, { borderColor: border }]}
              onPress={() => setShowHelp(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Intro banner */}
          <View style={[styles.introBanner, { backgroundColor: Colors.primaryLight, borderColor: Colors.primary + '55' }]}>
            <Ionicons name="heart" size={16} color={Colors.primaryDark} style={{ marginRight: 8 }} />
            <Text style={[styles.introBannerText, { color: Colors.primaryDark }]}>
              Welcome to PregnaCare — your personal pregnancy health companion. This manual walks you through every feature.
            </Text>
          </View>

          {/* Sections */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.helpScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {HELP_SECTIONS.map((section, idx) => (
              <View
                key={idx}
                style={[styles.helpSection, { backgroundColor: bg, borderColor: border }]}
              >
                <View style={styles.helpSectionHeader}>
                  <View style={[styles.helpIconCircle, { backgroundColor: Colors.primaryLight }]}>
                    <Ionicons name={section.icon} size={18} color={Colors.primaryDark} />
                  </View>
                  <Text style={[styles.helpSectionTitle, { color: textColor }]}>{section.title}</Text>
                </View>
                <Text style={[styles.helpSectionBody, { color: mutedColor }]}>{section.content}</Text>
              </View>
            ))}

            {/* Footer note */}
            <View style={[styles.helpFooter, { borderColor: border }]}>
              <Ionicons name="information-circle-outline" size={16} color={mutedColor} style={{ marginRight: 6 }} />
              <Text style={[styles.helpFooterText, { color: mutedColor }]}>
                PregnaCare is a decision support tool. Always consult your licensed healthcare provider for medical advice.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 65,
    paddingHorizontal: 16,
  },
  drawerCard: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  logoutLabel: {
    color: Colors.riskHigh,
    fontWeight: '700',
  },
  // ── Help Modal ──
  helpContainer: {
    flex: 1,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  helpEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  helpTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  helpCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  introBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  helpScrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  helpSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  helpSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  helpIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
  },
  helpSectionBody: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    paddingLeft: 44,
  },
  helpFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  helpFooterText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
