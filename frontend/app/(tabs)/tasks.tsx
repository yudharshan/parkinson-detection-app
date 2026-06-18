import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TASK_CARDS = [
  {
    href: '/accelerometer/new',
    icon: 'axis' as const,
    title: 'Resting Tremor',
    description: 'Record resting tremor with device motion',
  },
  {
    href: '/reaction/new',
    icon: 'timer-sand' as const,
    title: 'Finger Tapping',
    description: 'Assess finger alternation response speed',
  },
  {
    href: '/demo',
    icon: 'play-circle-outline' as const,
    title: 'Demo Mode',
    description: 'Run a simulated test through the ML pipeline (no sensors needed)',
  },
  {
    href: '/settings',
    icon: 'cog-outline' as const,
    title: 'Settings',
    description: 'App preferences and options',
  },
];

export default function TasksScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Tasks</Text>
      <Text style={styles.subtitle}>Choose an assessment to start</Text>

      {TASK_CARDS.map((task) => (
        <Link key={task.href} href={task.href} asChild>
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <MaterialCommunityIcons
              name={task.icon}
              size={40}
              color="#B26A43"
              style={styles.icon}
            />
            <Text style={styles.cardTitle}>{task.title}</Text>
            <Text style={styles.cardDescription}>{task.description}</Text>
          </TouchableOpacity>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F1E6' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3A2E25',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8A7765',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: { marginBottom: 12 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A2E25',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8A7765',
    textAlign: 'center',
  },
});
