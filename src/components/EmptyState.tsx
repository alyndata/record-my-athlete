import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

export function EmptyState({
  icon = '🏀',
  title,
  message,
}: {
  icon?: string;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: { fontSize: 44, marginBottom: spacing.md },
  title: {
    fontSize: font.h3,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: font.small,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
