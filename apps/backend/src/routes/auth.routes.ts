import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  SignUpInputSchema,
  LoginInputSchema,
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  RefreshTokenInputSchema,
  VerificationCodeRequestSchema,
  VerificationCodeVerifySchema,
} from '@rota/shared';
import { prismaPrimary } from '../data/db';
import {
  hashPassword,
  comparePassword,
  hashToken,
  generateSecureToken,
  generateVerificationCode,
  hashVerificationCode,
  issueAccessToken,
  TOKEN_LIFETIMES,
  VerificationCodeService,
} from '../auth/tokens';
import { VerificationPurpose } from '../auth/verification.service';
import { authenticate, AuthenticatedRequest } from '../auth/guards';
import { enqueueEmailJob, redisConnection } from '../jobs/queue';
import { logger } from '../observability/logger';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limiter';

export const authRouter = Router();

/**
 * POST /api/auth/signup - Email/password sign-up
 */
authRouter.post('/signup', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = SignUpInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, password } = parseResult.data;

  // Check unique email
  const existingUser = await prismaPrimary.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const rawRefreshToken = generateSecureToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const familyId = uuidv4();

  const result = await prismaPrimary.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    const session = await tx.session.create({
      data: {
        userId: user.id,
      },
    });

    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        familyId,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.REFRESH_TOKEN_SECONDS * 1000),
      },
    });

    const accessToken = issueAccessToken({
      userId: user.id,
      email: user.email,
      sessionId: session.id,
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  });

  logger.info('User signed up successfully', { userId: result.user.id });
  res.status(201).json(result);
});

/**
 * POST /api/auth/login - Email/password login
 */
authRouter.post('/login', loginRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = LoginInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, password } = parseResult.data;
  const user = await prismaPrimary.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const rawRefreshToken = generateSecureToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const familyId = uuidv4();

  const result = await prismaPrimary.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: { userId: user.id },
    });

    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        familyId,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.REFRESH_TOKEN_SECONDS * 1000),
      },
    });

    const accessToken = issueAccessToken({
      userId: user.id,
      email: user.email,
      sessionId: session.id,
    });

    return {
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  });

  logger.info('User logged in successfully', { userId: user.id });
  res.status(200).json(result);
});

/**
 * POST /api/auth/refresh - Refresh token rotation with replay attack detection
 */
authRouter.post('/refresh', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = RefreshTokenInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { refreshToken } = parseResult.data;
  const hashed = hashToken(refreshToken);

  const existingToken = await prismaPrimary.refreshToken.findUnique({
    where: { tokenHash: hashed },
    include: { session: { include: { user: true } } },
  });

  if (!existingToken) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Compromise signal: token reuse detected!
  if (existingToken.usedAt !== null) {
    logger.warn('Token replay detected! Revoking token family', { familyId: existingToken.familyId });
    // Revoke entire family and session
    await prismaPrimary.$transaction([
      prismaPrimary.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { revokedAt: new Date() },
      }),
      prismaPrimary.session.update({
        where: { id: existingToken.sessionId },
        data: { revokedAt: new Date() },
      }),
    ]);
    res.status(401).json({ error: 'Compromised token detected: Session revoked' });
    return;
  }

  // Check expiration or revocation
  if (existingToken.revokedAt !== null || existingToken.expiresAt < new Date()) {
    res.status(401).json({ error: 'Refresh token expired or revoked' });
    return;
  }

  // Rotate token atomically
  const newRawRefreshToken = generateSecureToken();
  const newHashedRefreshToken = hashToken(newRawRefreshToken);

  const newTokens = await prismaPrimary.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existingToken.id },
      data: { usedAt: new Date() },
    });

    await tx.refreshToken.create({
      data: {
        sessionId: existingToken.sessionId,
        familyId: existingToken.familyId,
        tokenHash: newHashedRefreshToken,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.REFRESH_TOKEN_SECONDS * 1000),
      },
    });

    const accessToken = issueAccessToken({
      userId: existingToken.session.userId,
      email: existingToken.session.user.email,
      sessionId: existingToken.sessionId,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  });

  res.status(200).json(newTokens);
});

/**
 * POST /api/auth/logout - Invalidate current session and optional device push token
 */
authRouter.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await prismaPrimary.session.update({
      where: { id: req.user.sessionId },
      data: { revokedAt: new Date() },
    });

    if (req.body?.pushToken && typeof req.body.pushToken === 'string') {
      await prismaPrimary.device.updateMany({
        where: { pushToken: req.body.pushToken, userId: req.user.userId },
        data: { invalidatedAt: new Date() },
      });
      logger.info('Device push token invalidated on logout', { userId: req.user.userId });
    }

    logger.info('User logged out', { userId: req.user.userId, sessionId: req.user.sessionId });
  }
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/logout-all - Invalidate all sessions and all device push tokens for user
 */
authRouter.post('/logout-all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await prismaPrimary.session.updateMany({
      where: { userId: req.user.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prismaPrimary.device.updateMany({
      where: { userId: req.user.userId, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    logger.info('User logged out of all devices; sessions and push tokens invalidated', { userId: req.user.userId });
  }
  res.status(200).json({ message: 'All sessions revoked successfully' });
});

/**
 * POST /api/auth/magic-link - Request magic link sign-in
 */
authRouter.post('/magic-link', passwordResetRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = MagicLinkRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email } = parseResult.data;
  let user = await prismaPrimary.user.findUnique({ where: { email } });

  if (!user) {
    // Create unverified user if new
    user = await prismaPrimary.user.create({ data: { email } });
  }

  const rawToken = generateSecureToken();
  const hashed = hashToken(rawToken);

  await prismaPrimary.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash: hashed,
      expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.MAGIC_LINK_SECONDS * 1000),
    },
  });

  // Enqueue email background job
  await enqueueEmailJob({
    type: 'MAGIC_LINK',
    recipientEmail: email,
    tokenHash: hashed,
    linkUrl: `rota://auth/magic-link?token=${rawToken}`,
  });

  // In testing or local dev, return the token for fast verification
  const responsePayload: Record<string, unknown> = {
    message: 'Magic link sent successfully if the account exists',
  };
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.devToken = rawToken;
  }

  res.status(200).json(responsePayload);
});

/**
 * POST /api/auth/magic-link/verify - Consume magic link token
 */
authRouter.post('/magic-link/verify', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = MagicLinkVerifySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { token } = parseResult.data;
  const hashed = hashToken(token);

  const magicLink = await prismaPrimary.magicLinkToken.findUnique({
    where: { tokenHash: hashed },
    include: { user: true },
  });

  if (!magicLink || magicLink.usedAt !== null || magicLink.expiresAt < new Date()) {
    res.status(401).json({ error: 'Invalid or expired magic link' });
    return;
  }

  const rawRefreshToken = generateSecureToken();
  const hashedRefreshToken = hashToken(rawRefreshToken);
  const familyId = uuidv4();

  const result = await prismaPrimary.$transaction(async (tx) => {
    await tx.magicLinkToken.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    const session = await tx.session.create({
      data: { userId: magicLink.userId },
    });

    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        familyId,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.REFRESH_TOKEN_SECONDS * 1000),
      },
    });

    const accessToken = issueAccessToken({
      userId: magicLink.user.id,
      email: magicLink.user.email,
      sessionId: session.id,
    });

    return {
      user: { id: magicLink.user.id, email: magicLink.user.email },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  });

  res.status(200).json(result);
});

/**
 * POST /api/auth/password-reset - Request password reset
 */
authRouter.post('/password-reset', passwordResetRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = PasswordResetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email } = parseResult.data;
  const user = await prismaPrimary.user.findUnique({ where: { email } });

  if (user) {
    const rawCode = generateVerificationCode();
    const hashed = await hashVerificationCode(rawCode);

    await prismaPrimary.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.PASSWORD_RESET_SECONDS * 1000),
      },
    });

    const redisKey = `verification:PASSWORD_RESET:${email.toLowerCase().trim()}`;
    await redisConnection.set(
      redisKey,
      JSON.stringify({
        codeHash: hashed,
        recipientEmail: email.toLowerCase().trim(),
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + TOKEN_LIFETIMES.PASSWORD_RESET_SECONDS * 1000).toISOString(),
        usedAt: null,
      }),
      'EX',
      TOKEN_LIFETIMES.PASSWORD_RESET_SECONDS
    );

    await enqueueEmailJob({
      type: 'PASSWORD_RESET',
      recipientEmail: email,
      tokenHash: hashed,
      linkUrl: `rota://auth/reset-password?token=${rawCode}`,
      code: rawCode,
    });

    const payload: Record<string, unknown> = { message: 'Password reset link sent' };
    if (process.env.NODE_ENV !== 'production') {
      payload.devToken = rawCode;
    }
    res.status(200).json(payload);
    return;
  }

  res.status(200).json({ message: 'Password reset link sent' });
});

/**
 * POST /api/auth/password-reset/confirm - Confirm password reset
 */
authRouter.post('/password-reset/confirm', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = PasswordResetConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { token, newPassword } = parseResult.data;
  const email = (parseResult.data as { email?: string }).email;

  const verifyResult = await VerificationCodeService.verifyCode(
    token,
    'PASSWORD_RESET',
    email
  );

  if (!verifyResult.valid || !verifyResult.userId) {
    res.status(400).json({ error: verifyResult.error || 'Invalid or expired password reset token' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);

  await prismaPrimary.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: verifyResult.userId },
      data: { passwordHash },
    });

    // Revoke all existing sessions for security
    await tx.session.updateMany({
      where: { userId: verifyResult.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  res.status(200).json({ message: 'Password reset successful. Please sign in with your new password.' });
});

/**
 * POST /api/auth/verification-code/send - Issue and email a cryptographic verification code using crypto.randomBytes(32)
 */
authRouter.post('/verification-code/send', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = VerificationCodeRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, purpose } = parseResult.data;
  const user = await prismaPrimary.user.findUnique({ where: { email } });

  const result = await VerificationCodeService.createVerificationCode({
    recipientEmail: email,
    userId: user?.id,
    purpose: purpose as VerificationPurpose,
    sendEmail: true,
  });

  const responsePayload: Record<string, unknown> = {
    message: 'Verification code dispatched successfully',
    expiresAt: result.expiresAt,
  };
  if (process.env.NODE_ENV !== 'production') {
    responsePayload.devCode = result.code;
  }

  res.status(200).json(responsePayload);
});

/**
 * POST /api/auth/verification-code/verify - Validate and consume cryptographic verification code
 */
authRouter.post('/verification-code/verify', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = VerificationCodeVerifySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, code, purpose } = parseResult.data;
  const result = await VerificationCodeService.verifyCode(code, purpose as VerificationPurpose, email);

  if (!result.valid) {
    res.status(400).json({ error: result.error || 'Invalid or expired verification code' });
    return;
  }

  res.status(200).json({
    verified: true,
    email: result.recipientEmail,
    purpose: result.purpose,
    message: 'Verification code confirmed successfully',
  });
});
