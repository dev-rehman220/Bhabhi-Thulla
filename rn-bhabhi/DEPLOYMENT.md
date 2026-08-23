# Deployment Notes

## Client
- Expo app currently runs as a dev-client project.
- For mobile testing, install Android SDK and run `npx expo run:android` to generate the dev client.
- For LAN Metro testing, use `npx expo start --dev-client --lan`.

## Server
- Build:
  ```bash
  cd server
  npm install
  npm run build
  ```
- Run:
  ```bash
  npm start
  ```

## Environment variables
- `PORT` for the server port.
- `GOOGLE_APPLICATION_CREDENTIALS` for Firebase Admin on the server.
- `EXPO_PUBLIC_SERVER_URL` for the mobile app Socket.IO endpoint.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for Firebase Google sign-in.

## Local network multiplayer

1. Start the server on the host computer from `rn-bhabhi/server` with `npm start`.
2. Allow Node.js through the host computer firewall on TCP port `3001`.
3. Set `EXPO_PUBLIC_SERVER_URL` in `rn-bhabhi/.env` to the host computer LAN IPv4 address, such as `http://192.168.1.20:3001`.
4. Start Expo with `npm run web` or build the app for each device. Every player must use the same Wi-Fi network.
5. One player chooses **Play with friends - LAN**, selects 2 to 6 players, and shares the room code. Other players join with that code.

The server is authoritative for Thulla rules: players follow the lead suit, beat the current high card when possible, and otherwise collect the pile. Empty hands are eliminated and the last remaining player is Thulla.

## Render deployment
- Use `server/render.yaml`.
- Ensure build command is `npm install ; npm run build`.
- Start command is `npm start`.

## Android dev-client prerequisite
- Android Studio and Android SDK must be installed locally.
- `adb` must be on `PATH` for `expo run:android`.
