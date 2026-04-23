import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from './theme';

export type TabKey = 'home' | 'capture' | 'survey' | 'info';

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
};

const TABS: { key: TabKey; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'message-circle', label: 'Chat' },
  { key: 'capture', icon: 'camera', label: 'Capture' },
  { key: 'survey', icon: 'clipboard', label: 'Survey' },
  { key: 'info', icon: 'info', label: 'About' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <View style={styles.root}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Feather
              name={tab.icon}
              size={26}
              color={isActive ? theme.accent : theme.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    backgroundColor: theme.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingTop: 10,
    paddingBottom: 18,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});
