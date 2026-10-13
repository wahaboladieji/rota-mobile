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

    // Resolve membership on PostgreSQL primary to avoid replication lag on access decisions
    const membership = await prismaPrimary.membership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: req.user.userId,
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
