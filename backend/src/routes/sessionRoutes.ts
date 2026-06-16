
import { Router } from 'express';
import { 
    analyzeSession, 
    getUserHistory, 
    getUserStats, 
    getTrends  
} from '../controllers/sessionController.js';
import { validateSession } from '../middleware/validationMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();


//router.use(protect);


router.post('/analyze', /*validateSession,*/ analyzeSession);
router.get('/history/:userId', getUserHistory);
router.get('/stats/:userId', getUserStats);
router.get('/trends/:userId', getTrends); 

export default router;