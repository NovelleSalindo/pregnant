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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
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

  // Pregnancies state
  const [pregnancies, setPregnancies] = useState<any[]>([]);
  const [showNewPregModal, setShowNewPregModal] = useState(false);
  const [newPregTitle, setNewPregTitle] = useState('');
  const [newPregEdd, setNewPregEdd] = useState('');
  const [newPregNotes, setNewPregNotes] = useState('');
  const [savingPreg, setSavingPreg] = useState(false);

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

        // Load pregnancies list
        try {
          const pregRes = await api.getPregnancies();
          setPregnancies(pregRes.pregnancies || []);
        } catch {}
      } catch (e: any) {
        console.warn('Profile load error:', e.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleAddNewPregnancy = async () => {
    if (!newPregTitle.trim() && !newPregEdd.trim()) {
      Alert.alert('Required', 'Please enter a title or due date for the new pregnancy.');
      return;
    }
    setSavingPreg(true);
    try {
      const res = await api.addPregnancy({
        title: newPregTitle.trim(),
        edd: newPregEdd.trim() || undefined,
        notes: newPregNotes.trim() || undefined,
      });
      if (res.pregnancies) setPregnancies(res.pregnancies);
      if (res.profile) {
        setProfile(res.profile);
        setNextObVisit(res.profile.next_ob_visit || '');
      } else {
        setNextObVisit('');
      }
      setShowNewPregModal(false);
      setNewPregTitle('');
      setNewPregEdd('');
      setNewPregNotes('');
      Alert.alert('New Pregnancy Added', 'Your new pregnancy journey has started and is now active!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingPreg(false);
    }
  };

  const handleSwitchPregnancy = async (id: string) => {
    try {
      const res = await api.switchPregnancy(id);
      if (res.pregnancies) setPregnancies(res.pregnancies);
      if (res.profile) {
        setProfile(res.profile);
        setNextObVisit(res.profile.next_ob_visit || '');
      } else {
        setNextObVisit('');
      }
      Alert.alert('Active Pregnancy Changed', 'Switched your active pregnancy journey.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

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

  const confirmLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of PregnaCare?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primaryDark} />
      </View>
    );
  }

  const initials = (user?.name || 'M')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Avatar Card (.avatar from style.css line 459) */}
      <View style={[styles.headerCard, Shadows.card]}>
        <LinearGradient
          colors={Gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarInitials}>{initials}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* Pregnancies Card */}
      <View style={[styles.card, Shadows.card]}>
        <View style={styles.cardHeaderWithAction}>
          <Text style={styles.cardEyebrow}>PREGNANCIES</Text>
          <TouchableOpacity onPress={() => setShowNewPregModal(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add-circle" size={17} color={Colors.primary} />
            <Text style={[styles.editActionText, { color: Colors.primary, fontWeight: '700' }]}>New Pregnancy</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 10, marginTop: 8 }}>
          {pregnancies.map((preg) => {
            const isActive = preg.status === 'active';
            return (
              <View
                key={preg.id}
                style={{
                  backgroundColor: isActive ? '#FDF2F8' : '#F8FAFC',
                  borderColor: isActive ? '#FBCFE8' : '#E2E8F0',
                  borderWidth: 1.5,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: isActive ? '#FCE7F3' : '#E2E8F0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="heart" size={18} color={isActive ? '#DB2777' : '#64748B'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: '#1E293B' }}>{preg.title}</Text>
                      <View
                        style={{
                          backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 99,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '800',
                            color: isActive ? '#15803D' : '#64748B',
                          }}
                        >
                          {isActive ? 'ACTIVE' : 'COMPLETED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      {preg.edd ? `Due Date: ${preg.edd}` : 'Due Date: Not set'}
                      {preg.notes ? ` • ${preg.notes}` : ''}
                    </Text>
                  </View>
                </View>

                {!isActive && (
                  <TouchableOpacity
                    onPress={() => handleSwitchPregnancy(preg.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                      borderRadius: 8,
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>Set Active</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Editable Contact & Next Visit Card */}
      <View style={[styles.card, Shadows.card]}>
        <View style={styles.cardHeaderWithAction}>
          <Text style={styles.cardEyebrow}>CARE & CONTACTS</Text>
          <TouchableOpacity onPress={() => (editing ? handleSaveProfile() : setEditing(true))} activeOpacity={0.7}>
            <Text style={styles.editActionText}>{editing ? 'Save Changes' : 'Edit'}</Text>
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
              placeholderTextColor={Colors.textMuted}
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
              placeholderTextColor={Colors.textMuted}
            />
          ) : (
            <Text style={styles.fieldVal}>{phone || '—'}</Text>
          )}
        </View>

        <View style={[styles.fieldItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.fieldLbl}>Emergency Contact</Text>
          {editing ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <TextInput
                style={styles.fieldInput}
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="Name (e.g. Partner, Parent)"
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={styles.fieldInput}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Emergency Phone Number"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          ) : (
            <Text style={styles.fieldVal}>
              {emergencyName ? `${emergencyName} (${emergencyPhone || 'No phone'})` : 'None specified'}
            </Text>
          )}
        </View>
      </View>

      {/* Sign Out Button (.btn-danger in style.css) */}
      <TouchableOpacity style={[styles.logoutBtn, Shadows.card]} onPress={confirmLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={Colors.riskHigh} />
        <Text style={styles.logoutBtnText}>Sign Out of PregnaCare</Text>
      </TouchableOpacity>

      {/* Modal: Add New Pregnancy */}
      <Modal visible={showNewPregModal} transparent animationType="slide" onRequestClose={() => setShowNewPregModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, ...Shadows.soft }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 19, fontWeight: '800', color: '#1E293B' }}>New Pregnancy</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Start a new pregnancy tracking journey</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNewPregModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.fieldLbl}>Pregnancy Title / Nickname</Text>
                <TextInput
                  style={[styles.fieldInput, { marginTop: 4 }]}
                  placeholder="e.g. Baby #2 or 2nd Pregnancy"
                  placeholderTextColor={Colors.textMuted}
                  value={newPregTitle}
                  onChangeText={setNewPregTitle}
                />
              </View>

              <View>
                <Text style={styles.fieldLbl}>Expected Due Date (EDD)</Text>
                <TextInput
                  style={[styles.fieldInput, { marginTop: 4 }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  value={newPregEdd}
                  onChangeText={setNewPregEdd}
                />
              </View>

              <View>
                <Text style={styles.fieldLbl}>Notes / Details (Optional)</Text>
                <TextInput
                  style={[styles.fieldInput, { marginTop: 4, height: 60 }]}
                  multiline
                  placeholder="e.g. Excited for baby #2"
                  placeholderTextColor={Colors.textMuted}
                  value={newPregNotes}
                  onChangeText={setNewPregNotes}
                />
              </View>

              <Text style={{ fontSize: 11.5, color: '#64748B', lineHeight: 16 }}>
                Starting a new pregnancy will make it your active pregnancy and safely archive previous records in history.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => setShowNewPregModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: '700', color: '#475569' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddNewPregnancy}
                  disabled={savingPreg}
                  style={{ flex: 2, padding: 12, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' }}
                >
                  <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>
                    {savingPreg ? 'Saving...' : 'Start Pregnancy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
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
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCol: {
    width: '47%',
    backgroundColor: Colors.backgroundSoft,
    padding: 12,
    borderRadius: 14,
  },
  infoLbl: {
    fontSize: 10.5,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  fieldItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  fieldLbl: {
    fontSize: 11.5,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldVal: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
  },
  fieldInput: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: Colors.text,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.riskHighBg,
    borderWidth: 1.5,
    borderColor: Colors.riskHigh,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  logoutBtnText: {
    color: Colors.riskHigh,
    fontSize: 14.5,
    fontWeight: '800',
  },
});
