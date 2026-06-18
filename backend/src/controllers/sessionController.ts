import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { saveSession, findSessions } from '../store.js';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const DEMO_USER = 'demo-user';

const KIND: Record<string, 'tapping' | 'tremor' | undefined> = {
  reaction_time: 'tapping',
  accelerometer: 'tremor',
};

// POST /api/sessions/analyze  { taskType, payload:{samples}, medTimepoint? }
export const analyzeSession = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskType, payload, medTimepoint } = req.body;
    const userId = req.user?.userId || req.body.userId || DEMO_USER;
    const kind = KIND[taskType];
    const samples = payload?.samples || payload;

    if (!kind || !Array.isArray(samples)) {
      res.status(400).json({ success: false, message: 'taskType must be reaction_time/accelerometer with samples' });
      return;
    }

    const { data: ml } = await axios.post(`${FASTAPI_URL}/predict/${kind}`, { samples });
    const score = ml?.unhealthy_score ?? 0.5;

    const saved = await saveSession({
      userId,
      taskType,
      testType: kind,
      payload: { samples },
      medTimepoint: medTimepoint || 'Another time',
      score,
      severityScore: score,
      baseConfidence: score,
      interpretation: ml?.prediction === 'unhealthy' ? 'Symptoms detected' : 'No symptoms detected',
      risk_level: score > 0.66 ? 'high' : score > 0.4 ? 'moderate' : 'low',
      analysis: ml,
      timestamp: new Date(),
    });
    res.status(201).json({ success: true, data: saved });
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.response) {
      res.status(502).json({ success: false, message: 'ML service unavailable. Is FastAPI running on :8000?' });
      return;
    }
    next(error);
  }
};

// GET /api/sessions/history/:userId
export const getUserHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const history = await findSessions({ userId: req.params.userId });
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// GET /api/sessions/trends/:userId  (visual-trend support; no formula)
export const getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = (await findSessions({ userId: req.params.userId })).slice(0, 10);
    if (rows.length === 0) {
      res.json({ success: true, trend: 'No data', recentHighs: 0, totalAnalyzed: 0 });
      return;
    }
    const highCount = rows.filter((s: any) => String(s.risk_level).toLowerCase() === 'high').length;
    res.json({
      success: true,
      trend: highCount > 3 ? 'Declining' : 'Stable',
      recentHighs: highCount,
      totalAnalyzed: rows.length,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/sessions/stats/:userId  (counts by risk level)
export const getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rows = await findSessions({ userId: req.params.userId });
    const counts: Record<string, number> = {};
    rows.forEach((s: any) => { counts[s.risk_level] = (counts[s.risk_level] || 0) + 1; });
    const stats = Object.entries(counts).map(([_id, count]) => ({ _id, count }));
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
};
