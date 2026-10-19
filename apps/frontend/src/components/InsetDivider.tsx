import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';

interface InsetDividerProps {
  inset: number;
}

export const InsetDivider: React.FC<InsetDividerProps> = ({ inset }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{ height: 1, marginLeft: inset, backgroundColor: colors.surfaceContainerLow }}
    />
  );
};
