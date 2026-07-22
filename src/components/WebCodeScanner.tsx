import React, { useEffect, useRef } from 'react';
import { decodeEan13FromImageData } from '../utils/ean13Decoder';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsQR = require('jsqr').default || require('jsqr');

interface WebCodeScannerProps {
  active: boolean;
  onScan: (value: string, format: 'qr' | 'barcode') => void;
}

const SCAN_INTERVAL_MS = 300;

// Replaces react-qr-reader for the web live-camera view: that library only
// ever decodes QR codes, so a barcode never had any detection path on a live
// web camera feed (QR and GS1-DL — a QR — worked; a real 1D barcode never
// could). This drives its own getUserMedia stream, snapshotting frames onto
// an offscreen canvas and running jsQR first, then falling back to the
// dependency-free EAN-13 reader (see utils/ean13Decoder) — same fallback
// order as the photo-upload path in ScannerScreen.decodeImageFromFile.
export default function WebCodeScanner({ active, onScan }: WebCodeScannerProps) {
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
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

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      const qrResult = jsQR(imageData.data, w, h);
      if (qrResult && qrResult.data) {
        report(String(qrResult.data), 'qr');
        return;
      }
      const barcodeValue = decodeEan13FromImageData(imageData);
      if (barcodeValue) {
        report(barcodeValue, 'barcode');
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t: any) => t.stop());
        streamRef.current = null;
      }
    };
  }, [active, onScan]);

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
