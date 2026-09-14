import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { alarms } from '../lib/alarms';
import { useStore } from '../store/useStore';
import { Button, Header } from './common';
import { useTheme } from './theme';

export function SettingsScreen() {
  const t = useTheme();
  const session = useStore(s => s.session);
  const signOut = useStore(s => s.signOut);
  const loadAll = useStore(s => s.loadAll);
  const permission = useStore(s => s.permissionGranted);
  const itemCount = useStore(s => Object.keys(s.items).length);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Settings" />
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Row label="Account" value={session?.user.email ?? '—'} />
        <Row label="Items synced" value={String(itemCount)} />
        <Row label="Notifications" value={!alarms.supported ? 'Unsupported' : permission == null ? 'Checking…' : permission ? 'Allowed' : 'Denied (enable in System Settings)'} />
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <Button title="Refresh from cloud" kind="ghost" onPress={() => loadAll()} />
        <Button title="Sign out" kind="danger" onPress={() => signOut()} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
});
