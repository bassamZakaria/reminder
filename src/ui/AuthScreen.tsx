import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.wrap, { backgroundColor: t.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.logo, { backgroundColor: t.accent }]}><Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>✓</Text></View>
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
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 380, padding: 22, borderRadius: 16, borderWidth: 1 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  logo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});
