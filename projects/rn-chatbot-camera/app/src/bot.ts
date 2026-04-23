export function respond(input: string): string {
  const q = input.trim().toLowerCase();

  if (!q) return "Say something and I'll reply.";
  if (/\b(hi|hello|hey|howdy)\b/.test(q)) return 'Hey there! How can I help?';
  if (/\b(who are you|what are you)\b/.test(q)) {
    return "I'm a sample React Native demo bot running locally on your device.";
  }
  if (/\b(camera|photo|picture)\b/.test(q)) {
    return 'Open the Capture tab and tap Take Photo to try the camera.';
  }
  if (/\b(survey|survey)\b/.test(q)) {
    return 'Class surveys live in the clipboard tab — open each in your browser.';
  }
  if (/\bapk\b/.test(q)) {
    return 'Build an APK with `eas build --profile preview --platform android`, then sideload it onto your Chromebook.';
  }
  if (/\b(bye|goodbye|later)\b/.test(q)) return 'Bye! Come back soon.';
  if (q.endsWith('?')) {
    return "That's a good question — I'm just a demo bot, but I appreciate the curiosity.";
  }
  return `You said: "${input}". Try asking about the camera, surveys, or the APK build.`;
}
