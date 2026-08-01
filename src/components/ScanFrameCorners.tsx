import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ScanFrameCornersProps {
  size?: number;
  cornerLength?: number;
  thickness?: number;
  color?: string;
  active?: boolean;
  activeColor?: string;
}

// Four independent L-shaped corner marks (no connecting border) over a
// virtual square area — replaces a plain bordered rounded rectangle as the
// scan target overlay, on both the consumer ScannerScreen and the corporate
// CorporateScannerScreen, per explicit "cut rectangle's 4 corners only" request.
export default function ScanFrameCorners({
  size = 240,
  cornerLength = 32,
  thickness = 4,
  color = 'rgba(255,255,255,0.92)',
  active = false,
  activeColor,
}: ScanFrameCornersProps) {
  const borderColor = active ? (activeColor || color) : color;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.corner, { width: cornerLength, height: cornerLength, top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness, borderTopLeftRadius: 12, borderColor }]} />
      <View style={[styles.corner, { width: cornerLength, height: cornerLength, top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness, borderTopRightRadius: 12, borderColor }]} />
      <View style={[styles.corner, { width: cornerLength, height: cornerLength, bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness, borderBottomLeftRadius: 12, borderColor }]} />
      <View style={[styles.corner, { width: cornerLength, height: cornerLength, bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness, borderBottomRightRadius: 12, borderColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute' },
});
