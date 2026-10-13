import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme, titleLargeText } from '../../theme';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../state/authStore';
import { QUERY_KEYS } from '../../state/queryClient';
import {
  MeResponse,
  Role,
  TeamMembershipSummary,
  BillingOverviewResponse,
  PlanCode,
  TeamMembersResponse,
} from '@rota/shared';

// Sub-screen Views for Owner flows
import { PlanSelectionScreen } from '../billing/PlanSelectionScreen';
import { PaymentReviewScreen } from '../billing/PaymentReviewScreen';
import { CheckoutScreen } from '../billing/CheckoutScreen';
import { PaymentPendingScreen } from '../billing/PaymentPendingScreen';
import { PaymentActiveScreen } from '../billing/PaymentActiveScreen';
import { BillingOverviewScreen } from '../billing/BillingOverviewScreen';
import { ExtraSeatsScreen } from '../billing/ExtraSeatsScreen';
import { OwnerTeamScreen } from '../team/OwnerTeamScreen';
import { InviteColleagueScreen } from '../team/InviteColleagueScreen';
import { ShiftDetailsOwnerScreen, StaffShiftItem } from '../shifts/ShiftDetailsOwnerScreen';
import { ShiftDetailsStaffScreen } from '../shifts/ShiftDetailsStaffScreen';
import { RequestSwapScreen } from '../swaps/RequestSwapScreen';
import { SwapDetailScreen } from '../swaps/SwapDetailScreen';
import { StaffTeamScreen } from '../team/StaffTeamScreen';
import { CreateShiftScreen } from '../shifts/CreateShiftScreen';
import { AvailabilityScreen } from '../settings/AvailabilityScreen';
import { SettingsPreferencesScreen } from '../settings/SettingsPreferencesScreen';
import { AccountScreen } from '../settings/AccountScreen';

// Vector Icons
import {
  HouseIcon,
  CalendarDaysIcon,
  Repeat2Icon,
  ActivityNavIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  ArrowUpRightIcon,
  InfoIcon,
  UsersIcon,
  EllipsisIcon,
  UserRoundIcon,
} from '../../components/ReviewIcons';
import { SwapRequestItem, ShiftItem } from '@rota/shared';

export type MainNavTab = 'HOME' | 'SCHEDULE' | 'SWAPS' | 'ACTIVITY' | 'MORE';

export type OwnerSubScreen =
  | 'NONE'
  | 'PLAN_SELECTION'
  | 'PAYMENT_REVIEW'
  | 'CHECKOUT'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_ACTIVE'
  | 'BILLING_OVERVIEW'
  | 'EXTRA_SEATS'
  | 'OWNER_TEAM'
  | 'INVITE_COLLEAGUE'
  | 'SHIFT_DETAILS_OWNER'
  | 'CREATE_SHIFT'
  | 'AVAILABILITY'
  | 'SETTINGS_PREFERENCES'
  | 'ACCOUNT'
  | 'SHIFT_DETAILS_STAFF'
  | 'REQUEST_SWAP'
  | 'SWAP_DETAIL'
  | 'STAFF_TEAM';

interface DashboardScreenProps {
  onLogout: () => void;
  onNavigateToOnboarding: () => void;
}

const formatShiftItem = (s: ShiftItem): StaffShiftItem => {
  const start = new Date(s.startAt);
  const end = new Date(s.endAt);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayText = days[start.getDay()];
  const dayNum = String(start.getDate());
  const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
  const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const date = start.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const now = new Date();
  const isCurrent = now >= start && now <= end;

  return {
    id: s.id,
    assigneeName: s.assigneeName || 'Staff Member',
    assigneeRole: s.assigneeRole || 'Staff',
    avatarInitials: (s.assigneeName || 'Staff')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    date,
    dayText,
    dayNum,
    startTime,
    endTime,
    weeklyAvailability: `${dayText} · ${startTime}–${endTime}`,
    status: isCurrent ? 'CURRENT' : 'UPCOMING',
  };
};

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return 'Recently';
  }
}


export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onLogout,
  onNavigateToOnboarding,
}) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const displayName = user?.email?.split('@')[0] || 'Owner';
  const nameParts = displayName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const monogram = (
    nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : displayName.slice(0, 2)
  ).toUpperCase();

  // Navigation States
  const [activeTab, setActiveTab] = useState<MainNavTab>('HOME');
  const [subScreen, setSubScreen] = useState<OwnerSubScreen>('NONE');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Staff Shift Spotlight & Selection States
  const [selectedShift, setSelectedShift] = useState<StaffShiftItem | null>(null);

  // Billing Flow Active State
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>('TEAM');
  const [activePaymentAttemptId, setActivePaymentAttemptId] = useState<string | null>(null);

  // Schedule sub-states
  const [scheduleSubTab, setScheduleSubTab] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [selectedDayNum, setSelectedDayNum] = useState<number>(12);

  // Swaps sub-states
  const [swapsSubTab, setSwapsSubTab] = useState<'MY_REQUESTS' | 'FOR_ME'>('MY_REQUESTS');

  // Team Switcher Modal
  const [isTeamSwitcherVisible, setIsTeamSwitcherVisible] = useState(false);

  // Account dropdown menu (replaces the removed "More" tab)
  const [isAccountMenuVisible, setIsAccountMenuVisible] = useState(false);

  // 1. Fetch User Profile & Memberships
  const {
    data: meData,
    isLoading: isMeLoading,
    refetch: refetchMe,
  } = useQuery({
    queryKey: QUERY_KEYS.ME,
    queryFn: async () => {
      return apiRequest<MeResponse>('/api/me', {
        method: 'GET',
        requiresAuth: true,
      });
    },
  });

  const memberships: TeamMembershipSummary[] = meData?.memberships || [];
  const activeMembership =
    memberships.find((m) => m.teamId === selectedTeamId) || memberships[0];
  const currentTeamId = activeMembership?.teamId;
  const roleLabel =
    activeMembership?.role === Role.OWNER
      ? 'Owner'
      : activeMembership?.role === Role.MANAGER
      ? 'Manager'
      : 'Staff';

  // 2. Fetch Team Billing Info (Only when current team exists)
  const {
    data: billingData,
  } = useQuery({
    queryKey: ['team-billing', currentTeamId],
    queryFn: async () => {
      if (!currentTeamId) throw new Error('No team selected');
      return apiRequest<BillingOverviewResponse>(`/api/teams/${currentTeamId}/billing`, {
        method: 'GET',
        requiresAuth: true,
      });
    },
    enabled: !!currentTeamId && activeMembership?.role === Role.OWNER,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // 3. Fetch Team Members List (both Owner and Staff can view roster)
  const {
    data: teamMembersData,
    refetch: refetchTeamMembers,
  } = useQuery({
    queryKey: ['team-members', currentTeamId],
    queryFn: async () => {
      if (!currentTeamId) throw new Error('No team selected');
      return apiRequest<TeamMembersResponse>(`/api/teams/${currentTeamId}/members`, {
        method: 'GET',
        requiresAuth: true,
      });
    },
    enabled: !!currentTeamId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // 4. Fetch Team Shifts
  const {
    data: teamShiftsData,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: ['shifts', currentTeamId],
    queryFn: async () => {
      if (!currentTeamId) return [];
      return apiRequest<ShiftItem[]>(`/api/teams/${currentTeamId}/shifts`, {
        method: 'GET',
        requiresAuth: true,
      });
    },
    enabled: !!currentTeamId,
    staleTime: 30000,
  });

  // 5. Fetch Team Swaps
  const {
    data: teamSwapsData,
    refetch: refetchSwaps,
  } = useQuery({
    queryKey: ['swaps', currentTeamId],
    queryFn: async () => {
      if (!currentTeamId) return [];
      return apiRequest<SwapRequestItem[]>(`/api/teams/${currentTeamId}/swaps`, {
        method: 'GET',
        requiresAuth: true,
      });
    },
    enabled: !!currentTeamId,
    staleTime: 10000,
  });

  // 6. Fetch Team Activity
  const {
    data: teamActivityData,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['activity', currentTeamId],
    queryFn: async () => {
      if (!currentTeamId) return { items: [] };
      return apiRequest<{ items: any[] }>(`/api/teams/${currentTeamId}/activity`, {
        method: 'GET',
        requiresAuth: true,
      });
    },
    enabled: !!currentTeamId,
    staleTime: 10000,
  });

  const [selectedSwap, setSelectedSwap] = useState<SwapRequestItem | null>(null);

  // Loading State
  if (isMeLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No Memberships -> Empty State Prompting Onboarding
  if (memberships.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
          No Active Team Found
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant, marginTop: 8 }]}>
          You are signed in as {user?.email}, but you are not yet a member of any team.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 24, width: '100%' }]}
          onPress={onNavigateToOnboarding}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            Set up my team
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================
  // Render Active Sub-Screens
  // ==========================================

  if (subScreen === 'PLAN_SELECTION') {
    return (
      <PlanSelectionScreen
        selectedPlan={selectedPlanCode}
        onSelectPlan={(plan) => setSelectedPlanCode(plan)}
        onContinue={(plan) => {
          setSelectedPlanCode(plan);
          setSubScreen('PAYMENT_REVIEW');
        }}
        onBack={() => setSubScreen('NONE')}
      />
    );
  }

  if (subScreen === 'PAYMENT_REVIEW') {
    return (
      <PaymentReviewScreen
        plan={selectedPlanCode}
        onContinueToCheckout={() => setSubScreen('CHECKOUT')}
        onBack={() => setSubScreen('PLAN_SELECTION')}
      />
    );
  }

  if (subScreen === 'CHECKOUT') {
    return (
      <CheckoutScreen
        teamId={currentTeamId}
        plan={selectedPlanCode}
        onPaymentSuccess={(attemptId) => {
          setActivePaymentAttemptId(attemptId);
          queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          refetchMe();
          setSubScreen('PAYMENT_ACTIVE');
        }}
        onPaymentPending={(attemptId) => {
          setActivePaymentAttemptId(attemptId);
          setSubScreen('PAYMENT_PENDING');
        }}
        onBack={() => setSubScreen('PAYMENT_REVIEW')}
      />
    );
  }

  if (subScreen === 'PAYMENT_PENDING') {
    return (
      <PaymentPendingScreen
        teamId={currentTeamId}
        paymentAttemptId={activePaymentAttemptId || 'ATTEMPT-INIT'}
        onVerified={() => {
          queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          refetchMe();
          setSubScreen('PAYMENT_ACTIVE');
        }}
        onGoHome={() => {
          queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          refetchMe();
          setSubScreen('NONE');
        }}
        onBack={() => setSubScreen('NONE')}
      />
    );
  }

  if (subScreen === 'PAYMENT_ACTIVE') {
    return (
      <PaymentActiveScreen
        plan={selectedPlanCode}
        onGoHome={() => {
          queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          refetchMe();
          setSubScreen('NONE');
        }}
      />
    );
  }

  if (subScreen === 'BILLING_OVERVIEW') {
    if (billingData) {
      return (
        <BillingOverviewScreen
          billingData={billingData}
          onChangePlan={() => setSubScreen('PLAN_SELECTION')}
          onReviewExtraSeats={() => setSubScreen('EXTRA_SEATS')}
          onBack={() => setSubScreen('NONE')}
        />
      );
    }
  }

  if (subScreen === 'EXTRA_SEATS') {
    return (
      <ExtraSeatsScreen
        onBack={() => setSubScreen('BILLING_OVERVIEW')}
      />
    );
  }

  if (subScreen === 'OWNER_TEAM') {
    const fallbackTeamData: TeamMembersResponse = {
      teamId: currentTeamId,
      teamName: activeMembership.name,
      activeMemberCount: 1,
      pendingReservationCount: 0,
      paidSeatEntitlement: billingData?.subscription?.paidSeatEntitlement || 5,
      members: [
        {
          id: activeMembership.id,
          userId: user?.id || '',
          email: user?.email || '',
          role: Role.OWNER,
          status: 'ACTIVE',
          joinedAt: new Date().toISOString(),
          isSelf: true,
        },
      ],
      pendingInvitations: [],
    };

    return (
      <OwnerTeamScreen
        teamId={currentTeamId}
        data={teamMembersData || fallbackTeamData}
        onInvite={() => setSubScreen('INVITE_COLLEAGUE')}
        onRefresh={async () => {
          await queryClient.invalidateQueries({ queryKey: ['team-members', currentTeamId] });
          await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          await refetchTeamMembers();
        }}
        onBack={() => setSubScreen('NONE')}
      />
    );
  }

  if (subScreen === 'INVITE_COLLEAGUE') {
    return (
      <InviteColleagueScreen
        teamId={currentTeamId}
        teamName={activeMembership.name}
        activeCount={billingData?.subscription?.activeMemberCount || 1}
        pendingCount={billingData?.subscription?.pendingReservationCount || 0}
        capacity={billingData?.subscription?.paidSeatEntitlement || 5}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['team-members', currentTeamId] });
          await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          await refetchTeamMembers();
          setSubScreen('OWNER_TEAM');
        }}
        onBack={async () => {
          await queryClient.invalidateQueries({ queryKey: ['team-members', currentTeamId] });
          await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          await refetchTeamMembers();
          setSubScreen('OWNER_TEAM');
        }}
      />
    );
  }

  if (subScreen === 'SHIFT_DETAILS_OWNER') {
    if (!selectedShift) {
      setSubScreen('NONE');
      return null;
    }

    return (
      <ShiftDetailsOwnerScreen
        shift={selectedShift}
        teamName={activeMembership.name}
        onBack={() => setSubScreen('NONE')}
        onEditShift={() => setSubScreen('CREATE_SHIFT')}
        onCancelShift={async () => {
          if (selectedShift?.id) {
            try {
              await apiRequest(`/api/teams/${currentTeamId}/shifts/${selectedShift.id}`, {
                method: 'DELETE',
                requiresAuth: true,
              });
              await queryClient.invalidateQueries({ queryKey: ['shifts', currentTeamId] });
              await queryClient.invalidateQueries({ queryKey: ['activity', currentTeamId] });
            } catch (err) {
              console.error('Failed to cancel shift:', err);
            }
          }
          setSubScreen('NONE');
        }}
      />
    );
  }

  if (subScreen === 'CREATE_SHIFT') {
    return (
      <CreateShiftScreen
        teamId={currentTeamId}
        onBack={() => setSubScreen('NONE')}
        onPublish={() => {
          queryClient.invalidateQueries({ queryKey: ['shifts', currentTeamId] });
          queryClient.invalidateQueries({ queryKey: ['activity', currentTeamId] });
          setSubScreen('NONE');
          setActiveTab('SCHEDULE');
        }}
      />
    );
  }

  if (subScreen === 'AVAILABILITY') {
    return (
      <AvailabilityScreen
        teamId={currentTeamId}
        teamName={activeMembership.name}
        onBack={() => setSubScreen('NONE')}
      />
    );
  }

  if (subScreen === 'SETTINGS_PREFERENCES') {
    return <SettingsPreferencesScreen onBack={() => setSubScreen('NONE')} />;
  }

  if (subScreen === 'ACCOUNT') {
    return <AccountScreen onBack={() => setSubScreen('NONE')} onLogout={onLogout} />;
  }

  if (subScreen === 'SHIFT_DETAILS_STAFF') {
    if (!selectedShift) {
      setSubScreen('NONE');
      return null;
    }

    return (
      <ShiftDetailsStaffScreen
        shift={selectedShift}
        teamName={activeMembership.name}
        isRestricted={billingData?.subscription?.status === 'RESTRICTED'}
        onBack={() => setSubScreen('NONE')}
        onRequestSwap={(shift) => {
          setSelectedShift(shift);
          setSubScreen('REQUEST_SWAP');
        }}
      />
    );
  }

  if (subScreen === 'REQUEST_SWAP') {
    if (!selectedShift) {
      setSubScreen('NONE');
      return null;
    }

    return (
      <RequestSwapScreen
        shift={selectedShift}
        teamId={currentTeamId}
        currentUserId={user?.id || ''}
        currentUserName={displayName}
        onBack={() => setSubScreen('SHIFT_DETAILS_STAFF')}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['swaps', currentTeamId] });
          queryClient.invalidateQueries({ queryKey: ['activity', currentTeamId] });
          setSubScreen('NONE');
          setActiveTab('SWAPS');
        }}
      />
    );
  }

  if (subScreen === 'SWAP_DETAIL') {
    if (!selectedSwap) {
      setSubScreen('NONE');
      return null;
    }

    return (
      <SwapDetailScreen
        swap={selectedSwap}
        teamId={currentTeamId}
        currentUserId={user?.id || ''}
        onBack={() => setSubScreen('NONE')}
        onNavigateToSchedule={() => {
          setSubScreen('NONE');
          setActiveTab('SCHEDULE');
        }}
      />
    );
  }

  if (subScreen === 'STAFF_TEAM') {
    return (
      <StaffTeamScreen
        teamId={currentTeamId}
        teamName={activeMembership.name}
        currentUserId={user?.id || ''}
        onBack={() => setSubScreen('NONE')}
        onNavigateToAccount={() => setSubScreen('ACCOUNT')}
      />
    );
  }

  // ==========================================
  // Header Component (Matches r-header from design review)
  // ==========================================
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.outlineVariant }]}>
      <TouchableOpacity
        style={styles.teamButton}
        onPress={() => memberships.length > 1 && setIsTeamSwitcherVisible(true)}
        disabled={memberships.length <= 1}
      >
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Text style={[styles.markText, { color: colors.onPrimary }]}>R</Text>
        </View>
        <Text style={[styles.teamName, { color: colors.onSurface }]}>
          {activeMembership.name}
        </Text>
        {memberships.length > 1 && <ChevronDownIcon color={colors.onSurface} size={16} />}
      </TouchableOpacity>

      <View style={styles.headerRight}>
        <View style={[styles.rolePill, { backgroundColor: colors.surfaceContainerLow }]}>
          <Text style={[styles.rolePillText, { color: colors.onSurfaceVariant }]}>
            {roleLabel}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerAvatar, { backgroundColor: colors.primaryContainer }]}
          onPress={() => setIsAccountMenuVisible(true)}
          accessibilityLabel="Open account menu"
          accessibilityRole="button"
        >
          <Text style={[styles.headerAvatarText, { color: colors.onPrimaryContainer }]}>
            {monogram}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ==========================================
  // Tab 1: HOME (Owner Home Empty vs Owner Home Active)
  // ==========================================
  const isSubscriptionActive = billingData?.subscription?.status === 'ACTIVE';

  const renderHomeTab = () => {
    // 0. Staff Home (home-staff and home-staff-empty from design review)
    if (activeMembership.role === Role.STAFF) {
      const isRestricted = billingData?.subscription?.status === 'RESTRICTED';

      const myShifts = (teamShiftsData || [])
        .filter((s) => s.status === 'PUBLISHED' && s.assigneeId === user?.id)
        .map(formatShiftItem);

      const activeSwaps = (teamSwapsData || []).filter(
        (sw) =>
          ['PENDING_COLLEAGUE', 'PENDING_MANAGER'].includes(sw.status) &&
          (sw.requesterId === user?.id || sw.colleagueId === user?.id)
      );

      // Authentic empty state for staff with no assigned shifts (home-staff-empty)
      if (myShifts.length === 0) {
        return (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Read-only Restricted banner (restricted-staff) */}
            {isRestricted && (
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginBottom: 16 },
                ]}
              >
                <InfoIcon color={colors.primary} size={18} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Team is read-only</Text>
                  <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                    Shift changes and swaps are unavailable. Your schedule is still here. Your Owner can resolve the team’s subscription.
                  </Text>
                </View>
              </View>
            )}

            <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
              Your schedule,{'\n'}in one place.
            </Text>
            <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
              Stay up to date with your team.
            </Text>

            {/* Empty State Card matching home-staff-empty */}
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 24,
                },
              ]}
            >
              <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
                <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
              </View>
              <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No shifts yet</Text>
              <Text
                style={[
                  styles.emptySub,
                  { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 },
                ]}
              >
                Your Manager will publish your assigned shifts here.
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary, width: '100%' }]}
                onPress={() => setActiveTab('SCHEDULE')}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Open schedule
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section: Team updates */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Team updates</Text>
              <TouchableOpacity onPress={() => setActiveTab('ACTIVITY')}>
                <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>
                  Activity
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.listGroup,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => setActiveTab('ACTIVITY')}
              >
                <ActivityNavIcon color={colors.primary} size={20} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.listTitle, { color: colors.onSurface }]}>Activity</Text>
                  <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                    See changes from your team
                  </Text>
                </View>
                <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      }

      // Staff has shifts assigned:
      const nextShift = myShifts[0];
      const upcomingShifts = myShifts.slice(1);

      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isRestricted && (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginBottom: 16 },
              ]}
            >
              <InfoIcon color={colors.primary} size={18} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Team is read-only</Text>
                <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                  Shift changes and swaps are unavailable. Your schedule is still here. Your Owner can resolve the team’s subscription.
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
            {nextShift.date}
          </Text>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
            Your day,{'\n'}at a glance.
          </Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Your upcoming work, all in one place.
          </Text>

          {/* Next Shift Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant, marginBottom: 0 }]}>
                Your next shift
              </Text>
              <View
                style={[
                  styles.pillBadge,
                  { backgroundColor: colors.surfaceContainerLow },
                ]}
              >
                <CalendarDaysIcon color={colors.onPrimaryContainer} size={14} />
                <Text
                  style={[
                    styles.pillBadgeText,
                    { color: colors.onPrimaryContainer, marginLeft: 4 },
                  ]}
                >
                  {nextShift.dayText} {nextShift.dayNum}
                </Text>
              </View>
            </View>

            <Text style={[styles.spotlightTime, { color: colors.onSurface, marginTop: 8 }]}>
              {nextShift.startTime} – {nextShift.endTime}
            </Text>
            <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>
              {nextShift.date}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <UsersIcon color={colors.onSurfaceVariant} size={16} />
              <Text
                style={[
                  styles.footnote,
                  { color: colors.onSurfaceVariant, marginLeft: 6, marginTop: 0 },
                ]}
              >
                Assigned to you
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary, marginTop: 18 },
              ]}
              onPress={() => {
                setSelectedShift(nextShift);
                setSubScreen('SHIFT_DETAILS_STAFF');
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  View shift
                </Text>
                <ArrowUpRightIcon color={colors.onPrimary} size={16} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Section: Coming up (only if upcomingShifts.length > 0) */}
          {upcomingShifts.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Coming up</Text>
                <TouchableOpacity onPress={() => setActiveTab('SCHEDULE')}>
                  <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>
                    Schedule
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stack}>
                {upcomingShifts.map((shift) => (
                  <TouchableOpacity
                    key={shift.id}
                    style={[
                      styles.shiftCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => {
                      setSelectedShift(shift);
                      setSubScreen('SHIFT_DETAILS_STAFF');
                    }}
                  >
                    <View style={[styles.dateBox, { backgroundColor: colors.surfaceContainerLow }]}>
                      <Text style={[styles.dateBoxDay, { color: colors.onSurfaceVariant }]}>
                        {shift.dayText}
                      </Text>
                      <Text style={[styles.dateBoxNum, { color: colors.onSurface }]}>
                        {shift.dayNum}
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
                    <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Section: Shift changes (only if activeSwaps.length > 0) */}
          {activeSwaps.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Shift changes</Text>
                <TouchableOpacity onPress={() => setActiveTab('SWAPS')}>
                  <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>
                    Swaps
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.listGroup,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.listRow}
                  onPress={() => {
                    setSelectedSwap(activeSwaps[0]);
                    setSubScreen('SWAP_DETAIL');
                  }}
                >
                  <Repeat2Icon color={colors.primary} size={20} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                      {activeSwaps[0].status === 'PENDING_MANAGER'
                        ? 'Your swap is awaiting approval'
                        : 'Swap awaiting response'}
                    </Text>
                    <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                      {activeSwaps[0].status === 'PENDING_MANAGER'
                        ? 'Colleague accepted · Manager review next'
                        : `With ${activeSwaps[0].colleagueName}`}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      );
    }

    // 1. Owner Home Empty (when subscription is PENDING_INITIAL_PAYMENT or not yet loaded as ACTIVE)
    if (!isSubscriptionActive) {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
            Welcome to {activeMembership.name}.
          </Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Your team is ready. Start by setting up its subscription.
          </Text>

          {/* Subscription Pending Card */}
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Subscription</Text>
              <View style={[styles.rolePill, { backgroundColor: colors.surfaceContainerLow }]}>
                <Text style={[styles.rolePillText, { color: colors.onSurfaceVariant }]}>
                  Not active
                </Text>
              </View>
            </View>
            <Text style={[styles.cardBody, { color: colors.onSurfaceVariant }]}>
              Choose a plan and complete payment to establish paid access.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => setSubScreen('PLAN_SELECTION')}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Choose a plan
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section: Upcoming Staff Shifts */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Upcoming staff shifts</Text>
            <TouchableOpacity onPress={() => setActiveTab('SCHEDULE')}>
              <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>View all</Text>
            </TouchableOpacity>
          </View>

          {/* Empty State */}
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No staff shifts yet</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
              Published shifts for your staff members will appear here.
            </Text>
          </View>

          {/* D1 Policy Note */}
          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, marginTop: 24 }]}>
            <InfoIcon color={colors.primary} size={18} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Prepayment access policy</Text>
              <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
                D1 unresolved: Prepayment invitation and publishing controls are omitted pending subscription activation.
              </Text>
            </View>
          </View>
        </ScrollView>
      );
    }

    // 2. Owner Home Active (home-owner or home-empty from design review)
    const publishedShifts = (teamShiftsData || [])
      .filter((s) => s.status === 'PUBLISHED')
      .map(formatShiftItem);

    // If no shifts have been published yet by this owner:
    if (publishedShifts.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
            Your team schedule{'\n'}starts here.
          </Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Publish shifts for your team members.
          </Text>

          {/* Empty shifts card matching home-empty */}
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                borderWidth: 1,
                borderRadius: 24,
                padding: 24,
              },
            ]}
          >
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No published shifts</Text>
            <Text
              style={[
                styles.emptySub,
                { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 },
              ]}
            >
              Create your first shift to begin building your team’s schedule.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, width: '100%' }]}
              onPress={() => setSubScreen('CREATE_SHIFT')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Add a shift
                </Text>
                <PlusIcon color={colors.onPrimary} size={18} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Section: Team updates */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Team updates</Text>
            <TouchableOpacity onPress={() => setActiveTab('ACTIVITY')}>
              <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>Activity</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.listGroup,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}
          >
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => setActiveTab('ACTIVITY')}
            >
              <ActivityNavIcon color={colors.primary} size={20} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>Activity</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  See changes from your team
                </Text>
              </View>
              <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    // When published shifts exist:
    const currentStaffShift = publishedShifts.find((s) => s.status === 'CURRENT');
    const nextStaffShift = publishedShifts.find((s) => s.status === 'UPCOMING') || publishedShifts[0];
    const spotlightShift = currentStaffShift || nextStaffShift;
    const isCurrentActive = !!currentStaffShift;

    const upcomingStaffShifts = publishedShifts.filter((s) => s.id !== spotlightShift.id);
    const pendingManagerSwaps = (teamSwapsData || []).filter((s) => s.status === 'PENDING_MANAGER');

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
          {spotlightShift.date}
        </Text>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
          Your day, at a glance.
        </Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Your work and team decisions, in one place.
        </Text>

        {/* Spotlight Card: Active Staff on Shift or Next Staff on Shift */}
        <View style={[styles.spotlightCard, { backgroundColor: colors.primaryContainer }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.spotlightEyebrow, { color: colors.onPrimaryContainer }]}>
              {isCurrentActive ? 'Currently on shift' : 'Next staff on shift'}
            </Text>
            <View style={[styles.pillBadge, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.pillBadgeText, { color: colors.onPrimaryContainer }]}>
                {isCurrentActive ? '● Active now' : 'Upcoming'}
              </Text>
            </View>
          </View>

          <Text style={[styles.spotlightTime, { color: colors.onPrimaryContainer }]}>
            {`${spotlightShift.startTime} – ${spotlightShift.endTime}`}
          </Text>
          <Text style={[styles.spotlightDate, { color: colors.onPrimaryContainer }]}>
            {spotlightShift.date}
          </Text>

          <View style={styles.spotlightStaffRow}>
            <View style={[styles.staffAvatar, { backgroundColor: colors.surfaceContainerLowest }]}>
              <Text style={[styles.staffAvatarText, { color: colors.onPrimaryContainer }]}>
                {spotlightShift.avatarInitials}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <UsersIcon color={colors.onPrimaryContainer} size={15} />
                <Text style={[styles.staffNameText, { color: colors.onPrimaryContainer }]}>
                  {spotlightShift.assigneeName} · {spotlightShift.assigneeRole}
                </Text>
              </View>
              <Text style={[styles.staffStatusText, { color: colors.onPrimaryContainer, opacity: 0.85 }]}>
                {isCurrentActive
                  ? `On duty now · Shift started at ${spotlightShift.startTime}`
                  : `Next scheduled staff · Starts at ${spotlightShift.startTime}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 18 }]}
            onPress={() => {
              setSelectedShift(spotlightShift);
              setSubScreen('SHIFT_DETAILS_OWNER');
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                View shift
              </Text>
              <ArrowUpRightIcon color={colors.onPrimary} size={16} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Coming up (Upcoming Staff Shifts) */}
        {upcomingStaffShifts.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Coming up</Text>
              <TouchableOpacity onPress={() => setActiveTab('SCHEDULE')}>
                <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>View all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stack}>
              {upcomingStaffShifts.map((shift) => (
                <TouchableOpacity
                  key={shift.id}
                  style={[styles.shiftCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setSelectedShift(shift);
                    setSubScreen('SHIFT_DETAILS_OWNER');
                  }}
                >
                  <View style={[styles.dateBox, { backgroundColor: colors.surfaceContainerLow }]}>
                    <Text style={[styles.dateBoxDay, { color: colors.onSurfaceVariant }]}>{shift.dayText}</Text>
                    <Text style={[styles.dateBoxNum, { color: colors.onSurface }]}>{shift.dayNum}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.shiftTime, { color: colors.onSurface }]}>
                      {shift.startTime} – {shift.endTime}
                    </Text>
                    <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>
                      {shift.assigneeName} · {shift.assigneeRole} · {shift.date}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Section: Needs your attention (ONLY when real swaps awaiting manager approval exist) */}
        {pendingManagerSwaps.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Needs your attention</Text>
              <TouchableOpacity onPress={() => setActiveTab('SWAPS')}>
                <Text style={[styles.sectionAction, { color: colors.onPrimaryContainer }]}>View all</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.listGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => setActiveTab('SWAPS')}
              >
                <Repeat2Icon color={colors.primary} size={20} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                    {pendingManagerSwaps.length} {pendingManagerSwaps.length === 1 ? 'swap needs approval' : 'swaps need approval'}
                  </Text>
                  <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                    Colleague accepted · Manager review next
                  </Text>
                </View>
                <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Create a shift button */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 24 }]}
          onPress={() => setSubScreen('CREATE_SHIFT')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              Create a shift
            </Text>
            <PlusIcon color={colors.onPrimary} size={18} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ==========================================
  // Tab 2: SCHEDULE
  // ==========================================
  const renderScheduleTab = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <Text style={[styles.pageHeading, { color: colors.onSurface, flex: 1, alignSelf: 'center', marginBottom: 0 }]}>
          Schedule
        </Text>
        {activeMembership.role !== Role.STAFF && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}
            onPress={() => setSubScreen('CREATE_SHIFT')}
            accessibilityLabel="Create shift"
          >
            <PlusIcon color={colors.onSurface} size={18} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabsRow, { backgroundColor: colors.surfaceContainerLow }]}>
        <TouchableOpacity
          style={[styles.tabButton, scheduleSubTab === 'WEEK' && styles.tabButtonActive]}
          onPress={() => setScheduleSubTab('WEEK')}
        >
          <Text style={[styles.tabText, { color: scheduleSubTab === 'WEEK' ? colors.onSurface : colors.onSurfaceVariant }]}>
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, scheduleSubTab === 'MONTH' && styles.tabButtonActive]}
          onPress={() => setScheduleSubTab('MONTH')}
        >
          <Text style={[styles.tabText, { color: scheduleSubTab === 'MONTH' ? colors.onSurface : colors.onSurfaceVariant }]}>
            Month
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>12–18 October</Text>
        <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>2026</Text>
      </View>

      {/* Days Strip */}
      <View style={styles.daysStrip}>
        {[
          { day: 'Mon', num: 12 },
          { day: 'Tue', num: 13 },
          { day: 'Wed', num: 14 },
          { day: 'Thu', num: 15 },
          { day: 'Fri', num: 16 },
          { day: 'Sat', num: 17 },
          { day: 'Sun', num: 18 },
        ].map((item) => {
          const isSelected = selectedDayNum === item.num;
          return (
            <TouchableOpacity
              key={item.num}
              style={[styles.dayItem, isSelected && { backgroundColor: colors.primary }]}
              onPress={() => setSelectedDayNum(item.num)}
            >
              <Text style={[styles.dayText, { color: isSelected ? colors.onPrimary : colors.onSurfaceVariant }]}>
                {item.day}
              </Text>
              <Text style={[styles.dayNum, { color: isSelected ? colors.onPrimary : colors.onSurface }]}>
                {item.num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Day Staff Shifts */}
      {(() => {
        const DAY_LABELS: Record<number, string> = {
          12: 'Monday, 12 October',
          13: 'Tuesday, 13 October',
          14: 'Wednesday, 14 October',
          15: 'Thursday, 15 October',
          16: 'Friday, 16 October',
          17: 'Saturday, 17 October',
          18: 'Sunday, 18 October',
        };

        const publishedShifts = (teamShiftsData || [])
          .filter((s) => s.status === 'PUBLISHED')
          .map(formatShiftItem);

        const dayShifts = publishedShifts.filter((s) => s.dayNum === String(selectedDayNum));
        const dayTitle = DAY_LABELS[selectedDayNum] || `${selectedDayNum} October 2026`;

        return (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{dayTitle}</Text>
              {dayShifts.length > 0 && (
                <View style={[styles.rolePill, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.rolePillText, { color: colors.onSurfaceVariant }]}>
                    {dayShifts.length} {dayShifts.length === 1 ? 'shift' : 'shifts'}
                  </Text>
                </View>
              )}
            </View>

            {dayShifts.length > 0 ? (
              <View style={styles.stack}>
                {dayShifts.map((shift) => (
                  <TouchableOpacity
                    key={shift.id}
                    style={[
                      styles.shiftCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => {
                      setSelectedShift(shift);
                      setSubScreen(activeMembership.role === Role.STAFF ? 'SHIFT_DETAILS_STAFF' : 'SHIFT_DETAILS_OWNER');
                    }}
                  >
                    <View style={[styles.dateBox, { backgroundColor: colors.surfaceContainerLow }]}>
                      <Text style={[styles.dateBoxDay, { color: colors.onSurfaceVariant }]}>
                        {shift.dayText}
                      </Text>
                      <Text style={[styles.dateBoxNum, { color: colors.onSurface }]}>
                        {shift.dayNum}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.shiftTime, { color: colors.onSurface }]}>
                        {shift.startTime} – {shift.endTime}
                      </Text>
                      <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>
                        {shift.assigneeName} · {shift.assigneeRole} · {shift.date}
                      </Text>
                    </View>
                    <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyContainer, { marginTop: 16 }]}>
                <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
                  <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
                </View>
                <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No shifts scheduled</Text>
                <Text style={[styles.emptySub, { color: colors.onSurfaceVariant, marginBottom: 16 }]}>
                  {activeMembership.role !== Role.STAFF
                    ? 'No shifts have been scheduled for this day.'
                    : 'Choose another day to see your schedule.'}
                </Text>
                {activeMembership.role !== Role.STAFF && (
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      {
                        backgroundColor: colors.primary,
                        paddingHorizontal: 24,
                      },
                    ]}
                    onPress={() => setSubScreen('CREATE_SHIFT')}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                        Create a shift
                      </Text>
                      <PlusIcon color={colors.onPrimary} size={18} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        );
      })()}

      <Text style={[styles.footnote, { color: colors.onSurfaceVariant, marginTop: 24 }]}>
        Last updated today at 08:42
      </Text>
    </ScrollView>
  );

  // ==========================================
  // Tab 3: SWAPS
  // ==========================================
  const renderSwapsTab = () => {
    const rawSwaps = teamSwapsData && teamSwapsData.length > 0 ? teamSwapsData : [];
    const myRequests = rawSwaps.filter((s) => s.requesterId === user?.id);
    const forMe = rawSwaps.filter((s) => s.colleagueId === user?.id);

    const displayMyRequests = myRequests;
    const displayForMe = forMe;

    const currentList = swapsSubTab === 'MY_REQUESTS' ? displayMyRequests : displayForMe;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Swaps</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Track requests and decisions.
        </Text>

        <View style={[styles.tabsRow, { backgroundColor: colors.surfaceContainerLow }]}>
          <TouchableOpacity
            style={[styles.tabButton, swapsSubTab === 'MY_REQUESTS' && styles.tabButtonActive]}
            onPress={() => setSwapsSubTab('MY_REQUESTS')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    swapsSubTab === 'MY_REQUESTS' ? colors.onSurface : colors.onSurfaceVariant,
                },
              ]}
            >
              My requests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, swapsSubTab === 'FOR_ME' && styles.tabButtonActive]}
            onPress={() => setSwapsSubTab('FOR_ME')}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    swapsSubTab === 'FOR_ME' ? colors.onSurface : colors.onSurfaceVariant,
                },
              ]}
            >
              For me
            </Text>
          </TouchableOpacity>
        </View>

        {currentList.length === 0 ? (
          <View style={[styles.emptyContainer, { marginTop: 32 }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <Repeat2Icon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No swap requests</Text>
            <Text
              style={[
                styles.emptySub,
                { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 20 },
              ]}
            >
              {swapsSubTab === 'MY_REQUESTS'
                ? 'Start from one of your assigned shifts when you need a change.'
                : 'When a colleague requests a swap with you, it will appear here.'}
            </Text>
            {swapsSubTab === 'MY_REQUESTS' && (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary, marginTop: 18, paddingHorizontal: 24 },
                ]}
                onPress={() => setActiveTab('SCHEDULE')}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Choose a shift
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.stack}>
            {currentList.map((sw) => {
              const start = new Date(sw.requesterShiftStart);
              const end = new Date(sw.requesterShiftEnd);
              const dateStr = start.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              });
              const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(
                start.getMinutes()
              ).padStart(2, '0')} – ${String(end.getHours()).padStart(2, '0')}:${String(
                end.getMinutes()
              ).padStart(2, '0')}`;
              const isPendingManager = sw.status === 'PENDING_MANAGER';
              const isColleagueAccepted = ['PENDING_MANAGER', 'APPROVED'].includes(sw.status);

              return (
                <View
                  key={sw.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: colors.outlineVariant,
                      marginBottom: 16,
                    },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{dateStr}</Text>
                    <View style={[styles.rolePill, { backgroundColor: colors.surfaceContainerLow }]}>
                      <Text style={[styles.rolePillText, { color: colors.onSurfaceVariant }]}>
                        {sw.status === 'PENDING_COLLEAGUE'
                          ? 'Awaiting colleague'
                          : sw.status === 'PENDING_MANAGER'
                          ? 'In review'
                          : sw.status === 'APPROVED'
                          ? 'Approved'
                          : sw.status === 'REJECTED'
                          ? 'Rejected'
                          : 'Cancelled'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cardBody, { color: colors.onSurfaceVariant, marginTop: 4 }]}>
                    {timeStr} ·{' '}
                    {swapsSubTab === 'MY_REQUESTS'
                      ? `With ${sw.colleagueName}`
                      : `Requested by ${sw.requesterName}`}
                  </Text>

                  {/* 2 Stages */}
                  <View style={{ marginTop: 16, gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={[
                          styles.dotCircle,
                          {
                            backgroundColor: isColleagueAccepted
                              ? colors.primary
                              : colors.surfaceContainerLow,
                            borderColor: colors.outlineVariant,
                            borderWidth: isColleagueAccepted ? 0 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isColleagueAccepted
                              ? colors.onPrimary
                              : colors.onSurfaceVariant,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {isColleagueAccepted ? '✓' : '1'}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                          Colleague decision
                        </Text>
                        <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                          {isColleagueAccepted
                            ? `Accepted by ${sw.colleagueName}`
                            : `Waiting for ${sw.colleagueName}`}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={[
                          styles.dotCircle,
                          {
                            borderColor: isPendingManager ? colors.primary : colors.outlineVariant,
                            borderWidth: 2,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isPendingManager
                              ? colors.primary
                              : colors.onSurfaceVariant,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          2
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.stageHeading, { color: colors.onSurface }]}>
                          Manager decision
                        </Text>
                        <Text style={[styles.stageSub, { color: colors.onSurfaceVariant }]}>
                          {isPendingManager
                            ? 'In review with Manager'
                            : 'Required after colleague acceptance'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                        marginTop: 18,
                      },
                    ]}
                    onPress={() => {
                      setSelectedSwap(sw);
                      setSubScreen('SWAP_DETAIL');
                    }}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                      {swapsSubTab === 'FOR_ME' ? 'Review request' : 'View swap request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  // ==========================================
  // Tab 4: ACTIVITY
  // ==========================================
  const renderActivityTab = () => {
    const activityItems = teamActivityData?.items || [];

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Activity</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          The latest changes from {activeMembership.name}.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginBottom: 12 }]}>
          Recent updates
        </Text>

        {activityItems.length === 0 ? (
          <View style={[styles.emptyContainer, { marginTop: 32 }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <ActivityNavIcon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No activity yet</Text>
            <Text
              style={[
                styles.emptySub,
                { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 20 },
              ]}
            >
              New shifts, swap decisions and team changes will appear here.
            </Text>
          </View>
        ) : (
          <View style={[styles.listGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            {activityItems.map((event, idx) => {
              const isLast = idx === activityItems.length - 1;
              const timeFormatted = formatRelativeTime(event.createdAt);

              let IconComponent = ActivityNavIcon;
              let title = 'Activity update';
              let subtitle = `${timeFormatted} · ${event.actorName}`;

              if (event.type === 'SHIFT_PUBLISHED' || event.type === 'SHIFT_CREATED') {
                IconComponent = CalendarDaysIcon;
                title = 'Shift published';
                const payload = event.payload as any;
                subtitle = payload?.assigneeName
                  ? `${timeFormatted} · ${payload.assigneeName}`
                  : `${timeFormatted} · By ${event.actorName}`;
              } else if (event.type === 'SHIFT_CANCELLED') {
                IconComponent = CalendarDaysIcon;
                title = 'Shift cancelled';
                subtitle = `${timeFormatted} · By ${event.actorName}`;
              } else if (event.type === 'SWAP_REQUESTED') {
                IconComponent = Repeat2Icon;
                title = 'Swap requested';
                subtitle = `${timeFormatted} · By ${event.actorName}`;
              } else if (event.type === 'SWAP_ACCEPTED') {
                IconComponent = Repeat2Icon;
                title = 'Swap accepted by colleague';
                subtitle = `${timeFormatted} · Manager review next`;
              } else if (event.type === 'SWAP_APPROVED') {
                IconComponent = Repeat2Icon;
                title = 'Swap approved';
                subtitle = `${timeFormatted} · Schedule updated`;
              } else if (event.type === 'SWAP_REJECTED') {
                IconComponent = Repeat2Icon;
                title = 'Swap rejected';
                subtitle = `${timeFormatted} · Original shift kept`;
              } else if (event.type === 'SWAP_CANCELLED') {
                IconComponent = Repeat2Icon;
                title = 'Swap cancelled';
                subtitle = `${timeFormatted} · By ${event.actorName}`;
              } else if (event.type === 'MEMBER_JOINED') {
                IconComponent = UsersIcon;
                title = `${event.actorName} joined ${activeMembership.name}`;
                subtitle = `${timeFormatted} · New team member`;
              }

              return (
                <View
                  key={event.id}
                  style={[
                    styles.listRow,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
                  ]}
                >
                  <IconComponent color={colors.primary} size={20} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.listTitle, { color: colors.onSurface }]}>{title}</Text>
                    <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                      {subtitle}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                </View>
              );
            })}
          </View>
        )}

        {activityItems.length > 0 && (
          <Text style={[styles.footnote, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 24 }]}>
            You’ve reached the end.
          </Text>
        )}
      </ScrollView>
    );
  };

  // ==========================================
  // Tab 5: MORE
  // ==========================================
  const isStaff = activeMembership.role === Role.STAFF;

  const accountMenuItems: Array<{
    key: OwnerSubScreen;
    icon: string;
    title: string;
    subtitle: string;
  }> = isStaff
    ? [
        { key: 'STAFF_TEAM', icon: '👥', title: 'Team', subtitle: 'Your team membership' },
        { key: 'AVAILABILITY', icon: '🕒', title: 'Availability', subtitle: 'Your weekly availability' },
        { key: 'SETTINGS_PREFERENCES', icon: '⚙️', title: 'Settings', subtitle: 'Notifications and preferences' },
        { key: 'ACCOUNT', icon: '🛡️', title: 'Account', subtitle: 'Sign-in and device sessions' },
      ]
    : [
        { key: 'OWNER_TEAM', icon: '👥', title: 'Team', subtitle: 'Members and invitations' },
        { key: 'BILLING_OVERVIEW', icon: '💳', title: 'Billing', subtitle: 'Plan, seats and payment status' },
        { key: 'AVAILABILITY', icon: '🕒', title: 'Availability', subtitle: 'Your weekly availability' },
        { key: 'SETTINGS_PREFERENCES', icon: '⚙️', title: 'Settings', subtitle: 'Notifications and preferences' },
        { key: 'ACCOUNT', icon: '🛡️', title: 'Account', subtitle: 'Sign-in and device sessions' },
      ];

  const renderMoreTab = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
        Your team{'\n'}& account.
      </Text>

      {/* User profile card */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: colors.primaryContainer, width: 44, height: 44, borderRadius: 22 },
            ]}
          >
            <Text
              style={[
                styles.headerAvatarText,
                { color: colors.onPrimaryContainer, fontSize: 16 },
              ]}
            >
              {monogram}
            </Text>
          </View>
          <View style={{ marginLeft: 14 }}>
            <Text style={[styles.cardTitle, { color: colors.onSurface, fontSize: 18 }]}>
              {displayName}
            </Text>
            <Text
              style={[styles.listSubtitle, { color: colors.onSurfaceVariant, marginTop: 2 }]}
            >
              {roleLabel} · {activeMembership.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Items listgroup */}
      <View
        style={[
          styles.listGroup,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        {accountMenuItems.map((item, index) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.listRow,
              index < accountMenuItems.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.outlineVariant,
              },
            ]}
            onPress={async () => {
              if (item.key === 'OWNER_TEAM') {
                await queryClient.invalidateQueries({ queryKey: ['team-members', currentTeamId] });
                await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
                await refetchTeamMembers();
              }
              setSubScreen(item.key);
            }}
          >
            <View style={styles.menuIconContainer}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]}>{item.title}</Text>
              <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                {item.subtitle}
              </Text>
            </View>
            <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderAccountMenu = () =>
    isAccountMenuVisible ? (
      <>
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setIsAccountMenuVisible(false)}
          accessibilityLabel="Close account menu"
        />
        <View
          style={[
            styles.accountMenu,
            { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
          ]}
        >
          <View
            style={[styles.accountMenuHeader, { borderBottomColor: colors.outlineVariant }]}
          >
            <View style={[styles.headerAvatar, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.headerAvatarText, { color: colors.onPrimaryContainer }]}>
                {monogram}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text
                style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {roleLabel} · {activeMembership.name}
              </Text>
            </View>
          </View>

          {accountMenuItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.accountMenuItem,
                index < accountMenuItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.outlineVariant,
                },
              ]}
              onPress={async () => {
                setIsAccountMenuVisible(false);
                if (item.key === 'OWNER_TEAM') {
                  await queryClient.invalidateQueries({ queryKey: ['team-members', currentTeamId] });
                  await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
                  await refetchTeamMembers();
                }
                setSubScreen(item.key);
              }}
            >
              <View style={styles.menuIconContainer}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>{item.title}</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  {item.subtitle}
                </Text>
              </View>
              <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
            </TouchableOpacity>
          ))}
        </View>
      </>
    ) : null;

  // ==========================================
  // Bottom Navigation Bar (5 Items)
  // ==========================================
  const navTabs: Array<{ id: MainNavTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'HOME',
      label: 'Home',
      icon: (
        <HouseIcon
          color={activeTab === 'HOME' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          size={20}
        />
      ),
    },
    {
      id: 'SCHEDULE',
      label: 'Schedule',
      icon: (
        <CalendarDaysIcon
          color={activeTab === 'SCHEDULE' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          size={20}
        />
      ),
    },
    {
      id: 'SWAPS',
      label: 'Swaps',
      icon: (
        <Repeat2Icon
          color={activeTab === 'SWAPS' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          size={20}
        />
      ),
    },
    {
      id: 'ACTIVITY',
      label: 'Activity',
      icon: (
        <ActivityNavIcon
          color={activeTab === 'ACTIVITY' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          size={20}
        />
      ),
    },
    {
      id: 'MORE',
      label: 'More',
      icon: (
        <EllipsisIcon
          color={activeTab === 'MORE' ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          size={20}
        />
      ),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      <View style={styles.mainContent}>
        {activeTab === 'HOME' && renderHomeTab()}
        {activeTab === 'SCHEDULE' && renderScheduleTab()}
        {activeTab === 'SWAPS' && renderSwapsTab()}
        {activeTab === 'ACTIVITY' && renderActivityTab()}
        {activeTab === 'MORE' && renderMoreTab()}
      </View>

      {/* 5-item Bottom Navigation Bar */}
      <View style={[styles.navBar, { backgroundColor: colors.surfaceContainerLowest, borderTopColor: colors.outlineVariant }]}>
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.navButton}
              onPress={() => {
                setActiveTab(tab.id);
                setSubScreen('NONE');
              }}
              accessibilityLabel={tab.label}
            >
              <View
                style={[
                  styles.navIconBox,
                  isActive && { backgroundColor: colors.primaryContainer },
                ]}
              >
                {tab.icon}
              </View>
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? colors.primary : colors.onSurfaceVariant },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating account dropdown (opened from the header avatar) */}
      {renderAccountMenu()}

      {/* Team Switcher Modal */}
      <Modal
        visible={isTeamSwitcherVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTeamSwitcherVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheetContent, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Switch team.</Text>
            <Text style={[styles.sheetBody, { color: colors.onSurfaceVariant }]}>
              Your role belongs to each team membership.
            </Text>

            <View style={{ marginTop: 20 }}>
              {memberships.map((m) => {
                const isSelected = m.teamId === activeMembership.teamId;
                return (
                  <TouchableOpacity
                    key={m.teamId}
                    style={[styles.listRow, { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }]}
                    onPress={() => {
                      setSelectedTeamId(m.teamId);
                      setIsTeamSwitcherVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listTitle, { color: colors.onSurface }]}>{m.name}</Text>
                      <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                        {m.role === Role.OWNER ? 'Owner · Current team' : 'Staff'}
                      </Text>
                    </View>
                    {isSelected && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
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
  teamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markText: {
    fontSize: 16,
    fontWeight: '800',
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageHeading: {
    ...titleLargeText,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  pageLead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  spotlightCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
  },
  spotlightEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  spotlightTime: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  spotlightDate: {
    fontSize: 14,
    marginTop: 4,
  },
  spotlightMeta: {
    marginTop: 14,
  },
  spotlightMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  stack: {
    gap: 12,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  dateBox: {
    width: 48,
    height: 58,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBoxDay: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateBoxNum: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  shiftTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  shiftMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  listGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyTitle: {
    ...titleLargeText,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    height: 50,
    borderRadius: 9999,
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
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  daysStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  dayItem: {
    width: 44,
    height: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  dotCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  stageSub: {
    fontSize: 12,
    marginTop: 2,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  accountMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 280,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    overflow: 'hidden',
    zIndex: 11,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  accountMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
  },
  navIconBox: {
    width: 48,
    height: 28,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 9999,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  sheetBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotlightStaffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  staffNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  staffStatusText: {
    fontSize: 12,
    marginTop: 2,
  },
  rosterFilterBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    marginBottom: 20,
  },
  rosterFilterBtn: {
    flex: 1,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rosterFilterBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rosterFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
