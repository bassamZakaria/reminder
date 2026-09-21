import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alarms } from '../lib/alarms';
import { links } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { AlertType } from '../types';
import { ErrorBanner } from './common';
import { isMac, useTheme } from './theme';

const TEST_DELAY_S = 5;

export function SettingsScreen({ bottomInset }: { bottomInset: number }) {
  const t = useTheme();
  const session = useStore(s => s.session);
  const signOut = useStore(s => s.signOut);
  const deleteAccount = useStore(s => s.deleteAccount);
  const requestNotifications = useStore(s => s.requestNotificationPermission);
  const refresh = useStore(s => s.refresh);
  const refreshing = useStore(s => s.refreshing);
  const permission = useStore(s => s.permissionGranted);
  const alarmPermission = useStore(s => s.alarmPermission);
  const nativeAlarms = useStore(s => s.nativeAlarms);
  const requestAlarmPermission = useStore(s => s.requestAlarmPermission);
  const showToast = useStore(s => s.showToast);
  const notes = useStore(s => s.notes);
  const reminders = useStore(s => s.reminders);
  const lists = useStore(s => s.lists);
  const noteCount = Object.keys(notes).length;
  const reminderCount = Object.values(reminders).filter(r => !r.is_completed).length;
  const [pending, setPending] = useState<string[] | null>(null);
  const insets = useSafeAreaInsets();

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
  }, [reminders]);

  const sendTest = async (alertType: AlertType) => {
    if (permission === false) {
      showToast('Turn on notifications for Recall first.');
      return;
    }
    await alarms.scheduleTest(new Date(Date.now() + TEST_DELAY_S * 1000), alertType);
    showToast(isMac ? `Test ${alertType} in ${TEST_DELAY_S} seconds.` : `Test ${alertType} in ${TEST_DELAY_S} seconds. Lock your phone to see it.`);
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Reminders stop alerting on this device until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);

  const confirmDeleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and all of your notes, reminders and folders on every device. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: () => deleteAccount() },
      ],
    );

  const notificationStatus = !alarms.supported ? 'Unsupported' : permission == null ? 'Not set up' : permission ? 'Allowed' : 'Off';

  return (
    <View style={[styles.flex, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { paddingTop: isMac ? 14 : insets.top + 6, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
          Settings
        </Text>
      </View>
      <ErrorBanner />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (isMac ? insets.bottom : bottomInset) + 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <SectionLabel text="Your data" />
        <Card>
          <Row label="Signed in as" value={session?.user.email ?? '—'} />
          <Row label="Notes" value={String(noteCount)} />
          <Row label="Open reminders" value={String(reminderCount)} />
          <Row label="Folders" value={String(Object.keys(lists).length)} last />
        </Card>

        <SectionLabel text="Alerts on this device" />
        <Card>
          <Row label="Notifications" value={notificationStatus} tone={permission === false ? t.danger : undefined} />
          {Platform.OS === 'ios' ? <Row label="System alarms" value={!nativeAlarms ? 'Needs iOS 26' : alarmPermission ? 'Allowed' : 'Not allowed yet'} /> : null}
          {Platform.OS === 'android' && nativeAlarms ? <Row label="Alarms & reminders" value={alarmPermission ? 'Allowed' : 'Off'} tone={alarmPermission ? undefined : t.danger} /> : null}
          <Row label="Scheduled alerts" value={pending == null ? '…' : String(pending.length)} last />
        </Card>
        {permission === false ? (
          <Text style={[styles.help, { color: t.danger }]}>
            Notifications are off, so reminders can’t alert you. Turn them on in {isMac ? 'System Settings › Notifications › Recall' : Platform.OS === 'android' ? 'Settings › Apps › Recall › Notifications' : 'Settings › Recall › Notifications'}.
          </Text>
        ) : null}
        <Card>
          {permission == null ? <ActionRow testID="enable-notifications" label="Turn on notifications" onPress={() => requestNotifications()} /> : null}
          {permission === false && !isMac ? <ActionRow label="Open Settings" onPress={() => Linking.openSettings()} /> : null}
          {Platform.OS === 'android' && nativeAlarms && !alarmPermission ? (
            <Text style={[styles.inlineHelp, { color: t.muted }]}>Without “Alarms & reminders”, Android may deliver reminders a few minutes late.</Text>
          ) : null}
          {nativeAlarms && !alarmPermission ? (
            <ActionRow label={Platform.OS === 'android' ? 'Allow on-time alerts' : 'Allow system alarms'} onPress={() => requestAlarmPermission()} />
          ) : null}
          <ActionRow testID="test-notification" label="Send a test notification" onPress={() => sendTest(AlertType.Notification)} />
          <ActionRow testID="test-alarm" label="Send a test alarm" onPress={() => sendTest(AlertType.Alarm)} last />
        </Card>

        <SectionLabel text="Sync" />
        <Card>
          <ActionRow testID="refresh" label={refreshing ? 'Refreshing…' : 'Refresh from cloud'} onPress={refresh} last />
        </Card>
        <Text style={[styles.help, { color: t.muted }]}>
          Changes sync instantly between your iPhone and Mac.{isMac ? '' : ' Pull down on a list to refresh.'}
        </Text>

        {links.privacyPolicyUrl || links.supportUrl ? (
          <>
            <SectionLabel text="About" />
            <Card>
              {links.privacyPolicyUrl ? <ActionRow label="Privacy Policy" onPress={() => Linking.openURL(links.privacyPolicyUrl!)} last={!links.supportUrl} /> : null}
              {links.supportUrl ? <ActionRow label="Help & Support" onPress={() => Linking.openURL(links.supportUrl!)} last /> : null}
            </Card>
          </>
        ) : null}

        <SectionLabel text="Account" />
        <Card>
          <ActionRow testID="sign-out" label="Sign Out" onPress={confirmSignOut} />
          <ActionRow testID="delete-account" label="Delete Account" destructive onPress={confirmDeleteAccount} last />
        </Card>
        <Text style={[styles.help, { color: t.muted }]}>Deleting your account removes all of your data from our servers.</Text>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[styles.sectionLabel, { color: t.muted }]}>{text.toUpperCase()}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.pane, borderColor: t.border }]}>{children}</View>;
}

function Row({ label, value, last, tone }: { label: string; value: string; last?: boolean; tone?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: tone ?? t.textSecondary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({ label, onPress, destructive, last, testID }: { label: string; onPress: () => void; destructive?: boolean; last?: boolean; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.hover : 'transparent' }]}>
      <Text style={[styles.rowLabel, { color: destructive ? t.danger : t.accent, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  title: { flex: 1, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  content: { paddingTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 18, marginBottom: 6, marginLeft: 4 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, gap: 12 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15, flexShrink: 1, textAlign: 'right' },
  help: { fontSize: 13, lineHeight: 18, marginHorizontal: 4, marginBottom: 12 },
  inlineHelp: { fontSize: 12, lineHeight: 17, paddingHorizontal: 14, paddingBottom: 10 },
});
