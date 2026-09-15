import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useItems, useLists, useStore } from '../store/useStore';
import { LIST_COLORS, type View as AppView } from '../types';
import { Input } from './common';
import { useTheme } from './theme';

function sameView(a: AppView, b: AppView): boolean {
  return a.kind === b.kind && ('id' in a && 'id' in b ? a.id === b.id : true);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTheme();
  const items = useItems();
  const folders = useLists();
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const createList = useStore(s => s.createList);
  const deleteList = useStore(s => s.deleteList);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);

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

  const NavItem = ({ v, icon, label, count, color: dot, onLongPress }: { v: AppView; icon?: string; label: string; count?: number; color?: string; onLongPress?: () => void }) => {
    const active = sameView(view, v);
    return (
      <Pressable
        onPress={() => go(v)}
        onLongPress={onLongPress}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.nav,
          { backgroundColor: active ? t.selected : pressed || hovered ? t.hover : 'transparent' },
        ]}>
        {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : <Text style={styles.icon}>{icon}</Text>}
        <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: active ? '600' : '400' }}>
          {label}
        </Text>
        {count ? <Text style={{ color: t.muted, fontSize: 12 }}>{count}</Text> : null}
      </Pressable>
    );
  };

  const reminders = items.filter(i => i.due_at && !i.is_completed).length;

  return (
    <View style={[styles.sidebar, { backgroundColor: t.sidebar, borderRightColor: t.border }]}>
      <ScrollView contentContainerStyle={{ paddingTop: 34, paddingBottom: 16 }}>
        <Text style={[styles.groupLabel, { color: t.muted }]}>RECALL</Text>
        <NavItem v={{ kind: 'all' }} icon="🗒️" label="All Notes" count={items.length} />
        <NavItem v={{ kind: 'reminders' }} icon="⏰" label="Reminders" count={reminders} />

        <View style={styles.groupRow}>
          <Text style={[styles.groupLabel, { color: t.muted, paddingHorizontal: 0 }]}>FOLDERS</Text>
          <Pressable onPress={() => setAdding(a => !a)} hitSlop={8}>
            <Text style={{ color: t.muted, fontSize: 16 }}>{adding ? '×' : '＋'}</Text>
          </Pressable>
        </View>
        {adding ? (
          <View style={{ paddingHorizontal: 10, paddingBottom: 8 }}>
            <Input placeholder="Folder name" value={name} onChangeText={setName} autoFocus onSubmitEditing={submit} returnKeyType="done" style={{ paddingVertical: 7, fontSize: 14 }} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {LIST_COLORS.map(c => (
                <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c, borderWidth: color === c ? 2 : 0, borderColor: t.text }]} />
              ))}
            </View>
          </View>
        ) : null}
        {folders.map(f => (
          <NavItem
            key={f.id}
            v={{ kind: 'folder', id: f.id }}
            color={f.color}
            label={f.name}
            count={items.filter(i => i.list_id === f.id).length}
            onLongPress={() => deleteList(f.id)}
          />
        ))}
        {folders.length === 0 && !adding ? <Text style={{ color: t.muted, fontSize: 12, paddingHorizontal: 16, paddingVertical: 6 }}>Tap ＋ to add a folder</Text> : null}

        <View style={{ height: 14 }} />
        <NavItem v={{ kind: 'settings' }} icon="⚙️" label="Settings" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 210, borderRightWidth: StyleSheet.hairlineWidth },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 16, paddingBottom: 6 },
  nav: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 7 },
  icon: { fontSize: 13, width: 22 },
  dot: { width: 9, height: 9, borderRadius: 5, marginLeft: 4, marginRight: 9 },
  swatch: { width: 22, height: 22, borderRadius: 11, marginRight: 8, marginBottom: 8 },
});
