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
  }
}, { timestamps: true });

export const Session = mongoose.model<ISession>('Session', SessionSchema);