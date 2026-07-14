import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

// Landing screen for the employee/staff route — deliberately separate from
// the consumer Home screen. Placeholder for now: ink-replacement authorization
// and other operational tooling described in the client brief depend on
// printer-IoT integration that doesn't exist in this codebase yet, so this
// screen only surfaces identity/role and sign-out.
export default function EmployeeHomeScreen({ user, onLogout }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Staff Console</Text>
        <Text style={styles.row}>Role: {user?.role || 'staff'}</Text>
        <Text style={styles.row}>Company domain: {user?.emailDomain || '-'}</Text>
        <Text style={styles.hint}>
          Ink-replacement authorization and other operational tooling will appear here once the
          printer-IoT integration is available.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onLogout}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: '#f3f4f6', borderRadius: radius.xl, padding: spacing.xxxl, width: '100%', maxWidth: 380, ...shadow(3) },
  title: { fontSize: 22, fontWeight: '600', color: colors.heading, marginBottom: spacing.lg, textAlign: 'center' },
  row: { fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.md, marginBottom: spacing.lg },
  button: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', ...shadow(1) },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '400' },
});
