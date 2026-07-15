import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

interface AudienceToggleProps {
  value: 'consumer' | 'staff';
  onSelectConsumer: () => void;
  onSelectStaff: () => void;
}

// Clean pill-style "who are you" switch shown at the top of both sign-in
// cards (LoginScreen and StaffLoginScreen) — mirrors the web version
// (frontend/src/components/AudienceToggle) so switching between consumer and
// staff sign-in is a single obvious tap instead of a buried text link.
export default function AudienceToggle({ value, onSelectConsumer, onSelectStaff }: AudienceToggleProps) {
  return (
    <View style={styles.track}>
      <TouchableOpacity
        style={[styles.option, value === 'consumer' && styles.optionActive]}
        onPress={onSelectConsumer}
      >
        <Text style={[styles.optionText, value === 'consumer' && styles.optionTextActive]}>Consumer</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.option, value === 'staff' && styles.optionActive]}
        onPress={onSelectStaff}
      >
        <Text style={[styles.optionText, value === 'staff' && styles.optionTextActive]}>Staff</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  option: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.muted,
  },
  optionTextActive: {
    fontWeight: '600',
    color: '#1B5E20',
  },
});
