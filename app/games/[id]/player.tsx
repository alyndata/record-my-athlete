import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { computeStats } from '../../../src/domain/stats';
import { COUNTER_STATS, SHOT_KINDS } from '../../../src/domain/statTypes';
import { useStore } from '../../../src/store/StoreContext';
import { useClip, useVideo } from '../../../src/store/selectors';
import { Clip, StatType, Video } from '../../../src/store/types';
import { colors, font, radius, spacing } from '../../../src/theme';
import { formatDuration } from '../../../src/util/format';
import { resolveVideoUri, shareClip, shareVideo } from '../../../src/util/videoStorage';

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
  const { data, addClip, updateClip, addStatEvent, deleteStatEvent } = useStore();

  const startSec = clip ? clip.startMs / 1000 : 0;
  const endSec = clip ? clip.endMs / 1000 : undefined;

  const seekedRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Stat tagging while watching (full-video view).
  const [tracking, setTracking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // Live tally of stats already tagged on this video.
  const videoStats = useMemo(
    () => computeStats(data.statEvents.filter((e) => e.videoId === video.id)),
    [data.statEvents, video.id],
  );

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

  const exportClip = async () => {
    if (!clip || exporting) return;
    setExporting(true);
    setExportNote('Trimming clip… (first time downloads a video tool)');
    const name = `${(clip.label ?? 'Highlight').replace(/[^\w-]+/g, '_')}.mp4`;
    try {
      const trimmed = await shareClip(video.uri, clip.startMs, clip.endMs, name);
      setExportNote(
        trimmed ? null : "Couldn't trim in this browser — shared the full video instead."
      );
    } catch {
      setExportNote('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const flashLabel = (text: string) => {
    setFlash(text);
    setTimeout(() => setFlash((cur) => (cur === text ? null : cur)), 900);
  };

  const tagStat = (type: StatType, label: string) => {
    const timeMs = Math.max(0, (player?.currentTime ?? 0) * 1000);
    // Pause so you can tag precisely; resume with the video's play control.
    player?.pause();
    const ev = addStatEvent({ gameId: video.gameId, videoId: video.id, type, videoTimeMs: timeMs });
    setLastEventId(ev.id);
    flashLabel(label);
  };

  const undoLastStat = () => {
    if (!lastEventId) return;
    deleteStatEvent(lastEventId);
    setLastEventId(null);
    flashLabel('Removed last stat');
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

  const trackToggle = (
    <Button
      title={tracking ? 'Hide stats' : '📊 Track stats'}
      variant="secondary"
      style={{ flex: 1 }}
      onPress={() => setTracking((t) => !t)}
      disabled={missingFile}
    />
  );

  const trackerPad = tracking ? (
    <View style={styles.tracker}>
      <View style={styles.trackerHead}>
        <Text style={styles.tally}>
          {videoStats.points} pts · {videoStats.rebounds} reb · {videoStats.assists} ast
        </Text>
        {lastEventId ? (
          <Pressable onPress={undoLastStat} hitSlop={8}>
            <Text style={styles.undo}>↶ Undo</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.trackerHint}>
        Tagging pauses the video at that moment — press play to keep watching.
      </Text>

      {SHOT_KINDS.map((kind) => (
        <View key={kind.key} style={styles.shotRow}>
          <Text style={styles.shotLabel}>{kind.short}</Text>
          <Pressable
            onPress={() => tagStat(kind.madeType, `✓ Made ${kind.short}`)}
            style={[styles.shotBtn, styles.madeBtn]}
          >
            <Text style={styles.shotBtnText}>✓ Made</Text>
          </Pressable>
          <Pressable
            onPress={() => tagStat(kind.missedType, `✗ Missed ${kind.short}`)}
            style={[styles.shotBtn, styles.missBtn]}
          >
            <Text style={styles.shotBtnText}>✗ Miss</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.counterRow}>
        {COUNTER_STATS.map((c) => (
          <Pressable
            key={c.type}
            onPress={() => tagStat(c.type, `+1 ${c.label}`)}
            style={styles.counterBtn}
          >
            <Text style={styles.counterBtnText}>+1 {c.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  ) : null;

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
        {flash ? (
          <View style={styles.flashWrap} pointerEvents="none">
            <Text style={styles.flashText}>{flash}</Text>
          </View>
        ) : null}
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
            {canShare ? (
              <Button
                title={exporting ? 'Preparing clip…' : '⬆︎ Save / Share clip'}
                onPress={exportClip}
                disabled={exporting || missingFile}
              />
            ) : null}
            {exportNote ? <Text style={styles.note}>{exportNote}</Text> : null}
            {trackToggle}
            {trackerPad}
          </>
        ) : (
          <>
            <Text style={styles.meta}>
              Watching the full video. Tag stats as you watch, and save the best moments.
            </Text>

            <View style={styles.row}>
              <Button
                title={creating ? '★ Saved!' : '★ Clip this moment'}
                style={{ flex: 1 }}
                onPress={clipThisMoment}
                disabled={creating || missingFile}
              />
              {trackToggle}
            </View>

            {trackerPad}

            <Pressable onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backText}>Done</Text>
            </Pressable>
          </>
        )}

        {canShare && !clip ? (
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
  note: { fontSize: font.small, color: colors.muted, lineHeight: 18, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: spacing.md },
  back: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { color: colors.primary, fontWeight: '700', fontSize: font.body },

  flashWrap: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' },
  flashText: {
    color: colors.white,
    fontSize: font.h3,
    fontWeight: '800',
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  tracker: { gap: spacing.sm },
  trackerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tally: { color: colors.text, fontWeight: '800', fontSize: font.body },
  undo: { color: colors.primary, fontWeight: '700', fontSize: font.small },
  trackerHint: { color: colors.muted, fontSize: font.small, marginBottom: spacing.xs },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shotLabel: { width: 40, color: colors.text, fontWeight: '800', fontSize: font.body },
  shotBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  madeBtn: { backgroundColor: colors.success },
  missBtn: { backgroundColor: colors.danger },
  shotBtnText: { color: colors.white, fontWeight: '800', fontSize: font.body },
  counterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  counterBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  counterBtnText: { color: colors.white, fontWeight: '800', fontSize: font.body },
});
