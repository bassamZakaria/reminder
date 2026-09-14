import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { CalendarScreen } from './CalendarScreen';
import { IconButton } from './common';
import { EditorScreen } from './EditorScreen';
import { NotesScreen } from './NotesScreen';
import { SettingsScreen } from './SettingsScreen';
import { Sidebar } from './Sidebar';
import { TaskList } from './TaskList';
import { isMac, useTheme } from './theme';

export function Shell() {
  const t = useTheme();
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const editor = useStore(s => s.editor);
  const openEditor = useStore(s => s.openEditor);
  const [drawer, setDrawer] = useState(false);

  const menuButton = isMac ? undefined : <IconButton label="☰" size={20} color={t.textSecondary} onPress={() => setDrawer(true)} />;
  const content =
    view.kind === 'notes' ? (
      <NotesScreen headerLeft={menuButton} />
    ) : view.kind === 'calendar' ? (
      <CalendarScreen headerLeft={menuButton} />
    ) : view.kind === 'settings' ? (
      <SettingsScreen headerLeft={menuButton} />
    ) : (
      <TaskList headerLeft={menuButton} />
    );

  if (isMac) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
        <Sidebar />
        <View style={{ flex: 1, minWidth: 320 }}>{content}</View>
        {view.kind !== 'settings' ? (
          <View style={[styles.detail, { backgroundColor: t.bg, borderLeftColor: t.border }]}>
            {editor ? (
              <EditorScreen key={editorKey(editor)} target={editor} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🗒️</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>Click a task to view details</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  const tabActive = (kind: string) => (kind === 'tasks' ? view.kind === 'smart' || view.kind === 'list' : view.kind === kind);
  const tabs = [
    { key: 'tasks', icon: '☑︎', label: 'Tasks', go: () => setView({ kind: 'smart', id: 'today' }) },
    { key: 'calendar', icon: '🗓', label: 'Calendar', go: () => setView({ kind: 'calendar' }) },
    { key: 'notes', icon: '📝', label: 'Notes', go: () => setView({ kind: 'notes' }) },
    { key: 'settings', icon: '⚙︎', label: 'Settings', go: () => setView({ kind: 'settings' }) },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>{content}</View>
      {view.kind === 'smart' || view.kind === 'list' ? (
        <Pressable
          onPress={() => openEditor({ kind: 'new', listId: view.kind === 'list' ? view.id : null, asReminder: false })}
          style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>＋</Text>
        </Pressable>
      ) : null}
      <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: t.card, borderTopColor: t.border }]}>
        <View style={{ flexDirection: 'row' }}>
          {tabs.map(item => (
            <Pressable key={item.key} onPress={item.go} style={styles.tabItem}>
              <Text style={{ fontSize: 20, color: tabActive(item.key) ? t.accent : t.muted }}>{item.icon}</Text>
              <Text style={{ color: tabActive(item.key) ? t.accent : t.muted, fontSize: 11, marginTop: 2 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SafeAreaView style={{ width: 280 }}>
            <Sidebar showBrand onNavigate={() => setDrawer(false)} />
          </SafeAreaView>
          <Pressable style={styles.scrim} onPress={() => setDrawer(false)} />
        </View>
      </Modal>
      <Modal visible={!!editor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => useStore.getState().closeEditor()}>
        {editor ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['bottom']}>
            <EditorScreen key={editorKey(editor)} target={editor} />
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function editorKey(editor: NonNullable<ReturnType<typeof useStore.getState>['editor']>): string {
  return editor.kind === 'existing' ? editor.id : `new-${editor.listId ?? ''}-${editor.asReminder}-${editor.dueAt ?? ''}`;
}

const styles = StyleSheet.create({
  detail: { width: 380, borderLeftWidth: StyleSheet.hairlineWidth },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  fab: { position: 'absolute', right: 20, bottom: 76, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
