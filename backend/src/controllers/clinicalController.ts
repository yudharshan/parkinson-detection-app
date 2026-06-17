import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { calculateSeverity } from '../services/severity.service.js';
import { analyzeOffPeriodForDay } from '../services/offPeriod.service.js';
import { classifyGrowthTrend } from '../services/triage.service.js';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

// Helper to make ML service calls
const callMLService = async (type: 'reaction_time' | 'accelerometer', samples: any[]) => {
  try {
    const response = await axios.post(`${FASTAPI_URL}/predict`, {
      type,
      data: { samples }
    });
    return response.data;
  } catch (error: any) {
    console.error(`ML Service connection failed for ${type}:`, error.message);
    return null;
  }
};

/**
 * 1. POST /api/test/tapping
 */
export const submitTappingTest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rawTaps, medTimepoint } = req.body;
    const userId = req.user?.userId || req.body.userId;

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }
    if (!medTimepoint) {
      res.status(400).json({ success: false, message: "medTimepoint is required" });
      return;
    }
    if (!rawTaps || !Array.isArray(rawTaps)) {
      res.status(400).json({ success: false, message: "rawTaps array is required" });
      return;
    }

    // Call ML service (reaction_time type maps to tapping in main.py)
    const mlResult = await callMLService('reaction_time', rawTaps);
    const baseConfidence = mlResult?.score ?? 0.5;
    const rawFeatures = mlResult?.features ?? [];

    const { severityScore, appliedOffset, interpretation } = calculateSeverity(baseConfidence, medTimepoint);

    const testRecord = new Session({
      userId,
      taskType: 'reaction_time',
      startedAt: new Date(Date.now() - 20000), // Approx 20s test
      endedAt: new Date(),
      payload: { samples: rawTaps },
      risk_level: severityScore > 0.75 ? 'high' : severityScore > 0.45 ? 'moderate' : 'low',
      score: severityScore,
      analysis: mlResult?.analysis || { message: "Calculated via fallback logic" },
      medicationStatus: medTimepoint === "Immediately before Parkinson medication" ? "OFF" : "ON",
      
      // Clinical schema
      testType: 'tapping',
      rawFeatures,
      baseConfidence,
      appliedOffset,
      severityScore,
      interpretation,
      medTimepoint,
      timestamp: new Date()
    });

    await testRecord.save();
    res.status(201).json({ success: true, data: testRecord });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. POST /api/test/tremor
 */
export const submitTremorTest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rawSamples, medTimepoint } = req.body;
    const userId = req.user?.userId || req.body.userId;

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }
    if (!medTimepoint) {
      res.status(400).json({ success: false, message: "medTimepoint is required" });
      return;
    }
    if (!rawSamples || !Array.isArray(rawSamples)) {
      res.status(400).json({ success: false, message: "rawSamples array is required" });
      return;
    }

    // Call ML service
    const mlResult = await callMLService('accelerometer', rawSamples);
    const baseConfidence = mlResult?.score ?? 0.5;
    const rawFeatures = mlResult?.features ?? [];

    const { severityScore, appliedOffset, interpretation } = calculateSeverity(baseConfidence, medTimepoint);

    const testRecord = new Session({
      userId,
      taskType: 'accelerometer',
      startedAt: new Date(Date.now() - 20000), // 20s test
      endedAt: new Date(),
      payload: { samples: rawSamples },
      risk_level: severityScore > 0.75 ? 'high' : severityScore > 0.45 ? 'moderate' : 'low',
      score: severityScore,
      analysis: mlResult?.analysis || { message: "Calculated via fallback logic" },
      medicationStatus: medTimepoint === "Immediately before Parkinson medication" ? "OFF" : "ON",
      
      // Clinical schema
      testType: 'tremor',
      rawFeatures,
      baseConfidence,
      appliedOffset,
      severityScore,
      interpretation,
      medTimepoint,
      timestamp: new Date()
    });

    await testRecord.save();
    res.status(201).json({ success: true, data: testRecord });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to parse a date into UTC bounds for that day
 */
const getDateRangeForDay = (dateStr: string) => {
  const targetDate = new Date(dateStr);
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * 3. GET /api/analysis/off-period/:userId
 */
export const getOffPeriodAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const { start, end } = getDateRangeForDay(dateStr);

    const dailySessions = await Session.find({
      userId,
      timestamp: { $gte: start, $lte: end }
    });

    const mappedSessions = dailySessions.map((s: any) => ({
      severityScore: s.severityScore || s.score || 0,
      medTimepoint: s.medTimepoint || 'unknown',
      timestamp: s.timestamp || s.createdAt || new Date()
    }));

    const analysisResult = analyzeOffPeriodForDay(mappedSessions, dateStr);
    res.json({ success: true, data: analysisResult });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. GET /api/analysis/off-period/:userId/range
 */
export const getOffPeriodRangeAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    if (!startStr || !endStr) {
      res.status(400).json({ success: false, message: "start and end dates are required (YYYY-MM-DD)" });
      return;
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    // Find all sessions in the range
    const sessions = await Session.find({
      userId,
      timestamp: { $gte: startDate, $lte: new Date(endDate.getTime() + 24*60*60*1000) }
    });

    // Generate day-by-day analysis
    const results = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const currentStr = current.toISOString().split('T')[0];
      const { start, end } = getDateRangeForDay(currentStr);

      const daySessions = sessions.filter(s => {
        const time = new Date((s.timestamp || (s as any).createdAt) as any).getTime();
        return time >= start.getTime() && time <= end.getTime();
      });

      const mappedDaySessions = daySessions.map((s: any) => ({
        severityScore: s.severityScore || s.score || 0,
        medTimepoint: s.medTimepoint || 'unknown',
        timestamp: s.timestamp || s.createdAt || new Date()
      }));

      const dayAnalysis = analyzeOffPeriodForDay(mappedDaySessions, currentStr);
      results.push(dayAnalysis);

      current.setDate(current.getDate() + 1);
    }

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. GET /api/tests/history/:userId?type=&range=
 */
export const getTestHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { type, range } = req.query;

    const query: any = { userId };
    
    if (type) {
      query.testType = type;
    }

    if (range) {
      const now = new Date();
      if (range === '7d') {
        query.timestamp = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (range === '30d') {
        query.timestamp = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    const history = await Session.find(query).sort({ timestamp: -1 });
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. GET /api/tests/daily-pattern/:userId
 */
export const getDailyPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    const sessions = await Session.find({ userId });

    const buckets = {
      morning: { sum: 0, count: 0 },   // 06:00 - 12:00
      afternoon: { sum: 0, count: 0 }, // 12:00 - 18:00
      evening: { sum: 0, count: 0 },   // 18:00 - 24:00
      night: { sum: 0, count: 0 }      // 00:00 - 06:00
    };

    sessions.forEach(s => {
      const date = new Date(s.timestamp || (s as any).createdAt);
      const hour = date.getHours();
      const score = s.severityScore || s.score || 0;

      if (hour >= 6 && hour < 12) {
        buckets.morning.sum += score;
        buckets.morning.count++;
      } else if (hour >= 12 && hour < 18) {
        buckets.afternoon.sum += score;
        buckets.afternoon.count++;
      } else if (hour >= 18 && hour < 24) {
        buckets.evening.sum += score;
        buckets.evening.count++;
      } else {
        buckets.night.sum += score;
        buckets.night.count++;
      }
    });

    const formatBucket = (b: { sum: number, count: number }) => ({
      avgSeverity: b.count > 0 ? parseFloat((b.sum / b.count).toFixed(4)) : 0,
      count: b.count
    });

    res.json({
      success: true,
      data: {
        morning: formatBucket(buckets.morning),
        afternoon: formatBucket(buckets.afternoon),
        evening: formatBucket(buckets.evening),
        night: formatBucket(buckets.night)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. GET /api/clinician/roster/:clinicianId
 */
export const getClinicianRoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clinicianId } = req.params;

    // Find patients linked to this clinician
    const patients = await User.find({ clinicianId, role: 'patient' });

    const roster = await Promise.all(patients.map(async (p) => {
      // Find up to 10 latest tests for the patient
      const latestTests = await Session.find({ userId: p._id })
        .sort({ timestamp: -1 })
        .limit(10);

      const mappedTests = latestTests.map(t => ({
        severityScore: t.severityScore || t.score || 0,
        date: t.timestamp || (t as any).createdAt
      }));

      // Classify growth trend using triage service
      const trend = classifyGrowthTrend(mappedTests);
      const lastTest = latestTests[0];
      const lastTestDate = lastTest ? (lastTest.timestamp || (lastTest as any).createdAt) : null;

      return {
        patientId: p._id,
        name: p.name,
        status: trend.status,
        reason: trend.reason,
        lastTestDate
      };
    }));

    // Sort roster: red (Worsening) -> yellow (Needs Monitoring) -> green (Stable) -> gray (Insufficient Data)
    const order = { "Worsening": 1, "Needs Monitoring": 2, "Stable": 3, "Insufficient Data": 4 };
    
    roster.sort((a, b) => {
      return (order[a.status] || 99) - (order[b.status] || 99);
    });

    res.json({ success: true, data: roster });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. GET /api/clinician/export/:patientId
 */
export const exportPatientData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.params;

    const patient = await User.findById(patientId);
    if (!patient) {
      res.status(404).json({ success: false, message: "Patient not found" });
      return;
    }

    const sessions = await Session.find({ userId: patientId }).sort({ timestamp: -1 });

    // Generate CSV contents
    const headers = ["Timestamp", "Test Type", "Medication Timepoint", "Base Confidence", "Applied Offset", "Severity Score", "Interpretation", "Features"];
    const rows = sessions.map(s => {
      const timestamp = new Date(s.timestamp || (s as any).createdAt).toISOString();
      const testType = s.testType || s.taskType || "unknown";
      const medTimepoint = s.medTimepoint || s.medicationStatus || "UNKNOWN";
      const baseConfidence = s.baseConfidence ?? "";
      const appliedOffset = s.appliedOffset ?? "";
      const severityScore = s.severityScore ?? s.score ?? "";
      const interpretation = s.interpretation ?? s.risk_level ?? "";
      const featuresStr = s.rawFeatures ? JSON.stringify(s.rawFeatures).replace(/"/g, '""') : "";
      
      return [
        timestamp,
        testType,
        medTimepoint,
        baseConfidence,
        appliedOffset,
        severityScore,
        interpretation,
        `"${featuresStr}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=patient_${patient.name.replace(/\s+/g, '_')}_data.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
