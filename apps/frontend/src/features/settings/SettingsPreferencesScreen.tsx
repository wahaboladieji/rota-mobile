import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
} from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { ChevronRightIcon, BellIcon, SunMoonIcon, LanguagesIcon, MoonIcon, InfoIcon, ArrowLeftIcon } from '../../components/ReviewIcons';
import { registerForPushNotificationsAsync, isNotificationsModuleAvailable, generateSimulatedPushToken } from '../../services/notifications';
import { sendTestNotificationApi, registerPushTokenApi } from '../../services/api';
import { useAuthStore } from '../../state/authStore';

interface SettingsPreferencesScreenProps {
  onBack: () => void;
}

type SettingsSubView = 'SETTINGS_MAIN' | 'NOTIFICATIONS' | 'QUIET_HOURS' | 'APPEARANCE' | 'LANGUAGE';

export const SettingsPreferencesScreen: React.FC<SettingsPreferencesScreenProps> = ({ onBack }) => {
  const { colors, typography, spacingCollection } = useTheme();

  const [subView, setSubView] = useState<SettingsSubView>('SETTINGS_MAIN');

  // Push token and test state
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isRegisteringToken, setIsRegisteringToken] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
      }
    });
  }, []);

  // Preferences state
  const [shiftChangesEnabled, setShiftChangesEnabled] = useState(true);
  const [swapRequestsEnabled, setSwapRequestsEnabled] = useState(true);
  const [billingAlertsEnabled, setBillingAlertsEnabled] = useState(false);

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [timeZone, setTimeZone] = useState('Africa/Lagos');

  const [themePreference, setThemePreference] = useState<'SYSTEM' | 'LIGHT' | 'DARK'>('LIGHT');

  // Render Subviews
  if (subView === 'APPEARANCE') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSubView('SETTINGS_MAIN')}
            style={styles.backButton}
            accessibilityLabel="Back to settings"
          >
            <ArrowLeftIcon color={colors.onSurface} size={20} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Appearance</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Appearance</Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Choose how Rota follows your device.
          </Text>

          <View style={[styles.listGroup, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
            <TouchableOpacity
              style={[styles.listRow, { borderBottomColor: colors.outlineVariant }]}
              onPress={() => setThemePreference('SYSTEM')}
            >
              <SunMoonIcon color={colors.primary} size={20} />
              <View style={styles.listTextCol}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>System</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  Use device appearance
                </Text>
              </View>
              {themePreference === 'SYSTEM' && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.listRow, { borderBottomColor: colors.outlineVariant }]}
              onPress={() => setThemePreference('LIGHT')}
            >
              <SunMoonIcon color={colors.primary} size={20} />
              <View style={styles.listTextCol}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>Light</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  Light surfaces and blue actions
                </Text>
              </View>
              {themePreference === 'LIGHT' && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listRow}
              onPress={() => setThemePreference('DARK')}
            >
              <MoonIcon color={colors.primary} size={20} />
              <View style={styles.listTextCol}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>Dark</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  Dark appearance (light palette active)
                </Text>
              </View>
              {themePreference === 'DARK' && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
            </TouchableOpacity>
          </View>

          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <InfoIcon color={colors.primary} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Palette token policy</Text>
              <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                Design review notes: Dark design is guarded pending complete high-contrast palette token approval. Light theme is standard.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (subView === 'LANGUAGE') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSubView('SETTINGS_MAIN')}
            style={styles.backButton}
            accessibilityLabel="Back to settings"
          >
            <ArrowLeftIcon color={colors.onSurface} size={20} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Language</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Language</Text>

          <View style={[styles.listGroup, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.listRow}>
              <Text style={{ color: colors.primary, fontWeight: '800', marginRight: 12 }}>✓</Text>
              <View style={styles.listTextCol}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>English</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>Selected</Text>
              </View>
            </View>
          </View>

          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginTop: 16 }]}>
            <InfoIcon color={colors.primary} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>D6 Status</Text>
              <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                D6 open question: Second language is not yet chosen or translated by Product Lead. English remains the active baseline.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (subView === 'QUIET_HOURS') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSubView('NOTIFICATIONS')}
            style={styles.backButton}
            accessibilityLabel="Back to notifications"
          >
            <ArrowLeftIcon color={colors.onSurface} size={20} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Quiet hours</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Quiet hours</Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Delay non-urgent notifications during these hours.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Quiet hours</Text>
              <Switch
                value={quietHoursEnabled}
                onValueChange={setQuietHoursEnabled}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              />
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Start</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
                value={quietStart}
                onChangeText={setQuietStart}
                placeholder="22:00"
              />
            </View>
            <View style={styles.gridCol}>
              <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>End</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
                value={quietEnd}
                onChangeText={setQuietEnd}
                placeholder="07:00"
              />
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Time zone</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
              value={timeZone}
              onChangeText={setTimeZone}
              placeholder="Africa/Lagos"
            />
            <Text style={[styles.helpText, { color: colors.onSurfaceVariant }]}>
              Use a valid IANA time zone.
            </Text>
          </View>

          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginTop: 16 }]}>
            <InfoIcon color={colors.primary} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Urgent shift changes</Text>
              <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                Changes, cancellations and swap decisions for shifts starting within 12 hours may bypass quiet hours. Disabled groups stay off.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={() => setSubView('NOTIFICATIONS')}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Save preferences</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (subView === 'NOTIFICATIONS') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setSubView('SETTINGS_MAIN')}
            style={styles.backButton}
            accessibilityLabel="Back to settings"
          >
            <ArrowLeftIcon color={colors.onSurface} size={20} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Notifications</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Notifications</Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Choose the updates you receive.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <View style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, paddingBottom: 14 }]}>
              <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Shift changes</Text>
              <Switch
                value={shiftChangesEnabled}
                onValueChange={setShiftChangesEnabled}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              />
            </View>

            <View style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, paddingVertical: 14 }]}>
              <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Swap requests and decisions</Text>
              <Switch
                value={swapRequestsEnabled}
                onValueChange={setSwapRequestsEnabled}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              />
            </View>

            <View style={[styles.toggleRow, { paddingTop: 14 }]}>
              <Text style={[styles.toggleLabel, { color: colors.onSurface }]}>Billing alerts</Text>
              <Switch
                value={billingAlertsEnabled}
                onValueChange={setBillingAlertsEnabled}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              />
            </View>
          </View>

          <View style={[styles.listGroup, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginTop: 16 }]}>
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => setSubView('QUIET_HOURS')}
            >
              <MoonIcon color={colors.primary} size={20} />
              <View style={styles.listTextCol}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>Quiet hours</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  {quietHoursEnabled ? `${quietStart}–${quietEnd} · ${timeZone}` : 'Off'}
                </Text>
              </View>
              <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
            </TouchableOpacity>
          </View>

          {/* Remote Push Notification Device Card */}
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, marginTop: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <BellIcon color={colors.primary} size={20} />
              <Text style={[styles.listTitle, { color: colors.onSurface, marginLeft: 10 }]}>
                Expo Push Notifications
              </Text>
            </View>

            {!isNotificationsModuleAvailable() && (
              <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginBottom: 14 }]}>
                <InfoIcon color={colors.primary} size={18} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Native Module Not in this APK</Text>
                  <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                    This APK was built before expo-notifications was added. A fresh EAS build is required to receive system-tray push notifications. You can use the development token below to test the backend API now.
                  </Text>
                </View>
              </View>
            )}

            {expoPushToken ? (
              <>
                <Text style={[styles.footnote, { color: colors.onSurfaceVariant, marginBottom: 8 }]}>
                  Registered Push Token:
                </Text>
                <View style={{ backgroundColor: colors.surfaceContainerLow, padding: 12, borderRadius: 12, marginBottom: 14 }}>
                  <Text style={{ fontFamily: 'monospace', fontSize: 11, color: colors.onSurface }} numberOfLines={3} selectable>
                    {expoPushToken}
                  </Text>
                </View>

                {testPushStatus && (
                  <View style={[styles.noticeBox, { backgroundColor: colors.primaryContainer, borderColor: colors.primary, marginBottom: 14 }]}>
                    <Text style={{ color: colors.onPrimaryContainer, fontSize: 13, fontWeight: '600' }}>
                      {testPushStatus}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSendingTestPush ? 0.7 : 1 }]}
                  disabled={isSendingTestPush}
                  onPress={async () => {
                    setIsSendingTestPush(true);
                    setTestPushStatus(null);
                    try {
                      const res = await sendTestNotificationApi(expoPushToken);
                      setTestPushStatus('✓ Test notification dispatched by backend to Expo Push Service!');
                    } catch (err: unknown) {
                      setTestPushStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setIsSendingTestPush(false);
                    }
                  }}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {isSendingTestPush ? 'Dispatching...' : 'Send Test Push Notification'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View>
                <Text style={[styles.footnote, { color: colors.onSurfaceVariant, marginBottom: 12 }]}>
                  {isRegisteringToken ? 'Requesting push token from Expo...' : 'Generate or simulate a push token to register this device with the server.'}
                </Text>

                {isNotificationsModuleAvailable() ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    disabled={isRegisteringToken}
                    onPress={async () => {
                      setIsRegisteringToken(true);
                      setTestPushStatus(null);
                      const token = await registerForPushNotificationsAsync();
                      setIsRegisteringToken(false);
                      if (token) {
                        setExpoPushToken(token);
                        await registerPushTokenApi(token).catch((err) => {
                          setTestPushStatus(`Registered locally, backend error: ${err.message}`);
                        });
                      } else {
                        setTestPushStatus('Failed to retrieve native token. Check device permissions.');
                      }
                    }}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      {isRegisteringToken ? 'Generating...' : 'Generate Push Token'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    disabled={isRegisteringToken}
                    onPress={async () => {
                      setIsRegisteringToken(true);
                      const currentUserId = useAuthStore.getState().user?.id || 'demo-device';
                      const token = generateSimulatedPushToken(currentUserId);
                      setExpoPushToken(token);
                      try {
                        await registerPushTokenApi(token);
                        setTestPushStatus('✓ Development push token registered with backend!');
                      } catch (err: unknown) {
                        setTestPushStatus(`Backend error: ${err instanceof Error ? err.message : String(err)}`);
                      } finally {
                        setIsRegisteringToken(false);
                      }
                    }}
                  >
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      {isRegisteringToken ? 'Registering...' : 'Use Development Push Token'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <Text style={[styles.footnote, { color: colors.onSurfaceVariant, marginTop: 16 }]}>
            Disabled groups remain off, including urgent updates.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // Main Settings View
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <ArrowLeftIcon color={colors.onSurface} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Settings</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Your preferences sync across devices.
        </Text>

        <View style={[styles.listGroup, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
          <TouchableOpacity
            style={[styles.listRow, { borderBottomColor: colors.outlineVariant }]}
            onPress={() => setSubView('NOTIFICATIONS')}
          >
            <BellIcon color={colors.primary} size={20} />
            <View style={styles.listTextCol}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]}>Notifications</Text>
              <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                Groups, quiet hours and time zone
              </Text>
            </View>
            <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.listRow, { borderBottomColor: colors.outlineVariant }]}
            onPress={() => setSubView('APPEARANCE')}
          >
            <SunMoonIcon color={colors.primary} size={20} />
            <View style={styles.listTextCol}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]}>Appearance</Text>
              <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                System, light and dark
              </Text>
            </View>
            <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.listRow}
            onPress={() => setSubView('LANGUAGE')}
          >
            <LanguagesIcon color={colors.primary} size={20} />
            <View style={styles.listTextCol}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]}>Language</Text>
              <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                English
              </Text>
            </View>
            <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.footnote, { color: colors.onSurfaceVariant, marginTop: 16 }]}>
          Preferences refresh when the app opens or returns to the foreground.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...titleMediumText,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageHeading: {
    ...titleLargeText,
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  pageLead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  listGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  listTextCol: {
    flex: 1,
    marginLeft: 14,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  gridCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    height: 50,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
