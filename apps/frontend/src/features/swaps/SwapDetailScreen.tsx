import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme, titleMediumText } from '../../theme';
import {
  ArrowLeftIcon,
  Repeat2Icon,
  InfoIcon,
  CheckIcon,
  XIcon,
  AlertTriangleIcon,
  CalendarDaysIcon,
} from '../../components/ReviewIcons';
import { SwapRequestItem, SwapStatus, Role } from '@rota/shared';
import { apiRequest } from '../../services/api';

interface SwapDetailScreenProps {
  swap: SwapRequestItem;
  teamId: string;
  currentUserId: string;
  userRole?: Role;
  onBack: () => void;
  onNavigateToSchedule?: () => void;
}

export const SwapDetailScreen: React.FC<SwapDetailScreenProps> = ({
  swap,
  teamId,
  currentUserId,
  userRole,
  onBack,
  onNavigateToSchedule,
}) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApprovedSuccess, setIsApprovedSuccess] = useState(false);

  const isRequester = swap.requesterId === currentUserId;
  const isColleague = swap.colleagueId === currentUserId;
  const isManagerOrOwner = userRole === Role.MANAGER || userRole === Role.OWNER;

  // Format dates
  const startDate = new Date(swap.requesterShiftStart);
  const endDate = new Date(swap.requesterShiftEnd);
  const dateFormatted = startDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeFormatted = `${String(startDate.getHours()).padStart(2, '0')}:${String(
    startDate.getMinutes()
  ).padStart(2, '0')} – ${String(endDate.getHours()).padStart(2, '0')}:${String(
    endDate.getMinutes()
  ).padStart(2, '0')}`;

  // Colleague decision mutation
  const colleagueDecisionMutation = useMutation({
    mutationFn: (decision: 'ACCEPT' | 'REJECT') =>
      apiRequest(`/api/teams/${teamId}/swaps/${swap.id}/colleague-decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
        requiresAuth: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['swaps', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['shifts', teamId] });
      onBack();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Action failed. Please try again.');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/teams/${teamId}/swaps/${swap.id}/cancel`, {
        method: 'POST',
        requiresAuth: true,
      }),
    onSuccess: async () => {
      setShowCancelModal(false);
      await queryClient.invalidateQueries({ queryKey: ['swaps', teamId] });
      onBack();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Could not cancel request.');
    },
  });

  // Manager decision mutation (AGENTS.md rule 15 & PRD F3.1)
  const managerDecisionMutation = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      apiRequest(`/api/teams/${teamId}/swaps/${swap.id}/manager-decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
        requiresAuth: true,
      }),
    onSuccess: async (_, decision) => {
      await queryClient.invalidateQueries({ queryKey: ['swaps'] });
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
      await queryClient.invalidateQueries({ queryKey: ['activity'] });
      if (decision === 'APPROVE') {
        setIsApprovedSuccess(true);
      } else {
        onBack();
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Action failed. Please try again.');
    },
  });

  // Stages calculation
  // Stage 1: Colleague response
  // Stage 2: Manager review
  const isStage1Complete = ['PENDING_MANAGER', 'APPROVED'].includes(swap.status);
  const isStage2Complete = swap.status === 'APPROVED';

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Swap details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {errorMessage && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
          >
            <AlertTriangleIcon color={colors.onSurface} size={18} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{errorMessage}</Text>
          </View>
        )}

        {/* Case 1: Colleague reviewing incoming request */}
        {isColleague && swap.status === 'PENDING_COLLEAGUE' ? (
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>
              {swap.requesterName} needs a{'\n'}shift change.
            </Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              Review the proposal before responding.
            </Text>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
                Requested by
              </Text>
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                {swap.requesterName}
              </Text>
              <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                {swap.requesterEmail}
              </Text>

              <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Shift</Text>
                <Text style={[styles.kvValue, { color: colors.onSurface }]}>{dateFormatted}</Text>
              </View>

              <View style={[styles.kvRow, { borderBottomColor: 'transparent' }]}>
                <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Time</Text>
                <Text style={[styles.kvValue, { color: colors.onSurface }]}>{timeFormatted}</Text>
              </View>
            </View>

            <View
              style={[
                styles.noticeBox,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  marginTop: 16,
                },
              ]}
            >
              <InfoIcon color={colors.onSurfaceVariant} size={18} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                  Manager review follows
                </Text>
                <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                  Accepting sends the request to a Manager. It does not change the schedule yet.
                </Text>
              </View>
            </View>
          </>
        ) : isRequester && swap.status === 'PENDING_COLLEAGUE' ? (
          /* Case 2: Requester waiting for colleague */
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>Swap requested.</Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              Waiting for {swap.colleagueName} to respond.
            </Text>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{dateFormatted}</Text>
              <Text style={[styles.timeLarge, { color: colors.onSurface }]}>{timeFormatted}</Text>
              <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                With {swap.colleagueName}
              </Text>

              {/* Stages */}
              <View style={styles.stagesContainer}>
                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { borderColor: colors.primary, borderWidth: 2 }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>1</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Colleague decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Waiting for {swap.colleagueName}
                    </Text>
                  </View>
                </View>

                <View style={styles.stageItem}>
                  <View
                    style={[
                      styles.dotCircle,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderWidth: 1 },
                    ]}
                  >
                    <Text style={{ color: colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' }}>2</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurfaceVariant }]}>
                      Manager decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Required after colleague acceptance
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
              Your current assignment has not changed.
            </Text>
          </>
        ) : isApprovedSuccess || swap.status === 'APPROVED' ? (
          /* Case 4: Approved */
          <>
            <View style={styles.terminalIconBox}>
              <CheckIcon color={colors.primary} size={40} />
            </View>
            <Text style={[styles.heading, { color: colors.onSurface, textAlign: 'center' }]}>
              Request approved
            </Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
              The Manager approved this request. Open the schedule to see your current assignment.
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={onNavigateToSchedule || onBack}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                View schedule
              </Text>
            </TouchableOpacity>
          </>
        ) : (swap.status === 'PENDING_MANAGER' && isManagerOrOwner && !isRequester) ? (
          /* Case 3A: Manager reviewing colleague-accepted request (swap-manager from design review) */
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>Review request.</Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              {swap.colleagueName} accepted {swap.requesterName}’s proposal.
            </Text>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View
                  style={[
                    styles.dotCircle,
                    { backgroundColor: colors.primaryContainer, width: 36, height: 36, borderRadius: 18 },
                  ]}
                >
                  <Text style={{ color: colors.onPrimaryContainer, fontSize: 13, fontWeight: '700' }}>
                    {swap.requesterName.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.cardTitle, { color: colors.onSurface, fontSize: 16 }]}>
                    {swap.requesterName} → {swap.colleagueName}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.onSurfaceVariant, marginBottom: 0 }]}>
                    Colleague accepted
                  </Text>
                </View>
              </View>

              <View style={[styles.kvRow, { borderBottomColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Involved shift</Text>
                <Text style={[styles.kvValue, { color: colors.onSurface }]}>{dateFormatted}</Text>
              </View>
              <View style={[styles.kvRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>Time</Text>
                <Text style={[styles.kvValue, { color: colors.onSurface }]}>{timeFormatted}</Text>
              </View>

              {/* Stages */}
              <View style={styles.stagesContainer}>
                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { backgroundColor: colors.primary }]}>
                    <CheckIcon color={colors.onPrimary} size={12} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Colleague decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Accepted by {swap.colleagueName}
                    </Text>
                  </View>
                </View>

                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { borderColor: colors.primary, borderWidth: 2 }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>2</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Manager decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Required after colleague acceptance
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
              Current shifts and assignments are checked again at approval.
            </Text>
          </>
        ) : (swap.status === 'PENDING_MANAGER' && isManagerOrOwner && isRequester) ? (
          /* Case 3B: Working Manager viewing own swap (no self-approval per D2 & PRD Rule 15) */
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>Colleague accepted.</Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              Your request is now with another Manager.
            </Text>

            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginBottom: 16 },
              ]}
            >
              <InfoIcon color={colors.primary} size={18} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Self-approval is prohibited</Text>
                <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                  To preserve independent review, another authorized Manager or Owner must review and approve this swap.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{dateFormatted}</Text>
              <Text style={[styles.timeLarge, { color: colors.onSurface }]}>{timeFormatted}</Text>
              <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                {swap.requesterName} → {swap.colleagueName}
              </Text>

              {/* Stages */}
              <View style={styles.stagesContainer}>
                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { backgroundColor: colors.primary }]}>
                    <CheckIcon color={colors.onPrimary} size={12} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Colleague decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Accepted by {swap.colleagueName}
                    </Text>
                  </View>
                </View>

                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { borderColor: colors.primary, borderWidth: 2 }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>2</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Manager decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      In review with another Manager
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
              The schedule stays unchanged until approval.
            </Text>
          </>
        ) : swap.status === 'PENDING_MANAGER' ? (
          /* Case 3C: Colleague accepted, awaiting Manager */
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>Colleague accepted.</Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              Your request is now with a Manager.
            </Text>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{dateFormatted}</Text>
              <Text style={[styles.timeLarge, { color: colors.onSurface }]}>{timeFormatted}</Text>
              <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                {swap.requesterName} → {swap.colleagueName}
              </Text>

              {/* Stages */}
              <View style={styles.stagesContainer}>
                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { backgroundColor: colors.primary }]}>
                    <CheckIcon color={colors.onPrimary} size={12} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Colleague decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      Accepted by {swap.colleagueName}
                    </Text>
                  </View>
                </View>

                <View style={styles.stageItem}>
                  <View style={[styles.dotCircle, { borderColor: colors.primary, borderWidth: 2 }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>2</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                      Manager decision
                    </Text>
                    <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                      In review with Manager
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
              The schedule stays unchanged until approval.
            </Text>
          </>
        ) : swap.status === 'REJECTED' ? (
          /* Case 5: Rejected */
          <>
            <View style={styles.terminalIconBox}>
              <XIcon color={colors.onSurfaceVariant} size={40} />
            </View>
            <Text style={[styles.heading, { color: colors.onSurface, textAlign: 'center' }]}>
              Request rejected
            </Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
              The request was declined. Your original assignment remains unchanged.
            </Text>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginTop: 16 },
              ]}
              onPress={onBack}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                Back to Swaps
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Case 6: Cancelled */
          <>
            <View style={styles.terminalIconBox}>
              <Repeat2Icon color={colors.onSurfaceVariant} size={40} />
            </View>
            <Text style={[styles.heading, { color: colors.onSurface, textAlign: 'center' }]}>
              Request cancelled
            </Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant, textAlign: 'center' }]}>
              This swap request was cancelled. Review your current schedule.
            </Text>

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginTop: 16 },
              ]}
              onPress={onBack}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                Back to Swaps
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Footer Actions */}
      {isColleague && swap.status === 'PENDING_COLLEAGUE' && (
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
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
            onPress={() => colleagueDecisionMutation.mutate('ACCEPT')}
            disabled={colleagueDecisionMutation.isPending}
            activeOpacity={0.8}
          >
            {colleagueDecisionMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Accept request
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
            onPress={() => colleagueDecisionMutation.mutate('REJECT')}
            disabled={colleagueDecisionMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
              Reject request
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manager Decision Footer (swap-manager from design review) */}
      {swap.status === 'PENDING_MANAGER' && isManagerOrOwner && !isRequester && !isApprovedSuccess && (
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
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
            onPress={() => managerDecisionMutation.mutate('APPROVE')}
            disabled={managerDecisionMutation.isPending}
            activeOpacity={0.8}
          >
            {managerDecisionMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Approve request
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
            onPress={() => managerDecisionMutation.mutate('REJECT')}
            disabled={managerDecisionMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
              Reject request
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isRequester && ['PENDING_COLLEAGUE', 'PENDING_MANAGER'].includes(swap.status) && (
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
              styles.secondaryButton,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
            onPress={() => setShowCancelModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
              Cancel request
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
              Cancel this request?
            </Text>
            <Text style={[styles.modalBody, { color: colors.onSurfaceVariant }]}>
              Your shift stays as it is. Your colleague will see that the request was cancelled.
            </Text>

            <View style={{ marginTop: 20, gap: 10 }}>
              <TouchableOpacity
                style={[styles.dangerButton, { backgroundColor: '#DC2626' }]}
                onPress={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerButtonText}>Cancel request</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                ]}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Keep request
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
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  timeLarge: {
    fontFamily: 'Roboto_700Bold',
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 4,
  },
  cardSub: {
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
  stagesContainer: {
    marginTop: 16,
    gap: 16,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageHeading: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 14,
  },
  stageSub: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 12,
    marginTop: 2,
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
  footnote: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    marginTop: 16,
  },
  terminalIconBox: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 32,
  },
  errorCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
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
  secondaryButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginBottom: 8,
  },
  modalBody: {
    fontFamily: 'Roboto_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
