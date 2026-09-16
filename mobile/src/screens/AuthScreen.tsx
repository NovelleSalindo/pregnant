import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields (1:1 with login.php and register.php)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [lmp, setLmp] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(api.getBaseUrl());

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Invalid email or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    // Auto-compute EDD from LMP (+280 days) matching register.php
    let edd: string | undefined = undefined;
    if (lmp.trim()) {
      const lmpDate = new Date(lmp.trim());
      if (!isNaN(lmpDate.getTime())) {
        lmpDate.setDate(lmpDate.getDate() + 280);
        edd = lmpDate.toISOString().split('T')[0];
      }
    }

    // Auto-compute Age from DOB matching register.php
    let age: number | undefined = undefined;
    if (dob.trim()) {
      const dobDate = new Date(dob.trim());
      if (!isNaN(dobDate.getTime())) {
        const diffMs = Date.now() - dobDate.getTime();
        age = Math.floor(diffMs / (365.25 * 86400000));
      }
    }

    setLoading(true);
    try {
      const res = await api.register({
        name: name.trim(),
        email: email.trim(),
        password,
        dob: dob.trim() || undefined,
        lmp: lmp.trim() || undefined,
        edd,
        age,
        height_cm: height ? parseFloat(height) : undefined,
        weight_kg: weight ? parseFloat(weight) : undefined,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'An account with that email already exists.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: 'patient' | 'admin' = 'patient') => {
    setErrorMessage(null);
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
    setErrorMessage(`API Base URL set to: ${serverUrl}`);
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
        {/* Brand Header (.brand from style.css) */}
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
          <Text style={styles.brandTagline}>Maternal Risk Monitoring</Text>
        </View>

        {/* Auth Card (.auth-card in style.css) */}
        <View style={[styles.card, Shadows.soft]}>
          {/* Segmented Tab (.auth-tabs in style.css) */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Error Message (.badge.badge-high) */}
          {errorMessage && (
            <View style={styles.errorBadge}>
              <Ionicons name="alert-circle" size={16} color={Colors.riskHigh} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* --- REGISTER FIELDS (1:1 with register.php) --- */}
          {tab === 'register' && (
            <>
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

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
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
                  placeholder="At least 6 characters"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.grid2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Last Menstrual Period</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                    value={lmp}
                    onChangeText={setLmp}
                  />
                </View>
              </View>

              <View style={styles.grid2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 160"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={height}
                    onChangeText={setHeight}
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 62"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
              </View>
            </>
          )}

          {/* --- LOGIN FIELDS (1:1 with login.php) --- */}
          {tab === 'login' && (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
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
            </>
          )}

          {/* Action Button (.btn-primary in style.css) */}
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
                <View style={styles.btnContent}>
                  <Ionicons
                    name={tab === 'login' ? 'log-in-outline' : 'person-add-outline'}
                    size={18}
                    color={Colors.white}
                  />
                  <Text style={styles.actionBtnText}>
                    {tab === 'login' ? 'Log In' : 'Create Account'}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Demo Quick Fill (from login.php demo accounts) */}
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
    padding: 20,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 22,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...Shadows.glow,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    padding: 22,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSoft,
    padding: 4,
    borderRadius: 12,
    marginBottom: 18,
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
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.riskHighBg,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 12.5,
    color: Colors.riskHigh,
    fontWeight: '700',
    flex: 1,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSoft,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  grid2: {
    flexDirection: 'row',
    gap: 10,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
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
    fontSize: 12,
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
    maxWidth: 440,
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
