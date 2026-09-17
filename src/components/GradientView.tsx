import React, { useRef, useState } from 'react';
import { View, StyleSheet, ViewProps, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../theme';

type Frame = {
  /** Combined height (px) of the full conceptual gradient this element is one slice of. */
  totalHeight: number;
  /** This element's own distance (px) from the top of that shared gradient. */
  offsetY: number;
};

type Props = ViewProps & {
  from?: string;
  to?: string;
  /** Gradient direction. 'diagonal' matches the brand header/button gradient. */
  angle?: 'diagonal' | 'horizontal' | 'vertical';
  /**
   * Renders this element as one slice of a larger gradient shared with an
   * adjacent sibling -- e.g. a screen's own colored header sitting directly
   * below AppLayout's gradient top bar -- instead of restarting its own
   * independent 0%-100% ramp at the seam between the two. Without this, two
   * stacked gradient elements each look "reset" (light again) right where
   * they meet, which reads as a visible seam even though the colors match.
   * Needs this element's own rendered size, so it paints one frame later
   * (after layout) instead of immediately.
   */
  frame?: Frame;
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
export default function GradientView({ style, children, from = colors.headerLight, to = colors.primary, angle = 'vertical', frame, onLayout, ...rest }: Props) {
  const id = useRef(`grad-${Math.random().toString(36).slice(2)}`).current;
  const flat = (StyleSheet.flatten(style) || {}) as { borderRadius?: number };
  const [x2, y2] = angle === 'horizontal' ? ['100%', '0%'] : angle === 'vertical' ? ['0%', '100%'] : ['100%', '100%'];
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  // Always measured (not just once `frame` is passed) -- `frame` can arrive
  // on a later render than the initial layout (e.g. a caller that measures
  // its own header height first, then feeds it back down as `frame`), and
  // View's onLayout only fires on an actual layout change, not on a prop
  // change alone. Measuring unconditionally means the size is already known
  // the moment `frame` does show up, instead of waiting on a layout event
  // that may never come again.
  const handleLayout = (e: LayoutChangeEvent) => {
    setMeasured({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
    onLayout?.(e);
  };

  return (
    <View style={style} onLayout={handleLayout} {...rest}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius, overflow: 'hidden' }]} pointerEvents="none">
        {frame ? (
          measured.width > 0 && (
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient
                  id={id}
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  y1={-frame.offsetY}
                  x2={angle === 'vertical' ? 0 : measured.width}
                  y2={frame.totalHeight - frame.offsetY}
                >
                  <Stop offset="0%" stopColor={from} stopOpacity={1} />
                  <Stop offset="100%" stopColor={to} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
            </Svg>
          )
        ) : (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id={id} x1="0%" y1="0%" x2={x2} y2={y2}>
                <Stop offset="0%" stopColor={from} stopOpacity={1} />
                <Stop offset="100%" stopColor={to} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        )}
      </View>
      {children}
    </View>
  );
}
