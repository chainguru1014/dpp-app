import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import GradientView from '../components/GradientView';
import { API_BASE_URL } from '../config/api';
import { COUNTRIES } from '../constants/countries';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

let launchImageLibrary: any = null;
try {
  launchImageLibrary = require('react-native-image-picker').launchImageLibrary;
} catch (e) {
  console.warn('react-native-image-picker not available:', e);
}

const fileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${API_BASE_URL}files/${String(filename).replace(/^\/+/, '')}`;
};

export default function EditProfileScreen({ navigation, route, user, onLogout, onUserUpdate }: any) {
  const { t, locale } = useI18n();
  const isEmployee = user?.actorKind === 'Employee';
  const isAgent = isEmployee || user?.userType === 'agent';

  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  const build = (u: any = user) => ({
    nickname: u?.nickname || '',
    gender: u?.gender || '',
    country: u?.country || u?.addressCountry || '',
    birthYear: u?.birthYear ? String(u.birthYear) : '',
    avatar: u?.avatar || '',
    // agent-only (staff / corporate) — full field set, matches the unchanged
    // backend updateProfile agent branch.
    name: u?.name || '',
    email: u?.email || '',
    firstName: u?.firstName || '',
    lastName: u?.lastName || '',
    phoneNumber: u?.phoneNumber || '',
    addressStreet: u?.addressStreet || '',
    addressCity: u?.addressCity || '',
    addressState: u?.addressState || '',
    addressZipCode: u?.addressZipCode || '',
    addressCountry: u?.addressCountry || '',
    dateOfBirth: u?.dateOfBirth || '',
  });
  const [profile, setProfile] = useState<any>(build());

  useEffect(() => {
    if (user) setProfile(build(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const genderOptions = useMemo(() => {
    const labels: Record<string, { male: string; female: string }> = {
      en: { male: 'Male', female: 'Female' },
      ja: { male: '男性', female: '女性' },
      de: { male: 'Männlich', female: 'Weiblich' },
      fr: { male: 'Homme', female: 'Femme' },
      nl: { male: 'Man', female: 'Vrouw' },
    };
    const s = labels[locale] || labels.en;
    return [
      { value: 'male', label: s.male },
      { value: 'female', label: s.female },
    ];
  }, [locale]);

  const setField = (key: string, value: string) => {
    setProfile((p: any) => ({ ...p, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const pickAvatar = () => {
    if (!launchImageLibrary) {
      Alert.alert(t('error'), t('editProfilePhotoUnavailable'));
      return;
    }
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false }, async (resp: any) => {
      if (resp?.didCancel || resp?.errorCode) return;
      const asset = resp?.assets && resp.assets[0];
      if (!asset?.uri) return;
      setUploadingAvatar(true);
      try {
        const form = new FormData();
        form.append('file', {
          uri: asset.uri,
          name: asset.fileName || 'avatar.jpg',
          type: asset.type || 'image/jpeg',
        } as any);
        const res = await fetch(`${API_BASE_URL}upload/single`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data?.url || data?.path)) {
          setField('avatar', data.url || data.path);
        } else {
          Alert.alert(t('error'), data?.message || t('editProfileUploadFailed'));
        }
      } catch (err: any) {
        Alert.alert(t('error'), err?.message || t('editProfileUploadFailed'));
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (isAgent) {
      const req = (k: string, label: string) => {
        if (!String(profile[k] || '').trim()) errs[k] = `${label} ${t('pleaseFillAllRequired')}`;
      };
      req('name', t('username'));
      req('email', t('email'));
      req('firstName', t('firstName'));
      req('lastName', t('lastName'));
      req('addressStreet', t('street'));
      req('addressCity', t('city'));
      req('addressState', t('state'));
      req('addressZipCode', t('zipCode'));
      req('addressCountry', t('country'));
      req('phoneNumber', t('phoneNumber'));
      req('dateOfBirth', t('dateOfBirth'));
      if (!profile.gender) errs.gender = t('genderRequired');
    } else {
      if (!profile.nickname.trim()) errs.nickname = t('pleaseFillAllRequired');
      if (!profile.gender) errs.gender = t('genderRequired');
      if (!/^\d{4}$/.test(profile.birthYear)) errs.birthYear = t('ageRequired');
      if (!profile.country) errs.country = t('countryRequired');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async () => {
    if (!user?._id) {
      Alert.alert(t('error'), t('userNotFound'));
      return;
    }
    if (!validate()) return;
    setSaveError('');
    setLoading(true);
    try {
      const payload: any = isAgent
        ? {
            userType: 'agent',
            name: profile.name.trim(),
            email: profile.email.trim(),
            firstName: profile.firstName.trim(),
            lastName: profile.lastName.trim(),
            addressStreet: profile.addressStreet.trim(),
            addressCity: profile.addressCity.trim(),
            addressState: profile.addressState.trim(),
            addressZipCode: profile.addressZipCode.trim(),
            addressCountry: profile.addressCountry.trim(),
            phoneNumber: profile.phoneNumber.trim(),
            gender: profile.gender,
            dateOfBirth: profile.dateOfBirth.trim(),
          }
        : {
            userType: 'client',
            nickname: profile.nickname.trim(),
            gender: profile.gender,
            birthYear: Number(profile.birthYear),
            country: profile.country,
            avatar: profile.avatar || '',
          };

      const res = await fetch(`${API_BASE_URL}user/profile/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== 'success') {
        const msg = data.message || t('failedToUpdateProfile');
        setSaveError(msg);
        return;
      }
      const updated = { ...(data.user || data.data || {}), actorKind: user.actorKind };
      await AsyncStorage.setItem('userToken', data.token || '');
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      onUserUpdate?.(updated);
      navigation.navigate(isEmployee ? 'EmployeeHome' : 'Scanner');
    } catch (err: any) {
      setSaveError(err?.message || t('failedToUpdateProfile'));
    } finally {
      setLoading(false);
    }
  };

  const avatarUri = profile.avatar ? fileUrl(profile.avatar) : '';

  return (
    <AppLayout navigation={navigation} user={user} onLogout={onLogout} showBackButton onBackPress={() => navigation.goBack()} flatContent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
          {!isAgent && (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Icon name="person" size={54} color={colors.placeholder} />
                )}
              </View>
              <TouchableOpacity style={styles.avatarBadge} onPress={pickAvatar} activeOpacity={0.8}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="photo-camera" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {!!saveError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{saveError}</Text>
            </View>
          )}

          {isAgent ? (
            <>
              <Field label={t('username')} value={profile.name} onChangeText={(v: string) => setField('name', v)} error={fieldErrors.name} />
              <Field label={t('email')} value={profile.email} onChangeText={(v: string) => setField('email', v)} error={fieldErrors.email} keyboardType="email-address" autoCapitalize="none" />
              <Field label={t('firstName')} value={profile.firstName} onChangeText={(v: string) => setField('firstName', v)} error={fieldErrors.firstName} />
              <Field label={t('lastName')} value={profile.lastName} onChangeText={(v: string) => setField('lastName', v)} error={fieldErrors.lastName} />
              <Field label={t('street')} value={profile.addressStreet} onChangeText={(v: string) => setField('addressStreet', v)} error={fieldErrors.addressStreet} />
              <Field label={t('city')} value={profile.addressCity} onChangeText={(v: string) => setField('addressCity', v)} error={fieldErrors.addressCity} />
              <Field label={t('state')} value={profile.addressState} onChangeText={(v: string) => setField('addressState', v)} error={fieldErrors.addressState} />
              <Field label={t('zipCode')} value={profile.addressZipCode} onChangeText={(v: string) => setField('addressZipCode', v)} error={fieldErrors.addressZipCode} />
              <Field label={t('country')} value={profile.addressCountry} onChangeText={(v: string) => setField('addressCountry', v)} error={fieldErrors.addressCountry} />
              <Field label={t('phoneNumber')} value={profile.phoneNumber} onChangeText={(v: string) => setField('phoneNumber', v)} error={fieldErrors.phoneNumber} keyboardType="phone-pad" />
              <Field label={t('dateOfBirth')} value={profile.dateOfBirth} onChangeText={(v: string) => setField('dateOfBirth', v)} error={fieldErrors.dateOfBirth} placeholder="YYYY-MM-DD" />
            </>
          ) : (
            <Field label={t('editProfileNickname')} value={profile.nickname} onChangeText={(v: string) => setField('nickname', v)} error={fieldErrors.nickname} autoCapitalize="none" />
          )}

          <Text style={styles.label}>{t('gender')}</Text>
          <View style={styles.genderRow}>
            {genderOptions.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[styles.genderOption, profile.gender === o.value && styles.genderOptionActive]}
                onPress={() => setField('gender', o.value)}
                activeOpacity={0.8}
              >
                {profile.gender === o.value && <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />}
                <Text style={[styles.genderText, profile.gender === o.value && styles.genderTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}

          {!isAgent && (
            <Field
              label={t('birthYear')}
              value={profile.birthYear}
              onChangeText={(v: string) => setField('birthYear', v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="numeric"
              error={fieldErrors.birthYear}
            />
          )}

          {!isAgent && (
            <>
              <Text style={styles.label}>{t('country')}</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setCountryModalVisible(true)} activeOpacity={0.8}>
                <Text style={profile.country ? styles.selectValue : styles.selectPlaceholder}>
                  {profile.country || t('selectCountry')}
                </Text>
                <Icon name="expand-more" size={22} color={colors.muted} />
              </TouchableOpacity>
              {!!fieldErrors.country && <Text style={styles.errorText}>{fieldErrors.country}</Text>}
            </>
          )}

          <GradientButton style={[styles.saveButton, loading && { opacity: 0.6 }]} onPress={save} disabled={loading}>
            <Text style={styles.saveText}>{loading ? t('saving') : t('editProfileSaveChanges')}</Text>
          </GradientButton>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={countryModalVisible} transparent animationType="slide" onRequestClose={() => setCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('selectCountry')}</Text>
            <ScrollView>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={styles.countryItem}
                  onPress={() => {
                    setField('country', c);
                    setCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.countryItemText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

function Field({ label, error, ...rest }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.placeholder} {...rest} />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.xl },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBannerText: { color: colors.danger, fontSize: fontSize.md },
  label: { fontSize: fontSize.md, color: colors.primaryDark, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  genderRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  genderOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    overflow: 'hidden',
  },
  genderOptionActive: { borderColor: colors.primary },
  genderText: { color: colors.muted, fontSize: fontSize.md },
  genderTextActive: { color: colors.white, fontWeight: '600' },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  selectValue: { color: colors.text, fontSize: fontSize.lg },
  selectPlaceholder: { color: colors.placeholder, fontSize: fontSize.lg },
  errorText: { color: colors.danger, fontSize: fontSize.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadow(1),
  },
  saveText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '600' },
  cancelButton: {
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    maxHeight: '75%',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '600', color: colors.heading, marginBottom: spacing.md },
  countryItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryItemText: { color: colors.text, fontSize: fontSize.lg },
  modalCancel: { marginTop: spacing.md, alignItems: 'center', backgroundColor: colors.surfaceAlt, paddingVertical: spacing.md, borderRadius: radius.md },
  modalCancelText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '600' },
});
