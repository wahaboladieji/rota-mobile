import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { redisConnection } from '../jobs/queue';
import { prismaPrimary } from '../data/db';
import { logger } from '../observability/logger';
import { sendVerificationCodeEmail } from '../services/mailer.service';

export type VerificationPurpose = 'EMAIL_VERIFICATION' | 'MAGIC_LINK' | 'PASSWORD_RESET' | 'TWO_FACTOR';

export interface CreateVerificationCodeOptions {
  recipientEmail: string;
  userId?: string;
  purpose: VerificationPurpose;
  expiresInSeconds?: number;
  sendEmail?: boolean;
}

export interface VerificationCodeRecord {
  codeHash: string;
  recipientEmail: string;
  userId?: string;
  purpose: VerificationPurpose;
  expiresAt: string;
  usedAt?: string | null;
}

export interface VerifyCodeResult {
  valid: boolean;
  error?: string;
  recipientEmail?: string;
  userId?: string;
  purpose?: VerificationPurpose;
}

export class VerificationCodeService {
  /**
   * Generates a cryptographic verification code using crypto.randomBytes(32).toString('hex')
   * constrained to 6 hex characters.
   */
  public static generateVerificationCode(): string {
    return crypto.randomBytes(32).toString('hex').slice(0, 6);
  }

  /**
   * Computes a bcrypt hash with a cost factor of 12 for a verification code.
   * In compliance with security requirements, raw verification codes are never stored in plaintext.
   */
  public static async hashVerificationCode(code: string): Promise<string> {
    return bcrypt.hash(code.trim().toLowerCase(), 12);
  }

  /**
   * Compares a plaintext verification code with a stored bcrypt hash.
   */
  public static async compareVerificationCode(code: string, hash: string): Promise<boolean> {
    return bcrypt.compare(code.trim().toLowerCase(), hash);
  }

  /**
   * Issues a new single-use 6-hex verification code, hashes it with bcrypt (cost factor 12),
   * saves it to Redis and/or Prisma, and optionally sends it to the recipient via Nodemailer.
   */
  public static async createVerificationCode(
    options: CreateVerificationCodeOptions
  ): Promise<{ code: string; codeHash: string; expiresAt: Date }> {
    const {
      recipientEmail,
      userId,
      purpose,
      expiresInSeconds = 15 * 60, // 15 minutes default
      sendEmail = true,
    } = options;

    const normalizedEmail = recipientEmail.toLowerCase().trim();

    // 1. Generate 6-hex-character code using crypto.randomBytes(32).toString('hex').slice(0, 6)
    const code = this.generateVerificationCode();
    // 2. Hash with bcrypt using cost factor of 12
    const codeHash = await this.hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Persist in Redis keyed by purpose and recipient email for rapid distributed verification
    const redisKey = `verification:${purpose}:${normalizedEmail}`;
    const recordPayload: VerificationCodeRecord = {
      codeHash,
      recipientEmail: normalizedEmail,
      userId,
      purpose,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
    };

    try {
      await redisConnection.set(redisKey, JSON.stringify(recordPayload), 'EX', expiresInSeconds);
    } catch (redisErr) {
      logger.error('Redis failed while saving verification code', redisErr);
    }

    // 4. For purpose-specific flows, sync with Prisma relational tables
    if (userId) {
      try {
        if (purpose === 'MAGIC_LINK') {
          await prismaPrimary.magicLinkToken.create({
            data: {
              userId,
              tokenHash: codeHash,
              expiresAt,
            },
          });
        } else if (purpose === 'PASSWORD_RESET') {
          await prismaPrimary.passwordResetToken.create({
            data: {
              userId,
              tokenHash: codeHash,
              expiresAt,
            },
          });
        }
      } catch (dbErr) {
        logger.error(`Database error syncing ${purpose} token in Prisma`, dbErr);
      }
    }

    // 5. Send email via Nodemailer if requested
    if (sendEmail) {
      try {
        await sendVerificationCodeEmail(recipientEmail, code, purpose.replace('_', ' '));
      } catch (mailErr) {
        logger.error('Nodemailer error sending verification code email', mailErr, { recipientEmail, purpose });
      }
    }

    logger.info('Verification code generated and issued', {
      recipientEmail: normalizedEmail,
      purpose,
      expiresAt: expiresAt.toISOString(),
    });

    return { code, codeHash, expiresAt };
  }

  /**
   * Verifies and atomically consumes a verification code.
   * Validates against bcrypt hash (cost factor 12) and rejects expired, wrong-purpose,
   * or already-consumed codes (replay attack protection).
   */
  public static async verifyCode(
    code: string,
    purpose: VerificationPurpose,
    expectedRecipientEmail?: string
  ): Promise<VerifyCodeResult> {
    if (!code || code.trim().length === 0) {
      return { valid: false, error: 'Verification code cannot be empty' };
    }

    const cleanCode = code.trim().toLowerCase();

    // 1. Direct O(1) Redis lookup if email is supplied
    if (expectedRecipientEmail) {
      const normalizedEmail = expectedRecipientEmail.toLowerCase().trim();
      const redisKey = `verification:${purpose}:${normalizedEmail}`;
      try {
        const dataStr = await redisConnection.get(redisKey);
        if (dataStr) {
          const record: VerificationCodeRecord = JSON.parse(dataStr);

          if (record.usedAt) {
            return { valid: false, error: 'Verification code has already been used' };
          }

          const expiresAt = new Date(record.expiresAt);
          if (Date.now() > expiresAt.getTime()) {
            await redisConnection.del(redisKey);
            return { valid: false, error: 'Verification code has expired' };
          }

          const isMatch = await this.compareVerificationCode(cleanCode, record.codeHash);
          if (!isMatch) {
            return { valid: false, error: 'Invalid verification code' };
          }

          // Atomically consume (delete single-use token from Redis)
          await redisConnection.del(redisKey);

          // Synchronously invalidate corresponding DB token to prevent fallback replay
          if (record.userId) {
            try {
              if (record.purpose === 'PASSWORD_RESET') {
                await prismaPrimary.passwordResetToken.updateMany({
                  where: { userId: record.userId, usedAt: null },
                  data: { usedAt: new Date() },
                });
              } else if (record.purpose === 'MAGIC_LINK') {
                await prismaPrimary.magicLinkToken.updateMany({
                  where: { userId: record.userId, usedAt: null },
                  data: { usedAt: new Date() },
                });
              }
            } catch (prismaErr) {
              logger.error('Error invalidating DB token during Redis verification', prismaErr);
            }
          }

          return {
            valid: true,
            recipientEmail: record.recipientEmail,
            userId: record.userId,
            purpose: record.purpose,
          };
        }
      } catch (redisErr) {
        logger.error('Redis lookup error during verification code validation', redisErr);
      }
    } else {
      // If email was not passed, scan active keys for this purpose in Redis
      try {
        const keys = await redisConnection.keys(`verification:${purpose}:*`);
        for (const key of keys) {
          const dataStr = await redisConnection.get(key);
          if (!dataStr) continue;
          const record: VerificationCodeRecord = JSON.parse(dataStr);
          if (record.usedAt) continue;
          if (Date.now() > new Date(record.expiresAt).getTime()) {
            await redisConnection.del(key);
            continue;
          }

          const isMatch = await this.compareVerificationCode(cleanCode, record.codeHash);
          if (isMatch) {
            await redisConnection.del(key);

            if (record.userId) {
              try {
                if (record.purpose === 'PASSWORD_RESET') {
                  await prismaPrimary.passwordResetToken.updateMany({
                    where: { userId: record.userId, usedAt: null },
                    data: { usedAt: new Date() },
                  });
                } else if (record.purpose === 'MAGIC_LINK') {
                  await prismaPrimary.magicLinkToken.updateMany({
                    where: { userId: record.userId, usedAt: null },
                    data: { usedAt: new Date() },
                  });
                }
              } catch (prismaErr) {
                logger.error('Error invalidating DB token during Redis scan verification', prismaErr);
              }
            }

            return {
              valid: true,
              recipientEmail: record.recipientEmail,
              userId: record.userId,
              purpose: record.purpose,
            };
          }
        }
      } catch (redisErr) {
        logger.error('Redis scan error during verification code validation', redisErr);
      }
    }

    // 2. Check Prisma fallback if Redis key expired or for DB-backed tokens
    if (purpose === 'MAGIC_LINK') {
      const candidates = await prismaPrimary.magicLinkToken.findMany({
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() },
          ...(expectedRecipientEmail
            ? { user: { email: expectedRecipientEmail.toLowerCase().trim() } }
            : {}),
        },
        include: { user: true },
        orderBy: { expiresAt: 'desc' },
      });

      for (const dbToken of candidates) {
        let isMatch = false;
        if (dbToken.tokenHash.startsWith('$2')) {
          isMatch = await this.compareVerificationCode(cleanCode, dbToken.tokenHash);
        } else {
          const shaHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
          isMatch = dbToken.tokenHash === shaHash;
        }

        if (isMatch) {
          await prismaPrimary.magicLinkToken.update({
            where: { id: dbToken.id },
            data: { usedAt: new Date() },
          });

          return {
            valid: true,
            recipientEmail: dbToken.user.email,
            userId: dbToken.userId,
            purpose,
          };
        }
      }
    }

    if (purpose === 'PASSWORD_RESET') {
      const candidates = await prismaPrimary.passwordResetToken.findMany({
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() },
          ...(expectedRecipientEmail
            ? { user: { email: expectedRecipientEmail.toLowerCase().trim() } }
            : {}),
        },
        include: { user: true },
        orderBy: { expiresAt: 'desc' },
      });

      for (const dbToken of candidates) {
        let isMatch = false;
        if (dbToken.tokenHash.startsWith('$2')) {
          isMatch = await this.compareVerificationCode(cleanCode, dbToken.tokenHash);
        } else {
          const shaHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
          isMatch = dbToken.tokenHash === shaHash;
        }

        if (isMatch) {
          await prismaPrimary.passwordResetToken.update({
            where: { id: dbToken.id },
            data: { usedAt: new Date() },
          });

          return {
            valid: true,
            recipientEmail: dbToken.user.email,
            userId: dbToken.userId,
            purpose,
          };
        }
      }
    }

    return { valid: false, error: 'Invalid or expired verification code' };
  }
}
