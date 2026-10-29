import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Platform, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nContext';
import { colors, shadow } from '../theme';
import VideoFrame from './VideoFrame';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MediaSlide =
  | { kind: 'image'; uri: string }
  | { kind: 'video'; videoId: string; url: string; description?: string }
  | { kind: 'file'; url: string; description?: string };

/** Default file-URL resolver — turns a stored filename into a served URL. */
export const defaultGetFileUrl = (filename: string) => {
  if (!filename) return '';
  if (/^https?:\/\//i.test(filename)) return filename;
  const { API_BASE_URL } = require('../config/api');
  const clean = filename.startsWith('/files/')
    ? filename.substring(1)
    : filename.replace(/^\/+/, '');
  return filename.startsWith('/files/') ? `${API_BASE_URL}${clean}` : `${API_BASE_URL}files/${clean}`;
};

export const getYoutubeVideoID = (url: string) => {
  if (!url) return null;
  const match = url.match(/(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)(?:\/watch\?v=|\/)([^\s&]+)/);
  return match ? match[1] : null;
};

// An uploaded video file (the admin's "Upload video") rather than a YouTube
// link — stored the same way, as { url, description }.
const VIDEO_FILE_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?.*)?$/i;
export const isVideoFileUrl = (url: string) => !!url && VIDEO_FILE_RE.test(url);

/** True when a product.videos entry is something the slider can play. */
export const isPlayableVideo = (v: any) => {
  const url = typeof v === 'string' ? v : v?.url || '';
  return !!getYoutubeVideoID(url) || isVideoFileUrl(url);
};

interface MediaSliderProps {
  images: string[];
  videos?: any[];
  name?: string;
  model?: string;
  pmcCode?: string;
  /** Hide the name/model/ID header block (callers that render their own). */
  hideHeader?: boolean;
  /** Flush layout: no outer padding, no inner card border/shadow (for nesting
   *  inside another card). */
  flush?: boolean;
  maxHeight?: number;
  getFileUrl?: (filename: string) => string;
  watchLabel?: string;
  /** This slider sits on a dark/blue surface (e.g. the Lifecycle header) --
   *  use light-on-dark pagination dots instead of the default light-grey/blue
   *  pair, which is otherwise nearly invisible against a blue background. */
  onDark?: boolean;
  /** Show a column of small thumbnails (images, then videos) to the right of
   *  the slider instead of the dots; tapping one shows it in the slider. */
  thumbnails?: boolean;
}

/**
 * Paged product-media slider with pagination dots — product images first, then
 * videos (YouTube links or uploaded files) at the end. Tapping any slide opens
 * the full-screen viewer, which also plays the videos. Extracted from
 * ResultScreen's ImageSlider so Product Summary / Product Detected / Product
 * Overview can all share it.
 */
export default function MediaSlider({
  images,
  videos,
  name,
  model,
  pmcCode,
  hideHeader = false,
  flush = false,
  maxHeight = 440,
  getFileUrl = defaultGetFileUrl,
  watchLabel,
  onDark = false,
  thumbnails = false,
}: MediaSliderProps) {
  const { t } = useI18n();
  const noImageLabel = t('noImage');
  const [pageWidth, setPageWidth] = useState(SCREEN_WIDTH);
  const [active, setActive] = useState(0);
  // Index of the slide open in the full-screen viewer (null = closed).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pad = flush ? 0 : 16;
  const imageHeight = Math.min(Math.max(120, Math.round((pageWidth - pad * 2) * 1.05)), maxHeight);

  const slides: MediaSlide[] = [
    ...images.map((uri): MediaSlide => ({ kind: 'image', uri })),
    ...(videos || [])
      .map((v: any): MediaSlide | null => {
        const url = typeof v === 'string' ? v : v?.url || '';
        const description = typeof v === 'object' ? v?.description : '';
        const videoId = getYoutubeVideoID(url);
        if (videoId) return { kind: 'video', videoId, url, description };
        return isVideoFileUrl(url) ? { kind: 'file', url, description } : null;
      })
      .filter((s): s is MediaSlide => s != null),
  ];

  const showThumbs = thumbnails && slides.length > 1;

  const onScroll = (e: any) => {
    if (!pageWidth) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (i !== active && i >= 0 && i < slides.length) setActive(i);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
    setActive(i);
  };

  // Touch swipe already works natively (pagingEnabled ScrollView) on iOS/
  // Android and in mobile browsers. Desktop web is the gap: a browser's
  // native overflow-x scroll container only responds to touch/wheel/
  // scrollbar input, not an arbitrary mouse click-and-drag across the
  // content -- so on web (mouse) only the dots worked. Mirrors the same
  // drag-to-swipe fix applied to the frontend admin panel's own preview
  // slider for the same reason.
  const dragStartXRef = useRef(0);
  const draggingRef = useRef(false);
  const dragEndedAtRef = useRef(0);
  const SWIPE_THRESHOLD_PX = 30;
  const webDragHandlers = Platform.OS === 'web' ? {
    onMouseDown: (e: any) => {
      draggingRef.current = true;
      dragStartXRef.current = e.nativeEvent?.pageX ?? e.clientX ?? 0;
    },
    onMouseUp: (e: any) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const endX = e.nativeEvent?.pageX ?? e.clientX ?? 0;
      const dx = endX - dragStartXRef.current;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
        // The click that ends a drag must not also open the viewer.
        dragEndedAtRef.current = Date.now();
        const next = Math.min(Math.max(active + (dx < 0 ? 1 : -1), 0), slides.length - 1);
        if (next !== active) goTo(next);
      }
    },
    onMouseLeave: () => {
      draggingRef.current = false;
    },
  } : {};

  const openViewer = (i: number) => {
    if (Date.now() - dragEndedAtRef.current < 300) return;
    setViewerIndex(i);
  };

  // Never leave a bare empty card behind -- an intentional placeholder reads
  // as "no photo for this product" instead of "something didn't load".
  if (slides.length === 0) {
    return (
      <View style={[styles.container, flush && styles.containerFlush]}>
        {!hideHeader && (name || model || pmcCode) ? (
          <View style={styles.textHeader}>
            {!!name && <Text style={styles.productName}>{name}</Text>}
            {!!model && <Text style={styles.productModel}>{model}</Text>}
            {!!pmcCode && <Text style={styles.pmcBadge}>ID: {pmcCode}</Text>}
          </View>
        ) : null}
        <View style={[styles.slidePage, { paddingHorizontal: pad }]}>
          <View
            style={[styles.imageCard, flush && styles.imageCardFlush, styles.emptyImageCard, { height: Math.min(imageHeight, 180) }]}
            accessible
            accessibilityLabel={noImageLabel}
          >
            <Icon name="image" size={36} color={colors.placeholder} />
            <Text style={styles.emptyImageText}>{noImageLabel}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, flush && styles.containerFlush]}
      onLayout={(e) => {
        // With thumbnails the slider is narrower than the container; its own
        // onLayout below measures it.
        const w = e.nativeEvent.layout.width;
        if (!showThumbs && w && Math.abs(w - pageWidth) > 1) setPageWidth(w);
      }}
    >
      {!hideHeader && (name || model || pmcCode) ? (
        <View style={styles.textHeader}>
          {!!name && <Text style={styles.productName}>{name}</Text>}
          {!!model && <Text style={styles.productModel}>{model}</Text>}
          {!!pmcCode && <Text style={styles.pmcBadge}>ID: {pmcCode}</Text>}
        </View>
      ) : null}

      <View style={showThumbs ? styles.thumbsLayout : null}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== pageWidth) setPageWidth(w);
        }}
        style={showThumbs ? styles.carouselWithThumbs : styles.carousel}
        {...(webDragHandlers as any)}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slidePage, { width: pageWidth, paddingHorizontal: pad }]}>
            <TouchableOpacity
              style={[styles.imageCard, flush && styles.imageCardFlush, { height: imageHeight }]}
              activeOpacity={0.85}
              onPress={() => openViewer(index)}
              accessibilityRole="button"
              accessibilityLabel={slide.kind === 'image' ? t('mediaTapToEnlarge') : slide.description || watchLabel || 'Play video'}
            >
              {slide.kind === 'image' ? (
                <Image
                  source={{ uri: getFileUrl(slide.uri) }}
                  style={styles.carouselImageFull}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.videoSlideTouch}>
                  {slide.kind === 'video' && (
                    <Image
                      source={{ uri: `https://img.youtube.com/vi/${slide.videoId}/hqdefault.jpg` }}
                      style={styles.carouselImageFull}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.videoPlayOverlay}>
                    <Icon name="play-circle-filled" size={Math.min(64, Math.round(imageHeight * 0.45))} color="#fff" />
                    {!!(slide.description || watchLabel) && imageHeight >= 140 && (
                      <Text style={styles.videoSlideCaption} numberOfLines={2}>
                        {slide.description || watchLabel}
                      </Text>
                    )}
                  </View>
                </View>
              )}
              <View style={styles.mediaTypeBadge}>
                <Icon name={slide.kind === 'image' ? 'zoom-out-map' : 'smart-display'} size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {showThumbs && (
        <ScrollView style={[styles.thumbColumn, { height: imageHeight }]} contentContainerStyle={styles.thumbColumnContent} showsVerticalScrollIndicator={false}>
          {slides.map((slide, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.75}
              style={[styles.thumb, active === i && styles.thumbActive]}
              accessibilityRole="button"
              accessibilityLabel={slide.kind === 'image' ? `${i + 1} / ${slides.length}` : slide.description || watchLabel || 'Play video'}
              accessibilityState={{ selected: active === i }}
            >
              {slide.kind === 'image' ? (
                <Image source={{ uri: getFileUrl(slide.uri) }} style={styles.thumbMedia} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbMedia, styles.thumbVideo]}>
                  {slide.kind === 'video' && (
                    <Image source={{ uri: `https://img.youtube.com/vi/${slide.videoId}/default.jpg` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  )}
                  <Icon name="play-circle-filled" size={26} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      </View>

      {slides.length > 1 && !showThumbs && (
        <View style={styles.dots}>
          {slides.map((_, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.7}
              style={styles.dotTouch}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1} / ${slides.length}`}
              accessibilityState={{ selected: active === i }}
            >
              <View
                style={[
                  styles.dot,
                  onDark && styles.dotOnDark,
                  active === i && (onDark ? styles.dotActiveOnDark : styles.dotActive),
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <MediaViewer
        slides={slides}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        getFileUrl={getFileUrl}
      />
    </View>
  );
}

/**
 * Full-screen viewer opened by tapping a slide — swipe (or use the arrows)
 * between every image and video; a video page plays (YouTube embed or the
 * uploaded file) only while it is the page on screen.
 */
function MediaViewer({
  slides,
  index,
  onClose,
  getFileUrl,
}: {
  slides: MediaSlide[];
  index: number | null;
  onClose: () => void;
  getFileUrl: (filename: string) => string;
}) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const visible = index !== null;

  const goTo = (i: number) => {
    const next = Math.min(Math.max(i, 0), slides.length - 1);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      onShow={() => {
        const start = index ?? 0;
        setPage(start);
        scrollRef.current?.scrollTo({ x: start * width, animated: false });
      }}
    >
      <View style={viewerStyles.container}>
        {visible && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentOffset={{ x: (index ?? 0) * width, y: 0 }}
            onScroll={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== page && i >= 0 && i < slides.length) setPage(i);
            }}
          >
            {slides.map((slide, i) => (
              <View key={i} style={{ width, height }}>
                {slide.kind === 'image' ? (
                  <Image source={{ uri: getFileUrl(slide.uri) }} style={viewerStyles.media} resizeMode="contain" />
                ) : i === page ? (
                  <View style={[viewerStyles.media, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 56 }]}>
                    <VideoFrame
                      videoId={slide.kind === 'video' ? slide.videoId : null}
                      src={slide.kind === 'file' ? getFileUrl(slide.url) : null}
                    />
                  </View>
                ) : (
                  <View style={[viewerStyles.media, viewerStyles.center]}>
                    <Icon name="play-circle-filled" size={72} color="rgba(255,255,255,0.6)" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity
          style={[viewerStyles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('mediaViewerClose')}
        >
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {slides.length > 1 && (
          <>
            {page > 0 && (
              <TouchableOpacity style={[viewerStyles.navBtn, { left: 8 }]} onPress={() => goTo(page - 1)} activeOpacity={0.8}>
                <Icon name="chevron-left" size={34} color="#fff" />
              </TouchableOpacity>
            )}
            {page < slides.length - 1 && (
              <TouchableOpacity style={[viewerStyles.navBtn, { right: 8 }]} onPress={() => goTo(page + 1)} activeOpacity={0.8}>
                <Icon name="chevron-right" size={34} color="#fff" />
              </TouchableOpacity>
            )}
            <Text style={[viewerStyles.counter, { bottom: insets.bottom + 16 }]}>{`${page + 1} / ${slides.length}`}</Text>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  containerFlush: { paddingTop: 0 },
  imageCardFlush: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  emptyImageCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, gap: 6 },
  emptyImageText: { fontSize: 16, color: colors.muted },
  textHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, alignItems: 'center' },
  productName: { fontSize: 27, fontWeight: '400', color: colors.primary, marginBottom: 5, textAlign: 'center' },
  productModel: { fontSize: 22, color: colors.muted, textAlign: 'center' },
  pmcBadge: { fontSize: 19, fontWeight: '600', color: colors.muted, textAlign: 'center', marginTop: 4 },
  carousel: { width: '100%' },
  thumbsLayout: { flexDirection: 'row', gap: 8 },
  carouselWithThumbs: { flex: 1, minWidth: 0 },
  thumbColumn: { flexGrow: 0, width: 58 },
  thumbColumnContent: { gap: 6, paddingRight: 4 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumbActive: { borderWidth: 2.5, borderColor: colors.primaryDark },
  thumbMedia: { width: '100%', height: '100%' },
  thumbVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  slidePage: { paddingHorizontal: 16 },
  imageCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(2),
  },
  carouselImageFull: { width: '100%', height: '100%' },
  videoSlideTouch: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  videoSlideCaption: {
    marginTop: 8,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mediaTypeBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  // Vertical-only touch enlargement -- a wide horizontal touch box (e.g. via
  // MIN_TOUCH + negative margin) blows out the dot row's width past the
  // narrow flush thumbnail columns this renders in (Product Overview/
  // Lifecycle headers), overlapping neighbouring text.
  // Horizontal pitch here matches the original tight dot spacing exactly.
  dotTouch: { paddingVertical: 12, marginHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c7d2e4' },
  dotActive: { width: 22, backgroundColor: colors.accent },
  // Light-on-dark variant (see the `onDark` prop) -- semi-opaque white
  // inactive dots, solid white active dot, so they read against a blue header.
  dotOnDark: { backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActiveOnDark: { width: 22, backgroundColor: '#ffffff' },
});

const viewerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
