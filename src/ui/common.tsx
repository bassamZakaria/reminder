import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { Overlay } from './Overlay';
import { isMac, useTheme } from './theme';

export enum ButtonKind {
  Primary = 'primary',
  Ghost = 'ghost',
  Danger = 'danger',
  Secondary = 'secondary',
}

export function Button({
  title,
  onPress,
  kind = ButtonKind.Primary,
  style,
  disabled,
  testID,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  style?: ViewStyle;
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const bg = { [ButtonKind.Primary]: t.accent, [ButtonKind.Danger]: t.danger, [ButtonKind.Ghost]: 'transparent', [ButtonKind.Secondary]: t.input }[kind];
  const color = { [ButtonKind.Primary]: '#fff', [ButtonKind.Danger]: '#fff', [ButtonKind.Ghost]: t.accent, [ButtonKind.Secondary]: t.text }[kind];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }, style]}>
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { ref?: React.Ref<TextInput> }) {
  const t = useTheme();
  return <TextInput placeholderTextColor={t.muted} {...props} style={[styles.input, { backgroundColor: t.input, color: t.text }, props.style]} />;
}

export function Empty({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: t.accentSoft }]}>
          <Text style={styles.emptyGlyph}>{icon}</Text>
        </View>
      ) : null}
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: t.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function IconButton({
  label,
  onPress,
  color,
  size = 18,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  accessibilityLabel: string;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
      <Text style={{ color: color ?? t.accent, fontSize: size, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export interface MenuAction {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function ActionMenu({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: MenuAction[]; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Overlay visible={visible} onRequestClose={onClose}>
      <View style={[styles.menuBackdrop, { backgroundColor: t.scrim, justifyContent: isMac ? 'center' : 'flex-end', paddingBottom: isMac ? 0 : insets.bottom + 10 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={[styles.menu, { backgroundColor: t.card }]}>
          {title ? (
            <Text numberOfLines={1} style={[styles.menuTitle, { color: t.muted, borderBottomColor: t.border }]}>
              {title}
            </Text>
          ) : null}
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                { borderTopColor: t.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? t.hover : 'transparent' },
              ]}>
              {a.icon ? <Text style={styles.menuIcon}>{a.icon}</Text> : null}
              <Text style={[styles.menuLabel, { color: a.destructive ? t.danger : t.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.menu, styles.menuCancel, { backgroundColor: t.card, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.menuLabel, styles.menuCancelText, { color: t.accent }]}>Cancel</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

export function PromptSheet({
  visible,
  title,
  initialValue,
  placeholder,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const t = useTheme();
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);
  const submit = () => value.trim() && onConfirm(value.trim());
  return (
    <Overlay visible={visible} onRequestClose={onCancel}>
      <View style={[styles.promptBackdrop, { backgroundColor: t.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.prompt, { backgroundColor: t.card }]}>
          <Text style={[styles.promptTitle, { color: t.text }]}>{title}</Text>
          <Input autoFocus value={value} onChangeText={setValue} placeholder={placeholder} onSubmitEditing={submit} returnKeyType="done" />
          <View style={styles.promptActions}>
            <Button title="Cancel" kind={ButtonKind.Secondary} onPress={onCancel} style={styles.flex} />
            <Button title={confirmLabel} onPress={submit} disabled={!value.trim()} style={styles.flex} />
          </View>
        </View>
      </View>
    </Overlay>
  );
}

const TOAST_MS = 4500;

export function ToastHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useStore(s => s.toast);
  const dismissToast = useStore(s => s.dismissToast);
  const undoDelete = useStore(s => s.undoDelete);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) {
      return;
    }
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const timer = setTimeout(dismissToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, anim, dismissToast]);

  if (!toast) {
    return null;
  }
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toastWrap, { bottom: insets.bottom + (isMac ? 20 : 90), opacity: anim, transform: [{ translateY }] }]}>
      <View style={[styles.toast, { backgroundColor: t.toast }]} accessibilityLiveRegion="polite">
        <Text numberOfLines={2} style={[styles.toastText, { color: t.toastText }]}>
          {toast.message}
        </Text>
        {toast.undoItem ? (
          <Pressable testID="toast-undo" accessibilityRole="button" onPress={undoDelete} hitSlop={10}>
            <Text style={[styles.toastAction, { color: t.accent }]}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function ErrorBanner() {
  const t = useTheme();
  const error = useStore(s => s.error);
  const clearError = useStore(s => s.clearError);
  const refresh = useStore(s => s.refresh);
  if (!error) {
    return null;
  }
  return (
    <View style={[styles.banner, { backgroundColor: t.dangerSoft }]} accessibilityRole="alert">
      <Text style={[styles.bannerText, { color: t.danger }]} numberOfLines={3}>
        {error}
      </Text>
      <Pressable accessibilityRole="button" onPress={refresh} hitSlop={8}>
        <Text style={[styles.bannerAction, { color: t.danger }]}>Retry</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={clearError} hitSlop={8}>
        <Text style={[styles.bannerAction, { color: t.danger }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '600', fontSize: 15 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  iconButton: { paddingHorizontal: 6, paddingVertical: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyGlyph: { fontSize: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyHint: { marginTop: 6, textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 260 },
  menuBackdrop: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  menu: { width: '100%', maxWidth: 420, borderRadius: 14, overflow: 'hidden' },
  menuTitle: { fontSize: 13, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 16 },
  menuIcon: { fontSize: 16, marginRight: 8 },
  menuLabel: { fontSize: 17 },
  menuCancel: { marginTop: 8, paddingVertical: 15, alignItems: 'center' },
  menuCancelText: { fontWeight: '700' },
  promptBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  prompt: { width: '100%', maxWidth: 360, borderRadius: 16, padding: 18, gap: 12 },
  promptTitle: { fontSize: 17, fontWeight: '700' },
  promptActions: { flexDirection: 'row', gap: 10 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: { flex: 1, fontSize: 14, fontWeight: '500' },
  toastAction: { fontSize: 15, fontWeight: '700', marginLeft: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 6, marginBottom: 4, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, gap: 12 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
  bannerAction: { fontSize: 13, fontWeight: '700' },
});
