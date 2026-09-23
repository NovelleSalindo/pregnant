import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';

interface HeaderBarProps {
  title?: string;
  user?: {
    name?: string;
    email?: string;
  };
  unreadCount?: number;
  onOpenDrawer: () => void;
  onOpenNotifications: () => void;
  isDarkMode?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title = 'Dashboard',
  user,
  unreadCount = 0,
  onOpenDrawer,
  onOpenNotifications,
  isDarkMode = false,
}) => {
  const displayName = user?.name || 'Novelle B. Salindo';
  const displayEmail = user?.email || 'novelle2023.salindo@gmail.com';
  const initials = getInitials(displayName);

  return (
    <View style={[styles.container, isDarkMode && { backgroundColor: '#0A0A0C' }]}>
      {/* 1. Brand Name */}
      <View style={styles.brandRow}>
        <Text style={[styles.brandTitle, isDarkMode && { color: '#FF94B8' }]}>PregnaCare</Text>
      </View>

      {/* 2. Action & User Row */}
      <View style={styles.actionRow}>
        {/* Hamburger Menu Button */}
        <TouchableOpacity
          style={[styles.iconBtn, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
          onPress={onOpenDrawer}
          activeOpacity={0.7}
          accessibilityLabel="Open wellness tools menu"
        >
          <Ionicons name="menu" size={21} color={isDarkMode ? '#F0EEF0' : Colors.text} />
        </TouchableOpacity>

        {/* Avatar Initials Badge */}
        <LinearGradient
          colors={['#BDE0FE', '#FFAFCC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>

        {/* User Name & Email */}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isDarkMode && { color: '#F0EEF0' }]} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
          </Text>
          <Text style={[styles.userEmail, isDarkMode && { color: '#85818A' }]} numberOfLines={1} ellipsizeMode="tail">
            {displayEmail}
          </Text>
        </View>

        {/* Notification Bell Button */}
        <TouchableOpacity
          style={[styles.iconBtn, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' }]}
          onPress={onOpenNotifications}
          activeOpacity={0.7}
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications" size={18} color={isDarkMode ? '#F0EEF0' : Colors.text} />
          {unreadCount > 0 && (
            <View style={[styles.badgeWrap, isDarkMode && { borderColor: '#1A1A1E' }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. Page Title */}
      {!!title && <Text style={[styles.pageTitle, isDarkMode && { color: '#F0EEF0' }]}>{title}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  brandRow: {
    marginBottom: 8,
  },
  brandTitle: {
    fontFamily: 'serif',
    fontSize: 21,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: -0.3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.riskHigh,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userInfo: {
    flex: 1,
    marginLeft: 2,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.1,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'serif',
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
});
