import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, NotFoundException } from '@zxing/library';
import {
  applyDigitalZoom,
  applyFixedFocusFallback,
  buildPreprocessedCanvas,
  buildResilientHints,
} from '../utils/cameraResilience';

interface WebCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: 'qr' | 'barcode') => void;
  // 'once' (default) suppresses re-firing the same value for 2500ms — what
  // the consumer ScannerScreen relies on. 'continuous' fires onScan on every
  // decoded frame with no suppression, for callers (the corporate capture
  // screen) that need a live "is a code currently in view" signal rather
  // than a one-shot detection.
  mode?: 'once' | 'continuous';
  // Fired once when the live stream has frozen and automatic recovery
  // (fixed-focus fallback, then a one-time stream restart) did not bring it
  // back — the screen should offer photo scan / manual entry / a retry.
  // See utils/cameraResilience for why an AF-hardware fault causes this.
  onCameraStalled?: () => void;
  // Fired when the watchdog switched the camera to a fixed/manual focus mode
  // to work around a stuck autofocus — the screen can surface a brief
  // "move the phone slightly further away" hint.
  onFocusFallback?: () => void;
}

export interface WebCodeScannerHandle {
  // Snapshots the current video frame as a JPEG data URL, or null if the
  // stream isn't ready yet. Used by the corporate capture screen's Capture
  // button — reuses the same video element already driving live detection.
  captureFrame: () => string | null;
}

const SCAN_INTERVAL_MS = 300;
// Stream-liveness watchdog: video.currentTime must keep advancing. Each tick
// it hasn't is one "stalled" count; the escalation stages below are keyed off
// that count (≈1s per tick).
const WATCHDOG_INTERVAL_MS = 1000;
const STALL_TICKS_FOCUS_FALLBACK = 3; // ~3s frozen -> force fixed focus + zoom
const STALL_TICKS_RESTART = 6; // ~6s frozen -> restart the stream once
const STALL_TICKS_GIVE_UP = 10; // ~10s frozen -> hand off to the screen

// Drives its own getUserMedia stream and snapshots frames onto an offscreen
// canvas. Per-frame decode uses ZXing's decodeFromCanvas (same decoder as the
// photo-upload path). A stuck-autofocus fault freezes the stream rather than
// erroring, so a watchdog (see the WATCHDOG_* constants) forces a fixed-focus
// state, then restarts the stream, then finally reports onCameraStalled.
function WebCodeScanner(
  { active, onScan, mode = 'once', onCameraStalled, onFocusFallback }: WebCodeScannerProps,
  ref: React.Ref<WebCodeScannerHandle>,
) {
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const watchdogRef = useRef<any>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastValueRef = useRef<string>('');
  const emptyFramesRef = useRef<number>(0);
  // Kept in refs so an inline-arrow callback from the parent doesn't retrigger
  // the stream-acquisition effect (which would tear down and re-open the
  // camera on every render).
  const onCameraStalledRef = useRef(onCameraStalled);
  const onFocusFallbackRef = useRef(onFocusFallback);
  onCameraStalledRef.current = onCameraStalled;
  onFocusFallbackRef.current = onFocusFallback;

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
    let didRestart = false;
    let gaveUp = false;
    let stalledTicks = 0;
    let lastVideoTime = -1;

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

    // Try to decode `cnv`; returns true on a hit. Kept separate so the
    // fixed-focus fallback passes below can reuse it on preprocessed frames.
    const tryDecode = (cnv: any): boolean => {
      const reader = readerRef.current;
      if (!reader) return false;
      try {
        const result = reader.decodeFromCanvas(cnv);
        const format = result.getBarcodeFormat ? result.getBarcodeFormat() : null;
        report(String(result.getText()), format === BarcodeFormat.QR_CODE ? 'qr' : 'barcode');
        return true;
      } catch (err) {
        if (!(err instanceof NotFoundException)) {
          console.warn('Frame decode error:', err);
        }
        return false;
      }
    };

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !readerRef.current || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      if (tryDecode(canvas)) {
        emptyFramesRef.current = 0;
        return;
      }

      // Nothing on the raw frame. Every few empty frames, spend the extra
      // cycles on the fixed-focus-resilient passes: a contrast-stretched
      // full frame, then a center-cropped (digital-zoom) contrast pass for a
      // dense code that's simply too small/soft at full frame.
      emptyFramesRef.current += 1;
      if (emptyFramesRef.current % 3 === 0) {
        if (tryDecode(buildPreprocessedCanvas(canvas, { cropRatio: 1, contrast: 1.7 }))) {
          emptyFramesRef.current = 0;
          return;
        }
        if (tryDecode(buildPreprocessedCanvas(canvas, { cropRatio: 0.6, contrast: 1.7 }))) {
          emptyFramesRef.current = 0;
        }
      }
    };

    const stopStream = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t: any) => t.stop());
        streamRef.current = null;
      }
    };

    const startStream = async () => {
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
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader(buildResilientHints());
        }
        intervalRef.current = setInterval(scanFrame, SCAN_INTERVAL_MS);
      } catch (err) {
        console.error('Camera access failed:', err);
        if (!cancelled && !gaveUp) {
          gaveUp = true;
          onCameraStalledRef.current?.();
        }
      }
    };

    // Watchdog — a stuck AF actuator freezes the feed silently (no error
    // event), so the only signal is currentTime no longer advancing.
    const watchdog = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !streamRef.current) return;
      // A backgrounded tab legitimately stops advancing currentTime — don't
      // mistake that for an autofocus freeze.
      const doc: any = (globalThis as any).document;
      if (doc && doc.hidden) {
        lastVideoTime = -1;
        stalledTicks = 0;
        return;
      }
      const t = video.currentTime;

      if (t !== lastVideoTime) {
        lastVideoTime = t;
        stalledTicks = 0;
        return;
      }
      stalledTicks += 1;

      if (stalledTicks === STALL_TICKS_FOCUS_FALLBACK) {
        // Bypass the faulty AF module: pin focus and lean on sensor zoom.
        const applied = await applyFixedFocusFallback(streamRef.current);
        await applyDigitalZoom(streamRef.current, 2);
        if (applied) onFocusFallbackRef.current?.();
      } else if (stalledTicks === STALL_TICKS_RESTART && !didRestart) {
        didRestart = true;
        stopStream();
        lastVideoTime = -1;
        stalledTicks = 0;
        await startStream();
      } else if (stalledTicks >= STALL_TICKS_GIVE_UP && !gaveUp) {
        gaveUp = true;
        onCameraStalledRef.current?.();
      }
    };

    startStream();
    watchdogRef.current = setInterval(watchdog, WATCHDOG_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      stopStream();
      readerRef.current = null;
      emptyFramesRef.current = 0;
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
