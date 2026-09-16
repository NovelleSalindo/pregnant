import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from './src/theme/colors';
import { api } from './src/services/api';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { VitalsScreen } from './src/screens/VitalsScreen';
import { SymptomsScreen } from './src/screens/SymptomsScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { WellnessScreen } from './src/screens/WellnessScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'vitals' | 'symptoms' | 'trackers' | 'wellness' | 'profile'>('home');

  useEffect(() => {
    async function setup() {
      try {
        await api.init();
        const cachedUser = await api.getCachedUser();
        if (cachedUser && api.getToken()) {
          setUser(cachedUser);
        }
      } catch (e) {
        console.warn('Init error:', e);
      } finally {
        setInitializing(false);
      }
    }
    setup();
  }, []);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setActiveTab('home');
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient
          colors={Gradients.brandMark}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.splashIconCircle}
        >
          <Ionicons name="heart" size={46} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.splashTitle}>PregnaCare</Text>
        <Text style={styles.splashSubtitle}>Maternal Risk Monitoring & Decision Support</Text>
        <ActivityIndicator color={Colors.primaryDark} style={{ marginTop: 28 }} />
      </View>
    );
  }

  // Not logged in -> Show Auth Screen
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <AuthScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  const tabs = [
    { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { key: 'vitals', label: 'Vitals', icon: 'pulse-outline', iconActive: 'pulse' },
    { key: 'symptoms', label: 'Check-in', icon: 'shield-checkmark-outline', iconActive: 'shield-checkmark' },
    { key: 'trackers', label: 'Trackers', icon: 'footsteps-outline', iconActive: 'footsteps' },
    { key: 'wellness', label: 'Wellness', icon: 'library-outline', iconActive: 'library' },
    { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' && <HomeScreen onNavigate={(tab: any) => setActiveTab(tab)} />}
        {activeTab === 'vitals' && <VitalsScreen />}
        {activeTab === 'symptoms' && <SymptomsScreen />}
        {activeTab === 'trackers' && <TrackerScreen />}
        {activeTab === 'wellness' && <WellnessScreen />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={handleLogout} />}
      </View>

      {/* Bottom Navigation Bar (1:1 with style.css .bottom-nav) */}
      <View style={[styles.bottomBar, Shadows.soft]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons
                  name={(isActive ? tab.iconActive : tab.icon) as any}
                  size={20}
                  color={isActive ? Colors.primaryDark : Colors.textMuted}
                />
              </View>
              <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.glow,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 13,
    color: Colors.textSoft,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  tabItemActive: {},
  tabIconWrap: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  tabIconWrapActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabItemText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  tabItemTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
});
