import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'neurotrack-demo-secret';

export interface AuthRequest extends Request {
    user?: any;
}

/**
 * Lenient auth: if a valid token is present, attach req.user. If no/invalid token,
 * continue anyway (req.user stays undefined) so controllers can fall back to a demo
 * user. This keeps the demo usable without forcing login on every endpoint, while
 * still honoring real tokens when present.
 */
export const protect = (req: AuthRequest, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if ((req as any).cookies && (req as any).cookies.jwt) {
        token = (req as any).cookies.jwt;
    } else if (req.query && req.query.token) {
        token = req.query.token as string;
    }

    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            // ignore invalid token in demo mode
        }
    }
    return next();
};
