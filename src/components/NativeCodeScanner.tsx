import React from 'react';
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

export type ScannedCodeFormat = 'qr' | 'barcode';

interface NativeCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: ScannedCodeFormat) => void;
}

// Reads QR codes and the common 1D/2D product-barcode formats in one pass.
// react-native-vision-camera's built-in codeScanner (v3.5+) decodes on-device
// natively — no JS frame processor, so no Reanimated/worklets dependency
// (this app deliberately doesn't carry Reanimated; see REANIMATED_FIX.md).
export default function NativeCodeScanner({ active, onScan }: NativeCodeScannerProps) {
  const device = useCameraDevice('back');
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

  if (!device) {
    return null;
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={active}
      codeScanner={codeScanner}
    />
  );
}
