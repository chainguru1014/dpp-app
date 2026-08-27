import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

// Conditionally required, same defensive pattern the rest of this app uses
// for native scanner libraries — lets the screen degrade gracefully instead
// of crashing if the native module hasn't been linked/rebuilt yet.
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

export const isNativeCodeScannerAvailable = () => !!(Camera && useCameraDevice && useCodeScanner);

// iOS (and Android, though PermissionsAndroid is used there instead) needs an
// explicit permission request before the native camera session will start --
// react-native-vision-camera does NOT prompt automatically just because a
// <Camera> component mounts (see its own Camera.requestCameraPermission()
// docs). Without this, mounting the scanner on iOS with permission still
// "not-determined" silently shows a black/frozen preview with nothing ever
// prompting the user to allow access.
export const requestNativeCameraPermission = async (): Promise<boolean> => {
  if (!Camera) return false;
  try {
    const current = Camera.getCameraPermissionStatus();
    if (current === 'granted') return true;
    const result = await Camera.requestCameraPermission();
    return result === 'granted';
  } catch (e) {
    console.warn('Camera.requestCameraPermission failed:', e);
    return false;
  }
};

export type ScannedCodeFormat = 'qr' | 'barcode';

export interface NativeCodeScannerHandle {
  // Forces a one-shot focus at the centre of the preview. On a device whose
  // continuous-autofocus actuator is failing (the stuck "adjusting focus"
  // freeze), driving focus() explicitly bypasses the faulty AF loop and
  // gets the pipeline delivering frames again — the native equivalent of
  // the web fixed-focus fallback in utils/cameraResilience.
  lockFocusCenter: () => Promise<void>;
}

interface NativeCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: ScannedCodeFormat) => void;
  torch?: boolean;
  // Session lifecycle — the scanner screen uses these to run a watchdog:
  // if onInitialized never fires (or onError fires) the preview is dead and
  // the screen shows a recovery card instead of a frozen black rectangle.
  onInitialized?: () => void;
  onError?: (error: unknown) => void;
}

// Reads QR codes and the common 1D/2D product-barcode formats in one pass.
// react-native-vision-camera's built-in codeScanner (v3.5+) decodes on-device
// natively — no JS frame processor, so no Reanimated/worklets dependency
// (this app deliberately doesn't carry Reanimated; see REANIMATED_FIX.md).
function NativeCodeScanner(
  { active, onScan, torch = false, onInitialized, onError }: NativeCodeScannerProps,
  ref: React.Ref<NativeCodeScannerHandle>,
) {
  const device = useCameraDevice('back');
  const cameraRef = useRef<any>(null);
  const layoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

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
    lockFocusCenter: async () => {
      try {
        const { width, height } = layoutRef.current;
        if (!cameraRef.current || !width || !height) return;
        await cameraRef.current.focus({ x: width / 2, y: height / 2 });
      } catch (e) {
        console.warn('lockFocusCenter failed:', e);
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
      torch={torch ? 'on' : 'off'}
      onInitialized={onInitialized}
      onError={onError}
      onLayout={(e: any) => {
        const { width, height } = e?.nativeEvent?.layout || {};
        if (width && height) layoutRef.current = { width, height };
      }}
    />
  );
}

export default forwardRef(NativeCodeScanner);
