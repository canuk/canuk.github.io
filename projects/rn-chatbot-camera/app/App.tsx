import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Header from './src/Header';
import TabBar, { TabKey } from './src/TabBar';
import HomeScreen from './src/HomeScreen';
import CaptureScreen from './src/CaptureScreen';
import SurveyScreen from './src/SurveyScreen';
import InfoScreen from './src/InfoScreen';
import CameraScreen from './src/CameraScreen';
import { Message } from './src/types';
import { theme } from './src/theme';

const TAB_TITLES: Record<TabKey, string> = {
  home: 'Your Study Companion',
  capture: 'Sample Capture',
  survey: 'Survey',
  info: 'About',
};

const initialMessages: Message[] = [
  {
    id: 'greet-1',
    role: 'bot',
    kind: 'text',
    text: "Hi! I'm a sample chatbot. Ask me anything, or head to the Capture tab to snap a photo.",
    createdAt: Date.now(),
  },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [cameraOpen, setCameraOpen] = useState(false);
  const idCounter = React.useRef(0);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleCapture = useCallback((uri: string) => {
    idCounter.current += 1;
    const now = Date.now();
    appendMessage({
      id: `u-${now}-${idCounter.current}`,
      role: 'user',
      kind: 'image',
      uri,
      createdAt: now,
    });
    idCounter.current += 1;
    appendMessage({
      id: `b-${now}-${idCounter.current}`,
      role: 'bot',
      kind: 'text',
      text: 'Nice shot! I can see you sent me a photo.',
      createdAt: now + 1,
    });
    setCameraOpen(false);
    setTab('home');
  }, [appendMessage]);

  if (cameraOpen) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SafeAreaView style={styles.cameraRoot} edges={['top', 'bottom']}>
          <CameraScreen
            onCapture={handleCapture}
            onCancel={() => setCameraOpen(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Header title={TAB_TITLES[tab]} />
        <View style={styles.body}>
          {tab === 'home' && (
            <HomeScreen messages={messages} appendMessage={appendMessage} />
          )}
          {tab === 'capture' && (
            <CaptureScreen onOpenCamera={() => setCameraOpen(true)} />
          )}
          {tab === 'survey' && <SurveyScreen />}
          {tab === 'info' && <InfoScreen />}
        </View>
        <TabBar active={tab} onChange={setTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  body: {
    flex: 1,
  },
});
