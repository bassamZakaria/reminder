import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { isConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Button, Input } from './common';
import { useTheme } from './theme';

export function AuthScreen() {
  const t = useTheme();
  const signIn = useStore(s => s.signIn);
  const signUp = useStore(s => s.signUp);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.wrap, { backgroundColor: t.bg }]}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.title, { color: t.text }]}>Recall</Text>
        <Text style={{ color: t.muted, marginBottom: 20 }}>Notes and reminders, synced across your devices.</Text>
        {!isConfigured ? (
          <Text style={{ color: t.danger, marginBottom: 12 }}>App not configured. Run scripts/setup-supabase.sh and rebuild.</Text>
        ) : null}
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} style={{ marginBottom: 10 }} />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} style={{ marginBottom: 14 }} onSubmitEditing={() => signIn(email.trim(), password)} />
        {error ? <Text style={{ color: t.danger, marginBottom: 10 }}>{error}</Text> : null}
        {notice ? <Text style={{ color: t.accent, marginBottom: 10 }}>{notice}</Text> : null}
        <Button title={loading ? 'Please wait…' : 'Sign in'} disabled={loading || !email || !password} onPress={() => signIn(email.trim(), password)} />
        <Button
          title="Create account"
          kind="ghost"
          disabled={loading || !email || !password}
          style={{ marginTop: 6 }}
          onPress={async () => setNotice(await signUp(email.trim(), password))}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, padding: 22, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
});
