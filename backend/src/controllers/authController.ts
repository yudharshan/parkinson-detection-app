import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js'; 

// 🟢 SIGNUP LOGIC
export const signup = async (req: Request, res: Response) => {
    try {
        const { name, email, password, age, diagnosisYear } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hashing the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            age,
            diagnosisYear,
            role: 'patient' // Always default self-signups to patient
        });

        await newUser.save();
        res.status(201).json({ 
            message: "User created successfully", 
            userId: newUser._id 
        });
    } catch (error) {
        res.status(500).json({ message: "Signup failed", error });
    }
};

// 🔵 LOGIN LOGIC
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // .select('+password') is needed because we set select:false in the Model
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate a JWT Token (The 15-20 LPA resume flex)
        // Generate a JWT Token
        const token = jwt.sign(
          { userId: user._id },
           process.env.JWT_SECRET as string, // 'as string' tells TS it definitely exists
          { expiresIn: '7d' }
       );

        res.status(200).json({
            message: "Login successful",
            token,
            userId: user._id,
            name: user.name,
            role: user.role || 'patient',
            clinicianId: user.clinicianId
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error });
    }
};