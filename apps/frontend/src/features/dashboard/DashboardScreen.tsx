import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  Vibration,
  Alert,
  AppState,
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
import { InsetDivider } from '../../components/InsetDivider';
import { BottomSheet } from '../../components/BottomSheet';
import { ActivityFeed } from '../feed';

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
  BellIcon,
  CreditCardIcon,
  ClockIcon,
  SettingsIcon,
  ShieldIcon,
  CheckIcon,
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
  | 'EDIT_SHIFT'
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
  initialTab?: MainNavTab;
  initialSubScreen?: OwnerSubScreen;
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekDaysForDate(targetDateString: string) {
  const baseDate = parseLocalDate(targetDateString);
  const dayOfWeek = baseDate.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = getLocalDateString();
  const days = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateString = getLocalDateString(cur);

    days.push({
      date: cur,
      dateString,
      day: dayNames[i],
      num: cur.getDate(),
      isToday: dateString === todayStr,
    });
  }

  const rangeTitle = `${monday.getDate()} ${monday.toLocaleDateString('en-GB', { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString('en-GB', { month: 'short' })}`;
  const yearTitle = `${sunday.getFullYear()}`;

  return { monday, sunday, days, rangeTitle, yearTitle };
}

interface MonthCalendarDay {
  date: Date;
  dateString: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function getMonthDaysForDate(targetDateString: string) {
  const baseDate = parseLocalDate(targetDateString);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const todayStr = getLocalDateString();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Day of week: 0=Sun, 1=Mon, ..., 6=Sat -> adjust to Mon=0 ... Sun=6
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const padBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const days: MonthCalendarDay[] = [];

  // Trailing days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = padBefore - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const date = new Date(year, month - 1, d);
    const dateString = getLocalDateString(date);
    days.push({
      date,
      dateString,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateString === todayStr,
    });
  }

  // Days of current month
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    const dateString = getLocalDateString(date);
    days.push({
      date,
      dateString,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateString === todayStr,
    });
  }

  // Padding days from next month to complete the 7-column grid
  const totalCells = days.length;
  const padAfter = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= padAfter; d++) {
    const date = new Date(year, month + 1, d);
    const dateString = getLocalDateString(date);
    days.push({
      date,
      dateString,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateString === todayStr,
    });
  }

  const monthTitle = firstDayOfMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const isCurrentMonth = todayStr.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);

  return {
    year,
    month,
    monthTitle,
    isCurrentMonth,
    days,
  };
}

const formatShiftItem = (s: ShiftItem, now: Date = new Date()): StaffShiftItem => {
  const start = new Date(s.startAt);
  const end = new Date(s.endAt);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayText = days[start.getDay()];
  const dayNum = String(start.getDate());
  const dateString = getLocalDateString(start);
  const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
  const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const date = start.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const isCurrent = now >= start && now <= end;
  const isPast = now > end;

  return {
    id: s.id,
    assigneeId: s.assigneeId,
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
    dateString,
    startAt: s.startAt,
    endAt: s.endAt,
    startTime,
    endTime,
    weeklyAvailability: `${dayText} · ${startTime}–${endTime}`,
    status: isCurrent ? 'CURRENT' : isPast ? 'COMPLETED' : 'UPCOMING',
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
  initialTab,
  initialSubScreen,
}) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);

  // Navigation States
  const [activeTab, setActiveTab] = useState<MainNavTab>(initialTab || 'HOME');
  const [subScreen, setSubScreen] = useState<OwnerSubScreen>(initialSubScreen || 'NONE');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (initialSubScreen) {
      setSubScreen(initialSubScreen);
    }
  }, [initialTab, initialSubScreen]);

  // Staff Shift Spotlight & Selection States
  const [selectedShift, setSelectedShift] = useState<StaffShiftItem | null>(null);

  // Billing Flow Active State
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>('TEAM');
  const [activePaymentAttemptId, setActivePaymentAttemptId] = useState<string | null>(null);
  const [checkoutTargetSeats, setCheckoutTargetSeats] = useState<number | undefined>(undefined);
  const [lastPaymentContext, setLastPaymentContext] = useState<{
    planCode: PlanCode;
    targetSeats?: number;
    previousSeats?: number;
    previousPlanCode?: PlanCode;
    isExtraSeats?: boolean;
    isUpgrade?: boolean;
  } | null>(null);

  // Schedule sub-states: Default to current local date
  const [scheduleSubTab, setScheduleSubTab] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [selectedDateString, setSelectedDateString] = useState<string>(getLocalDateString());
  const [viewingDateString, setViewingDateString] = useState<string>(getLocalDateString());

  // Swaps sub-states
  const [swapsSubTab, setSwapsSubTab] = useState<'NEEDS_APPROVAL' | 'MY_REQUESTS' | 'FOR_ME'>('MY_REQUESTS');

  // Team Switcher Modal
  const [isTeamSwitcherVisible, setIsTeamSwitcherVisible] = useState(false);

  // Account dropdown menu
  const [isAccountMenuVisible, setIsAccountMenuVisible] = useState(false);

  // Floating quick-action menu (owner/manager dashboard FAB)
  const [isQuickActionMenuVisible, setIsQuickActionMenuVisible] = useState(false);

  // Real-time local clock ticker (updates every 30s and on app foreground without network queries)
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 30000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setCurrentTimestamp(Date.now());
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  // In-app Notification Banner State & Activity Unread Dot
  const [inAppNotification, setInAppNotification] = useState<{
    id: string;
    title: string;
    message: string;
    shiftId?: string;
    dateString?: string;
  } | null>(null);
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const prevShiftIdsRef = useRef<Set<string> | null>(null);
  const cancelledShiftIdsRef = useRef<Set<string>>(new Set());

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

  const currentUserId = authUser?.id || meData?.id;
  const currentUserEmail = authUser?.email || meData?.email;
  const user = authUser || (meData?.id ? { id: meData.id, email: meData.email } : null);

  // Sync user profile to auth store if meData has resolved
  useEffect(() => {
    if (meData?.id && (!authUser || !authUser.id)) {
      setAuthUser({ id: meData.id, email: meData.email });
    }
  }, [meData, authUser, setAuthUser]);

  const displayName = currentUserEmail?.split('@')[0] || 'Member';
  const nameParts = displayName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const monogram = (
    nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : displayName.slice(0, 2)
  ).toUpperCase();

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

  // 2. Fetch Team Billing Info
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

  // 3. Fetch Team Members List
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
    staleTime: 60000,
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
    staleTime: 60000,
  });

  // 6. Activity Feed Refetch Helper
  const refetchActivity = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
  }, [queryClient]);

  // Refetch when user switches tabs and default schedule calendar to today
  useEffect(() => {
    if (activeTab === 'SCHEDULE') {
      const today = getLocalDateString();
      setSelectedDateString(today);
      setViewingDateString(today);
      refetchShifts();
    } else if (activeTab === 'HOME') {
      refetchShifts();
    } else if (activeTab === 'SWAPS') {
      refetchSwaps();
    } else if (activeTab === 'ACTIVITY') {
      refetchActivity();
    }
  }, [activeTab]);

  // Live in-app notification when a new shift is published for staff
  useEffect(() => {
    if (!teamShiftsData) return;
    const currentShiftIds = new Set(teamShiftsData.map((s) => s.id));

    if (prevShiftIdsRef.current !== null) {
      const newShifts = teamShiftsData.filter(
        (s) => !prevShiftIdsRef.current!.has(s.id) && !cancelledShiftIdsRef.current.has(s.id)
      );
      if (newShifts.length > 0) {
        // Find if any newly published shift belongs to the current user
        const assignedToMe = newShifts.find(
          (s) =>
            s.assigneeId === currentUserId ||
            (currentUserEmail && s.assigneeName === currentUserEmail.split('@')[0])
        );

        if (assignedToMe) {
          const formatted = formatShiftItem(assignedToMe);
          try {
            Vibration.vibrate([0, 250, 100, 250]);
          } catch {}

          setInAppNotification({
            id: assignedToMe.id,
            title: 'New Shift Scheduled!',
            message: `You have been assigned a shift on ${formatted.date} (${formatted.startTime} – ${formatted.endTime}).`,
            shiftId: assignedToMe.id,
            dateString: formatted.dateString,
          });
          setHasUnreadActivity(true);
        } else if (activeMembership?.role !== Role.STAFF) {
          const newest = newShifts[0];
          const formatted = formatShiftItem(newest);
          setInAppNotification({
            id: newest.id,
            title: 'Shift Published',
            message: `Shift for ${formatted.assigneeName} on ${formatted.date} (${formatted.startTime} – ${formatted.endTime}) is live.`,
            shiftId: newest.id,
            dateString: formatted.dateString,
          });
          setHasUnreadActivity(true);
        }
      }
    }

    prevShiftIdsRef.current = currentShiftIds;
  }, [teamShiftsData, currentUserId, currentUserEmail, activeMembership?.role]);

  // Auto-dismiss in-app notification banner after 7 seconds
  useEffect(() => {
    if (inAppNotification) {
      const timer = setTimeout(() => {
        setInAppNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [inAppNotification]);

  // Pull-to-refresh handler across screens
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchShifts(),
        refetchActivity(),
        refetchSwaps(),
        refetchTeamMembers(),
        refetchMe(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

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

  // Open plan selection with the team's current plan highlighted by default.
  const openPlanSelection = () => {
    const currentPlanCode = billingData?.plan?.code as PlanCode | undefined;
    if (currentPlanCode) {
      setSelectedPlanCode(currentPlanCode);
    }
    setSubScreen('PLAN_SELECTION');
  };

  if (subScreen === 'PLAN_SELECTION') {
    return (
      <PlanSelectionScreen
        selectedPlan={selectedPlanCode}
        currentPlan={billingData?.plan?.code as PlanCode | undefined}
        isCurrentPlanActive={billingData?.subscription?.status === 'ACTIVE'}
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
        onContinueToCheckout={() => {
          const currentPlan = billingData?.plan?.code as PlanCode | undefined;
          const isUpgrade = Boolean(
            currentPlan &&
              currentPlan !== selectedPlanCode &&
              billingData?.subscription?.status === 'ACTIVE'
          );
          setLastPaymentContext({
            planCode: selectedPlanCode,
            targetSeats: checkoutTargetSeats,
            previousSeats: billingData?.subscription?.paidSeatEntitlement,
            previousPlanCode: currentPlan,
            isExtraSeats: false,
            isUpgrade,
          });
          setSubScreen('CHECKOUT');
        }}
        onBack={() => setSubScreen('PLAN_SELECTION')}
      />
    );
  }

  if (subScreen === 'CHECKOUT') {
    return (
      <CheckoutScreen
        teamId={currentTeamId}
        plan={selectedPlanCode}
        targetSeats={checkoutTargetSeats}
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
        onBack={() => {
          if (checkoutTargetSeats !== undefined) {
            setCheckoutTargetSeats(undefined);
            setSubScreen('EXTRA_SEATS');
          } else {
            setSubScreen('PAYMENT_REVIEW');
          }
        }}
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
          setLastPaymentContext(null);
          setCheckoutTargetSeats(undefined);
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
        plan={lastPaymentContext?.planCode || selectedPlanCode}
        targetSeats={lastPaymentContext?.targetSeats}
        previousSeats={lastPaymentContext?.previousSeats}
        previousPlanCode={lastPaymentContext?.previousPlanCode}
        isExtraSeats={lastPaymentContext?.isExtraSeats}
        isUpgrade={lastPaymentContext?.isUpgrade}
        onGoHome={() => {
          setLastPaymentContext(null);
          setCheckoutTargetSeats(undefined);
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
          onChangePlan={openPlanSelection}
          onReviewExtraSeats={() => setSubScreen('EXTRA_SEATS')}
          onCancelSubscription={async () => {
            await apiRequest(`/api/teams/${currentTeamId}/billing/cancel`, {
              method: 'POST',
            });
            await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          }}
          onResumeSubscription={async () => {
            await apiRequest(`/api/teams/${currentTeamId}/billing/resume`, {
              method: 'POST',
            });
            await queryClient.invalidateQueries({ queryKey: ['team-billing', currentTeamId] });
          }}
          onBack={() => setSubScreen('NONE')}
        />
      );
    }
  }

  if (subScreen === 'EXTRA_SEATS') {
    if (billingData) {
      return (
        <ExtraSeatsScreen
          billingData={billingData}
          teamId={currentTeamId}
          onChangePlan={openPlanSelection}
          onProceedToCheckout={(targetSeats) => {
            const planCode = (billingData.plan?.code as PlanCode) || 'TEAM';
            setSelectedPlanCode(planCode);
            setCheckoutTargetSeats(targetSeats);
            setLastPaymentContext({
              planCode,
              targetSeats,
              previousSeats: billingData.subscription?.paidSeatEntitlement || 15,
              previousPlanCode: planCode,
              isExtraSeats: true,
              isUpgrade: false,
            });
            setSubScreen('CHECKOUT');
          }}
          onBack={() => setSubScreen('BILLING_OVERVIEW')}
        />
      );
    }
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
        userRole={activeMembership.role}
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

  if (subScreen === 'EDIT_SHIFT') {
    const isShiftCompleted =
      selectedShift?.status === 'COMPLETED' ||
      (selectedShift?.endAt ? new Date(currentTimestamp) > new Date(selectedShift.endAt) : false);

    if (isShiftCompleted) {
      setSubScreen('SHIFT_DETAILS_OWNER');
      return null;
    }

    return (
      <CreateShiftScreen
        teamId={currentTeamId}
        shiftToEdit={selectedShift || undefined}
        onBack={() => setSubScreen('SHIFT_DETAILS_OWNER')}
        onPublish={async () => {
          await queryClient.invalidateQueries({ queryKey: ['shifts'] });
          await queryClient.invalidateQueries({ queryKey: ['activity'] });
          await Promise.all([refetchShifts(), refetchActivity()]);
          setSelectedShift(null);
          setSubScreen('NONE');
          setActiveTab('SCHEDULE');
        }}
      />
    );
  }

  if (subScreen === 'CREATE_SHIFT') {
    return (
      <CreateShiftScreen
        teamId={currentTeamId}
        initialDate={selectedDateString}
        onBack={() => setSubScreen('NONE')}
        onPublish={async () => {
          await queryClient.invalidateQueries({ queryKey: ['shifts'] });
          await queryClient.invalidateQueries({ queryKey: ['activity'] });
          await Promise.all([refetchShifts(), refetchActivity()]);
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

  if (subScreen === 'REQUEST_SWAP') {
    if (!selectedShift) {
      setSubScreen('NONE');
      return null;
    }

    const isShiftCompleted =
      selectedShift.status === 'COMPLETED' ||
      (selectedShift.endAt ? new Date(currentTimestamp) > new Date(selectedShift.endAt) : false);

    if (isShiftCompleted) {
      setSubScreen(activeMembership.role === Role.STAFF ? 'SHIFT_DETAILS_STAFF' : 'SHIFT_DETAILS_OWNER');
      return null;
    }

    return (
      <RequestSwapScreen
        shift={selectedShift}
        teamId={currentTeamId}
        currentUserId={user?.id || ''}
        currentUserName={displayName}
        onBack={() => setSubScreen(activeMembership.role === Role.STAFF ? 'SHIFT_DETAILS_STAFF' : 'SHIFT_DETAILS_OWNER')}
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
        userRole={activeMembership.role}
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
        userRole={activeMembership.role}
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
          onPress={() => {
            setIsQuickActionMenuVisible(false);
            setIsAccountMenuVisible(true);
          }}
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

  // Shift details is presented as a bottom sheet over the current tab
  const isShiftDetailsVisible =
    !!selectedShift &&
    (subScreen === 'SHIFT_DETAILS_OWNER' || subScreen === 'SHIFT_DETAILS_STAFF');

  const closeShiftDetails = () => {
    setSubScreen('NONE');
  };

  const renderShiftDetailsSheet = () => (
    <BottomSheet visible={isShiftDetailsVisible} onClose={closeShiftDetails}>
      {selectedShift && activeMembership.role === Role.STAFF ? (
        <ShiftDetailsStaffScreen
          shift={selectedShift}
          teamName={activeMembership.name}
          isRestricted={billingData?.subscription?.status === 'RESTRICTED'}
          onBack={closeShiftDetails}
          onRequestSwap={(shift) => {
            setSelectedShift(shift);
            setSubScreen('REQUEST_SWAP');
          }}
        />
      ) : selectedShift ? (
        <ShiftDetailsOwnerScreen
          shift={selectedShift}
          teamName={activeMembership.name}
          isOwnShift={selectedShift.assigneeId === (user?.id || currentUserId)}
          onBack={closeShiftDetails}
          onEditShift={() => setSubScreen('EDIT_SHIFT')}
          onRequestSwap={(shift) => {
            setSelectedShift(shift);
            setSubScreen('REQUEST_SWAP');
          }}
          onCancelShift={async () => {
            if (selectedShift?.id) {
              const shiftIdToDelete = selectedShift.id;
              cancelledShiftIdsRef.current.add(shiftIdToDelete);

              // 1. Optimistically remove shift from TanStack Query cache so UI reflects immediately
              if (currentTeamId) {
                queryClient.setQueryData<ShiftItem[]>(['shifts', currentTeamId], (old) => {
                  if (!old) return [];
                  return old.filter((s) => s.id !== shiftIdToDelete);
                });
              }

              try {
                // 2. Execute deletion on the backend (marks CANCELLED on PostgreSQL, cancels swaps, creates activity)
                await apiRequest(`/api/teams/${currentTeamId}/shifts/${shiftIdToDelete}`, {
                  method: 'DELETE',
                  requiresAuth: true,
                });

                // 3. Invalidate all shift and activity queries and refetch authoritative state
                await queryClient.invalidateQueries({ queryKey: ['shifts'] });
                await queryClient.invalidateQueries({ queryKey: ['activity'] });
                await Promise.all([refetchShifts(), refetchActivity()]);

                // 4. Show clear confirmation banner that shift was cancelled
                setInAppNotification({
                  id: shiftIdToDelete,
                  title: 'Shift Cancelled',
                  message: 'The shift was removed from the schedule.',
                });
              } catch (err: any) {
                cancelledShiftIdsRef.current.delete(shiftIdToDelete);
                console.error('Failed to cancel shift:', err);
                // Revert optimistic cache removal on error
                await refetchShifts();
                Alert.alert('Error', err.message || 'Failed to cancel shift.');
                throw err;
              }
            }
            closeShiftDetails();
          }}
        />
      ) : null}
    </BottomSheet>
  );

  const renderHomeTab = () => {
    const now = new Date(currentTimestamp);

    // 0. Staff Home (home-staff and home-staff-empty from design review)
    if (activeMembership.role === Role.STAFF) {
      const isRestricted = billingData?.subscription?.status === 'RESTRICTED';

      const myShifts = (teamShiftsData || [])
        .filter(
          (s) =>
            s.status === 'PUBLISHED' &&
            (s.assigneeId === currentUserId ||
              (currentUserEmail && s.assigneeName === currentUserEmail.split('@')[0]))
        )
        .map((s) => formatShiftItem(s, now));

      const activeOrUpcomingShifts = myShifts.filter(
        (s) => s.status === 'CURRENT' || s.status === 'UPCOMING'
      );

      const activeSwaps = (teamSwapsData || []).filter(
        (sw) =>
          ['PENDING_COLLEAGUE', 'PENDING_MANAGER'].includes(sw.status) &&
          (sw.requesterId === currentUserId || sw.colleagueId === currentUserId)
      );

      // Authentic empty state for staff with no active or upcoming shifts
      if (activeOrUpcomingShifts.length === 0) {
        return (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {/* Read-only Restricted banner (restricted-staff) */}
            {isRestricted && (
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: colors.surfaceContainerLow, marginBottom: 16 },
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
              Your schedule, in one place.
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
                  borderWidth: 0,
                  borderRadius: 24,
                  padding: 24,
                },
              ]}
            >
              <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
                <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
              </View>
              <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>
                {myShifts.length > 0 ? 'No upcoming shifts' : 'No shifts yet'}
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 },
                ]}
              >
                {myShifts.length > 0
                  ? 'All assigned shifts have ended. Check the schedule to view your completed and future work.'
                  : 'Your Manager will publish your assigned shifts here.'}
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
                  borderWidth: 0,
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

      // Staff has active or upcoming shifts assigned:
      const nextShift = activeOrUpcomingShifts[0];
      const upcomingShifts = activeOrUpcomingShifts.slice(1);

      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {isRestricted && (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.surfaceContainerLow, marginBottom: 16 },
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
            Your day, at a glance.
          </Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Your upcoming work, all in one place.
          </Text>

          {/* Spotlight Card: Your next shift (matching owner's spotlightCard & rota-design-review.html r-next) */}
          <View style={[styles.spotlightCard, { backgroundColor: colors.primaryContainer }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.spotlightEyebrow, { color: colors.onPrimaryContainer }]}>
                {nextShift.status === 'CURRENT' ? 'You are on shift now' : 'Your next shift'}
              </Text>
              <View style={[styles.pillBadge, { backgroundColor: colors.surfaceContainerLowest }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CalendarDaysIcon color={colors.onPrimaryContainer} size={13} />
                  <Text style={[styles.pillBadgeText, { color: colors.onPrimaryContainer }]}>
                    {nextShift.status === 'CURRENT'
                      ? '● Active now'
                      : nextShift.dateString === getLocalDateString(now)
                      ? 'Today'
                      : `${nextShift.dayText} ${nextShift.dayNum}`}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.spotlightTime, { color: colors.onPrimaryContainer }]}>
              {nextShift.startTime} – {nextShift.endTime}
            </Text>
            <Text style={[styles.spotlightDate, { color: colors.onPrimaryContainer, opacity: 0.9 }]}>
              {nextShift.date}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              <UsersIcon color={colors.onPrimaryContainer} size={16} />
              <Text
                style={[
                  styles.footnote,
                  { color: colors.onPrimaryContainer, marginLeft: 8, marginTop: 0, fontWeight: '600' },
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

    // 1. Manager Home (home-manager from design review)
    // 1. Manager Home (home-manager from design review)
    if (activeMembership.role === Role.MANAGER) {
      const isRestricted = billingData?.subscription?.status === 'RESTRICTED';

      const myShifts = (teamShiftsData || [])
        .filter(
          (s) =>
            s.status === 'PUBLISHED' &&
            (s.assigneeId === currentUserId ||
              (currentUserEmail && s.assigneeName === currentUserEmail.split('@')[0]))
        )
        .map((s) => formatShiftItem(s, now));

      const publishedShifts = (teamShiftsData || [])
        .filter((s) => s.status === 'PUBLISHED')
        .map((s) => formatShiftItem(s, now));

      const activeOrUpcomingMyShifts = myShifts.filter(
        (s) => s.status === 'CURRENT' || s.status === 'UPCOMING'
      );
      const activeOrUpcomingTeamShifts = publishedShifts.filter(
        (s) => s.status === 'CURRENT' || s.status === 'UPCOMING'
      );

      const pendingManagerSwaps = (teamSwapsData || []).filter((s) => s.status === 'PENDING_MANAGER');

      const nextOwnShift = activeOrUpcomingMyShifts[0];
      const nextTeamShift = activeOrUpcomingTeamShifts.find((s) => s.status === 'CURRENT') || activeOrUpcomingTeamShifts[0];
      const spotlightShift = nextOwnShift || nextTeamShift;
      const isOwnSpotlight = !!nextOwnShift;

      const upcomingShifts = isOwnSpotlight
        ? (activeOrUpcomingMyShifts.length > 1
            ? activeOrUpcomingMyShifts.slice(1)
            : activeOrUpcomingTeamShifts.filter((s) => s.id !== spotlightShift?.id))
        : activeOrUpcomingTeamShifts.filter((s) => s.id !== spotlightShift?.id);

      const todayObj = new Date(currentTimestamp);
      const todayFormatted = todayObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      return (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, styles.scrollContentWithFab]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {isRestricted && (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.surfaceContainerLow, marginBottom: 16 },
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
            {todayFormatted}
          </Text>
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
            Your day,{'\n'}at a glance.
          </Text>
          <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
            Your work and team decisions, in one place.
          </Text>

          {/* Spotlight Card */}
          {spotlightShift ? (
            <View style={[styles.spotlightCard, { backgroundColor: colors.primaryContainer }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.spotlightEyebrow, { color: colors.onPrimaryContainer }]}>
                  {spotlightShift.status === 'CURRENT'
                    ? (isOwnSpotlight ? 'You are on shift now' : 'Currently on shift')
                    : (isOwnSpotlight ? 'Your next shift' : 'Next team shift')}
                </Text>
                <View style={[styles.pillBadge, { backgroundColor: colors.surfaceContainerLowest }]}>
                  <Text style={[styles.pillBadgeText, { color: colors.onPrimaryContainer }]}>
                    {spotlightShift.status === 'CURRENT'
                      ? '● Active now'
                      : spotlightShift.dateString === getLocalDateString(now)
                      ? 'Today'
                      : `${spotlightShift.dayText} ${spotlightShift.dayNum}`}
                  </Text>
                </View>
              </View>

              <Text style={[styles.spotlightTime, { color: colors.onPrimaryContainer }]}>
                {spotlightShift.startTime} – {spotlightShift.endTime}
              </Text>
              <Text style={[styles.spotlightDate, { color: colors.onPrimaryContainer, opacity: 0.9 }]}>
                {spotlightShift.date}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                <UsersIcon color={colors.onPrimaryContainer} size={16} />
                <Text
                  style={[
                    styles.footnote,
                    { color: colors.onPrimaryContainer, marginLeft: 8, marginTop: 0, fontWeight: '600' },
                  ]}
                >
                  {isOwnSpotlight ? 'Assigned to you · Manager' : `${spotlightShift.assigneeName} · ${spotlightShift.assigneeRole}`}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary, marginTop: 18 },
                ]}
                onPress={() => {
                  setSelectedShift(spotlightShift);
                  setSubScreen('SHIFT_DETAILS_OWNER');
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
          ) : (
            <View
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderWidth: 0,
                  borderRadius: 24,
                  padding: 24,
                },
              ]}
            >
              <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
                <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
              </View>
              <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>
                {publishedShifts.length > 0 ? 'No upcoming shifts' : 'No published shifts'}
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 },
                ]}
              >
                {publishedShifts.length > 0
                  ? 'All scheduled shifts have completed. Check the schedule to view upcoming rotas.'
                  : 'No shifts have been published for this team yet.'}
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
          )}

          {/* Section: Coming up */}
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
                {upcomingShifts.slice(0, 3).map((shift) => (
                  <TouchableOpacity
                    key={shift.id}
                    style={[
                      styles.shiftCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                      },
                    ]}
                    onPress={() => {
                      setSelectedShift(shift);
                      setSubScreen('SHIFT_DETAILS_OWNER');
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
            </>
          )}

          {/* Section: Needs your attention */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Needs your attention</Text>
            <TouchableOpacity onPress={() => {
              setSwapsSubTab('NEEDS_APPROVAL');
              setActiveTab('SWAPS');
            }}>
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
              },
            ]}
          >
            {pendingManagerSwaps.length > 0 ? (
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => {
                  setSwapsSubTab('NEEDS_APPROVAL');
                  setActiveTab('SWAPS');
                }}
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
            ) : (
              <View style={styles.listRow}>
                <CheckIcon color={colors.primary} size={20} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                    No pending approvals
                  </Text>
                  <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                    All team swap requests are settled
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    // 2. Owner Home Empty (when subscription is PENDING_INITIAL_PAYMENT or not yet loaded as ACTIVE)
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
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
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
              onPress={openPlanSelection}
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
          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceContainerLow, marginTop: 24 }]}>
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
      .map((s) => formatShiftItem(s, now));

    const activeOrUpcomingStaffShifts = publishedShifts.filter(
      (s) => s.status === 'CURRENT' || s.status === 'UPCOMING'
    );

    // If no shifts have been published yet by this owner:
    if (publishedShifts.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, styles.scrollContentWithFab]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
            Your team schedule starts here.
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
                borderWidth: 0,
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
              { backgroundColor: colors.surfaceContainerLowest, borderWidth: 0 },
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
    const currentStaffShift = activeOrUpcomingStaffShifts.find((s) => s.status === 'CURRENT');
    const nextStaffShift = activeOrUpcomingStaffShifts.find((s) => s.status === 'UPCOMING') || activeOrUpcomingStaffShifts[0];
    const spotlightShift = currentStaffShift || nextStaffShift || null;
    const isCurrentActive = !!currentStaffShift;

    const upcomingStaffShifts = spotlightShift
      ? activeOrUpcomingStaffShifts.filter((s) => s.id !== spotlightShift.id)
      : [];
    const pendingManagerSwaps = (teamSwapsData || []).filter((s) => s.status === 'PENDING_MANAGER');

    const todayObj = new Date(currentTimestamp);
    const todayFormatted = todayObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, styles.scrollContentWithFab]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
          {spotlightShift ? spotlightShift.date : todayFormatted}
        </Text>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
          Your day, at a glance.
        </Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Your work and team decisions, in one place.
        </Text>

        {/* Spotlight Card: Active Staff on Shift or Next Staff on Shift */}
        {spotlightShift ? (
          <View style={[styles.spotlightCard, { backgroundColor: colors.primaryContainer }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.spotlightEyebrow, { color: colors.onPrimaryContainer }]}>
                {isCurrentActive ? 'Currently on shift' : 'Next staff on shift'}
              </Text>
              <View style={[styles.pillBadge, { backgroundColor: colors.surfaceContainerLowest }]}>
                <Text style={[styles.pillBadgeText, { color: colors.onPrimaryContainer }]}>
                  {isCurrentActive
                    ? '● Active now'
                    : spotlightShift.dateString === getLocalDateString(now)
                    ? 'Today'
                    : 'Upcoming'}
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
        ) : (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderWidth: 0,
                borderRadius: 24,
                padding: 24,
                marginBottom: 20,
              },
            ]}
          >
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <CalendarDaysIcon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>No upcoming shifts</Text>
            <Text
              style={[
                styles.emptySub,
                { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 },
              ]}
            >
              All scheduled shifts for today have completed. Check the schedule to view upcoming rotas or publish new shifts.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, width: '100%' }]}
              onPress={() => setActiveTab('SCHEDULE')}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                View schedule
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
                  style={[styles.shiftCard, { backgroundColor: colors.surfaceContainerLowest }]}
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

            <View style={[styles.listGroup, { backgroundColor: colors.surfaceContainerLowest }]}>
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
      </ScrollView>
    );
  };

  // ==========================================
  // Tab 2: SCHEDULE
  // ==========================================
  const renderScheduleTab = () => {
    const { days, rangeTitle, yearTitle } = getWeekDaysForDate(viewingDateString);
    const monthData = getMonthDaysForDate(viewingDateString);
    const todayString = getLocalDateString();
    const isCurrentWeek = days.some((d) => d.isToday);

    const publishedShifts = (teamShiftsData || [])
      .filter((s) => s.status === 'PUBLISHED')
      .map((s) => formatShiftItem(s, new Date(currentTimestamp)));

    const handlePrevWeek = () => {
      const prev = parseLocalDate(viewingDateString);
      prev.setDate(prev.getDate() - 7);
      const prevStr = getLocalDateString(prev);
      setViewingDateString(prevStr);
      setSelectedDateString(prevStr);
    };

    const handleNextWeek = () => {
      const next = parseLocalDate(viewingDateString);
      next.setDate(next.getDate() + 7);
      const nextStr = getLocalDateString(next);
      setViewingDateString(nextStr);
      setSelectedDateString(nextStr);
    };

    const handlePrevMonth = () => {
      const prev = parseLocalDate(viewingDateString);
      prev.setDate(1);
      prev.setMonth(prev.getMonth() - 1);
      const prevStr = getLocalDateString(prev);
      setViewingDateString(prevStr);
    };

    const handleNextMonth = () => {
      const next = parseLocalDate(viewingDateString);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const nextStr = getLocalDateString(next);
      setViewingDateString(nextStr);
    };

    const handleResetToToday = () => {
      const today = getLocalDateString();
      setViewingDateString(today);
      setSelectedDateString(today);
    };

    const selectedDateObj = parseLocalDate(selectedDateString);
    const isTodaySelected = selectedDateString === todayString;
    const dayTitle = selectedDateObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const dayShifts = publishedShifts.filter((s) => s.dateString === selectedDateString);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
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
            style={[
              styles.tabButton,
              scheduleSubTab === 'WEEK' && [styles.tabButtonActive, { backgroundColor: colors.surfaceContainerLowest }],
            ]}
            onPress={() => setScheduleSubTab('WEEK')}
          >
            <Text
              style={[
                styles.tabText,
                { color: scheduleSubTab === 'WEEK' ? colors.onSurface : colors.onSurfaceVariant },
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              scheduleSubTab === 'MONTH' && [styles.tabButtonActive, { backgroundColor: colors.surfaceContainerLowest }],
            ]}
            onPress={() => setScheduleSubTab('MONTH')}
          >
            <Text
              style={[
                styles.tabText,
                { color: scheduleSubTab === 'MONTH' ? colors.onSurface : colors.onSurfaceVariant },
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
        </View>

        {scheduleSubTab === 'WEEK' ? (
          <>
            {/* Dynamic Week Header with Navigation */}
            <View style={[styles.sectionRow, { alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{rangeTitle}</Text>
                <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>{yearTitle}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!isCurrentWeek && (
                  <TouchableOpacity
                    style={[
                      styles.smallPillButton,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                    ]}
                    onPress={handleResetToToday}
                  >
                    <Text style={[styles.smallPillText, { color: colors.primary }]}>Today</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.smallNavArrow, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={handlePrevWeek}
                  accessibilityLabel="Previous week"
                >
                  <Text style={[styles.arrowText, { color: colors.onSurface }]}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallNavArrow, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={handleNextWeek}
                  accessibilityLabel="Next week"
                >
                  <Text style={[styles.arrowText, { color: colors.onSurface }]}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Days Strip */}
            <View style={styles.daysStrip}>
              {days.map((item) => {
                const isSelected = selectedDateString === item.dateString;
                const hasShift = publishedShifts.some((s) => s.dateString === item.dateString);

                return (
                  <TouchableOpacity
                    key={item.dateString}
                    style={[
                      styles.dayItem,
                      isSelected && { backgroundColor: colors.primary },
                      item.isToday && !isSelected && { borderColor: colors.primary, borderWidth: 1.5 },
                    ]}
                    onPress={() => setSelectedDateString(item.dateString)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: isSelected
                            ? colors.onPrimary
                            : item.isToday
                            ? colors.primary
                            : colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {item.day}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        { color: isSelected ? colors.onPrimary : colors.onSurface },
                      ]}
                    >
                      {item.num}
                    </Text>
                    {hasShift && (
                      <View
                        style={[
                          styles.shiftDot,
                          { backgroundColor: isSelected ? colors.onPrimary : colors.primary },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Dynamic Month Header with Navigation */}
            <View style={[styles.sectionRow, { alignItems: 'center' }]}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {monthData.monthTitle}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!monthData.isCurrentMonth && (
                  <TouchableOpacity
                    style={[
                      styles.smallPillButton,
                      { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
                    ]}
                    onPress={handleResetToToday}
                  >
                    <Text style={[styles.smallPillText, { color: colors.primary }]}>Today</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.smallNavArrow, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={handlePrevMonth}
                  accessibilityLabel="Previous month"
                >
                  <Text style={[styles.arrowText, { color: colors.onSurface }]}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallNavArrow, { backgroundColor: colors.surfaceContainerLow }]}
                  onPress={handleNextMonth}
                  accessibilityLabel="Next month"
                >
                  <Text style={[styles.arrowText, { color: colors.onSurface }]}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Monthly Calendar Card Container */}
            <View
              style={[
                styles.monthCalendarCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              {/* Day of Week Headers */}
              <View style={styles.monthWeekHeader}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
                  <View key={dayName} style={styles.monthWeekHeaderCell}>
                    <Text style={[styles.monthWeekHeaderText, { color: colors.onSurfaceVariant }]}>
                      {dayName}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 7-Column Day Grid */}
              <View style={styles.monthGrid}>
                {monthData.days.map((item) => {
                  const isSelected = selectedDateString === item.dateString;
                  const dayShiftsCount = publishedShifts.filter((s) => s.dateString === item.dateString).length;
                  const hasShift = dayShiftsCount > 0;

                  return (
                    <View key={item.dateString} style={styles.monthDayCell}>
                      <TouchableOpacity
                        style={[
                          styles.monthDayButton,
                          isSelected && { backgroundColor: colors.primary },
                          item.isToday && !isSelected && { borderColor: colors.primary, borderWidth: 1.5 },
                        ]}
                        onPress={() => {
                          setSelectedDateString(item.dateString);
                          if (!item.isCurrentMonth) {
                            setViewingDateString(item.dateString);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.monthDayNum,
                            {
                              color: isSelected
                                ? colors.onPrimary
                                : item.isToday
                                ? colors.primary
                                : item.isCurrentMonth
                                ? colors.onSurface
                                : colors.onSurfaceVariant,
                              opacity: item.isCurrentMonth ? 1 : 0.45,
                            },
                          ]}
                        >
                          {item.dayNum}
                        </Text>

                        {/* Shift Indicator */}
                        {hasShift && (
                          <View style={styles.monthShiftIndicator}>
                            {dayShiftsCount === 1 ? (
                              <View
                                style={[
                                  styles.monthShiftDot,
                                  { backgroundColor: isSelected ? colors.onPrimary : colors.primary },
                                ]}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.monthShiftCountPill,
                                  {
                                    backgroundColor: isSelected
                                      ? colors.onPrimary
                                      : colors.primaryContainer,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.monthShiftCountText,
                                    {
                                      color: isSelected
                                        ? colors.primary
                                        : colors.onPrimaryContainer,
                                    },
                                  ]}
                                >
                                  {dayShiftsCount}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Selected Day Staff Shifts Header */}
        <View style={styles.sectionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{dayTitle}</Text>
            {isTodaySelected && (
              <View style={[styles.todayBadge, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.todayBadgeText, { color: colors.onPrimaryContainer }]}>Today</Text>
              </View>
            )}
          </View>
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
            {dayShifts.map((shift) => {
              const isCompleted =
                shift.status === 'COMPLETED' ||
                (shift.endAt ? new Date(currentTimestamp) > new Date(shift.endAt) : false);
              const isCurrent = shift.status === 'CURRENT';

              return (
                <TouchableOpacity
                  key={shift.id}
                  style={[
                    styles.shiftCard,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      opacity: isCompleted ? 0.75 : 1,
                    },
                  ]}
                  onPress={() => {
                    setSelectedShift({
                      ...shift,
                      status: isCompleted ? 'COMPLETED' : shift.status,
                    });
                    setSubScreen(activeMembership.role === Role.STAFF ? 'SHIFT_DETAILS_STAFF' : 'SHIFT_DETAILS_OWNER');
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dateBox,
                      {
                        backgroundColor: isCompleted
                          ? colors.surfaceContainerHigh
                          : colors.surfaceContainerLow,
                      },
                    ]}
                  >
                    <Text style={[styles.dateBoxDay, { color: colors.onSurfaceVariant }]}>
                      {shift.dayText}
                    </Text>
                    <Text
                      style={[
                        styles.dateBoxNum,
                        { color: isCompleted ? colors.onSurfaceVariant : colors.onSurface },
                      ]}
                    >
                      {shift.dayNum}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text
                        style={[
                          styles.shiftTime,
                          { color: isCompleted ? colors.onSurfaceVariant : colors.onSurface },
                        ]}
                      >
                        {shift.startTime} – {shift.endTime}
                      </Text>
                      {isCompleted ? (
                        <View
                          style={[
                            styles.pillBadge,
                            {
                              backgroundColor: colors.surfaceContainerHigh,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillBadgeText,
                              { color: colors.onSurfaceVariant, fontSize: 11 },
                            ]}
                          >
                            Completed
                          </Text>
                        </View>
                      ) : isCurrent ? (
                        <View
                          style={[
                            styles.pillBadge,
                            {
                              backgroundColor: colors.primaryContainer,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillBadgeText,
                              { color: colors.onPrimaryContainer, fontSize: 11 },
                            ]}
                          >
                            Ongoing
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.shiftMeta, { color: colors.onSurfaceVariant }]}>
                      {shift.assigneeName} · {shift.assigneeRole} · {shift.date}
                    </Text>
                  </View>
                  <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
                </TouchableOpacity>
              );
            })}
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
      </ScrollView>
    );
  };

  // ==========================================
  // Tab 3: SWAPS
  // ==========================================
  const renderSwapsTab = () => {
    const isManagerOrOwner = activeMembership.role !== Role.STAFF;
    const rawSwaps = teamSwapsData && teamSwapsData.length > 0 ? teamSwapsData : [];
    const myRequests = rawSwaps.filter((s) => s.requesterId === user?.id);
    const forMe = rawSwaps.filter((s) => s.colleagueId === user?.id);
    const pendingApproval = rawSwaps.filter((s) => s.status === 'PENDING_MANAGER');

    const currentList =
      swapsSubTab === 'NEEDS_APPROVAL'
        ? pendingApproval
        : swapsSubTab === 'MY_REQUESTS'
        ? myRequests
        : forMe;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Swaps</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          Track requests and decisions.
        </Text>

        <View style={[styles.tabsRow, { backgroundColor: colors.surfaceContainerLow }]}>
          {isManagerOrOwner && (
            <TouchableOpacity
              style={[styles.tabButton, swapsSubTab === 'NEEDS_APPROVAL' && styles.tabButtonActive]}
              onPress={() => setSwapsSubTab('NEEDS_APPROVAL')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        swapsSubTab === 'NEEDS_APPROVAL' ? colors.onSurface : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  Needs approval
                </Text>
                {pendingApproval.length > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '700' }}>
                      {pendingApproval.length}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

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
            <Text style={[styles.emptyHeading, { color: colors.onSurface }]}>
              {swapsSubTab === 'NEEDS_APPROVAL'
                ? 'No pending approvals'
                : 'No swap requests'}
            </Text>
            <Text
              style={[
                styles.emptySub,
                { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 20 },
              ]}
            >
              {swapsSubTab === 'NEEDS_APPROVAL'
                ? 'When colleagues agree to a swap, the request will appear here for your review and decision.'
                : swapsSubTab === 'MY_REQUESTS'
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
                      {swapsSubTab === 'FOR_ME'
                        ? 'Review request'
                        : swapsSubTab === 'NEEDS_APPROVAL'
                        ? 'Review & decide'
                        : 'View swap request'}
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
  // Tab 4: ACTIVITY (PRD F4: FlashList Cursor Pagination)
  // ==========================================
  const renderActivityTab = () => {
    return (
      <ActivityFeed
        teamId={currentTeamId}
        teamName={activeMembership.name}
        currentUserId={currentUserId}
        currentUserEmail={currentUserEmail}
        onNavigateToSchedule={(shiftDate) => {
          if (shiftDate) {
            setSelectedDateString(shiftDate);
            setViewingDateString(shiftDate);
          }
          setActiveTab('SCHEDULE');
        }}
        onNavigateToSwaps={() => {
          setActiveTab('SWAPS');
        }}
      />
    );
  };


  // ==========================================
  // Tab 5: MORE
  // ==========================================
  const isStaff = activeMembership.role === Role.STAFF;
  const isManager = activeMembership.role === Role.MANAGER;

  const accountMenuItems: Array<{
    key: OwnerSubScreen;
    Icon: React.FC<{ color: string; size?: number }>;
    title: string;
    subtitle: string;
  }> = isStaff
    ? [
        { key: 'STAFF_TEAM', Icon: UsersIcon, title: 'Team', subtitle: 'Your team membership' },
        { key: 'AVAILABILITY', Icon: ClockIcon, title: 'Availability', subtitle: 'Your weekly availability' },
        { key: 'SETTINGS_PREFERENCES', Icon: SettingsIcon, title: 'Settings', subtitle: 'Notifications and preferences' },
        { key: 'ACCOUNT', Icon: ShieldIcon, title: 'Account', subtitle: 'Sign-in and device sessions' },
      ]
    : isManager
    ? [
        { key: 'OWNER_TEAM', Icon: UsersIcon, title: 'Team', subtitle: 'Members and invitations' },
        { key: 'AVAILABILITY', Icon: ClockIcon, title: 'Availability', subtitle: 'Your weekly availability' },
        { key: 'SETTINGS_PREFERENCES', Icon: SettingsIcon, title: 'Settings', subtitle: 'Notifications and preferences' },
        { key: 'ACCOUNT', Icon: ShieldIcon, title: 'Account', subtitle: 'Sign-in and device sessions' },
      ]
    : [
        { key: 'OWNER_TEAM', Icon: UsersIcon, title: 'Team', subtitle: 'Members and invitations' },
        { key: 'BILLING_OVERVIEW', Icon: CreditCardIcon, title: 'Billing', subtitle: 'Plan, seats and payment status' },
        { key: 'AVAILABILITY', Icon: ClockIcon, title: 'Availability', subtitle: 'Your weekly availability' },
        { key: 'SETTINGS_PREFERENCES', Icon: SettingsIcon, title: 'Settings', subtitle: 'Notifications and preferences' },
        { key: 'ACCOUNT', Icon: ShieldIcon, title: 'Account', subtitle: 'Sign-in and device sessions' },
      ];

  const renderMoreTab = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.pageHeading, { color: colors.onSurface }]}>
        Your team & account.
      </Text>

      {/* User profile card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceContainerLowest,
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
            borderWidth: 0,
          },
        ]}
      >
        {accountMenuItems.map((item, index) => (
          <View key={item.key}>
            <TouchableOpacity
              style={styles.listRow}
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
                <item.Icon color={colors.onSurfaceVariant} size={20} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.listTitle, { color: colors.onSurface }]}>{item.title}</Text>
                <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                  {item.subtitle}
                </Text>
              </View>
              <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
            </TouchableOpacity>
            {index < accountMenuItems.length - 1 && <InsetDivider inset={64} />}
          </View>
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
            <View key={item.key}>
              <TouchableOpacity
                style={styles.accountMenuItem}
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
                  <item.Icon color={colors.onSurfaceVariant} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.listTitle, { color: colors.onSurface }]}>{item.title}</Text>
                  <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
              </TouchableOpacity>
              {index < accountMenuItems.length - 1 && <InsetDivider inset={58} />}
            </View>
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

  const showQuickActionFab =
    activeTab === 'HOME' &&
    (activeMembership.role === Role.MANAGER ||
      (activeMembership.role === Role.OWNER && isSubscriptionActive));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}

      {/* Real-time In-App Notification Toast */}
      {inAppNotification && (
        <View style={styles.inAppNotificationContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.inAppNotificationBanner, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (inAppNotification.dateString) {
                setSelectedDateString(inAppNotification.dateString);
                setViewingDateString(inAppNotification.dateString);
              }
              setActiveTab('SCHEDULE');
              setInAppNotification(null);
            }}
          >
            <View style={styles.notificationIconBox}>
              <BellIcon color={colors.onPrimary} size={18} />
            </View>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.notificationTitle, { color: colors.onPrimary }]}>
                {inAppNotification.title}
              </Text>
              <Text style={[styles.notificationMessage, { color: colors.onPrimary }]} numberOfLines={2}>
                {inAppNotification.message}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setInAppNotification(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.notificationCloseButton}
            >
              <Text style={[styles.notificationCloseText, { color: colors.onPrimary }]}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mainContent}>
        {activeTab === 'HOME' && renderHomeTab()}
        {activeTab === 'SCHEDULE' && renderScheduleTab()}
        {activeTab === 'SWAPS' && renderSwapsTab()}
        {activeTab === 'ACTIVITY' && renderActivityTab()}
        {activeTab === 'MORE' && renderMoreTab()}

        {/* Floating quick-action button (create a shift / invite a member) */}
        {showQuickActionFab && (
          <>
            {isQuickActionMenuVisible && (
              <Pressable
                style={styles.quickActionOverlay}
                onPress={() => setIsQuickActionMenuVisible(false)}
                accessibilityLabel="Close quick actions"
              />
            )}

            {isQuickActionMenuVisible && (
              <View
                style={[
                  styles.quickActionMenuWrapper,
                  { backgroundColor: colors.surfaceContainerLowest },
                ]}
              >
                <View
                  style={[
                    styles.quickActionMenu,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerLow },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      setIsQuickActionMenuVisible(false);
                      setSubScreen('CREATE_SHIFT');
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.menuIconContainer}>
                      <CalendarDaysIcon color={colors.onSurfaceVariant} size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                        Create a shift
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                        Add a shift to the schedule
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <InsetDivider inset={56} />

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      setIsQuickActionMenuVisible(false);
                      setSubScreen('INVITE_COLLEAGUE');
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.menuIconContainer}>
                      <UsersIcon color={colors.onSurfaceVariant} size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.listTitle, { color: colors.onSurface }]}>
                        Invite a member
                      </Text>
                      <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                        Send a team invitation
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.fab, { backgroundColor: colors.primary }]}
              onPress={() => setIsQuickActionMenuVisible((prev) => !prev)}
              accessibilityLabel="Quick actions"
              accessibilityRole="button"
            >
              <PlusIcon color={colors.onPrimary} size={26} />
            </TouchableOpacity>
          </>
        )}
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
                if (tab.id === 'SCHEDULE') {
                  const todayStr = getLocalDateString();
                  setSelectedDateString(todayStr);
                  setViewingDateString(todayStr);
                  refetchShifts();
                }
                if (tab.id === 'ACTIVITY') {
                  setHasUnreadActivity(false);
                }
                setActiveTab(tab.id);
                setSubScreen('NONE');
                setIsQuickActionMenuVisible(false);
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
                {tab.id === 'ACTIVITY' && hasUnreadActivity && (
                  <View style={styles.unreadBadgeDot} />
                )}
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

      {/* Shift details sheet */}
      {renderShiftDetailsSheet()}

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
              {memberships.map((m, index) => {
                const isSelected = m.teamId === activeMembership.teamId;
                const isLast = index === memberships.length - 1;
                return (
                  <View key={m.teamId}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => {
                        setSelectedTeamId(m.teamId);
                        setIsTeamSwitcherVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listTitle, { color: colors.onSurface }]}>{m.name}</Text>
                        <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                          {m.role === Role.OWNER ? 'Owner · Current team' : m.role === Role.MANAGER ? 'Manager' : 'Staff'}
                        </Text>
                      </View>
                      {isSelected && <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>}
                    </TouchableOpacity>
                    {!isLast && <InsetDivider inset={18} />}
                  </View>
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
    flexShrink: 1,
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
    flexShrink: 1,
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
  scrollContentWithFab: {
    paddingBottom: 112,
  },
  pageHeading: {
    ...titleLargeText,
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 1,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
    borderWidth: 0,
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
  monthCalendarCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginVertical: 14,
  },
  monthWeekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  monthWeekHeaderCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  monthWeekHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  monthDayButton: {
    width: 38,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayNum: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthShiftIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
    height: 6,
  },
  monthShiftDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  monthShiftCountPill: {
    paddingHorizontal: 4,
    borderRadius: 4,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthShiftCountText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
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
  quickActionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  quickActionMenuWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 84,
    borderRadius: 20,
    zIndex: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  quickActionMenu: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadHeaderBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA1A1A',
  },
  smallPillButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  smallPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  smallNavArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  shiftDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inAppNotificationContainer: {
    position: 'absolute',
    top: 58,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 10,
  },
  inAppNotificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  notificationIconBox: {
    marginRight: 10,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  notificationCloseButton: {
    padding: 4,
    marginLeft: 6,
  },
  notificationCloseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA1A1A',
  },
});
