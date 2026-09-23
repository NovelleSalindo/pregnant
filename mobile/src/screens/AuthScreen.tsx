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
  Image,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Shadows, Gradients } from '../theme/colors';
import { api } from '../services/api';

interface AuthScreenProps {
  onLoginSuccess: (user: any) => void;
  initialTab?: 'login' | 'register';
  onBack?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  initialTab = 'login',
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top : 10;
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  // Form Fields (1:1 with login.php and register.php)
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [lmp, setLmp] = useState('');

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email or username and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Invalid email/username or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!username.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in username, first name, last name, email, and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    const fullName = `${firstName.trim()} ${middleName.trim() ? middleName.trim() + ' ' : ''}${lastName.trim()}`;

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
        username: username.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        name: fullName,
        email: email.trim(),
        password,
        dob: dob.trim() || undefined,
        lmp: lmp.trim() || undefined,
        edd,
        age,
      });
      import('react-native').then(({ Alert }) => {
        Alert.alert('Registration Successful', 'Your account has been created. You can now log in.');
      });
      setTab('login');
      setPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'An account with that email or username already exists.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Decorative ambient background spots (.auth-wrap in style.css) */}
      <View style={styles.ambientSpotSky} />
      <View style={styles.ambientSpotPink} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 10 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        {onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityLabel="Back to Front page"
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}

        {/* Brand Header (.brand from style.css) */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/heart-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
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
                <Text style={styles.fieldLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. mariasantos"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              <View style={styles.grid2}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Maria"
                    placeholderTextColor={Colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Middle Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={Colors.textMuted}
                    value={middleName}
                    onChangeText={setMiddleName}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Santos"
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
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
            </>
          )}

          {/* --- LOGIN FIELDS (1:1 with login.php) --- */}
          {tab === 'login' && (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email or Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com or username"
                  placeholderTextColor={Colors.textMuted}
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
        </View>
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
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#C2577D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: 20,
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    shadowColor: '#2B2229',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
});
