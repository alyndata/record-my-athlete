import { Link, useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { useGamesWithSummary } from '../src/store/selectors';
import { colors, font, radius, spacing } from '../src/theme';
import { formatGameDate } from '../src/util/format';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const games = useGamesWithSummary();

  return (
    <View style={styles.container}>
      <FlatList
        data={games}
        keyExtractor={(item) => item.game.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Games</Text>
            <View style={styles.headerLinks}>
              <Link href="/athletes" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.link}>Athletes</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.link}>Settings</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No games yet"
            message="Tap “New Game” to set up your first game, then start recording and tagging stats."
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/games/${item.game.id}`)}>
            <Card style={styles.gameCard}>
              <View style={styles.gameTop}>
                <Text style={styles.athleteName}>
                  {item.athlete?.name ?? 'Unknown athlete'}
                  {item.athlete?.jersey ? ` · #${item.athlete.jersey}` : ''}
                </Text>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsBadgeText}>{item.stats.points} pts</Text>
                </View>
              </View>
              <Text style={styles.matchup}>
                {item.game.opponent ? `vs ${item.game.opponent}` : 'Game'}
              </Text>
              <Text style={styles.meta}>
                {formatGameDate(item.game.date)}
                {item.clipCount > 0 ? `  ·  ${item.clipCount} highlight${item.clipCount === 1 ? '' : 's'}` : ''}
              </Text>
            </Card>
          </Pressable>
        )}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="+ New Game" onPress={() => router.push('/games/new')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heading: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  headerLinks: { flexDirection: 'row', gap: spacing.lg },
  link: { color: colors.primary, fontWeight: '700', fontSize: font.body },
  gameCard: { marginBottom: spacing.md },
  gameTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  athleteName: { fontSize: font.h3, fontWeight: '700', color: colors.text, flex: 1 },
  pointsBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  pointsBadgeText: { color: colors.white, fontWeight: '700', fontSize: font.small },
  matchup: { fontSize: font.body, color: colors.text, marginTop: spacing.sm },
  meta: { fontSize: font.small, color: colors.muted, marginTop: spacing.xs },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
