import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    taskType: { 
        type: String, 
        required: true,
        enum: ['accelerometer', 'reaction_time', 'tracing'] 
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    
    
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    
    
    risk_level: { 
        type: String, 
        enum: ['low', 'moderate', 'high'], 
        default: 'low' 
    }
}, { timestamps: true });

export const Session = mongoose.model('Session', SessionSchema);