import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1 }}>{content}</View>

      <Modal visible={drawer} animationType="slide" transparent onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 272, backgroundColor: t.sidebar, paddingLeft: insets.left }}>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </View>
          <Pressable style={styles.scrim} onPress={() => setDrawer(false)} />
        </View>
      </Modal>

      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
        {editor ? <EditorScreen key={editorKey(editor)} target={editor} /> : null}
      </Modal>

      <AlarmScreen />
    </View>
  );
}

function editorKey(editor: NonNullable<ReturnType<typeof useStore.getState>['editor']>): string {
  return editor.kind === 'existing' ? editor.id : `new-${editor.listId ?? ''}-${editor.asReminder}`;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
});
