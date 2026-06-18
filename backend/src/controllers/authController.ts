import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { findUserByEmail, createUser } from '../store.js';

// MVP doctor verification: a small set of invite codes issued to verified clinicians.
// Production would replace this with license-document upload + manual review.
const DOCTOR_CODES = ['NEURO-2024', 'PARKIN-7788', 'MEDIC-4321'];

const makePatientCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'PT-' + s;
};

// 🟢 SIGNUP
export const signup = async (req: Request, res: Response) => {
    try {
        const { name, email, password, age, diagnosisYear, role, doctorCode } = req.body;

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Determine role. Doctor signup requires a valid invite code.
        let finalRole: 'patient' | 'clinician' = 'patient';
        if (role === 'clinician' || role === 'doctor') {
            if (!DOCTOR_CODES.includes(String(doctorCode || '').trim().toUpperCase())) {
                return res.status(403).json({ message: "Invalid doctor verification code" });
            }
            finalRole = 'clinician';
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patientCode = finalRole === 'patient' ? makePatientCode() : undefined;

        const newUser = await createUser({
            name, email, password: hashedPassword, age, diagnosisYear,
            role: finalRole, patientCode,
        });

        res.status(201).json({
            message: "User created successfully",
            userId: newUser._id,
            role: finalRole,
            patientCode,
        });
    } catch (error) {
        res.status(500).json({ message: "Signup failed", error });
    }
};

// 🔵 LOGIN
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user: any = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful",
            token,
            userId: user._id,
            name: user.name,
            role: user.role || 'patient',
            clinicianId: user.clinicianId,
            patientCode: user.patientCode,
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error });
    }
};
