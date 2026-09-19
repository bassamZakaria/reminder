import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditorKind, useStore, type EditorTarget } from '../store/useStore';
import { ViewKind } from '../types';
import { AlarmScreen } from './AlarmScreen';
import { IconButton, ToastHost } from './common';
import { EditorScreen } from './EditorScreen';
import { NoteList } from './NoteList';
import { SettingsScreen } from './SettingsScreen';
import { Sidebar } from './Sidebar';
import { isMac, useTheme } from './theme';

const DRAWER_WIDTH = 290;

export function Shell() {
  const t = useTheme();
  const view = useStore(s => s.view);
  const editor = useStore(s => s.editor);
  const closeEditor = useStore(s => s.closeEditor);
  const openEditor = useStore(s => s.openEditor);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const menuButton = isMac ? undefined : <IconButton testID="menu" label="☰" size={22} color={t.text} accessibilityLabel="Open folders and settings" onPress={() => setDrawer(true)} />;
  const content = view.kind === ViewKind.Settings ? <SettingsScreen headerLeft={menuButton} /> : <NoteList headerLeft={menuButton} />;

  if (isMac) {
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
              <Text style={styles.placeholderIcon}>🗒️</Text>
              <Text style={[styles.placeholderTitle, { color: t.textSecondary }]}>No note selected</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openEditor({ kind: EditorKind.New, listId: view.kind === ViewKind.Folder ? view.id : null, nonce: Date.now() })}
                style={({ pressed }) => [styles.placeholderButton, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={styles.placeholderButtonText}>＋ New Note</Text>
              </Pressable>
            </View>
          )}
        </View>
        <ToastHost />
        <AlarmScreen />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.bg }]}>
      <View style={styles.flex}>{content}</View>
      <ToastHost />
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
        {editor ? <EditorScreen key={editorKey(editor)} target={editor} /> : null}
      </Modal>
      <AlarmScreen />
    </View>
  );
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [open, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH - insets.left, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.row}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim, opacity: anim }]}>
          <Pressable testID="drawer-scrim" accessibilityLabel="Close menu" style={styles.flex} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.drawer, { width: DRAWER_WIDTH + insets.left, backgroundColor: t.sidebar, paddingLeft: insets.left, transform: [{ translateX }] }]}>
          <Sidebar onNavigate={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function editorKey(editor: NonNullable<EditorTarget>): string {
  return editor.kind === EditorKind.Existing ? editor.id : `new-${editor.nonce}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  listPane: { width: 340, borderRightWidth: StyleSheet.hairlineWidth },
  editorPane: { flex: 1, minWidth: 360 },
  drawer: { height: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 4, height: 0 } },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 48, marginBottom: 10 },
  placeholderTitle: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  placeholderButton: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  placeholderButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
