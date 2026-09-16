import React, { useState, useEffect, useCallback } from 'react';
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
import { AnalyzeScreen } from './src/screens/AnalyzeScreen';
import { AdviceScreen } from './src/screens/AdviceScreen';
import { WellnessDrawer } from './src/components/WellnessDrawer';
import { NotificationModal } from './src/components/NotificationModal';
import { EmergencyFab } from './src/components/EmergencyFab';

type NavTab = 'home' | 'vitals' | 'symptoms' | 'analyze' | 'advice' | 'profile' | 'wellness' | 'trackers';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [wellnessSubTab, setWellnessSubTab] = useState<'education' | 'meals' | 'meds' | 'plan' | 'bag' | 'weight' | 'postpartum' | 'reminders'>('education');
  const [trackerSubTab, setTrackerSubTab] = useState<'kick' | 'contraction' | 'journal' | 'bump'>('kick');

  const fetchUserData = useCallback(async () => {
    try {
      const dashboard = await api.getDashboard();
      if (dashboard?.notifications?.items) {
        setNotifications(dashboard.notifications.items);
      }
      if (dashboard?.user) {
        setUser(dashboard.user);
      }
    } catch (e: any) {
      console.warn('Dashboard fetch error:', e.message);
    }
  }, []);

  useEffect(() => {
    async function setup() {
      try {
        await api.init();
        const cachedUser = await api.getCachedUser();
        if (cachedUser && api.getToken()) {
          setUser(cachedUser);
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

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    setActiveTab('home');
    fetchUserData();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
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

  // Exact 6 bottom navigation tabs matching Screenshot 1
  const tabs = [
    { key: 'home' as const, label: 'Home', icon: 'speedometer-outline', iconActive: 'speedometer' },
    { key: 'vitals' as const, label: 'Vitals', icon: 'heart-outline', iconActive: 'heart' },
    { key: 'symptoms' as const, label: 'Check-in', icon: 'medkit-outline', iconActive: 'medkit' },
    { key: 'analyze' as const, label: 'Risk', icon: 'share-social-outline', iconActive: 'share-social' },
    { key: 'advice' as const, label: 'Advice', icon: 'bulb-outline', iconActive: 'bulb' },
    { key: 'profile' as const, label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            onNavigate={(tab: any) => setActiveTab(tab)}
            onOpenDrawer={() => setDrawerVisible(true)}
            onOpenNotifications={() => setNotificationsVisible(true)}
            currentUser={user}
          />
        )}
        {activeTab === 'vitals' && <VitalsScreen />}
        {activeTab === 'symptoms' && <SymptomsScreen />}
        {activeTab === 'analyze' && <AnalyzeScreen onNavigate={(tab: any) => setActiveTab(tab)} />}
        {activeTab === 'advice' && <AdviceScreen onNavigate={(tab: any) => setActiveTab(tab)} />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={handleLogout} />}
        {activeTab === 'wellness' && <WellnessScreen initialTab={wellnessSubTab} onNavigate={(tab: any) => setActiveTab(tab)} />}
        {activeTab === 'trackers' && <TrackerScreen initialTab={trackerSubTab} />}

        {/* Floating Emergency Button (FAB) matching Screenshot 1 */}
        <EmergencyFab bottomOffset={Platform.OS === 'ios' ? 76 : 68} />
      </View>

      {/* Bottom Navigation Bar (1:1 with Screenshot 1) */}
      <View style={[styles.bottomBar, Shadows.soft]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
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

      {/* Wellness Drawer Modal matching Screenshot 2 */}
      <WellnessDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelectTool={handleSelectTool}
        onLogout={handleLogout}
      />

      {/* Notifications Modal */}
      <NotificationModal
        visible={notificationsVisible}
        notifications={notifications}
        onClose={() => setNotificationsVisible(false)}
        onMarkAllRead={handleMarkAllNotificationsRead}
      />
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
    paddingVertical: 6,
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
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
