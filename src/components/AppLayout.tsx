import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Modal,
  Text,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '../i18n/I18nContext';

interface AppLayoutProps {
  children: React.ReactNode;
  navigation: any;
  user?: any;
  onLogout?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
  useCenterTop?: boolean;
  hideBottomBar?: boolean;
  onGuestAction?: () => void;
}

const TOP_BAR_HEIGHT = 70;
const BOTTOM_BAR_HEIGHT = 70;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_TOP = SCREEN_HEIGHT / 2;
const BOTTOM_TOP = SCREEN_HEIGHT - BOTTOM_BAR_HEIGHT;

export default function AppLayout({
  children,
  navigation,
  user,
  onLogout,
  showBackButton = false,
  onBackPress,
  useCenterTop = false,
  hideBottomBar = false,
  onGuestAction,
}: AppLayoutProps) {
  const { t, locale, setLocale, languages } = useI18n();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [langPopover, setLangPopover] = useState({ top: 76, right: 16 });
  const worldIconRef = useRef<View>(null);
  const isAuthenticated = !!user;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      if (!isAuthenticated) return;
      navigation.navigate('Home');
    }
  };

  const openLanguageMenu = () => {
    worldIconRef.current?.measureInWindow((x, y, width, height) => {
      setLangPopover({
        top: y + height + 6,
        right: Math.max(12, SCREEN_WIDTH - x - width),
      });
      setLangMenuVisible(true);
    });
  };

  const handleProfile = () => {
    setSettingsVisible(false);
    if (!isAuthenticated) return;
    navigation.navigate('EditProfile');
  };

  const handleLogout = async () => {
    setSettingsVisible(false);
    const performLogout = async () => {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('user');
      if (onLogout) {
        onLogout();
      }
    };

    // React Native Alert button callbacks are not reliable on web.
    // Execute logout directly on web so storage is always cleared.
    if (Platform.OS === 'web') {
      await performLogout();
      return;
    }

    Alert.alert(t('logoutTitle'), t('logoutMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await performLogout();
        },
      },
    ]);
  };

  const handleHome = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate('Home');
  };

  const handleBookmark = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate('ScannedProducts');
  };

  const handleSettings = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    setSettingsVisible(true);
  };

  const handleScan = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate('Scanner');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Image
              source={require('../assets/left-arrow.png')}
              style={styles.menuIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}

        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/yometel-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity
          onPress={openLanguageMenu}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <View ref={worldIconRef}>
            <Image
              source={require('../assets/world.png')}
              style={styles.menuIcon}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.content, useCenterTop && styles.contentCentered, hideBottomBar && styles.contentWithoutBottomBar]}>
        {children}
      </View>

      {!hideBottomBar && (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomIconButton}
          onPress={handleHome}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/home.png')}
            style={styles.bottomIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomIconButton}
          onPress={handleBookmark}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/bookmark.png')}
            style={styles.bottomIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomIconButton}
          onPress={handleScan}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/qr-code-icon.png')}
            style={styles.bottomIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomIconButton}
          onPress={handleSettings}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/setting.png')}
            style={styles.bottomIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      )}

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>{t('settings')}</Text>
            <Text style={styles.settingsSubtitle}>{t('settingsSubtitle')}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleProfile}
              activeOpacity={0.7}
            >
              <Image
                source={require('../assets/account.png')}
                style={styles.menuIcon}
                resizeMode="contain"
              />
              <Text style={styles.menuItemText}>{t('profile')}</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setSettingsVisible(false);
                openLanguageMenu();
              }}
              activeOpacity={0.7}
            >
              <Image
                source={require('../assets/world.png')}
                style={styles.menuIcon}
                resizeMode="contain"
              />
              <Text style={styles.menuItemText}>{t('language')}</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {isAuthenticated && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Image
                  source={require('../assets/logout (1).png')}
                  style={styles.menuIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.menuItemText, { color: '#d32f2f' }]}>
                  {t('logout')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={langMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setLangMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLangMenuVisible(false)}>
          <View style={styles.langOverlay}>
            <View
              style={[
                styles.langPopover,
                { position: 'absolute', top: langPopover.top, right: langPopover.right },
              ]}
            >
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langItem,
                    locale === lang.code && styles.langItemActive,
                  ]}
                  onPress={() => {
                    setLocale(lang.code);
                    setLangMenuVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.langText,
                      locale === lang.code && styles.langTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 1000,
    elevation: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    height: 40,
    width: 150,
  },
  menuIcon: {
    width: 24,
    height: 24,
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: TOP_BAR_HEIGHT,
    paddingBottom: BOTTOM_BAR_HEIGHT,
  },
  contentCentered: {
    paddingTop: CONTENT_TOP,
  },
  contentWithoutBottomBar: {
    paddingBottom: 0,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BOTTOM_TOP,
    height: BOTTOM_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomIconButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIcon: {
    width: 28,
    height: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  settingsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 5,
    minHeight: 48,
  },
  menuItemText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  langOverlay: {
    flex: 1,
  },
  langPopover: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minWidth: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  langItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  langItemActive: {
    backgroundColor: '#e3f2fd',
  },
  langText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  langTextActive: {
    color: '#1976d2',
    fontWeight: '700',
  },
});