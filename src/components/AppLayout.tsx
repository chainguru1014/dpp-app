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
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n/I18nContext';
import NotificationBadge from './NotificationBadge';
import GradientView from './GradientView';
import { colors, radius, shadow, spacing, MIN_TOUCH } from '../theme';

type BottomBarKind = 'auto' | 'consumer' | 'product' | 'none';
type RightIconKind = 'notification' | 'heart' | 'share' | 'menu' | 'none';

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
  // Let content run full-bleed behind the (absolutely-positioned) bottom bar
  // instead of reserving BOTTOM_BAR_HEIGHT of padding for it — used by the
  // Scanner so the camera viewport extends all the way down.
  flushBottom?: boolean;
  // Home screen: show the Yometel wordmark on the top-bar left and no title.
  logoLeft?: boolean;
  title?: string;
  subtitle?: string;
  // Height (px) of a colored header block the screen renders itself directly
  // below the top bar (e.g. Product Lifecycle's product-image/name/ID card).
  // When set, the top bar's gradient continues into that block as one
  // shared ramp via GradientView's `frame` prop, instead of each restarting
  // its own — see useTopBarHeight() for getting the matching offset on the
  // screen's own header gradient.
  headerBleedHeight?: number;
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

// Height of the bar's own visual content, excluding the device safe area
// (notch / status bar / home indicator), which is added on top of these at
// render time via useSafeAreaInsets() -- see topBarHeight/bottomBarHeight
// below. Fixed design constants, not device-specific hacks.
const TOP_BAR_CONTENT = 56;
const BOTTOM_BAR_CONTENT = 74;
const BOTTOM_TAB_ICON_SIZE = 28;
// Slightly larger than the consumer/product bars' BOTTOM_TAB_ICON_SIZE —
// the employee/staff bottom bar (below) skews toward older and younger
// warehouse/retail staff who need bigger icons/labels, scoped to just that
// bar so the consumer-facing bars are unaffected.
const EMPLOYEE_TAB_ICON_SIZE = 32;

/**
 * The real, current height of the fixed bottom tab bar (design height + this
 * device's safe-area inset) -- for screens that render their own inner
 * ScrollView (e.g. a tab body inside a product-lifecycle sheet) and need to
 * pad IT past the bar too, not just rely on AppLayout's own outer padding.
 * Always derived from useSafeAreaInsets(), never a hardcoded per-device guess.
 */
export function useBottomBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BOTTOM_BAR_CONTENT + insets.bottom;
}

/**
 * The real, current height of the fixed top bar -- for screens that render
 * their own colored header block directly below it (e.g. Product Lifecycle)
 * and need to continue the top bar's gradient into it seamlessly via
 * GradientView's `frame` prop instead of restarting a second, visibly
 * separate gradient at the seam.
 */
export function useTopBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TOP_BAR_CONTENT + insets.top;
}

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
  flushBottom = false,
  logoLeft = false,
  onGuestAction,
  onActionMenuPress,
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
  headerBleedHeight,
}: AppLayoutProps) {
  const { t, locale, setLocale, languages } = useI18n();
  const route = useRoute();
  // On a wide (laptop) browser, present the app as a centred phone-width
  // column on a soft backdrop instead of stretching edge to edge.
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && winWidth >= 700;
  // Real device safe-area insets (notch / status bar / home indicator) --
  // added to the fixed design heights below instead of guessing per-platform
  // constants, so the header/tab bar never sit under system chrome.
  const insets = useSafeAreaInsets();
  const topBarHeight = insets.top + TOP_BAR_CONTENT;
  const bottomBarHeight = BOTTOM_BAR_CONTENT + insets.bottom;
  // Bottom-anchored sheet modals (profile sheet) need their own safe-area pad
  // so their last row doesn't sit under the home indicator.
  const spacingBottomForSheet = spacing.xl + insets.bottom;
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
  const [unreadCount, setUnreadCount] = useState(0);

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
  const homeBaseRoute = isEmployeeActor ? 'EmployeeHome' : 'Home';

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

  // Full product-action list — the consumer "More" sheet filters this down.
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
    ['saveProductInfo', 'copyProductInfo', 'sendProductInfo', 'toggleAlbum', 'connectBrand', 'toggleFollowBrand'].includes(i.key)
  );

  const runActionSheetItem = (key: string) => {
    setActionSheetVisible(false);
    onActionMenuPress?.(key);
  };

  const rightIconEl = (() => {
    if (rightIcon === 'none') return <View style={styles.iconButton} />;
    if (rightIcon === 'heart') {
      return (
        <TouchableOpacity
          onPress={onToggleFavorite}
          style={styles.iconButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? t('overviewRemovedFromMyProducts') : t('overviewAddToMyProducts')}
          accessibilityState={{ selected: isFavorite }}
        >
          <Icon name={isFavorite ? 'favorite' : 'favorite-border'} size={28} color={colors.white} />
        </TouchableOpacity>
      );
    }
    if (rightIcon === 'share') {
      return (
        <TouchableOpacity
          onPress={onShare}
          style={styles.iconButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('share')}
        >
          <Icon name="share" size={26} color={colors.white} />
        </TouchableOpacity>
      );
    }
    if (rightIcon === 'menu') {
      return (
        <TouchableOpacity
          onPress={() => setActionSheetVisible(true)}
          style={styles.iconButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('moreOptions')}
        >
          <Icon name="menu" size={28} color={colors.white} />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        onPress={handleNotifications}
        style={styles.iconButton}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0 ? t('notificationsUnreadLabel').replace('{count}', String(unreadCount)) : t('notifications')
        }
      >
        <View>
          <Icon name="notifications" size={28} color={colors.white} />
          <NotificationBadge userId={user?._id ? String(user._id) : undefined} onCountChange={setUnreadCount} />
        </View>
      </TouchableOpacity>
    );
  })();

  const contentBottomPad = effectiveBar === 'none' || flushBottom ? 0 : bottomBarHeight;

  return (
    <View style={isWide ? styles.wideBackdrop : styles.fill}>
    <View style={[styles.container, isWide && styles.wideColumn]}>
      {/* content's rounded top corners cut a small notch out of its own
          silhouette right where it meets the top bar, revealing whatever
          sits behind it at those exact pixels. That used to be `container`'s
          flat navy fill, which didn't match the gradient's own (lighter,
          blended) color at the bottom of the top bar -- a visible seam at
          all four corners. This backing layer renders the identical
          gradient a little past topBarHeight so the notch reveals more
          gradient instead of a flat-color mismatch. It must stay BELOW
          `content` in the stacking order (unlike the real top bar) or it
          would paint a hard rectangular edge on top of content's rounded
          corners instead of only showing through the notch -- no zIndex/
          elevation override here, so plain declaration order (before
          `content`) puts it behind. */}
      <GradientView
        style={[styles.topBar, { height: topBarHeight + radius.xl, zIndex: 0, elevation: 0 }]}
        angle="diagonal"
        pointerEvents="none"
        frame={headerBleedHeight ? { totalHeight: topBarHeight + headerBleedHeight, offsetY: 0 } : undefined}
      />
      <GradientView
        style={[styles.topBar, { height: topBarHeight }]}
        angle="diagonal"
        frame={headerBleedHeight ? { totalHeight: topBarHeight + headerBleedHeight, offsetY: 0 } : undefined}
      >
        <View style={styles.topBarRow}>
          {logoLeft ? (
            <Image
              source={require('../assets/yometel-logo-white.png')}
              style={styles.topBarLogo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Yometel"
            />
          ) : showBackButton ? (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('goBack')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="arrow-back" size={26} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}

          <View style={styles.titleBlock} pointerEvents="none">
            {!logoLeft && (
              <Text
                style={styles.titleText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                accessibilityRole="header"
              >
                {/* Screens outside ROUTE_TITLE_KEYS with no explicit `title`
                    prop show nothing here rather than the Home marketing
                    eyebrow -- that fallback previously leaked onto unrelated
                    screens (e.g. Product Detected) as truncated, meaningless
                    text ("DIGITAL PRODUCT PASSPO..."). */}
                {computedTitle ?? ''}
              </Text>
            )}
            {!logoLeft && !!computedSubtitle && (
              <Text style={styles.subtitleText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {computedSubtitle}
              </Text>
            )}
          </View>

          <View style={styles.topBarRight}>
            {rightIconEl}
          </View>
        </View>
      </GradientView>

      <View
        style={[
          styles.content,
          { marginTop: topBarHeight },
          useCenterTop && { paddingTop: winHeight / 2 },
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
          onHome={handleHome}
          onHistory={handleHistory}
          onBrands={handleBrands}
          onProfile={openProfileSheet}
          barHeight={bottomBarHeight}
          bottomInset={insets.bottom}
        />
      )}

      {effectiveBar === 'product' && (
        <ProductBottomBar
          routeName={route.name}
          t={t}
          onOverview={handleProductOverview}
          onLifecycle={handleProductLifecycle}
          onScan={handleScan}
          barHeight={bottomBarHeight}
          bottomInset={insets.bottom}
        />
      )}

      {effectiveBar === 'employee' && (() => {
        const isScanSelected = route.name === 'Scanner' || route.name === 'CorporateScanner';
        const isProfileSelected = profileSheetVisible || route.name === 'EditProfile';
        const isHomeSelected = route.name === 'EmployeeHome';
        const isProductsSelected = route.name === productsTarget;
        return (
          <View style={[styles.bottomBar, { height: bottomBarHeight, paddingBottom: insets.bottom }]}>
            <TouchableOpacity
              style={styles.bottomTab}
              onPress={handleHome}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isHomeSelected }}
              accessibilityLabel={t('bottomHome')}
            >
              <Image
                source={require('../assets/home.png')}
                style={[styles.bottomTabImg, { width: EMPLOYEE_TAB_ICON_SIZE, height: EMPLOYEE_TAB_ICON_SIZE }, isHomeSelected && styles.bottomTabImgSelected]}
                resizeMode="contain"
              />
              <Text style={[styles.bottomTabLabel, styles.employeeBottomTabLabel, isHomeSelected && styles.bottomTabLabelSelected]}>{t('bottomHome')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomTab}
              onPress={handleScan}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isScanSelected }}
              accessibilityLabel={t('bottomCapture')}
            >
              <Icon name="crop-free" size={EMPLOYEE_TAB_ICON_SIZE} color={isScanSelected ? colors.primary : '#4a5468'} />
              <Text style={[styles.bottomTabLabel, styles.employeeBottomTabLabel, isScanSelected && styles.bottomTabLabelSelected]}>{t('bottomCapture')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomTab}
              onPress={handleProducts}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isProductsSelected }}
              accessibilityLabel={t('bottomReview')}
            >
              <FeatherIcon name="file-text" size={EMPLOYEE_TAB_ICON_SIZE} color={isProductsSelected ? colors.primary : '#4a5468'} />
              <Text style={[styles.bottomTabLabel, styles.employeeBottomTabLabel, isProductsSelected && styles.bottomTabLabelSelected]}>{t('bottomReview')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomTab}
              onPress={openProfileSheet}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isProfileSelected }}
              accessibilityLabel={t('bottomProfile')}
            >
              <Icon name="person" size={EMPLOYEE_TAB_ICON_SIZE} color={isProfileSelected ? colors.primary : '#4a5468'} />
              <Text style={[styles.bottomTabLabel, styles.employeeBottomTabLabel, isProfileSelected && styles.bottomTabLabelSelected]}>{t('bottomProfile')}</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Profile sheet — Edit Profile / Language / Log out. Used by the consumer
          Profile tab and the employee Profile tab (replaces the old avatar menu). */}
      <Modal visible={profileSheetVisible} transparent animationType="fade" onRequestClose={() => setProfileSheetVisible(false)} accessibilityViewIsModal>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileSheetVisible(false)}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        >
          <View style={[styles.sheet, { maxHeight: winHeight - topBarHeight, paddingBottom: spacingBottomForSheet }]}>
            <Text style={styles.sheetTitle}>{t('profile')}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleProfile} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('editProfile')}>
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
              accessibilityRole="button"
              accessibilityLabel={t('language')}
            >
              <Image source={require('../assets/world.png')} style={styles.menuItemIcon} resizeMode="contain" />
              <Text style={styles.menuItemText}>{t('language')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('logout')}>
              <Image source={require('../assets/logout (1).png')} style={styles.menuItemIcon} resizeMode="contain" />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Product "More" menu — dropdown popover anchored under the top-bar ☰ icon. */}
      <Modal visible={actionSheetVisible} transparent animationType="fade" onRequestClose={() => setActionSheetVisible(false)} accessibilityViewIsModal>
        <TouchableWithoutFeedback onPress={() => setActionSheetVisible(false)}>
          <View style={styles.langOverlay}>
            <View style={[styles.morePopover, { position: 'absolute', top: topBarHeight - 4, right: 8 }]}>
              {consumerActionItems.map((item, i) => (
                <View key={item.key}>
                  {i > 0 && <View style={styles.menuDivider} />}
                  <TouchableOpacity
                    style={styles.morePopoverItem}
                    onPress={() => runActionSheetItem(item.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <Image source={item.iconSource} style={styles.menuItemIcon} resizeMode="contain" />
                    <Text style={styles.menuItemText}>{item.label}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={langMenuVisible} transparent animationType="none" onRequestClose={() => setLangMenuVisible(false)} accessibilityViewIsModal>
        <TouchableWithoutFeedback onPress={() => setLangMenuVisible(false)}>
          <View style={styles.langOverlay}>
            <View style={[styles.langPopover, { position: 'absolute', top: topBarHeight + 6, right: 16 }]}>
              {languages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, locale === lang.code && styles.langItemActive]}
                  onPress={() => {
                    setLocale(lang.code);
                    setLangMenuVisible(false);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={lang.label}
                  accessibilityState={{ selected: locale === lang.code }}
                >
                  <Text style={[styles.langText, locale === lang.code && styles.langTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
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
    <TouchableOpacity
      style={styles.bottomTab}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Glyph name={icon} size={BOTTOM_TAB_ICON_SIZE} color={selected ? colors.primary : colors.muted} />
      <Text style={[styles.bottomTabLabel, selected && styles.bottomTabLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Prominent centre "Scan" button — a raised circle that overhangs the bar's
// top edge, used as the middle item of both consumer and product bars.
function ScanCenterTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.scanTab}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={styles.scanCircle}>
        <GradientView style={[StyleSheet.absoluteFill, { borderRadius: 27 }]} angle="diagonal" to={selected ? colors.primaryDark : colors.primary} />
        <Icon name="crop-free" size={26} color={colors.white} />
      </View>
      <Text style={[styles.scanTabLabel, selected && styles.bottomTabLabelSelected]} numberOfLines={1}>
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
  onHome,
  onHistory,
  onBrands,
  onProfile,
  barHeight,
  bottomInset,
}: any) {
  return (
    <View style={[styles.bottomBar, { height: barHeight, paddingBottom: bottomInset }]}>
      <BottomTab icon="home" label={t('bottomHome')} selected={routeName === 'Home' || routeName === 'ScannedProducts' || routeName === 'ProductSummary'} onPress={onHome} />
      <BottomTab icon="tag" label={t('bottomBrands')} selected={routeName === 'FavoriteBrands' || routeName === 'BrandDetail'} onPress={onBrands} />
      <ScanCenterTab label={t('bottomScan')} selected={routeName === 'Scanner' || routeName === 'EnterCode'} onPress={onScan} />
      <BottomTab icon="clock" label={t('bottomHistory')} selected={routeName === 'History' || routeName === 'ProductHistory' || routeName === 'PurchaseHistory'} onPress={onHistory} />
      <BottomTab mi icon="account-circle" label={t('bottomProfile')} selected={profileActive || routeName === 'EditProfile'} onPress={onProfile} />
    </View>
  );
}

function ProductBottomBar({ routeName, t, onOverview, onLifecycle, onScan, barHeight, bottomInset }: any) {
  return (
    <View style={[styles.bottomBar, { height: barHeight, paddingBottom: bottomInset }]}>
      {/* Nudged toward the centre Scan circle so the row doesn't read as
          edge-hugging with only 3 items. */}
      <View style={styles.productTabShiftRight}>
        <BottomTab icon="grid" label={t('bottomOverview')} selected={routeName === 'Result' || routeName === 'ProductSummary'} onPress={onOverview} />
      </View>
      <ScanCenterTab label={t('bottomScan')} selected={routeName === 'Scanner'} onPress={onScan} />
      <View style={styles.productTabShiftLeft}>
        <BottomTab icon="refresh-cw" label={t('bottomLifecycle')} selected={routeName === 'ProductLifecycle'} onPress={onLifecycle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Blue behind everything — the rounded top corners of the content sheet
  // reveal this strip, merging visually with the top bar into one shape.
  fill: { flex: 1 },
  // Laptop / wide-browser: soft page backdrop with a centred phone-width column.
  wideBackdrop: { flex: 1, backgroundColor: '#dfe6f0', alignItems: 'center' },
  wideColumn: {
    width: 460,
    maxWidth: '100%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#c9d3e2',
  },
  container: { flex: 1, backgroundColor: colors.primary, position: 'relative' },
  topBar: {
    // height set inline per-render from useSafeAreaInsets() (see topBarHeight)
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  // 48x48 minimum touch target for every header icon button (back/notification/menu/heart/share).
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  topBarLogo: { width: 132, height: 34, marginLeft: 10 },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  titleBlock: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titleText: { color: '#fff', fontSize: 23, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  subtitleText: { color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '400', marginTop: 1, textAlign: 'center' },
  content: {
    // marginTop set inline per-render from useSafeAreaInsets() (see topBarHeight)
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  contentFlat: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  bottomBar: {
    // height/paddingBottom set inline per-render (BOTTOM_BAR_CONTENT + safe-area inset)
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    overflow: 'visible',
    zIndex: 1000,
    elevation: 12,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  bottomTab: { flex: 1, minHeight: MIN_TOUCH, height: '100%', alignItems: 'center', justifyContent: 'center' },
  bottomTabImg: { width: BOTTOM_TAB_ICON_SIZE, height: BOTTOM_TAB_ICON_SIZE, tintColor: '#333333' },
  bottomTabImgSelected: { tintColor: colors.primary },
  // Bottom-nav labels: ~14-16px.
  bottomTabLabel: { fontSize: 15, color: '#333333', marginTop: 3, fontWeight: '500' },
  bottomTabLabelSelected: { color: colors.primary, fontWeight: '700' },
  // Employee/staff bar only (see EMPLOYEE_TAB_ICON_SIZE) — bumped up from the
  // shared bottomTabLabel size.
  employeeBottomTabLabel: { fontSize: 17 },
  scanTab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  scanCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadow(2),
  },
  scanTabLabel: { fontSize: 17, color: colors.primary, marginTop: 2, fontWeight: '600' },
  productTabShiftRight: { flex: 1, transform: [{ translateX: 16 }] },
  productTabShiftLeft: { flex: 1, transform: [{ translateX: -16 }] },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingVertical: 20,
    paddingHorizontal: 20,
    // maxHeight overridden inline at the profile-sheet Modal (winHeight - topBarHeight)
    ...shadow(3),
  },
  sheetTitle: { fontSize: 27, fontWeight: '600', color: colors.heading, marginBottom: 4 },
  sheetSubtitle: { fontSize: 18, color: colors.muted, marginBottom: 14 },
  menuSectionLabel: {
    fontSize: 17,
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 5,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 5, minHeight: 48 },
  menuItemText: { marginLeft: 15, fontSize: 22, color: colors.text, fontWeight: '400' },
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
  morePopover: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    minWidth: 232,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(3),
  },
  morePopoverItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, minHeight: MIN_TOUCH },
  langItem: { paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.sm, minHeight: MIN_TOUCH, justifyContent: 'center' },
  langItemActive: { backgroundColor: colors.surfaceAlt },
  langText: { fontSize: 20, color: colors.text, fontWeight: '400' },
  langTextActive: { color: colors.accent, fontWeight: '400' },
  avatarPopover: { minWidth: 160, paddingHorizontal: 4 },
  avatarMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.sm },
  avatarMenuIcon: { width: 20, height: 20, tintColor: colors.primary },
  avatarMenuText: { marginLeft: 12, fontSize: 20, color: colors.text, fontWeight: '400' },
});
