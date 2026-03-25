import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

const size = 48;
const stroke = 1.8;

interface WashIconProps {
  temp: number;
  selected: boolean;
}

function WashIcon({ temp, selected }: WashIconProps) {
  const color = selected ? '#1976d2' : '#333';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        d="M6 10c0-2 2-4 6-4h8c4 0 6 2 6 4v14H6V10z"
      />
      <Path fill="none" stroke={color} strokeWidth={stroke} d="M6 16h20" />
      <SvgText
        x="16"
        y="14"
        textAnchor="middle"
        fontSize="8"
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
  const color = selected ? '#1976d2' : '#333';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth={stroke} />
      <SvgText
        x="16"
        y="20"
        textAnchor="middle"
        fontSize="12"
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
  const color = selected ? '#1976d2' : '#333';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        d="M8 6h16l-4 20H12L8 6z"
      />
      <Path fill="none" stroke={color} strokeWidth={stroke} d="M8 12h16" />
      {[1, 2, 3].slice(0, dots).map((_, i) => (
        <Circle
          key={i}
          cx={12 + i * 8}
          cy="22"
          r="2.5"
          fill={color}
        />
      ))}
    </Svg>
  );
}

interface BleachIconProps {
  allowed: boolean;
  selected: boolean;
}

function BleachIcon({ allowed, selected }: BleachIconProps) {
  const color = selected ? '#1976d2' : '#333';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        d="M16 4L6 28h20L16 4z"
      />
      {!allowed && (
        <Path
          fill="none"
          stroke={color}
          strokeWidth={stroke * 1.5}
          d="M8 8l16 16M24 8l-16 16"
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
  const color = selected ? '#1976d2' : '#333';
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth={stroke} />
      {[1, 2].slice(0, dots).map((_, i) => (
        <Circle
          key={i}
          cx={12 + i * 8}
          cy="16"
          r="2.5"
          fill={color}
        />
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
    width: 80,
    minWidth: 80,
    padding: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'transparent',
    marginRight: 8,
    marginBottom: 8,
  },
  symbolContainerSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
