import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  submitTappingTest,
  submitTremorTest,
  getOffPeriodAnalysis,
  getOffPeriodRangeAnalysis,
  getTestHistory,
  getDailyPattern,
  getClinicianRoster,
  exportPatientData
} from '../controllers/clinicalController.js';

const router = Router();

// Secure all clinical routes using protect JWT check
router.use(protect);

// Test submission routes
router.post('/test/tapping', submitTappingTest);
router.post('/test/tremor', submitTremorTest);

// Off-period analysis routes
router.get('/analysis/off-period/:userId', getOffPeriodAnalysis);
router.get('/analysis/off-period/:userId/range', getOffPeriodRangeAnalysis);

// General history and pattern aggregation
router.get('/tests/history/:userId', getTestHistory);
router.get('/tests/daily-pattern/:userId', getDailyPattern);

// Clinician specific routes
router.get('/clinician/roster/:clinicianId', getClinicianRoster);
router.get('/clinician/export/:patientId', exportPatientData);

export default router;
