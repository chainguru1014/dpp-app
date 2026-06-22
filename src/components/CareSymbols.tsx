import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

const size = 48;
const stroke = 1.7;

// Brand-aligned colours: blue accent when picked, soft slate otherwise.
const ACTIVE = '#1976d2';
const IDLE = '#5b6b8c';

const common = {
  fill: 'none' as const,
  strokeWidth: stroke,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Evenly spread N filled dots across the symbol (heat / temperature level).
function dotPositions(count: number): number[] {
  if (count <= 1) return [16];
  if (count === 2) return [13, 19];
  return [11, 16, 21];
}

interface WashIconProps {
  temp: number;
  selected: boolean;
}

function WashIcon({ temp, selected }: WashIconProps) {
  const color = selected ? ACTIVE : IDLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Wavy water surface (top rim of the tub) */}
      <Path {...common} stroke={color} d="M6 12.5 q2.5 -2.6 5 0 t5 0 t5 0 t5 0" />
      {/* Tub body */}
      <Path
        {...common}
        stroke={color}
        d="M6 12.5 L7.6 23.4 Q7.9 26 10.3 26 L21.7 26 Q24.1 26 24.4 23.4 L26 12.5"
      />
      <SvgText
        x="16"
        y="22"
        textAnchor="middle"
        fontSize="9"
        fill={color}
        fontWeight="bold"
      >
        {temp}
      </SvgText>
    </Svg>
  );
}

interface DryCleanIconProps {
  letter: string;
  selected: boolean;
}

function DryCleanIcon({ letter, selected }: DryCleanIconProps) {
  const color = selected ? ACTIVE : IDLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="11.5" {...common} stroke={color} />
      <SvgText
        x="16"
        y="20.5"
        textAnchor="middle"
        fontSize="13"
        fill={color}
        fontWeight="bold"
      >
        {letter}
      </SvgText>
    </Svg>
  );
}

interface IronIconProps {
  dots: number;
  selected: boolean;
}

function IronIcon({ dots, selected }: IronIconProps) {
  const color = selected ? ACTIVE : IDLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Iron body with a pointed nose and a curved handle */}
      <Path
        {...common}
        stroke={color}
        d="M6 20.5 L25.5 20.5 L25.5 17 C25.5 13.5 22.5 11.5 18.5 11.5 L12 11.5 C9 11.5 6.8 13.8 6 17 Z"
      />
      <Path {...common} stroke={color} d="M12.5 11.5 C13.5 9.2 16.9 9.2 18 11.5" />
      {dotPositions(dots).map((cx, i) => (
        <Circle key={i} cx={cx} cy="17" r="1.6" fill={color} />
      ))}
    </Svg>
  );
}

interface BleachIconProps {
  allowed: boolean;
  selected: boolean;
}

function BleachIcon({ allowed, selected }: BleachIconProps) {
  const color = selected ? ACTIVE : IDLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path {...common} stroke={color} d="M16 5 L27 25 L5 25 Z" />
      {!allowed && (
        <Path
          {...common}
          stroke={color}
          strokeWidth={stroke * 1.3}
          d="M9.5 12 L22.5 23 M22.5 12 L9.5 23"
        />
      )}
    </Svg>
  );
}

interface TumbleDryIconProps {
  dots: number;
  selected: boolean;
}

function TumbleDryIcon({ dots, selected }: TumbleDryIconProps) {
  const color = selected ? ACTIVE : IDLE;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="4" y="4" width="24" height="24" rx="3.5" {...common} stroke={color} />
      <Circle cx="16" cy="16" r="6.5" {...common} stroke={color} />
      {dotPositions(Math.min(dots, 2)).map((cx, i) => (
        <Circle key={i} cx={cx} cy="16" r="1.5" fill={color} />
      ))}
    </Svg>
  );
}

const MAINTENANCE_ICON_CONFIG = [
  { id: 'wash_30', label: 'Wash 30', render: (selected: boolean) => <WashIcon temp={30} selected={selected} /> },
  { id: 'wash_40', label: 'Wash 40', render: (selected: boolean) => <WashIcon temp={40} selected={selected} /> },
  { id: 'wash_50', label: 'Wash 50', render: (selected: boolean) => <WashIcon temp={50} selected={selected} /> },
  { id: 'wash_60', label: 'Wash 60', render: (selected: boolean) => <WashIcon temp={60} selected={selected} /> },
  { id: 'wash_70', label: 'Wash 70', render: (selected: boolean) => <WashIcon temp={70} selected={selected} /> },
  { id: 'dry_clean_P', label: 'Dry clean P', render: (selected: boolean) => <DryCleanIcon letter="P" selected={selected} /> },
  { id: 'dry_clean_F', label: 'Dry clean F', render: (selected: boolean) => <DryCleanIcon letter="F" selected={selected} /> },
  { id: 'iron_low', label: 'Iron low', render: (selected: boolean) => <IronIcon dots={1} selected={selected} /> },
  { id: 'iron_med', label: 'Iron med', render: (selected: boolean) => <IronIcon dots={2} selected={selected} /> },
  { id: 'iron_high', label: 'Iron high', render: (selected: boolean) => <IronIcon dots={3} selected={selected} /> },
  { id: 'bleach_no', label: 'Bleach no', render: (selected: boolean) => <BleachIcon allowed={false} selected={selected} /> },
  { id: 'bleach_any', label: 'Bleach any', render: (selected: boolean) => <BleachIcon allowed={true} selected={selected} /> },
  { id: 'tumble_dry_low', label: 'Tumble dry low', render: (selected: boolean) => <TumbleDryIcon dots={1} selected={selected} /> },
  { id: 'tumble_dry_high', label: 'Tumble dry high', render: (selected: boolean) => <TumbleDryIcon dots={2} selected={selected} /> },
];

export function CareSymbol({ iconId, selected = false }: { iconId: string; selected?: boolean }) {
  const config = MAINTENANCE_ICON_CONFIG.find((c) => c.id === iconId);
  if (!config || typeof config.render !== 'function') return null;
  return (
    <View
      style={[
        styles.symbolContainer,
        selected && styles.symbolContainerSelected,
      ]}
    >
      <View style={styles.iconWrapper}>{config.render(selected)}</View>
    </View>
  );
}

export function getCareSymbolLabel(iconId: string): string {
  const config = MAINTENANCE_ICON_CONFIG.find((c) => c.id === iconId);
  return config?.label || iconId;
}

const styles = StyleSheet.create({
  symbolContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    minWidth: 76,
    height: 76,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7edf6',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#2f74c4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  symbolContainerSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#eaf2fd',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
