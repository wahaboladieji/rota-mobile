import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { BillingOverviewResponse } from '@rota/shared';
import { ArrowLeftIcon, InfoIcon, XIcon } from '../../components/ReviewIcons';

interface BillingOverviewScreenProps {
  billingData: BillingOverviewResponse;
  onChangePlan: () => void;
  onReviewExtraSeats: () => void;
  onCancelSubscription?: () => Promise<void> | void;
  onResumeSubscription?: () => Promise<void> | void;
  onBack: () => void;
}

export const BillingOverviewScreen: React.FC<BillingOverviewScreenProps> = ({
  billingData,
  onChangePlan,
  onReviewExtraSeats,
  onCancelSubscription,
  onResumeSubscription,
  onBack,
}) => {
  const { colors } = useTheme();
  const { plan, subscription, teamName } = billingData;
  const [actionLoading, setActionLoading] = useState(false);
  const [isCancelledNoticeDismissed, setIsCancelledNoticeDismissed] = useState(false);

  const basePriceFormatted = `$${(plan.basePriceCents / 100).toFixed(0)}`;
  const nextRenewalFormatted = `$${(subscription.nextRenewalAmountCents / 100).toFixed(2)} / month`;

  const renewalDateFormatted = subscription.periodEnd
    ? new Date(subscription.periodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  const graceEndDateFormatted = subscription.graceEndAt
    ? new Date(subscription.graceEndAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isPendingInitial = subscription.status === 'PENDING_INITIAL_PAYMENT';
  const isGrace = subscription.status === 'GRACE';
  const isRestricted = subscription.status === 'RESTRICTED';
  const isActive = subscription.status === 'ACTIVE';
  const isCancelled = subscription.pendingPlanCode === 'CANCELLED';

  const statusLabel = isCancelled
    ? 'Cancelling at period end'
    : isActive
    ? 'Verified active'
    : isPendingInitial
    ? 'Payment required'
    : isGrace
    ? 'Payment overdue'
    : 'Access restricted';

  const handleCancelPress = () => {
    Alert.alert(
      'Cancel Subscription?',
      `Your subscription will remain active until ${renewalDateFormatted}. After that date, your schedule will become read-only and no further renewal payments will be charged.`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            if (!onCancelSubscription) return;
            try {
              setActionLoading(true);
              await onCancelSubscription();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel subscription');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResumePress = async () => {
    if (!onResumeSubscription) return;
    try {
      setActionLoading(true);
      await onResumeSubscription();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to resume subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveCancellationNotice = () => {
    Alert.alert(
      'Remove Cancellation?',
      'Would you like to keep your subscription and resume automatic renewal, or dismiss this notice?',
      [
        { text: 'Keep Subscription', onPress: handleResumePress },
        { text: 'Dismiss Notice', onPress: () => setIsCancelledNoticeDismissed(true) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Billing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Billing</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>{teamName}</Text>

        {/* Cancellation Notice Banner */}
        {isCancelled && !isCancelledNoticeDismissed && (
          <View
            style={[
              styles.statusNoticeBox,
              {
                backgroundColor: colors.error98 || 'hsl(7, 100%, 98%)',
                borderColor: colors.error || '#BA1A1A',
                borderWidth: 1,
              },
            ]}
          >
            <InfoIcon color={colors.error || '#BA1A1A'} size={20} />
            <View style={styles.noticeTextContainer}>
              <View style={styles.noticeHeaderRow}>
                <Text style={[styles.noticeTitle, { color: colors.onSurface, flex: 1 }]}>
                  Cancellation scheduled
                </Text>
                <TouchableOpacity
                  onPress={handleRemoveCancellationNotice}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.cancelIconButton}
                  accessibilityLabel="Remove cancellation notice"
                  activeOpacity={0.7}
                >
                  <XIcon color={colors.error || '#BA1A1A'} size={18} />
                </TouchableOpacity>
              </View>
              <Text
                style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}
                numberOfLines={2}
              >
                Access remains active until {renewalDateFormatted}. After this date, your schedule switches to read-only with no further charges.
              </Text>
            </View>
          </View>
        )}

        {/* Pending Initial Payment Banner */}
        {isPendingInitial && (
          <View style={[styles.statusNoticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
            <InfoIcon color={colors.primary} size={20} />
            <View style={styles.noticeTextContainer}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Initial payment required</Text>
              <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                Complete initial payment to unlock shift publishing, swap approvals, and team invitations.
              </Text>
            </View>
          </View>
        )}

        {/* Grace Period Banner */}
        {isGrace && (
          <View style={[styles.statusNoticeBox, { backgroundColor: '#FFEDEA', borderColor: '#BA1A1A' }]}>
            <InfoIcon color="#BA1A1A" size={20} />
            <View style={styles.noticeTextContainer}>
              <Text style={[styles.noticeTitle, { color: '#BA1A1A' }]}>Payment overdue</Text>
              <Text style={[styles.noticeBody, { color: '#410002' }]}>
                Renewal failed. Grace period active until {graceEndDateFormatted || '7 days'}. Please settle payment to prevent team disruption.
              </Text>
            </View>
          </View>
        )}

        {/* Restricted Access Banner */}
        {isRestricted && (
          <View style={[styles.statusNoticeBox, { backgroundColor: '#FFEDEA', borderColor: '#BA1A1A' }]}>
            <InfoIcon color="#BA1A1A" size={20} />
            <View style={styles.noticeTextContainer}>
              <Text style={[styles.noticeTitle, { color: '#BA1A1A' }]}>Subscription restricted</Text>
              <Text style={[styles.noticeBody, { color: '#410002' }]}>
                Grace period ended. Shifts and schedules are currently read-only. Settle renewal payment to restore scheduling capabilities.
              </Text>
            </View>
          </View>
        )}

        {/* Current Plan Card (r-card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              marginTop: isCancelled || isPendingInitial || isGrace || isRestricted ? 16 : 0,
            },
          ]}
        >
          <View style={styles.planHeaderRow}>
            <Text style={[styles.planTitle, { color: colors.onSurface }]}>{plan.name}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isCancelled
                    ? colors.surfaceContainerHigh || '#E5E1E6'
                    : isActive
                    ? colors.primaryContainer
                    : colors.surfaceContainerLow,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isCancelled
                      ? colors.onSurfaceVariant
                      : isActive
                      ? colors.onPrimaryContainer
                      : colors.onSurfaceVariant,
                  },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.priceAmount, { color: colors.onSurface }]}>
              {basePriceFormatted}
            </Text>
            <Text style={[styles.priceInterval, { color: colors.onSurfaceVariant }]}>
              {' '}/ month
            </Text>
          </View>

          <Text style={[styles.planSub, { color: colors.onSurfaceVariant }]}>
            {plan.includedSeats} included seats ·{' '}
            {plan.extraSeatCents
              ? `$${(plan.extraSeatCents / 100).toFixed(0)}/seat above ${plan.includedSeats}`
              : 'No additional seats (Capped at 5)'}
          </Text>
        </View>

        {/* KV Details Card (r-card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              marginTop: 16,
            },
          ]}
        >
          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Active members</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {subscription.activeMemberCount}
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
              Pending reservations
            </Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {subscription.pendingReservationCount}
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
              Paid seat entitlement
            </Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {subscription.paidSeatEntitlement}
            </Text>
          </View>

          {/* Next Renewal Date Row */}
          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
              {isCancelled ? 'Access ends on' : 'Next renewal date'}
            </Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {renewalDateFormatted}
            </Text>
          </View>

          {/* Next Renewal Amount Row */}
          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Next renewal amount</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {isCancelled ? '$0.00 (Cancelled)' : nextRenewalFormatted}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionStack}>
          {isPendingInitial ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onChangePlan}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Proceed to checkout
              </Text>
            </TouchableOpacity>
          ) : isGrace || isRestricted ? (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={onChangePlan}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Settle renewal payment
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
                onPress={onChangePlan}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Change plan
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={onChangePlan}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Choose or change plan
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
                onPress={onReviewExtraSeats}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  {plan.code === 'STARTER' ? 'Manage seats (5 seat cap)' : 'Review additional seats'}
                </Text>
              </TouchableOpacity>

              {/* Cancel or Resume Subscription */}
              {isCancelled ? (
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: colors.primaryContainer,
                      borderColor: colors.primary,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleResumePress}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={colors.onPrimaryContainer} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimaryContainer }]}>
                      Keep subscription
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={handleCancelPress}
                  disabled={actionLoading}
                  activeOpacity={0.7}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={colors.error || '#BA1A1A'} />
                  ) : (
                    <Text style={[styles.secondaryButtonText, { color: colors.error || '#BA1A1A' }]}>
                      Cancel subscription
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
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
    marginBottom: 16,
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cancelIconButton: {
    padding: 2,
    marginLeft: 8,
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
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 6,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  priceInterval: {
    fontSize: 14,
    fontWeight: '500',
  },
  planSub: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
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
