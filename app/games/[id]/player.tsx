import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { useStore } from '../../../src/store/StoreContext';
import { useClip, useVideo } from '../../../src/store/selectors';
import { Clip, Video } from '../../../src/store/types';
import { colors, font, radius, spacing } from '../../../src/theme';
import { formatDuration } from '../../../src/util/format';
import { resolveVideoUri, shareVideo } from '../../../src/util/videoStorage';

export default function PlayerScreen() {
  const { clipId, videoId } = useLocalSearchParams<{ clipId?: string; videoId?: string }>();

  const clip = useClip(clipId);
  const directVideo = useVideo(videoId);
  const video = useVideo(clip?.videoId) ?? directVideo;

  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  // Resolve idb:<id> (web blobs) into a playable URL; native URIs pass through.
  useEffect(() => {
    let active = true;
    if (!video?.uri) {
      setResolvedUri(null);
      return;
    }
    resolveVideoUri(video.uri).then((u) => {
      if (active) setResolvedUri(u);
    });
    return () => {
      active = false;
    };
  }, [video?.uri]);

  if (!video) {
    return (
      <View style={styles.container}>
        <EmptyState icon="🎞️" title="Video not found" message="It may have been deleted." />
      </View>
    );
  }

  if (video.uri && !resolvedUri) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  return (
    <PlayerInner
      key={resolvedUri ?? 'empty'}
      uri={resolvedUri ?? ''}
      clip={clip}
      video={video}
      directVideo={directVideo}
    />
  );
}

function PlayerInner({
  uri,
  clip,
  video,
  directVideo,
}: {
  uri: string;
  clip?: Clip;
  video: Video;
  directVideo?: Video;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, addClip, updateClip } = useStore();

  const startSec = clip ? clip.startMs / 1000 : 0;
  const endSec = clip ? clip.endMs / 1000 : undefined;

  const seekedRef = useRef(false);
  const [creating, setCreating] = useState(false);

  const player = useVideoPlayer(uri || null, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.loop = false;
  });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !seekedRef.current) {
        seekedRef.current = true;
        if (clip) player.currentTime = startSec;
        player.play();
      }
    });
    return () => sub.remove();
  }, [player, clip, startSec]);

  useEffect(() => {
    if (!player || endSec === undefined) return;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (currentTime >= endSec) player.pause();
    });
    return () => sub.remove();
  }, [player, endSec]);

  // Revoke object URLs created for web blobs when leaving.
  useEffect(() => {
    return () => {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    };
  }, [uri]);

  const replay = () => {
    if (!player) return;
    player.currentTime = startSec;
    player.play();
  };

  const clipThisMoment = () => {
    if (!player) return;
    setCreating(true);
    const pre = data.settings.preBufferSec * 1000;
    const post = data.settings.postBufferSec * 1000;
    const atMs = player.currentTime * 1000;
    const durationMs = (player.duration || 0) * 1000;
    const startMs = Math.max(0, atMs - pre);
    const endMs = durationMs > 0 ? Math.min(durationMs, atMs + post) : atMs + post;
    const count = data.clips.filter((c) => c.gameId === video.gameId).length + 1;
    addClip({
      gameId: video.gameId,
      videoId: video.id,
      startMs,
      endMs: endMs > startMs ? endMs : startMs + 1000,
      label: `Highlight ${count}`,
    });
    setTimeout(() => setCreating(false), 800);
  };

  const title = useMemo(() => {
    if (clip) return clip.label ?? 'Highlight';
    if (directVideo) return directVideo.source === 'imported' ? 'Imported video' : 'Recording';
    return 'Playback';
  }, [clip, directVideo]);

  const missingFile = !uri;
  const canShare = Platform.OS === 'web' && !missingFile;

  return (
    <View style={styles.container}>
      <View style={styles.videoWrap}>
        {missingFile ? (
          <View style={styles.loading}>
            <Text style={styles.noFile}>No video file for this recording.</Text>
          </View>
        ) : (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            allowsFullscreen
            nativeControls
          />
        )}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title}>{title}</Text>

        {clip ? (
          <>
            <Text style={styles.meta}>
              {formatDuration(clip.endMs - clip.startMs)} highlight
              {clip.watched ? '  ·  watched' : ''}
            </Text>
            <View style={styles.row}>
              <Button
                title="↺ Replay clip"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={replay}
                disabled={missingFile}
              />
              <Button
                title={clip.watched ? 'Mark unwatched' : 'Mark watched'}
                style={{ flex: 1 }}
                onPress={() => updateClip(clip.id, { watched: !clip.watched })}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.meta}>
              Watching the full video. Pause where your athlete shines and save a highlight.
            </Text>
            <Button
              title={creating ? '★ Saved!' : '★ Clip this moment'}
              onPress={clipThisMoment}
              disabled={creating || missingFile}
            />
            <Pressable onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backText}>Done</Text>
            </Pressable>
          </>
        )}

        {canShare ? (
          <Button
            title="⬆︎ Save / Share video"
            variant="secondary"
            onPress={() => shareVideo(video.uri, `${(title || 'game').replace(/[^\w-]+/g, '_')}.mp4`)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noFile: { color: '#CBD5E1', fontSize: font.body, padding: spacing.xl, textAlign: 'center' },
  videoWrap: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.small, color: colors.muted, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.md },
  back: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '700', fontSize: font.body },
});
