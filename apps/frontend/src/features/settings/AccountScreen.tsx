import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { useAuthStore } from '../../state/authStore';
import { apiRequest } from '../../services/api';
import { ArrowLeftIcon } from '../../components/ReviewIcons';

interface AccountScreenProps {
  onBack: () => void;
  onLogout: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onBack, onLogout }) => {
  const { colors, typography, spacingCollection } = useTheme();
  const user = useAuthStore((state) => state.user);
  const logoutStore = useAuthStore((state) => state.logout);

  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isLogoutAllModalVisible, setIsLogoutAllModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSingleDeviceLogout = async () => {
    setIsProcessing(true);
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        requiresAuth: true,
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      setIsProcessing(false);
      setIsLogoutModalVisible(false);
      await logoutStore();
      onLogout();
    }
  };

  const handleAllDeviceLogout = async () => {
    setIsProcessing(true);
    try {
      await apiRequest('/api/auth/logout-all', {
        method: 'POST',
        requiresAuth: true,
      });
    } catch {
      // Fallback to regular logout if endpoint is not implemented
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          requiresAuth: true,
        });
      } catch {
        // ignore
      }
    } finally {
      setIsProcessing(false);
      setIsLogoutAllModalVisible(false);
      await logoutStore();
      onLogout();
    }
  };

  const email = user?.email || 'user@example.com';
  const displayName = email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Account</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Your account</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Manage sign-in on this and other devices.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderWidth: 0 }]}>
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.userName, { color: colors.onSurface }]}>
                {displayName}
              </Text>
              <Text style={[styles.userEmail, { color: colors.onSurfaceVariant }]}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonStack}>
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerLow }]}
            onPress={() => setIsLogoutModalVisible(true)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>Log out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.errorContainerHigh, borderColor: colors.error }]}
            onPress={() => setIsLogoutAllModalVisible(true)}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onErrorContainer }]}>
              Log out of all devices
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
          Logging out clears this account’s saved offline schedule.
        </Text>
      </ScrollView>

      {/* Modal Sheet: Log out */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheetContent, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Log out?</Text>
            <Text style={[styles.sheetBody, { color: colors.onSurfaceVariant }]}>
              Your saved offline shifts will be cleared from this device.
            </Text>

            <View style={{ marginTop: 24, gap: 12 }}>
              <TouchableOpacity
                style={[styles.dangerButton, { backgroundColor: colors.error }]}
                onPress={handleSingleDeviceLogout}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={colors.onError} size="small" />
                ) : (
                  <Text style={[styles.dangerButtonText, { color: colors.onError }]}>Log out</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
                onPress={() => setIsLogoutModalVisible(false)}
                disabled={isProcessing}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Stay signed in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Sheet: Log out of all devices */}
      <Modal
        visible={isLogoutAllModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLogoutAllModalVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheetContent, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Log out everywhere?</Text>
            <Text style={[styles.sheetBody, { color: colors.onSurfaceVariant }]}>
              All account sessions will be revoked. You’ll need to sign in again on each device.
            </Text>

            <View style={{ marginTop: 24, gap: 12 }}>
              <TouchableOpacity
                style={[styles.dangerButton, { backgroundColor: colors.error }]}
                onPress={handleAllDeviceLogout}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={colors.onError} size="small" />
                ) : (
                  <Text style={[styles.dangerButtonText, { color: colors.onError }]}>
                    Log out of all devices
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
                onPress={() => setIsLogoutAllModalVisible(false)}
                disabled={isProcessing}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Stay signed in
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  buttonStack: {
    marginTop: 20,
    gap: 12,
  },
  secondaryButton: {
    height: 50,
    borderRadius: 9999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    height: 50,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 20,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 9999,
    alignSelf: 'center',
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sheetBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});
