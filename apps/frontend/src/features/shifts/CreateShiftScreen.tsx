import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { apiRequest } from '../../services/api';
import { TeamMembersResponse } from '@rota/shared';

interface CreateShiftScreenProps {
  teamId: string;
  onPublish: () => void;
  onBack: () => void;
}

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

const ClockIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.8,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        position: 'absolute',
        top: 3,
        width: 1.8,
        height: size * 0.35,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: size * 0.42,
        top: size * 0.42,
        width: size * 0.28,
        height: 1.8,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
  </View>
);

export const CreateShiftScreen: React.FC<CreateShiftScreenProps> = ({ teamId, onPublish, onBack }) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: teamMembersData, isLoading: isLoadingMembers } = useQuery<TeamMembersResponse>({
    queryKey: ['team-members', teamId],
    queryFn: () => apiRequest<TeamMembersResponse>(`/api/teams/${teamId}/members`),
  });

  const members = teamMembersData?.members || [];
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Default to today's date in YYYY-MM-DD
  const todayIso = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayIso);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMemberId && members.length > 0) {
      // Prefer selecting a staff member if available, otherwise first member
      const staffMember = members.find((m) => m.role === 'STAFF') || members[0];
      setSelectedMemberId(staffMember.userId);
    }
  }, [members, selectedMemberId]);

  const selectedMember = members.find((m) => m.userId === selectedMemberId);

  const handlePublish = async () => {
    if (!selectedMemberId) {
      setErrorMessage('Please select a member to assign this shift to.');
      return;
    }

    setPublishing(true);
    setErrorMessage(null);

    try {
      await apiRequest(`/api/teams/${teamId}/shifts`, {
        method: 'POST',
        body: JSON.stringify({
          assigneeId: selectedMemberId,
          startAt: `${date}T${startTime}:00.000Z`,
          endAt: `${date}T${endTime}:00.000Z`,
        }),
        requiresAuth: true,
      });

      await queryClient.invalidateQueries({ queryKey: ['shifts', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['activity', teamId] });
      onPublish();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish shift. Please check input values.');
    } finally {
      setPublishing(false);
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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Publish shift</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Create a shift.</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          Publishing makes this shift visible immediately.
        </Text>

        {errorMessage && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.errorContainer, borderColor: colors.error },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Member Selector */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Assigned member</Text>
          {isLoadingMembers ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : members.length === 0 ? (
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 4 }}>
              No members found in team.
            </Text>
          ) : (
            <View style={styles.memberPills}>
              {members.map((m) => {
                const isSelected = selectedMemberId === m.userId;
                const displayName = `${m.isSelf ? 'You · ' : ''}${m.email.split('@')[0]} · ${
                  m.role === 'OWNER' ? 'Owner' : m.role === 'MANAGER' ? 'Manager' : 'Staff'
                }`;

                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={[
                      styles.memberPill,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryContainer
                          : colors.surfaceContainerLowest,
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                    onPress={() => setSelectedMemberId(m.userId)}
                  >
                    <Text
                      style={[
                        styles.memberPillText,
                        {
                          color: isSelected ? colors.onPrimaryContainer : colors.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Weekly Availability Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              marginBottom: 20,
            },
          ]}
        >
          <View style={styles.row}>
            <ClockIcon color={colors.primary} size={18} />
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Weekly availability</Text>
          </View>
          <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
            {selectedMember
              ? `${selectedMember.email.split('@')[0]} is available for scheduling`
              : 'Select a colleague above'}
          </Text>
        </View>

        {/* Date Field */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Date</Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                color: colors.onSurface,
              },
            ]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>

        {/* Start / End Grid */}
        <View style={styles.grid}>
          <View style={[styles.fieldContainer, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Start</Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                },
              ]}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:00"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </View>

          <View style={[styles.fieldContainer, { flex: 1 }]}>
            <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>End</Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                },
              ]}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="17:00"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </View>
        </View>

        <Text style={[styles.ruleText, { color: colors.onSurfaceVariant }]}>
          No overlapping shifts for the same person. Start within the next 8 weeks.
        </Text>
      </ScrollView>

      {/* Footer Button */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handlePublish}
          disabled={publishing || isLoadingMembers}
        >
          {publishing ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              Publish shift
            </Text>
          )}
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
    marginBottom: 20,
  },
  errorCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  memberPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  memberPillText: {
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  ruleText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  primaryButton: {
    height: 52,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
