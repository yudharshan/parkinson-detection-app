import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { Session } from '../models/Session.js';

const callMLModel = async (taskType: string, payload: any) => {
    try {
        const response = await axios.post('http://127.0.0.1:8000/predict', {
            type: taskType,
            data: payload
        });
        return response.data;
    } catch (error) {
        console.error("⚠️ ML Service Down, using basic logic fallback");
        return null; 
    }
};

export const analyzeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 🛠️ FIX: Added lastMedicationTime and medicationStatus to the extraction
        const { 
            userId, 
            taskType, 
            payload, 
            startedAt, 
            endedAt, 
            lastMedicationTime, 
            medicationStatus 
        } = req.body;

        const mlResult = await callMLModel(taskType, payload);

        const risk_level = mlResult?.risk_level || 'moderate';
        const score = mlResult?.score || 0.5;
        const analysis = mlResult?.analysis || { message: "Calculated via fallback logic" };

        const newSession = new Session({
            userId,
            taskType,
            risk_level,
            score,
            payload,
            analysis,
            startedAt,
            endedAt,
            
            lastMedicationTime,
            medicationStatus
        });

        await newSession.save();
        res.status(201).json({ success: true, data: newSession });
    } catch (error) {
        next(error);
    }
};

export const getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const lastTen = await Session.find({ userId }).sort({ createdAt: -1 }).limit(10);
        
        if (lastTen.length === 0) {
            res.json({ success: true, trend: "No data", recentHighs: 0, totalAnalyzed: 0 });
            return;
        }

        const highCount = lastTen.filter(s => s.risk_level === 'high').length;
        const status = highCount > 5 ? "Declining" : "Stable";

        res.json({
            success: true,
            trend: status,
            recentHighs: highCount,
            totalAnalyzed: lastTen.length
        });
    } catch (error) {
        next(error);
    }
};

export const getUserHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const history = await Session.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        
        const idString = Array.isArray(userId) ? userId[0] : userId;

        const stats = await Session.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(idString as string) } },
            { $group: { _id: "$risk_level", count: { $sum: 1 } } }
        ]);
        
        res.json({ success: true, stats });
    } catch (error) {
        next(error);
    }
};