import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { PlanCode, PLANS } from '@rota/shared';
import { ArrowLeftIcon, InfoIcon } from '../../components/ReviewIcons';

interface PaymentReviewScreenProps {
  plan: PlanCode;
  onContinueToCheckout: () => void;
  onBack: () => void;
}

export const PaymentReviewScreen: React.FC<PaymentReviewScreenProps> = ({
  plan,
  onContinueToCheckout,
  onBack,
}) => {
  const { colors } = useTheme();
  const planDef = PLANS[plan] || PLANS.STARTER;

  const basePriceFormatted = `$${(planDef.basePriceCents / 100).toFixed(2)}`;
  const extraSeatFormatted =
    planDef.extraSeatCents !== null
      ? `$${(planDef.extraSeatCents / 100).toFixed(2)} / month`
      : 'Not available';

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
          Initial payment review
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Review your plan.</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Selected plan: {planDef.name}
        </Text>

        {/* KV Breakdown Card (r-card) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Monthly base</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {basePriceFormatted}
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Included seats</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {planDef.includedSeats}
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Additional seats</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {extraSeatFormatted}
            </Text>
          </View>

          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Due today</Text>
            <Text
              style={[
                styles.kvValue,
                { color: colors.primary, fontSize: 16, fontWeight: '700' },
              ]}
            >
              {basePriceFormatted}
            </Text>
          </View>
        </View>

        {/* Notice (r-notice) */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              marginTop: 24,
            },
          ]}
        >
          <InfoIcon color={colors.onSurfaceVariant} size={18} />
          <View style={styles.noticeTextContainer}>
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
              Payment verification
            </Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              Your team’s paid access is established after the server verifies payment.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onContinueToCheckout}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            Continue to test checkout
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 24,
  },
  heading: {
    ...titleLargeText,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  card: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  kvLabel: {
    fontSize: 14,
  },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
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
