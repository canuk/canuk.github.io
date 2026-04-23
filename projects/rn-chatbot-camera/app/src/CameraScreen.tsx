import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { theme, radius } from './theme';

type Props = {
  onCapture: (uri: string) => void;
  onCancel: () => void;
};

export default function CameraScreen({ onCapture, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>We need camera access to take photos.</Text>
        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) onCapture(photo.uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Capture failed', message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
      <View style={styles.controls}>
        <Pressable style={styles.sideBtn} onPress={onCancel} accessibilityLabel="Cancel">
          <Feather name="x" size={22} color="#f9fafb" />
        </Pressable>
        <Pressable
          style={[styles.shutter, capturing && styles.shutterActive]}
          onPress={takePhoto}
          disabled={capturing}
          accessibilityLabel="Take photo"
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable
          style={styles.sideBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityLabel="Flip camera"
        >
          <Feather name="refresh-cw" size={22} color="#f9fafb" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
    padding: 24,
    gap: 12,
  },
  permText: {
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 16,
  },
  controls: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  shutterActive: { opacity: 0.6 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: theme.accent,
  },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryText: { color: theme.textSecondary, fontWeight: '600' },
});
