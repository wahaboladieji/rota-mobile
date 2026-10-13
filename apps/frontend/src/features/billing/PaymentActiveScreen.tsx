import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText } from '../../theme';
import { PlanCode, PLANS } from '@rota/shared';

interface PaymentActiveScreenProps {
  plan: PlanCode;
  onGoHome: () => void;
}

const CircleCheckIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 32 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2.2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: size * 0.35,
        height: size * 0.65,
        borderBottomWidth: 2.5,
        borderRightWidth: 2.5,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -3,
      }}
    />
  </View>
);

export const PaymentActiveScreen: React.FC<PaymentActiveScreenProps> = ({ plan, onGoHome }) => {
  const { colors } = useTheme();
  const planDef = PLANS[plan] || PLANS.STARTER;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Hero (r-empty) */}
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
          <Text style={[styles.title, { color: colors.onSurface }]}>Your plan is active</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            The server verified payment and updated your team’s subscription.
          </Text>
        </View>

        {/* Plan card (r-card) */}
        <View
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.planTitle, { color: colors.onSurface }]}>{planDef.name}</Text>
          <Text style={[styles.planDetails, { color: colors.onSurfaceVariant }]}>
            ${planDef.basePriceCents / 100}/month · {planDef.includedSeats} included seats
          </Text>
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
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  planDetails: {
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
