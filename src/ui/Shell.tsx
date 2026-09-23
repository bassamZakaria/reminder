import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorKind, useReminders, useStore, type EditorTarget } from '../store/useStore';
import { ViewKind } from '../types';
import { AlarmScreen } from './AlarmScreen';
import { ToastHost } from './common';
import { EditorScreen } from './EditorScreen';
import { NoteList } from './NoteList';
import { Paywall } from './Paywall';
import { ReminderList } from './ReminderList';
import { SettingsScreen } from './SettingsScreen';
import { Sidebar } from './Sidebar';
import { useIsWide } from './layout';
import { useTheme } from './theme';

const TAB_BAR_HEIGHT = 52;

enum Tab {
  Reminders = 'reminders',
  Notes = 'notes',
  Settings = 'settings',
}

const TABS: { tab: Tab; icon: string; label: string }[] = [
  { tab: Tab.Reminders, icon: '⏰', label: 'Reminders' },
  { tab: Tab.Notes, icon: '🗒️', label: 'Notes' },
  { tab: Tab.Settings, icon: '⚙️', label: 'Settings' },
];

function tabOf(kind: ViewKind): Tab {
  switch (kind) {
    case ViewKind.Reminders:
      return Tab.Reminders;
    case ViewKind.Settings:
      return Tab.Settings;
    default:
      return Tab.Notes;
  }
}

export function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const view = useStore(s => s.view);
  const editor = useStore(s => s.editor);
  const closeEditor = useStore(s => s.closeEditor);
  const openEditor = useStore(s => s.openEditor);
  const [expanded, setExpanded] = useState(false);
  const wide = useIsWide();

  const folderId = view.kind === ViewKind.Folder ? view.id : null;
  const newItem = () =>
    view.kind === ViewKind.Reminders
      ? openEditor({ kind: EditorKind.New, listId: null, nonce: Date.now(), withReminder: true })
      : openEditor({ kind: EditorKind.New, listId: folderId, nonce: Date.now() });

  const bottomInset = wide ? 0 : TAB_BAR_HEIGHT + insets.bottom;
  const content =
    view.kind === ViewKind.Settings ? (
      <SettingsScreen bottomInset={bottomInset} />
    ) : view.kind === ViewKind.Reminders ? (
      <ReminderList bottomInset={bottomInset} />
    ) : (
      <NoteList bottomInset={bottomInset} />
    );

  if (wide) {
    return (
      <View style={[styles.row, { backgroundColor: t.bg }]}>
        {!expanded ? <Sidebar /> : null}
        {!expanded ? <View style={[styles.listPane, { borderRightColor: t.border }]}>{content}</View> : null}
        <View style={styles.editorPane}>
          {editor ? (
            <EditorScreen
              key={editorKey(editor)}
              target={editor}
              expanded={expanded}
              onToggleExpand={() => setExpanded(e => !e)}
              onClose={() => {
                setExpanded(false);
                closeEditor();
              }}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>{view.kind === ViewKind.Reminders ? '⏰' : '🗒️'}</Text>
              <Text style={[styles.placeholderTitle, { color: t.textSecondary }]}>Select a {view.kind === ViewKind.Reminders ? 'reminder' : 'note'} to see its details</Text>
              <Pressable accessibilityRole="button" onPress={newItem} style={({ pressed }) => [styles.placeholderButton, { backgroundColor: t.accentFill, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={[styles.placeholderButtonText, { color: t.onAccent }]}>{view.kind === ViewKind.Reminders ? '＋ New Reminder' : '＋ New Note'}</Text>
              </Pressable>
            </View>
          )}
        </View>
        <ToastHost bottomInset={0} />
        <Paywall />
        <AlarmScreen />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.bg }]}>
      <View style={styles.flex}>{content}</View>
      {view.kind !== ViewKind.Settings ? (
        <Pressable
          testID={view.kind === ViewKind.Reminders ? 'new-reminder' : 'new-note'}
          accessibilityRole="button"
          accessibilityLabel={view.kind === ViewKind.Reminders ? 'New reminder' : 'New note'}
          onPress={newItem}
          style={({ pressed }) => [styles.fab, { backgroundColor: t.accentFill, bottom: bottomInset + 16, right: insets.right + 18, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Text style={[styles.fabIcon, { color: t.onAccent }]}>＋</Text>
        </Pressable>
      ) : null}
      <TabBar />
      <ToastHost bottomInset={bottomInset} />
      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
        {editor ? <EditorScreen key={editorKey(editor)} target={editor} /> : null}
      </Modal>
      {!editor ? <Paywall /> : null}
      {!editor ? <AlarmScreen /> : null}
    </View>
  );
}

function TabBar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const reminders = useReminders();
  const overdue = useMemo(() => {
    const now = Date.now();
    return reminders.filter(r => !r.is_completed && new Date(r.due_at).getTime() < now).length;
  }, [reminders]);
  const active = tabOf(view.kind);

  const go = (tab: Tab) => {
    if (tab === Tab.Reminders) {
      setView({ kind: ViewKind.Reminders });
    } else if (tab === Tab.Settings) {
      setView({ kind: ViewKind.Settings });
    } else if (active !== Tab.Notes) {
      setView({ kind: ViewKind.Notes });
    }
  };

  return (
    <View style={[styles.tabBar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: t.pane, borderTopColor: t.border }]} accessibilityRole="tablist">
      {TABS.map(({ tab, icon, label }) => {
        const selected = active === tab;
        return (
          <Pressable key={tab} testID={`tab-${tab}`} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab === Tab.Reminders && overdue ? `${label}, ${overdue} overdue` : label} onPress={() => go(tab)} style={styles.tab}>
            <View>
              <Text maxFontSizeMultiplier={1.2} style={[styles.tabIcon, { opacity: selected ? 1 : 0.45 }]}>{icon}</Text>
              {tab === Tab.Reminders && overdue ? (
                <View style={[styles.badge, { backgroundColor: t.danger }]}>
                  <Text maxFontSizeMultiplier={1.2} style={styles.badgeText}>{overdue}</Text>
                </View>
              ) : null}
            </View>
            <Text maxFontSizeMultiplier={1.3} style={[styles.tabLabel, { color: selected ? t.accent : t.muted }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function editorKey(editor: NonNullable<EditorTarget>): string {
  return editor.kind === EditorKind.Existing ? editor.id : `new-${editor.nonce}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  listPane: { width: 360, borderRightWidth: StyleSheet.hairlineWidth },
  editorPane: { flex: 1, minWidth: 380 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 44, marginBottom: 10 },
  placeholderTitle: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  placeholderButton: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  placeholderButtonText: { fontWeight: '700', fontSize: 14 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabIcon: { fontSize: 30, lineHeight: 34, fontWeight: '400' },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6, gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  badge: { position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
