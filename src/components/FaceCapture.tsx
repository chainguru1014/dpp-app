import React, { useEffect, useRef } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FACEIO_PUBLIC_ID, FACEIO_WEB_ORIGIN } from '../config/auth';
import { colors, MIN_TOUCH } from '../theme';

// FACEIO face capture. fio.js (https://cdn.faceio.net/fio.js) draws its own
// camera UI, matches the face and — on FACEIO's Pro plan and up — runs its
// anti-spoofing checks. All this component does is start it and hand back the
// resulting Facial ID; the backend then confirms that ID with FACEIO before
// any session is issued (see authController's face section).
//
// Web: fio.js runs directly in the page. Native: fio.js runs inside a
// full-screen WebView whose page gets FACEIO_WEB_ORIGIN as its origin, so
// FACEIO's origin whitelist and the camera's secure-origin rule are both met.

// react-native-webview is optional on JS-only builds — same guard as VideoFrame.
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('react-native-webview not available:', e);
  }
}

const FIO_SRC = 'https://cdn.faceio.net/fio.js';

export type FaceMode = 'enroll' | 'authenticate';

/** Reasons the capture can end without a Facial ID — mapped to text by the caller. */
export type FaceFailure =
  | 'notConfigured'
  | 'permission'
  | 'noFace'
  | 'unrecognized'
  | 'duplicate'
  | 'spoof'
  | 'cancelled'
  | 'failed';

// fio.js numeric error codes (fioErrCode) → our coarse reasons.
const failureFromCode = (code: any): FaceFailure => {
  switch (Number(code)) {
    case 1: return 'permission'; // PERMISSION_REFUSED
    case 2: return 'noFace'; // NO_FACES_DETECTED
    case 3: return 'unrecognized'; // UNRECOGNIZED_FACE
    case 4: return 'noFace'; // MANY_FACES
    case 5: return 'duplicate'; // FACE_DUPLICATION
    case 7: return 'spoof'; // PAD_ATTACK
    case 8: return 'unrecognized'; // FACE_MISMATCH
    case 12: return 'cancelled'; // TERMS_NOT_ACCEPTED
    default: return 'failed';
  }
};

interface FaceCaptureProps {
  visible: boolean;
  mode: FaceMode;
  // Stored by FACEIO with the face at enrollment (we pass the new account id).
  payload?: Record<string, any>;
  onSuccess: (facialId: string) => void;
  onFailure: (reason: FaceFailure) => void;
}

// ---- Web ------------------------------------------------------------------

let fioScriptPromise: Promise<void> | null = null;
let fioInstance: any = null;

const loadFio = () => {
  if ((globalThis as any).faceIO) return Promise.resolve();
  if (!fioScriptPromise) {
    fioScriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = FIO_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        fioScriptPromise = null;
        reject(new Error('fio.js failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return fioScriptPromise;
};

const runOnWeb = async (mode: FaceMode, payload?: Record<string, any>) => {
  await loadFio();
  if (!fioInstance) {
    fioInstance = new (globalThis as any).faceIO(FACEIO_PUBLIC_ID);
  } else {
    // fio.js allows one enroll/authenticate per session.
    try { await fioInstance.restartSession({}); } catch (e) { /* first run */ }
  }
  if (mode === 'enroll') {
    const info = await fioInstance.enroll({ locale: 'auto', payload: payload || {} });
    return String(info?.facialId || '');
  }
  const info = await fioInstance.authenticate({ locale: 'auto' });
  return String(info?.facialId || '');
};

// ---- Native ---------------------------------------------------------------

const nativeHtml = (mode: FaceMode, payload?: Record<string, any>) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#0d2a40}</style>
<script src="${FIO_SRC}"></script></head>
<body><div id="faceio-modal"></div>
<script>
  function send(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.addEventListener('load', function(){
    try {
      var fio = new faceIO(${JSON.stringify(FACEIO_PUBLIC_ID)});
      var p = ${mode === 'enroll'
        ? `fio.enroll({ locale: 'auto', payload: ${JSON.stringify(payload || {})} })`
        : `fio.authenticate({ locale: 'auto' })`};
      p.then(function(info){ send({ ok: true, facialId: info && info.facialId }); })
       .catch(function(code){ send({ ok: false, code: code }); });
    } catch (e) { send({ ok: false, code: -1 }); }
  });
</script></body></html>`;

export default function FaceCapture({ visible, mode, payload, onSuccess, onFailure }: FaceCaptureProps) {
  // Latest callbacks without re-running the capture effect on every render.
  const cb = useRef({ onSuccess, onFailure });
  cb.current = { onSuccess, onFailure };
  const doneRef = useRef(false);

  const finish = (facialId: string | null, reason?: FaceFailure) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (facialId) cb.current.onSuccess(facialId);
    else cb.current.onFailure(reason || 'failed');
  };

  useEffect(() => {
    if (!visible) return;
    doneRef.current = false;
    if (!FACEIO_PUBLIC_ID) {
      finish(null, 'notConfigured');
      return;
    }
    if (Platform.OS !== 'web') {
      if (!WebView) finish(null, 'failed');
      return;
    }
    runOnWeb(mode, payload)
      .then((id) => finish(id || null))
      .catch((code) => finish(null, failureFromCode(code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode]);

  if (Platform.OS === 'web' || !WebView || !FACEIO_PUBLIC_ID) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => finish(null, 'cancelled')}>
      <View style={styles.fill}>
        {visible && (
          <WebView
            source={{ html: nativeHtml(mode, payload), baseUrl: FACEIO_WEB_ORIGIN }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            onMessage={(e: any) => {
              let msg: any = {};
              try { msg = JSON.parse(e?.nativeEvent?.data || '{}'); } catch (err) { /* ignore */ }
              if (msg.ok && msg.facialId) finish(String(msg.facialId));
              else finish(null, failureFromCode(msg.code));
            }}
            style={styles.fill}
          />
        )}
        <TouchableOpacity
          style={styles.close}
          onPress={() => finish(null, 'cancelled')}
          accessibilityRole="button"
          accessibilityLabel="Close"
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
