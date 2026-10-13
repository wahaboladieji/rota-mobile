import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  StatusBar,
  ScrollView,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_SIZE = Math.min(SCREEN_WIDTH * 0.72, 320);

/**
 * Floating team-context chip rendered as a decorative accent
 * in the hero area, inspired by modern Dribbble welcome screens.
 */
const FloatingChip: React.FC<{
  label: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
  style?: object;
  delay?: number;
}> = ({ label, icon, backgroundColor, textColor, style, delay = 0 }) => {
  const { typography } = useTheme();
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [translateY, opacity, delay]);

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor, transform: [{ translateY }], opacity },
        style,
      ]}
    >
      <Text style={[styles.chipIcon, { fontSize: typography.roles.labelLarge.fontSize }]}>{icon}</Text>
      <Text
        style={[
          styles.chipLabel,
          {
            color: textColor,
            fontFamily: typography.roles.labelMedium.fontFamily,
            fontSize: typography.roles.labelMedium.fontSize,
            fontWeight: typography.roles.labelMedium.fontWeight,
            lineHeight: typography.roles.labelMedium.lineHeight,
            letterSpacing: typography.roles.labelMedium.letterSpacing,
          },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
};

/**
 * Decorative dot grid pattern drawn with React Native Views.
 * Adds subtle texture to the hero background.
 */
const DotPattern: React.FC<{
  rows: number;
  cols: number;
  dotColor: string;
  style?: object;
}> = ({ rows, cols, dotColor, style }) => (
  <View style={[styles.dotGrid, style]} pointerEvents="none">
    {Array.from({ length: rows }).map((_, r) => (
      <View key={r} style={styles.dotRow}>
        {Array.from({ length: cols }).map((_, c) => (
          <View
            key={c}
            style={[
              styles.dot,
              { backgroundColor: dotColor },
            ]}
          />
        ))}
      </View>
    ))}
  </View>
);

interface WelcomeScreenProps {
  onNavigateToLogin: () => void;
  onNavigateToSignUp: () => void;
  onOpenInviteCode?: (code: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onNavigateToLogin,
  onNavigateToSignUp,
  onOpenInviteCode,
}) => {
  const { colors, typography, spacingCollection, borderRadius } = useTheme();

  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  // Animate the hero illustration entry
  const heroScale = useRef(new Animated.Value(0.9)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;

  // Dynamically compute the top shift to move the illustration down
  // and reduce the space between the illustration and the section below by 50%
  const heroTopOffset = Math.max(Math.round((SCREEN_HEIGHT - 700) * 0.5), 28);

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // 1. Hero image fades in and scales up
      Animated.parallel([
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // 2. Content slides up
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [heroScale, heroOpacity, contentOpacity, contentTranslateY]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* ─── Ambient Glow Background ─── */}
      <View style={styles.glowContainer} pointerEvents="none">
        <View
          style={[
            styles.glowOrb,
            styles.glowOrbPrimary,
            { backgroundColor: colors.primaryContainer },
          ]}
        />
        <View
          style={[
            styles.glowOrb,
            styles.glowOrbSecondary,
            { backgroundColor: colors.secondaryContainer },
          ]}
        />
      </View>

      {/* ─── Dot Pattern Texture ─── */}
      <DotPattern
        rows={6}
        cols={8}
        dotColor={colors.outlineVariant}
        style={[styles.dotPatternTopRight, { top: 60 + Math.round(heroTopOffset * 0.5) }]}
      />
      <DotPattern
        rows={4}
        cols={5}
        dotColor={colors.outlineVariant}
        style={styles.dotPatternBottomLeft}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight || 0) + 16, 32) : 44,
            paddingBottom: Platform.OS === 'ios' ? 40 : 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ─── Hero Section ─── */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              marginTop: heroTopOffset,
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
            },
          ]}
        >
          <View
            style={[
              styles.heroImageContainer,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderRadius: borderRadius['2xl'],
                shadowColor: colors.primary,
              },
            ]}
          >
            <Image
              source={require('../../../assets/welcome-hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>

          {/* ─── Floating Context Chips ─── */}
          <FloatingChip
            label="Morning Shift"
            icon="☀️"
            backgroundColor={colors.primaryContainer}
            textColor={colors.onPrimaryContainer}
            style={styles.chipTopLeft}
            delay={800}
          />
          <FloatingChip
            label="Swap Approved"
            icon="✅"
            backgroundColor={colors.secondaryContainer}
            textColor={colors.onSecondaryContainer}
            style={styles.chipBottomRight}
            delay={1100}
          />
          <FloatingChip
            label="Team Active"
            icon="👥"
            backgroundColor={colors.tertiaryContainer}
            textColor={colors.onTertiaryContainer}
            style={styles.chipMiddleLeft}
            delay={1400}
          />
        </Animated.View>

        {/* ─── Content Dock ─── */}
        <Animated.View
          style={[
            styles.contentDock,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          {/* Brand Mark */}
          <View style={styles.brandRow}>
            <View
              style={[
                styles.brandDot,
                { backgroundColor: colors.primary },
              ]}
            />
            <Text
              style={[
                styles.brandName,
                {
                  color: colors.primary,
                  fontFamily: typography.roles.titleLarge.fontFamily,
                  fontSize: typography.roles.titleMedium.fontSize,
                  fontWeight: typography.roles.titleLarge.fontWeight,
                  letterSpacing: typography.letterSpacing.widest,
                },
              ]}
            >
              ROTA
            </Text>
          </View>

          {/* Headline */}
          <Text
            style={[
              styles.headline,
              {
                color: colors.onBackground,
                fontFamily: typography.roles.titleLarge.fontFamily,
                fontSize: typography.roles.titleLarge.fontSize,
                fontWeight: typography.roles.titleLarge.fontWeight,
                lineHeight: typography.roles.titleLarge.lineHeight,
                letterSpacing: typography.roles.titleLarge.letterSpacing,
              },
            ]}
          >
            Effortless Team{'\n'}Shift Scheduling
          </Text>

          {/* Subtitle */}
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.onSurfaceVariant,
                fontFamily: typography.roles.bodyLarge.fontFamily,
                fontSize: typography.roles.bodyLarge.fontSize,
                fontWeight: typography.roles.bodyLarge.fontWeight,
                lineHeight: typography.roles.bodyLarge.lineHeight,
                letterSpacing: typography.roles.bodyLarge.letterSpacing,
                marginTop: spacingCollection.space100Base,
              },
            ]}
          >
            Manage shifts, approve swaps, and coordinate your team seamlessly — all in one place.
          </Text>

          {/* ─── CTA Buttons ─── */}
          <View style={[styles.ctaContainer, { marginTop: spacingCollection.space300 }]}>
            <Button
              title="Get Started"
              onPress={onNavigateToSignUp}
              variant="primary"
              style={{
                width: '100%',
                borderRadius: borderRadius.lg,
                paddingVertical: spacingCollection.space175,
                elevation: 4,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
              }}
              textStyle={{
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontSize: typography.roles.labelLarge.fontSize,
                fontWeight: typography.roles.labelLarge.fontWeight,
                lineHeight: typography.roles.labelLarge.lineHeight,
                letterSpacing: typography.roles.labelLarge.letterSpacing,
              }}
            />

            <Button
              title="I already have an account"
              onPress={onNavigateToLogin}
              variant="outline"
              style={{
                width: '100%',
                borderRadius: borderRadius.lg,
                paddingVertical: spacingCollection.space175,
                borderColor: colors.outlineVariant,
                marginTop: spacingCollection.space100Base,
              }}
              textStyle={{
                fontFamily: typography.roles.labelLarge.fontFamily,
                fontSize: typography.roles.labelLarge.fontSize,
                fontWeight: typography.roles.labelLarge.fontWeight,
                lineHeight: typography.roles.labelLarge.lineHeight,
                letterSpacing: typography.roles.labelLarge.letterSpacing,
              }}
            />

            <TouchableOpacity
              onPress={() => setIsInviteModalVisible(true)}
              style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}
            >
              <Text
                style={{
                  fontFamily: typography.roles.labelLarge.fontFamily,
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.primary,
                }}
              >
                Have an invitation code?
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Manual Invitation Code Modal */}
      <Modal visible={isInviteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.modalHeading, { color: colors.onSurface }]}>Enter invitation code</Text>
            <Text style={[styles.modalSub, { color: colors.onSurfaceVariant }]}>
              Paste your invitation code or link to join your team.
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.surfaceContainerLow,
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface,
                },
              ]}
              placeholder="Paste code or link here..."
              placeholderTextColor={colors.onSurfaceVariant}
              value={inviteCodeInput}
              onChangeText={setInviteCodeInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtonStack}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const cleaned = inviteCodeInput.trim().replace(/^.*invite\//, '').replace(/[/?#].*$/, '');
                  if (cleaned) {
                    setIsInviteModalVisible(false);
                    setInviteCodeInput('');
                    onOpenInviteCode?.(cleaned);
                  }
                }}
              >
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  Continue
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.outlineVariant,
                    marginTop: 8,
                  },
                ]}
                onPress={() => {
                  setIsInviteModalVisible(false);
                  setInviteCodeInput('');
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.onSurface }]}>
                  Cancel
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
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  /* ── Ambient Glow ── */
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.35,
  },
  glowOrbPrimary: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    top: -SCREEN_WIDTH * 0.15,
    right: -SCREEN_WIDTH * 0.2,
  },
  glowOrbSecondary: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    top: SCREEN_HEIGHT * 0.25,
    left: -SCREEN_WIDTH * 0.15,
  },

  /* ── Dot Patterns ── */
  dotGrid: {
    position: 'absolute',
    zIndex: 1,
    opacity: 0.3,
  },
  dotRow: {
    flexDirection: 'row',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    margin: 8,
  },
  dotPatternTopRight: {
    top: 60,
    right: 20,
  },
  dotPatternBottomLeft: {
    bottom: 160,
    left: 16,
  },

  /* ── Hero Section ── */
  heroSection: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
    minHeight: Math.min(SCREEN_HEIGHT * 0.40, 310),
  },
  heroImageContainer: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },

  /* ── Floating Chips ── */
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipLabel: {},
  chipTopLeft: {
    top: 16,
    left: 12,
  },
  chipBottomRight: {
    bottom: 12,
    right: 12,
  },
  chipMiddleLeft: {
    bottom: 56,
    left: 4,
  },

  /* ── Content Dock ── */
  contentDock: {
    paddingHorizontal: 28,
    paddingBottom: 16,
    zIndex: 2,
  },

  /* ── Brand ── */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  brandName: {},

  /* ── Typography ── */
  headline: {},
  subtitle: {},

  /* ── CTA ── */
  ctaContainer: {
    width: '100%',
  },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtonStack: {
    gap: 8,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

