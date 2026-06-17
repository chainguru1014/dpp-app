import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useI18n } from '../i18n/I18nContext';
import { colors, spacing, radius, fontSize, shadow } from '../theme';

interface UserInfoFormProps {
  visible: boolean;
  userType: 'client' | 'agent';
  defaultUsername?: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function UserInfoForm({
  visible,
  userType,
  defaultUsername,
  onSubmit,
  onCancel,
}: UserInfoFormProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    username: defaultUsername || '',
    gender: '',
    age: '',
    country: '',
    email: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    address: '',
  });

  const handleSubmit = () => {
    if (userType === 'client') {
      if (!formData.username || !formData.gender || !formData.age || !formData.country) {
        Alert.alert(t('error'), t('pleaseFillAllRequired'));
        return;
      }
      onSubmit({
        userType: 'client',
        username: formData.username,
        gender: formData.gender,
        age: parseInt(formData.age),
        country: formData.country,
      });
    } else {
      if (
        !formData.email ||
        !formData.firstName ||
        !formData.lastName ||
        !formData.dateOfBirth ||
        !formData.address ||
        !formData.gender
      ) {
        Alert.alert(t('error'), t('pleaseFillAllRequired'));
        return;
      }
      onSubmit({
        userType: 'agent',
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        gender: formData.gender,
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {userType === 'client' ? t('completeProfile') : t('agentRegistration')}
          </Text>
          <ScrollView style={styles.scrollView}>
            {userType === 'client' ? (
              <>
                <Text style={styles.label}>{t('username')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  placeholder={t('username')}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>{t('gender')} *</Text>
                <View style={styles.genderContainer}>
                  {['male', 'female', 'other'].map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        formData.gender === gender && styles.genderOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, gender })}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          formData.gender === gender && styles.genderOptionTextSelected,
                        ]}
                      >
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t('age')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={(text) => setFormData({ ...formData, age: text })}
                  placeholder={t('age')}
                  keyboardType="numeric"
                />

                <Text style={styles.label}>{t('country')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.country}
                  onChangeText={(text) => setFormData({ ...formData, country: text })}
                  placeholder={t('country')}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>{t('email')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder={t('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>{t('firstName')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  placeholder={t('firstName')}
                />

                <Text style={styles.label}>{t('lastName')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                  placeholder={t('lastName')}
                />

                <Text style={styles.label}>{t('dateOfBirth')} *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dateOfBirth}
                  onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={styles.label}>{t('address')} *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  placeholder={t('address')}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>{t('gender')} *</Text>
                <View style={styles.genderContainer}>
                  {['male', 'female', 'other'].map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.genderOption,
                        formData.gender === gender && styles.genderOptionSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, gender })}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          formData.gender === gender && styles.genderOptionTextSelected,
                        ]}
                      >
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    ...shadow(3),
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.heading,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.fieldBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  genderOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderOptionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.muted,
  },
  genderOptionTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
