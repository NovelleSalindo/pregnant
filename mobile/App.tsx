import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from './src/theme/colors';
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
        <View style={styles.splashIconCircle}>
          <Ionicons name="heart-circle" size={60} color={Colors.primary} />
        </View>
        <Text style={styles.splashTitle}>PregnaCare</Text>
        <Text style={styles.splashSubtitle}>Loading your health companion...</Text>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
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

  // Logged In -> Bottom Tab Navigation
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

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomBar, Shadows.medium]}>
        {[
          { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
          { key: 'vitals', label: 'Vitals', icon: 'heart-outline', iconActive: 'heart' },
          { key: 'symptoms', label: 'Check-in', icon: 'shield-checkmark-outline', iconActive: 'shield-checkmark' },
          { key: 'trackers', label: 'Trackers', icon: 'footsteps-outline', iconActive: 'footsteps' },
          { key: 'wellness', label: 'Wellness', icon: 'bag-handle-outline', iconActive: 'bag-handle' },
          { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(isActive ? tab.iconActive : tab.icon) as any}
                size={22}
                color={isActive ? Colors.primary : Colors.textMuted}
              />
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
  },
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 8,
    paddingBottom: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabItemText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 3,
  },
  tabItemTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
});
