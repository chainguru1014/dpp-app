import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import VideoFrame from './VideoFrame';

// Full-screen in-app YouTube player. Opened from the product media slider's
// video slides. Close button sits top-right over the video.
export default function VideoPlayerModal({
  visible,
  videoId,
  onClose,
}: {
  visible: boolean;
  videoId: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible && !!videoId}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {visible && videoId ? <VideoFrame videoId={videoId} /> : null}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 44,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
