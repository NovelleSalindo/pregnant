import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadows } from '../theme/colors';

export interface RedBubbleFlashProps {
  visible: boolean;
  title: string;
  message: string;
  theme?: 'red' | 'yellow' | 'pink' | 'green';
  icon?: string;
  buttonText?: string;
  onClose: () => void;
  isDarkMode?: boolean;
  inModal?: boolean;
}

export const RedBubbleFlashModal: React.FC<RedBubbleFlashProps> = ({
  visible,
  title,
  message,
  theme = 'red',
  icon,
  buttonText,
  onClose,
  isDarkMode = false,
  inModal = false,
}) => {
  if (!visible) return null;

  // Determine styling based on theme
  const isRed = theme === 'red' || title.includes('Severe') || title.includes('🚨') || title.includes('Urgent');
  const isYellow = !isRed && (theme === 'yellow' || title.includes('High') || title.includes('⚠️'));

  let primaryColor = isRed ? '#DC2626' : (isYellow ? '#D97706' : '#BE185D');
  let titleColor = isRed ? (isDarkMode ? '#FCA5A5' : '#991B1B') : (isYellow ? (isDarkMode ? '#FDE68A' : '#92400E') : (isDarkMode ? '#F472B6' : '#9D174D'));
  let msgColor = isRed ? (isDarkMode ? '#FECDD3' : '#7F1D1D') : (isYellow ? (isDarkMode ? '#FEF3C7' : '#78350F') : (isDarkMode ? '#FCE7F3' : '#4A1D32'));
  let cardBg = isRed ? (isDarkMode ? '#220A0E' : '#FFF1F2') : (isYellow ? (isDarkMode ? '#231B09' : '#FFFBEB') : (isDarkMode ? '#1E141A' : '#FFF5F8'));
  let cardBorder = isRed ? (isDarkMode ? '#991B1B' : '#FDA4AF') : (isYellow ? (isDarkMode ? '#B45309' : '#FCD34D') : (isDarkMode ? '#831843' : '#FBCFE8'));
  let bubbleBg = isRed ? (isDarkMode ? '#4C0519' : '#FFE4E6') : (isYellow ? (isDarkMode ? '#451A03' : '#FEF3C7') : (isDarkMode ? '#4A1D32' : '#FCE7F3'));
  let bubbleBorder = isRed ? '#F43F5E' : (isYellow ? '#F59E0B' : '#F472B6');
  let shadowClr = isRed ? '#EF4444' : (isYellow ? '#F59E0B' : '#F472B6');
  let defaultIcon = isRed ? 'alert-circle' : (isYellow ? 'warning' : 'checkmark-circle');
  let btnGradient: readonly [string, string] = isRed
    ? ['#EF4444', '#B91C1C']
    : (isYellow ? ['#F59E0B', '#B45309'] : ['#EC4899', '#BE185D']);
  let defaultBtnText = isRed ? 'VIEW GUIDELINES' : 'Got it ✨';

  const modalContent = (
    <View style={styles.bubbleModalOverlay}>
      <View
        style={[
          styles.bubbleCard,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            shadowColor: shadowClr,
          },
        ]}
      >
        {/* Floating Decorative Red/Themed Bubbles */}
        <View
          style={[
            styles.floatingBubble1,
            { backgroundColor: bubbleBg, borderColor: bubbleBorder },
          ]}
        />
        <View
          style={[
            styles.floatingBubble2,
            { backgroundColor: bubbleBg, borderColor: bubbleBorder },
          ]}
        />
        <View
          style={[
            styles.floatingBubble3,
            { backgroundColor: bubbleBg, borderColor: bubbleBorder },
          ]}
        />
        <View
          style={[
            styles.floatingBubble4,
            { backgroundColor: bubbleBg, borderColor: bubbleBorder },
          ]}
        />
        <View
          style={[
            styles.floatingBubble5,
            { backgroundColor: bubbleBg, borderColor: bubbleBorder },
          ]}
        />

        {/* Central Icon Bubble */}
        <View
          style={[
            styles.bubbleIconContainer,
            {
              backgroundColor: bubbleBg,
              borderColor: bubbleBorder,
              shadowColor: shadowClr,
            },
          ]}
        >
          <Ionicons
            name={(icon as any) || defaultIcon}
            size={38}
            color={primaryColor}
          />
        </View>

        {/* Bubble Title */}
        <Text style={[styles.bubbleTitle, { color: titleColor }]}>
          {title}
        </Text>

        {/* Bubble Message */}
        <Text style={[styles.bubbleMessage, { color: msgColor }]}>
          {message}
        </Text>

        {/* Action Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.bubbleActionBtnWrapper}
          onPress={onClose}
        >
          <LinearGradient
            colors={btnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleActionBtn}
          >
            <Text style={styles.bubbleActionBtnText}>
              {buttonText || defaultBtnText}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (inModal) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 99999 }]}>
        {modalContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {modalContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  bubbleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  bubbleCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  floatingBubble1: {
    position: 'absolute',
    top: -14,
    right: 22,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingBubble2: {
    position: 'absolute',
    top: 36,
    left: -12,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  floatingBubble3: {
    position: 'absolute',
    bottom: -10,
    left: 45,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  floatingBubble4: {
    position: 'absolute',
    top: -8,
    left: 28,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  floatingBubble5: {
    position: 'absolute',
    bottom: 30,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  bubbleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bubbleTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  bubbleMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  bubbleActionBtnWrapper: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  bubbleActionBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
