import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';

interface WebCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: 'qr' | 'barcode') => void;
}

// Replaces react-qr-reader for the web live-camera view: that library only
// ever decoded QR codes, and the jsQR + hand-rolled EAN-13 row-decoder combo
// that briefly replaced it (see git history) was accurate enough for a
// cropped, well-lit photo but too strict for a live feed — a barcode at an
// angle, at a different scale, or with screen moire (e.g. scanning a barcode
// shown on another device's display, as opposed to a printed one) routinely
// failed to decode even though the exact same frame worked fine through the
// photo-upload path. ZXing (used by countless production web scanners)
// handles that real-world variance; it also covers every format
// NativeCodeScanner reads on-device, so behavior matches across platforms.
export default function WebCodeScanner({ active, onScan }: WebCodeScannerProps) {
  const videoRef = useRef<any>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastValueRef = useRef<string>('');

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    const report = (value: string, format: 'qr' | 'barcode') => {
      if (lastValueRef.current === value) return;
      lastValueRef.current = value;
      onScan(value, format);
      setTimeout(() => {
        if (lastValueRef.current === value) lastValueRef.current = '';
      }, 2500);
    };

    const start = async () => {
      try {
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result: any, err: any) => {
            if (cancelled || !result) return;
            const format = result.getBarcodeFormat ? result.getBarcodeFormat() : null;
            report(String(result.getText()), format === BarcodeFormat.QR_CODE ? 'qr' : 'barcode');
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        console.error('Camera access failed:', err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [active, onScan]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={videoRef}
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}
