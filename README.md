# Record My Athlete 🏀

A simple mobile app for parents to record their kid's basketball games, tag
stats live (with one tap), pause/resume recording, and save **favorite
moments** as auto-trimmed highlight clips — all on your phone, no account
required.

Built with **Expo (React Native) + TypeScript**.

## What it does

- **Set up a game** — pick the athlete, date, opponent, and location.
- **Record live** — full-screen camera with big on-screen buttons:
  - Tap **✓ Made / ✗ Miss** for Free Throws, 2-Pointers, and 3-Pointers.
    Points and shooting percentages are tallied automatically.
  - Tap **★ Favorite Moment** to save a highlight around right now. Each clip
    grabs a few seconds *before* and *after* the tap (configurable in Settings —
    e.g. 2s before / 2s after, or 3s before / 5s after).
  - **Pause / Resume** at any time. Each pause finishes the current clip and
    saves it as a video for the game; resuming starts a fresh one — so a single
    game can have several videos.
- **Import videos** — pull in clips you already shot from your photo library
  and clip highlights out of them while you watch.
- **Review** — open a game to see the box score, all videos, and all highlights.
  Play a highlight, **mark it watched / unwatched**, replay it, or delete it.

## How highlight clipping works

Clips are stored as **non-destructive time ranges** over the original video
(`startMs → endMs`) rather than cutting new video files on the device. Tapping
★ at time *T* saves a clip of `[T − preBuffer, T + postBuffer]`, and playback
plays exactly that range. This makes clipping instant and reliable on-device.

> Exporting clips as standalone files / pushing them to a shared highlight reel
> is the natural next step and would be handled by a cloud backend (see Roadmap).

## Running the app

Requires [Node.js](https://nodejs.org) and the Expo tooling.

```bash
npm install

# Align native package versions with the installed Expo SDK (recommended)
npx expo install --fix

# Start the dev server, then open in Expo Go on your phone (scan the QR code)
npx expo start
```

> Camera recording requires a **physical device** (the camera does not work in
> the iOS Simulator / Android emulator). Install **Expo Go** from the App Store
> / Play Store and scan the QR code, or create a development build.

Type-check the project with:

```bash
npm run typecheck
```

## Project structure

```
app/                       # expo-router screens (file-based routing)
  _layout.tsx              # navigation stack + providers
  index.tsx                # home: list of games
  athletes/index.tsx       # manage athletes
  settings/index.tsx       # clip length (pre/post buffer)
  games/new.tsx            # create a game
  games/[id]/index.tsx     # game detail: stats, videos, highlights
  games/[id]/record.tsx    # live recording + stat buttons + ★ clipping
  games/[id]/player.tsx    # play a video or a highlight clip
src/
  store/                   # AsyncStorage-backed data store + selectors
  domain/                  # stat types & box-score computation
  components/              # reusable UI
  util/                    # formatting, ids, on-device video storage
```

All data lives on the device (metadata via AsyncStorage, video files in the
app's document directory).

## Roadmap

- Cloud accounts + upload, server-side clip export, shareable highlight reels
- Season/team views and multi-athlete games
- Shot-chart / per-quarter breakdowns
