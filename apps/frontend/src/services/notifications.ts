import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Safe dynamic loaders for native modules to avoid crashing if APK build lacks them
let Device: typeof import('expo-device') | null = null;
try {
  Device = require('expo-device');
} catch (e) {
  console.warn('[Notifications] ExpoDevice native module unavailable:', e);
}

let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('[Notifications] ExpoNotifications native module unavailable:', e);
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) {
    console.warn('[Notifications] Notifications module not available in this build');
    return null;
  }

  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2B5BB8',
        enableLights: true,
        enableVibrate: true,
      });
    }

    if (Device && !Device.isDevice) {
      console.log('[Notifications] Must use a physical device for remote push notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Push notification permission not granted');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '3457e4dc-bb18-400c-b23c-80a13a872eb5';

    const pushTokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    token = pushTokenResult.data;
    console.log('[Notifications] Expo Push Token generated:', token);
  } catch (error) {
    console.warn('[Notifications] Error registering for push notifications:', error);
  }

  return token;
}

export function isNotificationsModuleAvailable(): boolean {
  return Notifications !== null;
}

export function isDeviceModuleAvailable(): boolean {
  return Device !== null;
}

export function generateSimulatedPushToken(seed: string): string {
  // Generates a mock ExponentPushToken for testing the backend pipeline before EAS rebuild
  const hash = Math.abs(seed.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)).toString(36);
  return `ExponentPushToken[dev_${hash.padEnd(22, 'x')}]`;
}

