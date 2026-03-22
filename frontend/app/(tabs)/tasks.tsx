import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TASK_CARDS = [
  {
    href: '/accelerometer/new',
    icon: 'axis' as const,
    title: 'Accelerometer',
    description: 'Record tremor data with device motion',
  },
  {
    href: '/reaction/new',
    icon: 'timer-sand' as const,
    title: 'Reaction Time',
    description: 'Measure tap response speed',
  },
  {
    href: '/tracing/new',
    icon: 'draw' as const,
    title: 'Tracing',
    description: 'Trace shapes for motor assessment',
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
              color="#0A84FF"
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
  scroll: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
