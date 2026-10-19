import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme, titleMediumText } from '../../theme';
import { ArrowLeftIcon, UserRoundIcon, UsersIcon, ChevronRightIcon } from '../../components/ReviewIcons';
import { apiRequest } from '../../services/api';
import { InsetDivider } from '../../components/InsetDivider';
import { TeamMembersResponse, Role } from '@rota/shared';

interface StaffTeamScreenProps {
  teamId: string;
  teamName: string;
  currentUserId: string;
  userRole?: Role;
  onBack: () => void;
  onNavigateToAccount: () => void;
}

export const StaffTeamScreen: React.FC<StaffTeamScreenProps> = ({
  teamId,
  teamName,
  currentUserId,
  userRole,
  onBack,
  onNavigateToAccount,
}) => {
  const { colors } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () =>
      apiRequest<TeamMembersResponse>(`/api/teams/${teamId}/members`, {
        method: 'GET',
        requiresAuth: true,
      }),
    enabled: !!teamId,
  });

  const members = data?.members || [];

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Team</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Team</Text>
        <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>{teamName}</Text>

        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View
            style={[
              styles.listGroup,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.surfaceContainerLow,
              },
            ]}
          >
            {members.map((member, index) => {
              const isSelf = member.userId === currentUserId || member.isSelf;
              const roleDisplay =
                member.role === Role.OWNER
                  ? 'Owner'
                  : member.role === Role.MANAGER
                  ? 'Manager'
                  : 'Staff';
              const nameDisplay = isSelf ? 'You' : member.email.split('@')[0];
              const isLast = index === members.length - 1;

              return (
                <View key={member.id}>
                  <TouchableOpacity
                    style={styles.listRow}
                    onPress={() => {
                      if (isSelf) {
                        onNavigateToAccount();
                      }
                    }}
                    activeOpacity={isSelf ? 0.7 : 1}
                  >
                    <View
                      style={[
                        styles.avatarBox,
                        { backgroundColor: isSelf ? colors.primary : colors.surfaceContainerLow },
                      ]}
                    >
                      <UserRoundIcon
                        color={isSelf ? colors.onPrimary : colors.onSurfaceVariant}
                        size={18}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.memberName, { color: colors.onSurface }]}>
                        {nameDisplay}
                      </Text>
                      <Text style={[styles.memberRole, { color: colors.onSurfaceVariant }]}>
                        {isSelf ? `${roleDisplay} · ${member.email}` : roleDisplay}
                      </Text>
                    </View>
                    {isSelf && <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />}
                  </TouchableOpacity>
                  {!isLast && <InsetDivider inset={68} />}
                </View>
              );
            })}
          </View>
        )}

        {(() => {
          const currentMember = members.find((m) => m.userId === currentUserId || m.isSelf);
          const effectiveRole = userRole || currentMember?.role || Role.STAFF;
          const isManager = effectiveRole === Role.MANAGER;
          const isOwner = effectiveRole === Role.OWNER;

          return (
            <View
              style={[
                styles.infoCard,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <UsersIcon color={colors.onSurfaceVariant} size={18} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.infoTitle, { color: colors.onSurface }]}>
                  {isOwner ? 'Owner membership' : isManager ? 'Manager membership' : 'Staff membership'}
                </Text>
                <Text style={[styles.infoBody, { color: colors.onSurfaceVariant }]}>
                  {isOwner
                    ? `You are the owner of ${teamName}. You can manage team members, subscriptions, and publish shifts.`
                    : isManager
                    ? `You have manager access for ${teamName}. You can create and publish shifts, manage shift approvals, and invite colleagues.`
                    : 'You are viewing the schedule and roster as Staff. Only Owners and Managers can publish shifts or invite colleagues.'}
                </Text>
              </View>
            </View>
          );
        })()}
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
    marginBottom: 24,
  },
  centerLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  listGroup: {
    borderRadius: 14,
    borderWidth: 0,
    overflow: 'hidden',
    marginBottom: 20,
  },
  listRow: {
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
  memberName: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 15,
  },
  memberRole: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 0,
  },
  infoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  infoBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
});
