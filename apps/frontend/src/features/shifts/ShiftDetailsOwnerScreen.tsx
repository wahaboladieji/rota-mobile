import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useTheme, titleMediumText } from '../../theme';
import { ArrowLeftIcon } from '../../components/ReviewIcons';

export interface StaffShiftItem {
  id: string;
  assigneeName: string;
  assigneeRole: string;
  date: string;
  dayText?: string;
  dayNum?: string;
  startTime: string;
  endTime: string;
  weeklyAvailability?: string;
  status?: 'CURRENT' | 'UPCOMING';
  avatarInitials?: string;
}

interface ShiftDetailsOwnerScreenProps {
  shift?: StaffShiftItem;
  teamName: string;
  onBack: () => void;
  onEditShift: () => void;
  onCancelShift: () => void;
}

export const ShiftDetailsOwnerScreen: React.FC<ShiftDetailsOwnerScreenProps> = ({
  shift = {
    id: 's-1',
    assigneeName: 'Kemi Ade',
    assigneeRole: 'Staff',
    date: 'Monday, 12 October',
    startTime: '09:00',
    endTime: '17:00',
    weeklyAvailability: 'Monday · 08:00–18:00',
  },
  teamName,
  onBack,
  onEditShift,
  onCancelShift,
}) => {
  const { colors } = useTheme();
  const [showCancelModal, setShowCancelModal] = useState(false);

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
        {/* Published Pill */}
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
            Published
          </Text>
        </View>

        <Text style={[styles.heading, { color: colors.onSurface }]}>Assigned shift.</Text>

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

        {/* Stack Actions */}
        <View style={styles.actionStack}>
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
        </View>
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
                onPress={() => {
                  setShowCancelModal(false);
                  onCancelShift();
                }}
              >
                <Text style={[styles.dangerButtonText, { color: colors.onError }]}>
                  Cancel shift
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
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    borderWidth: 1,
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
});
