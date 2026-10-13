import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme, titleMediumText } from '../../theme';
import { useAuthStore } from '../../state/authStore';
import { apiRequest } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../../state/queryClient';

interface InvitationDetails {
  valid: boolean;
  teamId: string;
  teamName: string;
  role: string;
  email?: string;
  expiresAt: string;
}

interface InvitationAcceptScreenProps {
  token: string;
  onSuccess: (teamId: string) => void;
  onCancel: () => void;
  onNavigateToLogin: (prefilledEmail?: string) => void;
  onNavigateToSignUp: (prefilledEmail?: string) => void;
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

export const InvitationAcceptScreen: React.FC<InvitationAcceptScreenProps> = ({
  token,
  onSuccess,
  onCancel,
  onNavigateToLogin,
  onNavigateToSignUp,
}) => {
  const { colors, typography } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setSelectedTeamId = useAuthStore((state) => state.setSelectedTeamId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitationDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<InvitationDetails>(`/api/invitations/${encodeURIComponent(token)}`, {
        method: 'GET',
        requiresAuth: false,
      });
      setInvite(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAcceptError(null);
    setAccepting(true);
    try {
      const result = await apiRequest<{
        message: string;
        teamId: string;
        teamName: string;
        role: string;
      }>(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        requiresAuth: true,
      });

      setSelectedTeamId(result.teamId);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      await queryClient.invalidateQueries({ queryKey: ['team-members', result.teamId] });
      await queryClient.invalidateQueries({ queryKey: ['shifts', result.teamId] });

      onSuccess(result.teamId);
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    onNavigateToLogin(invite?.email);
  };

  // 1. Loading state
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.onSurfaceVariant, marginTop: 16 }]}>
          Checking invitation...
        </Text>
      </View>
    );
  }

  // 2. Error state (expired or invalid)
  if (error || !invite) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
          <TouchableOpacity onPress={onCancel} style={styles.iconButton} accessibilityLabel="Back">
            <ArrowLeftIcon color={colors.onSurface} size={18} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Invitation</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.errorContent}>
          <View style={[styles.iconCircle, { backgroundColor: colors.errorContainer }]}>
            <Text style={{ fontSize: 28 }}>⚠️</Text>
          </View>
          <Text style={[styles.heading, { color: colors.onSurface, textAlign: 'center', marginTop: 16 }]}>
            Invitation unavailable
          </Text>
          <Text style={[styles.lead, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 }]}>
            {error || 'This invitation link is invalid or has already been used.'}
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 32 }]}
            onPress={onCancel}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              Return to home
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const teamInitials = invite.teamName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'RO';

  const roleLabel = invite.role.charAt(0) + invite.role.slice(1).toLowerCase();
  const isMatchingUser = user && (!invite.email || user.email.toLowerCase() === invite.email.toLowerCase());
  const isDifferentUser = user && invite.email && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity onPress={onCancel} style={styles.iconButton} accessibilityLabel="Back">
          <ArrowLeftIcon color={colors.onSurface} size={18} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>Invitation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title per rota-design-review.html */}
        <Text style={[styles.heading, { color: colors.onSurface }]}>
          {user && isMatchingUser ? `Join ${invite.teamName}.` : 'You’re invited.'}
        </Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          {user && isMatchingUser
            ? 'You’re signed in with the invited account.'
            : `Join the team your colleague invited you to.`}
        </Text>

        {/* Team Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>
                {teamInitials}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.teamName, { color: colors.onSurface }]}>{invite.teamName}</Text>
              <Text style={[styles.teamRole, { color: colors.onSurfaceVariant }]}>
                {roleLabel} membership
              </Text>
            </View>
          </View>

          {invite.email ? (
            <View style={[styles.detailRow, { borderTopColor: colors.outlineVariant }]}>
              <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>
                Invited email
              </Text>
              <Text style={[styles.detailValue, { color: colors.onSurface }]}>{invite.email}</Text>
            </View>
          ) : null}
        </View>

        {/* Notice box */}
        {!user && (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
              Use the invited account
            </Text>
            <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
              {invite.email
                ? `Sign in or register with ${invite.email} to join this team.`
                : 'Sign in or register to accept your invitation.'}
            </Text>
          </View>
        )}

        {isDifferentUser && (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: colors.errorContainer, borderColor: colors.error },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: colors.onErrorContainer }]}>
              Different account detected
            </Text>
            <Text style={[styles.noticeText, { color: colors.onErrorContainer }]}>
              You are signed in as {user.email}, but this invitation was sent to {invite.email}.
              Please switch accounts to accept.
            </Text>
          </View>
        )}

        {user && isMatchingUser && (
          <View
            style={[
              styles.noticeBox,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>Ready to join</Text>
            <Text style={[styles.noticeText, { color: colors.onSurfaceVariant }]}>
              Your invitation and the team’s capacity are verified when you accept.
            </Text>
          </View>
        )}

        {acceptError ? (
          <Text style={[styles.errorMessage, { color: colors.error }]}>{acceptError}</Text>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionStack}>
          {!user && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={() => onNavigateToLogin(invite.email)}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Sign in to continue
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    marginTop: 12,
                  },
                ]}
                onPress={() => onNavigateToSignUp(invite.email)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Create an account
                </Text>
              </TouchableOpacity>
            </>
          )}

          {isDifferentUser && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleSwitchAccount}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Switch account
              </Text>
            </TouchableOpacity>
          )}

          {user && isMatchingUser && (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                accepting && { opacity: 0.7 },
              ]}
              onPress={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Accept invitation
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...titleMediumText,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: 15,
    marginTop: 6,
    lineHeight: 22,
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '700',
  },
  teamRole: {
    fontSize: 14,
    marginTop: 2,
  },
  detailRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  noticeBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionStack: {
    marginTop: 8,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
