package com.yometel.dpp.rfid

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Classic (non-TurboModule) RN bridge for [FdcBleTransport] — this app has
 * New Architecture off (see android/gradle.properties) and no existing
 * TurboModule/Codegen convention, so this follows the stock
 * ReactContextBaseJavaModule + ReactPackage pattern instead.
 *
 * JS-side wrapper: app/src/native/yometelRfid.ts — that's where the FDC ASCII
 * protocol (RFVER/C1GEN2XX/etc.) actually lives; this module only exposes
 * connect/disconnect/sendCommand plus a raw line-received event.
 */
class YometelRfidModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val transport = FdcBleTransport(reactContext.applicationContext)

    init {
        transport.listener = object : FdcBleTransport.Listener {
            override fun onConnected() {
                emit(EVENT_CONNECTED, null)
            }

            override fun onDisconnected() {
                emit(EVENT_DISCONNECTED, null)
            }

            override fun onConnectFailed(reason: String) {
                val params = Arguments.createMap()
                params.putString("message", reason)
                emit(EVENT_ERROR, params)
            }

            override fun onLineReceived(line: String) {
                val params = Arguments.createMap()
                params.putString("line", line)
                emit(EVENT_LINE, params)
            }
        }
    }

    override fun getName(): String = "YometelRfidModule"

    @ReactMethod
    fun connect(macAddress: String, promise: Promise) {
        try {
            transport.connect(macAddress)
            promise.resolve(null)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "BLUETOOTH_CONNECT permission not granted", e)
        } catch (e: Exception) {
            promise.reject("CONNECT_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            transport.disconnect()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DISCONNECT_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun sendCommand(command: String, promise: Promise) {
        try {
            transport.writeCommand(command)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SEND_FAILED", e.message, e)
        }
    }

    // RN's JS-side NativeEventEmitter requires these two even though this
    // module emits via DeviceEventEmitter directly rather than tracking
    // listener counts natively — standard no-op boilerplate.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun emit(eventName: String, params: Any?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    companion object {
        const val EVENT_CONNECTED = "YometelRfidConnected"
        const val EVENT_DISCONNECTED = "YometelRfidDisconnected"
        const val EVENT_ERROR = "YometelRfidError"
        const val EVENT_LINE = "YometelRfidLine"
    }
}
