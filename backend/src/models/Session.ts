import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  taskType: 'accelerometer' | 'reaction_time' | 'tracing';
  startedAt: Date;
  endedAt: Date;
  payload: any;
  risk_level: 'low' | 'moderate' | 'high';
  score: number;
  analysis: any;
  userId: Types.ObjectId;
  
  lastMedicationTime?: Date;
  medicationStatus: 'ON' | 'OFF' | 'UNKNOWN';

  // 🏥 New Clinical and Audit Trail Fields
  testType: string;
  rawFeatures?: any;
  baseConfidence?: number;
  appliedOffset?: number;
  severityScore?: number;
  interpretation?: string;
  medTimepoint?: string;
  timestamp?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

const SessionSchema: Schema = new Schema({
  taskType: { 
    type: String, 
    required: true,
    enum: ['accelerometer', 'reaction_time', 'tracing'] 
  },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  
  // 🏥 New Clinical Context Fields
  lastMedicationTime: { 
    type: Date, 
    required: false 
  },
  medicationStatus: { 
    type: String, 
    enum: ['ON', 'OFF', 'UNKNOWN'], 
    default: 'UNKNOWN' 
  },

  risk_level: { 
    type: String, 
    enum: ['low', 'moderate', 'high'], 
    default: 'low' 
  },
  score: { type: Number, default: 0 },
  analysis: { type: Schema.Types.Mixed },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  // 🧪 Extended fields
  testType: {
    type: String,
    required: true,
    enum: ['tapping', 'tremor', 'tracing']
  },
  rawFeatures: {
    type: Schema.Types.Mixed
  },
  baseConfidence: {
    type: Number
  },
  appliedOffset: {
    type: Number
  },
  severityScore: {
    type: Number
  },
  interpretation: {
    type: String
  },
  medTimepoint: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export const Session = mongoose.model<ISession>('Session', SessionSchema);