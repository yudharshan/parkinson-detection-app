import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="accelerometer/[sessionId]" />
      <Stack.Screen name="reaction/[sessionId]" />
      <Stack.Screen name="tracing/[sessionId]" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
