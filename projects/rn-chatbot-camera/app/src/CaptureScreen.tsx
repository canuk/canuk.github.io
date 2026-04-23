import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radius } from './theme';

type Props = {
  onOpenCamera: () => void;
};

type StepIcon = {
  set: 'feather';
  name: keyof typeof Feather.glyphMap;
} | {
  set: 'material';
  name: keyof typeof MaterialCommunityIcons.glyphMap;
};

const STEPS: { icon: StepIcon; label: string; active: boolean }[] = [
  { icon: { set: 'feather', name: 'camera' }, label: 'Capture', active: true },
  { icon: { set: 'material', name: 'crop-square' }, label: 'Adjust', active: false },
  { icon: { set: 'feather', name: 'file-text' }, label: 'Report', active: false },
];

function StepIconRenderer({ icon, color }: { icon: StepIcon; color: string }) {
  if (icon.set === 'feather') {
    return <Feather name={icon.name} size={16} color={color} />;
  }
  return <MaterialCommunityIcons name={icon.name} size={16} color={color} />;
}

export default function CaptureScreen({ onOpenCamera }: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Sample Capture</Text>
        <Text style={styles.body}>
          Take a picture of your sample, adjust the frame, and generate a report for analysis.
        </Text>
      </View>

      <View style={styles.stepsRow}>
        {STEPS.map((step, idx) => {
          const color = step.active ? theme.accent : theme.textMuted;
          const bg = step.active ? theme.accentSoft : theme.inputBg;
          return (
            <React.Fragment key={step.label}>
              <View style={[styles.pill, { backgroundColor: bg }]}>
                <StepIconRenderer icon={step.icon} color={color} />
                <Text style={[styles.pillText, { color }]}>{step.label}</Text>
              </View>
              {idx < STEPS.length - 1 && (
                <Feather name="chevron-right" size={18} color={theme.textMuted} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={20}
            color={theme.tipText}
          />
          <Text style={styles.tipTitle}>Quick tips for better photos</Text>
        </View>
        <Text style={styles.tipLine}>
          - Place the subject on a plain, high-contrast background.
        </Text>
        <Text style={styles.tipLine}>
          - Use even lighting and keep shadows off the subject.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        onPress={onOpenCamera}
      >
        <Feather name="camera" size={18} color="#ffffff" />
        <Text style={styles.primaryText}>Take Photo</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
        onPress={() =>
          Alert.alert(
            'Upload Existing Photo',
            'This demo does not implement the photo picker. Tap Take Photo to capture one.'
          )
        }
      >
        <Feather name="image" size={18} color={theme.accent} />
        <Text style={styles.secondaryText}>Upload Existing Photo</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.textPrimary,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipCard: {
    backgroundColor: theme.tipBg,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.tipBorder,
    gap: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.tipText,
  },
  tipLine: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.accentSoftAlt,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
