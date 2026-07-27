// Decodes a QR/1D-barcode from a picked gallery image on native (Android/iOS)
// via on-device Google ML Kit. The web build has its own image-decode path
// (jsQR + ean13Decoder, see ScannerScreen.decodeImageFromFile) built on
// canvas/ImageData, which doesn't exist in React Native — this is the
// native-only equivalent, using react-native-image-picker (already a
// dependency) to grab the file and ML Kit to read it, so scanning a photo
// works the same as scanning live through the camera.
let BarcodeScanning: any = null;
try {
  BarcodeScanning = require('@react-native-ml-kit/barcode-scanning').default;
} catch (e) {
  console.warn('@react-native-ml-kit/barcode-scanning not available:', e);
}

export const isNativeImageScanAvailable = () => !!BarcodeScanning;

export type NativeImageScanResult = { value: string; format: 'qr' | 'barcode' };

export const scanBarcodeFromImageUri = async (uri: string): Promise<NativeImageScanResult | null> => {
  if (!BarcodeScanning || !uri) return null;
  const barcodes = await BarcodeScanning.scan(uri);
  const match = Array.isArray(barcodes) ? barcodes.find((b: any) => b?.value || b?.displayValue) : null;
  if (!match) return null;
  const value = String(match.value ?? match.displayValue ?? '').trim();
  if (!value) return null;
  return { value, format: match.format === 'QR_CODE' ? 'qr' : 'barcode' };
};
