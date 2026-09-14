import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useItems, useLists, useStore } from '../store/useStore';
import { LIST_COLORS, type List } from '../types';
import { Button, Chip, Empty, Header, IconButton, Input } from './common';
import { ItemRow } from './ItemRow';
import { useTheme } from './theme';

export function ListsScreen() {
  const t = useTheme();
  const lists = useLists();
  const items = useItems();
  const activeListId = useStore(s => s.activeListId);
  const setActiveList = useStore(s => s.setActiveList);
  const createList = useStore(s => s.createList);
  const deleteList = useStore(s => s.deleteList);
  const openEditor = useStore(s => s.openEditor);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);

  const active = activeListId ? lists.find(l => l.id === activeListId) : undefined;

  if (active) {
    const listItems = items.filter(i => i.list_id === active.id).sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || (a.due_at ?? 'z').localeCompare(b.due_at ?? 'z'));
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Header
          title={active.name}
          left={<IconButton label="‹ Lists" onPress={() => setActiveList(null)} />}
          right={
            <>
              <IconButton label="🗑" color={t.danger} onPress={() => confirmDelete(active, () => deleteList(active.id))} />
              <IconButton label="＋" onPress={() => openEditor({ kind: 'new', listId: active.id, asReminder: false })} />
            </>
          }
        />
        <FlatList
          data={listItems}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ItemRow item={item} showList={false} />}
          contentContainerStyle={listItems.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={<Empty title="Empty list" hint="Add notes or reminders to this list." />}
        />
      </View>
    );
  }

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
    await createList(name.trim(), color);
    setName('');
    setAdding(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Lists" right={<IconButton label={adding ? 'Cancel' : '＋'} onPress={() => setAdding(a => !a)} />} />
      {adding ? (
        <View style={[styles.addBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <Input placeholder="List name" value={name} onChangeText={setName} autoFocus onSubmitEditing={submit} returnKeyType="done" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {LIST_COLORS.map(c => (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: t.text }]} />
            ))}
          </View>
          <Button title="Create list" onPress={submit} style={{ marginTop: 6 }} />
        </View>
      ) : null}
      <FlatList
        data={lists}
        keyExtractor={l => l.id}
        contentContainerStyle={lists.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        renderItem={({ item: list }) => {
          const count = items.filter(i => i.list_id === list.id && !i.is_completed).length;
          return (
            <Pressable onPress={() => setActiveList(list.id)} style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? t.cardAlt : t.card, borderBottomColor: t.border }]}>
              <View style={[styles.dot, { backgroundColor: list.color }]} />
              <Text style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '500' }}>{list.name}</Text>
              <Text style={{ color: t.muted, fontSize: 15 }}>{count}</Text>
              <Text style={{ color: t.muted, marginLeft: 10 }}>›</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Empty title="No lists" hint="Create lists like Work, Groceries, Ideas." />}
      />
      {lists.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16 }}>
          {lists.map(l => (
            <Chip key={l.id} label={l.name} color={l.color} active onPress={() => setActiveList(l.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function confirmDelete(list: List, onConfirm: () => void) {
  Alert.alert('Delete list', `Delete "${list.name}"? Items in it are kept.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  addBox: { margin: 16, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  swatch: { width: 30, height: 30, borderRadius: 15, marginRight: 10, marginBottom: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
});
