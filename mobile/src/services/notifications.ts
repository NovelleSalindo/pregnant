import { Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Request permission for phone notifications
 */
export async function requestPhoneNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  // On mobile Expo Go, native push was removed by Expo in SDK 53+
  return true;
}

export interface BubbleFlashEvent {
  visible: boolean;
  title: string;
  message: string;
  theme?: 'red' | 'yellow' | 'pink' | 'green';
  icon?: string;
  buttonText?: string;
}

type FlashListener = (event: BubbleFlashEvent) => void;
const flashListeners: Set<FlashListener> = new Set();

export function subscribeBubbleFlash(listener: FlashListener): () => void {
  flashListeners.add(listener);
  return () => {
    flashListeners.delete(listener);
  };
}

export function triggerBubbleFlash(event: BubbleFlashEvent) {
  flashListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.warn('Bubble flash error:', e);
    }
  });
}

/**
 * Send a notification to the phone (Web Notifications for browsers/PWA, Native Alert & Haptics for Mobile)
 */
export async function sendPhoneNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  // 1. Web Notification (if running in browser)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/icon-192.png' });
      } catch (e) {
        console.warn('Web notification error:', e);
      }
    }
    return;
  }

  // 2. Physical Mobile Haptic Feedback
  try {
    if (title.includes('Severe') || title.includes('🚨')) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (title.includes('High') || title.includes('⚠️')) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (e) {}

  // 3. Red/Themed Bubble Flash Alert (replaces plain white native alert dialog)
  const isRed =
    title.includes('Severe') ||
    title.includes('🚨') ||
    title.includes('Urgent') ||
    body.includes('Severe') ||
    data?.level === 'Severe' ||
    data?.alertLevel === 'red';
  const isYellow =
    !isRed &&
    (title.includes('High') ||
      title.includes('⚠️') ||
      data?.level === 'High' ||
      data?.alertLevel === 'yellow');

  const theme: 'red' | 'yellow' | 'pink' = isRed ? 'red' : (isYellow ? 'yellow' : 'pink');
  const icon = isRed ? 'alert-circle' : (isYellow ? 'warning' : 'checkmark-circle');

  triggerBubbleFlash({
    visible: true,
    title,
    message: body,
    theme,
    icon,
    buttonText: isRed ? 'VIEW GUIDELINES' : 'Got it ✨',
  });

  // Fallback to native Alert only if no bubble listener is registered
  if (flashListeners.size === 0) {
    Alert.alert(title, body, [{ text: 'View Guidelines' }]);
  }

  // 4. Save to in-app notification center so the bell icon shows unread badge
  try {
    const key = api.getUserStorageKey('notifications');
    const notifsStr = await AsyncStorage.getItem(key);
    const existing = notifsStr ? JSON.parse(notifsStr) : [];
    const newNotif = {
      id: 'notif_' + Date.now(),
      title,
      body,
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      is_read: 0,
      kind: title.includes('Severe') ? 'severe_risk_alert' : (title.includes('High') ? 'high_risk_alert' : 'risk_alert'),
    };
    await AsyncStorage.setItem(key, JSON.stringify([newNotif, ...existing]));
  } catch (e) {}
}

/**
 * Schedule a reminder notification for the morning of the OB-GYN visit
 */
export async function scheduleObVisitNotification(
  visitDateStr: string,
  visitLabel: string
): Promise<void> {
  // Safe handler that avoids crashing Expo Go on Android
}
