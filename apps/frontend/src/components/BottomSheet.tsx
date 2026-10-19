import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, children }) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.dimArea}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  dimArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 9999,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
});
