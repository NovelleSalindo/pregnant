import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../theme/colors';



interface FrontScreenProps {
  onNavigateToAuth: (initialTab: 'login' | 'register') => void;
  onNavigateToOffline: () => void;
}

interface FeatureItem {
  id: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FEATURES: FeatureItem[] = [
  {
    id: 'risk',
    title: 'Risk Monitoring',
    desc: 'Log vitals and symptoms, get a clear Low / High / Severe risk score.',
    icon: 'speedometer-outline',
  },
  {
    id: 'recs',
    title: 'Recommendations',
    desc: 'Personalized guidance based on your latest assessment.',
    icon: 'bulb-outline',
  },
  {
    id: 'trimester',
    title: 'Trimester Guidance',
    desc: 'Checklists, nutrition, and tips tailored to each stage.',
    icon: 'book-outline',
  },
  {
    id: 'wellness',
    title: 'Wellness Tools',
    desc: 'Medication reminders, weight tracking, journal, and more.',
    icon: 'heart-outline',
  },
];

export const FrontScreen: React.FC<FrontScreenProps> = ({ onNavigateToAuth, onNavigateToOffline }) => {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top : 0;
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 12);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const toggleCard = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCard((prev) => (prev === id ? null : id));
  };

  return (
    <View style={[styles.safeArea, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFAFCC" translucent={false} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 20 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Pastel Hero Section matching front.php */}
        <LinearGradient
          colors={['#FFAFCC', '#CDB4DB', '#A2D2FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          {/* Ambient Decorative Shapes */}
          <View style={styles.heroCircleTopRight} />
          <View style={styles.heroCircleBottomLeft} />

          {/* Centered Heart Logo */}
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/heart-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>PregnaCare</Text>
          <Text style={styles.heroTagline}>Maternal Risk Monitoring & Support</Text>

          {/* Action Buttons: Log In, Sign Up & Offline Mode */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => onNavigateToAuth('login')}
              activeOpacity={0.88}
            >
              <Ionicons name="log-in-outline" size={18} color="#C2577D" />
              <Text style={styles.loginBtnText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signUpBtn}
              onPress={() => onNavigateToAuth('register')}
              activeOpacity={0.88}
            >
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
              <Text style={styles.signUpBtnText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.offlineBtn}
            onPress={onNavigateToOffline}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-offline-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.offlineBtnText}>Use Offline (No Account)</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Feature Cards Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresHeading}>Everything you need, in one place</Text>

          <View style={styles.grid}>
            {FEATURES.map((item) => {
              const isExpanded = expandedCard === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.featureCard,
                    isExpanded && styles.featureCardExpanded,
                    Shadows.card,
                  ]}
                  onPress={() => toggleCard(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={item.icon} size={20} color="#C2577D" />
                  </View>
                  <Text style={styles.featureCardTitle}>{item.title}</Text>
                  {isExpanded && (
                    <Text style={styles.featureCardDesc}>{item.desc}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            PregnaCare is a decision-support tool, not a medical diagnosis.
          </Text>
          <Text style={styles.footerCopy}>© 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7FC',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7FC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingVertical: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 320,
  },
  heroCircleTopRight: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroCircleBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroTagline: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.92)',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    width: '100%',
    maxWidth: 320,
  },
  loginBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnText: {
    color: '#C2577D',
    fontSize: 15.5,
    fontWeight: '800',
  },
  signUpBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  signUpBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  offlineBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
  },
  offlineBtnText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 13,
    fontWeight: '700',
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
  },
  featuresHeading: {
    fontSize: 23,
    fontWeight: '800',
    color: '#2B2229',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  featureCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EADFF0',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 115,
  },
  featureCardExpanded: {
    borderColor: '#FFAFCC',
    backgroundColor: '#FFFDFE',
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFC8DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2B2229',
    textAlign: 'center',
  },
  featureCardDesc: {
    fontSize: 12,
    color: '#6B5C63',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
  footer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EADFF0',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 12,
    color: '#A79AA0',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  footerCopy: {
    fontSize: 11.5,
    color: '#A79AA0',
    fontWeight: '600',
  },
});
