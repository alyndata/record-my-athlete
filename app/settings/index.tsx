import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { useStore } from '../../src/store/StoreContext';
import { colors, font, radius, spacing } from '../../src/theme';

const MIN = 1;
const MAX = 10;

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(MIN, value - 1))}
          hitSlop={8}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}s</Text>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(MAX, value + 1))}
          hitSlop={8}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { data, updateSettings } = useStore();
  const { preBufferSec, postBufferSec } = data.settings;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={styles.title}>Favorite clip length</Text>
        <Text style={styles.subtitle}>
          When you tap the ★ button while recording, this much video is saved around that moment.
        </Text>
        <Stepper
          label="Seconds before"
          value={preBufferSec}
          onChange={(v) => updateSettings({ preBufferSec: v })}
        />
        <Stepper
          label="Seconds after"
          value={postBufferSec}
          onChange={(v) => updateSettings({ postBufferSec: v })}
        />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Each clip</Text>
          <Text style={styles.totalValue}>{preBufferSec + postBufferSec}s long</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.small, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  stepLabel: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 24, color: colors.primary, fontWeight: '700' },
  stepValue: { fontSize: font.body, fontWeight: '700', color: colors.text, minWidth: 40, textAlign: 'center' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: font.body, color: colors.muted },
  totalValue: { fontSize: font.body, fontWeight: '700', color: colors.primary },
});
