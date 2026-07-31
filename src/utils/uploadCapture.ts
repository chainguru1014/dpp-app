import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';

// Uploads a captured frame (native file:// URI, or a web data: URL) to the
// existing generic upload endpoint (POST /upload/single — same one already
// backing other image uploads in this codebase) and returns the stored
// path the backend hands back, ready to store on a CaptureRecord.
export const uploadCaptureImage = async (uri: string): Promise<string | null> => {
  try {
    const form = new FormData();

    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      (form.append as any)('file', blob, `capture-${Date.now()}.jpg`);
    } else {
      form.append('file', {
        uri,
        name: `capture-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
    }

    const response = await fetch(`${API_BASE_URL}upload/single`, {
      method: 'POST',
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.status !== 'success') {
      return null;
    }
    return data.path || null;
  } catch (err) {
    console.error('uploadCaptureImage failed:', err);
    return null;
  }
};
