import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authConfig } from '../config';

const JWT_ACCESS_SECRET = authConfig.jwtAccessSecret;
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = authConfig.accessTokenExpiresInSeconds;

export const TOKEN_LIFETIMES = {
  MAGIC_LINK_SECONDS: authConfig.magicLinkExpiresInSeconds,
  PASSWORD_RESET_SECONDS: authConfig.passwordResetExpiresInSeconds,
  INVITATION_SECONDS: authConfig.invitationExpiresInSeconds,
  REFRESH_TOKEN_SECONDS: authConfig.refreshTokenExpiresInSeconds,
  VERIFICATION_CODE_SECONDS: authConfig.verificationCodeExpiresInSeconds,
};

export interface AccessTokenPayload {
  userId: string;
  email: string;
  sessionId: string;
}

/**
 * Hashes a plaintext password using bcrypt with a configurable cost factor (default 12).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, authConfig.bcryptRounds);
}

/**
 * Compares a plaintext password with a stored hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Computes a deterministic SHA-256 hash of a single-use token for secure storage at rest.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a high-entropy random URL-safe token.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a cryptographic verification code using crypto.randomBytes(32).toString('hex') with 6 hex characters.
 */
export function generateVerificationCode(): string {
  return crypto.randomBytes(32).toString('hex').slice(0, 6);
}

/**
 * Hashes a verification code using bcrypt with a cost factor of 12.
 */
export async function hashVerificationCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim().toLowerCase(), 12);
}

/**
 * Compares a plaintext verification code with a stored bcrypt hash.
 */
export async function compareVerificationCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.trim().toLowerCase(), hash);
}

export { VerificationCodeService } from './verification.service';

/**
 * Issues a short-lived signed JWT access token.
 */
export function issueAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes a signed JWT access token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
}
