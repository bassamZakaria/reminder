import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { AlarmScreen } from './AlarmScreen';
import { IconButton } from './common';
import { EditorScreen } from './EditorScreen';
import { NoteList } from './NoteList';
import { SettingsScreen } from './SettingsScreen';
import { Sidebar } from './Sidebar';
import { isMac, useTheme } from './theme';

export function Shell() {
  const t = useTheme();
  const view = useStore(s => s.view);
  const editor = useStore(s => s.editor);
  const closeEditor = useStore(s => s.closeEditor);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const menuButton = isMac ? undefined : <IconButton label="☰" size={19} color={t.textSecondary} onPress={() => setDrawer(true)} />;
  const content = view.kind === 'settings' ? <SettingsScreen headerLeft={menuButton} /> : <NoteList headerLeft={menuButton} />;

  if (isMac) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
        {!expanded ? <Sidebar /> : null}
        {!expanded ? <View style={{ width: 320, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.border }}>{content}</View> : null}
        <View style={{ flex: 1, minWidth: 360 }}>
          {editor ? (
            <EditorScreen key={editorKey(editor)} target={editor} expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} onClose={() => { setExpanded(false); closeEditor(); }} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>🗒️</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>Select a note, or press ✎ to write one</Text>
            </View>
          )}
        </View>
        <AlarmScreen />
      </View>
    );
  }

  const tabs = [
    { key: 'all', icon: '🗒️', label: 'Notes', active: view.kind === 'all' || view.kind === 'folder', go: () => useStore.getState().setView({ kind: 'all' }) },
    { key: 'reminders', icon: '⏰', label: 'Reminders', active: view.kind === 'reminders', go: () => useStore.getState().setView({ kind: 'reminders' }) },
    { key: 'settings', icon: '⚙️', label: 'Settings', active: view.kind === 'settings', go: () => useStore.getState().setView({ kind: 'settings' }) },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>{content}</View>
      <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: t.card, borderTopColor: t.border }]}>
        <View style={{ flexDirection: 'row' }}>
          {tabs.map(item => (
            <Pressable key={item.key} onPress={item.go} style={styles.tabItem}>
              <Text style={{ fontSize: 19, opacity: item.active ? 1 : 0.45 }}>{item.icon}</Text>
              <Text style={{ color: item.active ? t.accent : t.muted, fontSize: 11, marginTop: 2, fontWeight: item.active ? '600' : '400' }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SafeAreaView style={{ width: 260, backgroundColor: t.sidebar }}>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </SafeAreaView>
          <Pressable style={styles.scrim} onPress={() => setDrawer(false)} />
        </View>
      </Modal>

      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
        {editor ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
            <EditorScreen key={editorKey(editor)} target={editor} />
          </SafeAreaView>
        ) : null}
      </Modal>

      <AlarmScreen />
    </SafeAreaView>
  );
}

function editorKey(editor: NonNullable<ReturnType<typeof useStore.getState>['editor']>): string {
  return editor.kind === 'existing' ? editor.id : `new-${editor.listId ?? ''}-${editor.asReminder}`;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
