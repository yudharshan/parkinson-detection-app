/**
 * Navigation param lists for type-safe routing (if using React Navigation directly).
 * With Expo Router, params are inferred from file-based routes.
 */

export type RootStackParamList = {
  Home: undefined;
  Accelerometer: { sessionId?: string };
  Reaction: { sessionId?: string };
  Tracing: { sessionId?: string };
  Settings: undefined;
};
