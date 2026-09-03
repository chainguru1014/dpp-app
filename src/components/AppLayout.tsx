import React, { useState } from 'react';
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
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useRoute } from '@react-navigation/native';
import { useI18n } from '../i18n/I18nContext';
import NotificationBadge from './NotificationBadge';
import { colors, radius, shadow } from '../theme';

type BottomBarKind = 'auto' | 'consumer' | 'product' | 'none';
type RightIconKind = 'notification' | 'heart' | 'share' | 'none';

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
  // Which bottom bar to render. 'auto' (default): employee sessions get their
  // 4-tab operations bar, authenticated consumers get the 5-tab consumer bar,
  // everyone else gets none. 'product' is the 3-tab Overview/Lifecycle/More bar
  // used on the product pages. 'none' hides it.
  bottomBar?: BottomBarKind;
  // Top-bar right-side icon. 'notification' (default) opens the Notifications
  // page; 'heart' is the favorite toggle used on the product pages.
  rightIcon?: RightIconKind;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
  // The product this screen is showing — lets the 'product' bottom bar move
  // between Overview and Lifecycle carrying the same product data.
  product?: any;
  // Opt out of the rounded-top content sheet (e.g. full-bleed camera screens).
  flatContent?: boolean;
  title?: string;
  subtitle?: string;
}

const ROUTE_TITLE_KEYS: Record<string, string> = {
  ScannedProducts: 'titleMyProducts',
  EditProfile: 'titleEditProfile',
  PurchaseHistory: 'titlePurchaseHistory',
  History: 'titleHistory',
  FavoriteBrands: 'titleFavoriteBrands',
  Notifications: 'titleNotifications',
  Scanner: 'titleScanner',
  EnterCode: 'titleEnterCode',
  ProductSummary: 'titleProductSummary',
  Result: 'titleProductOverview',
  ProductLifecycle: 'titleProductLifecycle',
  BrandDetail: 'titleBrandDetail',
  SendProductInfo: 'titleSendProductInfo',
  ProductHistory: 'titleProductHistory',
};

const BRAND_TITLE = 'Yometel DPP';
const EMPLOYEE_BRAND_TITLE = 'Yometel Traceability';

// Big-height top bar. Room for the status bar on native; web has none, so keep
// the pad small (avoids a large empty band above the notification icon).
const STATUS_BAR_PAD = Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 8;
const TOP_BAR_CONTENT = 50;
const TOP_BAR_HEIGHT = STATUS_BAR_PAD + TOP_BAR_CONTENT;
const BOTTOM_BAR_HEIGHT = 60;
const BOTTOM_TAB_ICON_SIZE = 22;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_TOP = SCREEN_HEIGHT / 2;
const BOTTOM_TOP = SCREEN_HEIGHT - BOTTOM_BAR_HEIGHT;

const LANG_POPOVER_POS = { top: TOP_BAR_HEIGHT + 6, right: 16 };

export default function AppLayout({
  children,
  navigation,
  user,
  onLogout,
  showBackButton = false,
  onBackPress,
  useCenterTop = false,
  hideBottomBar = false,
  flatContent = false,
  onGuestAction,
  onActionMenuPress,
  onSettingsMenuPress,
  isBrandFollowed = false,
  isInAlbum = false,
  isProductDetailPage = false,
  bottomBar = 'auto',
  rightIcon = 'notification',
  isFavorite = false,
  onToggleFavorite,
  onShare,
  product,
  title,
  subtitle,
}: AppLayoutProps) {
  const { t, locale, setLocale, languages } = useI18n();
  const route = useRoute();
  const isHomeRoute = route.name === 'Home' || route.name === 'EmployeeHome';
  const routeTitleKey = ROUTE_TITLE_KEYS[route.name];
  const computedTitle = title ?? (
    isHomeRoute
      ? (route.name === 'EmployeeHome' ? EMPLOYEE_BRAND_TITLE : BRAND_TITLE)
      : routeTitleKey ? t(routeTitleKey as any) : undefined
  );
  const computedSubtitle = subtitle ?? undefined;

  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  // Employee sessions keep the original top-bar avatar dropdown
  // (Profile / Language / Logout) — consumers use the Profile bottom-bar tab.
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);

  const isAuthenticated = !!user;
  const isEmployeeActor = user?.actorKind === 'Employee';

  // Resolve which bottom bar to actually render.
  const effectiveBar: Exclude<BottomBarKind, 'auto'> | 'employee' = (() => {
    if (hideBottomBar || bottomBar === 'none') return 'none';
    if (bottomBar === 'product') return 'product';
    if (bottomBar === 'consumer') return 'consumer';
    // auto
    if (isEmployeeActor) return 'employee';
    if (isAuthenticated) return 'consumer';
    return 'none';
  })();

  const productsTarget = isEmployeeActor ? 'CorporateReview' : 'ScannedProducts';
  const homeBaseRoute = isEmployeeActor ? 'EmployeeHome' : 'Scanner';

  const handleNotifications = () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    navigation.navigate('Notifications');
  };

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (!isAuthenticated) return;
    navigation.navigate(homeBaseRoute);
  };

  const openLanguageMenu = () => setLangMenuVisible(true);

  const handleProfile = () => {
    setProfileSheetVisible(false);
    if (!isAuthenticated) return;
    navigation.navigate('EditProfile');
  };

  const handleLogout = async () => {
    setProfileSheetVisible(false);
    const performLogout = async () => {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('user');
      onLogout?.();
    };
    if (Platform.OS === 'web') {
      await performLogout();
      return;
    }
    Alert.alert(t('logoutTitle'), t('logoutMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: performLogout },
    ]);
  };

  const guardAuthed = (fn: () => void) => () => {
    if (!isAuthenticated) {
      onGuestAction?.();
      return;
    }
    fn();
  };

  const handleScan = guardAuthed(async () => {
    if (isEmployeeActor) {
      const stored = await AsyncStorage.getItem('employeeSelectedStepIndex');
      navigation.navigate('CorporateScanner', { stepIndex: stored != null ? Number(stored) : 0 });
      return;
    }
    navigation.navigate('Scanner');
  });
  const handleHome = guardAuthed(() => navigation.navigate(homeBaseRoute));
  const handleProducts = guardAuthed(() => navigation.navigate(productsTarget));
  const handleHistory = guardAuthed(() => navigation.navigate('History'));
  const handleBrands = guardAuthed(() => navigation.navigate('FavoriteBrands'));
  const openProfileSheet = guardAuthed(() => setProfileSheetVisible(true));

  const handleProductOverview = () => {
    if (product) navigation.navigate('Result', { productData: product });
    else if (route.name !== 'Result' && navigation.canGoBack?.()) navigation.goBack();
  };
  const handleProductLifecycle = () => {
    navigation.navigate('ProductLifecycle', product ? { productData: product } : {});
  };

  // Employee "Settings" bottom sheet (History & Data + product actions) — kept
  // as-is for employee sessions. Consumers use the Profile / More sheets below.
  const [settingsVisible, setSettingsVisible] = useState(false);
  const handleSettings = guardAuthed(() => setSettingsVisible(true));

  const handleExtraMenuItemPress = (itemKey: string) => {
    setSettingsVisible(false);
    if (onSettingsMenuPress) {
      onSettingsMenuPress(itemKey);
      return;
    }
    if (itemKey === 'myProducts') navigation.navigate(productsTarget);
    else if (itemKey === 'purchaseHistory') navigation.navigate('PurchaseHistory');
    else if (itemKey === 'viewHistory') navigation.navigate('History');
    else if (itemKey === 'favoriteBrands') navigation.navigate('FavoriteBrands');
  };

  // Full product-action list — unchanged from before, used by the employee
  // "Settings" bottom sheet on a product page.
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

  // Trimmed list for the consumer "More" action sheet (screenshot #24, no Support).
  const consumerActionItems = actionMenuItems.filter((i) =>
    ['saveProductInfo', 'copyProductInfo', 'sendProductInfo', 'toggleAlbum', 'connectBrand'].includes(i.key)
  );

  const extraMenuItems = [
    ...(isEmployeeActor ? [] : [{ key: 'myProducts', label: t('myProductsOwned'), iconSource: require('../assets/cart.png') }]),
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

  const runSettingsMenuItem = (item: { key: string; kind: 'action' | 'nav' }) => {
    setSettingsVisible(false);
    if (item.kind === 'nav') handleExtraMenuItemPress(item.key);
    else onActionMenuPress?.(item.key);
  };

  const runActionSheetItem = (key: string) => {
    setActionSheetVisible(false);
    onActionMenuPress?.(key);
  };

  const rightIconEl = (() => {
    if (rightIcon === 'none') return <View style={styles.iconButton} />;
    if (rightIcon === 'heart') {
      return (
        <TouchableOpacity onPress={onToggleFavorite} style={styles.iconButton} activeOpacity={0.7}>
          <Icon name={isFavorite ? 'favorite' : 'favorite-border'} size={26} color={colors.white} />
        </TouchableOpacity>
      );
    }
    if (rightIcon === 'share') {
      return (
        <TouchableOpacity onPress={onShare} style={styles.iconButton} activeOpacity={0.7}>
          <Icon name="share" size={24} color={colors.white} />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity onPress={handleNotifications} style={styles.iconButton} activeOpacity={0.7}>
        <View>
          <Icon name="notifications" size={26} color={colors.white} />
          <NotificationBadge userId={user?._id ? String(user._id) : undefined} />
        </View>
      </TouchableOpacity>
    );
  })();

  const contentBottomPad = effectiveBar === 'none' ? 0 : BOTTOM_BAR_HEIGHT;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          {showBackButton ? (
            <TouchableOpacity onPress={handleBack} style={styles.iconButton} activeOpacity={0.7}>
              <Icon name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}

          <View style={styles.titleBlock} pointerEvents="none">
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
            {rightIconEl}
            {isEmployeeActor && (
              <TouchableOpacity onPress={() => setAvatarMenuVisible(true)} style={styles.iconButton} activeOpacity={0.7}>
                <Icon name="account-circle" size={28} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.content,
          useCenterTop && styles.contentCentered,
          { paddingBottom: contentBottomPad },
          flatContent && styles.contentFlat,
        ]}
      >
        {children}
      </View>

      {effectiveBar === 'consumer' && (
        <ConsumerBottomBar
          routeName={route.name}
          profileActive={profileSheetVisible}
          t={t}
          onScan={handleScan}
          onProducts={handleProducts}
          onHistory={handleHistory}
          onBrands={handleBrands}
          onProfile={openProfileSheet}
        />
      )}

      {effectiveBar === 'product' && (
        <ProductBottomBar
          routeName={route.name}
          moreActive={actionSheetVisible}
          t={t}
          onOverview={handleProductOverview}
          onLifecycle={handleProductLifecycle}
          onMore={() => setActionSheetVisible(true)}
        />
      )}

      {effectiveBar === 'employee' && (() => {
        const isScanSelected = route.name === 'Scanner' || route.name === 'CorporateScanner';
        const isSettingsSelected = settingsVisible;
        const isHomeSelected = route.name === 'EmployeeHome';
        const isProductsSelected = route.name === productsTarget;
        return (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomTab} onPress={handleHome} activeOpacity={0.7}>
              {isHomeSelected && <View style={styles.bottomTabIndicator} />}
              <Image
                source={require('../assets/home.png')}
                style={[styles.bottomTabImg, isHomeSelected && styles.bottomTabImgSelected]}
                resizeMode="contain"
              />
              <Text style={[styles.bottomTabLabel, isHomeSelected && styles.bottomTabLabelSelected]}>{t('bottomHome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomTab} onPress={handleScan} activeOpacity={0.7}>
              {isScanSelected && <View style={styles.bottomTabIndicator} />}
              <Icon name="qr-code-scanner" size={BOTTOM_TAB_ICON_SIZE} color={isScanSelected ? colors.primary : '#333333'} />
              <Text style={[styles.bottomTabLabel, isScanSelected && styles.bottomTabLabelSelected]}>{t('bottomCapture')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomTab} onPress={handleProducts} activeOpacity={0.7}>
              {isProductsSelected && <View style={styles.bottomTabIndicator} />}
              <FeatherIcon name="file-text" size={BOTTOM_TAB_ICON_SIZE} color={isProductsSelected ? colors.primary : '#333333'} />
              <Text style={[styles.bottomTabLabel, isProductsSelected && styles.bottomTabLabelSelected]}>{t('bottomReview')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomTab} onPress={handleSettings} activeOpacity={0.7}>
              {isSettingsSelected && <View style={styles.bottomTabIndicator} />}
              <Image
                source={require('../assets/setting.png')}
                style={[styles.bottomTabImg, isSettingsSelected && styles.bottomTabImgSelected]}
                resizeMode="contain"
              />
              <Text style={[styles.bottomTabLabel, isSettingsSelected && styles.bottomTabLabelSelected]}>{t('bottomSettings')}</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Employee Settings sheet (History & Data + product actions). */}
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSettingsVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('settings')}</Text>
            <Text style={styles.sheetSubtitle}>{t('settingsSubtitle')}</Text>
            <ScrollView style={styles.menuScroll}>
              {settingsMenuItems.map((item, index, list) => (
                <View key={item.label}>
                  {item.kind === 'nav' && (index === 0 || list[index - 1].kind !== 'nav') ? (
                    <Text style={styles.menuSectionLabel}>{t('historyAndData')}</Text>
                  ) : null}
                  <TouchableOpacity style={styles.menuItem} onPress={() => runSettingsMenuItem(item)} activeOpacity={0.7}>
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

      {/* Consumer Profile sheet — Language / Edit Profile / Log out (screenshot #24 style). */}
      <Modal visible={profileSheetVisible} transparent animationType="fade" onRequestClose={() => setProfileSheetVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProfileSheetVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('profile')}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleProfile} activeOpacity={0.7}>
              <Image source={require('../assets/account.png')} style={styles.menuItemIcon} resizeMode="contain" />
              <Text style={styles.menuItemText}>{t('editProfile')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setProfileSheetVisible(false);
                openLanguageMenu();
              }}
              activeOpacity={0.7}
            >
              <Image source={require('../assets/world.png')} style={styles.menuItemIcon} resizeMode="contain" />
              <Text style={styles.menuItemText}>{t('language')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <Image source={require('../assets/logout (1).png')} style={styles.menuItemIcon} resizeMode="contain" />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Product "More" action sheet (screenshot #24, no Support). */}
      <Modal visible={actionSheetVisible} transparent animationType="fade" onRequestClose={() => setActionSheetVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionSheetVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('menu')}</Text>
            {consumerActionItems.map((item) => (
              <View key={item.key}>
                <TouchableOpacity style={styles.menuItem} onPress={() => runActionSheetItem(item.key)} activeOpacity={0.7}>
                  <Image source={item.iconSource} style={styles.menuItemIcon} resizeMode="contain" />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Employee top-bar avatar dropdown — Profile / Language / Logout. */}
      <Modal visible={avatarMenuVisible} transparent animationType="none" onRequestClose={() => setAvatarMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setAvatarMenuVisible(false)}>
          <View style={styles.langOverlay}>
            <View style={[styles.langPopover, styles.avatarPopover, { position: 'absolute', top: TOP_BAR_HEIGHT - 6, right: 12 }]}>
              <TouchableOpacity
                style={styles.avatarMenuItem}
                onPress={() => {
                  setAvatarMenuVisible(false);
                  handleProfile();
                }}
                activeOpacity={0.7}
              >
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
              <TouchableOpacity
                style={styles.avatarMenuItem}
                onPress={() => {
                  setAvatarMenuVisible(false);
                  handleLogout();
                }}
                activeOpacity={0.7}
              >
                <Image source={require('../assets/logout (1).png')} style={styles.avatarMenuIcon} resizeMode="contain" />
                <Text style={[styles.avatarMenuText, { color: colors.danger }]}>{t('logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={langMenuVisible} transparent animationType="none" onRequestClose={() => setLangMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setLangMenuVisible(false)}>
          <View style={styles.langOverlay}>
            <View style={[styles.langPopover, { position: 'absolute', top: LANG_POPOVER_POS.top, right: LANG_POPOVER_POS.right }]}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, locale === lang.code && styles.langItemActive]}
                  onPress={() => {
                    setLocale(lang.code);
                    setLangMenuVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, locale === lang.code && styles.langTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

function BottomTab({
  icon,
  mi,
  label,
  selected,
  onPress,
}: {
  icon: string;
  mi?: boolean; // use MaterialIcons instead of Feather (outline default)
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const Glyph: any = mi ? Icon : FeatherIcon;
  return (
    <TouchableOpacity style={styles.bottomTab} onPress={onPress} activeOpacity={0.7}>
      {selected && <View style={styles.bottomTabIndicator} />}
      <Glyph name={icon} size={BOTTOM_TAB_ICON_SIZE} color={selected ? colors.primary : '#7a8aa3'} />
      <Text style={[styles.bottomTabLabel, selected && styles.bottomTabLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ConsumerBottomBar({
  routeName,
  profileActive,
  t,
  onScan,
  onProducts,
  onHistory,
  onBrands,
  onProfile,
}: any) {
  return (
    <View style={styles.bottomBar}>
      <BottomTab mi icon="qr-code-scanner" label={t('bottomScan')} selected={routeName === 'Scanner' || routeName === 'EnterCode'} onPress={onScan} />
      <BottomTab icon="shopping-bag" label={t('bottomMyProducts')} selected={routeName === 'ScannedProducts' || routeName === 'ProductSummary'} onPress={onProducts} />
      <BottomTab icon="clock" label={t('bottomHistory')} selected={routeName === 'History' || routeName === 'ProductHistory' || routeName === 'PurchaseHistory'} onPress={onHistory} />
      <BottomTab icon="tag" label={t('bottomBrands')} selected={routeName === 'FavoriteBrands' || routeName === 'BrandDetail'} onPress={onBrands} />
      <BottomTab icon="user" label={t('bottomProfile')} selected={profileActive || routeName === 'EditProfile'} onPress={onProfile} />
    </View>
  );
}

function ProductBottomBar({ routeName, moreActive, t, onOverview, onLifecycle, onMore }: any) {
  return (
    <View style={styles.bottomBar}>
      <BottomTab icon="grid" label={t('bottomOverview')} selected={routeName === 'Result' || routeName === 'ProductSummary'} onPress={onOverview} />
      <BottomTab icon="refresh-cw" label={t('bottomLifecycle')} selected={routeName === 'ProductLifecycle'} onPress={onLifecycle} />
      <BottomTab icon="more-horizontal" label={t('bottomMore')} selected={moreActive} onPress={onMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Blue behind everything — the rounded top corners of the content sheet
  // reveal this strip, merging visually with the top bar into one shape.
  container: { flex: 1, backgroundColor: colors.primary, position: 'relative' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    zIndex: 1000,
    elevation: 10,
  },
  topBarRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TOP_BAR_CONTENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  titleBlock: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titleText: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  subtitleText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '400', marginTop: 1, textAlign: 'center' },
  content: {
    flex: 1,
    backgroundColor: colors.bg,
    marginTop: TOP_BAR_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  contentFlat: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  contentCentered: { paddingTop: CONTENT_TOP },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BOTTOM_TOP,
    height: BOTTOM_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
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
  bottomTab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  bottomTabIndicator: {
    position: 'absolute',
    top: 0,
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  bottomTabImg: { width: BOTTOM_TAB_ICON_SIZE, height: BOTTOM_TAB_ICON_SIZE, tintColor: '#333333' },
  bottomTabImgSelected: { tintColor: colors.primary },
  bottomTabLabel: { fontSize: 10, color: '#333333', marginTop: 3 },
  bottomTabLabelSelected: { color: colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT - TOP_BAR_HEIGHT,
    ...shadow(3),
  },
  sheetTitle: { fontSize: 20, fontWeight: '600', color: colors.heading, marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 14 },
  menuScroll: { maxHeight: SCREEN_HEIGHT - TOP_BAR_HEIGHT - 120 },
  menuSectionLabel: {
    fontSize: 12,
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 5,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 5, minHeight: 48 },
  menuItemText: { marginLeft: 15, fontSize: 16, color: colors.text, fontWeight: '400' },
  menuItemIcon: { width: 24, height: 24, tintColor: colors.primary },
  menuDivider: { height: 1, backgroundColor: colors.border },
  langOverlay: { flex: 1 },
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
  langItem: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.sm },
  langItemActive: { backgroundColor: colors.surfaceAlt },
  langText: { fontSize: 15, color: colors.text, fontWeight: '400' },
  langTextActive: { color: colors.accent, fontWeight: '400' },
  avatarPopover: { minWidth: 160, paddingHorizontal: 4 },
  avatarMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm },
  avatarMenuIcon: { width: 20, height: 20, tintColor: colors.primary },
  avatarMenuText: { marginLeft: 12, fontSize: 15, color: colors.text, fontWeight: '400' },
});
