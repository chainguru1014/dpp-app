// Mitigations for the camera-autofocus hardware-failure class of freeze.
//
// Background: a physically failing autofocus actuator (VCM) can leave the
// capture pipeline stuck "adjusting focus" indefinitely. On the web this
// freezes the <video> stream (currentTime stops advancing); on native it can
// stall the AVCaptureSession / CameraX pipeline and, on some devices, hang
// the app. Forcing a FIXED / manual focus state bypasses the faulty AF module
// and keeps decoding working (just slightly soft), which is why the extra
// image-preprocessing passes below matter for our high-density encrypted QR.
//
// These helpers are web-only — they operate on a getUserMedia
// MediaStreamTrack. The native path is handled separately via
// react-native-vision-camera's focus() call + a session watchdog in
// NativeCodeScanner / CaptureCameraView and the scanner screens.

import { DecodeHintType } from '@zxing/library';

export type FocusFallbackMode = 'manual' | 'single-shot' | 'none-applied';

const getVideoTrack = (stream: any): any =>
  (stream && typeof stream.getVideoTracks === 'function' && stream.getVideoTracks()[0]) || null;

const readCapabilities = (track: any): any => {
  try {
    return typeof track.getCapabilities === 'function' ? track.getCapabilities() || {} : {};
  } catch {
    return {};
  }
};

// ZXing hints that make a fixed / slightly-soft high-density QR far more
// likely to decode: TRY_HARDER runs the slower, rotation/scale-tolerant
// detector instead of the fast single-pass one.
export const buildResilientHints = (): Map<DecodeHintType, any> => {
  const hints = new Map<DecodeHintType, any>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
};

// Push the track off continuous autofocus onto something fixed, trying the
// cleanest option the platform supports first. Returns which mode actually
// took, or null if the track exposes no usable focus control.
export const applyFixedFocusFallback = async (stream: any): Promise<FocusFallbackMode | null> => {
  const track = getVideoTrack(stream);
  if (!track || typeof track.applyConstraints !== 'function') return null;

  const caps = readCapabilities(track);
  const modes: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];

  // 1. Manual focus at a mid lens position — the direct equivalent of the
  //    native "force MF via API" workaround.
  if (modes.includes('manual') && caps.focusDistance) {
    const { min = 0, max = 1 } = caps.focusDistance;
    const mid = min + (max - min) * 0.5;
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: mid }] });
      return 'manual';
    } catch {
      /* fall through */
    }
  }

  // 2. Kick one continuous pass so the lens lands somewhere sensible, then
  //    freeze it with a single-shot lock.
  if (modes.includes('single-shot')) {
    try {
      if (modes.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        await new Promise((r) => setTimeout(r, 400));
      }
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
      return 'single-shot';
    } catch {
      /* fall through */
    }
  }

  // 3. Last resort: ask the driver to stop driving the AF motor entirely.
  if (modes.includes('none')) {
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'none' }] });
      return 'none-applied';
    } catch {
      /* fall through */
    }
  }

  return null;
};

// Real sensor zoom to claw back the apparent resolution a fixed-focus
// (slightly soft) frame loses on a dense code. Callers fall back to a
// center-crop (buildPreprocessedCanvas) when this returns false.
export const applyDigitalZoom = async (stream: any, factor: number): Promise<boolean> => {
  const track = getVideoTrack(stream);
  if (!track || typeof track.applyConstraints !== 'function') return false;
  try {
    const caps = readCapabilities(track);
    if (!caps.zoom) return false;
    const { min = 1, max = 1 } = caps.zoom;
    const target = Math.max(min, Math.min(max, factor));
    if (target <= min) return false;
    await track.applyConstraints({ advanced: [{ zoom: target }] });
    return true;
  } catch {
    return false;
  }
};

// Builds a preprocessed copy of the current frame for a second decode pass:
// optional center-crop (poor-man's zoom) + grayscale + contrast stretch, so a
// soft / low-contrast dense QR still binarizes cleanly when focus is fixed.
export const buildPreprocessedCanvas = (
  source: any,
  opts: { cropRatio?: number; contrast?: number } = {},
): any => {
  const { cropRatio = 1, contrast = 1.6 } = opts;
  const w = source?.width;
  const h = source?.height;
  if (!w || !h) return source;

  const doc: any = (globalThis as any).document;
  if (!doc || typeof doc.createElement !== 'function') return source;
  const out = doc.createElement('canvas');
  const ctx = out.getContext('2d');
  if (!ctx) return source;

  const cw = Math.max(1, Math.round(w * cropRatio));
  const ch = Math.max(1, Math.round(h * cropRatio));
  const sx = Math.round((w - cw) / 2);
  const sy = Math.round((h - ch) / 2);
  out.width = cw;
  out.height = ch;
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, cw, ch);

  try {
    const img = ctx.getImageData(0, 0, cw, ch);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = (g - 128) * contrast + 128;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    // getImageData can throw on a tainted canvas — the crop alone still helps.
  }
  return out;
};
