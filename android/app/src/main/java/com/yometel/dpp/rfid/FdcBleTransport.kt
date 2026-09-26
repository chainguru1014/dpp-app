package com.yometel.dpp.rfid

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.nio.charset.StandardCharsets
import java.util.UUID

/**
 * BLE transport for the Yometel/CDEX UHF handheld reader — a port of Fujitsu
 * Component Ltd's "FDC" (Fujitsu Data Communication) protocol from their own
 * Android sample library (Old_RFID/Fujitsu/FDCP_Android_Sample_Application_v3_1_3/
 * libbluetoothle/.../FCLBluetoothLE.java), which is the proven-working reference
 * for this exact reader (confirmed against the CDEX device manual's own demo).
 *
 * Deliberate difference from Fujitsu's sample: their app requires a BLE scan +
 * manual device-selection step before connecting. We skip that entirely and
 * connect directly to a known MAC address (the employee's assigned reader,
 * set via the admin Staff Roster's "Yometel Reader ID" field) — one less
 * moving part, and it means BLUETOOTH_SCAN is not required, only
 * BLUETOOTH_CONNECT.
 *
 * This class only moves bytes: it establishes the FDC session and exposes a
 * line-buffered ASCII stream (commands/responses are `\r`-terminated per the
 * Yometel SW manual). It has zero knowledge of what RFVER/C1GEN2XX/etc. mean —
 * that parsing lives in JS (see app/src/native/yometelRfid.ts), matching the
 * project's "transport in Kotlin, protocol in TypeScript" split.
 */
class FdcBleTransport(private val context: Context) {

    interface Listener {
        fun onConnected()
        fun onDisconnected()
        fun onConnectFailed(reason: String)
        fun onLineReceived(line: String)
        // Intermediate BLE-handshake steps (MTU negotiated, services found,
        // notifications enabled, ...) — purely informational, for the
        // in-app connect-debug dialog. Not required for correctness.
        fun onProgress(step: String)
    }

    var listener: Listener? = null

    private val handler = Handler(Looper.getMainLooper())
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter

    private var gatt: BluetoothGatt? = null
    private var connectTimeoutRunnable: Runnable? = null

    // GATT characteristics, resolved once services are discovered.
    private var versionConfigServerChar: BluetoothGattCharacteristic? = null
    private var versionConfigClientChar: BluetoothGattCharacteristic? = null
    private var rxNotifyChar: BluetoothGattCharacteristic? = null
    private var rxIndicateChar: BluetoothGattCharacteristic? = null
    private var txWriteChar: BluetoothGattCharacteristic? = null

    // FDC session state — mirrors FCLBluetoothLE's fields.
    @Volatile private var isBleConnected = false
    @Volatile private var isFdcConnected = false
    @Volatile private var fdcTxConfig = 0 // 0=WRITE_REQUEST 1=WRITE_CMD 2=WRITE_CMD_ACK
    @Volatile private var fdcRxConfig = 0 // 0=INDICATION 1=NOTIFICATION 2=NOTIFICATION_ACK
    @Volatile private var maxTxPktCountPerAck = 1
    @Volatile private var maxRxPktCountPerAck = 1
    @Volatile private var txSeqNo = 0
    @Volatile private var rxSeqNo = 0
    @Volatile private var txCountForAck = 0
    @Volatile private var rxCountForAck = 0
    @Volatile private var txBusy = false
    @Volatile private var mtuNegotiated = 20

    // Outgoing command queue — one FDC session sends one command at a time
    // (matches how the app actually uses this: send a scan command, wait for
    // its response line, send the next one).
    private val pendingWrites = ArrayDeque<ByteArray>()

    // Incoming byte buffer, split into `\r`/`\n`-terminated ASCII lines.
    private val lineBuffer = StringBuilder()

    fun connect(macAddress: String) {
        val adapter = bluetoothAdapter
        if (adapter == null || !adapter.isEnabled) {
            listener?.onConnectFailed("Bluetooth is not available or disabled")
            return
        }
        val device: BluetoothDevice = try {
            adapter.getRemoteDevice(macAddress)
        } catch (e: IllegalArgumentException) {
            listener?.onConnectFailed("Invalid reader address: $macAddress")
            return
        }

        resetSessionState()
        progress("Connecting to $macAddress")
        connectTimeoutRunnable = Runnable {
            listener?.onConnectFailed("Connect timed out")
            disconnect()
        }
        handler.postDelayed(connectTimeoutRunnable!!, CONNECT_TIMEOUT_MS)

        gatt = device.connectGatt(context, false, gattCallback)
    }

    fun disconnect() {
        clearConnectTimeout()
        if (gatt != null) progress("Disconnecting…")
        val g = gatt
        if (g != null) {
            try {
                rxIndicateChar?.let { setNotification(g, it, false) }
                rxNotifyChar?.let { setNotification(g, it, false) }
            } catch (e: SecurityException) {
                // BLUETOOTH_CONNECT missing/revoked — nothing more we can do.
            }
            try {
                g.disconnect()
                g.close()
            } catch (e: SecurityException) {
            }
        }
        gatt = null
        val wasFdcConnected = isFdcConnected
        resetSessionState()
        if (wasFdcConnected) listener?.onDisconnected()
    }

    /** Sends one ASCII command (a `\r` terminator is appended if missing). */
    fun writeCommand(command: String) {
        val text = if (command.endsWith("\r")) command else "$command\r"
        val bytes = text.toByteArray(StandardCharsets.US_ASCII)
        pendingWrites.addLast(bytes)
        pumpWriteQueue()
    }

    private fun progress(step: String) {
        handler.post { listener?.onProgress(step) }
    }

    private fun resetSessionState() {
        isBleConnected = false
        isFdcConnected = false
        versionConfigServerChar = null
        versionConfigClientChar = null
        rxNotifyChar = null
        rxIndicateChar = null
        txWriteChar = null
        txSeqNo = 0
        rxSeqNo = 0
        txCountForAck = 0
        rxCountForAck = 0
        txBusy = false
        mtuNegotiated = 20
        pendingWrites.clear()
        lineBuffer.clear()
    }

    private fun clearConnectTimeout() {
        connectTimeoutRunnable?.let { handler.removeCallbacks(it) }
        connectTimeoutRunnable = null
    }

    @Suppress("MissingPermission") // BLUETOOTH_CONNECT is declared in the manifest; runtime grant is checked by the JS layer before connect() is ever called.
    private val gattCallback = object : BluetoothGattCallback() {

        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                isBleConnected = true
                progress("BLE link established, requesting MTU $REQUEST_MTU_SIZE")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    g.requestMtu(REQUEST_MTU_SIZE)
                } else {
                    g.discoverServices()
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                clearConnectTimeout()
                val wasFdcConnected = isFdcConnected
                resetSessionState()
                gatt = null
                if (wasFdcConnected) {
                    handler.post { listener?.onDisconnected() }
                } else {
                    handler.post { listener?.onConnectFailed("Bluetooth connection failed (status=$status)") }
                }
            }
        }

        override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
            mtuNegotiated = mtu - 3
            progress("MTU negotiated: $mtuNegotiated, discovering services")
            g.discoverServices()
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                handler.post { listener?.onConnectFailed("Service discovery failed") }
                return
            }
            val service = g.services?.firstOrNull { it.uuid == SERVICE_UUID }
            if (service == null) {
                handler.post { listener?.onConnectFailed("Reader did not expose the expected FDC service") }
                return
            }
            for (characteristic in service.characteristics) {
                when (characteristic.uuid) {
                    VERSION_CONFIG_SERVER_UUID -> versionConfigServerChar = characteristic
                    VERSION_CONFIG_CLIENT_UUID -> versionConfigClientChar = characteristic
                    RX_NOTIFY_UUID -> rxNotifyChar = characteristic
                    RX_INDICATE_UUID -> rxIndicateChar = characteristic
                    TX_WRITE_UUID -> txWriteChar = characteristic
                }
            }
            val serverChar = versionConfigServerChar
            if (serverChar == null) {
                handler.post { listener?.onConnectFailed("Reader is missing the version/config characteristic") }
                return
            }
            progress("Services discovered, reading reader version/config")
            g.readCharacteristic(serverChar)
        }

        override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            if (characteristic.uuid == TX_WRITE_UUID) {
                // Reply to the read triggered from onCharacteristicWrite's
                // ACK-mode branch — the reader writes an ACK byte
                // (seq-1 | ACK_BIT) into this same characteristic for us to
                // read back. A mismatched/missing ACK just means "try
                // again" here rather than a hard failure — the reader will
                // still have the command queued on its side.
                val data = characteristic.value
                txBusy = false
                if (status == BluetoothGatt.GATT_SUCCESS && data != null && data.isNotEmpty()) {
                    val ackByte = data[0].toInt()
                    // Matches FCLBluetoothLE's own check: the ACK echoes the
                    // sent packet's seq number, so (ackSeq + 1) should equal
                    // the NEXT seq we're about to send (txSeqNo, already
                    // incremented past the sent packet in pumpWriteQueue).
                    val ackOk = (ackByte and ACK_BIT) != 0 && (SEQ_NO_MASK and (ackByte + 1)) == (SEQ_NO_MASK and txSeqNo)
                    if (ackOk) {
                        pumpWriteQueue()
                    } else {
                        // Sequence mismatch — resend is out of scope for this
                        // scaffold; surface it so the JS layer can retry the
                        // whole command instead of hanging silently.
                        handler.post { listener?.onConnectFailed("RFID reader ACK sequence mismatch — retry the command") }
                    }
                } else {
                    g.readCharacteristic(characteristic)
                }
                return
            }
            if (characteristic.uuid != VERSION_CONFIG_SERVER_UUID) return
            if (status != BluetoothGatt.GATT_SUCCESS) {
                handler.post { listener?.onConnectFailed("Could not read reader version/config") }
                return
            }
            val data = characteristic.value
            if (data == null || data.size < 8) {
                handler.post { listener?.onConnectFailed("Unexpected version/config response") }
                return
            }
            // Byte layout per Fujitsu's FDC protocol: [0..2]=fw version,
            // [3]=rxConfig(low nibble)/txConfig(high nibble),
            // [4]=maxRxPktCountPerAck(low)/maxTxPktCountPerAck(high).
            fdcRxConfig = data[3].toInt() and 0x0F
            fdcTxConfig = (data[3].toInt() shr 4) and 0x0F
            maxRxPktCountPerAck = data[4].toInt() and 0x0F
            maxTxPktCountPerAck = (data[4].toInt() shr 4) and 0x0F

            // Enable indication if the reader offers it (and reports it as the
            // RX mode), otherwise fall back to plain notification — either way
            // this is the first descriptor write in the handshake.
            val useIndication = fdcRxConfig == 0 && rxIndicateChar != null
            val notifyChar = if (useIndication) rxIndicateChar else rxNotifyChar
            if (notifyChar == null) {
                handler.post { listener?.onConnectFailed("Reader has no usable RX characteristic") }
                return
            }
            progress("Reader config read (txConfig=$fdcTxConfig rxConfig=$fdcRxConfig) — enabling notifications")
            enableCharacteristicNotification(g, notifyChar, indication = useIndication)
        }

        override fun onDescriptorWrite(g: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                handler.post { listener?.onConnectFailed("Could not enable notifications on the reader") }
                return
            }
            val characteristic = descriptor.characteristic
            when (characteristic?.uuid) {
                RX_INDICATE_UUID -> {
                    // Indication enabled — if a plain-notify RX char also
                    // exists, enable that too (some firmware exposes both);
                    // otherwise go straight to finishing the handshake.
                    val notifyChar = rxNotifyChar
                    if (notifyChar != null) {
                        enableCharacteristicNotification(g, notifyChar, indication = false)
                    } else {
                        writeVersionConfigClient(g)
                    }
                }
                RX_NOTIFY_UUID -> writeVersionConfigClient(g)
            }
        }

        override fun onCharacteristicWrite(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            when (characteristic.uuid) {
                VERSION_CONFIG_CLIENT_UUID -> {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        isFdcConnected = true
                        txSeqNo = 0
                        rxSeqNo = 0
                        clearConnectTimeout()
                        handler.post { listener?.onConnected() }
                    } else {
                        handler.post { listener?.onConnectFailed("Reader rejected the session handshake") }
                    }
                }
                TX_WRITE_UUID -> {
                    txBusy = false
                    if (fdcTxConfig == TX_CONFIG_WRITE_CMD_ACK) {
                        txCountForAck++
                        if (txCountForAck >= maxTxPktCountPerAck) {
                            txCountForAck = 0
                            // Read the char back to pick up the ACK byte the
                            // reader wrote in response — see onCharacteristicRead's
                            // TX_WRITE_UUID branch below.
                            g.readCharacteristic(characteristic)
                            return
                        }
                    }
                    pumpWriteQueue()
                }
            }
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            val data = characteristic.value ?: return
            when (characteristic.uuid) {
                RX_NOTIFY_UUID -> handleIncomingRxPayload(data, ackMode = fdcRxConfig == NOTIFICATION_ACK)
                RX_INDICATE_UUID -> appendIncomingBytes(data, 0)
            }
        }
    }

    // --- Handshake helpers -----------------------------------------------

    private fun enableCharacteristicNotification(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, indication: Boolean) {
        g.setCharacteristicNotification(characteristic, true)
        val descriptor = characteristic.getDescriptor(CCCD_UUID) ?: run {
            handler.post { listener?.onConnectFailed("Reader characteristic is missing its config descriptor") }
            return
        }
        descriptor.value = if (indication) {
            BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
        } else {
            BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        }
        g.writeDescriptor(descriptor)
    }

    private fun writeVersionConfigClient(g: BluetoothGatt) {
        val clientChar = versionConfigClientChar ?: run {
            handler.post { listener?.onConnectFailed("Reader is missing the version/config client characteristic") }
            return
        }
        progress("Notifications enabled — sending session handshake")
        // Version(1.1) + reserved bytes, matching FCLBluetoothLE's
        // versionConfigClient default — remote/legacy-mode bits left off,
        // this app never requests "remote mode".
        clientChar.value = byteArrayOf(1, 1, 0, 0, 0, 0, 0, 0)
        clientChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        g.writeCharacteristic(clientChar)
    }

    // --- RX (reader -> phone) ---------------------------------------------

    private fun handleIncomingRxPayload(data: ByteArray, ackMode: Boolean) {
        if (!ackMode) {
            appendIncomingBytes(data, 0)
            return
        }
        if (data.isEmpty()) return
        val header = data[0].toInt()
        val seq = header and SEQ_NO_MASK
        if (seq != (rxSeqNo and SEQ_NO_MASK)) return // out-of-order packet, drop (matches Fujitsu's own behavior)
        appendIncomingBytes(data, 1)
        rxSeqNo++
        rxCountForAck++
        if (rxCountForAck >= maxRxPktCountPerAck) {
            rxCountForAck = 0
            sendRxAck((header and SEQ_NO_MASK) or ACK_BIT)
        }
    }

    private fun sendRxAck(ackByte: Int) {
        val g = gatt ?: return
        val notifyChar = rxNotifyChar ?: return
        notifyChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        notifyChar.value = byteArrayOf(ackByte.toByte())
        g.writeCharacteristic(notifyChar)
    }

    private fun appendIncomingBytes(data: ByteArray, offset: Int) {
        if (offset >= data.size) return
        val text = String(data, offset, data.size - offset, StandardCharsets.US_ASCII)
        lineBuffer.append(text)
        var idx: Int
        while (true) {
            idx = lineBuffer.indexOfAny(charArrayOf('\r', '\n'))
            if (idx < 0) break
            val line = lineBuffer.substring(0, idx).trim()
            lineBuffer.delete(0, idx + 1)
            if (line.isNotEmpty()) {
                handler.post { listener?.onLineReceived(line) }
            }
        }
    }

    // --- TX (phone -> reader) ----------------------------------------------

    private fun pumpWriteQueue() {
        if (txBusy) return
        val g = gatt ?: return
        val writeChar = txWriteChar ?: return
        if (!isFdcConnected) return
        val next = pendingWrites.removeFirstOrNull() ?: return

        val chunkSize = (mtuNegotiated - if (fdcTxConfig == TX_CONFIG_WRITE_CMD_ACK) 1 else 0).coerceAtLeast(1)
        val chunk = if (next.size > chunkSize) next.copyOfRange(0, chunkSize) else next
        val remainder = if (next.size > chunkSize) next.copyOfRange(chunkSize, next.size) else null

        val payload = if (fdcTxConfig == TX_CONFIG_WRITE_CMD_ACK) {
            val seq = txSeqNo and SEQ_NO_MASK
            txSeqNo++
            byteArrayOf(seq.toByte()) + chunk
        } else {
            chunk
        }

        writeChar.writeType = if (fdcTxConfig == TX_CONFIG_WRITE_REQUEST) {
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        } else {
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
        }
        writeChar.value = payload
        txBusy = true
        val ok = g.writeCharacteristic(writeChar)
        if (!ok) {
            txBusy = false
            handler.post { listener?.onConnectFailed("Failed to write command to reader") }
            return
        }
        if (remainder != null) pendingWrites.addFirst(remainder)
    }

    private fun setNotification(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, enabled: Boolean) {
        g.setCharacteristicNotification(characteristic, enabled)
        val descriptor = characteristic.getDescriptor(CCCD_UUID) ?: return
        descriptor.value = if (enabled) {
            BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        } else {
            BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
        }
        g.writeDescriptor(descriptor)
    }

    companion object {
        private val SERVICE_UUID: UUID = UUID.fromString("0000fc00-b8a4-4078-874c-14efbd4b510a")
        private val VERSION_CONFIG_SERVER_UUID: UUID = UUID.fromString("0000fc10-b8a4-4078-874c-14efbd4b510a")
        private val VERSION_CONFIG_CLIENT_UUID: UUID = UUID.fromString("0000fc11-b8a4-4078-874c-14efbd4b510a")
        private val RX_NOTIFY_UUID: UUID = UUID.fromString("0000fc12-b8a4-4078-874c-14efbd4b510a")
        private val RX_INDICATE_UUID: UUID = UUID.fromString("0000fc13-b8a4-4078-874c-14efbd4b510a")
        private val TX_WRITE_UUID: UUID = UUID.fromString("0000fc14-b8a4-4078-874c-14efbd4b510a")
        private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        private const val REQUEST_MTU_SIZE = 512
        private const val CONNECT_TIMEOUT_MS = 15000L

        private const val TX_CONFIG_WRITE_REQUEST = 0
        private const val TX_CONFIG_WRITE_CMD_ACK = 2
        private const val NOTIFICATION_ACK = 2

        private const val SEQ_NO_MASK = 0x0F
        private const val ACK_BIT = 0x10
    }
}
