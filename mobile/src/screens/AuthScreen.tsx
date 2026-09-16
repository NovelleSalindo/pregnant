import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

interface AuthScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lmp, setLmp] = useState('');
  const [age, setAge] = useState('');
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(api.getBaseUrl());

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Required Fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      Alert.alert(
        'Login Failed',
        err.message || 'Could not connect to PregnaCare API. Check your network or server URL.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Required Fields', 'Please fill in Name, Email, and Password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        name: name.trim(),
        email: email.trim(),
        password,
        lmp: lmp.trim() || undefined,
        age: age ? parseInt(age, 10) : undefined,
      });
      Alert.alert('Welcome to PregnaCare!', 'Your account has been created.');
      onLoginSuccess(res.user);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: 'patient' | 'admin' = 'patient') => {
    if (role === 'patient') {
      setEmail('ana@demo.com');
      setPassword('demo123');
    } else {
      setEmail('admin@demo.com');
      setPassword('demo123');
    }
  };

  const saveServerUrl = async () => {
    await api.setBaseUrl(serverUrl);
    setShowServerModal(false);
    Alert.alert('Saved', `API Base URL updated to:\n${serverUrl}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Decorative ambient background spots (.auth-wrap in style.css) */}
      <View style={styles.ambientSpotSky} />
      <View style={styles.ambientSpotPink} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <LinearGradient
            colors={Gradients.brandMark}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandMark}
          >
            <Ionicons name="heart" size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.brandName}>PregnaCare</Text>
          <Text style={styles.brandTagline}>Maternal Risk Monitoring & Recommendations</Text>
        </View>

        {/* Auth Card (.auth-card in style.css) */}
        <View style={[styles.card, Shadows.soft]}>
          {/* Segmented Tab (.auth-tabs) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => setTab('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => setTab('register')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {tab === 'register' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {tab === 'register' && (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Last Menstrual Period (LMP) - Optional</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (e.g. 2026-03-10)"
                  placeholderTextColor={Colors.textMuted}
                  value={lmp}
                  onChangeText={setLmp}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Age - Optional</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 28"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
            </>
          )}

          {/* Action Button (.btn-primary) */}
          <TouchableOpacity
            onPress={tab === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            style={{ marginTop: 8 }}
          >
            <LinearGradient
              colors={Gradients.primaryBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionBtn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.actionBtnText}>
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Demo Quick Fill */}
          {tab === 'login' && (
            <View style={styles.demoBox}>
              <Text style={styles.demoBoxTitle}>Quick Demo Sign-in:</Text>
              <View style={styles.demoBtnRow}>
                <TouchableOpacity style={styles.demoPill} onPress={() => fillDemo('patient')}>
                  <Text style={styles.demoPillText}>Ana (Patient)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.demoPill} onPress={() => fillDemo('admin')}>
                  <Text style={styles.demoPillText}>Admin</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Server Setting Link */}
        <TouchableOpacity
          style={styles.serverSettingsBtn}
          onPress={() => setShowServerModal(!showServerModal)}
        >
          <Ionicons name="server-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.serverSettingsText}>Backend: {api.getBaseUrl()}</Text>
        </TouchableOpacity>

        {showServerModal && (
          <View style={[styles.serverConfigBox, Shadows.card]}>
            <Text style={styles.serverConfigTitle}>Configure Backend API URL:</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://pregnant-production.up.railway.app/api"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.saveServerBtn} onPress={saveServerUrl}>
              <Text style={styles.saveServerBtnText}>Update Server URL</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  ambientSpotSky: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.secondaryLight,
    opacity: 0.45,
  },
  ambientSpotPink: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.primaryLight,
    opacity: 0.45,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 36,
    paddingBottom: 48,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 26,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadows.glow,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12.5,
    color: Colors.textSoft,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSoft,
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  demoBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  demoBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  demoBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  demoPillText: {
    fontSize: 12.5,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  serverSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  serverSettingsText: {
    fontSize: 11.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  serverConfigBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverConfigTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
    color: Colors.text,
  },
  saveServerBtn: {
    backgroundColor: Colors.secondaryDark,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveServerBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
