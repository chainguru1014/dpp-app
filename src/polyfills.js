// Node globals that native dependencies expect but React Native lacks.
// Imported first from index.js so it runs before any other module loads.

// llrpjs (Impinj R700 over LLRP, src/native/impinjRfid.ts) uses the global
// Buffer without importing it. Without this, every reply from the reader
// failed to decode and connecting timed out. `buffer` comes in with
// react-native-tcp-socket.
import {Buffer} from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
