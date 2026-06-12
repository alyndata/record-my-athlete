import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { putVideoBlob } from '../util/videoStorage.web';

export interface CameraRecorderHandle {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
}

interface Props {
  onReady?: () => void;
}

function pickMimeType(): string {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

/** Web recorder backed by getUserMedia + MediaRecorder, rendered into a DOM video. */
export const CameraRecorder = forwardRef<CameraRecorderHandle, Props>(
  ({ onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [error, setError] = useState<string | null>(null);

    const ensureStream = async (): Promise<MediaStream> => {
      if (streamRef.current) return streamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setError(null);
      return stream;
    };

    useEffect(() => {
      // Enable the controls right away so the record tap can grant the camera.
      onReady?.();
      // Best-effort preview now (works on desktop; iOS Safari grants on the tap).
      ensureStream().catch(() => {});
      return () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      async startRecording() {
        let stream: MediaStream;
        try {
          // Acquiring here (inside the tap handler) is what iOS Safari requires.
          stream = await ensureStream();
        } catch (e: any) {
          setError(e?.message || 'Camera access was blocked.');
          throw e;
        }
        chunksRef.current = [];
        const mime = pickMimeType();
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorderRef.current = recorder;
        recorder.start();
      },
      stopRecording() {
        return new Promise<string | null>((resolve) => {
          const recorder = recorderRef.current;
          if (!recorder || recorder.state === 'inactive') {
            resolve(null);
            return;
          }
          recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, {
              type: recorder.mimeType || 'video/mp4',
            });
            chunksRef.current = [];
            try {
              resolve(await putVideoBlob(blob));
            } catch {
              resolve(null);
            }
          };
          recorder.stop();
        });
      },
    }));

    return (
      <View style={[StyleSheet.absoluteFill, styles.bg]}>
        {/* Real DOM <video> for the live preview (web only). */}
        {React.createElement('video', {
          ref: videoRef,
          autoPlay: true,
          muted: true,
          playsInline: true,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: colors.dark,
          },
        })}
        {error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Allow camera & microphone access in your browser, then reopen this screen.
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

CameraRecorder.displayName = 'CameraRecorder';

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.dark },
  errorWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: { color: colors.white, fontSize: font.h3, fontWeight: '700', textAlign: 'center' },
  errorHint: {
    color: '#CBD5E1',
    fontSize: font.small,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
