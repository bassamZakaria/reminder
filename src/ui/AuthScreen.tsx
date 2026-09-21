import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isConfigured, links } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Button, Input } from './common';
import { useTheme } from './theme';

enum AuthMode {
  SignIn = 'sign-in',
  SignUp = 'sign-up',
}

const MIN_PASSWORD = 8;

export function AuthScreen() {
  const t = useTheme();
  const signIn = useStore(s => s.signIn);
  const signUp = useStore(s => s.signUp);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const info = useStore(s => s.info);
  const [mode, setMode] = useState(AuthMode.SignIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const signingUp = mode === AuthMode.SignUp;
  const passwordOk = signingUp ? password.length >= MIN_PASSWORD : password.length > 0;
  const canSubmit = !loading && /\S+@\S+\.\S+/.test(email.trim()) && passwordOk && isConfigured;
  const submit = () => {
    if (canSubmit) {
      (signingUp ? signUp : signIn)(email.trim(), password);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: t.pane }]}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={[styles.logo, { backgroundColor: t.accentFill }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={[styles.logoGlyph, { color: t.onAccent }]}>✓</Text>
          </View>
          <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
            {signingUp ? 'Create your account' : 'Recall'}
          </Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>Notes and reminders, synced between your devices.</Text>
          {!isConfigured ? <Text style={[styles.message, { color: t.danger }]}>This build has no server configured. Run scripts/setup-supabase.sh, then rebuild.</Text> : null}
          <Input
            testID="email"
            accessibilityLabel="Email"
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType={signingUp ? 'emailAddress' : 'username'}
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={styles.field}
          />
          <View style={styles.passwordRow}>
            <Input
              ref={passwordRef}
              testID="password"
              accessibilityLabel="Password"
              placeholder={signingUp ? `Password (${MIN_PASSWORD}+ characters)` : 'Password'}
              secureTextEntry={!showPassword}
              autoComplete={signingUp ? 'new-password' : 'password'}
              textContentType={signingUp ? 'newPassword' : 'password'}
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              style={[styles.field, styles.passwordInput]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword(v => !v)}
              style={({ pressed }) => [styles.eye, { backgroundColor: t.input, opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[styles.eyeText, { color: t.accent }]}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          {error ? (
            <Text testID="auth-error" accessibilityLiveRegion="polite" style={[styles.message, { color: t.danger }]}>
              {error}
            </Text>
          ) : null}
          {info ? (
            <Text testID="auth-info" accessibilityLiveRegion="polite" style={[styles.message, { color: t.text }]}>
              {info}
            </Text>
          ) : null}
          <Button testID="sign-in" title={loading ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'} disabled={!canSubmit} onPress={submit} style={styles.submit} />
          <Pressable
            testID="switch-mode"
            accessibilityRole="button"
            onPress={() => setMode(signingUp ? AuthMode.SignIn : AuthMode.SignUp)}
            style={({ pressed }) => [styles.switch, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.switchText, { color: t.textSecondary }]}>
              {signingUp ? 'Already have an account? ' : 'New to Recall? '}
              <Text style={{ color: t.accent }}>{signingUp ? 'Sign in' : 'Create an account'}</Text>
            </Text>
          </Pressable>
          {signingUp && links.privacyPolicyUrl ? (
            <Text style={[styles.legal, { color: t.muted }]}>
              By creating an account you agree to the{' '}
              <Text accessibilityRole="link" style={{ color: t.accent }} onPress={() => Linking.openURL(links.privacyPolicyUrl!)}>
                Privacy Policy
              </Text>
              .
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  logo: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoGlyph: { fontSize: 26, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 22 },
  field: { marginBottom: 10, minHeight: 44, fontSize: 16 },
  passwordRow: { flexDirection: 'row', gap: 8 },
  passwordInput: { flex: 1 },
  eye: { marginBottom: 10, borderRadius: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  eyeText: { fontSize: 15, fontWeight: '600' },
  message: { marginBottom: 10, fontSize: 14, lineHeight: 20 },
  submit: { marginTop: 6, minHeight: 48 },
  switch: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  switchText: { fontSize: 14 },
  legal: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
});
