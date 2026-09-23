import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView,
  LogBox,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows, Gradients } from './src/theme/colors';
import { api } from './src/services/api';
import { FrontScreen } from './src/screens/FrontScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { VitalsScreen } from './src/screens/VitalsScreen';
import { SymptomsScreen } from './src/screens/SymptomsScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { WellnessScreen } from './src/screens/WellnessScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AnalyzeScreen } from './src/screens/AnalyzeScreen';
import { AdviceScreen } from './src/screens/AdviceScreen';
import { WellnessDrawer } from './src/components/WellnessDrawer';
import { NotificationModal } from './src/components/NotificationModal';
import { EmergencyFab } from './src/components/EmergencyFab';
import { HeaderBar } from './src/components/HeaderBar';
import { HeartSplash } from './src/components/HeartSplash';
import AsyncStorage from '@react-native-async-storage/async-storage';

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental',
]);

type NavTab = 'home' | 'vitals' | 'symptoms' | 'analyze' | 'advice' | 'profile' | 'wellness' | 'trackers';

const DEFAULT_USER = {
  id: 'u_174da054f',
  name: 'Novelle B. Salindo',
  email: 'novelle2023.salindo@gmail.com',
  role: 'patient',
};

function MainApp() {
  const insets = useSafeAreaInsets();
  // Ensure we use the proper top inset for both iOS and Android to prevent status bar overlap
  const topInset = Platform.OS === 'ios' ? insets.top : Math.max(insets.top, 24);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 10);
  const [initializing, setInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [wellnessSubTab, setWellnessSubTab] = useState<'education' | 'meals' | 'meds' | 'plan' | 'bag' | 'weight' | 'postpartum' | 'reminders'>('education');
  const [trackerSubTab, setTrackerSubTab] = useState<'kick' | 'contraction' | 'journal' | 'bump'>('kick');
  const [authView, setAuthView] = useState<'front' | 'auth'>('front');
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');

  const fetchUserData = useCallback(async () => {
    let localNotifs: any[] = [];
    try {
      const localNotifsStr = await AsyncStorage.getItem('@pregnacare_notifications');
      if (localNotifsStr) {
        localNotifs = JSON.parse(localNotifsStr);
      }
    } catch {}

    try {
      const dashboard = await api.getDashboard();
      const serverNotifs = dashboard?.notifications?.items || [];
      const serverIds = new Set(serverNotifs.map((n: any) => n.id));
      const combined = [...localNotifs.filter(n => !serverIds.has(n.id)), ...serverNotifs];
      setNotifications(combined);

      if (dashboard?.user) {
        setUser(dashboard.user);
      }
    } catch (e: any) {
      if (localNotifs.length > 0) {
        setNotifications(localNotifs);
      }
      console.warn('Dashboard fetch error:', e.message);
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid token') || msg.includes('session expired')) {
        await api.logout();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    async function setup() {
      try {
        await api.init();
        // Sync any offline queued mutations from previous sessions
        api.syncOfflineQueue().catch(() => {});

        const savedTheme = await AsyncStorage.getItem('@pregnacare_dark_mode');
        if (savedTheme === 'dark') {
          setIsDarkMode(true);
        }

        // Auto-login: if the user already logged in / created an account, restore session and go straight to Dashboard
        const token = api.getToken();
        const cachedUser = await api.getCachedUser();

        if (token && cachedUser) {
          setUser(cachedUser);
          setActiveTab('home');
          // Silently sync latest dashboard data & notifications in the background
          fetchUserData();
        }
      } catch (e) {
        console.warn('Init error:', e);
      } finally {
        setInitializing(false);
      }
    }
    setup();
  }, [fetchUserData]);

  const handleToggleDarkMode = async () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    try {
      await AsyncStorage.setItem('@pregnacare_dark_mode', nextMode ? 'dark' : 'light');
    } catch (e) {
      console.warn('Dark mode persist error:', e);
    }
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setActiveTab('home');
    fetchUserData();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAuthView('front');
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  };

  const handleSelectTool = (key: string) => {
    switch (key) {
      case 'reminders':
        setWellnessSubTab('reminders');
        setActiveTab('wellness');
        break;
      case 'education':
        setWellnessSubTab('education');
        setActiveTab('wellness');
        break;
      case 'meal_planner':
        setWellnessSubTab('meals');
        setActiveTab('wellness');
        break;
      case 'medications':
        setWellnessSubTab('meds');
        setActiveTab('wellness');
        break;
      case 'weight_tracker':
        setWellnessSubTab('weight');
        setActiveTab('wellness');
        break;
      case 'birth_plan':
        setWellnessSubTab('plan');
        setActiveTab('wellness');
        break;
      case 'hospital_bag':
        setWellnessSubTab('bag');
        setActiveTab('wellness');
        break;
      case 'journal':
        setTrackerSubTab('journal');
        setActiveTab('trackers');
        break;
      case 'bump_photos':
        setTrackerSubTab('bump');
        setActiveTab('trackers');
        break;
      case 'postpartum':
        setWellnessSubTab('postpartum');
        setActiveTab('wellness');
        break;
      default:
        setActiveTab('wellness');
        break;
    }
  };

  const handleNavigate = (tab: any, subTab?: any) => {
    if (tab === 'reminders') {
      setWellnessSubTab('reminders');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'medications' || tab === 'meds') {
      setWellnessSubTab('meds');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'education' || tab === 'education_hub') {
      setWellnessSubTab('education');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'meals' || tab === 'meal_planner') {
      setWellnessSubTab('meals');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'weight' || tab === 'weight_tracker') {
      setWellnessSubTab('weight');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'plan' || tab === 'birth_plan') {
      setWellnessSubTab('plan');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'bag' || tab === 'hospital_bag') {
      setWellnessSubTab('bag');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'postpartum') {
      setWellnessSubTab('postpartum');
      setActiveTab('wellness');
      return;
    }
    if (tab === 'journal') {
      setTrackerSubTab('journal');
      setActiveTab('trackers');
      return;
    }
    if (tab === 'bump' || tab === 'bump_photos') {
      setTrackerSubTab('bump');
      setActiveTab('trackers');
      return;
    }
    if (tab === 'kick' || tab === 'kick_counter') {
      setTrackerSubTab('kick');
      setActiveTab('trackers');
      return;
    }
    if (tab === 'contraction' || tab === 'contraction_timer') {
      setTrackerSubTab('contraction');
      setActiveTab('trackers');
      return;
    }
    if (subTab) {
      if (tab === 'wellness') {
        setWellnessSubTab(subTab);
      } else if (tab === 'trackers') {
        setTrackerSubTab(subTab);
      }
    }
    setActiveTab(tab);
  };

  if (showSplash || initializing) {
    return <HeartSplash onFinish={() => setShowSplash(false)} />;
  }

  const handleOfflineGuest = async () => {
    const guestUser = {
      id: 'guest_offline',
      name: 'Guest User',
      email: 'offline@local',
      role: 'patient',
    };
    await api.setAuth('offline_token', guestUser);
    handleLoginSuccess(guestUser);
  };

  // Not logged in -> Show Front Screen or Auth Screen
  if (!user) {
    if (authView === 'front') {
      return (
        <FrontScreen
          onNavigateToAuth={(initialTab) => {
            setAuthInitialTab(initialTab);
            setAuthView('auth');
          }}
          onNavigateToOffline={handleOfflineGuest}
        />
      );
    }

    return (
      <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} translucent={false} />
        <AuthScreen
          initialTab={authInitialTab}
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setAuthView('front')}
        />
      </View>
    );
  }

  // Exact 6 bottom navigation tabs matching Screenshot 1
  const tabs = [
    { key: 'home' as const, label: 'Home', icon: 'home-outline', iconActive: 'home' },
    { key: 'vitals' as const, label: 'Vitals', icon: 'heart-outline', iconActive: 'heart' },
    { key: 'symptoms' as const, label: 'Check-in', icon: 'medkit-outline', iconActive: 'medkit' },
    { key: 'analyze' as const, label: 'Risk', icon: 'share-social-outline', iconActive: 'share-social' },
    { key: 'advice' as const, label: 'Advice', icon: 'bulb-outline', iconActive: 'bulb' },
    { key: 'profile' as const, label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  ];

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Dashboard';
      case 'vitals':
        return '';
      case 'symptoms':
        return 'Symptom Check-in';
      case 'analyze':
        return 'Risk Analysis';
      case 'advice':
        return 'Recommendations';
      case 'profile':
        return 'Profile';
      case 'wellness':
        switch (wellnessSubTab) {
          case 'education':
            return 'Education Hub';
          case 'meals':
            return 'Meal Planner';
          case 'meds':
            return 'Medication & Vitamin Reminders';
          case 'weight':
            return 'Weight Gain Tracker';
          case 'plan':
            return 'Birth Plan';
          case 'bag':
            return 'Hospital Bag Checklist';
          case 'postpartum':
            return 'Postpartum & Baby Care';
          case 'reminders':
            return 'Reminders';
          default:
            return 'Education Hub';
        }
      case 'trackers':
        switch (trackerSubTab) {
          case 'journal':
            return 'Pregnancy Journal';
          case 'bump':
            return 'Bump Photo Timeline';
          case 'kick':
            return 'Kick Counter';
          case 'contraction':
            return 'Contraction Timer';
          default:
            return 'Pregnancy Trackers';
        }
      default:
        return 'Dashboard';
    }
  };

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0A0A0C' : Colors.background}
        translucent={false}
      />

      {/* Top Header Bar - persistent across screens and burger menu tools */}
      <HeaderBar
        title={getHeaderTitle()}
        user={user}
        unreadCount={unreadNotificationsCount}
        onOpenDrawer={() => setDrawerVisible(true)}
        onOpenNotifications={() => setNotificationsVisible(true)}
        isDarkMode={isDarkMode}
      />

      {/* Screen Body */}
      <View style={[styles.screenContainer, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
        {activeTab === 'home' && (
          <HomeScreen
            onNavigate={handleNavigate}
            onOpenDrawer={() => setDrawerVisible(true)}
            onOpenNotifications={() => setNotificationsVisible(true)}
            currentUser={user}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'vitals' && <VitalsScreen isDarkMode={isDarkMode} />}
        {activeTab === 'symptoms' && <SymptomsScreen onNavigate={handleNavigate} />}
        {activeTab === 'analyze' && <AnalyzeScreen onNavigate={handleNavigate} />}
        {activeTab === 'advice' && <AdviceScreen onNavigate={handleNavigate} />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={handleLogout} />}
        {activeTab === 'wellness' && (
          <WellnessScreen
            key={wellnessSubTab}
            initialTab={wellnessSubTab}
            onNavigate={handleNavigate}
            onTabChange={(tab: any) => setWellnessSubTab(tab)}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'trackers' && (
          <TrackerScreen
            key={trackerSubTab}
            initialTab={trackerSubTab}
            onTabChange={(tab: any) => setTrackerSubTab(tab)}
          />
        )}

        {/* Floating Emergency Button (FAB) matching Screenshot 1 */}
        <EmergencyFab bottomOffset={Platform.OS === 'ios' ? 18 : 14} isDarkMode={isDarkMode} />
      </View>

      {/* Bottom Navigation Bar (1:1 with Screenshot 1) */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: bottomInset + 4 },
          Shadows.soft,
          isDarkMode && { backgroundColor: '#1A1A1E', borderTopColor: '#2C2C31' },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const activeColor = isDarkMode ? '#FF94B8' : Colors.primaryDark;
          const inactiveColor = isDarkMode ? '#85818A' : Colors.textMuted;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              activeOpacity={0.7}
              onPress={() => {
                setActiveTab(tab.key);
                if (tab.key === 'home') {
                  fetchUserData();
                }
              }}
            >
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons
                  name={(isActive ? tab.iconActive : tab.icon) as any}
                  size={20}
                  color={isActive ? activeColor : inactiveColor}
                />
              </View>
              <Text
                style={[
                  styles.tabItemText,
                  isActive
                    ? { color: activeColor, fontWeight: '800' }
                    : { color: inactiveColor },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Wellness Drawer Modal matching Screenshot 2 */}
      <WellnessDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelectTool={handleSelectTool}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Notifications Modal */}
      <NotificationModal
        visible={notificationsVisible}
        notifications={notifications}
        onClose={() => setNotificationsVisible(false)}
        onMarkAllRead={handleMarkAllNotificationsRead}
        isDarkMode={isDarkMode}
      />
    </View>
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
    position: 'relative',
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
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'serif',
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
    paddingTop: 6,
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
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {},
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

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
