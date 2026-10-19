import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { PlanCode, PLANS } from '@rota/shared';
import { CircleCheckIcon, CheckIcon, UsersIcon } from '../../components/ReviewIcons';

export interface PaymentActiveScreenProps {
  plan: PlanCode;
  targetSeats?: number;
  previousSeats?: number;
  previousPlanCode?: PlanCode;
  isExtraSeats?: boolean;
  isUpgrade?: boolean;
  onGoHome: () => void;
}

export const PaymentActiveScreen: React.FC<PaymentActiveScreenProps> = ({
  plan,
  targetSeats,
  previousSeats,
  previousPlanCode,
  isExtraSeats,
  isUpgrade,
  onGoHome,
}) => {
  const { colors } = useTheme();
  const planDef = PLANS[plan] || PLANS.STARTER;

  // Determine addition type
  const isAddingSeats = Boolean(
    isExtraSeats ||
      (targetSeats &&
        previousSeats &&
        targetSeats > previousSeats &&
        (!previousPlanCode || previousPlanCode === plan))
  );

  const isPlanUpgrade = Boolean(
    isUpgrade || (previousPlanCode && previousPlanCode !== plan)
  );

  const addedSeatsCount =
    isAddingSeats && targetSeats && previousSeats
      ? Math.max(0, targetSeats - previousSeats)
      : isAddingSeats && targetSeats
      ? Math.max(0, targetSeats - planDef.includedSeats)
      : 0;

  const totalSeats = targetSeats || previousSeats || planDef.includedSeats;
  const extraSeatPrice = planDef.extraSeatCents ? planDef.extraSeatCents / 100 : 0;
  const extraSeatsTotal = Math.max(0, totalSeats - planDef.includedSeats);
  const monthlyRenewalTotal = (planDef.basePriceCents + extraSeatsTotal * (planDef.extraSeatCents || 0)) / 100;

  // Dynamic headlines and copy
  let heroTitle = 'Your plan is active';
  let heroSubtitle = 'The server verified payment and updated your team’s subscription.';
  let badgeLabel = `${planDef.name} Active`;

  if (isAddingSeats) {
    heroTitle = 'Seats added successfully';
    heroSubtitle = `Your team capacity has been increased to ${totalSeats} total seats.`;
    badgeLabel = `+${addedSeatsCount} ${addedSeatsCount === 1 ? 'Seat' : 'Seats'} Added`;
  } else if (isPlanUpgrade) {
    heroTitle = 'Plan upgraded successfully';
    const oldName = previousPlanCode ? PLANS[previousPlanCode]?.name || previousPlanCode : 'previous plan';
    heroSubtitle = `You have upgraded from ${oldName} to ${planDef.name}.`;
    badgeLabel = `Upgraded to ${planDef.name}`;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Hero */}
        <View style={styles.heroContainer}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <CircleCheckIcon color={colors.onPrimaryContainer} size={32} />
          </View>
          <Text style={[styles.title, { color: colors.onSurface }]}>{heroTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {heroSubtitle}
          </Text>
        </View>

        {/* Change summary card */}
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          {/* Badge */}
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>
                {badgeLabel}
              </Text>
            </View>
            <Text style={[styles.planTitle, { color: colors.onSurface }]}>{planDef.name} Plan</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.surfaceContainerHigh }]} />

          {/* Details breakdown */}
          <View style={styles.detailsList}>
            {isAddingSeats ? (
              <>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Additional seats added
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.primary }]}>
                    +{addedSeatsCount} {addedSeatsCount === 1 ? 'seat' : 'seats'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Total team seats
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>
                    {totalSeats} seats ({planDef.includedSeats} included + {extraSeatsTotal} extra)
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Extra seat rate
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>
                    ${extraSeatPrice.toFixed(2)}/mo per extra seat
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    New monthly renewal
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.onSurface }]}>
                    ${monthlyRenewalTotal.toFixed(2)}/month
                  </Text>
                </View>
              </>
            ) : isPlanUpgrade ? (
              <>
                {previousPlanCode ? (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                      Previous plan
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.onSurfaceVariant }]}>
                      {PLANS[previousPlanCode]?.name || previousPlanCode}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    New plan tier
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.primary }]}>
                    {planDef.name}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Included seats
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>
                    {planDef.includedSeats} included seats
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Monthly renewal
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.onSurface }]}>
                    ${(planDef.basePriceCents / 100).toFixed(2)}/month
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Plan
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.onSurface }]}>
                    {planDef.name}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Included seats
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.onSurface }]}>
                    {planDef.includedSeats} included seats
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                    Monthly renewal
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.onSurface }]}>
                    ${(planDef.basePriceCents / 100).toFixed(2)}/month
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Checklist feature bullet */}
          <View
            style={[
              styles.benefitBox,
              {
                backgroundColor: colors.surfaceContainerLow,
              },
            ]}
          >
            <CheckIcon color={colors.primary} size={18} />
            <Text style={[styles.benefitText, { color: colors.onSurfaceVariant }]}>
              {isAddingSeats
                ? 'Your new seats are immediately available to invite team members.'
                : isPlanUpgrade
                ? 'Your new plan features and expanded capacity are active immediately.'
                : 'Team invitations, shift publishing, and schedule management are unlocked.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Button */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onGoHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    alignItems: 'center',
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...titleLargeText,
    alignSelf: 'stretch',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  planCard: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  detailsList: {
    gap: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValueBold: {
    fontSize: 15,
    fontWeight: '700',
  },
  benefitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  benefitText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
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
});
