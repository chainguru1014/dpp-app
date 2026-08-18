import React, { useRef } from 'react';
import { TouchableOpacity, TouchableOpacityProps, View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Props = TouchableOpacityProps & {
  from?: string;
  to?: string;
};

/**
 * Drop-in TouchableOpacity replacement that paints the brand gradient
 * (light azure -> dark navy) behind its children instead of a flat fill.
 * RN has no CSS gradient support, so this draws it via react-native-svg
 * (already a dependency, same technique as AppLayout's top bar).
 *
 * The gradient lives in its own absolutely-filled inner layer that clips via
 * `overflow: hidden` + `borderRadius` — the OUTER TouchableOpacity keeps the
 * caller's full original style (including shadow/elevation) untouched, so
 * the button's shape/shadow stay pixel-identical to the original flat-color
 * version; only the fill becomes a gradient (opaque, so it fully covers
 * whatever flat `backgroundColor` the original style still has).
 */
export default function GradientButton({ style, children, from = colors.headerLight, to = colors.primary, activeOpacity = 0.85, ...rest }: Props) {
  const id = useRef(`gbtn-${Math.random().toString(36).slice(2)}`).current;
  const flat = (StyleSheet.flatten(style) || {}) as { borderRadius?: number };

  return (
    <TouchableOpacity activeOpacity={activeOpacity} {...rest} style={style}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius, overflow: 'hidden' }]} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={from} stopOpacity={1} />
              <Stop offset="100%" stopColor={to} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </TouchableOpacity>
  );
}
