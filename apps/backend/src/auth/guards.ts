import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from './tokens';
import { prismaPrimary } from '../data/db';
import { Role } from '@rota/shared';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
  membership?: {
    id: string;
    teamId: string;
    userId: string;
    role: Role;
    status: string;
  };
  requestId?: string;
}

/**
 * Authentication middleware: validates access token and active session.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyAccessToken(token);

    // Verify session is still valid (not revoked) on primary
    const session = await prismaPrimary.session.findUnique({
      where: { id: payload.sessionId },
      select: { revokedAt: true },
    });

    if (!session || session.revokedAt !== null) {
      res.status(401).json({ error: 'Unauthorized: Session has been revoked or expired' });
      return;
    }

    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired access token' });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Team authorization guard: resolves active membership on PostgreSQL primary.
 * Enforces role checks and cross-team tenant isolation.
 */
export function requireTeamMembership(allowedRoles?: Role[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Must authenticate first' });
      return;
    }

    const teamId = (req.params.teamId || req.headers['x-team-id'] || req.body.teamId) as string;
    if (!teamId) {
      res.status(400).json({ error: 'Bad Request: Missing team identifier' });
      return;
    }

    if (!UUID_REGEX.test(teamId)) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Resolve membership on PostgreSQL primary to avoid replication lag on access decisions
    const membership = await prismaPrimary.membership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: req.user.userId,
        },
      },
      include: {
        team: {
          include: {
            subscription: true,
          },
        },
      },
    });

    // Cross-team isolation: return 404 so attackers cannot probe resource existence
    if (!membership || membership.status !== 'ACTIVE') {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Role check
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(membership.role as Role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient role permissions for this operation' });
      return;
    }

    const subStatus = membership.team.subscription?.status;
    const url = req.originalUrl || req.url || '';
    const isBillingOrPayment = url.includes('/billing') || url.includes('/payment');

    // PRD F6.6: RESTRICTED state allows shift reading and Owner billing access, but blocks mutations, invitations, and swaps
    if (subStatus === 'RESTRICTED' && req.method !== 'GET' && !isBillingOrPayment) {
      res.status(403).json({
        error: 'Subscription restricted: Team subscription is restricted due to overdue renewal payment. Read-only access permitted.',
      });
      return;
    }

    req.membership = {
      id: membership.id,
      teamId: membership.teamId,
      userId: membership.userId,
      role: membership.role as Role,
      status: membership.status,
    };

    next();
  };
}
