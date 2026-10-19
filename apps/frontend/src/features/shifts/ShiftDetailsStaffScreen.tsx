import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { Repeat2Icon, InfoIcon, WifiOffIcon, XIcon } from '../../components/ReviewIcons';
import { StaffShiftItem } from './ShiftDetailsOwnerScreen';

interface ShiftDetailsStaffScreenProps {
  shift: StaffShiftItem;
  teamName: string;
  isOffline?: boolean;
  isRestricted?: boolean;
  onBack?: () => void;
  onRequestSwap: (shift: StaffShiftItem) => void;
}

/**
 * Shift details · assigned to you.
 *
 * Visual language mirrors the "Shift details · assigned to you" screen in
 * docs/design references/rota-design-review.html: status pill, two-line title,
 * white detail card (eyebrow + large time + key/value rows), a neutral-99
 * notice, and a pinned primary footer action.
 */
export const ShiftDetailsStaffScreen: React.FC<ShiftDetailsStaffScreenProps> = ({
  shift,
  teamName,
  isOffline = false,
  isRestricted = false,
  onBack,
  onRequestSwap,
}) => {
  const { colors } = useTheme();

  const commaIndex = shift.date.indexOf(', ');
  const heading =
    commaIndex === -1
      ? `${shift.date}.`
      : `${shift.date.slice(0, commaIndex + 1)}\n${shift.date.slice(commaIndex + 2)}.`;

  const isCompleted =
    shift.status === 'COMPLETED' ||
    (shift.endAt ? new Date() > new Date(shift.endAt) : false);

  const actionsDisabled = isOffline || isRestricted || isCompleted;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.sheetHeader}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.sheetHeaderTitle, { color: colors.onSurface }]}>Shift details</Text>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.closeButton, { backgroundColor: colors.surfaceContainerLow }]}
          activeOpacity={0.7}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <XIcon color={colors.onSurface} size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline banner */}
        {isOffline && (
          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, marginBottom: 24 }]}>
            <WifiOffIcon color={colors.onSurfaceVariant} size={20} />
            <View style={styles.noticeTextBlock}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                Offline · saved shift
              </Text>
              <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                Showing your saved shift. Reconnect to get the latest updates.
              </Text>
            </View>
          </View>
        )}

        {/* Status pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isCompleted
                ? colors.surfaceContainerLow
                : colors.surfaceContainerLowest,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              { color: isCompleted ? colors.onSurfaceVariant : colors.onPrimaryContainer },
            ]}
          >
            {isCompleted
              ? 'Completed'
              : isOffline
              ? 'Saved shift'
              : isRestricted
              ? 'Read-only'
              : 'Published'}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.heading, { color: colors.onSurface }]}>{heading}</Text>

        {/* Detail card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>Your shift</Text>
          <Text style={[styles.timeText, { color: colors.onSurface }]}>
            {shift.startTime} <Text style={styles.timeDash}>–</Text> {shift.endTime}
          </Text>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Team</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>{teamName}</Text>
          </View>

          <View style={[styles.kvRow, styles.kvRowLast]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Assigned to</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              You · {shift.assigneeName}
            </Text>
          </View>
        </View>

        {/* Notice */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: isCompleted ? colors.surfaceContainerLow : colors.neutral99,
              marginTop: 24,
            },
          ]}
        >
          <InfoIcon color={colors.onSurfaceVariant} size={20} />
          <View style={styles.noticeTextBlock}>
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
              {isCompleted
                ? 'Shift completed'
                : isOffline
                ? 'Connection required'
                : isRestricted
                ? 'Team is read-only'
                : 'Need a change?'}
            </Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              {isCompleted
                ? 'This shift has ended and can no longer be swapped.'
                : isOffline
                ? 'Reconnect before requesting a swap.'
                : isRestricted
                ? 'Your Owner needs to resolve billing before swaps are available.'
                : 'A colleague must accept your request before a Manager can approve it.'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer action */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: actionsDisabled ? colors.surfaceContainerHigh : colors.primary,
              opacity: actionsDisabled ? 0.6 : 1,
            },
          ]}
          onPress={() => onRequestSwap(shift)}
          disabled={actionsDisabled}
          activeOpacity={0.8}
        >
          <View style={styles.buttonInner}>
            <Text
              style={[
                styles.primaryButtonText,
                { color: actionsDisabled ? colors.onSurfaceVariant : colors.onPrimary },
              ]}
            >
              {isCompleted ? 'Shift completed' : 'Request a swap'}
            </Text>
            {!isCompleted && (
              <Repeat2Icon
                color={actionsDisabled ? colors.onSurfaceVariant : colors.onPrimary}
                size={20}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexShrink: 1,
  },
  scrollView: {
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sheetHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 24,
  },
  statusPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    lineHeight: 37.5,
    letterSpacing: -0.75,
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  timeText: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 36,
    lineHeight: 45,
    letterSpacing: -0.9,
    marginTop: 8,
    marginBottom: 16,
  },
  timeDash: {
    fontSize: 20,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  kvRowLast: {
    borderBottomWidth: 0,
  },
  kvLabel: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  kvValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'right',
    flexShrink: 1,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  noticeTextBlock: {
    flex: 1,
  },
  noticeTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  noticeBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
  },
});
