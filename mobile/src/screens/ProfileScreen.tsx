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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

interface ProfileScreenProps {
  user: any;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onLogout }) => {
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [nextObVisit, setNextObVisit] = useState('');

  // Server settings
  const [serverUrl, setServerUrl] = useState(api.getBaseUrl());
  const [showServerBox, setShowServerBox] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.getProfile();
        const p = res.profile || {};
        setProfile(p);
        setPhone(p.phone || '');
        setEmergencyName(p.emergency_name || '');
        setEmergencyPhone(p.emergency_phone || '');
        setNextObVisit(p.next_ob_visit || '');
      } catch (e: any) {
        console.warn('Profile load error:', e.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    try {
      await api.updateProfile({
        phone,
        emergency_name: emergencyName,
        emergency_phone: emergencyPhone,
        next_ob_visit: nextObVisit,
      });
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleUpdateServer = async () => {
    await api.setBaseUrl(serverUrl);
    setShowServerBox(false);
    Alert.alert('Updated', `API Base URL set to:\n${serverUrl}`);
  };

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to sign out of PregnaCare?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>
            {(user?.name || 'M')
              .split(' ')
              .map((n: string) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || 'patient'}</Text>
          </View>
        </View>
      </View>

      {/* Pregnancy Vital Info Card */}
      <View style={[styles.card, Shadows.small]}>
        <Text style={styles.cardSectionTitle}>PREGNANCY DETAILS</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLbl}>Expected Due Date (EDD)</Text>
            <Text style={styles.infoVal}>{profile.edd || 'Not Set'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLbl}>Last Menstrual Period</Text>
            <Text style={styles.infoVal}>{profile.lmp || 'Not Set'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLbl}>Blood Type</Text>
            <Text style={styles.infoVal}>{profile.blood_type || '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLbl}>Height / Weight</Text>
            <Text style={styles.infoVal}>
              {profile.height_cm ? `${profile.height_cm}cm` : '—'} /{' '}
              {profile.weight_kg ? `${profile.weight_kg}kg` : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Editable Contact & Next Visit Card */}
      <View style={[styles.card, Shadows.small]}>
        <View style={styles.cardHeaderWithAction}>
          <Text style={styles.cardSectionTitle}>CARE & CONTACTS</Text>
          <TouchableOpacity onPress={() => (editing ? handleSaveProfile() : setEditing(true))}>
            <Text style={styles.editActionText}>{editing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldItem}>
          <Text style={styles.fieldLbl}>Next Scheduled OB-GYN Visit</Text>
          {editing ? (
            <TextInput
              style={styles.fieldInput}
              value={nextObVisit}
              onChangeText={setNextObVisit}
              placeholder="YYYY-MM-DD"
            />
          ) : (
            <Text style={styles.fieldVal}>{nextObVisit || 'None scheduled'}</Text>
          )}
        </View>

        <View style={styles.fieldItem}>
          <Text style={styles.fieldLbl}>Phone Number</Text>
          {editing ? (
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="09xx-xxx-xxxx"
            />
          ) : (
            <Text style={styles.fieldVal}>{phone || '—'}</Text>
          )}
        </View>

        <View style={styles.fieldItem}>
          <Text style={styles.fieldLbl}>Emergency Contact</Text>
          {editing ? (
            <View style={{ gap: 6 }}>
              <TextInput
                style={styles.fieldInput}
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="Name (e.g. Partner, Parent)"
              />
              <TextInput
                style={styles.fieldInput}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Emergency Phone Number"
              />
            </View>
          ) : (
            <Text style={styles.fieldVal}>
              {emergencyName ? `${emergencyName} (${emergencyPhone || 'No phone'})` : 'None specified'}
            </Text>
          )}
        </View>
      </View>

      {/* Network & Backend Server Settings */}
      <View style={[styles.card, Shadows.small]}>
        <TouchableOpacity
          style={styles.serverRowToggle}
          onPress={() => setShowServerBox(!showServerBox)}
        >
          <Ionicons name="server" size={18} color={Colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.serverTitle}>Backend API Server</Text>
            <Text style={styles.serverSubtitle}>{api.getBaseUrl()}</Text>
          </View>
          <Ionicons
            name={showServerBox ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {showServerBox && (
          <View style={styles.serverEditBox}>
            <Text style={styles.serverHint}>
              When running on a physical phone via Expo Go, point this to your computer's local Wi-Fi IP address (e.g. http://192.168.1.100/HAYYYSSSS/pregnacare_old/api).
            </Text>
            <TextInput
              style={styles.fieldInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.updateServerBtn} onPress={handleUpdateServer}>
              <Text style={styles.updateServerBtnText}>Update API URL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={18} color={Colors.riskSevere} />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  infoCol: {
    width: '47%',
  },
  infoLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  fieldItem: {
    marginBottom: 12,
  },
  fieldLbl: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
  },
  serverRowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  serverSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  serverEditBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  serverHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    lineHeight: 16,
  },
  updateServerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  updateServerBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.riskSevereLight,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: {
    color: Colors.riskSevere,
    fontSize: 14,
    fontWeight: '700',
  },
});
