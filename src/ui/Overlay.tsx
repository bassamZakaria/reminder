import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { isMac } from './theme';

export enum OverlayAnimation {
  Fade = 'fade',
  Slide = 'slide',
  None = 'none',
}

// react-native-macos has no Modal host view under the new architecture, so on Mac the overlay is
// drawn inline over its parent. Render it as the last child of a screen-level container.
export function Overlay({
  visible,
  transparent = true,
  animationType = OverlayAnimation.Fade,
  onRequestClose,
  children,
}: {
  visible: boolean;
  transparent?: boolean;
  animationType?: OverlayAnimation;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  if (isMac) {
    return visible ? <View style={styles.inline}>{children}</View> : null;
  }
  return (
    <Modal visible={visible} transparent={transparent} animationType={animationType} onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  inline: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
});
