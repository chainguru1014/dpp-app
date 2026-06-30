import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { COUNTRIES } from '../constants/countries';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, shadow } from '../theme';

export default function RegisterScreen({ navigation, onLogin, route }: any) {
  const { t, locale } = useI18n();
  const [userType, setUserType] = useState<'client' | 'agent'>('client');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [dobDraft, setDobDraft] = useState(new Date(2000, 0, 1));

  const [form, setForm] = useState<any>({
    name: '',
    email: '',
    password: '',
    gender: '',
    age: '',
    country: '',
    firstName: '',
    lastName: '',
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

  const setField = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }));
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

  const validate = () => {
    const normalizedName = (form.name || '').trim();
    if (userType === 'client') {
      if (!normalizedName || !form.password || !form.gender || !form.age || !form.country) {
        Alert.alert(t('error'), t('fillProfileFieldsClient'));
        return false;
      }
    } else {
      if (!normalizedName || !form.email || !form.firstName || !form.lastName || !form.addressStreet || !form.addressCity || !form.addressState || !form.addressZipCode || !form.addressCountry || !form.phoneNumber || !form.gender || !form.dateOfBirth || !form.password) {
        Alert.alert(t('error'), t('fillProfileFieldsAgent'));
        return false;
      }
    }
    return true;
  };

  const handleRegister = async () => {
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const normalizedName = (form.name || '').trim();
      const usernameCheckResponse = await fetch(`${API_BASE_URL}user/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: normalizedName }),
      });
      const usernameCheckData = await usernameCheckResponse.json();
      if (!usernameCheckResponse.ok || usernameCheckData.status !== 'success') {
        setApiError(usernameCheckData.message || t('networkErrorRetry'));
        return;
      }
      if (usernameCheckData.exists) {
        setApiError(t('usernameAlreadyExists'));
        return;
      }

      const payload: any = {
        name: normalizedName,
        password: form.password,
        userType,
      };

      if (userType === 'client') {
        payload.gender = form.gender;
        payload.age = Number(form.age);
        payload.country = form.country;
      } else {
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

      const response = await fetch(`${API_BASE_URL}user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || data.status !== 'success') {
        setApiError(data.message || t('registrationFailed'));
        return;
      }

      const userData = data.user || data.data;
      await AsyncStorage.setItem('userToken', data.token || '');
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      onLogin?.(userData);
      const redirectTo = route?.params?.redirectTo;
      const redirectParams = route?.params?.redirectParams;
      if (redirectTo) {
        navigation.replace(redirectTo, redirectParams || {});
      } else {
        navigation.replace('Home');
      }
    } catch (error: any) {
      setApiError(error?.message || t('networkErrorRetry'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/bg-login.jpg')}
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
                    <Text style={[styles.userTypeButtonText, userType === type && styles.userTypeButtonTextActive]}>{type === 'client' ? t('client') : t('agent')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder={t('username')} placeholderTextColor={colors.placeholder} value={form.name} onChangeText={(v) => setField('name', v)} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder={t('password')} placeholderTextColor={colors.placeholder} value={form.password} onChangeText={(v) => setField('password', v)} secureTextEntry autoCapitalize="none" />

              {userType === 'client' ? (
                <>
                  <View style={styles.genderContainer}>
                    {genderOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderOption,
                          form.gender === option.value && styles.genderOptionSelected,
                        ]}
                        onPress={() => setField('gender', option.value)}
                      >
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
                  <TextInput style={styles.input} placeholder={t('age')} placeholderTextColor={colors.placeholder} value={form.age} onChangeText={(v) => setField('age', v)} keyboardType="numeric" />
                  <TouchableOpacity style={styles.inputButton} onPress={() => setCountryModalVisible(true)}>
                    <Text style={form.country ? styles.inputButtonText : styles.inputButtonPlaceholder}>{form.country || t('selectCountry')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput style={styles.input} placeholder={t('email')} placeholderTextColor={colors.placeholder} value={form.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" />
                  <TextInput style={styles.input} placeholder={t('firstName')} placeholderTextColor={colors.placeholder} value={form.firstName} onChangeText={(v) => setField('firstName', v)} />
                  <TextInput style={styles.input} placeholder={t('lastName')} placeholderTextColor={colors.placeholder} value={form.lastName} onChangeText={(v) => setField('lastName', v)} />
                  <TextInput style={styles.input} placeholder={t('street')} placeholderTextColor={colors.placeholder} value={form.addressStreet} onChangeText={(v) => setField('addressStreet', v)} />
                  <TextInput style={styles.input} placeholder={t('city')} placeholderTextColor={colors.placeholder} value={form.addressCity} onChangeText={(v) => setField('addressCity', v)} />
                  <TextInput style={styles.input} placeholder={t('state')} placeholderTextColor={colors.placeholder} value={form.addressState} onChangeText={(v) => setField('addressState', v)} />
                  <TextInput style={styles.input} placeholder={t('zipCode')} placeholderTextColor={colors.placeholder} value={form.addressZipCode} onChangeText={(v) => setField('addressZipCode', v)} />
                  <TextInput style={styles.input} placeholder={t('country')} placeholderTextColor={colors.placeholder} value={form.addressCountry} onChangeText={(v) => setField('addressCountry', v)} />
                  <TextInput style={styles.input} placeholder={t('phoneNumber')} placeholderTextColor={colors.placeholder} value={form.phoneNumber} onChangeText={(v) => setField('phoneNumber', v)} keyboardType="phone-pad" />
                  <View style={styles.genderContainer}>
                    {genderOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.genderOption,
                          form.gender === option.value && styles.genderOptionSelected,
                        ]}
                        onPress={() => setField('gender', option.value)}
                      >
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
                  <TouchableOpacity
                    style={styles.inputButton}
                    onPress={() => {
                      setDobDraft(parseDate(form.dateOfBirth));
                      setDobPickerVisible(true);
                    }}
                  >
                    <Text style={form.dateOfBirth ? styles.inputButtonText : styles.inputButtonPlaceholder}>
                      {form.dateOfBirth || t('selectDateOfBirth')}
                    </Text>
                  </TouchableOpacity>
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
              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? `${t('signUp')}...` : t('signUp')}</Text>
              </TouchableOpacity>

              <GoogleAuthButton
                onSuccess={async (userData) => {
                  onLogin?.(userData);
                  if (route?.params?.redirectTo) {
                    navigation.replace(route.params.redirectTo, route.params.redirectParams || {});
                  } else {
                    navigation.replace('EditProfile', { fromGoogle: true });
                  }
                }}
                onError={(error) => Alert.alert(t('error'), error)}
                navigation={navigation}
              />

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('Login', {
                  redirectTo: route?.params?.redirectTo,
                  redirectParams: route?.params?.redirectParams,
                })}
              >
                <Text style={styles.linkText}>{t('haveAccount')} {t('signIn')}</Text>
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
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setField('dateOfBirth', formatDate(dobDraft));
                  setDobPickerVisible(false);
                }}
              >
                <Text style={styles.buttonText}>{t('save')}</Text>
              </TouchableOpacity>
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
    fontSize: 22,
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
  title: { fontSize: 24, fontWeight: '400', color: colors.heading, marginBottom: spacing.xl },
  brandTagline: { fontSize: 36, fontWeight: '400', letterSpacing: 3, color: colors.white, textAlign: 'center', marginBottom: spacing.xxl, ...(isWebPlatform && { fontFamily: 'Poppins, system-ui, sans-serif' }) },
  userTypeButtons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  userTypeButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  userTypeButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  userTypeButtonText: { color: colors.muted, fontWeight: '400' },
  userTypeButtonTextActive: { color: colors.white, fontWeight: '400' },
  genderContainer: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  genderOption: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  genderOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  genderOptionText: { color: colors.muted, fontSize: 15, fontWeight: '400' },
  genderOptionTextSelected: { color: colors.white, fontWeight: '400' },
  input: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, marginBottom: spacing.md, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.borderStrong },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputButton: { backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderStrong },
  inputButtonText: { color: colors.text, fontSize: 16 },
  inputButtonPlaceholder: { color: colors.placeholder, fontSize: 16 },
  button: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, paddingHorizontal: spacing.lg, alignItems: 'center', marginTop: spacing.sm, ...shadow(1) },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '400' },
  apiErrorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  apiErrorText: { color: colors.danger, fontSize: 13, textAlign: 'left' },
  linkButton: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.navy, fontSize: 14, fontWeight: '400' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, maxHeight: '75%', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl },
  modalTitle: { fontSize: 18, fontWeight: '400', color: colors.heading, marginBottom: spacing.md },
  dobPreviewBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  dobPreviewText: { fontSize: 18, fontWeight: '400', color: colors.primary },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dateAdjustButton: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center' },
  dateAdjustButtonText: { color: colors.accent, fontWeight: '400' },
  dateActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  countryItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryText: { fontSize: 15, color: colors.text },
  cancelButton: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  cancelButtonText: { color: colors.primary, fontWeight: '400' },
});
