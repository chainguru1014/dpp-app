import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';
import { API_BASE_URL } from '../config/api';
import { colors, spacing, radius, shadow } from '../theme';

interface ProcessStep {
  entity: string;
  type: string;
}

// "Worker Operations" home screen for corporate/employee sessions — a numbered
// grid of the company's process step labels (managed by a Supervisor from the
// frontend admin's Process Step Labels page). Tapping a tile opens a Scan
// Operation session (CorporateScannerScreen) for that step.
export default function EmployeeHomeScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${API_BASE_URL}company/process-steps`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.status === 'success') {
          setSteps(data.data?.processSteps || []);
        }
      } catch (err) {
        console.error('Failed to load process steps:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('workerOperationsTitle')}</Text>
        <Text style={styles.subtitle}>{t('workerOperationsSubtitle')}</Text>

        {!loading && (
          <View style={styles.grid}>
            {steps.map((step, index) => (
              <TouchableOpacity
                key={index}
                style={styles.tile}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CorporateScanner', { stepIndex: index })}
              >
                <Text style={styles.tileNumber}>{index + 1}</Text>
                <Text style={styles.tileEntity} numberOfLines={1}>{step.entity}</Text>
                <Text style={styles.tileType} numberOfLines={1}>{step.type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 22, fontWeight: '600', color: colors.heading, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow(1),
  },
  tileNumber: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  tileEntity: { fontSize: 15, fontWeight: '600', color: colors.text },
  tileType: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
