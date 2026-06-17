import mongoose, { Schema, Document } from 'mongoose';


export interface IUser extends Document {
  name: string;
  email: string;
  password: string; // This will be hashed via bcrypt
  age?: number;     
  diagnosisYear?: number;
  medications?: {
    name: string;
    dosage: string;
    time: string;
  }[];
  role: 'patient' | 'clinician';
  clinicianId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}


const UserSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    select: false // 🛡️ Security Flex: Password won't show up in 'find' queries by default
  },
  age: { type: Number },
  diagnosisYear: { type: Number },
  medications: [{
    name: String,
    dosage: String,
    time: String
  }],
  role: {
    type: String,
    enum: ['patient', 'clinician'],
    default: 'patient'
  },
  clinicianId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true // Automatically creates 'createdAt' and 'updatedAt'
});

export const User = mongoose.model<IUser>('User', UserSchema);