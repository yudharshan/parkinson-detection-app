/**
 * store.ts — storage abstraction with a zero-setup in-memory fallback.
 *
 * Defaults to an in-memory store so the app runs with NO database install
 * (ideal for a demo / recording). If MongoDB connects successfully, server.ts
 * calls setMemoryMode(false) and the same functions transparently use Mongoose.
 */

import { Session } from './models/Session.js';
import { User } from './models/User.js';

let memoryMode = true;
export const setMemoryMode = (v: boolean) => { memoryMode = v; };
export const isMemoryMode = () => memoryMode;

const memSessions: any[] = [];
const memUsers: any[] = [];
let counter = 1;
const nextId = (p: string) => `${p}_${Date.now()}_${counter++}`;

// ---------------- sessions ----------------
export async function saveSession(doc: any) {
  if (memoryMode) {
    const rec = { _id: nextId('sess'), createdAt: new Date(), updatedAt: new Date(), ...doc };
    memSessions.unshift(rec);
    return rec;
  }
  const s = new Session(doc);
  await s.save();
  return s.toObject();
}

export async function findSessions(filter: { userId?: any; testType?: string } = {}) {
  if (memoryMode) {
    let rows = [...memSessions];
    if (filter.userId) rows = rows.filter(r => String(r.userId) === String(filter.userId));
    if (filter.testType) rows = rows.filter(r => r.testType === filter.testType);
    return rows;
  }
  const q: any = {};
  if (filter.userId) q.userId = filter.userId;
  if (filter.testType) q.testType = filter.testType;
  const docs = await Session.find(q).sort({ timestamp: -1 });
  return docs.map(d => d.toObject());
}

// ---------------- users ----------------
export async function findUserByEmail(email: string) {
  if (memoryMode) return memUsers.find(u => u.email === email) || null;
  return User.findOne({ email }).select('+password');
}

export async function findUserById(id: string) {
  if (memoryMode) return memUsers.find(u => String(u._id) === String(id)) || null;
  return User.findById(id);
}

export async function createUser(doc: any) {
  if (memoryMode) {
    const rec = { _id: nextId('user'), role: 'patient', ...doc };
    memUsers.push(rec);
    return rec;
  }
  const u = new User(doc);
  await u.save();
  return u;
}

export async function findUserByPatientCode(code: string) {
  if (memoryMode) return memUsers.find(u => u.patientCode === code) || null;
  return User.findOne({ patientCode: code });
}

export async function findUsers(filter: { role?: string; clinicianId?: any } = {}) {
  if (memoryMode) {
    return memUsers.filter(u =>
      (filter.role ? u.role === filter.role : true) &&
      (filter.clinicianId ? String(u.clinicianId) === String(filter.clinicianId) : true));
  }
  const q: any = {};
  if (filter.role) q.role = filter.role;
  if (filter.clinicianId) q.clinicianId = filter.clinicianId;
  return User.find(q);
}

export async function updateUser(id: string, patch: any) {
  if (memoryMode) {
    const u = memUsers.find(x => String(x._id) === String(id));
    if (u) Object.assign(u, patch);
    return u || null;
  }
  return User.findByIdAndUpdate(id, patch, { new: true });
}
