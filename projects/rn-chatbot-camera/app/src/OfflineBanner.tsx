import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import { theme } from './theme';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const reachable =
        state.isInternetReachable === null
          ? !!state.isConnected
          : !!state.isInternetReachable;
      setOnline(reachable);
    });
    return () => unsub();
  }, []);

  if (online) return null;

  return (
    <View style={styles.root}>
      <Feather name="wifi-off" size={14} color="#ffffff" />
      <Text style={styles.text}>
        You're offline — chat replies aren't available until the connection is back.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#b45309',
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});
