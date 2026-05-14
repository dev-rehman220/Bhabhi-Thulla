Bhabhi Thulla — React Native (Expo) scaffold

This folder contains a production-oriented scaffold for a React Native + Expo TypeScript app designed to implement the Bhabhi Thulla card game UI/UX and multiplayer architecture.

Quick start

1. Install dependencies (from `rn-bhabhi` folder):

```bash
npm install
# or
yarn
```

2. Start Expo:

```bash
npx expo start
```

Notes

- This scaffold includes core screens, components, a rules engine, AI helpers, Zustand stores, and placeholder services for Firebase and Socket.IO.
- You must import `react-native-reanimated` and follow installation steps for Reanimated and Gesture Handler in Expo (or use the bare workflow). See official docs for native setup.
- Add your Firebase config to `src/services/firebase.ts` and implement real authentication.
- Replace `socket.io` URL with your server's address in `src/services/socket.ts`.

Production checklist

- Implement and wire actual animations (Lottie JSON), card assets, sounds.
- Integrate Firebase/Socket server and secure auth.
- Optimize FlashList usage and memoize major components.
- Configure MMKV storage for offline caching.
- Profile and verify 60FPS on target devices.

Folder overview

- `src/app` — entry + navigation
- `src/screens` — Splash, Login, Lobby, Table, Results
- `src/components` — reusable UI and game components
- `src/engine` — pure game rules and turn logic
- `src/services` — firebase and socket wrappers
- `src/store` — Zustand global stores

If you'd like, I can now:
- Wire a simple Socket.IO demo server and client pairing.
- Implement polished `PlayingCard` animations and drag/drop with Reanimated v3.
- Integrate Firebase auth (Google sign-in) and Firestore matchmaking.
Which would you like me to do next?