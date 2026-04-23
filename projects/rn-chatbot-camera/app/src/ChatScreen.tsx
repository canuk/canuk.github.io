import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Message } from './types';
import { respond } from './bot';

type Props = {
  messages: Message[];
  appendMessage: (m: Message) => void;
  onOpenCamera: () => void;
};

export default function ChatScreen({ messages, appendMessage, onOpenCamera }: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const now = Date.now();
    appendMessage({ id: `u-${now}`, role: 'user', kind: 'text', text, createdAt: now });
    setDraft('');
    setTimeout(() => {
      appendMessage({
        id: `b-${now + 1}`,
        role: 'bot',
        kind: 'text',
        text: respond(text),
        createdAt: now + 1,
      });
    }, 350);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chatbot Demo</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Bubble message={item} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor="#9ca3af"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={onOpenCamera}
          accessibilityLabel="Open camera"
        >
          <Text style={styles.iconText}>📷</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
          onPress={send}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.rowEnd : styles.rowStart]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        {message.kind === 'text' ? (
          <Text style={isUser ? styles.textUser : styles.textBot}>{message.text}</Text>
        ) : (
          <Image source={{ uri: message.uri }} style={styles.image} resizeMode="cover" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111827' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#1f2937',
  },
  headerTitle: { color: '#f9fafb', fontSize: 18, fontWeight: '600' },
  list: { padding: 12, gap: 8, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: 10, borderRadius: 14 },
  bubbleUser: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: '#374151', borderBottomLeftRadius: 4 },
  textUser: { color: '#f9fafb' },
  textBot: { color: '#e5e7eb' },
  image: { width: 220, height: 220, borderRadius: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    backgroundColor: '#111827',
  },
  input: {
    flex: 1,
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  iconText: { fontSize: 20 },
  sendButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2563eb',
    borderRadius: 20,
  },
  sendText: { color: '#f9fafb', fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
