# peach

Unabashed peach clone.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) app on your phone (optional, for mobile testing)

## Setup

```bash
npm install
```

## Running the app

```bash
# Start Expo dev server (opens options for web, iOS, Android)
npm start

# Launch directly in web browser
npm run web

# Launch on iOS simulator
npm run ios

# Launch on Android emulator
npm run android
```

To run on your physical phone, install Expo Go and scan the QR code shown in the terminal.

## Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npx jest tests/screens/HelloScreen.test.tsx
```
