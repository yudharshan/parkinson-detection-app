import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
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
  const [role, setRole] = useState<'patient' | 'clinician'>('patient');
  const [doctorCode, setDoctorCode] = useState('');

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setErrorMsg('Name, Email, and Password are required.');
      return;
    }
    if (role === 'clinician' && !doctorCode.trim()) {
      setErrorMsg('A doctor verification code is required to register as a doctor.');
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
      parsedDiagYear,
      role,
      role === 'clinician' ? doctorCode.trim() : undefined
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
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>{role === 'clinician' ? 'Create Doctor Account' : 'Create Patient Account'}</Text>
            <Text style={styles.subtitle}>
              {role === 'clinician'
                ? 'Register with your verification code to monitor patients'
                : "Register to monitor your Parkinson's health metrics"}
            </Text>
          </View>

          <View style={styles.card}>
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Text style={styles.label}>I am a *</Text>
            <View style={styles.roleRow}>
              <Pressable style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]} onPress={() => setRole('patient')}>
                <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Patient</Text>
              </Pressable>
              <Pressable style={[styles.roleBtn, role === 'clinician' && styles.roleBtnActive]} onPress={() => setRole('clinician')}>
                <Text style={[styles.roleText, role === 'clinician' && styles.roleTextActive]}>Doctor</Text>
              </Pressable>
            </View>

            {role === 'clinician' && (
              <>
                <Text style={styles.label}>Doctor Verification Code *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NEURO-2024"
                  placeholderTextColor="#A99A88"
                  value={doctorCode}
                  onChangeText={setDoctorCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#A99A88"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor="#A99A88"
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
              placeholderTextColor="#A99A88"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {role !== 'clinician' && (
              <View style={styles.row}>
                <View style={[styles.inputHalf, { marginRight: 12 }]}>
                  <Text style={styles.label}>Age (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="65"
                    placeholderTextColor="#A99A88"
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
                    placeholderTextColor="#A99A88"
                    value={diagnosisYear}
                    onChangeText={setDiagnosisYear}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

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
  safeArea: { flex: 1, backgroundColor: '#F7F1E6' },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'flex-start', marginBottom: 28 },
  logo: { width: 72, height: 72, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#3A2E25', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#8A7765', marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#3A2E25', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#EFE7D8' },
  errorContainer: { backgroundColor: '#F6EAE2', borderColor: '#DBA08C', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#8C3322', fontSize: 14, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '600', color: '#5C4A3A', marginBottom: 8 },
  input: { backgroundColor: '#F7F1E6', borderWidth: 1, borderColor: '#D9CBB8', borderRadius: 10, padding: 14, fontSize: 16, color: '#3A2E25', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputHalf: { flex: 1 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D9CBB8', alignItems: 'center', backgroundColor: '#F7F1E6' },
  roleBtnActive: { backgroundColor: '#B26A43', borderColor: '#B26A43' },
  roleText: { fontSize: 15, fontWeight: '700', color: '#6B5848' },
  roleTextActive: { color: '#FFFFFF' },
  btn: { backgroundColor: '#B26A43', borderRadius: 10, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#8A7765', fontSize: 15 },
  loginLink: { color: '#B26A43', fontSize: 15, fontWeight: '700' }
});
