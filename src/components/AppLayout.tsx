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
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nContext';
import NotificationPanel from './NotificationPanel';
import NotificationDetailModal from './NotificationDetailModal';
import NotificationBadge from './NotificationBadge';
import { colors, radius, shadow, gradients } from '../theme';

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
  onActionMenuPress?: (actionKey: string) => void;
  onSettingsMenuPress?: (settingKey: string) => void;
  isBrandFollowed?: boolean;
  isInAlbum?: boolean;
  useActionMenuCenter?: boolean;
  isProductDetailPage?: boolean;
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
  onActionMenuPress,
  onSettingsMenuPress,
  isBrandFollowed = false,
  isInAlbum = false,
  useActionMenuCenter = false,
  isProductDetailPage = false,
}: AppLayoutProps) {
  const { t, locale, setLocale, languages } = useI18n();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [extraMenuVisible, setExtraMenuVisible] = useState(false);
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [langPopover, setLangPopover] = useState({ top: 76, right: 16 });
  const worldIconRef = useRef<View>(null);
  const isAuthenticated = !!user;
  const [notifPanelVisible, setNotifPanelVisible] = useState(false);
  const [notifDetail, setNotifDetail] = useState<any>(null);

  const handleNotifications = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    setNotifPanelVisible(true);
  };

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

  // Center button is always the QR scanner on every page.
  const handleScan = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate('Scanner');
  };

  const closeActionMenu = () => {
    setActionMenuVisible(false);
  };

  // Right-side menu button. On the product detail page it is the 3-line product
  // action menu; on every other page it opens the history/data menu.
  const handleExtraMenu = () => {
    if (isProductDetailPage || useActionMenuCenter) {
      setActionMenuVisible(true);
      return;
    }
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    setExtraMenuVisible(true);
  };

  // Navigation for the 4 history/data items (shared by the new menu button and,
  // on the product detail page, the center action menu).
  const handleExtraMenuItemPress = (itemKey: string) => {
    setExtraMenuVisible(false);
    if (onSettingsMenuPress) {
      onSettingsMenuPress(itemKey);
      return;
    }
    if (itemKey === 'purchaseHistory') {
      navigation.navigate('PurchaseHistory');
    } else if (itemKey === 'viewHistory') {
      navigation.navigate('History');
    } else if (itemKey === 'favoriteBrands') {
      navigation.navigate('FavoriteBrands');
    }
  };

  const actionMenuItems = [
    { key: 'saveProductInfo', label: t('saveProductInfo'), iconSource: require('../assets/diskette.png') },
    { key: 'copyProductInfo', label: t('copyProductInfo'), iconSource: require('../assets/copy.png') },
    { key: 'sendProductInfo', label: t('sendProductInfo'), iconSource: require('../assets/send.png') },
    { key: 'toggleAlbum', label: isInAlbum ? t('removeFromAlbum') : t('addAlbum'), iconSource: require('../assets/add-image.png') },
    { key: 'connectBrand', label: t('connectBrand'), iconSource: require('../assets/brand.png') },
    { key: 'connectSalesPerson', label: t('connectSalesPerson'), iconSource: require('../assets/end-call.png') },
    { key: 'toggleFollowBrand', label: isBrandFollowed ? t('unfollowBrand') : t('followBrand'), iconSource: require('../assets/add-friend.png') },
    { key: 'introduceBrandToFriend', label: t('introduceBrand'), iconSource: require('../assets/connection.png') },
  ];
  const commonCenterMenuItems = [
    { key: 'scanQr', label: t('homeScanQr'), iconSource: require('../assets/qr-code.png') },
  ];

  // The 4 history/data items. Opened from the new 3-line menu button in the bottom
  // bar, and (on the product detail page) also appended to the center action menu.
  const extraMenuItems = [
    { key: 'purchaseHistory', label: t('purchaseHistory'), iconSource: require('../assets/purchase-history.png') },
    { key: 'viewHistory', label: t('productHistory'), iconSource: require('../assets/history.png') },
    { key: 'favoriteBrands', label: t('favoriteBrands'), iconSource: require('../assets/favorite.png') },
  ];

  // Center menu list. On the product detail page the original action items get the
  // 4 history/data items appended ("nav" kind), otherwise it's the plain scan item.
  const centerMenuItems =
    isProductDetailPage || useActionMenuCenter
      ? [
          ...actionMenuItems.map((item) => ({ ...item, kind: 'action' as const })),
          ...extraMenuItems.map((item) => ({ ...item, kind: 'nav' as const })),
        ]
      : commonCenterMenuItems.map((item) => ({ ...item, kind: 'center' as const }));

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, gradients.header]}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.iconButton, styles.navBtnOnDark]}
            activeOpacity={0.7}
          >
            <Image
              source={require('../assets/left-arrow.png')}
              style={styles.topBarIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.iconButton, styles.logoBadge]}>
            <Image
              source={require('../assets/logo-y-mark.png')}
              style={styles.topBarLogoIcon}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.dppBadge}>
          <Text style={styles.dppBadgeText}>{t('homeHeroEyebrow')}</Text>
        </View>

        <TouchableOpacity
          onPress={handleNotifications}
          style={[styles.iconButton, styles.navBtnOnDark]}
          activeOpacity={0.7}
        >
          <View ref={worldIconRef}>
            <Icon name="notifications" size={24} color={colors.white} />
            <NotificationBadge userId={user?._id ? String(user._id) : undefined} />
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
          style={[styles.bottomIconButton, styles.bottomIconNudgeLeft]}
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
          style={styles.bottomScanButton}
          onPress={handleScan}
          activeOpacity={0.85}
        >
          <View style={styles.bottomScanCircle}>
            <Image
              source={require('../assets/logo-y-mark.png')}
              style={styles.bottomScanIcon}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomIconButton, styles.bottomIconNudgeRight]}
          onPress={handleExtraMenu}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/menus.png')}
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
        visible={(isProductDetailPage || useActionMenuCenter) && actionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActionMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeActionMenu}
        >
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>{t('menu')}</Text>
            <Text style={styles.settingsSubtitle}>{t('quickActionsSubtitle')}</Text>

            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={true}>
            {centerMenuItems.map((item, index, list) => (
              <View key={item.label}>
                {item.kind === 'nav' && (index === 0 || list[index - 1].kind !== 'nav') ? (
                  <Text style={styles.menuSectionLabel}>{t('historyAndData')}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeActionMenu();
                    if (item.kind === 'nav') {
                      handleExtraMenuItemPress(item.key);
                    } else if (item.kind === 'action') {
                      onActionMenuPress?.(item.key);
                    } else if (item.key === 'scanQr') {
                      if (!isAuthenticated) {
                        onGuestAction?.();
                      } else {
                        navigation.navigate('Scanner');
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={item.iconSource} style={styles.menuItemIcon} resizeMode="contain" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
                {index < list.length - 1 ? <View style={styles.menuDivider} /> : null}
              </View>
            ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
        visible={extraMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExtraMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExtraMenuVisible(false)}
        >
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>{t('menu')}</Text>
            <Text style={styles.settingsSubtitle}>{t('historyBrandsData')}</Text>

            {extraMenuItems.map((item, index, list) => (
              <View key={item.label}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleExtraMenuItemPress(item.key)}
                  activeOpacity={0.7}
                >
                  <Image source={item.iconSource} style={styles.menuItemIcon} resizeMode="contain" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
                {index < list.length - 1 ? <View style={styles.menuDivider} /> : null}
              </View>
            ))}
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

      {notifPanelVisible && (
        <NotificationPanel
          visible={notifPanelVisible}
          user={user}
          onClose={() => setNotifPanelVisible(false)}
          onOpenDetail={(n) => {
            setNotifPanelVisible(false);
            setNotifDetail(n);
          }}
          onShowAll={() => {
            setNotifPanelVisible(false);
            navigation.navigate('Notifications');
          }}
        />
      )}
      {!!notifDetail && (
        <NotificationDetailModal
          visible={!!notifDetail}
          notification={notifDetail}
          user={user}
          onClose={() => setNotifDetail(null)}
        />
      )}
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
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: colors.navy,
    zIndex: 1000,
    elevation: 10,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtn: {
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
  },
  navBtnOnDark: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  topBarIcon: {
    width: 22,
    height: 22,
    tintColor: '#fff',
  },
  // White circular badge holding the blue Y logo on the top bar
  // (matches the bottom-center button).
  logoBadge: {
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  topBarLogoIcon: {
    width: 28,
    height: 28,
  },
  dppBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dppBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 1.2,
  },
  menuIcon: {
    width: 22,
    height: 22,
    tintColor: colors.primary,
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 1000,
    elevation: 12,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  bottomIconButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Nudge the 2nd / 4th icons away from the center scan button for a more even fit.
  bottomIconNudgeLeft: {
    transform: [{ translateX: -5 }],
  },
  bottomIconNudgeRight: {
    transform: [{ translateX: 5 }],
  },
  bottomIcon: {
    width: 26,
    height: 26,
    tintColor: colors.primary,
  },
  bottomScanButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomScanCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#cfe0f7',
    shadowColor: colors.header,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomScanIcon: {
    width: 38,
    height: 38,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  settingsContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingVertical: 22,
    paddingHorizontal: 20,
    // Never grow past the top bar — the sheet stops right below it.
    maxHeight: SCREEN_HEIGHT - TOP_BAR_HEIGHT,
    ...shadow(3),
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.heading,
    marginBottom: 6,
  },
  settingsSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 20,
  },
  menuScroll: {
    // Fill the sheet up to just below the top bar (header/padding reserved).
    maxHeight: SCREEN_HEIGHT - TOP_BAR_HEIGHT - 120,
  },
  menuSectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 5,
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
    color: colors.text,
    fontWeight: '400',
  },
  menuItemIcon: {
    width: 24,
    height: 24,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  langOverlay: {
    flex: 1,
  },
  langPopover: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(3),
  },
  langItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  langItemActive: {
    backgroundColor: colors.surfaceAlt,
  },
  langText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '400',
  },
  langTextActive: {
    color: colors.accent,
    fontWeight: '400',
  },
});