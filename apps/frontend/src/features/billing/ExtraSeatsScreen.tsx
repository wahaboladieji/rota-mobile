import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { BillingOverviewResponse } from '@rota/shared';
import { ArrowLeftIcon, InfoIcon, PlusIcon, MinusIcon } from '../../components/ReviewIcons';
import { apiRequest } from '../../services/api';

interface ExtraSeatsScreenProps {
  billingData: BillingOverviewResponse;
  teamId: string;
  onBack: () => void;
  onChangePlan?: () => void;
  onProceedToCheckout: (targetSeats: number) => void;
}

interface SeatQuoteResponse {
  periodDays?: number;
  remainingDays?: number;
  dueNowCents: number;
  unusedCreditCents: number;
  refundCents: number;
  currentPeriodPaidSeats: number;
  nextRenewalCents: number;
}

export const ExtraSeatsScreen: React.FC<ExtraSeatsScreenProps> = ({
  billingData,
  teamId,
  onBack,
  onChangePlan,
  onProceedToCheckout,
}) => {
  const { colors } = useTheme();
  const { plan, subscription } = billingData;

  const isStarter = plan.code === 'STARTER';
  const minSeats = Math.max(subscription.paidSeatEntitlement + 1, plan.includedSeats + 1);
  const [targetSeats, setTargetSeats] = useState<number>(minSeats);

  const [quote, setQuote] = useState<SeatQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Fetch real-time proration quote whenever targetSeats changes (for Team & Business)
  useEffect(() => {
    if (isStarter) return;

    let isMounted = true;
    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const result = await apiRequest<SeatQuoteResponse>(
          `/api/teams/${teamId}/billing/quote-seats`,
          {
            method: 'POST',
            requiresAuth: true,
            body: JSON.stringify({ targetSeats }),
          }
        );
        if (isMounted) {
          setQuote(result);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setQuoteError(err instanceof Error ? err.message : 'Failed to calculate quote');
        }
      } finally {
        if (isMounted) {
          setQuoteLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      isMounted = false;
    };
  }, [teamId, targetSeats, isStarter]);

  const handleIncrement = () => {
    if (targetSeats < 100) {
      setTargetSeats((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (targetSeats > minSeats) {
      setTargetSeats((prev) => prev - 1);
    }
  };

  // 1. STARTER PLAN (D5 Rule: No additional seats allowed, strictly capped at 5)
  if (isStarter) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Additional seats</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Additional seats</Text>
          <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
            Starter plan seat capacity limit
          </Text>

          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: colors.surfaceContainerLow,
                borderColor: colors.outlineVariant,
                borderWidth: 1,
              },
            ]}
          >
            <InfoIcon color={colors.primary} size={22} />
            <View style={styles.noticeTextContainer}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                Starter plan has a 5-seat limit
              </Text>
              <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                Under Rota’s plan rules, the Starter plan ($20/month) includes 5 seats and does not support purchasing additional seats.
                {'\n\n'}
                To invite more than 5 members, please upgrade to the <Text style={{ fontWeight: '700' }}>Team plan</Text> (15 included seats, $3/seat above) or <Text style={{ fontWeight: '700' }}>Business plan</Text> (40 included seats, $2/seat above).
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, marginTop: 16 }]}>
            <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Current plan</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>Starter ($20/mo)</Text>
            </View>
            <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Included seats</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>5 seats (Maximum)</Text>
            </View>
            <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Active members</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>
                {subscription.activeMemberCount} of 5 used
              </Text>
            </View>
          </View>

          <View style={styles.actionStack}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onChangePlan}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Upgrade to Team or Business
              </Text>
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
                Back to billing
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2. TEAM & BUSINESS PLANS (Supports purchasing extra seats with real-time proration quote)
  const extraSeatPriceFormatted = plan.extraSeatCents
    ? `$${(plan.extraSeatCents / 100).toFixed(0)}`
    : '$0';
  const extraSeatsCount = Math.max(0, targetSeats - plan.includedSeats);
  const seatsAddedNow = Math.max(0, targetSeats - subscription.paidSeatEntitlement);

  const dueNowFormatted = quote
    ? `$${(quote.dueNowCents / 100).toFixed(2)}`
    : '$0.00';

  const nextRenewalFormatted = quote
    ? `$${(quote.nextRenewalCents / 100).toFixed(2)} / month`
    : `$${(subscription.nextRenewalAmountCents / 100).toFixed(2)} / month`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Additional seats</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Additional seats</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          {plan.name} includes {plan.includedSeats} seats. Extra seats are {extraSeatPriceFormatted}/month each.
        </Text>

        {/* Seat Stepper Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.stepperLabel, { color: colors.onSurfaceVariant }]}>
            Choose total team seat capacity
          </Text>

          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperButton,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  opacity: targetSeats <= minSeats ? 0.4 : 1,
                },
              ]}
              onPress={handleDecrement}
              disabled={targetSeats <= minSeats}
              activeOpacity={0.7}
              accessibilityLabel="Decrease seats"
            >
              <MinusIcon color={colors.onSurface} size={20} />
            </TouchableOpacity>

            <View style={styles.stepperDisplay}>
              <Text style={[styles.stepperCount, { color: colors.onSurface }]}>{targetSeats}</Text>
              <Text style={[styles.stepperSubtext, { color: colors.onSurfaceVariant }]}>
                +{seatsAddedNow} additional ({extraSeatsCount} above included)
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.stepperButton, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={handleIncrement}
              activeOpacity={0.7}
              accessibilityLabel="Increase seats"
            >
              <PlusIcon color={colors.onSurface} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Proration Quote Details Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, marginTop: 16 }]}>
          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Current paid capacity</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {subscription.paidSeatEntitlement} seats
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>New total capacity</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface, fontWeight: '700' }]}>
              {targetSeats} seats
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Extra seat rate</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {extraSeatPriceFormatted} / seat / month
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Billing cycle remaining</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {quote ? `${quote.remainingDays} days of ${quote.periodDays} days` : 'Calculating…'}
            </Text>
          </View>

          {/* Prorated Due Today (Highlight row) */}
          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant, fontWeight: '600' }]}>
              Prorated due today
            </Text>
            {quoteLoading ? (
              <View style={styles.calculatingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.calculatingText, { color: colors.onSurfaceVariant }]}>
                  Calculating…
                </Text>
              </View>
            ) : quoteError ? (
              <Text style={[styles.kvValue, { color: colors.error || '#BA1A1A' }]}>
                Calculation error
              </Text>
            ) : (
              <Text style={[styles.kvValueHighlight, { color: colors.primary }]}>
                {dueNowFormatted}
              </Text>
            )}
          </View>

          {/* Next Monthly Renewal */}
          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>New monthly renewal</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {quoteLoading ? '—' : nextRenewalFormatted}
            </Text>
          </View>
        </View>

        {/* Informational Notice */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              marginTop: 16,
            },
          ]}
        >
          <InfoIcon color={colors.onSurfaceVariant} size={18} />
          <View style={styles.noticeTextContainer}>
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Immediate activation</Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              You will be charged the prorated amount of <Text style={{ fontWeight: '700' }}>{dueNowFormatted}</Text> today for the remainder of this billing cycle. Your seat capacity will increase immediately upon payment.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionStack}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: quoteLoading || Boolean(quoteError) ? 0.6 : 1,
              },
            ]}
            onPress={() => onProceedToCheckout(targetSeats)}
            disabled={quoteLoading || Boolean(quoteError)}
            activeOpacity={0.8}
          >
            {quoteLoading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Proceed to checkout · {dueNowFormatted}
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
              Back to billing
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
    paddingTop: 20,
    paddingBottom: 32,
  },
  heading: {
    ...titleLargeText,
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  stepperLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stepperSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  kvLabel: {
    fontSize: 14,
  },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  kvValueHighlight: {
    fontSize: 18,
    fontWeight: '800',
  },
  calculatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calculatingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionStack: {
    gap: 12,
    marginTop: 24,
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
