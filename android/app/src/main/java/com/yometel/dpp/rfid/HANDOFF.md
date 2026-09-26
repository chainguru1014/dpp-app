# Yometel RFID reader — handoff notes

Status: **Android — real BLE wired up, untested against physical hardware.
iOS — scaffold only, not implemented.** Impinj and Zebra stay simulated
pending CEO sign-off; nothing here touches those.

## What's here

- `FdcBleTransport.kt` — the BLE transport (Fujitsu FDC protocol handshake,
  ported from `Old_RFID/Fujitsu/FDCP_Android_Sample_Application_v3_1_3`).
  Connects by known MAC address, no scan-and-select UI.
- `YometelRfidModule.kt` / `YometelRfidPackage.kt` — the RN bridge module
  (classic bridge, not TurboModules — this app has New Architecture off).
- `../../src/native/yometelRfid.ts` — the JS-side wrapper. This is where the
  Yometel ASCII command protocol itself lives (`RFVER`, `C1GEN2XX`, ...) —
  the native side only moves bytes/lines, it knows nothing about the
  application-layer commands.
- `CorporateScannerScreen.tsx` — the `rfidReaderType === 'yometel'` branch
  calls into `yometelRfid.ts` when `YOMETEL_LIVE_MODE` is true (Android only
  right now). Impinj/Zebra and the old simulation path are untouched.
- `../../../ios/QRAuthApp/Rfid/` — iOS scaffold (Swift + ObjC bridge, method
  stubs that reject "not implemented"). See the comments in
  `YometelRfidModule.swift` for exact line references into Fujitsu's iOS
  sample (`FCLBluetoothLE.swift`) to port from. Needs a one-time Xcode step
  (adding the files to the target + bridging header) before it will even
  compile — documented in `QRAuthApp-Bridging-Header.h`.

## First thing to try with a real reader

1. Get the reader's BLE MAC address — it's printed on the physical unit
   (label on the back/bottom of the CDEX handheld). Android exposes MACs
   directly; this is what goes in the employee's "Yometel Reader ID" field
   in the frontend admin's Staff Roster.
2. Build and install the debug APK (`cd android && ./gradlew.bat
   assembleDebug`, or run via Metro), log in as an employee with that reader
   ID assigned, open Scan > RFID > Yometel, tap Connect.
3. Watch Logcat (`adb logcat | grep -i yometel` or filter on
   `FdcBleTransport`/`YometelRfidModule`) for the connect sequence: GATT
   connect → MTU 512 → discover services → read version/config → enable
   notify/indicate → write version/config client char → `onConnected()`.
4. Once connected, the JS side sends `C1GEN2I 1,10` automatically
   (`yometelRfid.ts`'s `connectYometelReader`). If that responds, try a
   manual scan — the polling loop already calls `C1GEN2XX 0,0` every tick,
   which should come back `0000,OK` (no tags) or `000n,EPC,...,OK`.
5. If nothing comes back at all: confirm the reader is actually in the FDC
   ACK'd flow-control mode assumed here (Tx Config 2 / Rx Config 2, per the
   CDEX manual screenshot) — `FdcBleTransport.kt`'s version/config read
   (`onCharacteristicRead` for `VERSION_CONFIG_SERVER_UUID`) is where that
   gets parsed. If the real device reports different Tx/Rx config values,
   the flow-control branch in `pumpWriteQueue()`/the ACK-byte check needs to
   follow whatever the device actually reports, not the assumed constants.

## If the hardware is misbehaving and you need the UI usable again

Flip `YOMETEL_LIVE_MODE` back to `false` in `CorporateScannerScreen.tsx`
(currently `const YOMETEL_LIVE_MODE = Platform.OS === 'android';` near the
top of the file). That routes Yometel back through the same simulation path
Impinj/Zebra already use — no other code needs to change, and nothing here
gets deleted.

## Known gaps / things to double check on real hardware

- The ACK-mode sequence-number check in `FdcBleTransport.kt` was written
  against Fujitsu's Android sample logic and the CDEX manual's documented
  Tx/Rx config values, but has never run against a live device — this is the
  most likely spot for a first bug if scans don't come back.
- `BLUETOOTH_SCAN` permission was deliberately left out (connect-by-known-MAC
  means no scan step) — if a future feature needs scanning (e.g. an in-app
  "find my reader's MAC" helper instead of reading it off a label), that
  permission and a scan flow will need to be added back in.
- iOS has no MAC-address concept for BLE the way Android does — the iOS
  implementation will need a different identifier (CBUUID) stored per
  employee, which likely means a backend/admin field change, not just native
  code. Flag this before starting the iOS port.
