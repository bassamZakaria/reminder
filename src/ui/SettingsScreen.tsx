import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { alarms } from '../lib/alarms';
import { useStore } from '../store/useStore';
import { Button } from './common';
import { useTheme } from './theme';

export function SettingsScreen({ headerLeft }: { headerLeft?: React.ReactNode }) {
  const t = useTheme();
  const session = useStore(s => s.session);
  const signOut = useStore(s => s.signOut);
  const loadAll = useStore(s => s.loadAll);
  const permission = useStore(s => s.permissionGranted);
  const alarmPermission = useStore(s => s.alarmPermission);
  const nativeAlarms = useStore(s => s.nativeAlarms);
  const requestAlarmPermission = useStore(s => s.requestAlarmPermission);
  const items = useStore(s => s.items);
  const noteCount = Object.keys(items).length;
  const [pending, setPending] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      alarms.pendingIds().then(ids => {
        if (!cancelled) {
          setPending(ids);
        }
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.header}>
        {headerLeft}
        <Text style={[styles.title, { color: t.text }]}>Settings</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.pane, borderColor: t.border }]}>
        <Row label="Account" value={session?.user.email ?? '—'} />
        <Row label="Notes synced" value={String(noteCount)} />
        <Row label="Notifications" value={!alarms.supported ? 'Unsupported' : permission == null ? 'Checking…' : permission ? 'Allowed' : 'Denied — enable in System Settings'} />
        <Row label="System alarms" value={!nativeAlarms ? 'In-app alarm (this device)' : alarmPermission ? 'Allowed' : 'Tap below to allow'} />
        <Row label="Alerts scheduled" value={pending == null ? '…' : String(pending.length)} />
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        {nativeAlarms && !alarmPermission ? <Button title="Allow system alarms" onPress={() => requestAlarmPermission()} /> : null}
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
      <Text style={{ color: t.textSecondary, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '700' },
  card: { margin: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
});
