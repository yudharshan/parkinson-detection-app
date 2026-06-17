import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://Nuerostar:Neurostar@cluster0.js3aaf6.mongodb.net/NeuroTrack?retryWrites=true&w=majority";

async function runSeed() {
  try {
    console.log("🍃 Connecting to MongoDB Atlas...");
    try {
      await mongoose.connect(MONGO_URI);
    } catch (dbErr) {
      console.log("⚠️ Atlas Connection failed, trying local MongoDB fallback...");
      await mongoose.connect("mongodb://127.0.0.1:27017/NeuroTrack");
    }
    console.log("🍃 MongoDB Connected successfully.");

    // Clean up existing seeded users
    await User.deleteMany({ email: { $in: ['clinician@test.com', 'patient@test.com'] } });
    console.log("🧹 Cleaned old test users.");

    // Hash password
    const hashedPassword = await bcrypt.hash('Password123', 10);

    // Create clinician
    const clinician = new User({
      name: "Elizabeth Smith",
      email: "clinician@test.com",
      password: hashedPassword,
      role: "clinician"
    });
    await clinician.save();
    console.log(`👨‍⚕️ Clinician account provisioned: clinician@test.com / Password123`);

    // Create patient linked to clinician
    const patient = new User({
      name: "Arthur Pendelton",
      email: "patient@test.com",
      password: hashedPassword,
      role: "patient",
      age: 68,
      diagnosisYear: 2018,
      clinicianId: clinician._id
    });
    await patient.save();
    console.log(`👤 Patient account provisioned: patient@test.com / Password123`);

    // Delete existing sessions for this patient to ensure clean stats
    await Session.deleteMany({ userId: patient._id });

    // Seed 14 sessions across the last 7 days (paired before/after tests)
    console.log("🧪 Seeding test history sessions (last 7 days)...");
    
    const baseDates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      baseDates.push(date);
    }

    const testTypes = ['tapping', 'tremor'];

    for (const testType of testTypes) {
      let dailySeverityBase = 0.35; // Starting severity level

      for (let i = 0; i < baseDates.length; i++) {
        const date = baseDates[i];
        
        // Severity slowly shifts up to create a realistic trend
        dailySeverityBase += 0.03 * (i % 2 === 0 ? 1 : -0.5);

        // 1. Before Medication Session (OFF State)
        // High severity
        const beforeScore = parseFloat((dailySeverityBase + 0.15).toFixed(3));
        const beforeDate = new Date(date);
        beforeDate.setHours(9, 30, 0, 0); // Morning test

        const beforeSession = new Session({
          userId: patient._id,
          taskType: testType === 'tapping' ? 'reaction_time' : 'accelerometer',
          startedAt: new Date(beforeDate.getTime() - 20000),
          endedAt: beforeDate,
          payload: { samples: [] },
          risk_level: beforeScore > 0.75 ? 'high' : beforeScore > 0.45 ? 'moderate' : 'low',
          score: beforeScore,
          analysis: { message: "Seeded OFF state test" },
          medicationStatus: "OFF",
          
          testType,
          rawFeatures: testType === 'tapping' ? [45, 2.25, 0.05, 0.44, 0.05, 0.82, 0.45, 0.95, -0.01] : [12.5, 3.2, 5.8, 0.75],
          baseConfidence: parseFloat((beforeScore - 0.20).toFixed(3)), // Subtract offset
          appliedOffset: 0.20,
          severityScore: beforeScore,
          interpretation: beforeScore > 0.75 ? "High symptoms (OFF)" : "Moderate symptoms",
          medTimepoint: "Immediately before Parkinson medication",
          timestamp: beforeDate
        });
        await beforeSession.save();

        // 2. After Medication Session (ON State)
        // Low severity
        const afterScore = parseFloat((dailySeverityBase - 0.10).toFixed(3));
        const afterDate = new Date(date);
        afterDate.setHours(13, 0, 0, 0); // Afternoon test

        const afterSession = new Session({
          userId: patient._id,
          taskType: testType === 'tapping' ? 'reaction_time' : 'accelerometer',
          startedAt: new Date(afterDate.getTime() - 20000),
          endedAt: afterDate,
          payload: { samples: [] },
          risk_level: afterScore > 0.75 ? 'high' : afterScore > 0.45 ? 'moderate' : 'low',
          score: afterScore,
          analysis: { message: "Seeded ON state test" },
          medicationStatus: "ON",
          
          testType,
          rawFeatures: testType === 'tapping' ? [65, 3.25, 0.01, 0.30, 0.02, 0.42, 0.28, 0.98, -0.002] : [8.2, 1.8, 4.2, 0.55],
          baseConfidence: afterScore, // No offset
          appliedOffset: 0.00,
          severityScore: afterScore,
          interpretation: afterScore <= 0.45 ? "Low symptoms (good)" : "Moderate symptoms",
          medTimepoint: "Just after Parkinson medication (at your best)",
          timestamp: afterDate
        });
        await afterSession.save();
      }
    }

    console.log("🎉 Seeding finished successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

runSeed();
