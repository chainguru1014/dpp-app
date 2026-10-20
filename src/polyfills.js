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

// That `buffer` is v5, which predates the 64-bit BigInt methods (added in
// v6). llrpjs needs them for every u64/s64 field, and every LLRP message from
// the reader starts with a 64-bit timestamp, so without these nothing the
// reader sends can be decoded. Same semantics as Node's own methods.
const proto = global.Buffer.prototype;
const TWO_64 = 0x10000000000000000n;
const TWO_63 = 0x8000000000000000n;

if (typeof proto.readBigUInt64BE !== 'function') {
  proto.readBigUInt64BE = function (offset = 0) {
    const hi = this.readUInt32BE(offset);
    const lo = this.readUInt32BE(offset + 4);
    return (BigInt(hi) << 32n) + BigInt(lo);
  };
}
if (typeof proto.readBigInt64BE !== 'function') {
  proto.readBigInt64BE = function (offset = 0) {
    const value = this.readBigUInt64BE(offset);
    return value >= TWO_63 ? value - TWO_64 : value;
  };
}
if (typeof proto.writeBigUInt64BE !== 'function') {
  proto.writeBigUInt64BE = function (value, offset = 0) {
    let v = BigInt(value) % TWO_64;
    if (v < 0n) v += TWO_64;
    this.writeUInt32BE(Number(v >> 32n), offset);
    this.writeUInt32BE(Number(v & 0xffffffffn), offset + 4);
    return offset + 8;
  };
}
if (typeof proto.writeBigInt64BE !== 'function') {
  proto.writeBigInt64BE = function (value, offset = 0) {
    return this.writeBigUInt64BE(value, offset);
  };
}
