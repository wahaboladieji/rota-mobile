import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, AuthenticatedRequest } from '../auth/guards';
import { hashToken } from '../auth/tokens';
import { prismaPrimary } from '../data/db';
import { Role } from '@rota/shared';
import { logger } from '../observability/logger';

export const invitationsRouter = Router();

/**
 * GET /invite/:token - Web landing page for email invitation links.
 * When a staff taps the link in their email, their browser opens this page.
 * It immediately attempts to deep-link into the Rota mobile app,
 * and provides clear fallback buttons and the invitation token.
 */
invitationsRouter.get('/invite/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  const tokenHash = hashToken(token);
  const now = new Date();

  let invitation = await prismaPrimary.invitation.findUnique({
    where: { tokenHash },
    include: {
      team: true,
    },
  });

  if (!invitation) {
    invitation = await prismaPrimary.invitation.findUnique({
      where: { tokenHash: token },
      include: {
        team: true,
      },
    });
  }

  const apiBaseUrl = process.env.API_BASE_URL || 'http://192.168.0.165:3000';
  const hostIp = apiBaseUrl.replace(/^https?:\/\//, '').split(':')[0] || '192.168.0.165';
  const deepLink = `rota://invite/${encodeURIComponent(token)}`;
  const expoLink = `exp://${hostIp}:8081/--/invite/${encodeURIComponent(token)}`;

  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < now) {
    const isAccepted = !!invitation?.acceptedAt;
    const isRevoked = !!invitation?.revokedAt;
    const isExpired = invitation && invitation.expiresAt < now;

    const statusTitle = isAccepted
      ? 'Invitation already accepted'
      : isRevoked
      ? 'Invitation revoked'
      : isExpired
      ? 'Invitation expired'
      : 'Invalid invitation link';

    const statusDesc = isAccepted
      ? 'This invitation has already been claimed. If you already have an account, open the Rota app to view your shifts.'
      : isRevoked
      ? 'The team owner has revoked this invitation. Please ask for a new invitation link.'
      : isExpired
      ? 'This single-use invitation expired after 7 days. Please request a new invite from your team owner.'
      : 'This link is not recognized or has been invalidated.';

    res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rota - ${statusTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; max-width: 460px; width: 100%; padding: 36px 28px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-block; width: 100%; padding: 14px 20px; background-color: #1A56DB; color: #ffffff; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${statusTitle}</h1>
    <p>${statusDesc}</p>
    <a href="rota://" class="btn">Open Rota App</a>
  </div>
</body>
</html>
    `);
    return;
  }

  const roleLabel = invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase();
  const teamName = invitation.team.name;
  const invitedEmail = invitation.email || '';

  res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${teamName} on Rota</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; max-width: 480px; width: 100%; padding: 36px 28px; text-align: center; box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.08); }
    .badge { display: inline-flex; align-items: center; padding: 6px 14px; background: #e0e7ff; color: #1d4ed8; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .subtitle { font-size: 15px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 14px; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 700; }
    .btn-primary { display: block; width: 100%; padding: 15px 20px; background-color: #1A56DB; color: #ffffff !important; border-radius: 14px; font-weight: 700; text-decoration: none; font-size: 16px; box-shadow: 0 4px 12px rgba(26, 86, 219, 0.25); margin-bottom: 12px; cursor: pointer; border: none; }
    .btn-secondary { display: block; width: 100%; padding: 13px 20px; background-color: #ffffff; color: #1A56DB; border: 1.5px solid #1A56DB; border-radius: 14px; font-weight: 700; text-decoration: none; font-size: 15px; margin-bottom: 20px; }
    .token-box { background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px; margin-top: 16px; text-align: center; }
    .token-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .token-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-all; user-select: all; }
    .copy-btn { margin-top: 8px; font-size: 12px; font-weight: 600; color: #1A56DB; background: none; border: none; cursor: pointer; text-decoration: underline; }
    .footer-note { font-size: 12px; color: #94a3b8; margin-top: 20px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Team Invitation</div>
    <h1>You’re invited to ${teamName}</h1>
    <p class="subtitle">Join as <strong>${roleLabel}</strong> to view your schedule and shifts.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Team:</span>
        <span class="info-value">${teamName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Role:</span>
        <span class="info-value">${roleLabel}</span>
      </div>
      ${invitedEmail ? `
      <div class="info-row">
        <span class="info-label">Account:</span>
        <span class="info-value">${invitedEmail}</span>
      </div>
      ` : ''}
    </div>

    <a href="${deepLink}" class="btn-primary" id="openAppBtn">Open Rota App</a>
    <a href="${expoLink}" class="btn-secondary" id="openExpoBtn">Open in Expo Go</a>

    <div class="token-box">
      <div class="token-label">Invitation Code</div>
      <div class="token-code" id="tokenCode">${token}</div>
      <button class="copy-btn" onclick="copyToken()">Copy code to clipboard</button>
    </div>

    <p class="footer-note">If the app does not open automatically, open Rota and enter the invitation code above.</p>
  </div>

  <script>
    function copyToken() {
      const text = document.getElementById('tokenCode').innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('Invitation code copied to clipboard!');
      });
    }

    // Attempt automatic app launch after small delay
    setTimeout(() => {
      window.location.href = "${deepLink}";
    }, 500);
  </script>
</body>
</html>
  `);
});

/**
 * GET /api/invitations/:token - Retrieve invitation preview info
 * Validates token, team, role, and expiry without consuming it.
 */
invitationsRouter.get('/api/invitations/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  const tokenHash = hashToken(token);
  const now = new Date();

  let invitation = await prismaPrimary.invitation.findUnique({
    where: { tokenHash },
    include: {
      team: {
        include: {
          subscription: true,
          memberships: { where: { status: 'ACTIVE' } },
        },
      },
    },
  });

  if (!invitation) {
    invitation = await prismaPrimary.invitation.findUnique({
      where: { tokenHash: token },
      include: {
        team: {
          include: {
            subscription: true,
            memberships: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
  }

  if (!invitation) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }

  if (invitation.revokedAt) {
    res.status(410).json({ error: 'This invitation has been revoked' });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(410).json({ error: 'This invitation has already been accepted' });
    return;
  }

  if (invitation.expiresAt < now) {
    res.status(410).json({ error: 'This invitation has expired' });
    return;
  }

  res.status(200).json({
    valid: true,
    invitationId: invitation.id,
    teamId: invitation.teamId,
    teamName: invitation.team.name,
    role: invitation.role,
    email: invitation.email,
    expiresAt: invitation.expiresAt.toISOString(),
  });
});

/**
 * POST /api/invitations/:token/accept - Atomically consume invitation and join team
 * Verifies single-use, binding, active capacity, and marks accepted in transaction.
 */
invitationsRouter.post('/api/invitations/:token/accept', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.params.token;
  const tokenHash = hashToken(token);
  const currentUserId = req.user!.userId;
  const currentUserEmail = req.user!.email;
  const now = new Date();

  try {
    const result = await prismaPrimary.$transaction(async (tx: Prisma.TransactionClient) => {
      let invitation = await tx.invitation.findUnique({
        where: { tokenHash },
        include: {
          team: {
            include: {
              subscription: true,
              memberships: { where: { status: 'ACTIVE' } },
            },
          },
        },
      });

      if (!invitation) {
        invitation = await tx.invitation.findUnique({
          where: { tokenHash: token },
          include: {
            team: {
              include: {
                subscription: true,
                memberships: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });
      }

      if (!invitation) {
        throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
      }

      if (invitation.revokedAt) {
        throw Object.assign(new Error('This invitation has been revoked'), { statusCode: 410 });
      }

      if (invitation.acceptedAt) {
        throw Object.assign(new Error('This invitation has already been accepted'), { statusCode: 410 });
      }

      if (invitation.expiresAt < now) {
        throw Object.assign(new Error('This invitation has expired'), { statusCode: 410 });
      }

      // Email binding verification (PRD F1.2 / design review)
      if (invitation.email && invitation.email.toLowerCase() !== currentUserEmail.toLowerCase()) {
        throw Object.assign(
          new Error(`This invitation was issued to ${invitation.email}. You are currently signed in as ${currentUserEmail}. Please sign in with the invited email address.`),
          { statusCode: 403 }
        );
      }

      // Check if user is already a member
      const existingMembership = await tx.membership.findUnique({
        where: {
          teamId_userId: {
            teamId: invitation.teamId,
            userId: currentUserId,
          },
        },
      });

      if (existingMembership && existingMembership.status === 'ACTIVE') {
        // Already active member, mark invitation accepted if not already
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now },
        });

        return {
          membership: existingMembership,
          teamName: invitation.team.name,
          role: existingMembership.role,
        };
      }

      // Capacity verification: active members cannot exceed paid entitlement
      const activeMembersCount = invitation.team.memberships.length;
      const paidCapacity = invitation.team.subscription?.paidSeatEntitlement || 5;

      if (activeMembersCount >= paidCapacity) {
        throw Object.assign(
          new Error('The team has reached its current seat limit. Please ask the team owner to upgrade the subscription.'),
          { statusCode: 409 }
        );
      }

      // Create or reactivate membership
      const membership = await tx.membership.upsert({
        where: {
          teamId_userId: {
            teamId: invitation.teamId,
            userId: currentUserId,
          },
        },
        update: {
          role: invitation.role,
          status: 'ACTIVE',
        },
        create: {
          teamId: invitation.teamId,
          userId: currentUserId,
          role: invitation.role,
          status: 'ACTIVE',
        },
      });

      // Mark single-use invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: now,
        },
      });

      // Durably record member joined activity event
      await tx.activityEvent.create({
        data: {
          teamId: invitation.teamId,
          actorId: currentUserId,
          type: 'MEMBER_JOINED',
          payload: {
            userId: currentUserId,
            email: currentUserEmail,
            role: invitation.role,
          },
        },
      });

      return {
        membership,
        teamName: invitation.team.name,
        role: invitation.role,
      };
    });

    logger.info('Invitation accepted successfully', {
      userId: currentUserId,
      teamId: result.membership.teamId,
      role: result.role,
    });

    res.status(200).json({
      message: 'Invitation accepted successfully',
      teamId: result.membership.teamId,
      teamName: result.teamName,
      role: result.role,
    });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode || 500;
    res.status(statusCode).json({ error: err instanceof Error ? err.message : 'Failed to accept invitation' });
  }
});
