import React, { useCallback, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ChatScreen from './src/ChatScreen';
import CameraScreen from './src/CameraScreen';
import { Message } from './src/types';

type Mode = 'chat' | 'camera';

const initialMessages: Message[] = [
  {
    id: 'greet-1',
    role: 'bot',
    kind: 'text',
    text: "Hi! I'm a sample chatbot. Type a message, or tap the camera icon to snap a photo and share it with me.",
    createdAt: Date.now(),
  },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [mode, setMode] = useState<Mode>('chat');

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleCapture = useCallback(
    (uri: string) => {
      const now = Date.now();
      appendMessage({
        id: `u-${now}`,
        role: 'user',
        kind: 'image',
        uri,
        createdAt: now,
      });
      appendMessage({
        id: `b-${now + 1}`,
        role: 'bot',
        kind: 'text',
        text: 'Nice shot! I can see you sent me a photo.',
        createdAt: now + 1,
      });
      setMode('chat');
    },
    [appendMessage]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {mode === 'chat' ? (
        <ChatScreen
          messages={messages}
          appendMessage={appendMessage}
          onOpenCamera={() => setMode('camera')}
        />
      ) : (
        <CameraScreen onCapture={handleCapture} onCancel={() => setMode('chat')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
});
