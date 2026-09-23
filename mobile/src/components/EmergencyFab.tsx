import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Shadows } from '../theme/colors';
import { api } from '../services/api';

const STORAGE_KEY_EMERGENCY = '@pregnacare_emergency_contact';
const STORAGE_KEY_HOTLINES = '@pregnacare_hotlines';

interface CustomContact {
  name: string;
  number: string;
}

interface EmergencyFabProps {
  bottomOffset?: number;
  isDarkMode?: boolean;
}

export const EmergencyFab: React.FC<EmergencyFabProps> = ({
  bottomOffset = 14,
  isDarkMode = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [customContact, setCustomContact] = useState<CustomContact | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [numberInput, setNumberInput] = useState('');

  // User-provided Medical Hotline Numbers (empty by default)
  const [obgynNumber, setObgynNumber] = useState('');
  const [isEditingObgyn, setIsEditingObgyn] = useState(false);
  const [editObgynVal, setEditObgynVal] = useState('');

  const loadSavedData = async () => {
    try {
      // 1. Personal contact
      const stored = await AsyncStorage.getItem(STORAGE_KEY_EMERGENCY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomContact(parsed);
        setNameInput(parsed.name || '');
        setNumberInput(parsed.number || '');
      } else {
        const cached = await api.getCachedUser();
        if (cached?.profile?.emergency_phone) {
          const contact: CustomContact = {
            name: cached.profile.emergency_name || 'My Emergency Contact',
            number: cached.profile.emergency_phone,
          };
          setCustomContact(contact);
          setNameInput(contact.name);
          setNumberInput(contact.number);
          await AsyncStorage.setItem(STORAGE_KEY_EMERGENCY, JSON.stringify(contact));
        }
      }

      // 2. Custom OB-GYN hotline
      const storedHotlines = await AsyncStorage.getItem(STORAGE_KEY_HOTLINES);
      if (storedHotlines) {
        const parsedH = JSON.parse(storedHotlines);
        if (parsedH.obgyn && parsedH.obgyn !== '(555) 010-2288') {
          setObgynNumber(parsedH.obgyn);
        }
      }
    } catch (e) {
      console.warn('Failed to load emergency data:', e);
    }
  };

  useEffect(() => {
    loadSavedData();
  }, [modalVisible]);

  const handleCall = (number: string) => {
    const cleaned = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('Unable to Call', `Could not initiate call to ${number}.`);
    });
  };

  const handleSendSosSms = (number: string, recipientName: string) => {
    if (!number || !number.trim()) {
      Alert.alert('No Phone Number', `Please set a phone number for ${recipientName} first.`);
      return;
    }
    const cleaned = number.replace(/[^0-9+]/g, '');
    const message = encodeURIComponent(
      `🚨 EMERGENCY (PregnaCare Alert): I am experiencing severe pregnancy complications and urgently need medical assistance. Please check on me or call an ambulance immediately!`
    );
    const url = Platform.OS === 'ios' ? `sms:${cleaned}&body=${message}` : `sms:${cleaned}?body=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to Open SMS', `Could not open SMS app for ${number}.`);
    });
  };

  // --- Personal Emergency Contact Handlers ---
  const handleSaveContact = async () => {
    if (!numberInput.trim()) {
      Alert.alert('Phone Number Required', 'Please enter a valid phone number.');
      return;
    }
    const newContact: CustomContact = {
      name: nameInput.trim() || 'My Emergency Contact',
      number: numberInput.trim(),
    };
    setCustomContact(newContact);
    setIsEditingContact(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY_EMERGENCY, JSON.stringify(newContact));
      api.updateProfile({
        emergency_name: newContact.name,
        emergency_phone: newContact.number,
      }).catch(() => {});
    } catch (e) {
      console.warn('Failed to save emergency contact:', e);
    }
  };

  const handleDeleteContact = () => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove your personal emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setCustomContact(null);
            setNameInput('');
            setNumberInput('');
            setIsEditingContact(false);
            await AsyncStorage.removeItem(STORAGE_KEY_EMERGENCY);
            api.updateProfile({
              emergency_name: '',
              emergency_phone: '',
            }).catch(() => {});
          },
        },
      ]
    );
  };

  const startEditingContact = () => {
    if (customContact) {
      setNameInput(customContact.name);
      setNumberInput(customContact.number);
    }
    setIsEditingContact(true);
  };

  // --- Editable OB-GYN Hotline Handlers ---
  const handleStartEditObgyn = () => {
    setIsEditingObgyn(true);
    setEditObgynVal(obgynNumber);
  };

  const handleSaveObgyn = async () => {
    const cleanVal = editObgynVal.trim();
    if (!cleanVal) {
      Alert.alert('Phone Number Required', 'Please enter a valid phone number.');
      return;
    }
    setObgynNumber(cleanVal);
    setIsEditingObgyn(false);
    setEditObgynVal('');
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_HOTLINES,
        JSON.stringify({ obgyn: cleanVal })
      );
    } catch (e) {
      console.warn('Failed to save OB-GYN hotline number:', e);
    }
  };

  const handleClearObgyn = async () => {
    setObgynNumber('');
    setIsEditingObgyn(false);
    setEditObgynVal('');
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_HOTLINES,
        JSON.stringify({ obgyn: '' })
      );
    } catch (e) {}
  };

  const handleCallHotline = (number: string, title: string) => {
    if (!number || !number.trim()) {
      Alert.alert(
        'No Number Added',
        `You haven't entered a phone number for ${title} yet. Would you like to add it now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Number',
            onPress: handleStartEditObgyn,
          },
        ]
      );
      return;
    }
    handleCall(number);
  };

  return (
    <>
      {/* Red Circular Floating Emergency Action Button with White Phone Icon */}
      <TouchableOpacity
        style={[styles.fabWrapper, { bottom: bottomOffset }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Emergency assistance"
      >
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabCircle}
        >
          <Ionicons name="call" size={26} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Emergency Hotlines & Contacts Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          setIsEditingContact(false);
          setIsEditingObgyn(false);
        }}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            setModalVisible(false);
            setIsEditingContact(false);
            setIsEditingObgyn(false);
          }}
        >
          <Pressable
            style={[
              styles.sheetCard,
              Shadows.large,
              isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31' },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIconCircle}>
                  <Ionicons name="alert-circle" size={28} color="#DC2626" />
                </View>
                <Text style={[styles.sheetTitle, isDarkMode && { color: '#F0EEF0' }]}>
                  Emergency Assistance
                </Text>
                <Text style={[styles.sheetSubtitle, isDarkMode && { color: '#85818A' }]}>
                  If you are experiencing severe bleeding, acute abdominal pain, or sudden shortness of breath, call immediately.
                </Text>
              </View>

              {/* 1. Personal Emergency Contact Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, isDarkMode && { color: '#FF94B8' }]}>
                    PERSONAL EMERGENCY CONTACT
                  </Text>
                  {customContact && !isEditingContact && (
                    <TouchableOpacity onPress={startEditingContact} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isEditingContact ? (
                  <View style={[styles.formCard, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
                    <Text style={[styles.formLabel, isDarkMode && { color: '#85818A' }]}>Contact Name / Relation</Text>
                    <TextInput
                      style={[styles.formInput, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31', color: '#F0EEF0' }]}
                      placeholder="e.g. Partner, Mom, Dr. Santos"
                      placeholderTextColor={isDarkMode ? '#85818A' : Colors.textMuted}
                      value={nameInput}
                      onChangeText={setNameInput}
                    />

                    <Text style={[styles.formLabel, { marginTop: 10 }, isDarkMode && { color: '#85818A' }]}>Phone Number</Text>
                    <TextInput
                      style={[styles.formInput, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31', color: '#F0EEF0' }]}
                      placeholder="e.g. 09171234567 or +63..."
                      placeholderTextColor={isDarkMode ? '#85818A' : Colors.textMuted}
                      keyboardType="phone-pad"
                      value={numberInput}
                      onChangeText={setNumberInput}
                    />

                    <View style={styles.formBtnRow}>
                      <TouchableOpacity
                        style={[styles.formBtn, styles.cancelBtn]}
                        onPress={() => setIsEditingContact(false)}
                      >
                        <Text style={[styles.cancelBtnText, isDarkMode && { color: '#85818A' }]}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.formBtn, styles.saveBtn]}
                        onPress={handleSaveContact}
                      >
                        <Text style={styles.saveBtnText}>Save Contact</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : customContact ? (
                  <View style={[styles.customContactCard, isDarkMode && { backgroundColor: '#20161A', borderColor: '#4A202A' }]}>
                    <View style={styles.customContactHeader}>
                      <View style={styles.customContactInfo}>
                        <View style={styles.contactBadge}>
                          <Ionicons name="heart" size={12} color="#DC2626" />
                          <Text style={styles.contactBadgeText}>My Contact</Text>
                        </View>
                        <Text style={[styles.customContactName, isDarkMode && { color: '#F0EEF0' }]} numberOfLines={1}>
                          {customContact.name}
                        </Text>
                        <Text style={styles.customContactNumber}>{customContact.number}</Text>
                      </View>

                      <View style={styles.contactActions}>
                        <TouchableOpacity
                          style={styles.customCallBtn}
                          onPress={() => handleCall(customContact.number)}
                          activeOpacity={0.8}
                          accessibilityLabel="Call contact"
                        >
                          <Ionicons name="call" size={17} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.customSmsBtn}
                          onPress={() => handleSendSosSms(customContact.number, customContact.name)}
                          activeOpacity={0.8}
                          accessibilityLabel="Send SOS SMS"
                        >
                          <Ionicons name="chatbubble-ellipses" size={17} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteContactBtn}
                          onPress={handleDeleteContact}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Instant Quick SOS SMS Trigger Banner */}
                    <TouchableOpacity
                      style={styles.sosQuickBanner}
                      onPress={() => handleSendSosSms(customContact.number, customContact.name)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="warning" size={15} color="#DC2626" />
                      <Text style={styles.sosQuickBannerText}>Send Instant SOS SMS to {customContact.name}</Text>
                      <Ionicons name="send" size={13} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addContactCard, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}
                    onPress={() => setIsEditingContact(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addContactIconWrap}>
                      <Ionicons name="person-add-outline" size={20} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.addContactTitle, isDarkMode && { color: '#F0EEF0' }]}>Add Emergency Contact</Text>
                      <Text style={[styles.addContactDesc, isDarkMode && { color: '#85818A' }]}>
                        Tap to save your partner, doctor, or family member
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={isDarkMode ? '#85818A' : Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* 2. OB-GYN On-Call Line Section */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, isDarkMode && { color: '#FF94B8' }]}>
                    OB-GYN ON-CALL LINE
                  </Text>
                  <Text style={styles.helperTip}>Tap pencil to set number</Text>
                </View>

                <View style={styles.hotlineList}>
                  {/* OB-GYN On-Call Line (Editable) */}
                  {isEditingObgyn ? (
                    <View style={[styles.formCard, isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' }]}>
                      <Text style={[styles.formLabel, isDarkMode && { color: '#85818A' }]}>
                        Set OB-GYN On-Call Phone Number
                      </Text>
                      <TextInput
                        style={[styles.formInput, isDarkMode && { backgroundColor: '#1A1A1E', borderColor: '#2C2C31', color: '#F0EEF0' }]}
                        value={editObgynVal}
                        onChangeText={setEditObgynVal}
                        placeholder="e.g. 0917 123 4567 or (02) 8123 4567"
                        placeholderTextColor={isDarkMode ? '#85818A' : Colors.textMuted}
                        keyboardType="phone-pad"
                        autoFocus
                      />
                      <View style={styles.formBtnRow}>
                        <TouchableOpacity
                          style={[styles.formBtn, styles.cancelBtn]}
                          onPress={() => setIsEditingObgyn(false)}
                        >
                          <Text style={[styles.cancelBtnText, isDarkMode && { color: '#85818A' }]}>Cancel</Text>
                        </TouchableOpacity>
                        {obgynNumber ? (
                          <TouchableOpacity
                            style={[styles.formBtn, styles.resetBtn]}
                            onPress={handleClearObgyn}
                          >
                            <Text style={styles.resetBtnText}>Clear</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={[styles.formBtn, styles.saveBtn]}
                          onPress={handleSaveObgyn}
                        >
                          <Text style={styles.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.hotlineItem,
                        isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.hotlineInfo}
                        onPress={() => {
                          if (!obgynNumber) {
                            handleStartEditObgyn();
                          } else {
                            handleCall(obgynNumber);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.hotlineName, isDarkMode && { color: '#F0EEF0' }]}>
                          OB-GYN On-Call Line
                        </Text>
                        <Text
                          style={[
                            styles.hotlineNumber,
                            !obgynNumber && styles.hotlineNumberPlaceholder,
                            isDarkMode && { color: obgynNumber ? '#F0EEF0' : '#85818A' },
                          ]}
                        >
                          {obgynNumber || 'e.g. 0917 123 4567 (Tap to add)'}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.hotlineActions}>
                        <TouchableOpacity
                          style={[styles.miniEditBtn, isDarkMode && { backgroundColor: '#1F1F24', borderColor: '#2C2C31' }]}
                          onPress={handleStartEditObgyn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Edit OB-GYN number"
                        >
                          <Ionicons name="pencil" size={14} color={isDarkMode ? '#FF94B8' : Colors.primaryDark} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.miniSmsBtn, !obgynNumber && styles.callBtnDisabled]}
                          onPress={() => {
                            if (!obgynNumber) handleStartEditObgyn();
                            else handleSendSosSms(obgynNumber, 'OB-GYN');
                          }}
                          activeOpacity={0.8}
                          accessibilityLabel="Send SOS SMS to OB-GYN"
                        >
                          <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.callBtnCircle, !obgynNumber && styles.callBtnDisabled]}
                          onPress={() => handleCallHotline(obgynNumber, 'OB-GYN Line')}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="call" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* 3. National Emergency Hotline */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeading, isDarkMode && { color: '#FF94B8' }]}>
                    NATIONAL EMERGENCY HOTLINE
                  </Text>
                </View>
                <View
                  style={[
                    styles.hotlineItem,
                    isDarkMode && { backgroundColor: '#131316', borderColor: '#2C2C31' },
                  ]}
                >
                  <View style={styles.hotlineInfo}>
                    <Text style={[styles.hotlineName, isDarkMode && { color: '#F0EEF0' }]}>
                      National Emergency Hotline (911)
                    </Text>
                    <Text style={[styles.hotlineNumber, isDarkMode && { color: '#FFB4C8' }]}>
                      Dial 911 • Ambulance, Medical, Rescue
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.callBtnCircle, styles.callBtnUrgent]}
                    onPress={() => handleCall('911')}
                    activeOpacity={0.8}
                    accessibilityLabel="Call 911"
                  >
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.closeBtn, isDarkMode && { borderColor: '#2C2C31' }]}
                onPress={() => {
                  setModalVisible(false);
                  setIsEditingContact(false);
                  setIsEditingObgyn(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.closeBtnText, isDarkMode && { color: '#85818A' }]}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    right: 20,
    zIndex: 99,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  fabCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheetCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    color: Colors.textSoft,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#DC2626',
  },
  helperTip: {
    fontSize: 10.5,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  editLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  formCard: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  formLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 5,
  },
  formInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  formBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSoft,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  resetBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  saveBtn: {
    backgroundColor: '#DC2626',
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customContactCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 16,
    padding: 14,
  },
  customContactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customContactInfo: {
    flex: 1,
    marginRight: 10,
  },
  contactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  contactBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  customContactName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  customContactNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSoft,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customCallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSmsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSmsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosQuickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 12,
    gap: 6,
  },
  sosQuickBannerText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteContactBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  addContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  addContactIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContactTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  addContactDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  hotlineList: {
    gap: 9,
  },
  hotlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  hotlineItemUrgent: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  hotlineInfo: {
    flex: 1,
  },
  hotlineName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  hotlineNameUrgent: {
    color: '#DC2626',
    fontWeight: '800',
  },
  hotlineNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSoft,
    marginTop: 2,
  },
  hotlineNumberPlaceholder: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  hotlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnUrgent: {
    backgroundColor: '#DC2626',
  },
  callBtnDisabled: {
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
  closeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSoft,
  },
});
