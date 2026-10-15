import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme, titleLargeText, titleMediumText } from '../../theme';
import { Role } from '@rota/shared';
import { apiRequest } from '../../services/api';
import { ArrowLeftIcon, LinkIcon, InfoIcon } from '../../components/ReviewIcons';

interface InviteColleagueScreenProps {
  teamId: string;
  teamName: string;
  activeCount: number;
  pendingCount: number;
  capacity: number;
  onSuccess: () => void;
  onBack: () => void;
}

export const InviteColleagueScreen: React.FC<InviteColleagueScreenProps> = ({
  teamId,
  teamName,
  activeCount,
  pendingCount,
  capacity,
  onSuccess,
  onBack,
}) => {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'EMAIL' | 'LINK'>('EMAIL');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkReady, setLinkReady] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [createdInviteToken, setCreatedInviteToken] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  const remainingPlaces = Math.max(0, capacity - (activeCount + pendingCount));

  const handleCreateInvite = async () => {
    setErrorMessage(null);
    if (tab === 'EMAIL' && (!email.trim() || !email.includes('@'))) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<{
        id: string;
        token?: string;
        inviteUrl?: string;
        email?: string;
      }>(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify({
          email: email.trim() || undefined,
          role: Role.STAFF,
        }),
      });

      setCreatedInviteId(response.id);
      setCreatedInviteToken(response.token || null);
      setCreatedInviteUrl(response.inviteUrl || `rota://invite/${response.token || response.id}`);

      // Invalidate queries so that the new invitation is reflected immediately in all screens
      await queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      await queryClient.invalidateQueries({ queryKey: ['team-billing', teamId] });

      if (tab === 'LINK') {
        setLinkReady(true);
      } else {
        setEmailSentSuccess(true);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleShareLink = async () => {
    try {
      const shareTarget = createdInviteUrl || `rota://invite/${createdInviteToken || createdInviteId}`;
      await Share.share({
        message: `Join our team ${teamName} on Rota! Use this single-use invitation: ${shareTarget}`,
      });
    } catch {
      // Ignored
    }
  };

  // State: invite-email-sent
  if (emailSentSuccess) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceContainerLow }]}>
          <TouchableOpacity
            onPress={onSuccess}
            style={[
              styles.iconButton,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}
          >
            <ArrowLeftIcon color={colors.onSurface} size={18} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>
            Invitation sent
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroCenter}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <Text style={{ fontSize: 24 }}>✉️</Text>
            </View>
            <Text style={[styles.heading, { textAlign: 'center', color: colors.onSurface }]}>
              Invitation email dispatched
            </Text>
            <Text style={[styles.lead, { textAlign: 'center', color: colors.onSurfaceVariant }]}>
              We sent a single-use invitation to {email}.
            </Text>
          </View>

          {/* Invitation Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{teamName}</Text>
            <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
              Staff invitation · Email sent
            </Text>
            <Text style={[styles.smallCaption, { color: colors.onSurfaceVariant, marginTop: 4 }]}>
              Single-use link valid for 7 days
            </Text>

            {createdInviteToken && (
              <View
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant }}>
                  INVITATION TOKEN
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: colors.onSurface,
                    letterSpacing: 1,
                    marginTop: 2,
                  }}
                  selectable
                >
                  {createdInviteToken}
                </Text>
              </View>
            )}
          </View>

          {/* Buttons Stack */}
          <View style={styles.stack}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={handleShareLink}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                Share link directly
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onSuccess}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Back to team
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // State: invite-link-ready
  if (linkReady) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.surfaceContainerLow }]}>
          <TouchableOpacity
            onPress={onSuccess}
            style={[
              styles.iconButton,
              { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
            ]}
          >
            <ArrowLeftIcon color={colors.onSurface} size={18} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>
            Invitation link ready
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroCenter}>
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <LinkIcon color={colors.onPrimaryContainer} size={28} />
            </View>
            <Text style={[styles.heading, { textAlign: 'center', color: colors.onSurface }]}>
              Invitation link ready
            </Text>
            <Text style={[styles.lead, { textAlign: 'center', color: colors.onSurfaceVariant }]}>
              Share this single-use invitation with your colleague.
            </Text>
          </View>

          {/* Invitation Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{teamName}</Text>
            <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
              Staff invitation · Pending
            </Text>
            <Text style={[styles.smallCaption, { color: colors.onSurfaceVariant, marginTop: 4 }]}>
              Single-use link · Share with one colleague
            </Text>

            {createdInviteToken && (
              <View
                style={{
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant }}>
                  INVITATION TOKEN
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: colors.onSurface,
                    letterSpacing: 1,
                    marginTop: 2,
                  }}
                  selectable
                >
                  {createdInviteToken}
                </Text>
              </View>
            )}
          </View>

          {/* Buttons Stack */}
          <View style={styles.stack}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={handleShareLink}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                Share link
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onSuccess}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Back to team
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

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
        <Text style={[styles.headerTitle, { color: colors.onSurfaceVariant }]}>
          {tab === 'EMAIL' ? 'Create invitation' : 'Shareable invitation link'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>
          {tab === 'EMAIL' ? 'Invite a colleague.' : 'Invite by link.'}
        </Text>
        <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
          {tab === 'EMAIL'
            ? 'Give someone access to your team.'
            : 'Create a single-use invitation for your team.'}
        </Text>

        {/* Tabs Bar (r-tabs) */}
        <View style={[styles.tabsBar, { backgroundColor: colors.surfaceContainerLow }]}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              tab === 'EMAIL' && [
                styles.activeTabItem,
                { backgroundColor: colors.surfaceContainerLowest },
              ],
            ]}
            onPress={() => setTab('EMAIL')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === 'EMAIL' ? colors.onSurface : colors.onSurfaceVariant },
              ]}
            >
              Email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              tab === 'LINK' && [
                styles.activeTabItem,
                { backgroundColor: colors.surfaceContainerLowest },
              ],
            ]}
            onPress={() => setTab('LINK')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === 'LINK' ? colors.onSurface : colors.onSurfaceVariant },
              ]}
            >
              Shareable link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Field */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>
            {tab === 'EMAIL' ? 'Email address' : 'Email address (optional)'}
          </Text>
          <TextInput
            style={[
              styles.fieldInput,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: errorMessage ? colors.error : colors.outlineVariant,
                color: colors.onSurface,
              },
            ]}
            placeholder="colleague@example.com"
            placeholderTextColor={colors.onSurfaceVariant}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage(null);
            }}
          />
        </View>

        {/* Notice (r-notice) */}
        <View
          style={[
            styles.noticeBox,
            {
              backgroundColor: colors.surfaceContainerLow,
            },
          ]}
        >
          <InfoIcon color={colors.onSurfaceVariant} size={18} />
          <View style={styles.noticeTextContainer}>
            <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
              {tab === 'EMAIL' ? 'Starter capacity' : 'Share with one colleague'}
            </Text>
            <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
              {tab === 'EMAIL'
                ? `${activeCount} active members + ${pendingCount} pending invitation. ${remainingPlaces} place${
                    remainingPlaces === 1 ? '' : 's'
                  } remain.`
                : 'The link can be accepted once. It reserves a place until accepted, expired or revoked.'}
            </Text>
          </View>
        </View>

        <Text style={[styles.captionText, { color: colors.onSurfaceVariant }]}>
          Invitations are single-use and expiring. Pending invitations reserve capacity but are not
          billed.
        </Text>

        {errorMessage ? (
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: colors.errorContainer,
                borderColor: colors.error,
                marginTop: 16,
              },
            ]}
          >
            <View style={styles.noticeTextContainer}>
              <Text style={[styles.noticeTitle, { color: colors.onErrorContainer }]}>
                Could not send invitation
              </Text>
              <Text style={[styles.noticeBody, { color: colors.onErrorContainer }]}>
                {errorMessage}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleCreateInvite}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              {tab === 'EMAIL' ? 'Create email invitation' : 'Create invitation link'}
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
  tabsBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 24,
  },
  tabItem: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabItem: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 16,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  captionText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  primaryButton: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  heroCenter: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 14,
    marginTop: 4,
  },
  smallCaption: {
    fontSize: 12,
    marginTop: 6,
  },
  stack: {
    gap: 12,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
