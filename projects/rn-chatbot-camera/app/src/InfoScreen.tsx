import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radius } from './theme';

const FACTS = [
  {
    icon: 'smartphone' as const,
    iconSet: 'feather' as const,
    title: 'Platform',
    body: 'React Native + Expo (managed workflow)',
  },
  {
    icon: 'layers' as const,
    iconSet: 'feather' as const,
    title: 'SDK',
    body: 'Expo SDK 52, TypeScript (strict)',
  },
  {
    icon: 'camera' as const,
    iconSet: 'feather' as const,
    title: 'Camera',
    body: 'expo-camera v16',
  },
  {
    icon: 'android' as const,
    iconSet: 'material' as const,
    title: 'Target',
    body: 'Android APK via EAS Build, sideloaded on a Chromebook',
  },
];

export default function InfoScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>About this demo</Text>
        <Text style={styles.body}>
          A minimal sample app built to exercise the Android APK pipeline. Every tab is a
          placeholder — the goal is packaging and sideloading, not a shipping product.
        </Text>
      </View>

      {FACTS.map((fact) => (
        <View key={fact.title} style={styles.factCard}>
          <View style={styles.factIcon}>
            {fact.iconSet === 'feather' ? (
              <Feather name={fact.icon as keyof typeof Feather.glyphMap} size={22} color={theme.accent} />
            ) : (
              <MaterialCommunityIcons
                name={fact.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={22}
                color={theme.accent}
              />
            )}
          </View>
          <View style={styles.factText}>
            <Text style={styles.factTitle}>{fact.title}</Text>
            <Text style={styles.factBody}>{fact.body}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 12 },
  headerCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.textPrimary,
  },
  factCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  factIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factText: { flex: 1 },
  factTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  factBody: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
