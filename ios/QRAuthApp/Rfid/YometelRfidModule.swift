//
//  YometelRfidModule.swift
//  QRAuthApp
//
//  iOS PHASE-2 SCAFFOLD — NOT IMPLEMENTED YET.
//
//  Android already has a working version of this module (see
//  android/app/src/main/java/com/yometel/dpp/rfid/FdcBleTransport.kt +
//  YometelRfidModule.kt), ported from Fujitsu's proven Android FDC BLE sample
//  (Old_RFID/Fujitsu/FDCP_Android_Sample_Application_v3_1_3). This file is
//  the iOS on-ramp for the same job, so porting starts from a real class with
//  the right shape instead of a blank file.
//
//  The exact same job, done with CoreBluetooth instead of android.bluetooth:
//  connect to a known BLE MAC/UUID → discover the FDC service → enable
//  notify/indicate on the RX characteristic → write the version/config
//  client characteristic → the FDC channel is "connected" → after that,
//  writeCommand() sends `\r`-terminated ASCII (RFVER, C1GEN2XX, ...) and
//  incoming notifications are line-buffered and emitted as they complete.
//
//  Reference (proven working, do not re-derive the handshake — port it):
//  Old_RFID/Fujitsu/FDCP_iOS_Sample_Application_v2_0_1/.../FCLBluetoothLE/FCLBluetoothLE.swift
//    - UUID constants & setup ......... lines 104-170 (same UUID strings the
//      Android side already uses — see FdcBleTransport.kt's companion object)
//    - connect() ....................... line 757
//    - disconnect() .................... line 767
//    - writeData(data:) ................ line 776  (TX queue / flow control)
//    - peripheral(didDiscoverServices:) ........... line ~295
//    - peripheral(didDiscoverCharacteristicsFor:) . line ~317
//    - peripheral(didUpdateNotificationStateFor:) . line 364  (enable notify/indicate)
//    - peripheral(didUpdateValueFor:) ............. line 418  (RX bytes arrive here —
//      port FdcBleTransport.kt's appendIncomingBytes()/line-buffering logic next to it)
//    - peripheral(didWriteValueFor:) .............. line 687  (write/ACK completion —
//      mirrors FdcBleTransport.kt's pumpWriteQueue()/ACK sequence-number check)
//
//  One IMPORTANT difference from the Fujitsu sample, matching the Android
//  port's own simplification: don't port their scan-and-select UI. The
//  reader's BLE identifier is already known per-employee (admin Staff Roster
//  -> "Yometel Reader ID"), so connect(_:) below should go straight to
//  centralManager.retrievePeripherals(withIdentifiers:) / connect(peripheral:),
//  the same way FdcBleTransport.kt calls bluetoothAdapter.getRemoteDevice(mac)
//  directly instead of scanning.
//
//  Requires (see QRAuthApp-Bridging-Header.h in this folder for the one-time
//  Xcode setup this file needs before it will compile):
//    Info.plist: NSBluetoothAlwaysUsageDescription (not yet present — add it
//    alongside the existing NSCameraUsageDescription/NSLocationWhenInUseUsageDescription entries).
//
import Foundation
import CoreBluetooth

@objc(YometelRfidModule)
class YometelRfidModule: RCTEventEmitter {

  // MARK: - RCTEventEmitter

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    // Same event names as the Android module (YometelRfidModule.kt), so
    // src/native/yometelRfid.ts needs no changes once this is implemented.
    return ["YometelRfidConnected", "YometelRfidDisconnected", "YometelRfidError", "YometelRfidLine", "YometelRfidDebug"]
  }

  // MARK: - RN bridge methods (same signatures as the Android module)

  @objc(connect:resolver:rejecter:)
  func connect(_ macAddress: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO(phase 2): port FCLBluetoothLE.swift's connect() (line 757) using
    // CoreBluetooth's identifier-based retrievePeripherals(withIdentifiers:)
    // instead of a MAC string — iOS does not expose BLE MAC addresses the way
    // Android does, so the per-employee "Yometel Reader ID" stored today
    // (an Android MAC) will need an iOS-side CBUUID equivalent. Flag this to
    // the admin/backend team before wiring this up for real.
    reject("not_implemented", "Yometel iOS RFID support is not implemented yet.", nil)
  }

  @objc(disconnect:rejecter:)
  func disconnect(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO(phase 2): port FCLBluetoothLE.swift's disconnect() (line 767).
    resolve(nil)
  }

  @objc(sendCommand:resolver:rejecter:)
  func sendCommand(_ command: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // TODO(phase 2): port FCLBluetoothLE.swift's writeData(data:) (line 776),
    // \r-terminating `command` the same way FdcBleTransport.kt's
    // writeCommand() does.
    reject("not_implemented", "Yometel iOS RFID support is not implemented yet.", nil)
  }

  @objc func addListener(_ eventName: String) {
    // Required no-op for RN's NativeEventEmitter on iOS (see Android's
    // matching no-ops in YometelRfidModule.kt).
  }

  @objc func removeListeners(_ count: Double) {
    // Required no-op for RN's NativeEventEmitter on iOS.
  }
}
