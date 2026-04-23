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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Message } from './types';
import { respond } from './bot';
import { theme, radius } from './theme';

type Props = {
  messages: Message[];
  appendMessage: (m: Message) => void;
};

export default function HomeScreen({ messages, appendMessage }: Props) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const counterRef = useRef(0);
  const atBottomRef = useRef(true);
  const inputRef = useRef<TextInput>(null);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;
  const showHero = userMessageCount === 0;

  const nextId = (prefix: string) => {
    counterRef.current += 1;
    return `${prefix}-${Date.now()}-${counterRef.current}`;
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    appendMessage({
      id: nextId('u'),
      role: 'user',
      kind: 'text',
      text,
      createdAt: Date.now(),
    });
    setDraft('');
    setTimeout(() => {
      appendMessage({
        id: nextId('b'),
        role: 'bot',
        kind: 'text',
        text: respond(text),
        createdAt: Date.now(),
      });
    }, 350);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      {showHero ? (
        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Your Study Companion</Text>
            <Text style={styles.heroBody}>
              Hey there, future lab star! I'm your demo companion — tap a button or ask a
              question to get started.
            </Text>
            <View style={styles.circlesRow}>
              <View style={[styles.circle, { backgroundColor: theme.accentSoft }]}>
                <Feather name="git-branch" size={26} color={theme.accent} />
              </View>
              <View style={[styles.circle, { backgroundColor: theme.successSoft }]}>
                <Feather name="smile" size={26} color={theme.successAccent} />
              </View>
              <View style={[styles.circle, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name="flask-outline" size={26} color={theme.accent} />
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={() => inputRef.current?.focus()}
            >
              <Text style={styles.ctaText}>Ask your first question</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Bubble message={item} />}
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const distanceFromBottom =
              contentSize.height - (contentOffset.y + layoutMeasurement.height);
            atBottomRef.current = distanceFromBottom < 40;
          }}
          scrollEventThrottle={32}
          onContentSizeChange={() => {
            if (atBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask me anything…"
          placeholderTextColor={theme.accent}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.6 }]}
          onPress={send}
          accessibilityLabel="Send message"
        >
          <Feather name="send" size={22} color={theme.accent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.rowEnd : styles.rowStart]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
        ]}
      >
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
  root: { flex: 1, backgroundColor: theme.bg },
  heroWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  heroCard: {
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: 24,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  circlesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    backgroundColor: theme.accent,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  list: { padding: 12, gap: 8, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: theme.accent, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: theme.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  textUser: { color: '#ffffff', fontSize: 15 },
  textBot: { color: theme.textPrimary, fontSize: 15 },
  image: { width: 220, height: 220, borderRadius: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: theme.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.inputBg,
    color: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
