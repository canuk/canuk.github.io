export function respond(input: string): string {
  const q = input.trim().toLowerCase();

  if (!q) return "Say something and I'll reply.";
  if (/\b(hi|hello|hey|howdy)\b/.test(q)) return 'Hey there! How can I help?';
  if (/\b(who are you|what are you)\b/.test(q)) {
    return "I'm a sample React Native chatbot running locally on your device.";
  }
  if (/\bcamera\b/.test(q)) {
    return 'Tap the camera icon next to the text box to take a picture.';
  }
  if (/\bapk\b/.test(q)) {
    return 'Build an APK with `eas build --profile preview --platform android` and sideload it onto your Chromebook.';
  }
  if (/\b(bye|goodbye|later)\b/.test(q)) return 'Bye! Come back soon.';
  if (q.endsWith('?')) {
    return "That's a good question — I'm just a demo bot, but I appreciate the curiosity.";
  }
  return `You said: "${input}". I'm a simple rule-based bot — try asking about the camera or saying hi.`;
}
