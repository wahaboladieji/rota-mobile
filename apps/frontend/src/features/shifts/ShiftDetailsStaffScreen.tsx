import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, titleMediumText } from '../../theme';
import { ArrowLeftIcon, Repeat2Icon, InfoIcon, WifiOffIcon } from '../../components/ReviewIcons';
import { StaffShiftItem } from './ShiftDetailsOwnerScreen';

interface ShiftDetailsStaffScreenProps {
  shift: StaffShiftItem;
  teamName: string;
  isOffline?: boolean;
  isRestricted?: boolean;
  onBack: () => void;
  onRequestSwap: (shift: StaffShiftItem) => void;
}

export const ShiftDetailsStaffScreen: React.FC<ShiftDetailsStaffScreenProps> = ({
  shift,
  teamName,
  isOffline = false,
  isRestricted = false,
  onBack,
  onRequestSwap,
}) => {
  const { colors } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Shift details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Offline Banner if Offline */}
        {isOffline && (
          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginBottom: 16 }]}>
            <WifiOffIcon color={colors.onSurfaceVariant} size={18} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Offline · saved shift</Text>
              <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                Showing your saved shift. Reconnect to get the latest updates.
              </Text>
            </View>
          </View>
        )}

        {/* Status Pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.statusPillText, { color: colors.onPrimaryContainer }]}>
            {isOffline ? 'Saved shift' : isRestricted ? 'Read-only' : 'Published'}
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.onSurface }]}>{shift.date}.</Text>

        {/* Shift Details Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>Your shift</Text>
          <Text style={[styles.timeText, { color: colors.onSurface }]}>
            {shift.startTime} – {shift.endTime}
          </Text>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Team</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>{teamName}</Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: 'transparent' }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Assigned to</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              You · {shift.assigneeName}
            </Text>
          </View>
        </View>

        {/* Notice box */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <InfoIcon color={colors.onSurfaceVariant} size={18} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
              {isOffline
                ? 'Connection required'
                : isRestricted
                ? 'Team is read-only'
                : 'Need a change?'}
            </Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              {isOffline
                ? 'Reconnect before requesting a swap.'
                : isRestricted
                ? 'Your Owner needs to resolve billing before swaps are available.'
                : 'A colleague must accept your request before a Manager can approve it.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer: Request a swap button */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.surfaceContainerLow,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: isOffline || isRestricted ? colors.surfaceContainerHigh : colors.primary,
              opacity: isOffline || isRestricted ? 0.6 : 1,
            },
          ]}
          onPress={() => onRequestSwap(shift)}
          disabled={isOffline || isRestricted}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <Text
              style={[
                styles.primaryButtonText,
                { color: isOffline || isRestricted ? colors.onSurfaceVariant : colors.onPrimary },
              ]}
            >
              Request a swap
            </Text>
            <Repeat2Icon
              color={isOffline || isRestricted ? colors.onSurfaceVariant : colors.onPrimary}
              size={18}
            />
          </View>
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
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    ...titleMediumText,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  timeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 32,
    letterSpacing: -0.8,
    marginBottom: 18,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  kvLabel: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
  },
  kvValue: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  noticeBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  noticeBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});
