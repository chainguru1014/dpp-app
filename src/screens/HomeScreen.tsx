import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import AppLayout from '../components/AppLayout';
import { useI18n } from '../i18n/I18nContext';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
  user: any;
  onLogout: () => void;
}

export default function HomeScreen({ navigation, user, onLogout }: HomeScreenProps) {
  const { t } = useI18n();
  
  const handleScanPress = () => {
    navigation.navigate('Scanner');
  };

  return (
    <AppLayout
      navigation={navigation}
      user={user}
      onLogout={onLogout}
      showBackButton={false}
      useCenterTop={true}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Top Text */}
          <Text style={styles.topText}>{t('homeScanQr')}</Text>

          {/* QR Code with Padlock */}
          <TouchableOpacity
            style={styles.qrContainer}
            onPress={handleScanPress}
            activeOpacity={0.8}
          >
            <View style={styles.qrFrame}>
              <Image
                source={require('../assets/Screenshot_9.png')}
                style={styles.mainQrImage}
                resizeMode="cover"
              />
              <View style={[styles.cornerBracket, styles.topLeft]} />
              <View style={[styles.cornerBracket, styles.topRight]} />
              <View style={[styles.cornerBracket, styles.bottomLeft]} />
              <View style={[styles.cornerBracket, styles.bottomRight]} />
            </View>
          </TouchableOpacity>

          {/* Bottom Text */}
          <View style={styles.bottomTextContainer}>
            <Text style={styles.bottomText}>{t('homeDigital')}</Text>
            <Text style={styles.bottomText}>{t('homeProduct')}</Text>
            <Text style={styles.bottomText}>{t('homePassport')}</Text>
          </View>

          <View style={styles.storeBadgesContainer}>
            <Image
              source={require('../assets/App_Store_(iOS)-Badge-Alternative-Logo.wine.png')}
              style={styles.storeBadge}
              resizeMode="contain"
            />
            <Image
              source={require('../assets/Google_Play-Badge-Logo.wine.png')}
              style={styles.storeBadge}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  topText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#3d5c93',
    marginBottom: 40,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
  },
  qrFrame: {
    width: width * 0.7,
    maxWidth: 300,
    aspectRatio: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainQrImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  cornerBracket: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#1976d2', // Medium blue
    borderWidth: 3,
  },
  topLeft: {
    borderColor: '#3d5c93',
    top: 10,
    left: 10,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    borderColor: '#3d5c93',
    top: 10,
    right: 10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    borderColor: '#3d5c93',
    bottom: 10,
    left: 10,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    borderColor: '#3d5c93',
    bottom: 10,
    right: 10,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  bottomTextContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  bottomText: {
    fontSize: 22,
    color: '#3d5c93',
    fontWeight: '500',
    lineHeight: 30,
    textAlign: 'center',
  },
  storeBadgesContainer: {
    marginTop: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  storeBadge: {
    width: Math.min(width * 0.48, 220),
    height: 104,
  },
});
