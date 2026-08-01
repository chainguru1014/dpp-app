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

// Fixed set of step "type" categories — the Supervisor picks one of these
// (not free text) in the frontend admin, and here it's translated via i18n
// instead of displayed as stored. Keep in sync with backend/controllers/
// companyController.ts's PROCESS_STEP_TYPE_KEYS and frontend's
// ProcessStepsPage.js's TYPE_OPTIONS. A step whose type predates this fixed
// list (legacy free text) falls back to showing the raw stored value.
const TYPE_LABEL_KEYS: Record<string, string> = {
  receiving: 'stepTypeReceiving',
  shipping: 'stepTypeShipping',
  finalInspection: 'stepTypeFinalInspection',
  inboundScan: 'stepTypeInboundScan',
  packing: 'stepTypePacking',
  unpacking: 'stepTypeUnpacking',
  storeReceipt: 'stepTypeStoreReceipt',
  inspection: 'stepTypeInspection',
  returnCheck: 'stepTypeReturnCheck',
  disposal: 'stepTypeDisposal',
  general: 'stepTypeGeneral',
};

const SELECTED_STEP_STORAGE_KEY = 'employeeSelectedStepIndex';

// "Worker Operations" home screen for corporate/employee sessions — a numbered
// grid of the company's process step labels (managed by a Supervisor from the
// frontend admin's Process Step Labels page). Tapping a tile opens a Scan
// Operation session (CorporateScannerScreen) for that step, and the tapped
// step is remembered (AsyncStorage) so it's still shown highlighted if the
// worker comes back to this screen (via Back or a refresh).
export default function EmployeeHomeScreen({ navigation, user, onLogout }: any) {
  const { t } = useI18n();
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_STEP_STORAGE_KEY).then((stored) => {
      if (stored != null) setSelectedStep(Number(stored));
    });
  }, []);

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

  const handleSelectStep = (index: number) => {
    setSelectedStep(index);
    AsyncStorage.setItem(SELECTED_STEP_STORAGE_KEY, String(index)).catch(() => {});
    navigation.navigate('CorporateScanner', { stepIndex: index });
  };

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('workerOperationsTitle')}</Text>
        <Text style={styles.subtitle}>{t('workerOperationsSubtitle')}</Text>

        {!loading && (
          <View style={styles.grid}>
            {steps.map((step, index) => {
              const typeLabelKey = TYPE_LABEL_KEYS[step.type];
              const selected = selectedStep === index;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.tile, selected && styles.tileSelected]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectStep(index)}
                >
                  <View style={[styles.tileNumberBadge, selected && styles.tileNumberBadgeSelected]}>
                    <Text style={[styles.tileNumber, selected && styles.tileNumberSelected]}>{index + 1}</Text>
                  </View>
                  <View style={styles.tileTextBlock}>
                    <Text style={styles.tileEntity} numberOfLines={1}>{step.entity}</Text>
                    <Text style={styles.tileType} numberOfLines={1}>
                      {typeLabelKey ? t(typeLabelKey as any) : step.type}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: 22, fontWeight: '600', color: '#000', marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Number badge on the left, Entity/Type stacked on the right — matches the
  // frontend admin's Process Step Labels ordering (Entity first, Type below).
  // Selected state (persisted, see SELECTED_STEP_STORAGE_KEY) mirrors the
  // consumer HomeScreen's location tiles: dark-blue card border, dark-blue
  // number badge with white number text — entity/type stay unchanged.
  tile: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow(1),
  },
  tileSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  tileNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNumberBadgeSelected: {
    backgroundColor: colors.primary,
  },
  tileNumber: { fontSize: 14, fontWeight: '700', color: colors.primary },
  tileNumberSelected: { color: '#fff' },
  tileTextBlock: { flex: 1 },
  tileEntity: { fontSize: 14, fontWeight: '700', color: colors.text },
  tileType: { fontSize: 12, color: '#000', marginTop: 2 },
});
