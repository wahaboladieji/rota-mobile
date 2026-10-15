import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { apiRequest } from '../../services/api';
import { ArrowLeftIcon, ClockIcon } from '../../components/ReviewIcons';

interface PaymentPendingScreenProps {
  teamId: string;
  paymentAttemptId: string;
  onVerified: () => void;
  onGoHome: () => void;
  onBack: () => void;
}

export const PaymentPendingScreen: React.FC<PaymentPendingScreenProps> = ({
  teamId,
  paymentAttemptId,
  onVerified,
  onGoHome,
  onBack,
}) => {
  const { colors } = useTheme();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      const response = await apiRequest<{
        teamId: string;
        subscription: { status: string };
      }>(`/api/teams/${teamId}/billing`, {
        method: 'GET',
        requiresAuth: true,
      });

      if (response.subscription?.status === 'ACTIVE') {
        onVerified();
      } else {
        setStatusMessage('Payment status is still pending verification. Please wait a moment.');
      }
    } catch {
      setStatusMessage('Unable to reach server to check payment status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header with back button */}
      <View style={[styles.header, { borderBottomColor: colors.surfaceContainerLow }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.iconButton,
            { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
          ]}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <ArrowLeftIcon color={colors.onSurface} size={18} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>
          Payment awaiting verification
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Empty / Pending hero (r-empty) */}
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <ClockIcon color={colors.onPrimaryContainer} size={28} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Awaiting confirmation</Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Your payment has not been verified yet. Your current access stays unchanged.
          </Text>
        </View>

        {statusMessage ? (
          <View
            style={[
              styles.statusBox,
              {
                backgroundColor: colors.surfaceContainerLow,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        {/* Buttons stack */}
        <View style={styles.stack}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              checking && { opacity: 0.7 },
            ]}
            onPress={handleCheckStatus}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Check payment status
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
            onPress={onGoHome}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.smallNote, { color: colors.onSurfaceVariant }]}>
          Returning from checkout does not confirm payment.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...titleMediumText,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    ...titleLargeText,
    alignSelf: 'stretch',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  statusBox: {
    padding: 14,
    borderRadius: 12,
    marginVertical: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    textAlign: 'center',
  },
  stack: {
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  smallNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
