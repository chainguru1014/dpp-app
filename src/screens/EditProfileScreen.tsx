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
import { API_BASE_URL } from '../config/api';
import { COUNTRIES } from '../constants/countries';
import { useI18n } from '../i18n/I18nContext';

export default function EditProfileScreen({ navigation, route, user, onLogout, onUserUpdate }: any) {
  const TOP_BAR_HEIGHT = 70;
  const BOTTOM_BAR_HEIGHT = 70;
  const { locale } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [actionsHeight, setActionsHeight] = useState(0);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [dobDraft, setDobDraft] = useState(new Date(2000, 0, 1));
  const isGoogleProfileCompletion = !!route?.params?.fromGoogle;
  const createProfileFromUser = (sourceUser: any = user) => ({
    userType: sourceUser?.userType || 'client',
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

  const setField = (key: string, value: string) => setProfile((prev: any) => ({ ...prev, [key]: value }));

  const validateProfile = (showAlert = true) => {
    if (profile.userType === 'client') {
      if (!profile.name || !profile.password || !profile.gender || !profile.age || !profile.country) {
        if (showAlert) {
          Alert.alert('Error', 'Please fill Username, Password, Gender, Age and Country');
        }
        return;
      }
    } else {
      if (!profile.name || !profile.email || !profile.firstName || !profile.lastName || !profile.addressStreet || !profile.addressCity || !profile.addressState || !profile.addressZipCode || !profile.addressCountry || !profile.phoneNumber || !profile.gender || !profile.dateOfBirth) {
        if (showAlert) {
          Alert.alert('Error', 'Please fill all required Agent fields');
        }
        return;
      }
    }
    return true;
  };

  const saveProfile = async () => {
    if (!user?._id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (!validateProfile(true)) return;

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
        Alert.alert('Error', data.message || 'Failed to update profile');
        return;
      }

      const updatedUser = data.user || data.data;
      await AsyncStorage.setItem('userToken', data.token || '');
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate?.(updatedUser);
      const refreshedProfile = createProfileFromUser(updatedUser);
      setProfile(refreshedProfile);
      setInitialProfile(refreshedProfile);
      Alert.alert('Success', 'Profile updated');
      navigation.navigate('Home');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isGoogleProfileCompletion && !validateProfile(true)) {
      return;
    }
    setProfile(initialProfile);
    if (isGoogleProfileCompletion) {
      navigation.replace('Home');
      return;
    }
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
            <Text style={styles.header}>Edit Profile</Text>
            <Text style={styles.label}>User Type:</Text>
            <View style={styles.userTypeButtons}>
              {(['client', 'agent'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.userTypeButton, profile.userType === type && styles.userTypeButtonActive]}
                  onPress={() => setField('userType', type)}
                >
                  <Text style={[styles.userTypeButtonText, profile.userType === type && styles.userTypeButtonTextActive]}>
                    {type === 'client' ? 'Client' : 'Agent'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Username:</Text>
            <TextInput style={styles.input} placeholder="Username" value={profile.name} onChangeText={(v) => setField('name', v)} />

            {profile.userType === 'client' ? (
              <>
                <Text style={styles.label}>Password:</Text>
                <TextInput style={styles.input} placeholder="Password" value={profile.password} onChangeText={(v) => setField('password', v)} secureTextEntry />
                <Text style={styles.label}>Gender:</Text>
                <View style={styles.genderContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.genderOption, profile.gender === option.value && styles.genderOptionSelected]}
                      onPress={() => setField('gender', option.value)}
                    >
                      <Text style={[styles.genderOptionText, profile.gender === option.value && styles.genderOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Age:</Text>
                <TextInput style={styles.input} placeholder="Age" value={profile.age} onChangeText={(v) => setField('age', v)} keyboardType="numeric" />
                <Text style={styles.label}>Country:</Text>
                <TouchableOpacity style={styles.countryButton} onPress={() => setCountryModalVisible(true)}>
                  <Text style={profile.country ? styles.countryButtonText : styles.countryButtonPlaceholder}>{profile.country || 'Select Country'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Email:</Text>
                <TextInput style={styles.input} placeholder="Email" value={profile.email} onChangeText={(v) => setField('email', v)} keyboardType="email-address" autoCapitalize="none" />
                <Text style={styles.label}>First Name:</Text>
                <TextInput style={styles.input} placeholder="First Name" value={profile.firstName} onChangeText={(v) => setField('firstName', v)} />
                <Text style={styles.label}>Last Name:</Text>
                <TextInput style={styles.input} placeholder="Last Name" value={profile.lastName} onChangeText={(v) => setField('lastName', v)} />
                <Text style={styles.label}>Street:</Text>
                <TextInput style={styles.input} placeholder="Street" value={profile.addressStreet} onChangeText={(v) => setField('addressStreet', v)} />
                <Text style={styles.label}>City:</Text>
                <TextInput style={styles.input} placeholder="City" value={profile.addressCity} onChangeText={(v) => setField('addressCity', v)} />
                <Text style={styles.label}>State:</Text>
                <TextInput style={styles.input} placeholder="State" value={profile.addressState} onChangeText={(v) => setField('addressState', v)} />
                <Text style={styles.label}>Zip Code:</Text>
                <TextInput style={styles.input} placeholder="Zip Code" value={profile.addressZipCode} onChangeText={(v) => setField('addressZipCode', v)} />
                <Text style={styles.label}>Country:</Text>
                <TextInput style={styles.input} placeholder="Country" value={profile.addressCountry} onChangeText={(v) => setField('addressCountry', v)} />
                <Text style={styles.label}>Phone Number:</Text>
                <TextInput style={styles.input} placeholder="Phone Number" value={profile.phoneNumber} onChangeText={(v) => setField('phoneNumber', v)} keyboardType="phone-pad" />
                <Text style={styles.label}>Gender:</Text>
                <View style={styles.genderContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.genderOption, profile.gender === option.value && styles.genderOptionSelected]}
                      onPress={() => setField('gender', option.value)}
                    >
                      <Text style={[styles.genderOptionText, profile.gender === option.value && styles.genderOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Date of Birth:</Text>
                <TouchableOpacity
                  style={styles.countryButton}
                  onPress={() => {
                    setDobDraft(parseDate(profile.dateOfBirth));
                    setDobPickerVisible(true);
                  }}
                >
                  <Text style={profile.dateOfBirth ? styles.countryButtonText : styles.countryButtonPlaceholder}>
                    {profile.dateOfBirth || 'Select Date of Birth'}
                  </Text>
                </TouchableOpacity>
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
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, loading && { opacity: 0.6 }]} onPress={saveProfile} disabled={loading}>
            <Text style={styles.saveText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={countryModalVisible} transparent animationType="slide" onRequestClose={() => setCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <ScrollView>
              {COUNTRIES.map((country) => (
                <TouchableOpacity key={country} style={styles.countryItem} onPress={() => { setField('country', country); setCountryModalVisible(false); }}>
                  <Text style={styles.countryItemText}>{country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCountryModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
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
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDobPickerVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  setField('dateOfBirth', formatDate(dobDraft));
                  setDobPickerVisible(false);
                }}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  userTypeButtons: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  userTypeButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  userTypeButtonActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  userTypeButtonText: { color: '#666', fontWeight: '500' },
  userTypeButtonTextActive: { color: '#fff', fontWeight: '700' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  genderContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  genderOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  genderOptionSelected: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  genderOptionText: { color: '#666', fontSize: 15 },
  genderOptionTextSelected: { color: '#fff', fontWeight: '600' },
  countryButton: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  countryButtonText: { color: '#333' },
  countryButtonPlaceholder: { color: '#999' },
  actions: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' },
  cancelButton: { flex: 1, backgroundColor: '#f1f1f1', borderRadius: 8, padding: 14, alignItems: 'center' },
  saveButton: { flex: 1, backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center' },
  cancelText: { color: '#333', fontWeight: '600' },
  saveText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', maxHeight: '75%', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  dobPreviewBox: { backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 10 },
  dobPreviewText: { fontSize: 18, fontWeight: '600', color: '#1976d2' },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateAdjustButton: { flex: 1, backgroundColor: '#e3f2fd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  dateAdjustButtonText: { color: '#1976d2', fontWeight: '600' },
  countryItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  countryItemText: { color: '#333' },
  modalCancel: { marginTop: 12, alignItems: 'center', backgroundColor: '#f2f2f2', padding: 10, borderRadius: 8 },
  modalCancelText: { color: '#333', fontWeight: '600' },
});
