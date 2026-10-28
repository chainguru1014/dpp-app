import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FACE_CAPTURE_ORIGIN } from '../config/auth';
import { useI18n } from '../i18n/I18nContext';
import { colors, MIN_TOUCH } from '../theme';

// Face capture for face sign-in. A small camera page runs the open-source
// Human library (https://github.com/vladmandic/human) to check the person is
// live — a blink, plus Human's anti-spoofing and liveness models — and then
// hands back ONE photo. Matching against enrolled faces happens on our
// server (self-hosted CompreFace), never here.
//
// Web: the page runs in a full-screen iframe (same origin, camera allowed).
// Native: it runs in a WebView whose page gets FACE_CAPTURE_ORIGIN (https)
// as its origin, because the camera only works on a secure origin.

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('react-native-webview not available:', e);
  }
}

const HUMAN_VERSION = '3.3.6';
const HUMAN_CDN = `https://cdn.jsdelivr.net/npm/@vladmandic/human@${HUMAN_VERSION}`;

/** Reasons the capture can end without a photo — mapped to text by the caller. */
export type FaceFailure = 'permission' | 'noFace' | 'spoof' | 'cancelled' | 'failed';

interface FaceCaptureProps {
  visible: boolean;
  onSuccess: (imageDataUrl: string) => void;
  onFailure: (reason: FaceFailure) => void;
}

const captureHtml = (nonce: string, texts: Record<string, string>) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html,body{margin:0;height:100%;background:#0d2a40;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;box-sizing:border-box}
  .ring{width:min(72vw,300px);height:min(72vw,300px);border-radius:50%;overflow:hidden;border:6px solid #4a96dd;box-shadow:0 0 0 10px rgba(74,150,221,.18);background:#123a56;transition:border-color .2s}
  .ring.ok{border-color:#2e7d32;box-shadow:0 0 0 10px rgba(46,125,50,.25)}
  video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  .hint{display:flex;flex-direction:column;align-items:center;gap:10px;min-height:120px}
  .hint svg{width:72px;height:72px}
  .hint p{margin:0;font-size:22px;font-weight:600;text-align:center}
  .note{font-size:14px;opacity:.75;text-align:center;max-width:320px}
</style></head>
<body><div class="wrap">
  <div class="ring" id="ring"><video id="v" autoplay playsinline muted></video></div>
  <div class="hint"><div id="icon"></div><p id="msg"></p></div>
  <div class="note">${texts.consent}</div>
</div>
<script type="module">
  const T = ${JSON.stringify(texts)};
  const NONCE = ${JSON.stringify(nonce)};
  const ICONS = {
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="#bcd3ff" stroke-width="1.6" stroke-linecap="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="9" cy="10" r=".8" fill="#bcd3ff"/><circle cx="15" cy="10" r=".8" fill="#bcd3ff"/><path d="M9 15c1.6 1.4 4.4 1.4 6 0"/></svg>',
    blink: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"><path d="M2 12c3-4 6.5-6 10-6s7 2 10 6"/><path d="M2 12c3 3 6.5 4.5 10 4.5S19 15 22 12"/><path d="M12 16.5V20M6.5 15l-1.5 3M17.5 15l1.5 3"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffb4b4" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c.8-3.5 3-5 6-5s5.2 1.5 6 5M14 15.2c.6-.1 1.3-.2 2-.2 3 0 5.2 1.5 6 5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="#7bd88f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>',
    wait: '<svg viewBox="0 0 24 24" fill="none" stroke="#bcd3ff" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" opacity=".3"/><path d="M21 12a9 9 0 0 0-9-9"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>',
  };
  const iconEl = document.getElementById('icon'), msgEl = document.getElementById('msg'), ring = document.getElementById('ring');
  const show = (icon, msg) => { iconEl.innerHTML = ICONS[icon]; msgEl.textContent = msg; };
  let done = false;
  const send = (m) => {
    if (done) return; done = true;
    try { const s = document.getElementById('v').srcObject; s && s.getTracks().forEach((t) => t.stop()); } catch (e) {}
    m.nonce = NONCE;
    const data = JSON.stringify(m);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(data); else window.parent.postMessage(data, '*');
  };
  show('wait', T.loading);

  const start = async () => {
    const video = document.getElementById('v');
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    } catch (e) { return send({ ok: false, code: 'permission' }); }
    await new Promise((r) => (video.readyState >= 2 ? r() : (video.onloadeddata = r)));

    let Human;
    try { Human = (await import('${HUMAN_CDN}/dist/human.esm.js')).default; } catch (e) { return send({ ok: false, code: 'failed' }); }
    const human = new Human({
      modelBasePath: '${HUMAN_CDN}/models/',
      debug: false,
      cacheSensitivity: 0,
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 2, minConfidence: 0.5 },
        mesh: { enabled: true }, iris: { enabled: true },
        description: { enabled: false }, emotion: { enabled: false }, attention: { enabled: false },
        antispoof: { enabled: true }, liveness: { enabled: true },
      },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
      segmentation: { enabled: false }, gesture: { enabled: true },
    });
    try { await human.load(); await human.warmup(); } catch (e) { return send({ ok: false, code: 'failed' }); }

    // Pass = enough frames that the anti-spoofing + liveness models call
    // real, then a blink (eyes open -> closed -> open), then one photo taken
    // with eyes open.
    const started = Date.now();
    let sawFace = false, liveFrames = 0, sawOpen = false, sawBlink = false;
    show('face', T.look);
    const tick = async () => {
      if (done) return;
      if (Date.now() - started > 45000) return send({ ok: false, code: sawFace ? 'spoof' : 'noFace' });
      const r = await human.detect(video);
      const faces = r.face || [];
      if (faces.length === 0) { show('face', T.look); ring.classList.remove('ok'); return requestAnimationFrame(tick); }
      if (faces.length > 1) { show('people', T.onePerson); ring.classList.remove('ok'); return requestAnimationFrame(tick); }
      sawFace = true;
      const f = faces[0];
      if ((f.real || 0) > 0.5 && (f.live || 0) > 0.5) liveFrames++;
      const blinking = (r.gesture || []).some((g) => g.face === 0 && /blink/.test(g.gesture));
      if (!blinking) sawOpen = true;
      if (sawOpen && blinking) sawBlink = true;
      if (!sawBlink) { show('blink', T.blink); return requestAnimationFrame(tick); }
      if (liveFrames < 5) { show('face', T.hold); return requestAnimationFrame(tick); }
      if (blinking) return requestAnimationFrame(tick);
      ring.classList.add('ok'); show('ok', T.hold);
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      send({ ok: true, image: c.toDataURL('image/jpeg', 0.88) });
    };
    tick();
  };
  start();
</script></body></html>`;

export default function FaceCapture({ visible, onSuccess, onFailure }: FaceCaptureProps) {
  const { t } = useI18n();
  const cb = useRef({ onSuccess, onFailure });
  cb.current = { onSuccess, onFailure };
  const doneRef = useRef(false);

  // New nonce per open, so a stale message from an earlier capture is ignored.
  const nonce = useMemo(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`, [visible]);
  const html = useMemo(
    () => captureHtml(nonce, {
      loading: t('faceStarting'),
      look: t('faceLookAtCamera'),
      blink: t('faceBlinkNow'),
      onePerson: t('faceOnePerson'),
      hold: t('faceHoldStill'),
      consent: t('faceConsentNote'),
    }),
    [nonce, t],
  );

  const finish = (image: string | null, reason?: FaceFailure) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (image) cb.current.onSuccess(image);
    else cb.current.onFailure(reason || 'failed');
  };

  const handleMessage = (raw: any) => {
    let msg: any = {};
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : {}; } catch (e) { return; }
    if (msg.nonce !== nonce) return;
    if (msg.ok && typeof msg.image === 'string') finish(msg.image);
    else finish(null, (['permission', 'noFace', 'spoof'] as FaceFailure[]).includes(msg.code) ? msg.code : 'failed');
  };

  useEffect(() => {
    if (!visible) return undefined;
    doneRef.current = false;
    if (Platform.OS !== 'web') {
      if (!WebView) finish(null, 'failed');
      return undefined;
    }
    const onMsg = (e: MessageEvent) => handleMessage(e.data);
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, nonce]);

  if (!visible) return null;
  if (Platform.OS !== 'web' && !WebView) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={() => finish(null, 'cancelled')}>
      <View style={styles.fill}>
        {Platform.OS === 'web'
          ? React.createElement('iframe', {
              srcDoc: html,
              allow: 'camera',
              title: 'Face check',
              style: { border: 0, width: '100%', height: '100%', flex: 1 },
            })
          : (
            <WebView
              source={{ html, baseUrl: FACE_CAPTURE_ORIGIN }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              onMessage={(e: any) => handleMessage(e?.nativeEvent?.data)}
              style={styles.fill}
            />
          )}
        <TouchableOpacity
          style={styles.close}
          onPress={() => finish(null, 'cancelled')}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        >
          <Icon name="close" size={30} color={colors.white} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0d2a40' },
  close: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
