import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();
  const isClinician = user?.role === 'clinician';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#B26A43',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isClinician ? 'Patient Roster' : 'Dashboard',
          tabBarIcon: ({ color, size = 24 }) => (
            <Ionicons name={isClinician ? "people-outline" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          href: isClinician ? null : undefined, // Hide tasks for clinician
          tabBarIcon: ({ color, size = 24 }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: isClinician ? null : undefined, // Hide history for clinician
          tabBarIcon: ({ color, size = 24 }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
