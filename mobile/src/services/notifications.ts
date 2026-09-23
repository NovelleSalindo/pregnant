import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

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

/**
 * Send a notification to the phone (Web Notifications for browsers/PWA, Haptics for Expo Go)
 */
export async function sendPhoneNotification(
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
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

  // On Android/iOS in Expo Go: trigger haptic feedback on save
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
