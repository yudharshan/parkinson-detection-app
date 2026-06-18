import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import clinicalRoutes from './routes/clinicalRoutes.js';
import { setMemoryMode, isMemoryMode } from './store.js';

dotenv.config();
const app = express();


// --- SWAGGER CONFIGURATION ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NeuroTrack API',
      version: '1.0.0',
      description: 'Parkinson\'s Detection System - AI Microservice Integration',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
   
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token to access protected routes',
        },
      },
    },
    
    security: [
      {
        bearerAuth: [],
      },
    ],
    paths: {
      '/api/sessions/analyze': {
        post: {
          summary: 'Analyze Parkinson\'s task data',
          description: 'Sends sensor data to the ML microservice and returns risk scores.',
          tags: ['Sessions'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    taskType: { 
                      type: 'string', 
                      enum: ['reaction_time', 'accelerometer', 'tracing'] 
                    },
                    payload: { type: 'object' },
                    startedAt: { type: 'string' },
                    endedAt: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Analysis successful and saved to MongoDB.' },
            '401': { description: 'Unauthorized - Token missing or invalid.' },
            '500': { description: 'Server error or ML service communication failure.' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './routes/*.js'], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
// --- END SWAGGER CONFIGURATION ---

app.use(express.json({ limit: '10mb' }));
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || "";
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => { setMemoryMode(false); console.log("🍃 MongoDB Connected (persistent store)"); })
        .catch(err => console.warn("⚠️ MongoDB connection failed; using in-memory store.", err.message));
} else {
    console.log("🗃️  No MONGO_URI set — using in-memory store (zero-setup demo mode).");
}

// Swagger Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.get('/api/health', (_req, res) => res.json({ ok: true, store: isMemoryMode() ? 'in-memory' : 'mongodb' }));
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes); 
app.use('/api', clinicalRoutes); 

const PORT: number = Number(process.env.PORT) || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Clean Server on port ${PORT}`);
    console.log(`📑 API Documentation available at http://localhost:${PORT}/api-docs`);
});