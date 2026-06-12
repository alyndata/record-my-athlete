import { CameraView } from 'expo-camera';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { persistVideo } from '../util/videoStorage';

export interface CameraRecorderHandle {
  /** Begin capturing a segment. */
  startRecording: () => Promise<void>;
  /** Stop the segment and resolve with a persisted, playable video URI. */
  stopRecording: () => Promise<string | null>;
}

interface Props {
  onReady?: () => void;
}

/** Native recorder backed by expo-camera. */
export const CameraRecorder = forwardRef<CameraRecorderHandle, Props>(
  ({ onReady }, ref) => {
    const cameraRef = useRef<CameraView>(null);
    const recordingPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);

    useImperativeHandle(ref, () => ({
      async startRecording() {
        if (!cameraRef.current) throw new Error('Camera not ready');
        // recordAsync resolves only once stopRecording() is called.
        recordingPromise.current = cameraRef.current.recordAsync();
      },
      async stopRecording() {
        cameraRef.current?.stopRecording();
        const result = await recordingPromise.current;
        recordingPromise.current = null;
        if (result?.uri) return persistVideo(result.uri);
        return null;
      },
    }));

    return (
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        mode="video"
        facing="back"
        onCameraReady={onReady}
      />
    );
  },
);

CameraRecorder.displayName = 'CameraRecorder';
