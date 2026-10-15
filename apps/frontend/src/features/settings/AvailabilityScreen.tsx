import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { apiRequest } from '../../services/api';
import { ArrowLeftIcon, PlusIcon, ClockIcon } from '../../components/ReviewIcons';

export interface AvailabilityWindowItem {
  id: string;
  weekday: number;
  dayName: string;
  startTime: string;
  endTime: string;
}

interface AvailabilityScreenProps {
  teamId: string;
  teamName: string;
  onBack: () => void;
}

const DAYS_OF_WEEK = [
  { name: 'Monday', weekday: 1 },
  { name: 'Tuesday', weekday: 2 },
  { name: 'Wednesday', weekday: 3 },
  { name: 'Thursday', weekday: 4 },
  { name: 'Friday', weekday: 5 },
  { name: 'Saturday', weekday: 6 },
  { name: 'Sunday', weekday: 0 },
];

export const AvailabilityScreen: React.FC<AvailabilityScreenProps> = ({ teamId, teamName, onBack }) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: windows = [], isLoading } = useQuery<AvailabilityWindowItem[]>({
    queryKey: ['preferences', teamId],
    queryFn: () => apiRequest<AvailabilityWindowItem[]>(`/api/teams/${teamId}/preferences`),
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState(1);
  const [newFrom, setNewFrom] = useState('08:00');
  const [newUntil, setNewUntil] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddWindow = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest(`/api/teams/${teamId}/preferences`, {
        method: 'POST',
        body: JSON.stringify({
          weekday: selectedWeekday,
          startTime: newFrom,
          endTime: newUntil,
        }),
        requiresAuth: true,
      });

      await queryClient.invalidateQueries({ queryKey: ['preferences', teamId] });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save availability window.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWindow = async (id: string) => {
    try {
      await apiRequest(`/api/teams/${teamId}/preferences/${id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['preferences', teamId] });
    } catch {
      // Ignored
    }
  };

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Availability</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Your weekly windows for {teamName}.
        </Text>

        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : windows.length === 0 ? (
          /* Empty state matching availability-empty from rota-design-review.html */
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}
          >
            <View
              style={[
                styles.emptyIconBox,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <ClockIcon color={colors.primary} size={30} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No availability set
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
              Add the weekly times when you are available.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16, width: '100%' }]}
              onPress={() => setIsAddModalOpen(true)}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Add a window +
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Windows list matching availability from rota-design-review.html */
          <View style={styles.stack}>
            {windows.map((win) => (
              <View
                key={win.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.dayText, { color: colors.onSurface }]}>{win.dayName}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveWindow(win.id)}
                    style={styles.textButton}
                  >
                    <Text style={[styles.textButtonLabel, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]}>
                  {win.startTime} – {win.endTime}
                </Text>
              </View>
            ))}

            <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
              Your Manager can see these windows when assigning work.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Button if windows exist */}
      {windows.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsAddModalOpen(true)}
          >
            <PlusIcon color={colors.onPrimary} size={16} />
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary, marginLeft: 8 }]}>
              Add availability
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Window Modal (matches availability-add from rota-design-review.html) */}
      <Modal visible={isAddModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalHeading, { color: colors.onSurface }]}>Add a window.</Text>
            <Text style={[styles.modalLead, { color: colors.onSurfaceVariant }]}>
              Set a weekly time when you are available.
            </Text>

            {errorMsg && (
              <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>
                {errorMsg}
              </Text>
            )}

            {/* Day Selector */}
            <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedWeekday === d.weekday;
                  return (
                    <TouchableOpacity
                      key={d.weekday}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: isSelected
                            ? colors.primaryContainer
                            : colors.surfaceContainerLowest,
                          borderColor: isSelected ? colors.primary : colors.outlineVariant,
                        },
                      ]}
                      onPress={() => setSelectedWeekday(d.weekday)}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          {
                            color: isSelected ? colors.onPrimaryContainer : colors.onSurface,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {d.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Times */}
            <View style={styles.timeGrid}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>From</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface,
                    },
                  ]}
                  value={newFrom}
                  onChangeText={setNewFrom}
                  placeholder="08:00"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Until</Text>
                <TextInput
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface,
                    },
                  ]}
                  value={newUntil}
                  onChangeText={setNewUntil}
                  placeholder="18:00"
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              </View>
            </View>

            <View style={[styles.modalActions, { marginTop: 24 }]}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleAddWindow}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    Save availability
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    marginTop: 10,
                  },
                ]}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>Cancel</Text>
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
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  heading: {
    ...titleLargeText,
    marginBottom: 6,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  stack: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 14,
  },
  textButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  textButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  primaryButton: {
    height: 50,
    borderRadius: 9999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 9999,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeading: {
    ...titleMediumText,
    marginBottom: 4,
  },
  modalLead: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  dayPillText: {
    fontSize: 13,
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  modalActions: {
    gap: 8,
  },
});
