import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { PlanCode, PLANS } from '@rota/shared';

interface PlanSelectionScreenProps {
  selectedPlan: PlanCode;
  onSelectPlan: (plan: PlanCode) => void;
  onContinue: (plan: PlanCode) => void;
  onBack: () => void;
}

// Checkmark vector icon
const CheckIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.35,
        height: size * 0.7,
        borderBottomWidth: 2.2,
        borderRightWidth: 2.2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -2,
      }}
    />
  </View>
);

const ArrowLeftIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size * 0.7, height: 2, backgroundColor: color }} />
    <View
      style={{
        position: 'absolute',
        left: 2,
        width: size * 0.4,
        height: size * 0.4,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

export const PlanSelectionScreen: React.FC<PlanSelectionScreenProps> = ({
  selectedPlan,
  onSelectPlan,
  onContinue,
  onBack,
}) => {
  const { colors } = useTheme();

  const planOptions: Array<{
    code: PlanCode;
    name: string;
    price: number;
    seats: number;
    extra: string;
  }> = [
    {
      code: 'STARTER',
      name: 'Starter',
      price: 20,
      seats: 5,
      extra: 'No additional seats',
    },
    {
      code: 'TEAM',
      name: 'Team',
      price: 50,
      seats: 15,
      extra: '$3/month per seat above 15',
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      price: 120,
      seats: 40,
      extra: '$2/month per seat above 40',
    },
  ];

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Choose a plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Choose your plan.</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Monthly pricing. Every active role counts as a seat.
        </Text>

        {/* Plans stack (r-stack) */}
        <View style={styles.stack}>
          {planOptions.map((item) => {
            const isSelected = selectedPlan === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                onPress={() => onSelectPlan(item.code)}
                activeOpacity={0.85}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isSelected
                      ? colors.primaryContainer
                      : colors.surfaceContainerLowest,
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.planName,
                      {
                        color: isSelected ? colors.onPrimaryContainer : colors.onSurface,
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {isSelected && (
                    <View
                      style={[
                        styles.checkCircle,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <CheckIcon color={colors.onPrimary} size={14} />
                    </View>
                  )}
                </View>

                <View style={styles.priceRow}>
                  <Text
                    style={[
                      styles.priceText,
                      {
                        color: isSelected ? colors.onPrimaryContainer : colors.onSurface,
                      },
                    ]}
                  >
                    ${item.price}
                  </Text>
                  <Text
                    style={[
                      styles.priceInterval,
                      {
                        color: isSelected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {' '}/ month
                  </Text>
                </View>

                <Text
                  style={[
                    styles.planSeats,
                    {
                      color: isSelected ? colors.onPrimaryContainer : colors.onSurface,
                    },
                  ]}
                >
                  {item.seats} included seats
                </Text>

                <Text
                  style={[
                    styles.planExtra,
                    {
                      color: isSelected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {item.extra}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => onContinue(selectedPlan)}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            Review {PLANS[selectedPlan]?.name || selectedPlan} plan
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
  stack: {
    gap: 16,
  },
  planCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    marginBottom: 6,
  },
  priceText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  priceInterval: {
    fontSize: 14,
    fontWeight: '500',
  },
  planSeats: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  planExtra: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
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
