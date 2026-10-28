import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { COUNTRIES } from '../constants/countries';
import GradientButton from '../components/GradientButton';
import GradientView from '../components/GradientView';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

// This screen used to be the password-based registration form. It is now
// the PROFILE-COMPLETION screen: it's only reached after a successful
// passwordless auth (Google / Apple / email OTP) whose response came back
// with `profileCompleted: false` — see LoginScreen's handleAuthSuccess.
// The same fields and userType-conditional validation are kept as-is
// (minus password, which no longer exists anywhere in the app), but the
// submit now POSTs to auth/profile/complete with the bearer token obtained
// from that prior auth step instead of user/register.
export default function RegisterScreen({ navigation, onLogin, route }: any) {
  const { t, locale } = useI18n();
  const partialUser = route?.params?.partialUser || {};
  const [userType, setUserType] = useState<'client' | 'agent'>(
    partialUser.userType === 'agent' ? 'agent' : 'client'
  );
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [dobDraft, setDobDraft] = useState(new Date(2000, 0, 1));
  // Per-field validation messages, shown under each field after Save.
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Face signups arrive with no email — the profile page asks for one.
  const needsEmail = !partialUser.email;

  const [form, setForm] = useState<any>({
    name: partialUser.name || '',
    nickname: partialUser.nickname || '',
    email: partialUser.email || '',
    gender: partialUser.gender || '',
    birthYear: partialUser.birthYear ? String(partialUser.birthYear) : '',
    country: partialUser.country || '',
    firstName: partialUser.firstName || '',
    lastName: partialUser.lastName || '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZipCode: '',
    addressCountry: '',
    phoneNumber: '',
    dateOfBirth: '',
  });

  const filteredCountries = useMemo(() => COUNTRIES, []);
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

  const setField = (key: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
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

  // Marks every empty required field (shown in red under the field) instead
  // of a single Alert — Alert.alert is a no-op on react-native-web.
  const validate = () => {
    const next: Record<string, string> = {};
    const required = (key: string, ok: boolean) => {
      if (!ok) next[key] = t('profileFieldRequired');
    };
    const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
    if (userType === 'client') {
      // GDPR data minimization: nickname/gender/birthYear/country only —
      // plus an email for face signups, which have no other contact channel.
      required('nickname', !!(form.nickname || '').trim());
      required('gender', !!form.gender);
      required('birthYear', !!form.birthYear);
      if (form.birthYear && !/^\d{4}$/.test(form.birthYear)) next.birthYear = t('profileFieldRequired');
      required('country', !!form.country);
      if (needsEmail) {
        required('email', !!(form.email || '').trim());
        if ((form.email || '').trim() && !emailOk(form.email)) next.email = t('profileEmailInvalid');
      }
    } else {
      ['name', 'email', 'firstName', 'lastName', 'addressStreet', 'addressCity', 'addressState', 'addressZipCode', 'addressCountry', 'phoneNumber', 'gender', 'dateOfBirth']
        .forEach((key) => required(key, !!(form[key] || '').trim()));
      if ((form.email || '').trim() && !emailOk(form.email)) next.email = t('profileEmailInvalid');
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setApiError(t('profileFixFields'));
      return false;
    }
    return true;
  };

  // Red border + message under a field that failed validation.
  const errStyle = (key: string) => (errors[key] ? styles.inputError : null);
  const errText = (key: string) =>
    errors[key] ? (
      <Text style={styles.fieldErrorText} accessibilityRole="alert">{errors[key]}</Text>
    ) : null;

  const handleCompleteProfile = async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      // The bearer token comes from the auth step that got us here (passed
      // via route params); AsyncStorage is a fallback in case this screen
      // was remounted (e.g. app restart mid-onboarding).
      const token = route?.params?.token || (await AsyncStorage.getItem('userToken')) || '';
      const normalizedName = (form.name || '').trim();

      const payload: any = {
        userType,
      };

      if (userType === 'client') {
        // No `name` sent for consumer accounts — nickname is the only
        // display identity, per the GDPR-safe avatar dataset.
        payload.nickname = (form.nickname || '').trim();
        payload.gender = form.gender;
        payload.birthYear = Number(form.birthYear);
        payload.country = form.country;
        if (needsEmail) payload.email = (form.email || '').trim();
      } else {
        payload.name = normalizedName;
        payload.email = form.email;
        payload.firstName = form.firstName;
        payload.lastName = form.lastName;
        payload.addressStreet = form.addressStreet;
        payload.addressCity = form.addressCity;
        payload.addressState = form.addressState;
        payload.addressZipCode = form.addressZipCode;
        payload.addressCountry = form.addressCountry;
        payload.phoneNumber = form.phoneNumber;
        payload.gender = form.gender;
        payload.dateOfBirth = form.dateOfBirth;
      }

      const response = await fetch(`${API_BASE_URL}auth/profile/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.status !== 'success') {
        setApiError(data.message || t('registrationFailed'));
        return;
      }

      const userData = data.user || data.data;
      const tagged = { ...(userData || {}), actorKind: 'User' };
      await AsyncStorage.setItem('userToken', data.token || token || '');
      await AsyncStorage.setItem('user', JSON.stringify(tagged));
      onLogin?.(tagged);
      const redirectTo = route?.params?.redirectTo;
      const redirectParams = route?.params?.redirectParams;
      // First-ever sign-up for this account — route through the AI Concierge
      // consent gate once (see LoginScreen's goAfterAuth for the sign-in
      // equivalent), carrying along wherever signup would otherwise have
      // landed so the gate's Continue button sends the user there next.
      if (!tagged.aiConciergeConsentAt) {
        navigation.replace('AiConciergeConsent', {
          redirectTo: redirectTo || 'Scanner',
          redirectParams: redirectParams || {},
        });
      } else if (redirectTo) {
        navigation.replace(redirectTo, redirectParams || {});
      } else {
        navigation.replace('Scanner');
      }
    } catch (error: any) {
      setApiError(error?.message || t('networkErrorRetry'));
    } finally {
      setLoading(false);
    }
  };

  // Bail out of profile completion back to the sign-in screen — clears the
  // partial session so the user doesn't get stuck in limbo.
  const handleCancel = async () => {
    await AsyncStorage.multiRemove(['userToken', 'user']);
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/bg-intro-dpp.jpg')}
        style={styles.imageBg}
        resizeMode="cover"
      >
        <Text style={styles.pageTitle}>Digital Product Passport</Text>
      </ImageBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centeredOverlay}>
        <View style={styles.centerWrap}>
          <View style={styles.card}>
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator
            >
              <Image
                source={require('../assets/yometel-logo-trans.png')}
                style={{ width: 160, height: 48, marginBottom: 28, alignSelf: 'center' }}
                resizeMode="contain"
              />

              <View style={styles.userTypeButtons}>
                {(['client', 'agent'] as const).map((type) => (
                  <TouchableOpacity key={type} style={[styles.userTypeButton, userType === type && styles.userTypeButtonActive]} onPress={() => setUserType(type)}>
                    {userType === type && (
                      <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
                    )}
                    <Text style={[styles.userTypeButtonText, userType === type && styles.userTypeButtonTextActive]}>{type === 'client' ? t('client') : t('agent')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {userType === 'agent' && (
                <>
                  <TextInput style={[styles.input, errStyle('name')]} placeholder={t('username')} placeholderTextColor={colors.placeholder} value={form.name} onChangeText={(v) => setField('name', v)} autoCapitalize="none" />
                  {errText('name')}
                </>
              )}

              {userType === 'client' ? (
                <>
                  {needsEmail && (
                    <>
                      <TextInput style={[styles.input, errStyle('email')]} placeholder={t('email')} placeholderTextColor={colors.placeholder} value={form.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                      {errText('email')}
                    </>
                  )}
                  <TextInput style={[styles.input, errStyle('nickname')]} placeholder={t('nickname')} placeholderTextColor={colors.placeholder} value={form.nickname} onChangeText={(v) => setField('nickname', v)} autoCapitalize="none" />
                  {errText('nickname')}
                  <View style={[styles.genderContainer, !!errors.gender && styles.genderContainerError]}>
                    {genderOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderOption,
                          form.gender === option.value && styles.genderOptionSelected,
                        ]}
                        onPress={() => setField('gender', option.value)}
                      >
                        {form.gender === option.value && (
                          <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
                        )}
                        <Text
                          style={[
                            styles.genderOptionText,
                            form.gender === option.value && styles.genderOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errText('gender')}
                  <TextInput style={[styles.input, errStyle('birthYear')]} placeholder={t('birthYear')} placeholderTextColor={colors.placeholder} value={form.birthYear} onChangeText={(v) => setField('birthYear', v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="numeric" maxLength={4} />
                  {errText('birthYear')}
                  <TouchableOpacity style={[styles.inputButton, errStyle('country')]} onPress={() => setCountryModalVisible(true)}>
                    <Text style={form.country ? styles.inputButtonText : styles.inputButtonPlaceholder}>{form.country || t('selectCountry')}</Text>
                  </TouchableOpacity>
                  {errText('country')}
                </>
              ) : (
                <>
                  <TextInput style={[styles.input, errStyle('email')]} placeholder={t('email')} placeholderTextColor={colors.placeholder} value={form.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" />
                  {errText('email')}
                  <TextInput style={[styles.input, errStyle('firstName')]} placeholder={t('firstName')} placeholderTextColor={colors.placeholder} value={form.firstName} onChangeText={(v) => setField('firstName', v)} />
                  {errText('firstName')}
                  <TextInput style={[styles.input, errStyle('lastName')]} placeholder={t('lastName')} placeholderTextColor={colors.placeholder} value={form.lastName} onChangeText={(v) => setField('lastName', v)} />
                  {errText('lastName')}
                  <TextInput style={[styles.input, errStyle('addressStreet')]} placeholder={t('street')} placeholderTextColor={colors.placeholder} value={form.addressStreet} onChangeText={(v) => setField('addressStreet', v)} />
                  {errText('addressStreet')}
                  <TextInput style={[styles.input, errStyle('addressCity')]} placeholder={t('city')} placeholderTextColor={colors.placeholder} value={form.addressCity} onChangeText={(v) => setField('addressCity', v)} />
                  {errText('addressCity')}
                  <TextInput style={[styles.input, errStyle('addressState')]} placeholder={t('state')} placeholderTextColor={colors.placeholder} value={form.addressState} onChangeText={(v) => setField('addressState', v)} />
                  {errText('addressState')}
                  <TextInput style={[styles.input, errStyle('addressZipCode')]} placeholder={t('zipCode')} placeholderTextColor={colors.placeholder} value={form.addressZipCode} onChangeText={(v) => setField('addressZipCode', v)} />
                  {errText('addressZipCode')}
                  <TextInput style={[styles.input, errStyle('addressCountry')]} placeholder={t('country')} placeholderTextColor={colors.placeholder} value={form.addressCountry} onChangeText={(v) => setField('addressCountry', v)} />
                  {errText('addressCountry')}
                  <TextInput style={[styles.input, errStyle('phoneNumber')]} placeholder={t('phoneNumber')} placeholderTextColor={colors.placeholder} value={form.phoneNumber} onChangeText={(v) => setField('phoneNumber', v)} keyboardType="phone-pad" />
                  {errText('phoneNumber')}
                  <View style={[styles.genderContainer, !!errors.gender && styles.genderContainerError]}>
                    {genderOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderOption,
                          form.gender === option.value && styles.genderOptionSelected,
                        ]}
                        onPress={() => setField('gender', option.value)}
                      >
                        {form.gender === option.value && (
                          <GradientView style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
                        )}
                        <Text
                          style={[
                            styles.genderOptionText,
                            form.gender === option.value && styles.genderOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errText('gender')}
                  <TouchableOpacity
                    style={[styles.inputButton, errStyle('dateOfBirth')]}
                    onPress={() => {
                      setDobDraft(parseDate(form.dateOfBirth));
                      setDobPickerVisible(true);
                    }}
                  >
                    <Text style={form.dateOfBirth ? styles.inputButtonText : styles.inputButtonPlaceholder}>
                      {form.dateOfBirth || t('selectDateOfBirth')}
                    </Text>
                  </TouchableOpacity>
                  {errText('dateOfBirth')}
                </>
              )}

              {!!apiError && (
                <View style={styles.apiErrorBox}>
                  <Text style={styles.apiErrorText}>{apiError}</Text>
                </View>
              )}
            </ScrollView>

            {/* Fixed footer — stays below the scrolling fields. */}
            <View style={styles.cardFooter}>
              <GradientButton style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCompleteProfile} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? t('profileSaving') : t('profileSaveContinue')}</Text>
              </GradientButton>

              <TouchableOpacity style={styles.linkButton} onPress={handleCancel}>
                <Text style={styles.linkText}>{t('profileCancelSignOut')}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>

      <Modal visible={countryModalVisible} transparent animationType="slide" onRequestClose={() => setCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('selectCountry')}</Text>
            <ScrollView>
              {filteredCountries.map((country) => (
                <TouchableOpacity key={country} style={styles.countryItem} onPress={() => { setField('country', country); setCountryModalVisible(false); }}>
                  <Text style={styles.countryText}>{country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
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
            <View style={styles.dateActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDobPickerVisible(false)}>
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <GradientButton
                style={styles.button}
                onPress={() => {
                  setField('dateOfBirth', formatDate(dobDraft));
                  setDobPickerVisible(false);
                }}
              >
                <Text style={styles.buttonText}>{t('save')}</Text>
              </GradientButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const screenHeight = Dimensions.get('window').height;
const isWebPlatform = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  imageBg: { width: '100%', height: screenHeight * 0.55 },
  centeredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pageTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, width: '100%' },
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: Math.round(screenHeight * 0.7),
    overflow: 'hidden',
    ...shadow(3),
  },
  cardScroll: { width: '100%', flexShrink: 1 },
  cardScrollContent: { paddingHorizontal: spacing.xxxl, paddingTop: spacing.xxxl, paddingBottom: spacing.md },
  cardFooter: {
    flexShrink: 0,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,30,60,0.08)',
  },
  title: { fontSize: 32, fontWeight: '400', color: colors.heading, marginBottom: spacing.xl },
  brandTagline: { fontSize: 49, fontWeight: '400', letterSpacing: 3, color: colors.white, textAlign: 'center', marginBottom: spacing.xxl, ...(isWebPlatform && { fontFamily: 'Poppins, system-ui, sans-serif' }) },
  userTypeButtons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  userTypeButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  userTypeButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  userTypeButtonText: { color: colors.muted, fontWeight: '400' },
  userTypeButtonTextActive: { color: colors.white, fontWeight: '400' },
  genderContainer: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  genderOption: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  genderOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  genderOptionText: { color: colors.muted, fontSize: 20, fontWeight: '400' },
  genderOptionTextSelected: { color: colors.white, fontWeight: '400' },
  input: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, marginBottom: spacing.md, fontSize: 22, color: colors.text, borderWidth: 1, borderColor: colors.borderStrong },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputButton: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderStrong },
  inputButtonText: { color: colors.text, fontSize: 22 },
  inputButtonPlaceholder: { color: colors.placeholder, fontSize: 22 },
  button: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, paddingHorizontal: spacing.lg, alignItems: 'center', marginTop: spacing.sm, ...shadow(1) },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 22, fontWeight: '400' },
  inputError: { borderColor: colors.danger, borderWidth: 2 },
  genderContainerError: { borderWidth: 2, borderColor: colors.danger, borderRadius: radius.md, padding: 2 },
  fieldErrorText: { color: colors.danger, fontSize: 17, marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.md },
  apiErrorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  apiErrorText: { color: colors.danger, fontSize: 18, textAlign: 'left' },
  linkButton: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.navy, fontSize: 19, fontWeight: '400' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, maxHeight: '75%', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl },
  modalTitle: { fontSize: 24, fontWeight: '400', color: colors.heading, marginBottom: spacing.md },
  dobPreviewBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  dobPreviewText: { fontSize: 24, fontWeight: '400', color: colors.primary },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dateAdjustButton: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center' },
  dateAdjustButtonText: { color: colors.accent, fontWeight: '400' },
  dateActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  countryItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryText: { fontSize: 20, color: colors.text },
  cancelButton: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  cancelButtonText: { color: colors.primary, fontWeight: '400' },
});
