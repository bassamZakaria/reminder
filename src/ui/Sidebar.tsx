import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLists, useNotes, useReminders, useStore } from '../store/useStore';
import { LIST_COLORS, ViewKind, type List, type View as AppView } from '../types';
import { ActionMenu, Input, PromptSheet } from './common';
import { isMac, useTheme } from './theme';

function sameView(a: AppView, b: AppView): boolean {
  return a.kind === b.kind && ('id' in a && 'id' in b ? a.id === b.id : true);
}

function NavItem({
  active,
  icon,
  label,
  count,
  alert,
  color,
  onPress,
  onLongPress,
  testID,
}: {
  active: boolean;
  icon?: string;
  label: string;
  count?: number;
  alert?: number;
  color?: string;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.nav,
        { backgroundColor: active ? t.selected : pressed || hovered ? t.hover : 'transparent' },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : <Text style={styles.icon}>{icon}</Text>}
      <Text numberOfLines={1} style={[styles.navLabel, { color: t.text, fontWeight: active ? '700' : '500' }]}>
        {label}
      </Text>
      {alert ? (
        <View style={[styles.alert, { backgroundColor: t.danger }]}>
          <Text style={styles.alertText}>{alert}</Text>
        </View>
      ) : null}
      {count ? <Text style={[styles.count, { color: t.muted }]}>{count}</Text> : null}
    </Pressable>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTheme();
  const notes = useNotes();
  const reminders = useReminders();
  const folders = useLists();
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const createList = useStore(s => s.createList);
  const updateList = useStore(s => s.updateList);
  const deleteList = useStore(s => s.deleteList);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [menuFolder, setMenuFolder] = useState<List | null>(null);
  const [renaming, setRenaming] = useState<List | null>(null);
  const insets = useSafeAreaInsets();

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const n of notes) {
      if (n.list_id) {
        out[n.list_id] = (out[n.list_id] ?? 0) + 1;
      }
    }
    return out;
  }, [notes]);
  const openReminders = useMemo(() => reminders.filter(r => !r.is_completed), [reminders]);
  const overdue = useMemo(() => {
    const now = Date.now();
    return openReminders.filter(r => new Date(r.due_at).getTime() < now).length;
  }, [openReminders]);

  const go = (v: AppView) => {
    setView(v);
    onNavigate?.();
  };

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
    await createList(name.trim(), color);
    setName('');
    setAdding(false);
  };

  const confirmDelete = (f: List) => {
    Alert.alert(`Delete “${f.name}”?`, 'Notes in this folder are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Folder', style: 'destructive', onPress: () => deleteList(f.id) },
    ]);
  };

  return (
    <View style={[styles.sidebar, { backgroundColor: t.sidebar, borderRightColor: t.border }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: isMac ? 34 : insets.top + 12, paddingBottom: insets.bottom + 16 }}>
        {!isMac ? <Text style={[styles.brand, { color: t.text }]}>Recall</Text> : null}
        <NavItem testID="nav-reminders" active={sameView(view, { kind: ViewKind.Reminders })} icon="⏰" label="Reminders" count={openReminders.length} alert={overdue} onPress={() => go({ kind: ViewKind.Reminders })} />
        <NavItem testID="nav-notes" active={sameView(view, { kind: ViewKind.Notes })} icon="🗒️" label="Notes" count={notes.length} onPress={() => go({ kind: ViewKind.Notes })} />

        <View style={styles.groupRow}>
          <Text style={[styles.groupLabel, { color: t.muted }]}>FOLDERS</Text>
          <Pressable testID="add-folder" accessibilityRole="button" accessibilityLabel={adding ? 'Cancel new folder' : 'New folder'} onPress={() => setAdding(a => !a)} hitSlop={10}>
            <Text style={[styles.groupAction, { color: t.accent }]}>{adding ? 'Cancel' : '＋ New'}</Text>
          </Pressable>
        </View>
        {adding ? (
          <View style={styles.addBox}>
            <Input testID="folder-name" placeholder="Folder name" value={name} onChangeText={setName} autoFocus onSubmitEditing={submit} returnKeyType="done" style={styles.addInput} />
            <View style={styles.swatches}>
              {LIST_COLORS.map(c => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: color === c }}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c, borderWidth: color === c ? 2 : 0, borderColor: t.text }]}
                />
              ))}
            </View>
            <Pressable testID="folder-create" accessibilityRole="button" disabled={!name.trim()} onPress={submit} style={[styles.createButton, { backgroundColor: t.accent, opacity: name.trim() ? 1 : 0.4 }]}>
              <Text style={styles.createText}>Create folder</Text>
            </Pressable>
          </View>
        ) : null}
        {folders.map(f => (
          <NavItem
            key={f.id}
            testID={`folder-${f.name}`}
            active={sameView(view, { kind: ViewKind.Folder, id: f.id })}
            color={f.color}
            label={f.name}
            count={counts[f.id]}
            onPress={() => go({ kind: ViewKind.Folder, id: f.id })}
            onLongPress={() => setMenuFolder(f)}
          />
        ))}
        {folders.length === 0 && !adding ? <Text style={[styles.hint, { color: t.muted }]}>Group notes into folders like Work or Home.</Text> : null}
        {folders.length > 0 ? <Text style={[styles.hint, { color: t.muted }]}>{isMac ? 'Long-click' : 'Long-press'} a folder to rename or delete it.</Text> : null}

        <View style={styles.spacer} />
        <NavItem testID="nav-settings" active={sameView(view, { kind: ViewKind.Settings })} icon="⚙️" label="Settings" onPress={() => go({ kind: ViewKind.Settings })} />
      </ScrollView>

      <ActionMenu
        visible={!!menuFolder}
        title={menuFolder?.name}
        onClose={() => setMenuFolder(null)}
        actions={
          menuFolder
            ? [
                { label: 'Rename', icon: '✎', onPress: () => setRenaming(menuFolder) },
                { label: 'Delete Folder', icon: '🗑', destructive: true, onPress: () => confirmDelete(menuFolder) },
              ]
            : []
        }
      />
      <PromptSheet
        visible={!!renaming}
        title="Rename folder"
        initialValue={renaming?.name ?? ''}
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={value => {
          if (renaming) {
            updateList(renaming.id, { name: value });
          }
          setRenaming(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { flex: 1, width: isMac ? 220 : undefined, borderRightWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 28, fontWeight: '800', paddingHorizontal: 18, paddingBottom: 14, letterSpacing: -0.5 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  groupAction: { fontSize: 13, fontWeight: '600' },
  nav: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, paddingVertical: isMac ? 7 : 11, paddingHorizontal: 10, borderRadius: 9 },
  navLabel: { flex: 1, fontSize: isMac ? 14 : 16 },
  count: { fontSize: 13 },
  alert: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  alertText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  icon: { fontSize: 14, width: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 3, marginRight: 11 },
  addBox: { paddingHorizontal: 12, paddingBottom: 10 },
  addInput: { paddingVertical: 8, fontSize: 15 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  swatch: { width: 24, height: 24, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  createButton: { borderRadius: 9, paddingVertical: 9, alignItems: 'center', marginTop: 2 },
  createText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { fontSize: 12, paddingHorizontal: 18, paddingVertical: 6, lineHeight: 17 },
  spacer: { height: 18 },
});
