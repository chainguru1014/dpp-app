// react-native-tcp-socket is used as a drop-in replacement for Node's `net`
// module on native builds (see package.json's "react-native" field and
// src/native/impinjRfid.ts) — this gives TypeScript a type for `import net
// from 'net'` (used internally by llrpjs, which this app doesn't otherwise
// depend on Node's own `net` typings for).
declare module 'net' {
  import TcpSockets from 'react-native-tcp-socket';
  export = TcpSockets;
}
