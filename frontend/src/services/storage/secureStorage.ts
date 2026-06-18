/**
 * Platform-aware secure storage shim.
 * expo-secure-store is not supported on web (it throws), which would break auth in a
 * browser. On web we fall back to localStorage; on native we use SecureStore. Same API
 * so callers can swap the import path without other changes.
 */
import { Platform } from 'react-native';
import * as Native from 'expo-secure-store';

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
  }
  return Native.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  return Native.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  return Native.deleteItemAsync(key);
}
