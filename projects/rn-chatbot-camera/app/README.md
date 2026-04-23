# RN Chatbot Camera

Sample React Native (Expo) app. One codebase ships to **iOS, Android, and the web (PWA)**.

---

## One codebase, three platforms — the mental model

Expo's managed workflow wraps the React Native renderer for native targets and
adds `react-native-web` for the web. The app code never branches on platform
except where a feature is genuinely unavailable (e.g. camera on web). Platform
output is controlled by which exporter you invoke.

```
       ┌──────────── your JS / TSX code (App.tsx + src/) ────────────┐
       │                                                              │
       ▼                                                              ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│ iOS Simulator│    │ iOS device   │    │ Android APK  │    │ Static web PWA │
│  (.app)      │    │  (.ipa)      │    │ / AAB        │    │  (web-build/)  │
└──────────────┘    └──────────────┘    └──────────────┘    └────────────────┘
      ▲                    ▲                    ▲                    ▲
      │                    │                    │                    │
 eas build           eas build            eas build            expo export
 --platform ios      --platform ios       --platform android   --platform web
 --profile simulator --profile preview    --profile preview
```

Native builds (iOS/Android) run on EAS Build's cloud workers. The web build
runs locally — no cloud required — and produces a plain folder of static files
you can host anywhere (GitHub Pages, S3, Cloudflare Pages, etc.).

---

## Prerequisites

- Node.js 20+
- An [Expo account](https://expo.dev) (free for dev + preview builds)
- For iOS device builds: an Apple Developer account ($99/yr)
- For Android dev locally: the Android SDK + an emulator or USB-connected device
- Optional but recommended: `npm install -g eas-cli`

---

## First-time setup

```bash
cd projects/rn-chatbot-camera/app
npm install
```

---

## Local development

```bash
npm start            # prints a QR + URL; press a/i/w to jump into a target
npm run android      # Android emulator (or Expo Go / dev client on device)
npm run ios          # iOS Simulator
npm run web          # opens http://localhost:8081 in your browser
```

Any code change hot-reloads on all three simultaneously.

---

## Validating before a cloud build

EAS Build costs credits; Metro-stage failures (missing peer deps, etc.) can
burn a build. Run these locally first — they exercise the same bundling step:

```bash
npm run verify       # expo-doctor + Android Metro export
npm run verify:web   # web Metro export
npm run verify:all   # both
```

If these pass, you'll make it past Metro on EAS. Native-side failures (Gradle,
Cocoapods, missing native module bindings like `expo-file-system` or
`expo-font`) can still bite — catch those by actually installing the built app
on a device/simulator.

---

## Building for each platform

### Android APK (sideloadable)

```bash
eas build --profile preview --platform android
```

- Cloud build, ~10–15 min on free tier.
- Output: signed `.apk` URL — download and `adb install`.
- Use the `production` profile if you want an AAB for Google Play.

### iOS Simulator build (free, no Apple Developer account needed)

```bash
eas build --profile simulator --platform ios
```

- Cloud build, ~15–20 min.
- Output: a `.tar.gz` → untar to get a `.app` → drag into the iOS Simulator
  window, or `xcrun simctl install booted path/to.app`.
- Great for sharing a preview with designers/QA who have a Mac.

### iOS device build (ad-hoc, requires Apple Developer account)

```bash
eas build --profile preview --platform ios
```

- EAS walks you through registering your Apple Developer credentials on first
  run and captures the device UDID (or you pre-register it via
  `eas device:create`).
- Output: a signed `.ipa` URL — install via TestFlight, or directly via
  Apple Configurator / Xcode's Devices window.
- Up to 100 ad-hoc devices per app per year (Apple limit).

### Web / PWA (free, builds locally, takes ~5s)

```bash
npm run build:web
# → web-build/ contains index.html, static bundle, manifest, assets
```

- No cloud needed. Serve the folder with any static host.
- Quick local test: `npx serve web-build` then open
  `http://localhost:3000`.
- PWA install prompt appears once the site is served over HTTPS with the
  generated `manifest.json`.

---

## Offline behavior

The chat UI assumes you're calling a remote API (not yet wired up in this
sample). The `<OfflineBanner />` component subscribes to `NetInfo` and
displays a banner whenever the device reports no internet — on all three
platforms. On web it reads `navigator.onLine`. When your developer wires
in a real chat API, they can reuse this banner (or gate the send button
off directly via the same hook).

---

## What does NOT work on web

Gate these features on `Platform.OS === 'web'`:

| Feature | On native | On web |
|--------|-----------|--------|
| `expo-camera` take photo | Yes | No — gated to a "not available in browser" message in `CaptureScreen.tsx` |
| `expo-file-system` | Yes | Partial — only memory-backed; disk paths don't apply |
| Push notifications | Yes (with Firebase/APNs setup) | Limited (Web Push is a separate API surface) |
| Deep links via `scheme://` | Yes | Web uses HTTP URLs instead |

Everything else in this sample — icons, layout, navigation state, chat
bubbles, network-aware UI — works identically on all three.

---

## Project layout

```
app/
├── App.tsx                  # Root: font preload, tab state, routes screens
├── app.json                 # Expo config: iOS + Android + web platform blocks
├── eas.json                 # EAS profiles: development / simulator / preview / production
├── package.json
├── package-lock.json        # Commit this — reproducible builds
├── tsconfig.json
├── babel.config.js
├── index.js                 # Entrypoint: registerRootComponent(App)
└── src/
    ├── theme.ts             # Shared color/spacing tokens
    ├── Header.tsx           # Title + gear icon
    ├── TabBar.tsx           # Bottom 4-tab nav
    ├── OfflineBanner.tsx    # NetInfo subscriber, cross-platform
    ├── HomeScreen.tsx       # Welcome + chat
    ├── CaptureScreen.tsx    # Take Photo / Upload; web-gated
    ├── CameraScreen.tsx     # expo-camera view (native only)
    ├── SurveyScreen.tsx     # External-link steps via Linking
    ├── InfoScreen.tsx       # Static about content
    ├── bot.ts               # Local rule-based chat stub
    └── types.ts             # Shared Message types
```

---

## Notes for a maintaining developer

**Dependency discipline matters.** Transitive-through-`expo` packages
(`expo-asset`, `expo-font`, `expo-file-system`) need to be listed explicitly
in `package.json` if anything depends on them at runtime. Missing peer deps
are the #1 cause of wasted EAS build credits. When adding a module, prefer
`npx expo install <pkg>` over `npm install <pkg>` — the former pins to the
version matched to your Expo SDK.

**Fonts from `@expo/vector-icons` must be preloaded** with `useFonts` at app
boot, otherwise icons render as empty glyphs in production builds. The
`<ActivityIndicator>` splash in `App.tsx` covers the one-frame load.

**Web bundle size is ~900 KB uncompressed** for this minimal app, mostly from
React Native Web and the full vector-icons font bundle. If you ship a real
web app, consider:
- Tree-shaking the icon set (import individual icons instead of `Feather`)
- Enabling the Metro production build's minifier (default for `expo export`)
- Serving with gzip/brotli at the edge

**Android 16 KB page size.** Expo SDK 52 isn't 16 KB-aligned. SDK 53+ is.
You'll see a compatibility warning on the new `ps16k` emulator variants;
it's informational, not a blocker. Plan to upgrade to SDK 53 during the
transition window.
