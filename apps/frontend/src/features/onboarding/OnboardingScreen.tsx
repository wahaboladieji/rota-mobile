import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme, titleLargeText } from '../../theme';
import { apiRequest } from '../../services/api';
import { TeamResponse } from '@rota/shared';
import { ArrowRightIcon, InfoIcon } from '../../components/ReviewIcons';

interface OnboardingScreenProps {
  onComplete: (team: TeamResponse) => void;
}

type OnboardingStep = 1 | 2 | 3;

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { colors, typography } = useTheme();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [teamName, setTeamName] = useState('Willow Café');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Derives initials for team avatar, e.g. "Willow Café" -> "WC"
  const getInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return 'WC';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.substring(0, 2).toUpperCase();
  };

  const handleAdvanceToReview = () => {
    setErrorMessage(null);
    if (!teamName.trim()) {
      setErrorMessage('Please enter a team name to continue.');
      return;
    }
    setStep(3);
  };

  const handleCreateTeam = async () => {
    setErrorMessage(null);
    if (!teamName.trim()) {
      setErrorMessage('Please enter a team name.');
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<{ team: TeamResponse }>('/api/teams', {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify({ name: teamName.trim() }),
      });
      onComplete(response.team);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create team workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper bar (r-stepper) */}
        <View style={styles.stepperContainer}>
          <View
            style={[
              styles.stepperBar,
              {
                backgroundColor: step >= 1 ? colors.primary : colors.surfaceContainerLow,
              },
            ]}
          />
          <View
            style={[
              styles.stepperBar,
              {
                backgroundColor: step >= 2 ? colors.primary : colors.surfaceContainerLow,
              },
            ]}
          />
          <View
            style={[
              styles.stepperBar,
              {
                backgroundColor: step >= 3 ? colors.primary : colors.surfaceContainerLow,
              },
            ]}
          />
        </View>

        {/* Eyebrow (r-eyebrow) */}
        <Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>
          STEP {step} OF 3
        </Text>

        {/* Heading 1 (h1) & Lead paragraph (p.r-lead) */}
        {step === 1 && (
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>
              {'One team.\nClear roles.'}
            </Text>
            <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
              Everyone works from the same schedule.
            </Text>

            {/* Role Cards Stack (r-stack) */}
            <View style={styles.stack}>
              {/* Owner Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.roleHeader}>
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: colors.onPrimaryContainer },
                      ]}
                    >
                      O
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Owner</Text>
                </View>
                <Text style={[styles.cardDesc, { color: colors.onSurfaceVariant }]}>
                  Creates the team, manages billing and has full control.
                </Text>
              </View>

              {/* Manager Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.roleHeader}>
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: colors.onPrimaryContainer },
                      ]}
                    >
                      M
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Manager</Text>
                </View>
                <Text style={[styles.cardDesc, { color: colors.onSurfaceVariant }]}>
                  Publishes shifts and approves accepted swap requests.
                </Text>
              </View>

              {/* Staff Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.roleHeader}>
                  <View
                    style={[
                      styles.avatarBadge,
                      {
                        backgroundColor: colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: colors.onPrimaryContainer },
                      ]}
                    >
                      S
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Staff</Text>
                </View>
                <Text style={[styles.cardDesc, { color: colors.onSurfaceVariant }]}>
                  Views assigned shifts, requests swaps and sets availability.
                </Text>
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>
              Name your team.
            </Text>
            <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
              Choose a name your colleagues will recognize.
            </Text>

            {/* Field (r-field) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Team name</Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: errorMessage ? colors.error : colors.outlineVariant,
                    color: colors.onSurface,
                  },
                ]}
                placeholder="Willow Café"
                placeholderTextColor={colors.onSurfaceVariant}
                value={teamName}
                onChangeText={(text) => {
                  setTeamName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={handleAdvanceToReview}
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
                  Your membership
                </Text>
                <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                  You’ll be the Owner of the team you create.
                </Text>
              </View>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[styles.heading, { color: colors.onSurface }]}>
              Ready to begin.
            </Text>
            <Text style={[styles.lead, { color: colors.onSurfaceVariant }]}>
              Review your team before continuing.
            </Text>

            {/* Review Card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.reviewRow}>
                <View
                  style={[
                    styles.avatarBadgeLarge,
                    {
                      backgroundColor: colors.primaryContainer,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarTextLarge,
                      { color: colors.onPrimaryContainer },
                    ]}
                  >
                    {getInitials(teamName)}
                  </Text>
                </View>
                <View style={styles.reviewDetails}>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                    {teamName.trim() || 'Willow Café'}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                    Your membership: Owner
                  </Text>
                </View>
              </View>
            </View>

            {/* Notice (r-notice) */}
            <View
              style={[
                styles.noticeBox,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  marginTop: 24,
                },
              ]}
            >
              <InfoIcon color={colors.onSurfaceVariant} size={18} />
              <View style={styles.noticeTextContainer}>
                <Text style={[styles.noticeTitle, { color: colors.onSurface }]}>
                  A fresh start
                </Text>
                <Text style={[styles.noticeBody, { color: colors.onSurfaceVariant }]}>
                  Your dashboard starts empty. Shifts and invitations appear as you use Rota.
                </Text>
              </View>
            </View>

            {/* Edit Team Name (Secondary Action) */}
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => setStep(2)}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                Edit team name
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Inline error notice if error occurs */}
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
                Could not proceed
              </Text>
              <Text style={[styles.noticeBody, { color: colors.onErrorContainer }]}>
                {errorMessage}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Persistent Footer Actions (r-footer) */}
      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {step === 1 && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setStep(2)}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              Set up my team
            </Text>
          </TouchableOpacity>
        )}

        {step === 2 && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleAdvanceToReview}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              Review team
            </Text>
            <ArrowRightIcon color={colors.onPrimary} size={16} />
          </TouchableOpacity>
        )}

        {step === 3 && (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleCreateTeam}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                Create team & continue
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  stepperBar: {
    flex: 1,
    height: 4,
    borderRadius: 9999,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    ...titleLargeText,
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  stack: {
    gap: 12,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarBadgeLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLarge: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
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
    marginBottom: 20,
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
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reviewDetails: {
    flex: 1,
  },
  secondaryButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
});
