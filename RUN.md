# NeuroTrack — Run & Record Guide

Three tiers, started in this order. **No database needed** — the backend uses an
in-memory store unless you set `MONGO_URI`.

```
Expo app  ──HTTP──>  Node/Express gateway (:5000)  ──HTTP──>  FastAPI ML (:8000)
```

## 1. ML service (FastAPI, port 8000)

```bash
cd backend/ml-service
pip install -r requirements.txt
python train.py        # only needed once — rebuilds the 4 .pkl artifacts (already committed)
uvicorn main:app --host 127.0.0.1 --port 8000
```
Leave it running. Sanity check: open http://127.0.0.1:8000/health → `{"ok": true}`.

## 2. Backend gateway (Node, port 5000)

```bash
cd backend
npm install
npm run dev
```
You should see `🗃️ ... in-memory store (zero-setup demo mode)` and `🚀 Clean Server on port 5000`.

Optional full-chain test (with both servers up):
```bash
cd backend/ml-service && python smoke_test.py
```

## 3. Frontend (Expo)

```bash
cd frontend
npm install --legacy-peer-deps   # --legacy-peer-deps avoids a react/react-dom peer conflict
npx expo start
```

---

## Recording the demo

### Easiest (laptop only, no phone, no sensors) — recommended
1. `npx expo start --web` (or press `w` in the Expo CLI). Auth + history work on web
   via a storage shim; the **Demo Mode** screen doesn't need sensors.
2. `frontend/.env` already points to `http://localhost:5000/api` — correct for web.
3. In the app: **Sign up → Log in → Tasks → Demo Mode**.
4. Tap **Simulate Healthy Profile** (scores stay green/low) then **Simulate
   Parkinsonian Profile** (scores go red/high).
5. Open the **History** tab to show the score trend graph populating over time.

This is the bulletproof recording path: every result is produced by the real ML
pipeline, just fed simulated sensor data.

### Real device (shows live sensors)
1. Find your laptop's LAN IPv4 (`ipconfig`).
2. Set `frontend/.env` → `EXPO_PUBLIC_API_URL=http://<THAT_IP>:5000/api` and restart Expo.
3. Open in **Expo Go** on a phone on the same Wi-Fi.
4. Use **Finger Tapping** (tap L/R for 20 s) and **Tremor** (hold still 20 s) for real
   sensor capture, then view History.
   - Android emulator instead of a phone: use `http://10.0.2.2:5000/api`.

---

## Notes
- The classifier is a **research prototype** on a small, proxy-labeled dataset — the
  tapping signal is the reliable one; tremor is weak (see `backend/ml-service/README.md`
  → *Limitations*). The app demonstrates the full pipeline and UX, not clinical accuracy.
- To persist data across restarts, add `MONGO_URI=...` to `backend/.env`; the backend
  switches from in-memory to MongoDB automatically.
