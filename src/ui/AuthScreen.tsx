import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Button, Input } from './common';
import { useTheme } from './theme';

export function AuthScreen() {
  const t = useTheme();
  const signIn = useStore(s => s.signIn);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const canSubmit = !loading && !!email.trim() && !!password && isConfigured;
  const submit = () => canSubmit && signIn(email.trim(), password);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, { backgroundColor: t.pane, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.logo, { backgroundColor: t.accent }]}>
          <Text style={styles.logoGlyph}>✓</Text>
        </View>
        <Text style={[styles.title, { color: t.text }]}>Recall</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>Notes and reminders, synced between your iPhone and Mac.</Text>
        {!isConfigured ? (
          <Text style={[styles.error, { color: t.danger }]}>This build has no server configured. Run scripts/setup-supabase.sh, then rebuild.</Text>
        ) : null}
        <Input
          testID="email"
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
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
            placeholder="Password"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
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
            hitSlop={8}
            style={[styles.eye, { backgroundColor: t.input }]}>
            <Text style={[styles.eyeText, { color: t.accent }]}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        {error ? (
          <Text testID="auth-error" style={[styles.error, { color: t.danger }]}>
            {error}
          </Text>
        ) : null}
        <Button testID="sign-in" title={loading ? 'Signing in…' : 'Sign in'} disabled={!canSubmit} onPress={submit} style={styles.submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 380, padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  logo: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoGlyph: { color: '#fff', fontSize: 26, fontWeight: '800' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 22 },
  field: { marginBottom: 10, paddingVertical: 12, fontSize: 16 },
  passwordRow: { flexDirection: 'row', gap: 8 },
  passwordInput: { flex: 1 },
  eye: { marginBottom: 10, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  eyeText: { fontSize: 14, fontWeight: '600' },
  error: { marginBottom: 10, fontSize: 14 },
  submit: { marginTop: 6 },
});
