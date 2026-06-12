import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState } from '../../../src/components/EmptyState';
import { StatSummary } from '../../../src/components/StatSummary';
import { useStore } from '../../../src/store/StoreContext';
import {
  useAthlete,
  useGame,
  useGameClips,
  useGameStats,
  useGameVideos,
} from '../../../src/store/selectors';
import { colors, font, radius, spacing } from '../../../src/theme';
import { formatDuration, formatGameDate } from '../../../src/util/format';
import { deleteVideoFile, persistVideo } from '../../../src/util/videoStorage';

type Tab = 'clips' | 'videos';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addVideo, deleteVideo, deleteGame, updateClip, deleteClip } = useStore();

  const game = useGame(id);
  const athlete = useAthlete(game?.athleteId);
  const stats = useGameStats(id);
  const videos = useGameVideos(id);
  const clips = useGameClips(id);

  const [tab, setTab] = useState<Tab>('clips');
  const [importing, setImporting] = useState(false);
  const [showWatched, setShowWatched] = useState(true);

  if (!game) {
    return (
      <View style={styles.container}>
        <EmptyState icon="🤔" title="Game not found" message="It may have been deleted." />
      </View>
    );
  }

  const onImport = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to import videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;

    setImporting(true);
    try {
      for (const asset of result.assets) {
        const uri = await persistVideo(asset.uri);
        addVideo({
          gameId: game.id,
          uri,
          durationMs: asset.duration ?? 0,
          source: 'imported',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const onDeleteGame = () => {
    Alert.alert('Delete game?', 'This removes the game, its videos, stats, and highlights.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          videos.forEach((v) => void deleteVideoFile(v.uri));
          deleteGame(game.id);
          router.back();
        },
      },
    ]);
  };

  const onDeleteVideo = (videoId: string, uri: string) => {
    Alert.alert('Delete video?', 'This also removes its stats and highlight clips.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteVideoFile(uri);
          deleteVideo(videoId);
        },
      },
    ]);
  };

  const visibleClips = showWatched ? clips : clips.filter((c) => !c.watched);
  const watchedCount = clips.filter((c) => c.watched).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: athlete?.name ?? 'Game' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.header}>
          <Text style={styles.matchup}>{game.opponent ? `vs ${game.opponent}` : 'Game'}</Text>
          <Text style={styles.meta}>
            {formatGameDate(game.date)}
            {game.location ? `  ·  ${game.location}` : ''}
          </Text>
        </View>

        <Card style={{ marginBottom: spacing.lg }}>
          <StatSummary stats={stats} />
        </Card>

        <View style={styles.actions}>
          <Button
            title="● Record"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => router.push(`/games/${game.id}/record`)}
          />
          <Button
            title="Import Video"
            variant="secondary"
            style={{ flex: 1 }}
            loading={importing}
            onPress={onImport}
          />
        </View>

        <View style={styles.tabs}>
          <TabButton label={`Highlights (${clips.length})`} active={tab === 'clips'} onPress={() => setTab('clips')} />
          <TabButton label={`Videos (${videos.length})`} active={tab === 'videos'} onPress={() => setTab('videos')} />
        </View>

        {tab === 'clips' ? (
          <View>
            {clips.length > 0 ? (
              <Pressable style={styles.filterRow} onPress={() => setShowWatched((s) => !s)}>
                <Text style={styles.filterText}>
                  {showWatched ? `Showing all · ${watchedCount} watched` : 'Showing unwatched only'}
                </Text>
                <Text style={styles.filterToggle}>{showWatched ? 'Hide watched' : 'Show all'}</Text>
              </Pressable>
            ) : null}
            {visibleClips.length === 0 ? (
              <EmptyState
                icon="⭐"
                title={clips.length === 0 ? 'No highlights yet' : 'All caught up'}
                message={
                  clips.length === 0
                    ? 'Tap the ★ button while recording to save a moment, or open a video and clip it.'
                    : 'You’ve watched every highlight.'
                }
              />
            ) : (
              visibleClips.map((clip) => (
                <Card key={clip.id} style={styles.itemCard}>
                  <Pressable
                    style={styles.itemMain}
                    onPress={() => router.push(`/games/${game.id}/player?clipId=${clip.id}`)}
                  >
                    <View style={styles.thumb}>
                      <Text style={styles.thumbIcon}>{clip.watched ? '✓' : '▶'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{clip.label ?? 'Highlight'}</Text>
                      <Text style={styles.itemMeta}>
                        {formatDuration(clip.endMs - clip.startMs)}
                        {clip.watched ? '  ·  watched' : ''}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.itemActions}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => updateClip(clip.id, { watched: !clip.watched })}
                    >
                      <Text style={styles.actionLink}>
                        {clip.watched ? 'Mark unwatched' : 'Mark watched'}
                      </Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => deleteClip(clip.id)}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : (
          <View>
            {videos.length === 0 ? (
              <EmptyState
                icon="🎥"
                title="No videos yet"
                message="Record a game or import existing videos to get started."
              />
            ) : (
              videos.map((video, idx) => (
                <Card key={video.id} style={styles.itemCard}>
                  <Pressable
                    style={styles.itemMain}
                    onPress={() => router.push(`/games/${game.id}/player?videoId=${video.id}`)}
                  >
                    <View style={styles.thumb}>
                      <Text style={styles.thumbIcon}>▶</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>
                        {video.source === 'imported' ? 'Imported video' : `Recording ${idx + 1}`}
                      </Text>
                      <Text style={styles.itemMeta}>
                        {video.durationMs ? formatDuration(video.durationMs) : 'Tap to play'}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.itemActions}>
                    <Pressable hitSlop={8} onPress={() => onDeleteVideo(video.id, video.uri)}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        <Pressable style={styles.deleteGame} onPress={onDeleteGame}>
          <Text style={styles.deleteGameText}>Delete game</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { marginBottom: spacing.lg },
  matchup: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.small, color: colors.muted, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.muted },
  tabTextActive: { color: colors.white },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  filterText: { fontSize: font.small, color: colors.muted },
  filterToggle: { fontSize: font.small, color: colors.primary, fontWeight: '700' },
  itemCard: { marginBottom: spacing.md, gap: spacing.md },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { color: colors.white, fontSize: 20 },
  itemTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  actionLink: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  deleteLink: { color: colors.danger, fontWeight: '700', fontSize: font.small },
  deleteGame: { alignItems: 'center', marginTop: spacing.xl, padding: spacing.md },
  deleteGameText: { color: colors.danger, fontWeight: '600' },
});
