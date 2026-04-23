import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme, radius } from './theme';

type SurveyStep = {
  step: string;
  title: string;
  body: string;
  cta: string;
  url: string;
};

const STEPS: SurveyStep[] = [
  {
    step: 'Step 1',
    title: 'Before Experiment',
    body: 'Complete this before you start the experiment.',
    cta: 'Open Pre-Experiment Survey',
    url: 'https://example.com/survey/pre',
  },
  {
    step: 'Step 2',
    title: 'After Experiment',
    body: 'Complete this after you finish the experiment.',
    cta: 'Open Post-Experiment Survey',
    url: 'https://example.com/survey/post',
  },
];

async function openUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open link', url);
      return;
    }
    await Linking.openURL(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    Alert.alert('Failed to open link', message);
  }
}

export default function SurveyScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Class Surveys</Text>
        <Text style={styles.subtitle}>Please complete both surveys.</Text>
      </View>

      {STEPS.map((s) => (
        <View key={s.step} style={styles.stepCard}>
          <View style={styles.stepTitleRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{s.step}</Text>
            </View>
            <Text style={styles.stepTitle}>{s.title}</Text>
          </View>
          <Text style={styles.stepBody}>{s.body}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            onPress={() => openUrl(s.url)}
          >
            <Feather name="external-link" size={18} color="#ffffff" />
            <Text style={styles.primaryText}>{s.cta}</Text>
          </Pressable>
          <Text style={styles.helperText}>Opens in your browser</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 16 },
  headerCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  stepCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stepBadgeText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  stepBody: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  helperText: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 13,
  },
});
