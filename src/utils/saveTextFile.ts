import { Platform, Share } from 'react-native';

// Downloads a plain-text file on web (data: URL is unreliable for downloads in
// some browsers, so this uses a Blob + temporary <a download> link); on native,
// falls back to the share sheet since there's no filesystem write permission
// prompt wired up for this yet.
export async function saveTextFile(filename: string, content: string): Promise<void> {
  const webGlobal = globalThis as any;
  if (Platform.OS === 'web' && webGlobal?.document && webGlobal?.Blob && webGlobal?.URL) {
    const blob = new webGlobal.Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = webGlobal.URL.createObjectURL(blob);
    const a = webGlobal.document.createElement('a');
    a.href = url;
    a.download = filename;
    webGlobal.document.body.appendChild(a);
    a.click();
    webGlobal.document.body.removeChild(a);
    webGlobal.URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: content, title: filename });
}

export const safeFileBaseName = (name: string) =>
  (name || 'product-info').replace(/[^a-z0-9-_]+/gi, '_');
