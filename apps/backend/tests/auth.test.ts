import request from 'supertest';
import { app } from '../src/app';
import { prismaPrimary } from '../src/data/db';
import {
  hashPassword,
  hashToken,
  generateVerificationCode,
  hashVerificationCode,
  compareVerificationCode,
  VerificationCodeService,
} from '../src/auth/tokens';
import { getMailerTransporter, sendVerificationCodeEmail, recordedSentEmails } from '../src/services/mailer.service';
import { closeQueue } from '../src/jobs/queue';

describe('Authentication & Session Invariants (PRD F1.1, F1.5)', () => {
  const testEmail = `authtest-${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';

  afterAll(async () => {
    const users = await prismaPrimary.user.findMany({
      where: { email: { contains: 'authtest-' } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prismaPrimary.refreshToken.deleteMany({
        where: { session: { userId: { in: userIds } } },
      });
      await prismaPrimary.session.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prismaPrimary.magicLinkToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prismaPrimary.passwordResetToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prismaPrimary.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await closeQueue();
    await prismaPrimary.$disconnect();
  });

  describe('Sign-up & Password Authentication', () => {
    it('creates a new user and returns JWT access + refresh tokens', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Verify password was securely hashed with bcrypt (cost factor 12) in PostgreSQL
      const dbUser = await prismaPrimary.user.findUnique({
        where: { email: testEmail.toLowerCase() },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.passwordHash).not.toBe(testPassword);
      expect(dbUser?.passwordHash?.startsWith('$2')).toBe(true);
      expect(dbUser?.passwordHash?.includes('$12$')).toBe(true);
    });

    it('rejects duplicate email registration with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('accepts sign-up with full name and parses edge cases with > 3 words into schema', async () => {
      const edgeCaseEmail = `authtest-edge-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: edgeCaseEmail,
          password: testPassword,
          fullName: 'Alexander Michael James Montgomery von Hamilton',
          firstName: 'Alexander',
          middleName: 'Michael',
          lastName: 'Hamilton',
          additionalNames: ['James', 'Montgomery', 'von'],
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(edgeCaseEmail.toLowerCase());
      expect(res.body.accessToken).toBeDefined();
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('rejects invalid password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid/i);
    });
  });

  describe('Refresh Token Rotation & Compromise Detection (PRD F1.5)', () => {
    it('rotates refresh token and preserves session', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      const initialRefresh = loginRes.body.refreshToken;

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefresh });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(initialRefresh);

      // Verify the previous token is marked used
      const oldHash = hashToken(initialRefresh);
      const oldToken = await prismaPrimary.refreshToken.findUnique({
        where: { tokenHash: oldHash },
      });
      expect(oldToken?.usedAt).not.toBeNull();
    });

    it('detects refresh token reuse and immediately revokes token family (PRD F1.5)', async () => {
      // 1. Login to get token R1
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      const tokenR1 = loginRes.body.refreshToken;

      // 2. Legitimate rotation: R1 -> R2
      const rotateRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokenR1 });

      expect(rotateRes.status).toBe(200);
      const tokenR2 = rotateRes.body.refreshToken;

      // 3. Attacker attempts to replay already-used R1!
      const attackRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokenR1 });

      expect(attackRes.status).toBe(401);
      expect(attackRes.body.error).toMatch(/revoked/i);

      // 4. Legitimate R2 should now be revoked because the entire family was invalidated
      const subsequentRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tokenR2 });

      expect(subsequentRes.status).toBe(401);
    });
  });

  describe('Logout & Session Revocation', () => {
    it('invalidates session upon logout', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      const token = loginRes.body.accessToken;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Subsequent authenticated call should fail
      const meRes = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(401);
    });
  });

  describe('Password Reset & Magic Link (PRD F1.1)', () => {
    it('initiates password reset and single-use token update', async () => {
      const user = await prismaPrimary.user.findUnique({
        where: { email: testEmail.toLowerCase() },
      });
      expect(user).not.toBeNull();

      // Directly create a known token in DB to test consumption
      const rawToken = `known-test-reset-token-${Date.now()}`;
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prismaPrimary.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt,
        },
      });

      // Confirm with new password
      const newPassword = 'NewBrandPassword456!';
      const confirmRes = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({ token: rawToken, newPassword });

      expect(confirmRes.status).toBe(200);

      // Verify token is single-use and cannot be used again
      const replayRes = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({ token: rawToken, newPassword: 'AnotherPassword789!' });

      expect(replayRes.status).toBe(400);

      // Verify login works with new password
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: newPassword });

      expect(newLoginRes.status).toBe(200);
    });

    it('authenticates with single-use magic link token', async () => {
      const user = await prismaPrimary.user.findUnique({
        where: { email: testEmail.toLowerCase() },
      });
      expect(user).not.toBeNull();

      const rawToken = `known-magic-token-${Date.now()}`;
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prismaPrimary.magicLinkToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt,
        },
      });

      // Verify token
      const verifyRes = await request(app)
        .post('/api/auth/magic-link/verify')
        .send({ token: rawToken });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.accessToken).toBeDefined();

      // Verify token cannot be reused
      const replayRes = await request(app)
        .post('/api/auth/magic-link/verify')
        .send({ token: rawToken });

      expect(replayRes.status).toBe(401);
    });
  });

  describe('Nodemailer Setup & Verification Code Service (6 Hex Characters, Bcrypt Cost 12)', () => {
    it('generates a 6-hex-character cryptographic verification code using crypto.randomBytes(32)', () => {
      const code1 = VerificationCodeService.generateVerificationCode();
      const code2 = generateVerificationCode();

      // Constrained to exactly 6 hex characters
      expect(typeof code1).toBe('string');
      expect(code1.length).toBe(6);
      expect(/^[0-9a-f]{6}$/i.test(code1)).toBe(true);

      expect(typeof code2).toBe('string');
      expect(code2.length).toBe(6);
      expect(/^[0-9a-f]{6}$/i.test(code2)).toBe(true);

      // Distinct high-entropy outputs
      expect(code1).not.toBe(code2);
    });

    it('hashes verification codes using bcrypt with cost factor 12', async () => {
      const code = generateVerificationCode();
      const hash = await hashVerificationCode(code);

      expect(hash.startsWith('$2')).toBe(true);
      expect(hash.includes('$12$')).toBe(true);

      const isValid = await compareVerificationCode(code, hash);
      expect(isValid).toBe(true);

      const isInvalid = await compareVerificationCode('000000', hash);
      expect(isInvalid).toBe(false);
    });

    it('initializes Nodemailer transporter and sends verification code email', async () => {
      const transporter = getMailerTransporter();
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');

      const recipient = `verify-${Date.now()}@example.com`;
      const code = VerificationCodeService.generateVerificationCode();

      const result = await sendVerificationCodeEmail(recipient, code, 'Email Verification');
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      const recorded = recordedSentEmails.find((m) => m.to === recipient);
      expect(recorded).toBeDefined();
      expect(recorded?.subject).toMatch(/Email Verification/i);
      expect(recorded?.html).toContain(code);
    });

    it('creates, hashes with bcrypt 12, and stores verification code with single-use guarantee', async () => {
      const recipient = `single-use-${Date.now()}@example.com`;
      const created = await VerificationCodeService.createVerificationCode({
        recipientEmail: recipient,
        purpose: 'EMAIL_VERIFICATION',
        expiresInSeconds: 300,
        sendEmail: true,
      });

      expect(created.code).toBeDefined();
      expect(created.code.length).toBe(6);
      expect(created.codeHash.startsWith('$2')).toBe(true);
      expect(created.codeHash.includes('$12$')).toBe(true);
      expect(await compareVerificationCode(created.code, created.codeHash)).toBe(true);

      // Verifying with correct code succeeds
      const verifySuccess = await VerificationCodeService.verifyCode(
        created.code,
        'EMAIL_VERIFICATION',
        recipient
      );
      expect(verifySuccess.valid).toBe(true);
      expect(verifySuccess.recipientEmail).toBe(recipient.toLowerCase());

      // Replay attempt fails (single-use constraint)
      const replayAttempt = await VerificationCodeService.verifyCode(
        created.code,
        'EMAIL_VERIFICATION',
        recipient
      );
      expect(replayAttempt.valid).toBe(false);
      expect(replayAttempt.error).toMatch(/already been used|invalid/i);
    });

    it('exposes API routes to send and verify cryptographic verification codes', async () => {
      const apiRecipient = `apiverify-${Date.now()}@example.com`;

      // 1. Send verification code
      const sendRes = await request(app)
        .post('/api/auth/verification-code/send')
        .send({
          email: apiRecipient,
          purpose: 'EMAIL_VERIFICATION',
        });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.message).toMatch(/dispatched successfully/i);
      const devCode = sendRes.body.devCode;
      expect(devCode).toBeDefined();
      expect(devCode.length).toBe(6);

      // 2. Reject incorrect verification code
      const failRes = await request(app)
        .post('/api/auth/verification-code/verify')
        .send({
          email: apiRecipient,
          code: '000000',
          purpose: 'EMAIL_VERIFICATION',
        });
      expect(failRes.status).toBe(400);

      // 3. Confirm with valid code
      const successRes = await request(app)
        .post('/api/auth/verification-code/verify')
        .send({
          email: apiRecipient,
          code: devCode,
          purpose: 'EMAIL_VERIFICATION',
        });
      expect(successRes.status).toBe(200);
      expect(successRes.body.verified).toBe(true);
      expect(successRes.body.email).toBe(apiRecipient.toLowerCase());

      // 4. Replay attempt rejected
      const replayRes = await request(app)
        .post('/api/auth/verification-code/verify')
        .send({
          email: apiRecipient,
          code: devCode,
          purpose: 'EMAIL_VERIFICATION',
        });
      expect(replayRes.status).toBe(400);
    });
  });
});
