import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows } from '../theme/colors';

interface EmergencyFabProps {
  bottomOffset?: number;
}

export const EmergencyFab: React.FC<EmergencyFabProps> = ({ bottomOffset = 20 }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const hotlines = [
    { name: 'Local Emergency Services', number: '911', urgent: true },
    { name: 'OB-GYN On-Call Line', number: '(555) 010-2288', urgent: false },
    { name: 'Maternal Nurse Hotline (24/7)', number: '(555) 010-9100', urgent: false },
  ];

  const handleCall = (number: string) => {
    const cleaned = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      // fallback
    });
  };

  return (
    <>
      {/* Floating Emergency Action Button */}
      <TouchableOpacity
        style={[styles.fabWrapper, { bottom: bottomOffset }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        accessibilityLabel="Emergency assistance"
      >
        <LinearGradient
          colors={['#E15D74', '#C43F58']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="call" size={17} color="#FFFFFF" />
          <Text style={styles.fabText}>Emergency</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Emergency Hotlines Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheetCard, Shadows.large]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconCircle}>
                <Ionicons name="alert-circle" size={26} color={Colors.riskHigh} />
              </View>
              <Text style={styles.sheetTitle}>Emergency Hotlines</Text>
              <Text style={styles.sheetSubtitle}>
                If you are experiencing severe bleeding, acute abdominal pain, or sudden shortness of breath, call immediately.
              </Text>
            </View>

            <View style={styles.hotlineList}>
              {hotlines.map((h, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.hotlineItem, h.urgent && styles.hotlineItemUrgent]}
                  onPress={() => handleCall(h.number)}
                  activeOpacity={0.7}
                >
                  <View style={styles.hotlineInfo}>
                    <Text style={[styles.hotlineName, h.urgent && styles.hotlineNameUrgent]}>
                      {h.name}
                    </Text>
                    <Text style={styles.hotlineNumber}>{h.number}</Text>
                  </View>
                  <View style={[styles.callBtnCircle, h.urgent && styles.callBtnUrgent]}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    right: 18,
    zIndex: 99,
    shadowColor: '#E15D74',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    gap: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 34, 41, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheetCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  sheetIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.riskHighBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    fontFamily: 'serif',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSoft,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  hotlineList: {
    gap: 10,
    marginBottom: 16,
  },
  hotlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  hotlineItemUrgent: {
    borderColor: Colors.riskHigh,
    backgroundColor: Colors.riskHighBg,
  },
  hotlineInfo: {
    flex: 1,
  },
  hotlineName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  hotlineNameUrgent: {
    color: Colors.riskHigh,
  },
  hotlineNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSoft,
    marginTop: 2,
  },
  callBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnUrgent: {
    backgroundColor: Colors.riskHigh,
  },
  closeBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSoft,
  },
});
