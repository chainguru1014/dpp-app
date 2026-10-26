import React from 'react';

// Web build: a plain YouTube embed iframe, or an HTML5 <video> for an
// uploaded file (src). Rendered full-bleed inside the media viewer.
// (react-native-web passes DOM elements straight through.)
export default function VideoFrame({ videoId, src }) {
  if (src) {
    return (
      <video
        src={src}
        controls
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', display: 'block', backgroundColor: '#000', objectFit: 'contain' }}
      />
    );
  }
  if (!videoId) return null;
  return (
    <iframe
      title="Product video"
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}
