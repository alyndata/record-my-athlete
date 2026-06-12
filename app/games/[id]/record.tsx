import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../../src/components/Button';
import { computeStats } from '../../../src/domain/stats';
import { COUNTER_STATS, SHOT_KINDS } from '../../../src/domain/statTypes';
import { useStore } from '../../../src/store/StoreContext';
import { useGame } from '../../../src/store/selectors';
import { StatType } from '../../../src/store/types';
import { colors, font, radius, spacing } from '../../../src/theme';
import { formatDuration } from '../../../src/util/format';
import { persistVideo } from '../../../src/util/videoStorage';

interface BufferedStat {
  type: StatType;
  timeMs: number;
}
interface BufferedFavorite {
  timeMs: number;
  index: number;
}

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, addVideo, addStatEvent, addClip } = useStore();
  const game = useGame(id);

  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // The web build can't do native video recording, so it runs a "practice
  // mode": the stat/favorite/timer/pause controls all work for trying out the
  // workflow, but no video file is captured. Real recording is phone-only.
  const isWeb = Platform.OS === 'web';

  // "recording" = a segment is actively capturing.
  const [recording, setRecording] = useState(false);
  // "started" = we've recorded at least one segment this session (so we can resume/finish).
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Live tally across the whole session (for on-screen feedback).
  const [sessionStats, setSessionStats] = useState<StatType[]>([]);
  const [favCount, setFavCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  // Per-segment buffers (refs so the recordAsync continuation sees fresh values).
  const statBufferRef = useRef<BufferedStat[]>([]);
  const favBufferRef = useRef<BufferedFavorite[]>([]);
  const segmentStartRef = useRef(0);
  const recordingRef = useRef(false);
  const favCounterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(data.settings);
  settingsRef.current = data.settings;

  const liveStats = useMemo(
    () => computeStats(sessionStats.map((type) => ({ type } as any))),
    [sessionStats],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const flashLabel = useCallback((text: string) => {
    setFlash(text);
    setTimeout(() => setFlash((cur) => (cur === text ? null : cur)), 900);
  }, []);

  /** Persist a finished segment plus its buffered stats and favorite clips. */
  const finalizeSegment = useCallback(
    async (uri: string | null) => {
      const durationMs = Math.max(0, Date.now() - segmentStartRef.current);
      const stats = [...statBufferRef.current];
      const favs = [...favBufferRef.current];
      statBufferRef.current = [];
      favBufferRef.current = [];

      // On web there's no captured file; store an empty uri (practice mode).
      const storedUri = uri ? await persistVideo(uri) : '';
      const video = addVideo({
        gameId: id,
        uri: storedUri,
        durationMs,
        source: 'recorded',
      });

      for (const s of stats) {
        addStatEvent({ gameId: id, videoId: video.id, type: s.type, videoTimeMs: s.timeMs });
      }

      const pre = settingsRef.current.preBufferSec * 1000;
      const post = settingsRef.current.postBufferSec * 1000;
      for (const fav of favs) {
        const startMs = Math.max(0, fav.timeMs - pre);
        const endMs = Math.min(durationMs || fav.timeMs + post, fav.timeMs + post);
        addClip({
          gameId: id,
          videoId: video.id,
          startMs,
          endMs: endMs > startMs ? endMs : startMs + 1000,
          label: `Highlight ${fav.index}`,
        });
      }
    },
    [id, addVideo, addStatEvent, addClip],
  );

  /** Begin a new recording segment. */
  const startSegment = useCallback(async () => {
    if (recordingRef.current) return;
    if (!isWeb && !cameraRef.current) return;
    recordingRef.current = true;
    segmentStartRef.current = Date.now();
    setRecording(true);
    setStarted(true);
    setElapsedMs(0);
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - segmentStartRef.current);
    }, 250);

    // Web practice mode: no native recording; the segment is finalized on stop.
    if (isWeb) return;

    try {
      const result = await cameraRef.current!.recordAsync();
      // recordAsync resolves once stopRecording() is called.
      if (result?.uri) {
        setSaving(true);
        await finalizeSegment(result.uri);
        setSaving(false);
      }
    } catch (err) {
      console.warn('recordAsync failed', err);
      Alert.alert('Recording error', 'Something went wrong while recording.');
      setSaving(false);
    } finally {
      recordingRef.current = false;
    }
  }, [finalizeSegment, stopTimer, isWeb]);

  /** Stop the active segment (it gets saved); used for both pause and finish. */
  const stopSegment = useCallback(() => {
    if (!recordingRef.current) return;
    stopTimer();
    setRecording(false);
    if (isWeb) {
      // No native recording promise to await; finalize the segment directly.
      recordingRef.current = false;
      setSaving(true);
      finalizeSegment(null).finally(() => setSaving(false));
      return;
    }
    cameraRef.current?.stopRecording();
  }, [stopTimer, isWeb, finalizeSegment]);

  const onTagStat = useCallback(
    (type: StatType, label: string) => {
      if (!recordingRef.current) return;
      statBufferRef.current.push({ type, timeMs: Date.now() - segmentStartRef.current });
      setSessionStats((prev) => [...prev, type]);
      flashLabel(label);
    },
    [flashLabel],
  );

  const onFavorite = useCallback(() => {
    if (!recordingRef.current) return;
    favCounterRef.current += 1;
    favBufferRef.current.push({
      timeMs: Date.now() - segmentStartRef.current,
      index: favCounterRef.current,
    });
    setFavCount(favCounterRef.current);
    flashLabel('★ Highlight saved');
  }, [flashLabel]);

  const onFinish = useCallback(() => {
    stopSegment();
    // Give the segment a moment to flush before leaving.
    setTimeout(() => router.replace(`/games/${id}`), 400);
  }, [stopSegment, router, id]);

  const onClose = useCallback(() => {
    if (started) {
      Alert.alert('Finish recording?', 'Your video and stats will be saved.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Finish', onPress: onFinish },
      ]);
    } else {
      router.back();
    }
  }, [started, onFinish, router]);

  // --- Permission gates (native only; web runs in practice mode) ----------
  if (!isWeb && (!cameraPerm || !micPerm)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  if (!isWeb && (!cameraPerm!.granted || !micPerm!.granted)) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera & microphone access</Text>
        <Text style={styles.permText}>
          Record My Athlete needs the camera and microphone to record games.
        </Text>
        <Button
          title="Grant access"
          onPress={async () => {
            if (!cameraPerm?.granted) await requestCameraPerm();
            if (!micPerm?.granted) await requestMicPerm();
          }}
          style={{ marginTop: spacing.lg, minWidth: 200 }}
        />
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={styles.permCancel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Game not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={styles.permCancel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {isWeb ? (
        <View style={[StyleSheet.absoluteFill, styles.webBackdrop]}>
          <Text style={styles.webBackdropIcon}>🎥</Text>
          <Text style={styles.webBackdropText}>
            Practice mode — try the stat buttons below.{'\n'}Live video recording
            works in the phone app.
          </Text>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          mode="video"
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.timerWrap}>
          {recording ? <View style={styles.recDot} /> : null}
          <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>
        </View>
        <View style={styles.livePill}>
          <Text style={styles.livePillText}>
            {liveStats.points} pts · ★{favCount}
          </Text>
        </View>
      </View>

      {flash ? (
        <View style={styles.flashWrap} pointerEvents="none">
          <Text style={styles.flashText}>{flash}</Text>
        </View>
      ) : null}

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        {!recording ? (
          <Text style={styles.hint}>
            {started ? 'Paused — resume to keep tagging' : 'Press record to start'}
          </Text>
        ) : null}

        <View style={styles.shotGrid}>
          {SHOT_KINDS.map((kind) => (
            <View key={kind.key} style={styles.shotRow}>
              <Text style={styles.shotLabel}>{kind.short}</Text>
              <Pressable
                disabled={!recording}
                onPress={() => onTagStat(kind.madeType, `✓ Made ${kind.short}`)}
                style={[styles.shotBtn, styles.madeBtn, !recording && styles.shotBtnDisabled]}
              >
                <Text style={styles.shotBtnText}>✓ Made</Text>
              </Pressable>
              <Pressable
                disabled={!recording}
                onPress={() => onTagStat(kind.missedType, `✗ Missed ${kind.short}`)}
                style={[styles.shotBtn, styles.missBtn, !recording && styles.shotBtnDisabled]}
              >
                <Text style={styles.shotBtnText}>✗ Miss</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.counterRow}>
          {COUNTER_STATS.map((c) => (
            <Pressable
              key={c.type}
              disabled={!recording}
              onPress={() => onTagStat(c.type, `+1 ${c.label}`)}
              style={[styles.counterBtn, !recording && styles.shotBtnDisabled]}
            >
              <Text style={styles.counterBtnText}>+1 {c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          disabled={!recording}
          onPress={onFavorite}
          style={[styles.favBtn, !recording && styles.shotBtnDisabled]}
        >
          <Text style={styles.favBtnText}>★ Favorite Moment</Text>
        </Pressable>

        <View style={styles.controls}>
          {!recording ? (
            <Pressable
              accessibilityLabel={started ? 'Resume recording' : 'Start recording'}
              onPress={startSegment}
              disabled={(!isWeb && !cameraReady) || saving}
              style={[styles.recordBtn, ((!isWeb && !cameraReady) || saving) && styles.shotBtnDisabled]}
            >
              <View style={styles.recordInner} />
            </Pressable>
          ) : (
            <Pressable accessibilityLabel="Pause recording" onPress={stopSegment} style={styles.pauseBtn}>
              <View style={styles.pauseInner} />
            </Pressable>
          )}

          {started && !recording ? (
            <Pressable onPress={onFinish} style={styles.finishBtn} disabled={saving}>
              <Text style={styles.finishText}>{saving ? 'Saving…' : 'Finish'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  webBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.dark,
  },
  webBackdropIcon: { fontSize: 56, marginBottom: spacing.md },
  webBackdropText: {
    color: '#CBD5E1',
    fontSize: font.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  center: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permTitle: { color: colors.white, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  permText: { color: '#CBD5E1', fontSize: font.body, textAlign: 'center', marginTop: spacing.md, lineHeight: 22 },
  permCancel: { color: colors.primary, fontWeight: '700', fontSize: font.body },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.recording },
  timerText: { color: colors.white, fontWeight: '700', fontSize: font.body, fontVariant: ['tabular-nums'] },
  livePill: {
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  livePillText: { color: colors.white, fontWeight: '700', fontSize: font.small },

  flashWrap: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  flashText: {
    color: colors.white,
    fontSize: font.h2,
    fontWeight: '800',
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.overlay,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
  },
  hint: { color: '#E2E8F0', textAlign: 'center', fontSize: font.small, marginBottom: spacing.xs },
  shotGrid: { gap: spacing.sm },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shotLabel: {
    width: 44,
    color: colors.white,
    fontWeight: '800',
    fontSize: font.body,
  },
  shotBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  madeBtn: { backgroundColor: colors.success },
  missBtn: { backgroundColor: colors.danger },
  shotBtnDisabled: { opacity: 0.4 },
  shotBtnText: { color: colors.white, fontWeight: '800', fontSize: font.body },

  counterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  counterBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  counterBtnText: { color: colors.white, fontWeight: '800', fontSize: font.body },

  favBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.star,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  favBtnText: { color: colors.dark, fontWeight: '800', fontSize: font.h3 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
    minHeight: 76,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.recording },
  pauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseInner: { width: 26, height: 26, borderRadius: 4, backgroundColor: colors.white },
  finishBtn: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  finishText: { color: colors.white, fontWeight: '800', fontSize: font.body },
});
