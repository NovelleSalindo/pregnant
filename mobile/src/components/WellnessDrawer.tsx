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
}

export const WellnessDrawer: React.FC<WellnessDrawerProps> = ({
  visible,
  onClose,
  onSelectTool,
  onLogout,
  onToggleDarkMode,
}) => {
  const [lang, setLang] = useState<'en' | 'bi'>('en');

  const tools = [
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.drawerCard, Shadows.large]} onPress={(e) => e.stopPropagation()}>
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
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Language Selector */}
            <View style={styles.languageRow}>
              <View style={styles.langLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons name="language" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.menuLabel}>Language</Text>
              </View>

              <View style={styles.langToggles}>
                <TouchableOpacity
                  style={[styles.langPill, lang === 'en' && styles.langPillActive]}
                  onPress={() => setLang('en')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>
                    EN
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.langPill, lang === 'bi' && styles.langPillActive]}
                  onPress={() => setLang('bi')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, lang === 'bi' && styles.langTextActive]}>
                    BI
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Dark Mode Toggle */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onToggleDarkMode?.();
              }}
              activeOpacity={0.65}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="contrast" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuLabel}>Toggle Dark Mode</Text>
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
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langToggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  langPillActive: {
    backgroundColor: Colors.primary,
  },
  langText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  langTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  logoutLabel: {
    color: Colors.riskHigh,
    fontWeight: '700',
  },
});
