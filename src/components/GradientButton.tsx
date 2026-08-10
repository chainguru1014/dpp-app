import React, { useRef } from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleSheet } from 'react-native';
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
 * Any `backgroundColor` in `style` is ignored/overridden — leave the rest
 * of the style (padding, borderRadius, shadow, etc.) as-is.
 */
export default function GradientButton({ style, children, from = colors.headerLight, to = colors.primary, activeOpacity = 0.85, ...rest }: Props) {
  const id = useRef(`gbtn-${Math.random().toString(36).slice(2)}`).current;
  const flat = (StyleSheet.flatten(style) || {}) as { borderRadius?: number };
  const radius = flat.borderRadius || 0;

  return (
    <TouchableOpacity activeOpacity={activeOpacity} {...rest} style={[style, { backgroundColor: 'transparent' }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={from} stopOpacity={1} />
            <Stop offset="100%" stopColor={to} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" rx={radius} fill={`url(#${id})`} />
      </Svg>
      {children}
    </TouchableOpacity>
  );
}
