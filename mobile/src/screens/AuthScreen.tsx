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
import { Colors, Shadows } from '../theme/colors';
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="heart-circle" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.brandName}>PregnaCare</Text>
          <Text style={styles.brandTagline}>Maternal Risk Monitoring & Companion</Text>
        </View>

        {/* Auth Card */}
        <View style={[styles.card, Shadows.medium]}>
          {/* Segmented Tab */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => setTab('register')}
            >
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {tab === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={Colors.textLight}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {tab === 'register' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Menstrual Period (LMP) - Optional</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD (e.g. 2026-03-10)"
                  placeholderTextColor={Colors.textLight}
                  value={lmp}
                  onChangeText={setLmp}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age - Optional</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 28"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numeric"
                  value={age}
                  onChangeText={setAge}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
            onPress={tab === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.actionBtnText}>
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
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
          <Text style={styles.serverSettingsText}>Server: {api.getBaseUrl()}</Text>
        </TouchableOpacity>

        {showServerModal && (
          <View style={styles.serverConfigBox}>
            <Text style={styles.serverConfigTitle}>Configure Backend API URL:</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.xxx/HAYYYSSSS/pregnacare_old/api"
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
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    ...Shadows.small,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: Colors.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    ...Shadows.small,
  },
  actionBtnDisabled: {
    opacity: 0.7,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  demoBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  demoPillText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  serverSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  serverSettingsText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  serverConfigBox: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverConfigTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    color: Colors.text,
  },
  saveServerBtn: {
    backgroundColor: Colors.secondary,
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
