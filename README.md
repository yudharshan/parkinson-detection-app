# 🧠 NeuroTrack: Full-Stack AI Parkinson's Detection

This ecosystem captures **accelerometer**, **reaction time**, and **tracing task** data for real-time ML processing. It includes a React Native frontend, a Node.js gateway, and a FastAPI ML microservice.

---

## 🏗️ 1. ML Microservice (The "Brain")
**Must be running for tremor analysis to work.**

- `cd backend/ml-service`
- `python -m venv venv`
- **Activate:** `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
- `pip install -r requirements.txt`
- `uvicorn main:app --reload` (Runs on `http://127.0.0.1:8000`)

---

## ⚡ 2. Node.js Backend (The "Gateway")
**Handles Auth, Database persistence, and Clinical Logic.**

- `cd backend`
- `npm install`
- **Create `.env`:** Add your `MONGO_URI`, `JWT_SECRET`, and `PORT=5000`.
- `npm run dev` (Runs on `http://localhost:5000`)

---

## 📱 3. Frontend Setup (React Native / Expo)
**The mobile interface.**

- `cd frontend`
- `npm install`
- **⚠️ Network Config:** Update `baseURL` in `src/services/api/` to your **Laptop's Local IP** (e.g., `192.168.x.x:5000`). Physical phones cannot use `localhost`.
- **Path Alias:** `@/` points to `src/`. Ensure `babel-plugin-module-resolver` is installed.
- `npx expo start`

---

## 📂 Project Structure

- **`frontend/app/`** – Expo Router screens (tabs, sensors, settings).
- **`frontend/src/models/`** – TypeScript types for all sensor data (Now connected to ML).
- **`backend/src/controllers/`** – Clinical logic for **ON/OFF medication states**.
- **`backend/ml-service/`** – FastAPI + Ensemble Pickle (.pkl) models.

---

## 📊 ML Status: ACTIVE
The "Future ML" mentioned in previous docs is now **LIVE**. Payloads from `src/models/` are sent to the backend, processed by an ensemble (Random Forest + SVM), and return a clinical risk score with "Wearing-Off" insights.