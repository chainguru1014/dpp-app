import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';

// Native build: play the YouTube embed inside a WebView so it stays in-app.
// react-native-webview is an optional native dependency — guarded the same
// defensive way as the app's other native modules (image-picker, NFC, …) so a
// JS-only or not-yet-rebuilt binary degrades gracefully instead of crashing.
let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebView = require('react-native-webview').WebView;
} catch (e) {
  console.warn('react-native-webview not available:', e);
}

// Uploaded video files play through a tiny HTML5 <video> page in the same
// WebView, so no extra native video module is needed.
const fileVideoHtml = (src: string) =>
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain}</style>' +
  `</head><body><video src="${src.replace(/"/g, '&quot;')}" controls autoplay playsinline></video></body></html>`;

export default function VideoFrame({ videoId, src }: { videoId?: string | null; src?: string | null }) {
  if (src) {
    if (!WebView) {
      return (
        <View style={styles.fallback}>
          <TouchableOpacity style={styles.fallbackBtn} onPress={() => Linking.openURL(src)} activeOpacity={0.8}>
            <Text style={styles.fallbackBtnText}>Open video</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <WebView
        source={{ html: fileVideoHtml(src) }}
        originWhitelist={['*']}
        style={styles.web}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
      />
    );
  }
  if (!videoId) return null;

  const embedUrl =
    `https://www.youtube.com/embed/${videoId}` +
    '?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1';

  if (!WebView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Update the app to play videos in-app.
        </Text>
        <TouchableOpacity
          style={styles.fallbackBtn}
          onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.fallbackBtnText}>Open in YouTube</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: embedUrl }}
      style={styles.web}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      renderLoading={() => (
        <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#fff" />
      )}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  fallbackText: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  fallbackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  fallbackBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
