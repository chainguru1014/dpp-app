import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, shadow } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MediaSlide =
  | { kind: 'image'; uri: string }
  | { kind: 'video'; videoId: string; url: string; description?: string };

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
  onPlayVideo?: (videoId: string) => void;
}

/**
 * Paged product-media slider with pagination dots — product images first, then
 * any YouTube videos at the end. Extracted from ResultScreen's ImageSlider so
 * Product Summary / Product Detected / Product Overview can all share it.
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
  onPlayVideo,
}: MediaSliderProps) {
  const [pageWidth, setPageWidth] = useState(SCREEN_WIDTH);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pad = flush ? 0 : 16;
  const imageHeight = Math.min(Math.max(120, Math.round((pageWidth - pad * 2) * 1.05)), maxHeight);

  const slides: MediaSlide[] = [
    ...images.map((uri): MediaSlide => ({ kind: 'image', uri })),
    ...(videos || [])
      .map((v: any): MediaSlide | null => {
        const url = typeof v === 'string' ? v : v?.url || '';
        const videoId = getYoutubeVideoID(url);
        return videoId
          ? { kind: 'video', videoId, url, description: typeof v === 'object' ? v?.description : '' }
          : null;
      })
      .filter((s): s is MediaSlide => s != null),
  ];

  const onScroll = (e: any) => {
    if (!pageWidth) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (i !== active && i >= 0 && i < slides.length) setActive(i);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
    setActive(i);
  };

  if (slides.length === 0) return null;

  return (
    <View
      style={[styles.container, flush && styles.containerFlush]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w && Math.abs(w - pageWidth) > 1) setPageWidth(w);
      }}
    >
      {!hideHeader && (name || model || pmcCode) ? (
        <View style={styles.textHeader}>
          {!!name && <Text style={styles.productName}>{name}</Text>}
          {!!model && <Text style={styles.productModel}>{model}</Text>}
          {!!pmcCode && <Text style={styles.pmcBadge}>ID: {pmcCode}</Text>}
        </View>
      ) : null}

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
        style={styles.carousel}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slidePage, { width: pageWidth, paddingHorizontal: pad }]}>
            <View style={[styles.imageCard, flush && styles.imageCardFlush, { height: imageHeight }]}>
              {slide.kind === 'video' ? (
                <TouchableOpacity
                  style={styles.videoSlideTouch}
                  activeOpacity={0.85}
                  onPress={() => onPlayVideo?.(slide.videoId)}
                >
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${slide.videoId}/hqdefault.jpg` }}
                    style={styles.carouselImageFull}
                    resizeMode="cover"
                  />
                  <View style={styles.videoPlayOverlay}>
                    <Icon name="play-circle-filled" size={64} color="#fff" />
                    {!!(slide.description || watchLabel) && (
                      <Text style={styles.videoSlideCaption} numberOfLines={2}>
                        {slide.description || watchLabel}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ) : (
                <Image
                  source={{ uri: getFileUrl(slide.uri) }}
                  style={styles.carouselImageFull}
                  resizeMode="contain"
                />
              )}
              <View style={styles.mediaTypeBadge}>
                <Icon name={slide.kind === 'video' ? 'smart-display' : 'photo-camera'} size={14} color="#fff" />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {slides.length > 1 && (
        <View style={styles.dots}>
          {slides.map((_, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <View style={[styles.dot, active === i && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  containerFlush: { paddingTop: 0 },
  imageCardFlush: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  textHeader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, alignItems: 'center' },
  productName: { fontSize: 20, fontWeight: '400', color: colors.primary, marginBottom: 5, textAlign: 'center' },
  productModel: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  pmcBadge: { fontSize: 14, fontWeight: '600', color: colors.muted, textAlign: 'center', marginTop: 4 },
  carousel: { width: '100%' },
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
    fontSize: 13,
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
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#c7d2e4' },
  dotActive: { width: 22, backgroundColor: colors.accent },
});
