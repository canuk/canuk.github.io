# RN Chatbot Camera

Sample React Native (Expo) app: a local rule-based chatbot that can also
capture photos from the device camera and display them as chat messages.

Intended as a learning project for:

1. Scaffolding a minimal React Native app with Expo
2. Building a signed Android APK
3. Installing the APK on a Chromebook via its Android subsystem

## Prerequisites

- Node.js 20+
- An [Expo](https://expo.dev) account (free) — needed for cloud APK builds
- For local dev, the [Expo Go](https://expo.dev/go) app on a phone, or an
  Android emulator

## First-time setup

```bash
cd projects/rn-chatbot-camera/app
npm install
```

## Run in development

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `a` to launch an
Android emulator. The camera tab will prompt for permission on first use.

> Heads up: `expo-camera` does **not** run in Expo Go on newer SDKs when
> using the New Architecture. If you hit runtime errors, use a development
> build instead:
>
> ```bash
> npx expo install expo-dev-client
> npx eas build --profile development --platform android
> ```

## Build an installable APK

Install and authenticate the EAS CLI once:

```bash
npm install -g eas-cli
eas login
eas init     # links this project to your Expo account
```

Kick off a cloud APK build:

```bash
eas build --profile preview --platform android
```

When it finishes, EAS prints a URL. Download the `.apk` from there.

### Optional: build locally without the cloud

Requires JDK 17 and the Android SDK on your machine.

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK lands in android/app/build/outputs/apk/release/
```

## Install the APK on a Chromebook

ChromeOS runs Android apps through a Linux-based Android subsystem.
Sideloading requires two things: the Linux (Crostini) container, and
ChromeOS developer mode for the Android runtime (ARC).

1. **Enable Linux (Crostini)** — `Settings → Advanced → Developers →
   Linux development environment → Turn on`.
2. **Enable ARC ADB sideloading** — `Settings → Advanced → Developers →
   Linux development environment → Develop Android apps → Enable ADB
   debugging`. This reboots the device and requires confirming the
   powerwash-style warning. (Required only once; keeps your data.)
3. In the Linux terminal, install ADB:
   ```bash
   sudo apt update && sudo apt install -y android-tools-adb
   ```
4. Copy the APK into the Linux container (drag it into the `Linux files`
   folder in the Files app).
5. Connect ADB to the Android subsystem:
   ```bash
   adb connect 100.115.92.2:5555
   ```
   The first time, a confirmation dialog appears on the ChromeOS desktop —
   accept it.
6. Install:
   ```bash
   adb install rn-chatbot-camera.apk
   ```

The app now appears in the ChromeOS launcher.

## Project layout

```
app/
├── App.tsx              # Root component; toggles chat <-> camera mode
├── app.json             # Expo config (package id, camera permission)
├── eas.json             # EAS Build profiles (preview = APK)
├── package.json
├── tsconfig.json
├── babel.config.js
└── src/
    ├── ChatScreen.tsx   # Message list + input + camera button
    ├── CameraScreen.tsx # expo-camera view with shutter / flip
    ├── bot.ts           # Rule-based bot responses
    └── types.ts         # Message type definitions
```
