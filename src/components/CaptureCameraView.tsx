import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

// Isolated from NativeCodeScanner.tsx (the consumer scan path) so that
// component's behavior/signature stays untouched. Same defensive
// conditionally-required pattern the rest of this app uses for native
// scanner libraries — degrades gracefully instead of crashing if the native
// module hasn't been linked/rebuilt yet.
let Camera: any = null;
let useCameraDevice: any = null;
let useCodeScanner: any = null;

try {
  const VisionCamera = require('react-native-vision-camera');
  Camera = VisionCamera.Camera;
  useCameraDevice = VisionCamera.useCameraDevice;
  useCodeScanner = VisionCamera.useCodeScanner;
} catch (e) {
  console.warn('react-native-vision-camera not available:', e);
}

export const isCaptureCameraAvailable = () => !!(Camera && useCameraDevice && useCodeScanner);

export type CapturedCodeFormat = 'qr' | 'barcode';

export interface CaptureCameraHandle {
  // Takes a still photo and returns its local file URI, or null on failure.
  takePhoto: () => Promise<string | null>;
}

interface CaptureCameraViewProps {
  active: boolean;
  // Fires on every frame a code is detected — no dedup/suppression, unlike
  // NativeCodeScanner's single onScan consumer (ScannerScreen.tsx) which
  // applies its own debounce on top. The corporate capture screen needs this
  // raw continuous signal to know "is a code currently in view" right now.
  onScan: (value: string, format: CapturedCodeFormat) => void;
  torch?: boolean;
}

// Caller MUST check isCaptureCameraAvailable() before rendering this — the
// hooks below are called unconditionally (same contract as
// NativeCodeScanner.tsx) and are only safe to call once the native module is
// confirmed linked.
function CaptureCameraView({ active, onScan, torch }: CaptureCameraViewProps, ref: React.Ref<CaptureCameraHandle>) {
  const device = useCameraDevice('back');
  const cameraRef = useRef<any>(null);

  const codeScanner = useCodeScanner({
    codeTypes: [
      'qr', 'ean-13', 'ean-8', 'upc-a', 'upc-e',
      'code-128', 'code-39', 'code-93', 'codabar', 'itf', 'pdf-417', 'aztec', 'data-matrix',
    ],
    onCodeScanned: (codes: any[]) => {
      const code = codes.find((c) => !!c?.value);
      if (code?.value) {
        onScan(String(code.value), code.type === 'qr' ? 'qr' : 'barcode');
      }
    },
  });

  useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      try {
        if (!cameraRef.current) return null;
        const photo = await cameraRef.current.takePhoto({ flash: 'off' });
        return photo?.path ? `file://${photo.path}` : null;
      } catch (err) {
        console.error('takePhoto failed:', err);
        return null;
      }
    },
  }));

  if (!device || !Camera) {
    return null;
  }

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={active}
      codeScanner={codeScanner}
      photo={true}
      torch={torch ? 'on' : 'off'}
    />
  );
}

export default forwardRef(CaptureCameraView);
