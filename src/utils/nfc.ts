import { Platform } from 'react-native';

// Conditionally required, same defensive pattern as NativeCodeScanner — lets
// screens degrade gracefully if the native module hasn't been linked/rebuilt
// yet, instead of crashing the app.
let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

if (Platform.OS !== 'web') {
  try {
    const nfcManagerModule = require('react-native-nfc-manager');
    NfcManager = nfcManagerModule.default;
    NfcTech = nfcManagerModule.NfcTech;
    Ndef = nfcManagerModule.Ndef;
  } catch (e) {
    console.warn('react-native-nfc-manager not available:', e);
  }
}

export const isNfcSupported = async (): Promise<boolean> => {
  if (!NfcManager) return false;
  try {
    return await NfcManager.isSupported();
  } catch (e) {
    return false;
  }
};

/**
 * Reads one NFC tag and returns the identifier to resolve against a PMC:
 * the tag's NDEF text payload if it was written with one (companies can
 * encode a GS1 Digital Link or GTIN into the tag directly), otherwise the
 * tag's hardware UID — which is still a valid, unique identifier for
 * PMC-lookup purposes, just one the company has to register by UID instead
 * of by content.
 *
 * Resolves to null if the user cancels or the read fails/times out.
 */
export const readNfcTag = async (): Promise<string | null> => {
  if (!NfcManager || !NfcTech) return null;

  try {
    await NfcManager.start();
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    const ndefMessage = tag?.ndefMessage;
    if (Ndef && Array.isArray(ndefMessage) && ndefMessage.length > 0) {
      const record = ndefMessage[0];
      try {
        const text = Ndef.text.decodePayload(Uint8Array.from(record.payload));
        if (text && String(text).trim()) {
          return String(text).trim();
        }
      } catch (decodeError) {
        // Not a text record (or undecodable) — fall through to the UID below.
      }
    }

    return tag?.id ? String(tag.id) : null;
  } catch (error) {
    console.warn('NFC read failed:', error);
    return null;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (cleanupError) {
      // No pending request to cancel — safe to ignore.
    }
  }
};
