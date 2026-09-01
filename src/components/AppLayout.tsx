import React, { useState, useRef, useId, useEffect } from 'react';
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
import FeatherIcon from 'react-native-vector-icons/Feather';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useRoute } from '@react-navigation/native';
import { useI18n } from '../i18n/I18nContext';
import NotificationPanel from './NotificationPanel';
import NotificationDetailModal from './NotificationDetailModal';
import NotificationBadge from './NotificationBadge';
import { colors, radius, shadow } from '../theme';

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
  isProductDetailPage?: boolean;
  // Overrides the top-bar center content. When omitted, falls back to
  // ROUTE_TITLE_KEYS[route.name] (a per-screen page title), then to the
  // Home/EmployeeHome brand title, then to the generic DPP eyebrow text —
  // see the title-resolution block in the component body.
  title?: string;
  subtitle?: string;
}

// Static page-title map for screens that don't need a dynamic title (the
// corporate Scan/Review screens pass an explicit `title`/`subtitle` instead,
// since theirs depends on route params). Keeps most existing screens from
// needing any prop changes at all.
const ROUTE_TITLE_KEYS: Record<string, string> = {
  ScannedProducts: 'titleScannedProducts',
  EditProfile: 'titleEditProfile',
  PurchaseHistory: 'titlePurchaseHistory',
  History: 'titleHistory',
  FavoriteBrands: 'titleFavoriteBrands',
  Notifications: 'titleNotifications',
  Scanner: 'titleScanner',
};

const BRAND_TITLE = 'Yometel DPP';
const EMPLOYEE_BRAND_TITLE = 'Yometel Traceability';

const TOP_BAR_HEIGHT = 56;
const BOTTOM_BAR_HEIGHT = 54;
const BOTTOM_TAB_ICON_SIZE = 20;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_TOP = SCREEN_HEIGHT / 2;
const BOTTOM_TOP = SCREEN_HEIGHT - BOTTOM_BAR_HEIGHT;

// Fixed popover anchor positions -- see the comment on openAvatarMenu/
// openLanguageMenu below for why these are static instead of measured.
const AVATAR_POPOVER_POS = { top: TOP_BAR_HEIGHT + 6, right: 16 };
const LANG_POPOVER_POS = { top: TOP_BAR_HEIGHT + 20, right: 16 };

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
  isProductDetailPage = false,
  title,
  subtitle,
}: AppLayoutProps) {
  const { t, locale, setLocale, languages } = useI18n();
  const route = useRoute();
  // Unique per mounted instance — react-navigation keeps previous stack
  // screens (each with their own AppLayout) mounted underneath the active
  // one, and on web a fixed <Defs> id collides across all of them, so
  // whichever one wins the DOM race renders the gradient (or none of them
  // reliably do). useId() guarantees no collision.
  const gradientId = `topBarGradient-${useId()}`;
  const isHomeRoute = route.name === 'Home' || route.name === 'EmployeeHome';
  const routeTitleKey = ROUTE_TITLE_KEYS[route.name];
  const computedTitle = title ?? (
    isHomeRoute
      ? (route.name === 'EmployeeHome' ? EMPLOYEE_BRAND_TITLE : BRAND_TITLE)
      : routeTitleKey ? t(routeTitleKey as any) : undefined
  );
  // Consumer sessions: every page's top bar EXCEPT Home itself shows the
  // selected Home-page location item as a subtitle (matching the corporate
  // top bar's step-context subtitle) — cached by HomeScreen so this never
  // needs to fetch the steps list itself. A screen-supplied `subtitle` prop
  // (e.g. ResultScreen's product name) always wins. Home/EmployeeHome are
  // title-only, no subtitle, on both actor kinds.
  const [consumerLocationLabel, setConsumerLocationLabel] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (user?.actorKind === 'Employee') return;
    AsyncStorage.getItem('consumerSelectedLocationLabel').then((stored) => {
      if (stored) setConsumerLocationLabel(stored);
    });
  }, [user?.actorKind]);
  const computedSubtitle = subtitle ?? (!isHomeRoute && user && user.actorKind !== 'Employee' ? consumerLocationLabel : undefined);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [langPopover, setLangPopover] = useState(LANG_POPOVER_POS);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  const [avatarPopover, setAvatarPopover] = useState(AVATAR_POPOVER_POS);
  const isAuthenticated = !!user;
  const isEmployeeActor = user?.actorKind === 'Employee';
  const [notifPanelVisible, setNotifPanelVisible] = useState(false);
  const [notifDetail, setNotifDetail] = useState<any>(null);

  // Corporate/employee sessions "Review" their operational scan captures via
  // the corporate Review History screen; consumer sessions browse their own
  // scanned Products via ScannedProducts — same bottom-bar slot, same icon,
  // different label/target.
  const productsTarget = isEmployeeActor ? 'CorporateReview' : 'ScannedProducts';

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
      navigation.navigate(user?.actorKind === 'Employee' ? 'EmployeeHome' : 'Home');
    }
  };

  // Both popovers anchor under the avatar icon, whose position in the top
  // bar is fixed by the layout (same spot on every screen, never varies with
  // content) -- so rather than measuring it at runtime, just use that fixed
  // position directly. This used to call `avatarIconRef.current?.measureInWindow(...)`,
  // but that returned unreliable (near-zero) coordinates on Android even on
  // a plain, un-modal-preceded icon tap -- not a timing race with the avatar
  // Modal's teardown (a setTimeout-deferred measurement still failed the
  // same way), just measureInWindow itself being flaky here -- so the
  // popover rendered pinned to the top-left corner instead of under the
  // icon. AVATAR_POPOVER_POS/LANG_POPOVER_POS below are that fixed position.
  const openLanguageMenu = () => {
    setLangPopover(LANG_POPOVER_POS);
    setLangMenuVisible(true);
  };

  const openAvatarMenu = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    setAvatarPopover(AVATAR_POPOVER_POS);
    setAvatarMenuVisible(true);
  };

  const handleProfile = () => {
    setSettingsVisible(false);
    setAvatarMenuVisible(false);
    if (!isAuthenticated) return;
    navigation.navigate('EditProfile');
  };

  const handleLogout = async () => {
    setSettingsVisible(false);
    setAvatarMenuVisible(false);
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
    navigation.navigate(isEmployeeActor ? 'EmployeeHome' : 'Home');
  };

  const handleProducts = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate(productsTarget);
  };

  const handleSettings = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    setSettingsVisible(true);
  };

  // Consumer sessions get the normal QR Scanner; corporate/employee sessions
  // get the Capture Operation screen instead, for whichever Worker
  // Operations step the worker last selected on Home (falls back to the
  // first step if none has been selected yet this session).
  const handleScan = async () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    if (isEmployeeActor) {
      const stored = await AsyncStorage.getItem('employeeSelectedStepIndex');
      navigation.navigate('CorporateScanner', { stepIndex: stored != null ? Number(stored) : 0 });
      return;
    }
    navigation.navigate('Scanner');
  };

  // Navigation for the "History & Data" items — always available from
  // Settings now that the standalone 3-line menu button is gone.
  const handleExtraMenuItemPress = (itemKey: string) => {
    setSettingsVisible(false);
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

  // History/data items — always shown in Settings. On the product detail page
  // the product action items above are shown too (formerly a separate 3-line
  // menu button; that button is gone, its content now lives here).
  const extraMenuItems = [
    { key: 'purchaseHistory', label: t('purchaseHistory'), iconSource: require('../assets/purchase-history.png') },
    { key: 'viewHistory', label: t('productHistory'), iconSource: require('../assets/history.png') },
    { key: 'favoriteBrands', label: t('favoriteBrands'), iconSource: require('../assets/favorite.png') },
  ];

  const settingsMenuItems = isProductDetailPage
    ? [
        ...actionMenuItems.map((item) => ({ ...item, kind: 'action' as const })),
        ...extraMenuItems.map((item) => ({ ...item, kind: 'nav' as const })),
      ]
    : extraMenuItems.map((item) => ({ ...item, kind: 'nav' as const }));

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {/* Numeric width/height (not "100%") -- percentage-sized <Svg> on
            Android doesn't reliably track its parent View's actual
            flexbox-computed size (a long-standing react-native-svg
            Android-specific timing issue), so the gradient rect used to
            render shorter/narrower than the topBar itself, leaving the
            title/icons poking out past it into the plain white background
            behind. SCREEN_WIDTH/TOP_BAR_HEIGHT are already fixed constants
            here, so numeric sizing costs nothing. */}
        <Svg style={StyleSheet.absoluteFill} width={SCREEN_WIDTH} height={TOP_BAR_HEIGHT}>
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.headerLight} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.header} stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SCREEN_WIDTH} height={TOP_BAR_HEIGHT} fill={`url(#${gradientId})`} />
        </Svg>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.iconButton, styles.backButtonCircle]}
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

        <View style={styles.titleBlock}>
          <Text style={styles.titleText} numberOfLines={1}>
            {computedTitle ?? t('homeHeroEyebrow')}
          </Text>
          {!!computedSubtitle && (
            <Text style={styles.subtitleText} numberOfLines={1}>
              {computedSubtitle}
            </Text>
          )}
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={handleNotifications}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <View>
              <Icon name="notifications" size={26} color={colors.white} />
              <NotificationBadge userId={user?._id ? String(user._id) : undefined} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openAvatarMenu}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <View>
              <Icon name="account-circle" size={28} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.content, useCenterTop && styles.contentCentered, hideBottomBar && styles.contentWithoutBottomBar]}>
        {children}
      </View>

      {!hideBottomBar && (() => {
        const isHomeSelected = route.name === 'Home' || route.name === 'EmployeeHome';
        const isScanSelected = route.name === 'Scanner' || route.name === 'CorporateScanner';
        const isProductsSelected = route.name === productsTarget;
        const isSettingsSelected = settingsVisible;
        return (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomTab, isHomeSelected && styles.bottomTabSelected]}
              onPress={handleHome}
              activeOpacity={0.7}
            >
              {isHomeSelected && <View style={styles.bottomTabIndicator} />}
              <Image
                source={require('../assets/home.png')}
                style={[styles.bottomTabIcon, isHomeSelected && styles.bottomTabIconSelected]}
                resizeMode="contain"
              />
              <Text style={[styles.bottomTabLabel, isHomeSelected && styles.bottomTabLabelSelected]}>
                {t('bottomHome')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, isScanSelected && styles.bottomTabSelected]}
              onPress={handleScan}
              activeOpacity={0.7}
            >
              {isScanSelected && <View style={styles.bottomTabIndicator} />}
              <Icon
                name="qr-code-scanner"
                size={BOTTOM_TAB_ICON_SIZE}
                color={isScanSelected ? colors.primary : '#333333'}
              />
              <Text style={[styles.bottomTabLabel, isScanSelected && styles.bottomTabLabelSelected]}>
                {isEmployeeActor ? t('bottomCapture') : t('bottomScan')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, isProductsSelected && styles.bottomTabSelected]}
              onPress={handleProducts}
              activeOpacity={0.7}
            >
              {isProductsSelected && <View style={styles.bottomTabIndicator} />}
              <FeatherIcon
                name="file-text"
                size={BOTTOM_TAB_ICON_SIZE}
                color={isProductsSelected ? colors.primary : '#333333'}
              />
              <Text style={[styles.bottomTabLabel, isProductsSelected && styles.bottomTabLabelSelected]}>
                {isEmployeeActor ? t('bottomReview') : t('bottomProducts')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, isSettingsSelected && styles.bottomTabSelected]}
              onPress={handleSettings}
              activeOpacity={0.7}
            >
              {isSettingsSelected && <View style={styles.bottomTabIndicator} />}
              <Image
                source={require('../assets/setting.png')}
                style={[styles.bottomTabIcon, isSettingsSelected && styles.bottomTabIconSelected]}
                resizeMode="contain"
              />
              <Text style={[styles.bottomTabLabel, isSettingsSelected && styles.bottomTabLabelSelected]}>
                {t('bottomSettings')}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

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
            <Text style={styles.settingsSubtitle}>
              {t('settingsSubtitle')}
            </Text>

            {/* Profile and Logout live in the top-bar avatar dropdown only —
                this sheet is History&Data/product-actions, same submenu for
                both consumer and corporate/employee sessions, never
                Profile/Logout. */}
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={true}>
              {settingsMenuItems.map((item, index, list) => (
                  <View key={item.label}>
                    {item.kind === 'nav' && (index === 0 || list[index - 1].kind !== 'nav') ? (
                      <Text style={styles.menuSectionLabel}>{t('historyAndData')}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        if (item.kind === 'nav') {
                          handleExtraMenuItemPress(item.key);
                        } else {
                          setSettingsVisible(false);
                          onActionMenuPress?.(item.key);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Image source={item.iconSource} style={styles.menuItemIcon} resizeMode="contain" />
                      <Text style={styles.menuItemText}>{item.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.menuDivider} />
                  </View>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={avatarMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAvatarMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAvatarMenuVisible(false)}>
          <View style={styles.langOverlay}>
            <View
              style={[
                styles.langPopover,
                styles.avatarPopover,
                { position: 'absolute', top: avatarPopover.top, right: avatarPopover.right },
              ]}
            >
              <TouchableOpacity style={styles.avatarMenuItem} onPress={handleProfile} activeOpacity={0.7}>
                <Image source={require('../assets/account.png')} style={styles.avatarMenuIcon} resizeMode="contain" />
                <Text style={styles.avatarMenuText}>{t('profile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.avatarMenuItem}
                onPress={() => {
                  setAvatarMenuVisible(false);
                  openLanguageMenu();
                }}
                activeOpacity={0.7}
              >
                <Image source={require('../assets/world.png')} style={styles.avatarMenuIcon} resizeMode="contain" />
                <Text style={styles.avatarMenuText}>{t('language')}</Text>
              </TouchableOpacity>
              {isAuthenticated && (
                <TouchableOpacity style={styles.avatarMenuItem} onPress={handleLogout} activeOpacity={0.7}>
                  <Image source={require('../assets/logout (1).png')} style={styles.avatarMenuIcon} resizeMode="contain" />
                  <Text style={[styles.avatarMenuText, { color: '#d32f2f' }]}>{t('logout')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
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
    overflow: 'hidden',
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
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtn: {
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  navBtnOnDark: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  // Back button: just the icon, no filled circle behind it.
  backButtonCircle: {
    borderRadius: 16,
  },
  topBarIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // White circular badge holding the blue Y logo on the top bar
  // (matches the bottom-center button).
  logoBadge: {
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  topBarLogoIcon: {
    width: 28,
    height: 28,
  },
  // Left-aligned title block next to the logo/back-button — replaces the old
  // always-centered "DIGITAL PRODUCT PASSPORT" eyebrow badge. See
  // ROUTE_TITLE_KEYS / BRAND_TITLE / the title/subtitle props above.
  titleBlock: {
    flex: 1,
    marginLeft: 18,
    justifyContent: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'left',
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
    textAlign: 'left',
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
  // Each of the 4 bottom-bar tabs: plain icon + label, black/dark-gray when
  // unselected, navy with a thin top-border indicator line when selected —
  // no more react-navigation tab bar, so "selected" is derived from the
  // current route name (see useRoute() above) and compared per-tab.
  bottomTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabSelected: {},
  // Short centered indicator (replaces a full-width top border) shown above
  // the icon on the active tab only.
  bottomTabIndicator: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  bottomTabIcon: {
    width: BOTTOM_TAB_ICON_SIZE,
    height: BOTTOM_TAB_ICON_SIZE,
    tintColor: '#333333',
  },
  bottomTabIconSelected: {
    tintColor: colors.primary,
  },
  bottomTabLabel: {
    fontSize: 10,
    color: '#333333',
    marginTop: 2,
  },
  bottomTabLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
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
  avatarPopover: {
    minWidth: 160,
    paddingHorizontal: 4,
  },
  avatarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  avatarMenuIcon: {
    width: 20,
    height: 20,
    tintColor: colors.primary,
  },
  avatarMenuText: {
    marginLeft: 12,
    fontSize: 15,
    color: colors.text,
    fontWeight: '400',
  },
});