import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    console.error(`❌ [Error]: ${err.message}`);

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        // Only show stack trace if not in production
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};