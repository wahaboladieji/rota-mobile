import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { PlanCode } from '@rota/shared';
import { apiRequest } from '../../services/api';
import { useRateLimitCountdown } from '../../services/useRateLimitCountdown';
import { ArrowLeftIcon, CreditCardIcon } from '../../components/ReviewIcons';

interface CheckoutScreenProps {
  teamId: string;
  plan: PlanCode;
  targetSeats?: number;
  onPaymentSuccess: (paymentAttemptId: string) => void;
  onPaymentPending: (paymentAttemptId: string) => void;
  onBack: () => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  teamId,
  plan,
  targetSeats,
  onPaymentSuccess,
  onPaymentPending,
  onBack,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rateLimit = useRateLimitCountdown('Too many payment attempts initiated for this team. Please try again in');

  const handleSimulatePayment = async () => {
    setLoading(true);
    setErrorMessage(null);

    const idempotencyKey = `pay_init_${teamId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Initiate payment attempt on server
      const initResponse = await apiRequest<{
        paymentAttemptId: string;
        txRef: string;
        amountCents: number;
        currency: string;
        status: string;
        checkoutUrl?: string;
      }>(`/api/teams/${teamId}/payment/initiate`, {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify({
          planCode: plan,
          ...(targetSeats ? { targetSeats } : {}),
          idempotencyKey,
        }),
      });

      // 2. Open Flutterwave hosted payment link in browser if provided
      if (initResponse.checkoutUrl) {
        try {
          await Linking.openURL(initResponse.checkoutUrl);
        } catch (linkErr) {
          console.warn('Could not open external browser link', linkErr);
        }
      }

      // 3. Transition to PaymentPendingScreen (as per AGENTS.md rule 3: never activate directly from client)
      onPaymentPending(initResponse.paymentAttemptId);
    } catch (err: unknown) {
      if (!rateLimit.handleApiError(err)) {
        setErrorMessage(err instanceof Error ? err.message : 'Checkout initiation failed');
      }
    } finally {
      setLoading(false);
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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Checkout handoff</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Empty / Handoff hero (r-empty) */}
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <CreditCardIcon color={colors.onPrimaryContainer} size={28} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Continue to checkout</Text>
          <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
            Complete payment with the selected test provider. Rota will check the result when you
            return.
          </Text>
        </View>

        {/* Provider details card (r-card) */}
        <View
          style={[
            styles.providerCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.providerName, { color: colors.onSurface }]}>
            Flutterwave · Test mode
          </Text>
          <Text style={[styles.providerDesc, { color: colors.onSurfaceVariant }]}>
            Payment details are entered on the provider’s checkout.
          </Text>
        </View>

        {rateLimit.isRateLimited || errorMessage ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.errorContainer,
                borderColor: colors.error,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
              {rateLimit.isRateLimited ? rateLimit.formattedMessage : errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Buttons stack */}
        <View style={styles.stack}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              (loading || rateLimit.isRateLimited) && { opacity: 0.7 },
            ]}
            onPress={handleSimulatePayment}
            disabled={loading || rateLimit.isRateLimited}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {rateLimit.isRateLimited
                  ? `Try again in ${rateLimit.secondsRemaining}s`
                  : 'Proceed to Flutterwave Checkout'}
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
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
              Back to review
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 24,
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
  providerCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  providerDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  stack: {
    gap: 12,
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
});
