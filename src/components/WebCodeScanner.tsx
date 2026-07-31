import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, NotFoundException } from '@zxing/library';

interface WebCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: 'qr' | 'barcode') => void;
  // 'once' (default) suppresses re-firing the same value for 2500ms — what
  // the consumer ScannerScreen relies on. 'continuous' fires onScan on every
  // decoded frame with no suppression, for callers (the corporate capture
  // screen) that need a live "is a code currently in view" signal rather
  // than a one-shot detection.
  mode?: 'once' | 'continuous';
}

export interface WebCodeScannerHandle {
  // Snapshots the current video frame as a JPEG data URL, or null if the
  // stream isn't ready yet. Used by the corporate capture screen's Capture
  // button — reuses the same video element already driving live detection.
  captureFrame: () => string | null;
}

const SCAN_INTERVAL_MS = 300;

// Drives its own getUserMedia stream and snapshots frames onto an offscreen
// canvas (same camera-acquisition approach that was already known to work
// reliably — using `{ facingMode: 'environment' }` as a hard/exact constraint
// via ZXing's own decodeFromVideoDevice() instead, as a first pass, produced
// a solid-black preview on devices/browsers with no rear-facing camera to
// exactly satisfy it, e.g. a laptop webcam — this keeps the soft `{ ideal:
// 'environment' }` preference that falls back to whatever camera is
// available). Per-frame decode uses ZXing's decodeFromCanvas — the same
// underlying decoder as the photo-upload path, far more tolerant of a live
// feed's rotation/scale/moiré than the jsQR(QR-only) + hand-rolled EAN-13
// reader this used to run.
function WebCodeScanner({ active, onScan, mode = 'once' }: WebCodeScannerProps, ref: React.Ref<WebCodeScannerHandle>) {
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastValueRef = useRef<string>('');

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return null;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.85);
    },
  }));

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    const report = (value: string, format: 'qr' | 'barcode') => {
      if (mode === 'continuous') {
        onScan(value, format);
        return;
      }
      if (lastValueRef.current === value) return;
      lastValueRef.current = value;
      onScan(value, format);
      setTimeout(() => {
        if (lastValueRef.current === value) lastValueRef.current = '';
      }, 2500);
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const reader = readerRef.current;
      if (!video || !canvas || !reader || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      try {
        const result = reader.decodeFromCanvas(canvas);
        const format = result.getBarcodeFormat ? result.getBarcodeFormat() : null;
        report(String(result.getText()), format === BarcodeFormat.QR_CODE ? 'qr' : 'barcode');
      } catch (err) {
        // NotFoundException just means no code in this frame — expected on
        // most frames, not a real error.
        if (!(err instanceof NotFoundException)) {
          console.warn('Frame decode error:', err);
        }
      }
    };

    const start = async () => {
      try {
        const nav: any = (globalThis as any).navigator;
        const stream = await nav.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t: any) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        readerRef.current = new BrowserMultiFormatReader();
        intervalRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
      } catch (err) {
        console.error('Camera access failed:', err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      readerRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t: any) => t.stop());
        streamRef.current = null;
      }
    };
  }, [active, onScan, mode]);

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}

export default forwardRef(WebCodeScanner);
