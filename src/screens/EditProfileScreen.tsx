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
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLayout from '../components/AppLayout';
import GradientButton from '../components/GradientButton';
import GradientView from '../components/GradientView';
import { API_BASE_URL } from '../config/api';
import { COUNTRIES } from '../constants/countries';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

export default function EditProfileScreen({ navigation, route, user, onLogout, onUserUpdate }: any) {
  const TOP_BAR_HEIGHT = 70;
  const BOTTOM_BAR_HEIGHT = 70;
  const { t, locale } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [actionsHeight, setActionsHeight] = useState(0);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [dobDraft, setDobDraft] = useState(new Date(2000, 0, 1));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const isGoogleProfileCompletion = !!route?.params?.fromGoogle;
  // userType ('client'/'agent', this screen's own profile shape) now always
  // follows the session's actorKind ('User'/'Employee') rather than being a
  // manual toggle -- consumer accounts are always "client", employee/staff
  // accounts are always "agent". The toggle previously let an Employee
  // session fill out the wrong (client) field set, which then failed
  // validation against fields their real record doesn't carry.
  const createProfileFromUser = (sourceUser: any = user) => ({
    userType: sourceUser?.actorKind === 'Employee' ? 'agent' : 'client',
    name: sourceUser?.name || '',
    password: sourceUser?.isGoogleUser ? 'google' : 'google',
    gender: sourceUser?.gender || '',
    age: sourceUser?.age ? String(sourceUser.age) : '',
    country: sourceUser?.country || '',
    email: sourceUser?.email || '',
    firstName: sourceUser?.firstName || '',
    lastName: sourceUser?.lastName || '',
    addressStreet: sourceUser?.addressStreet || '',
    addressCity: sourceUser?.addressCity || '',
    addressState: sourceUser?.addressState || '',
    addressZipCode: sourceUser?.addressZipCode || '',
    addressCountry: sourceUser?.addressCountry || '',
    phoneNumber: sourceUser?.phoneNumber || '',
    dateOfBirth: sourceUser?.dateOfBirth || '',
  });
  const [profile, setProfile] = useState<any>(createProfileFromUser());
  const [initialProfile, setInitialProfile] = useState<any>(createProfileFromUser());
  const genderOptions = useMemo(() => {
    const labels: Record<string, { male: string; female: string }> = {
      en: { male: 'Male', female: 'Female' },
      ja: { male: '男性', female: '女性' },
      de: { male: 'Männlich', female: 'Weiblich' },
      fr: { male: 'Homme', female: 'Femme' },
      nl: { male: 'Man', female: 'Vrouw' },
    };
    const selected = labels[locale] || labels.en;
    return [
      { value: 'male', label: selected.male },
      { value: 'female', label: selected.female },
    ];
  }, [locale]);
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const parseDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(2000, 0, 1) : parsed;
  };
  const shiftDobDraft = (unit: 'year' | 'month' | 'day', delta: number) => {
    const next = new Date(dobDraft);
    if (unit === 'year') next.setFullYear(next.getFullYear() + delta);
    if (unit === 'month') next.setMonth(next.getMonth() + delta);
    if (unit === 'day') next.setDate(next.getDate() + delta);
    setDobDraft(next);
  };

  useEffect(() => {
    if (user) {
      const hydrated = createProfileFromUser(user);
      setProfile(hydrated);
      setInitialProfile(hydrated);
    }
  }, [user]);

  const setField = (key: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validateGoogleRequiredFields = () => {
    const nextErrors: Record<string, string> = {};
    if (!profile.gender) nextErrors.gender = t('genderRequired');
    if (!profile.age) nextErrors.age = t('ageRequired');
    if (!profile.country) nextErrors.country = t('countryRequired');
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Field-by-field validation, replacing the old single "fill in all fields"
  // alert (which also didn't say WHICH field was missing) and, critically,
  // no longer uses Alert.alert for the result -- react-native-web's Alert is
  // a no-op stub there, so a failed validation looked like the Save button
  // silently did nothing (reported specifically for the agent/employee
  // form, which has enough required fields that one is easy to miss).
  // Errors are shown inline under each field instead, which works on every
  // platform.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/;
  const ZIP_RE = /^[A-Za-z0-9][A-Za-z0-9\- ]{1,9}$/;

  const validateProfile = () => {
    if (isGoogleProfileCompletion && profile.userType === 'client') {
      return validateGoogleRequiredFields();
    }

    const errors: Record<string, string> = {};
    const required = (key: string, label: string) => {
      if (!String(profile[key] || '').trim()) errors[key] = `${label} is required`;
    };

    required('name', t('username'));

    if (profile.userType === 'client') {
      required('password', t('password'));
      if (!profile.gender) errors.gender = t('genderRequired');
      if (!profile.age) errors.age = t('ageRequired');
      else if (!/^\d+$/.test(profile.age.trim()) || Number(profile.age) <= 0 || Number(profile.age) > 120) {
        errors.age = 'Enter a valid age';
      }
      if (!profile.country) errors.country = t('countryRequired');
    } else {
      required('email', t('email'));
      if (!errors.email && !EMAIL_RE.test(profile.email.trim())) errors.email = 'Enter a valid email address';
      required('firstName', t('firstName'));
      required('lastName', t('lastName'));
      required('addressStreet', t('street'));
      required('addressCity', t('city'));
      required('addressState', t('state'));
      required('addressZipCode', t('zipCode'));
      if (!errors.addressZipCode && !ZIP_RE.test(profile.addressZipCode.trim())) {
        errors.addressZipCode = 'Enter a valid zip/postal code';
      }
      required('addressCountry', t('country'));
      required('phoneNumber', t('phoneNumber'));
      if (!errors.phoneNumber && !PHONE_RE.test(profile.phoneNumber.trim())) {
        errors.phoneNumber = 'Enter a valid phone number';
      }
      if (!profile.gender) errors.gender = t('genderRequired');
      if (!profile.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProfile = async () => {
    if (!user?._id) {
      Alert.alert(t('error'), t('userNotFound'));
      return;
    }

    if (!validateProfile()) return;

    setSaveError('');
    setLoading(true);
    try {
      const payload: any = {
        userType: profile.userType,
        name: profile.name,
        password: profile.password,
      };

      if (profile.userType === 'client') {
        payload.gender = profile.gender;
        payload.age = Number(profile.age);
        payload.country = profile.country;
      } else {
        payload.email = profile.email;
        payload.firstName = profile.firstName;
        payload.lastName = profile.lastName;
        payload.addressStreet = profile.addressStreet;
        payload.addressCity = profile.addressCity;
        payload.addressState = profile.addressState;
        payload.addressZipCode = profile.addressZipCode;
        payload.addressCountry = profile.addressCountry;
        payload.phoneNumber = profile.phoneNumber;
        payload.gender = profile.gender;
        payload.dateOfBirth = profile.dateOfBirth;
      }

      const response = await fetch(`${API_BASE_URL}user/profile/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        const message = data.message || t('failedToUpdateProfile');
        setSaveError(message);
        Alert.alert(t('error'), message);
        return;
      }

      const updatedUser = data.user || data.data;
      await AsyncStorage.setItem('userToken', data.token || '');
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate?.(updatedUser);
      const refreshedProfile = createProfileFromUser(updatedUser);
      setProfile(refreshedProfile);
      setInitialProfile(refreshedProfile);
      Alert.alert(t('success'), t('profileUpdated'));
      navigation.navigate(user?.actorKind === 'Employee' ? 'EmployeeHome' : 'Scanner');
    } catch (error: any) {
      const message = error?.message || t('failedToUpdateProfile');
      setSaveError(message);
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isGoogleProfileCompletion && profile.userType === 'client') {
      if (!validateGoogleRequiredFields()) {
        return;
      }
      navigation.replace(user?.actorKind === 'Employee' ? 'EmployeeHome' : 'Scanner');
      return;
    }
    setProfile(initialProfile);
    navigation.goBack();
  };
  const availableContentMinHeight = Math.max(0, windowHeight - TOP_BAR_HEIGHT - BOTTOM_BAR_HEIGHT - actionsHeight);

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton
      onBackPress={handleCancel}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardContainer}>
        <ScrollView
          style={[styles.scrollView, { minHeight: availableContentMinHeight }]}
          contentContainerStyle={[styles.scrollContent, { minHeight: availableContentMinHeight }]}
          showsVerticalScrollIndicator
        >
          <View style={styles.card}>
            <Text style={styles.header}>{t('editProfile')}</Text>
            {!!saveError && (
              <View style={styles.saveErrorBanner}>
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            )}

            <Text style={styles.label}>{t('username')}:</Text>
            <TextInput style={styles.input} placeholder={t('username')} value={profile.name} onChangeText={(v) => setField('name', v)} />
            {!!fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}

            {profile.userType === 'client' ? (
              <>
                <Text style={styles.label}>{t('password')}:</Text>
                <TextInput style={styles.input} placeholder={t('password')} value={profile.password} onChangeText={(v) => setField('password', v)} secureTextEntry />
                {!!fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
                <Text style={styles.label}>{t('gender')}:</Text>
                <View style={styles.genderContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.genderOption, profile.gender === option.value && styles.genderOptionSelected]}
                      onPress={() => setField('gender', option.value)}
                    >
                      {profile.gender === option.value && (
                        <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
                      )}
                      <Text style={[styles.genderOptionText, profile.gender === option.value && styles.genderOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}
                <Text style={styles.label}>{t('age')}:</Text>
                <TextInput style={styles.input} placeholder={t('age')} value={profile.age} onChangeText={(v) => setField('age', v)} keyboardType="numeric" />
                {!!fieldErrors.age && <Text style={styles.errorText}>{fieldErrors.age}</Text>}
                <Text style={styles.label}>{t('country')}:</Text>
                <TouchableOpacity style={styles.countryButton} onPress={() => setCountryModalVisible(true)}>
                  <Text style={profile.country ? styles.countryButtonText : styles.countryButtonPlaceholder}>{profile.country || t('selectCountry')}</Text>
                </TouchableOpacity>
                {!!fieldErrors.country && <Text style={styles.errorText}>{fieldErrors.country}</Text>}
              </>
            ) : (
              <>
                <Text style={styles.label}>{t('email')}:</Text>
                <TextInput style={styles.input} placeholder={t('email')} value={profile.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
                {!!fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
                <Text style={styles.label}>{t('firstName')}:</Text>
                <TextInput style={styles.input} placeholder={t('firstName')} value={profile.firstName} onChangeText={(v) => setField('firstName', v)} autoCapitalize="words" textContentType="givenName" />
                {!!fieldErrors.firstName && <Text style={styles.errorText}>{fieldErrors.firstName}</Text>}
                <Text style={styles.label}>{t('lastName')}:</Text>
                <TextInput style={styles.input} placeholder={t('lastName')} value={profile.lastName} onChangeText={(v) => setField('lastName', v)} autoCapitalize="words" textContentType="familyName" />
                {!!fieldErrors.lastName && <Text style={styles.errorText}>{fieldErrors.lastName}</Text>}
                <Text style={styles.label}>{t('street')}:</Text>
                <TextInput style={styles.input} placeholder={t('street')} value={profile.addressStreet} onChangeText={(v) => setField('addressStreet', v)} autoCapitalize="words" textContentType="streetAddressLine1" />
                {!!fieldErrors.addressStreet && <Text style={styles.errorText}>{fieldErrors.addressStreet}</Text>}
                <Text style={styles.label}>{t('city')}:</Text>
                <TextInput style={styles.input} placeholder={t('city')} value={profile.addressCity} onChangeText={(v) => setField('addressCity', v)} autoCapitalize="words" textContentType="addressCity" />
                {!!fieldErrors.addressCity && <Text style={styles.errorText}>{fieldErrors.addressCity}</Text>}
                <Text style={styles.label}>{t('state')}:</Text>
                <TextInput style={styles.input} placeholder={t('state')} value={profile.addressState} onChangeText={(v) => setField('addressState', v)} autoCapitalize="words" textContentType="addressState" />
                {!!fieldErrors.addressState && <Text style={styles.errorText}>{fieldErrors.addressState}</Text>}
                <Text style={styles.label}>{t('zipCode')}:</Text>
                <TextInput style={styles.input} placeholder={t('zipCode')} value={profile.addressZipCode} onChangeText={(v) => setField('addressZipCode', v)} autoCapitalize="characters" textContentType="postalCode" />
                {!!fieldErrors.addressZipCode && <Text style={styles.errorText}>{fieldErrors.addressZipCode}</Text>}
                <Text style={styles.label}>{t('country')}:</Text>
                <TextInput style={styles.input} placeholder={t('country')} value={profile.addressCountry} onChangeText={(v) => setField('addressCountry', v)} autoCapitalize="words" textContentType="countryName" />
                {!!fieldErrors.addressCountry && <Text style={styles.errorText}>{fieldErrors.addressCountry}</Text>}
                <Text style={styles.label}>{t('phoneNumber')}:</Text>
                <TextInput style={styles.input} placeholder={t('phoneNumber')} value={profile.phoneNumber} onChangeText={(v) => setField('phoneNumber', v)} keyboardType="phone-pad" textContentType="telephoneNumber" />
                {!!fieldErrors.phoneNumber && <Text style={styles.errorText}>{fieldErrors.phoneNumber}</Text>}
                <Text style={styles.label}>{t('gender')}:</Text>
                <View style={styles.genderContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.genderOption, profile.gender === option.value && styles.genderOptionSelected]}
                      onPress={() => setField('gender', option.value)}
                    >
                      {profile.gender === option.value && (
                        <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
                      )}
                      <Text style={[styles.genderOptionText, profile.gender === option.value && styles.genderOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}
                <Text style={styles.label}>{t('dateOfBirth')}:</Text>
                <TouchableOpacity
                  style={styles.countryButton}
                  onPress={() => {
                    setDobDraft(parseDate(profile.dateOfBirth));
                    setDobPickerVisible(true);
                  }}
                >
                  <Text style={profile.dateOfBirth ? styles.countryButtonText : styles.countryButtonPlaceholder}>
                    {profile.dateOfBirth || t('selectDateOfBirth')}
                  </Text>
                </TouchableOpacity>
                {!!fieldErrors.dateOfBirth && <Text style={styles.errorText}>{fieldErrors.dateOfBirth}</Text>}
              </>
            )}
          </View>
        </ScrollView>
        <View
          style={styles.actions}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight !== actionsHeight) {
              setActionsHeight(nextHeight);
            }
          }}
        >
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <GradientButton style={[styles.saveButton, loading && { opacity: 0.6 }]} onPress={saveProfile} disabled={loading}>
            <Text style={styles.saveText}>{loading ? t('saving') : t('save')}</Text>
          </GradientButton>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={countryModalVisible} transparent animationType="slide" onRequestClose={() => setCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('selectCountry')}</Text>
            <ScrollView>
              {COUNTRIES.map((country) => (
                <TouchableOpacity key={country} style={styles.countryItem} onPress={() => { setField('country', country); setCountryModalVisible(false); }}>
                  <Text style={styles.countryItemText}>{country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={dobPickerVisible} transparent animationType="slide" onRequestClose={() => setDobPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('selectDateOfBirth')}</Text>
            <View style={styles.dobPreviewBox}>
              <Text style={styles.dobPreviewText}>{formatDate(dobDraft)}</Text>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('year', -1)}>
                <Text style={styles.dateAdjustButtonText}>{t('decreaseYear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('year', 1)}>
                <Text style={styles.dateAdjustButtonText}>{t('increaseYear')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('month', -1)}>
                <Text style={styles.dateAdjustButtonText}>{t('decreaseMonth')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('month', 1)}>
                <Text style={styles.dateAdjustButtonText}>{t('increaseMonth')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('day', -1)}>
                <Text style={styles.dateAdjustButtonText}>{t('decreaseDay')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('day', 1)}>
                <Text style={styles.dateAdjustButtonText}>{t('increaseDay')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDobPickerVisible(false)}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <GradientButton
                style={styles.saveButton}
                onPress={() => {
                  setField('dateOfBirth', formatDate(dobDraft));
                  setDobPickerVisible(false);
                }}
              >
                <Text style={styles.saveText}>{t('save')}</Text>
              </GradientButton>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow(2),
  },
  header: { fontSize: fontSize.xxl, fontWeight: '400', marginBottom: spacing.xl, color: colors.heading },
  label: { fontSize: fontSize.md, fontWeight: '400', color: colors.primaryDark, marginBottom: spacing.sm },
  saveErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  saveErrorText: { color: colors.danger, fontSize: fontSize.md },
  input: {
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  genderContainer: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  genderOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  genderOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderOptionText: { color: colors.muted, fontSize: fontSize.md, fontWeight: '400' },
  genderOptionTextSelected: { color: colors.white, fontWeight: '400' },
  countryButton: {
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  countryButtonText: { color: colors.text, fontSize: fontSize.lg },
  countryButtonPlaceholder: { color: colors.placeholder, fontSize: fontSize.lg },
  errorText: { color: colors.danger, fontSize: fontSize.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  cancelText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '400' },
  saveText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '400' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    maxHeight: '75%',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '400', color: colors.heading, marginBottom: spacing.md },
  dobPreviewBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dobPreviewText: { fontSize: fontSize.xl, fontWeight: '400', color: colors.primary },
  dateRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  dateAdjustButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dateAdjustButtonText: { color: colors.primary, fontWeight: '400' },
  countryItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryItemText: { color: colors.text, fontSize: fontSize.lg },
  modalCancel: {
    marginTop: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  modalCancelText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '400' },
});
