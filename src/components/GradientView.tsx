import React, { useRef } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Props = ViewProps & {
  from?: string;
  to?: string;
  /** Gradient direction. 'diagonal' matches the brand header/button gradient. */
  angle?: 'diagonal' | 'horizontal' | 'vertical';
};

/**
 * Plain (non-touchable) brand gradient fill, layered behind `children` via
 * react-native-svg — the same technique AppLayout's top bar already uses,
 * since RN has no CSS gradient support. Use GradientButton instead for
 * anything tappable.
 *
 * Clips via a nested `overflow: hidden` layer rather than the SVG rect's own
 * `rx`, so the shape stays pixel-identical to the original flat-color
 * version — the outer view keeps the caller's full original style untouched.
 */
export default function GradientView({ style, children, from = colors.headerLight, to = colors.primary, angle = 'diagonal', ...rest }: Props) {
  const id = useRef(`grad-${Math.random().toString(36).slice(2)}`).current;
  const flat = (StyleSheet.flatten(style) || {}) as { borderRadius?: number };
  const [x2, y2] = angle === 'horizontal' ? ['100%', '0%'] : angle === 'vertical' ? ['0%', '100%'] : ['100%', '100%'];

  return (
    <View style={style} {...rest}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius, overflow: 'hidden' }]} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0%" y1="0%" x2={x2} y2={y2}>
              <Stop offset="0%" stopColor={from} stopOpacity={1} />
              <Stop offset="100%" stopColor={to} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}
