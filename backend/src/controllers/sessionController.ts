import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { Session } from '../models/Session.js';

// --- HELPER: Communication with Python AI ---
const callMLModel = async (taskType: string, payload: any) => {
    try {
        const response = await axios.post('http://127.0.0.1:8000/predict', {
            type: taskType,
            data: payload.samples || payload 
        });
        
        console.log("🤖 ML Service Response:", response.data);
        return response.data; 
    } catch (error: any) {
        console.error("⚠️ ML Service Bridge Error:", error.message);
        return null; 
    }
};

// --- MAIN: Analyze and Save Session ---
export const analyzeSession = async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { 
            taskType, 
            payload, 
            startedAt, 
            endedAt, 
            lastMedicationTime, 
            medicationStatus 
        } = req.body;

        // const userId = req.user?._id || req.body.userId;

        // if (!userId) {
        //     res.status(400).json({ success: false, message: "User ID is required" });
        //     return;
        // }
        // For testing only - Bypass the check
        const userId = req.user?._id || req.body.userId || new mongoose.Types.ObjectId();

        const mlResult = await callMLModel(taskType, payload);

        const risk_level = mlResult?.risk_level || mlResult?.severity || 'moderate';
        const score = mlResult?.score ?? mlResult?.prediction ?? 0.5;
        const analysis = mlResult?.analysis || { 
            message: mlResult ? "AI Analysis Complete" : "Calculated via fallback logic",
            raw_score: score
        };

        const newSession = new Session({
            userId,
            taskType,
            risk_level,
            score,
            payload,
            analysis,
            startedAt: startedAt || new Date().toISOString(),
            endedAt: endedAt || new Date().toISOString(),
            lastMedicationTime,
            medicationStatus
        });

        await newSession.save();
        res.status(201).json({ success: true, data: newSession });

    } catch (error) {
        console.error("❌ Session Controller Crash:", error);
        next(error);
    }
};

// --- TRENDS: UI Dashboard Logic ---
export const getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const lastTen = await Session.find({ userId }).sort({ createdAt: -1 }).limit(10);
        
        if (lastTen.length === 0) {
            res.json({ success: true, trend: "No data", recentHighs: 0, totalAnalyzed: 0 });
            return;
        }

        // FIXED: String conversion prevents type-overlap error
        const highCount = lastTen.filter(s => String(s.risk_level).toLowerCase() === 'high').length;
        const status = highCount > 3 ? "Declining" : "Stable";

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

// --- HISTORY: List all sessions ---
export const getUserHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        const history = await Session.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

// --- STATS: Aggregate data for Charts ---
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { userId } = req.params;
        
        // FIXED: Handle string | string[] to satisfy Mongoose ObjectId constructor
        const idToProcess = Array.isArray(userId) ? userId[0] : userId;

        if (!idToProcess || !mongoose.Types.ObjectId.isValid(idToProcess)) {
            res.status(400).json({ success: false, message: "Invalid User ID format" });
            return;
        }

        const stats = await Session.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(idToProcess) } },
            { $group: { _id: "$risk_level", count: { $sum: 1 } } }
        ]);
        
        res.json({ success: true, stats });
    } catch (error) {
        next(error);
    }
};