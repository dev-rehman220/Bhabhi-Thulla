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

## Render deployment
- Use `server/render.yaml`.
- Ensure build command is `npm install ; npm run build`.
- Start command is `npm start`.

## Android dev-client prerequisite
- Android Studio and Android SDK must be installed locally.
- `adb` must be on `PATH` for `expo run:android`.
