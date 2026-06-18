import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { saveSession, findSessions, findUserByPatientCode, findUsers, updateUser } from '../store.js';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const DEMO_USER = 'demo-user';

/**
 * Call the FastAPI ML service. Live scoring uses ONLY the model's confidence —
 * the old medTimepoint severity-offset / off-period logic has been dropped
 * (no clinical ground truth to justify it). medTimepoint is stored for context,
 * not used to alter the score.
 */
const callML = async (kind: 'tapping' | 'tremor', samples: any[]) => {
  const { data } = await axios.post(`${FASTAPI_URL}/predict/${kind}`, { samples });
  return data; // { label, prediction, unhealthy_score, confidence, ... }
};

const buildRecord = (
  kind: 'tapping' | 'tremor', userId: string, samples: any[], medTimepoint: string, ml: any,
) => {
  const score = ml?.unhealthy_score ?? 0.5;
  const prediction = ml?.prediction ?? 'unknown';
  return {
    userId,
    taskType: kind === 'tapping' ? 'reaction_time' : 'accelerometer',
    testType: kind,
    payload: { samples },
    medTimepoint,
    medicationStatus: medTimepoint === 'Immediately before Parkinson medication' ? 'OFF' : 'ON',
    // Score IS the model confidence now (no offset). Field names kept for the UI.
    score,
    severityScore: score,
    baseConfidence: score,
    appliedOffset: 0,
    confidence: ml?.confidence ?? null,
    prediction,
    interpretation: prediction === 'unhealthy' ? 'Symptoms detected' : 'No symptoms detected',
    risk_level: score > 0.66 ? 'high' : score > 0.4 ? 'moderate' : 'low',
    analysis: ml,
    rawFeatures: ml?.features ?? [],
    startedAt: new Date(Date.now() - 20000),
    endedAt: new Date(),
    timestamp: new Date(),
  };
};

// POST /api/test/tapping  { rawTaps, medTimepoint, userId? }
export const submitTappingTest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rawTaps, medTimepoint } = req.body;
    const userId = req.user?.userId || req.body.userId || DEMO_USER;
    if (!rawTaps || !Array.isArray(rawTaps)) {
      res.status(400).json({ success: false, message: 'rawTaps array is required' });
      return;
    }
    const ml = await callML('tapping', rawTaps);
    const saved = await saveSession(buildRecord('tapping', userId, rawTaps, medTimepoint || 'Another time', ml));
    res.status(201).json({ success: true, data: saved });
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.response) {
      res.status(502).json({ success: false, message: 'ML service unavailable. Is FastAPI running on :8000?' });
      return;
    }
    next(error);
  }
};

// POST /api/test/tremor  { rawSamples, medTimepoint, userId? }
export const submitTremorTest = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rawSamples, medTimepoint } = req.body;
    const userId = req.user?.userId || req.body.userId || DEMO_USER;
    if (!rawSamples || !Array.isArray(rawSamples)) {
      res.status(400).json({ success: false, message: 'rawSamples array is required' });
      return;
    }
    const ml = await callML('tremor', rawSamples);
    const saved = await saveSession(buildRecord('tremor', userId, rawSamples, medTimepoint || 'Another time', ml));
    res.status(201).json({ success: true, data: saved });
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.response) {
      res.status(502).json({ success: false, message: 'ML service unavailable. Is FastAPI running on :8000?' });
      return;
    }
    next(error);
  }
};

// GET /api/tests/history/:userId?type=
export const getTestHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const type = req.query.type as string | undefined;
    const history = await findSessions({ userId, testType: type });
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// GET /api/tests/daily-pattern/:userId  (simple time-of-day average; no off-period math)
export const getDailyPattern = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const sessions = await findSessions({ userId });
    const buckets: any = {
      morning: { sum: 0, count: 0 }, afternoon: { sum: 0, count: 0 },
      evening: { sum: 0, count: 0 }, night: { sum: 0, count: 0 },
    };
    sessions.forEach((s: any) => {
      const hour = new Date(s.timestamp || s.createdAt).getHours();
      const score = s.severityScore ?? s.score ?? 0;
      const b = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon'
        : hour >= 18 ? 'evening' : 'night';
      buckets[b].sum += score; buckets[b].count += 1;
    });
    const fmt = (b: any) => ({ avgScore: b.count ? +(b.sum / b.count).toFixed(4) : 0, count: b.count });
    res.json({ success: true, data: {
      morning: fmt(buckets.morning), afternoon: fmt(buckets.afternoon),
      evening: fmt(buckets.evening), night: fmt(buckets.night),
    }});
  } catch (error) {
    next(error);
  }
};

// POST /api/clinician/link  { patientCode }  (doctor links a patient by their shared ID)
export const linkPatient = async (req: any, res: Response, next: NextFunction): Promise<void> => {
  try {
    const clinicianId = req.user?.userId;
    if (!clinicianId) {
      res.status(401).json({ success: false, message: 'Sign in as a doctor first' });
      return;
    }
    const code = String(req.body.patientCode || '').trim().toUpperCase();
    const patient: any = await findUserByPatientCode(code);
    if (!patient) {
      res.status(404).json({ success: false, message: 'No patient found with that ID' });
      return;
    }
    await updateUser(patient._id, { clinicianId });
    res.json({ success: true, data: { patientId: patient._id, name: patient.name } });
  } catch (error) {
    next(error);
  }
};

// GET /api/clinician/roster/:clinicianId  (patients linked to this doctor + simple trend)
export const getClinicianRoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clinicianId } = req.params;
    const patients: any[] = await findUsers({ role: 'patient', clinicianId });
    const avg = (arr: any[]) => arr.reduce((s, t) => s + (t.severityScore ?? t.score ?? 0), 0) / (arr.length || 1);

    const roster = await Promise.all(patients.map(async (p: any) => {
      const tests = await findSessions({ userId: p._id });
      let status = 'Insufficient Data';
      let reason = 'Fewer than 2 tests';
      if (tests.length >= 2) {
        const mid = Math.ceil(tests.length / 2);
        const diff = avg(tests.slice(0, mid)) - avg(tests.slice(mid));
        if (diff >= 0.1) { status = 'Worsening'; reason = 'Recent scores trending up'; }
        else if (diff <= -0.1) { status = 'Stable'; reason = 'Improving'; }
        else { status = 'Stable'; reason = 'Scores steady'; }
      }
      const latest = tests[0];
      return {
        patientId: p._id, name: p.name, patientCode: p.patientCode,
        status, reason,
        lastTestDate: latest?.timestamp || latest?.createdAt || null,
      };
    }));
    res.json({ success: true, data: roster });
  } catch (error) {
    next(error);
  }
};

// GET /api/clinician/export/:patientId  -> CSV download of all the patient's sessions
export const exportPatientData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.params;
    const sessions = await findSessions({ userId: patientId });

    const headers = ['Timestamp', 'Test Type', 'Medication', 'Symptom Score', 'Result', 'Features'];
    const rows = sessions.map((s: any) => {
      const ts = new Date(s.timestamp || s.createdAt).toISOString();
      const testType = s.testType || s.taskType || 'unknown';
      const med = (s.medTimepoint || '').replace(/,/g, ';');
      const score = s.severityScore ?? s.score ?? '';
      const result = s.interpretation || s.prediction || '';
      const feats = s.rawFeatures ? JSON.stringify(s.rawFeatures).replace(/"/g, '""') : '';
      return [ts, testType, med, score, result, `"${feats}"`].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=patient_${patientId}_data.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
