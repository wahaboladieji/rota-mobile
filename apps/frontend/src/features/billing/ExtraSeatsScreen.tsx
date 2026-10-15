import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { ArrowLeftIcon, InfoIcon } from '../../components/ReviewIcons';

interface ExtraSeatsScreenProps {
  onBack: () => void;
}

export const ExtraSeatsScreen: React.FC<ExtraSeatsScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();

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
          Additional seats
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Additional seats.</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Team includes 15 seats. Extra active seats cost $3/month each.
        </Text>

        {/* KV Card */}
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
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Included seats</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>15</Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
              Extra seat price
            </Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>$3 / month</Text>
          </View>

          <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
              Prorated due today
            </Text>
            <Text style={[styles.kvValue, { color: colors.onSurfaceVariant }]}>Calculating…</Text>
          </View>
        </View>

        {/* Notice */}
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
              Review your payment
            </Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              Check the prorated amount before changing your paid capacity.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              marginTop: 24,
            },
          ]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
            Back to billing
          </Text>
        </TouchableOpacity>
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
