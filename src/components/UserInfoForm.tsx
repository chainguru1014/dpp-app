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
        Alert.alert('Error', 'Please fill in all required fields');
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
        Alert.alert('Error', 'Please fill in all required fields');
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
            {userType === 'client' ? 'Complete Your Profile' : 'Agent Registration'}
          </Text>
          <ScrollView style={styles.scrollView}>
            {userType === 'client' ? (
              <>
                <Text style={styles.label}>Username *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.username}
                  onChangeText={(text) => setFormData({ ...formData, username: text })}
                  placeholder="Username"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Gender *</Text>
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

                <Text style={styles.label}>Age *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.age}
                  onChangeText={(text) => setFormData({ ...formData, age: text })}
                  placeholder="Age"
                  keyboardType="numeric"
                />

                <Text style={styles.label}>Country *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.country}
                  onChangeText={(text) => setFormData({ ...formData, country: text })}
                  placeholder="Country"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  placeholder="First Name"
                />

                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                  placeholder="Last Name"
                />

                <Text style={styles.label}>Date of Birth *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dateOfBirth}
                  onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={styles.label}>Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  placeholder="Address"
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Gender *</Text>
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
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Submit</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f5f5f5',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  genderContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  genderOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  genderOptionText: {
    fontSize: 14,
    color: '#666',
  },
  genderOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#1976d2',
    marginLeft: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
