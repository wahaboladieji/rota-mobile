import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, titleMediumText } from '../../theme';
import {
  ArrowLeftIcon,
  InfoIcon,
  UserRoundIcon,
  CheckIcon,
  AlertTriangleIcon,
} from '../../components/ReviewIcons';
import { StaffShiftItem } from '../shifts/ShiftDetailsOwnerScreen';
import { apiRequest } from '../../services/api';
import { TeamMembersResponse } from '@rota/shared';

interface RequestSwapScreenProps {
  shift: StaffShiftItem;
  teamId: string;
  currentUserId: string;
  currentUserName: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const RequestSwapScreen: React.FC<RequestSwapScreenProps> = ({
  shift,
  teamId,
  currentUserId,
  currentUserName,
  onBack,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [selectedColleagueId, setSelectedColleagueId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch active team members
  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () =>
      apiRequest<TeamMembersResponse>(`/api/teams/${teamId}/members`, {
        method: 'GET',
        requiresAuth: true,
      }),
    enabled: !!teamId,
  });

  const availableColleagues = (membersData?.members || []).filter(
    (m) => m.userId !== currentUserId && m.status === 'ACTIVE'
  );

  const selectedColleague = availableColleagues.find((c) => c.userId === selectedColleagueId);

  // Mutation to create swap request
  const swapMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/teams/${teamId}/swaps`, {
        method: 'POST',
        body: JSON.stringify({
          requesterShiftId: shift.id,
          colleagueId: selectedColleagueId,
        }),
        requiresAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['swaps', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['shifts', teamId] });
      onSuccess();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Could not save your request. Try again when connected.');
    },
  });

  const handleSendRequest = () => {
    if (!selectedColleagueId) return;
    setErrorMessage(null);
    swapMutation.mutate();
  };

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Request swap</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Request a swap.</Text>
        <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
          Choose a colleague for your assigned shift.
        </Text>

        {/* Error message */}
        {errorMessage && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
          >
            <AlertTriangleIcon color={colors.onSurface} size={18} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.errorTitle, { color: colors.onSurface }]}>Request not sent</Text>
              <Text style={[styles.errorBody, { color: colors.onSurfaceVariant }]}>
                {errorMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Assigned Shift Card */}
        <View
          style={[
            styles.shiftCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <View style={[styles.dateBox, { backgroundColor: colors.surfaceContainerLow }]}>
            <Text style={[styles.dateBoxDay, { color: colors.onSurfaceVariant }]}>
              {shift.dayText || 'Mon'}
            </Text>
            <Text style={[styles.dateBoxNum, { color: colors.onSurface }]}>
              {shift.dayNum || '12'}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.shiftTime, { color: colors.onSurface }]}>
              {shift.startTime} – {shift.endTime}
            </Text>
            <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>
              {shift.date}
            </Text>
          </View>
        </View>

        {/* Colleague Selector */}
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Select colleague</Text>

        {isLoadingMembers ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : availableColleagues.length === 0 ? (
          <View
            style={[
              styles.emptyColleagues,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.emptyColleaguesText, { color: colors.onSurfaceVariant }]}>
              No other colleagues found in this team to request a swap with.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.colleaguesList,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {availableColleagues.map((colleague, index) => {
              const isSelected = selectedColleagueId === colleague.userId;
              const isLast = index === availableColleagues.length - 1;
              const colleagueName = colleague.email.split('@')[0];

              return (
                <TouchableOpacity
                  key={colleague.id}
                  style={[
                    styles.colleagueRow,
                    isSelected && { backgroundColor: colors.surfaceContainerLow },
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surfaceContainerLow,
                    },
                  ]}
                  onPress={() => setSelectedColleagueId(colleague.userId)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceContainerLow,
                      },
                    ]}
                  >
                    <UserRoundIcon
                      color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
                      size={18}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.colleagueName, { color: colors.onSurface }]}>
                      {colleagueName}
                    </Text>
                    <Text style={[styles.colleagueRole, { color: colors.onSurfaceVariant }]}>
                      {colleague.role === 'STAFF' ? 'Staff' : colleague.role} · {colleague.email}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkCircle,
                      {
                        borderColor: isSelected ? colors.primary : colors.outlineVariant,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && <CheckIcon color={colors.onPrimary} size={14} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Notice: Two decisions */}
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
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Two decisions</Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              Your colleague accepts first. A Manager then reviews and approves the request.
            </Text>
          </View>
        </View>

        {/* Proposal Details Card */}
        {selectedColleague && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                marginTop: 16,
              },
            ]}
          >
            <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
              Proposal details
            </Text>
            <Text style={[styles.proposalHeading, { color: colors.onSurface }]}>
              Review transfer
            </Text>
            <Text style={[styles.proposalSub, { color: colors.onSurfaceVariant }]}>
              {selectedColleague.email.split('@')[0]} would take your shift if approved.
            </Text>

            <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>From</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>
                You · {currentUserName}
              </Text>
            </View>

            <View style={[styles.kvRow, { borderBottomColor: 'transparent' }]}>
              <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>To</Text>
              <Text style={[styles.kvValue, { color: colors.onSurface }]}>
                {selectedColleague.email.split('@')[0]}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
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
              backgroundColor: !selectedColleagueId ? colors.surfaceContainerHigh : colors.primary,
              opacity: !selectedColleagueId || swapMutation.isPending ? 0.6 : 1,
            },
          ]}
          onPress={handleSendRequest}
          disabled={!selectedColleagueId || swapMutation.isPending}
          activeOpacity={0.8}
        >
          {swapMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text
              style={[
                styles.primaryButtonText,
                { color: !selectedColleagueId ? colors.onSurfaceVariant : colors.onPrimary },
              ]}
            >
              Send request
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
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 16,
    marginBottom: 20,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  dateBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBoxDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  dateBoxNum: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 18,
    marginTop: -2,
  },
  shiftTime: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 18,
  },
  shiftMeta: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    marginBottom: 12,
  },
  centerLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyColleagues: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyColleaguesText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  colleaguesList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  colleagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colleagueName: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 15,
  },
  colleagueRole: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  proposalHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  proposalSub: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    marginBottom: 16,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
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
  errorCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  errorBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
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
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
});
