import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native';
import AppLayout from '../components/AppLayout';
import { colors, spacing, radius, ui, shadow } from '../theme';

interface PrivatePolicyScreenProps {
  navigation: any;
  route: any;
  user?: any;
  onLogout?: () => void;
}

export default function PrivatePolicyScreen({
  navigation,
  route,
  user,
  onLogout,
}: PrivatePolicyScreenProps) {
  const TOP_BAR_HEIGHT = 70;
  const BOTTOM_BAR_HEIGHT = 70;
  const [confirmed, setConfirmed] = useState(false);
  const { height } = useWindowDimensions();
  const productData = route?.params?.productData;
  const securityPassed = !!route?.params?.securityPassed;
  const productId = route?.params?.productId ?? productData?._id;
  const qrcodeId = route?.params?.qrcodeId ?? productData?.token_id;
  const hasIds = productId != null && qrcodeId != null;
  const policyLink = 'https://drive.google.com/file/d/1IOZdGmllCbvpb7MYEbhxay9M722ID0D/view?usp=sharing';
  const contentMinHeight = Math.max(0, height - TOP_BAR_HEIGHT - BOTTOM_BAR_HEIGHT);

  const handleConfirm = () => {
    const next = !confirmed;
    setConfirmed(next);
    if (next) {
      navigation.replace('Result', {
        securityPassed,
        ...(hasIds ? {} : { productData }),
        ...(productId != null ? { productId: String(productId) } : {}),
        ...(qrcodeId != null ? { qrcodeId: String(qrcodeId) } : {}),
      });
    }
  };

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={true}
      onBackPress={() => navigation.goBack()}
    >
      <View style={styles.container}>
        <ScrollView
          style={[styles.content, { minHeight: contentMinHeight }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.updated}>LAST UPDATED: MARCH 21, 2026</Text>

          <View style={styles.card}>
            <Text style={styles.paragraph}>
              This Privacy Policy explains how Yometel Co., Ltd. ("Yometel", "we", "our", or "us")
              collects, uses, discloses, and protects personal data in connection with our Digital
              Product Passport (DPP) platform, including mobile applications, web applications, and
              related services (collectively, the "Services").
            </Text>
            <Text style={styles.paragraph}>
              Yometel is committed to ensuring that your privacy is protected and that your personal
              data is processed in accordance with applicable data protection laws, including the
              General Data Protection Regulation (EU) 2016/679 ("GDPR").
            </Text>

            <TouchableOpacity onPress={() => Linking.openURL(policyLink)} activeOpacity={0.8}>
              <Text style={styles.link}>{policyLink}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.confirmRow} onPress={handleConfirm} activeOpacity={0.8}>
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
              {confirmed && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.confirmLabel}>I read and confirmed</Text>
          </TouchableOpacity>
        </ScrollView>

      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    minHeight: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...ui.screenTitle,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  updated: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow(1),
    marginBottom: spacing.lg,
  },
  paragraph: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  link: {
    marginTop: spacing.xs,
    fontSize: 15,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadow(1),
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  confirmLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
});
