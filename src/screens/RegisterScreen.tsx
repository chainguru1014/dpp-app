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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { COUNTRIES } from '../constants/countries';
import { useI18n } from '../i18n/I18nContext';

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
        Alert.alert(t('error'), 'Please fill Username, Password, Gender, Age and Country');
        return false;
      }
    } else {
      if (!normalizedName || !form.email || !form.firstName || !form.lastName || !form.addressStreet || !form.addressCity || !form.addressState || !form.addressZipCode || !form.addressCountry || !form.phoneNumber || !form.gender || !form.dateOfBirth || !form.password) {
        Alert.alert(t('error'), 'Please fill all required Agent fields');
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
        setApiError('Username already exists. Please choose another username.');
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

  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={[styles.scrollContent, isWeb && { minHeight: screenHeight }]} style={styles.scrollView}>
          <View style={styles.content}>
            <View style={styles.card}>
              <Image source={require('../assets/yometel-logo.png')} style={{ width: 300, height: 90, marginBottom: 30 }} resizeMode="contain" />
              <Text style={styles.title}>{t('createAccount')}</Text>

              <View style={styles.userTypeButtons}>
                {(['client', 'agent'] as const).map((type) => (
                  <TouchableOpacity key={type} style={[styles.userTypeButton, userType === type && styles.userTypeButtonActive]} onPress={() => setUserType(type)}>
                    <Text style={[styles.userTypeButtonText, userType === type && styles.userTypeButtonTextActive]}>{type === 'client' ? t('client') : t('agent')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Username" value={form.name} onChangeText={(v) => setField('name', v)} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Password" value={form.password} onChangeText={(v) => setField('password', v)} secureTextEntry autoCapitalize="none" />

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
                  <TextInput style={styles.input} placeholder="Age" value={form.age} onChangeText={(v) => setField('age', v)} keyboardType="numeric" />
                  <TouchableOpacity style={styles.inputButton} onPress={() => setCountryModalVisible(true)}>
                    <Text style={form.country ? styles.inputButtonText : styles.inputButtonPlaceholder}>{form.country || 'Select Country'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput style={styles.input} placeholder="Email" value={form.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" />
                  <TextInput style={styles.input} placeholder="First Name" value={form.firstName} onChangeText={(v) => setField('firstName', v)} />
                  <TextInput style={styles.input} placeholder="Last Name" value={form.lastName} onChangeText={(v) => setField('lastName', v)} />
                  <TextInput style={styles.input} placeholder="Street" value={form.addressStreet} onChangeText={(v) => setField('addressStreet', v)} />
                  <TextInput style={styles.input} placeholder="City" value={form.addressCity} onChangeText={(v) => setField('addressCity', v)} />
                  <TextInput style={styles.input} placeholder="State" value={form.addressState} onChangeText={(v) => setField('addressState', v)} />
                  <TextInput style={styles.input} placeholder="Zip Code" value={form.addressZipCode} onChangeText={(v) => setField('addressZipCode', v)} />
                  <TextInput style={styles.input} placeholder="Country" value={form.addressCountry} onChangeText={(v) => setField('addressCountry', v)} />
                  <TextInput style={styles.input} placeholder="Phone Number" value={form.phoneNumber} onChangeText={(v) => setField('phoneNumber', v)} keyboardType="phone-pad" />
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
                      {form.dateOfBirth || 'Select Date of Birth'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {!!apiError && (
                <Text style={styles.apiErrorText}>{apiError}</Text>
              )}

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
                onError={(error) => Alert.alert('Error', error)}
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
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={countryModalVisible} transparent animationType="slide" onRequestClose={() => setCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <ScrollView>
              {filteredCountries.map((country) => (
                <TouchableOpacity key={country} style={styles.countryItem} onPress={() => { setField('country', country); setCountryModalVisible(false); }}>
                  <Text style={styles.countryText}>{country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={dobPickerVisible} transparent animationType="slide" onRequestClose={() => setDobPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Date of Birth</Text>
            <View style={styles.dobPreviewBox}>
              <Text style={styles.dobPreviewText}>{formatDate(dobDraft)}</Text>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('year', -1)}>
                <Text style={styles.dateAdjustButtonText}>- Year</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('year', 1)}>
                <Text style={styles.dateAdjustButtonText}>+ Year</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('month', -1)}>
                <Text style={styles.dateAdjustButtonText}>- Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('month', 1)}>
                <Text style={styles.dateAdjustButtonText}>+ Month</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('day', -1)}>
                <Text style={styles.dateAdjustButtonText}>- Day</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateAdjustButton} onPress={() => shiftDobDraft('day', 1)}>
                <Text style={styles.dateAdjustButtonText}>+ Day</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDobPickerVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setField('dateOfBirth', formatDate(dobDraft));
                  setDobPickerVisible(false);
                }}
              >
                <Text style={styles.buttonText}>Save</Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5', ...(isWebPlatform && { height: screenHeight, minHeight: screenHeight }) },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  content: { alignItems: 'center', width: '100%', paddingVertical: 40 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.98)', borderRadius: 16, padding: 30, width: '100%', maxWidth: 420 },
  title: { fontSize: 24, fontWeight: '600', color: '#333', marginBottom: 20 },
  userTypeButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  userTypeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  userTypeButtonActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  userTypeButtonText: { color: '#666' },
  userTypeButtonTextActive: { color: '#fff', fontWeight: '600' },
  genderContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  genderOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  genderOptionSelected: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  genderOptionText: { color: '#666', fontSize: 15 },
  genderOptionTextSelected: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputButton: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  inputButtonText: { color: '#333', fontSize: 16 },
  inputButtonPlaceholder: { color: '#999', fontSize: 16 },
  button: { backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  apiErrorText: { color: '#d32f2f', fontSize: 13, textAlign: 'left', marginBottom: 10 },
  linkButton: { marginTop: 15, alignItems: 'center' },
  linkText: { color: '#1976d2', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', maxHeight: '75%', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  dobPreviewBox: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  dobPreviewText: { fontSize: 18, fontWeight: '600', color: '#1976d2' },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateAdjustButton: { flex: 1, backgroundColor: '#e3f2fd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  dateAdjustButtonText: { color: '#1976d2', fontWeight: '600' },
  dateActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  countryItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  countryText: { fontSize: 15, color: '#333' },
  cancelButton: { marginTop: 12, alignItems: 'center', padding: 10, backgroundColor: '#f2f2f2', borderRadius: 8 },
  cancelButtonText: { color: '#333', fontWeight: '600' },
});
