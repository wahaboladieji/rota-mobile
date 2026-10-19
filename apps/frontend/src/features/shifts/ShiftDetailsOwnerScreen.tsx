import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import { Repeat2Icon, InfoIcon, XIcon } from '../../components/ReviewIcons';

export interface StaffShiftItem {
  id: string;
  assigneeId?: string;
  assigneeName: string;
  assigneeRole: string;
  date: string;
  dayText?: string;
  dayNum?: string;
  startTime: string;
  endTime: string;
  weeklyAvailability?: string;
  status?: 'CURRENT' | 'UPCOMING' | 'COMPLETED';
  avatarInitials?: string;
  dateString?: string;
  startAt?: string;
  endAt?: string;
}

interface ShiftDetailsOwnerScreenProps {
  shift: StaffShiftItem;
  teamName: string;
  isOwnShift?: boolean;
  onBack?: () => void;
  onEditShift: () => void;
  onCancelShift: () => Promise<void> | void;
  onRequestSwap?: (shift: StaffShiftItem) => void;
}

export const ShiftDetailsOwnerScreen: React.FC<ShiftDetailsOwnerScreenProps> = ({
  shift,
  teamName,
  isOwnShift = false,
  onBack,
  onEditShift,
  onCancelShift,
  onRequestSwap,
}) => {
  const { colors } = useTheme();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isCompleted =
    shift.status === 'COMPLETED' ||
    (shift.endAt ? new Date() > new Date(shift.endAt) : false);

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
        {/* Status Pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isCompleted
                ? colors.surfaceContainerLow
                : colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              { color: isCompleted ? colors.onSurfaceVariant : colors.onPrimaryContainer },
            ]}
          >
            {isCompleted ? 'Completed' : 'Published'}
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.onSurface }]}>Assigned shift.</Text>

        {/* Shift Details Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
            },
          ]}
        >
          <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>
            {shift.date}
          </Text>
          <Text style={[styles.timeText, { color: colors.onSurface }]}>
            {shift.startTime} – {shift.endTime}
          </Text>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Team</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>{teamName}</Text>
          </View>

          <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Assigned to</Text>
            <Text style={[styles.kvValue, { color: colors.onSurface }]}>
              {shift.assigneeName} · {shift.assigneeRole}
            </Text>
          </View>

          {shift.weeklyAvailability && (
            <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Weekly availability</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>
                {shift.weeklyAvailability}
              </Text>
            </View>
          )}
        </View>

        {/* Stack Actions or Completed Notice */}
        {isCompleted ? (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: colors.surfaceContainerLow, marginTop: 12 },
            ]}
          >
            <InfoIcon color={colors.onSurfaceVariant} size={20} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                Shift completed
              </Text>
              <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                This shift has ended and can no longer be edited, cancelled, or swapped.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.actionStack}>
            {isOwnShift && onRequestSwap ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => onRequestSwap(shift)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      Request a swap
                    </Text>
                    <Repeat2Icon color={colors.onPrimary} size={16} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={onEditShift}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>Edit shift</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.error }]}>Cancel shift</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={onEditShift}
                >
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Edit shift</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => setShowCancelModal(true)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.error }]}>Cancel shift</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Cancel Shift Confirmation Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalHeading, { color: colors.onSurface }]}>
              Cancel this shift?
            </Text>
            <Text style={[styles.modalBody, { color: colors.onSurfaceVariant }]}>
              The shift will leave the schedule. Any pending swap involving it will also be
              cancelled.
            </Text>

            <View style={{ gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.dangerButton, { backgroundColor: colors.error }]}
                disabled={isCancelling}
                onPress={async () => {
                  setIsCancelling(true);
                  try {
                    await onCancelShift();
                    setShowCancelModal(false);
                  } catch {
                    // Modal remains open or handled by caller
                  } finally {
                    setIsCancelling(false);
                  }
                }}
              >
                {isCancelling ? (
                  <ActivityIndicator color={colors.onError} size="small" />
                ) : (
                  <Text style={[styles.dangerButtonText, { color: colors.onError }]}>
                    Cancel shift
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
                disabled={isCancelling}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Keep shift
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
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
    padding: 20,
    paddingBottom: 40,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 0,
    marginBottom: 24,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginVertical: 12,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 0,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
