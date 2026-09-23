import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_PASSWORD, useStore } from '../store/useStore';
import { Button, Input } from './common';
import { useTheme } from './theme';

export function NewPasswordScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const updatePassword = useStore(s => s.updatePassword);
  const signOut = useStore(s => s.signOut);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const confirmRef = useRef<TextInput>(null);
  const matches = password === confirm;
  const canSubmit = !loading && password.length >= MIN_PASSWORD && matches;
  const submit = () => canSubmit && updatePassword(password);

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: t.pane }]}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
            Choose a new password
          </Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>Pick a password with at least {MIN_PASSWORD} characters.</Text>
          <View style={styles.passwordRow}>
            <Input
              testID="new-password"
              accessibilityLabel="New password"
              placeholder={`New password (${MIN_PASSWORD}+ characters)`}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => confirmRef.current?.focus()}
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
          <Input
            ref={confirmRef}
            testID="confirm-password"
            accessibilityLabel="Confirm new password"
            placeholder="Repeat new password"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={submit}
            style={styles.field}
          />
          {confirm.length > 0 && !matches ? <Text style={[styles.message, { color: t.danger }]}>Both passwords must match.</Text> : null}
          {error ? (
            <Text testID="auth-error" accessibilityLiveRegion="polite" style={[styles.message, { color: t.danger }]}>
              {error}
            </Text>
          ) : null}
          <Button testID="save-password" title={loading ? 'Please wait…' : 'Save password'} disabled={!canSubmit} onPress={submit} style={styles.submit} />
          <Pressable testID="cancel-recovery" accessibilityRole="button" onPress={() => signOut()} style={({ pressed }) => [styles.switch, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={[styles.switchText, { color: t.accent }]}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  field: { marginBottom: 10, minHeight: 44, fontSize: 16 },
  passwordRow: { flexDirection: 'row', gap: 8 },
  passwordInput: { flex: 1 },
  eye: { marginBottom: 10, borderRadius: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  eyeText: { fontSize: 15, fontWeight: '600' },
  message: { marginBottom: 10, fontSize: 14, lineHeight: 20 },
  submit: { marginTop: 6, minHeight: 48 },
  switch: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  switchText: { fontSize: 14, fontWeight: '600' },
});
