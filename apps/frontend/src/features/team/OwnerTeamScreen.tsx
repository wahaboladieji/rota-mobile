import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { useQueryClient } from '@tanstack/react-query';
import { TeamMembersResponse, TeamMemberItem, PendingInvitationItem } from '@rota/shared';
import { apiRequest } from '../../services/api';

interface OwnerTeamScreenProps {
  teamId: string;
  data: TeamMembersResponse;
  onInvite: () => void;
  onRefresh: () => void;
  onBack: () => void;
}

// Vector icons
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

const PlusIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: size, height: 2, backgroundColor: color, borderRadius: 1 }} />
    <View
      style={{
        position: 'absolute',
        width: 2,
        height: size,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
  </View>
);

const ChevronRightIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 18 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.4,
        height: size * 0.4,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: -2,
      }}
    />
  </View>
);

const UserRoundIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View
      style={{
        width: size * 0.45,
        height: size * 0.45,
        borderRadius: size * 0.23,
        borderWidth: 1.8,
        borderColor: color,
      }}
    />
    <View
      style={{
        width: size * 0.8,
        height: size * 0.4,
        borderTopLeftRadius: size * 0.4,
        borderTopRightRadius: size * 0.4,
        borderWidth: 1.8,
        borderBottomWidth: 0,
        borderColor: color,
        marginTop: 1,
      }}
    />
  </View>
);

const MailIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View
    style={{
      width: size,
      height: size * 0.75,
      borderRadius: 3,
      borderWidth: 1.8,
      borderColor: color,
      justifyContent: 'flex-start',
    }}
  >
    <View
      style={{
        width: size * 0.6,
        height: size * 0.35,
        borderBottomWidth: 1.8,
        borderRightWidth: 1.8,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: size * 0.12,
        marginTop: -size * 0.12,
      }}
    />
  </View>
);

export const OwnerTeamScreen: React.FC<OwnerTeamScreenProps> = ({
  teamId,
  data,
  onInvite,
  onRefresh,
  onBack,
}) => {
  const { colors } = useTheme();

  const queryClient = useQueryClient();

  // Selected member for detail / removal sheet
  const [selectedMember, setSelectedMember] = useState<TeamMemberItem | null>(null);
  const [isMemberRemoveSheet, setIsMemberRemoveSheet] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);

  // Selected invitation for detail / revoke sheet
  const [selectedInvitation, setSelectedInvitation] = useState<PendingInvitationItem | null>(null);
  const [isInviteRevokeSheet, setIsInviteRevokeSheet] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
    onRefresh();
  }, [teamId]);

  const handlePullRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team-billing', teamId] });
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    setRemovingMember(true);
    try {
      await apiRequest(`/api/teams/${teamId}/members/${selectedMember.id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
      setIsMemberRemoveSheet(false);
      setSelectedMember(null);
      await queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team-billing', teamId] });
      onRefresh();
    } catch {
      // Handled in catch
    } finally {
      setRemovingMember(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!selectedInvitation) return;
    setRevokingInvite(true);
    try {
      await apiRequest(`/api/teams/${teamId}/invitations/${selectedInvitation.id}`, {
        method: 'DELETE',
        requiresAuth: true,
      });
      setIsInviteRevokeSheet(false);
      setSelectedInvitation(null);
      await queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team-billing', teamId] });
      onRefresh();
    } catch {
      // Handled in catch
    } finally {
      setRevokingInvite(false);
    }
  };

  const members = data.members || [];
  const pendingInvitations = data.pendingInvitations || [];
  const activeMembersCount =
    data.activeMemberCount !== undefined && data.activeMemberCount !== null
      ? data.activeMemberCount
      : members.length;
  const pendingReservationCount =
    data.pendingReservationCount !== undefined && data.pendingReservationCount !== null
      ? data.pendingReservationCount
      : pendingInvitations.length;

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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.heading, { color: colors.onSurface }]}>Team</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>{data.teamName}</Text>

        {/* 2-Column Stat Grid (r-grid) */}
        <View style={styles.grid}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.statNumber, { color: colors.onSurface }]}>
              {activeMembersCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
              {activeMembersCount === 1 ? 'Active member' : 'Active members'}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.statNumber, { color: colors.onSurface }]}>
              {pendingReservationCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>
              {pendingReservationCount === 1 ? 'Reserved invitation' : 'Reserved invitations'}
            </Text>
          </View>
        </View>

        {/* Members Section (r-section) */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Members</Text>
        </View>

        <View
          style={[
            styles.listGroup,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.surfaceContainerLow,
            },
          ]}
        >
          {members.map((member, idx) => {
            const isLast = idx === members.length - 1;
            const displayName = member.isSelf ? 'You' : member.email.split('@')[0];
            const roleLabel = member.role.charAt(0) + member.role.slice(1).toLowerCase();

            return (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.listRow,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
                ]}
                onPress={() => {
                  if (!member.isSelf) {
                    setSelectedMember(member);
                  }
                }}
                disabled={member.isSelf}
                activeOpacity={0.7}
              >
                <UserRoundIcon color={colors.onSurfaceVariant} size={20} />
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]}>
                    {displayName}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>
                    {roleLabel}
                  </Text>
                </View>
                {!member.isSelf && (
                  <ChevronRightIcon color={colors.onSurfaceVariant} size={16} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Pending Invitations Section */}
        {pendingInvitations.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                Pending invitations
              </Text>
            </View>

            <View
              style={[
                styles.listGroup,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.surfaceContainerLow,
                },
              ]}
            >
              {pendingInvitations.map((inv, idx) => {
                const isLast = idx === pendingInvitations.length - 1;
                return (
                  <TouchableOpacity
                    key={inv.id}
                    style={[
                      styles.listRow,
                      !isLast && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surfaceContainerLow,
                      },
                    ]}
                    onPress={() => setSelectedInvitation(inv)}
                    activeOpacity={0.7}
                  >
                    <MailIcon color={colors.onSurfaceVariant} size={20} />
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowTitle, { color: colors.onSurface }]}>
                        {inv.email || 'Single-use link invitation'}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>
                        Pending · Reserves one place
                      </Text>
                    </View>
                    <ChevronRightIcon color={colors.onSurfaceVariant} size={16} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer Button: Invite a colleague + */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={onInvite}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            Invite a colleague
          </Text>
          <PlusIcon color={colors.onPrimary} size={16} />
        </TouchableOpacity>
      </View>

      {/* Member Access Modal (member / member-remove) */}
      <Modal visible={!!selectedMember} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalHeading, { color: colors.onSurface }]}>
              {isMemberRemoveSheet ? `Remove ${selectedMember?.email}?` : 'Member access.'}
            </Text>

            {isMemberRemoveSheet ? (
              <>
                <Text style={[styles.modalText, { color: colors.onSurfaceVariant }]}>
                  Team access ends immediately. There is no credit for this period. A replacement
                  may use the already-paid place.
                </Text>

                <View style={styles.modalButtonStack}>
                  <TouchableOpacity
                    style={[
                      styles.dangerButton,
                      { backgroundColor: colors.error },
                      removingMember && { opacity: 0.7 },
                    ]}
                    onPress={handleRemoveMember}
                    disabled={removingMember}
                  >
                    {removingMember ? (
                      <ActivityIndicator size="small" color={colors.onError} />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: colors.onError }]}>
                        Remove member
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
                    onPress={() => setIsMemberRemoveSheet(false)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                      Keep member
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.memberCard,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                    },
                  ]}
                >
                  <Text style={[styles.memberName, { color: colors.onSurface }]}>
                    {selectedMember?.email}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.onSurfaceVariant }]}>
                    {selectedMember?.role} · Active
                  </Text>
                </View>

                <View style={styles.noticeBox}>
                  <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                    One active seat
                  </Text>
                  <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                    Removing this member ends access immediately. This period’s cost stays
                    unchanged.
                  </Text>
                </View>

                <View style={styles.modalButtonStack}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.error,
                      },
                    ]}
                    onPress={() => setIsMemberRemoveSheet(true)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
                      Remove member
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
                    onPress={() => setSelectedMember(null)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Pending Invitation Modal (invite-pending / invite-revoke) */}
      <Modal visible={!!selectedInvitation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalHeading, { color: colors.onSurface }]}>
              {isInviteRevokeSheet ? 'Revoke invitation?' : 'Invitation pending.'}
            </Text>

            {isInviteRevokeSheet ? (
              <>
                <Text style={[styles.modalText, { color: colors.onSurfaceVariant }]}>
                  The link will stop working and the reserved place will be released.
                </Text>

                <View style={styles.modalButtonStack}>
                  <TouchableOpacity
                    style={[
                      styles.dangerButton,
                      { backgroundColor: colors.error },
                      revokingInvite && { opacity: 0.7 },
                    ]}
                    onPress={handleRevokeInvitation}
                    disabled={revokingInvite}
                  >
                    {revokingInvite ? (
                      <ActivityIndicator size="small" color={colors.onError} />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: colors.onError }]}>
                        Revoke invitation
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
                    onPress={() => setIsInviteRevokeSheet(false)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                      Keep invitation
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.memberCard,
                    {
                      backgroundColor: colors.surfaceContainerLow,
                    },
                  ]}
                >
                  <Text style={[styles.memberName, { color: colors.onSurface }]}>
                    {selectedInvitation?.email || 'Shareable link invitation'}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.onSurfaceVariant }]}>
                    {selectedInvitation?.role} · Pending
                  </Text>
                </View>

                <View style={styles.modalButtonStack}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.error,
                      },
                    ]}
                    onPress={() => setIsInviteRevokeSheet(true)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
                      Revoke invitation
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
                    onPress={() => setSelectedInvitation(null)}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  primaryButton: {
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
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
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  memberCard: {
    padding: 16,
    borderRadius: 16,
    marginVertical: 14,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 2,
  },
  noticeBox: {
    marginVertical: 10,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  modalButtonStack: {
    gap: 12,
    marginTop: 20,
  },
});
