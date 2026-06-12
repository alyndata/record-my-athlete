import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GameStats } from '../domain/stats';
import { colors, font, radius, spacing } from '../theme';
import { pct } from '../util/format';

function Line({ label, made, attempts }: { label: string; made: number; attempts: number }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>
        {made}/{attempts}
      </Text>
      <Text style={styles.linePct}>{pct(made, attempts)}</Text>
    </View>
  );
}

export function StatSummary({ stats }: { stats: GameStats }) {
  return (
    <View>
      <View style={styles.pointsRow}>
        <Text style={styles.pointsValue}>{stats.points}</Text>
        <Text style={styles.pointsLabel}>POINTS</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.header}>
          <Text style={[styles.lineLabel, styles.headerText]}>Shot</Text>
          <Text style={[styles.lineValue, styles.headerText]}>M/A</Text>
          <Text style={[styles.linePct, styles.headerText]}>%</Text>
        </View>
        <Line label="Free Throws" made={stats.ft.made} attempts={stats.ft.attempts} />
        <Line label="2-Pointers" made={stats.fg2.made} attempts={stats.fg2.attempts} />
        <Line label="3-Pointers" made={stats.fg3.made} attempts={stats.fg3.attempts} />
        <Line label="Field Goals" made={stats.fg.made} attempts={stats.fg.attempts} />
      </View>
      <View style={styles.counters}>
        <View style={styles.counterBox}>
          <Text style={styles.counterValue}>{stats.rebounds}</Text>
          <Text style={styles.counterLabel}>REBOUNDS</Text>
        </View>
        <View style={styles.counterBox}>
          <Text style={styles.counterValue}>{stats.assists}</Text>
          <Text style={styles.counterLabel}>ASSISTS</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointsRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
  },
  pointsLabel: {
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.muted,
  },
  table: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    color: colors.subtle,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  line: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineLabel: { flex: 2, fontSize: font.small, color: colors.text, fontWeight: '600' },
  lineValue: { flex: 1, fontSize: font.small, color: colors.text, textAlign: 'center' },
  linePct: { flex: 1, fontSize: font.small, color: colors.muted, textAlign: 'right' },
  counters: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  counterBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  counterValue: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  counterLabel: {
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
    marginTop: 2,
  },
});
