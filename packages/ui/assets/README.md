# Huddle shared runtime assets

This folder contains the runtime assets for the Huddle platform. The visual
reference is the Playroom design at
[`docs/design/playroom/README.md`](../../../docs/design/playroom/README.md).
These files are implementation assets, not design masters; each game keeps its
own world art in its own `assets/` folder.

## App identity resources

`tools/generate-app-icons.py` derives every file below from the supplied
Huddle-Platform app artwork. It only resizes, flattens onto the canvas colour
`#F9F1E6`, and pads; it never redraws.

| Asset | Dimensions | Alpha | Use |
| --- | ---: | :---: | --- |
| `app-icons/huddle-app-icon-light.png` | 1024×1024 | no | iOS light/default and Expo icon |
| `app-icons/huddle-app-icon-dark.png` | 1024×1024 | no | iOS dark icon (the same cream icon) |
| `app-icons/huddle-android-legacy.png` | 1024×1024 | no | Android legacy launcher |
| `app-icons/huddle-android-tv-icon.png` | 1024×1024 | no | Android TV launcher |
| `app-icons/huddle-android-adaptive-foreground.png` | 1024×1024 | yes | Android adaptive foreground, as supplied, inside the central 60% |
| `app-icons/huddle-android-monochrome.png` | 1024×1024 | yes | Android monochrome foreground, as supplied |
| `app-icons/huddle-splash.png` | 1024×1024 | no | Expo native splash image |
| `app-icons/huddle-android-tv-banner.png` | 640×360 | no | Android TV banner |

### Apple TV identity (experimental)

The `app-icons/apple-tv/` family pads the supplied TV banner onto the canvas
colour at each required size. It is wired to the experimental `appleTVImages`
config for `@react-native-tvos/config-tv@0.1.6` and is not a release claim for
tvOS.

| Asset | Dimensions | Alpha | Use |
| --- | ---: | :---: | --- |
| `app-icons/apple-tv/huddle-tv-icon-1280x768.png` | 1280×768 | no | Apple TV large icon |
| `app-icons/apple-tv/huddle-tv-icon-400x240.png` | 400×240 | no | Apple TV small icon |
| `app-icons/apple-tv/huddle-tv-icon-800x480.png` | 800×480 | no | Apple TV small icon @2x |
| `app-icons/apple-tv/huddle-tv-top-shelf-1920x720.png` | 1920×720 | no | Apple TV top shelf |
| `app-icons/apple-tv/huddle-tv-top-shelf-3840x1440.png` | 3840×1440 | no | Apple TV top shelf @2x |
| `app-icons/apple-tv/huddle-tv-top-shelf-wide-2320x720.png` | 2320×720 | no | Apple TV wide top shelf |
| `app-icons/apple-tv/huddle-tv-top-shelf-wide-4640x1440.png` | 4640×1440 | no | Apple TV wide top shelf @2x |

## Playroom artwork

`playroom/` holds the platform's runtime art, exported through
`PLAYROOM_ARTWORK`, `PLAYROOM_AVATARS`, `PLAYROOM_SETTING_ICONS`, and
`playroomGameArt` from `@huddle/ui/native`:

- `avatars/` — the ten characters as transparent cut-outs, named by stable
  `AvatarId`. The pastel circle behind each one is drawn natively.
- `brand/` — the wordmark and splash illustration.
- `games/` — card art for the five catalogue games; Coming soon art is
  supplied already muted.
- `props/` — clay stars, balls, controller, crown, and the raised hand.
- `settings/` — the setting icons a game may declare.
- `status/` — loading, waiting, room full, room not found, disconnected,
  paused, and left-room illustrations.

The artwork is text-free and decorative. All labels, room codes, QR payloads,
controls, and status messages remain native and accessible. The architecture
validator pins every file by dimensions, alpha, and digest.
