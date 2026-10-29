import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useI18n } from '../i18n/I18nContext';
import { getReactionState, Reaction, setInCart, setReaction } from '../utils/consumerApi';
import GradientButton from './GradientButton';
import { colors, radius, spacing, shadow } from '../theme';

// Like (save to Product Album) / Add to Cart / Dislike — one big-icon row
// shared by the product summary and the product detail (Overview) pages so
// both behave identically. A short confirmation floats in above the row
// (it takes no layout space, so the page never needs room reserved for it).
export default function ProductReactionBar({ product, user, onRequireLogin, compact = false }: { product: any; user?: any; onRequireLogin: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const [reaction, setReactionState] = useState<Reaction>(null);
  const [inCart, setInCartState] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const noteOpacity = useRef(new Animated.Value(0)).current;
  const noteTimer = useRef<any>(null);

  const isConsumer = !!user?._id && user?.actorKind !== 'Employee';

  useEffect(() => {
    if (!isConsumer || !product?._id) return undefined;
    let alive = true;
    getReactionState(String(user._id), product)
      .then((s) => {
        if (!alive) return;
        setReactionState(s.reaction);
        setInCartState(s.inCart);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsumer, product?._id, product?.token_id]);

  useEffect(() => () => clearTimeout(noteTimer.current), []);

  const flash = (msg: string) => {
    setNote(msg);
    clearTimeout(noteTimer.current);
    Animated.timing(noteOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    noteTimer.current = setTimeout(() => {
      Animated.timing(noteOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setNote(''));
    }, 1800);
  };

  const onReact = async (next: 'like' | 'dislike') => {
    if (!isConsumer) return onRequireLogin();
    if (pending || !product?._id) return;
    const target: Reaction = reaction === next ? null : next;
    const prev = reaction;
    setReactionState(target);
    setPending(next);
    try {
      await setReaction(String(user._id), product, target);
      if (target === 'like') flash(t('toastSavedToAlbum'));
      else if (target === 'dislike') flash(t('toastDisliked'));
      else if (prev === 'like') flash(t('toastRemovedFromAlbum'));
    } catch (e) {
      setReactionState(prev);
      flash(t('toastActionFailed'));
    } finally {
      setPending(null);
    }
  };

  const onCart = async () => {
    if (!isConsumer) return onRequireLogin();
    if (pending || !product?._id) return;
    const next = !inCart;
    setInCartState(next);
    setPending('cart');
    try {
      await setInCart(product, next);
      flash(next ? t('toastAddedToCart') : t('toastRemovedFromCart'));
    } catch (e) {
      setInCartState(!next);
      flash(t('toastActionFailed'));
    } finally {
      setPending(null);
    }
  };

  return (
    <View>
      <View style={[styles.row, compact && styles.rowCompact]}>
        <BigIconButton
          icon={reaction === 'like' ? 'thumb-up' : 'thumb-up-outline'}
          compact={compact}
          active={reaction === 'like'}
          label={t('actLike')}
          busy={pending === 'like'}
          onPress={() => onReact('like')}
        />
        <BigIconButton
          icon={inCart ? 'cart-check' : 'cart-plus'}
          compact={compact}
          active={inCart}
          label={t('actAddToCart')}
          busy={pending === 'cart'}
          onPress={onCart}
        />
        <BigIconButton
          icon={reaction === 'dislike' ? 'thumb-down' : 'thumb-down-outline'}
          compact={compact}
          active={reaction === 'dislike'}
          label={t('actDislike')}
          busy={pending === 'dislike'}
          onPress={() => onReact('dislike')}
        />
      </View>
      {!!note && (
        <Animated.View style={[styles.noteFloat, { opacity: noteOpacity }]} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.noteFloatText}>{note}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Big icon button. Icon-only by default (`label` is read by screen readers);
 * pass `caption` to also print a short label under the icon. `active`
 * fills it so the chosen state reads at a glance. `filled` paints the same
 * blue gradient pill as the summary page's brand button.
 */
export function BigIconButton({
  icon,
  label,
  caption,
  onPress,
  color = colors.primary,
  active = false,
  busy = false,
  filled = false,
  compact = false,
}: {
  icon: string;
  label: string;
  caption?: string;
  onPress: () => void;
  color?: string;
  active?: boolean;
  busy?: boolean;
  filled?: boolean;
  compact?: boolean;
}) {
  const fg = filled ? colors.white : color;
  const Touchable: any = filled ? GradientButton : TouchableOpacity;
  return (
    <Touchable
      style={[
        styles.bigBtn,
        caption ? styles.bigBtnCaptioned : null,
        compact && styles.bigBtnCompact,
        filled && styles.bigBtnFilled,
        active && styles.bigBtnActive,
        busy && { opacity: 0.6 },
      ]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, busy }}
    >
      <MaterialCommunityIcon name={icon} size={compact ? 30 : caption ? 36 : 42} color={fg} />
      {!!caption && <Text style={[styles.caption, { color: fg }]} numberOfLines={1}>{caption}</Text>}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rowCompact: { gap: spacing.sm },
  bigBtn: {
    flex: 1,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(1),
  },
  bigBtnCaptioned: { height: 78, gap: 2 },
  bigBtnCompact: { height: 44, borderRadius: radius.md },
  bigBtnFilled: { backgroundColor: colors.primary, borderWidth: 0, borderRadius: radius.lg, ...shadow(2) },
  bigBtnActive: { backgroundColor: colors.surfaceAlt, borderColor: colors.primary, borderWidth: 2 },
  caption: { fontSize: 16, fontWeight: '700' },
  noteFloat: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(18,58,86,0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  noteFloatText: { fontSize: 16, fontWeight: '600', color: colors.white },
});
