import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [diagnosisYear, setDiagnosisYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setErrorMsg('Name, Email, and Password are required.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    const parsedAge = age ? parseInt(age, 10) : undefined;
    const parsedDiagYear = diagnosisYear ? parseInt(diagnosisYear, 10) : undefined;

    const result = await signup(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      parsedAge,
      parsedDiagYear
    );
    setLoading(false);
    if (!result.success) {
      setErrorMsg(result.message || 'Registration failed. Please try again.');
    } else {
      Alert.alert(
        'Success',
        'Account created successfully! Please sign in.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create Patient Account</Text>
            <Text style={styles.subtitle}>Register to monitor your Parkinson's health metrics</Text>
          </View>

          <View style={styles.card}>
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.row}>
              <View style={[styles.inputHalf, { marginRight: 12 }]}>
                <Text style={styles.label}>Age (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="65"
                  placeholderTextColor="#94A3B8"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputHalf}>
                <Text style={styles.label}>Diagnosis Year</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2020"
                  placeholderTextColor="#94A3B8"
                  value={diagnosisYear}
                  onChangeText={setDiagnosisYear}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Pressable 
              style={[styles.btn, loading && styles.btnDisabled]} 
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>Register Account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'flex-start', marginBottom: 28 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#64748B', marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  errorContainer: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#B91C1C', fontSize: 14, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 14, fontSize: 16, color: '#0F172A', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputHalf: { flex: 1 },
  btn: { backgroundColor: '#0A84FF', borderRadius: 10, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#64748B', fontSize: 15 },
  loginLink: { color: '#0A84FF', fontSize: 15, fontWeight: '700' }
});
