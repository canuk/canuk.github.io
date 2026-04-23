import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from './theme';

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.sideSpace} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        style={styles.gear}
        onPress={() => Alert.alert('Settings', 'Settings screen not implemented in this demo.')}
        accessibilityLabel="Open settings"
      >
        <Feather name="settings" size={22} color={theme.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: theme.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  sideSpace: { width: 36 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
