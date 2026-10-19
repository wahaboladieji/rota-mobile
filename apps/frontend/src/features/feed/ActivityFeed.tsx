import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityEventItem, ActivityFeedResponse } from '@rota/shared';
import { apiRequest } from '../../services/api';
import { useTheme } from '../../theme';
import { InsetDivider } from '../../components/InsetDivider';
import {
  CalendarDaysIcon,
  Repeat2Icon,
  ActivityNavIcon,
  UsersIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
} from '../../components/ReviewIcons';

interface ActivityFeedProps {
  teamId: string;
  teamName: string;
  currentUserId?: string;
  currentUserEmail?: string;
  onNavigateToSchedule?: (dateString?: string) => void;
  onNavigateToSwaps?: () => void;
}

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

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  teamId,
  teamName,
  currentUserId,
  currentUserEmail,
  onNavigateToSchedule,
  onNavigateToSwaps,
}) => {
  const { colors, typography, spacing } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // TanStack Query infinite query with PRD F5.1 feed stale time (30 seconds)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isFetchNextPageError,
  } = useInfiniteQuery<ActivityFeedResponse>({
    queryKey: ['activity-feed', teamId],
    queryFn: async ({ pageParam }) => {
      const cursorParam = pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : '';
      return apiRequest<ActivityFeedResponse>(
        `/api/teams/${teamId}/activity?limit=20${cursorParam}`,
        {
          method: 'GET',
          requiresAuth: true,
        }
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore && lastPage?.nextCursor ? lastPage.nextCursor : undefined,
    enabled: !!teamId,
    staleTime: 30000,
  });

  // Merge pages and deduplicate events by unique item ID (PRD F4.3)
  const activityItems = useMemo(() => {
    if (!data?.pages || !Array.isArray(data.pages)) return [];
    const seen = new Set<string>();
    const items: ActivityEventItem[] = [];
    for (const page of data.pages) {
      if (!page || !Array.isArray(page.items)) continue;
      for (const item of page.items) {
        if (item && item.id && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [data]);

  // Pull-to-refresh handler (PRD F4.3)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // End reached handler with guard against overlapping in-flight calls (PRD F4.3)
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  // Render individual activity item row
  const renderItem = useCallback(
    ({ item, index }: { item: ActivityEventItem; index: number }) => {
      const isLast = index === activityItems.length - 1;
      const timeFormatted = formatRelativeTime(item.createdAt);

      let IconComponent = ActivityNavIcon;
      let title = 'Activity update';
      let subtitle = `${timeFormatted} · ${item.actorName}`;

      if (item.type === 'SHIFT_PUBLISHED' || item.type === 'SHIFT_CREATED') {
        IconComponent = CalendarDaysIcon;
        const payload = item.payload as any;
        const isForMe =
          payload?.assigneeId === currentUserId ||
          (currentUserEmail && payload?.assigneeEmail === currentUserEmail) ||
          (currentUserEmail && payload?.assigneeName === currentUserEmail.split('@')[0]);

        title = payload?.isUpdate
          ? isForMe
            ? 'Shift updated for you'
            : 'Shift updated'
          : isForMe
          ? 'Shift published for you'
          : 'Shift published';

        subtitle = payload?.assigneeName
          ? `${timeFormatted} · ${payload.assigneeName}`
          : `${timeFormatted} · By ${item.actorName}`;
      } else if (item.type === 'SHIFT_CANCELLED') {
        IconComponent = CalendarDaysIcon;
        const payload = item.payload as any;
        const isForMe =
          payload?.assigneeId === currentUserId ||
          (currentUserEmail && payload?.assigneeEmail === currentUserEmail) ||
          (currentUserEmail && payload?.assigneeName === currentUserEmail.split('@')[0]);

        title = isForMe ? 'Your shift was cancelled' : 'Shift cancelled';
        subtitle = payload?.assigneeName
          ? `${timeFormatted} · ${payload.assigneeName} by ${item.actorName}`
          : `${timeFormatted} · By ${item.actorName}`;
      } else if (item.type === 'SWAP_REQUESTED') {
        IconComponent = Repeat2Icon;
        title = 'Swap requested';
        subtitle = `${timeFormatted} · By ${item.actorName}`;
      } else if (item.type === 'SWAP_ACCEPTED') {
        IconComponent = Repeat2Icon;
        title = 'Swap accepted by colleague';
        subtitle = `${timeFormatted} · Manager review next`;
      } else if (item.type === 'SWAP_APPROVED') {
        IconComponent = Repeat2Icon;
        title = 'Swap approved';
        subtitle = `${timeFormatted} · Schedule updated`;
      } else if (item.type === 'SWAP_REJECTED') {
        IconComponent = Repeat2Icon;
        title = 'Swap rejected';
        subtitle = `${timeFormatted} · Original shift kept`;
      } else if (item.type === 'SWAP_CANCELLED') {
        IconComponent = Repeat2Icon;
        title = 'Swap cancelled';
        subtitle = `${timeFormatted} · By ${item.actorName}`;
      } else if (item.type === 'MEMBER_JOINED') {
        IconComponent = UsersIcon;
        title = `${item.actorName} joined ${teamName}`;
        subtitle = `${timeFormatted} · New team member`;
      } else if (item.type === 'MEMBER_INVITED') {
        IconComponent = UsersIcon;
        title = `Invitation sent to ${item.payload?.email || 'colleague'}`;
        subtitle = `${timeFormatted} · By ${item.actorName}`;
      }

      const handleItemPress = () => {
        const payload = item.payload as any;
        if (
          (item.type === 'SHIFT_PUBLISHED' || item.type === 'SHIFT_CREATED' || item.type === 'SHIFT_UPDATED') &&
          payload?.startAt
        ) {
          try {
            const shiftDate = new Date(payload.startAt).toISOString().split('T')[0];
            onNavigateToSchedule?.(shiftDate);
          } catch {
            onNavigateToSchedule?.();
          }
        } else if (item.type.startsWith('SWAP_')) {
          onNavigateToSwaps?.();
        }
      };

      return (
        <View style={{ backgroundColor: colors.surfaceContainerLowest }}>
          <TouchableOpacity
            style={styles.listRow}
            onPress={handleItemPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
              <IconComponent color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.listTitle, { color: colors.onSurface }]}>{title}</Text>
              <Text style={[styles.listSubtitle, { color: colors.onSurfaceVariant }]}>
                {subtitle}
              </Text>
            </View>
            <ChevronRightIcon color={colors.onSurfaceVariant} size={18} />
          </TouchableOpacity>
          {!isLast && <InsetDivider inset={66} />}
        </View>
      );
    },
    [
      activityItems.length,
      colors,
      currentUserId,
      currentUserEmail,
      teamName,
      onNavigateToSchedule,
      onNavigateToSwaps,
    ]
  );

  // List Header Component
  const ListHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        <Text style={[styles.pageHeading, { color: colors.onSurface }]}>Activity</Text>
        <Text style={[styles.pageLead, { color: colors.onSurfaceVariant }]}>
          The latest changes from {teamName}.
        </Text>
        <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 16, marginBottom: 8 }]}>
          Recent updates
        </Text>
      </View>
    );
  }, [colors, teamName]);

  // List Empty Component (PRD F4.4)
  const ListEmpty = useMemo(() => {
    if (isLoading) return null;
    return (
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
    );
  }, [isLoading, colors]);

  // List Footer Component: Loading next page, Error retry, or End of list (PRD F4.4)
  const ListFooter = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant, marginLeft: 8 }]}>
            Loading older activity...
          </Text>
        </View>
      );
    }

    if (isFetchNextPageError) {
      return (
        <View style={[styles.footerErrorContainer, { backgroundColor: colors.errorContainer }]}>
          <AlertTriangleIcon color={colors.onErrorContainer} size={18} />
          <Text style={[styles.footerErrorText, { color: colors.onErrorContainer }]}>
            Couldn't load older activity.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => fetchNextPage()}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!hasNextPage && activityItems.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={[styles.footnote, { color: colors.onSurfaceVariant }]}>
            You’ve reached the end.
          </Text>
        </View>
      );
    }

    return <View style={{ height: 24 }} />;
  }, [isFetchingNextPage, isFetchNextPageError, hasNextPage, activityItems.length, colors, fetchNextPage]);

  // Full-screen initial loading state (PRD F4.4)
  if (isLoading && activityItems.length === 0) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.onSurfaceVariant, marginTop: 12 }]}>
          Loading activity...
        </Text>
      </View>
    );
  }

  // Full-screen initial load error state (PRD F4.4)
  if (isError && activityItems.length === 0) {
    return (
      <View style={[styles.container, styles.centeredContainer]}>
        <View style={[styles.emptyIconBox, { backgroundColor: colors.errorContainer }]}>
          <AlertTriangleIcon color={colors.onErrorContainer} size={32} />
        </View>
        <Text style={[styles.emptyHeading, { color: colors.onSurface, marginTop: 12 }]}>
          Unable to load activity
        </Text>
        <Text style={[styles.emptySub, { color: colors.onSurfaceVariant, textAlign: 'center', marginHorizontal: 24 }]}>
          {(error as Error)?.message || 'Something went wrong while fetching the latest team updates.'}
        </Text>
        <TouchableOpacity
          style={[styles.primaryRetryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={() => refetch()}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryRetryText, { color: colors.onPrimary }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={activityItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 8,
  },
  pageHeading: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pageLead: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  listSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 20,
  },
  centeredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
  },
  footerErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 16,
  },
  footerErrorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerEnd: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footnote: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryRetryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryRetryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
