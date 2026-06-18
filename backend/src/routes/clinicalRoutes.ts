import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  submitTappingTest,
  submitTremorTest,
  getTestHistory,
  getDailyPattern,
  linkPatient,
  getClinicianRoster,
  exportPatientData,
} from '../controllers/clinicalController.js';

const router = Router();

// Lenient auth (attaches req.user if a token is present; never blocks the demo).
router.use(protect);

// Test submission
router.post('/test/tapping', submitTappingTest);
router.post('/test/tremor', submitTremorTest);

// History + simple time-of-day pattern (off-period / triage dropped)
router.get('/tests/history/:userId', getTestHistory);
router.get('/tests/daily-pattern/:userId', getDailyPattern);

// Doctor <-> patient
router.post('/clinician/link', linkPatient);
router.get('/clinician/roster/:clinicianId', getClinicianRoster);
router.get('/clinician/export/:patientId', exportPatientData);

export default router;
