import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import type { Tab } from '../types';
import { EditorScreen } from './EditorScreen';
import { ListsScreen } from './ListsScreen';
import { NotesScreen } from './NotesScreen';
import { RemindersScreen } from './RemindersScreen';
import { SettingsScreen } from './SettingsScreen';
import { isMac, useTheme } from './theme';

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: 'reminders', label: 'Reminders', icon: '⏰' },
  { value: 'notes', label: 'Notes', icon: '📝' },
  { value: 'lists', label: 'Lists', icon: '📂' },
  { value: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Shell() {
  const t = useTheme();
  const tab = useStore(s => s.tab);
  const setTab = useStore(s => s.setTab);
  const editor = useStore(s => s.editor);

  const content = tab === 'notes' ? <NotesScreen /> : tab === 'lists' ? <ListsScreen /> : tab === 'settings' ? <SettingsScreen /> : <RemindersScreen />;

  if (isMac) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
        <View style={[styles.sidebar, { backgroundColor: t.sidebar, borderRightColor: t.border }]}>
          <Text style={[styles.brand, { color: t.text }]}>Recall</Text>
          {TABS.map(item => (
            <Pressable key={item.value} onPress={() => setTab(item.value)} style={[styles.sideItem, tab === item.value && { backgroundColor: t.sidebarActive }]}>
              <Text style={{ fontSize: 15 }}>{item.icon}</Text>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: tab === item.value ? '600' : '400', marginLeft: 10 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }}>{content}</View>
        {editor ? (
          <View style={[styles.macEditor, { backgroundColor: t.bg, borderLeftColor: t.border }]}>
            <EditorScreen key={editorKey(editor)} target={editor} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>{content}</View>
      <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: t.card, borderTopColor: t.border }]}>
        <View style={{ flexDirection: 'row' }}>
          {TABS.map(item => (
            <Pressable key={item.value} onPress={() => setTab(item.value)} style={styles.tabItem}>
              <Text style={{ fontSize: 20, opacity: tab === item.value ? 1 : 0.5 }}>{item.icon}</Text>
              <Text style={{ color: tab === item.value ? t.accent : t.muted, fontSize: 11, marginTop: 2 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
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
  return editor.kind === 'existing' ? editor.id : `new-${editor.listId ?? ''}-${editor.asReminder}`;
}

const styles = StyleSheet.create({
  sidebar: { width: 200, paddingTop: 40, paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 18, fontWeight: '800', paddingHorizontal: 10, marginBottom: 14 },
  sideItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  macEditor: { width: 420, borderLeftWidth: StyleSheet.hairlineWidth },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
});
