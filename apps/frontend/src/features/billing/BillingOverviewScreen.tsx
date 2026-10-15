import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { BillingOverviewResponse } from '@rota/shared';
import { ArrowLeftIcon } from '../../components/ReviewIcons';

interface BillingOverviewScreenProps {
  billingData: BillingOverviewResponse;
  onChangePlan: () => void;
  onReviewExtraSeats: () => void;
  onBack: () => void;
}

export const BillingOverviewScreen: React.FC<BillingOverviewScreenProps> = ({
  billingData,
  onChangePlan,
  onReviewExtraSeats,
  onBack,
}) => {
  const { colors } = useTheme();
  const { plan, subscription, teamName } = billingData;

  const basePriceFormatted = `$${(plan.basePriceCents / 100).toFixed(0)}`;
  const nextRenewalFormatted = `$${(subscription.nextRenewalAmountCents / 100).toFixed(2)} / month`;

  const statusLabel =
    subscription.status === 'ACTIVE'
      ? 'Verified active'
      : subscription.status === 'PENDING_INITIAL_PAYMENT'
      ? 'Not active'
      : subscription.status === 'GRACE'
      ? 'In grace period'
      : 'Restricted';

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

        {/* Current Plan Card (r-card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.planHeaderRow}>
            <Text style={[styles.planTitle, { color: colors.onSurface }]}>{plan.name}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    subscription.status === 'ACTIVE'
                      ? colors.primaryContainer
                      : colors.surfaceContainerLow,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      subscription.status === 'ACTIVE'
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
              ? `$${plan.extraSeatCents / 100}/seat above ${plan.includedSeats}`
              : 'No additional seats'}
          </Text>
        </View>

        {/* KV Details Card (r-card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
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

          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Next renewal</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {nextRenewalFormatted}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionStack}>
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
              Review additional seats
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
    borderWidth: 1,
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
