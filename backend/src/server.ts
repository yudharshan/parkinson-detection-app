import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// IMPORTANT: Add .js at the end of the local import for ESM
import { Session } from './models/Session.js'; 

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || "";

// Guard check for URI
if (!MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is missing in .env file!");
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected!"))
    .catch(err => console.error("❌ DB Error:", err));

app.post('/api/analyze', async (req, res) => {
    try {
        const { taskType, payload } = req.body; // 👈 1. Extract the data first
        let risk = "low"; // Default value

        // 🧠 2. THE LOGIC GATE: Calculate risk based on the sensor type
        if (taskType === 'reaction_time') {
            const meanTime = payload.meanReactionTimeMs || 0; 
            
            if (meanTime > 800) risk = "high";
            else if (meanTime > 500) risk = "moderate";
            else risk = "low";
        } else if (taskType === 'accelerometer') {
            // You can add tremor logic here later!
            risk = "low"; 
        }

        
        const savedData = await Session.create({
            ...req.body,
            risk_level: risk
        });

        console.log(`✅ [${taskType.toUpperCase()}] Saved ID: ${savedData._id} | Risk: ${risk}`);
        
        
        res.json({ 
            success: true,
            id: savedData._id,
            risk_level: risk 
        });

    } catch (err) {
        console.error("❌ Save Error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});
// --- THE HISTORY ROUTE (GET) ---
app.get('/api/history', async (req, res) => {
    try {
        console.log("🔍 Fetching Parkinson's test history...");
        
        // 1. Fetch all sessions from MongoDB
        // 2. Sort by 'createdAt' so the newest test is at the top
        const sessions = await Session.find().sort({ createdAt: -1 });

        
        res.status(200).json(sessions);
    } catch (error) {
        console.error("❌ Failed to fetch history:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(5000, '0.0.0.0', () => {
    console.log("🚀 Server running on port 5000");
});