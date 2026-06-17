import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
    let token;

    // 1. Check for Bearer Token in Headers (Swagger & Postman)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } 
    // 2. Fallback to HTTP-Only Cookie (React Native / Web Frontend)
    // Assuming your login route sets a cookie named 'jwt'
    else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    // 3. Fallback to query param token for CSV downloads
    else if (req.query && req.query.token) {
        token = req.query.token as string;
    }

    // 3. If a token was found in EITHER place, verify it
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
            req.user = decoded; // attach decoded payload to req.user
            return next(); // move to next controller
        } catch (error) {
            return res.status(401).json({ error: "Not authorized, token failed" });
        }
    }

    // 4. If no token was found anywhere
    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token" });
    }
};