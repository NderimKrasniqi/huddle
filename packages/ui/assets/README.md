# Huddle shared runtime assets

This folder contains the current deterministic runtime assets for Huddle. The
only retained design reference is the original board at
[`docs/design/heartbeat/reference/heartbeat-direction.png`](../../../docs/design/heartbeat/reference/heartbeat-direction.png).
No generated brand or screen direction is visually approved. The assets in this
folder are temporary implementation assets, not approved design masters, and
may be replaced during the screen-by-screen visual approval process.

## App identity resources

| Asset | Dimensions | Alpha | Use |
| --- | ---: | :---: | --- |
| `app-icons/huddle-app-icon-light.png` | 1024×1024 | no | iOS light/default and Expo icon |
| `app-icons/huddle-app-icon-dark.png` | 1024×1024 | no | iOS dark icon |
| `app-icons/huddle-android-legacy.png` | 1024×1024 | no | Android legacy launcher |
| `app-icons/huddle-android-tv-icon.png` | 1024×1024 | no | Android TV launcher |
| `app-icons/huddle-android-adaptive-foreground.png` | 1024×1024 | yes | Android adaptive foreground |
| `app-icons/huddle-android-monochrome.png` | 1024×1024 | yes | Android monochrome foreground |
| `app-icons/huddle-splash.png` | 1024×1024 | no | Expo native splash image |
| `app-icons/huddle-android-tv-banner.png` | 640×360 | no | Android TV banner |

Opaque identity images use an espresso or cream canvas and the exact supplied
glossy Huddle launcher mark. Adaptive and monochrome foregrounds retain a
transparent safe zone around the same mark. `sips` is the reproducible
resize/pad tool; no creative redraw is made in this package. The Android TV
banner is a full-bleed 640×360 espresso rasterization composed with the exact
glossy mark and the checked-in Nunito ExtraBold cream wordmark.

### Apple TV identity (experimental)

The `app-icons/apple-tv/` family is composed by
[`tools/generate-apple-tv-assets.swift`](../../../tools/generate-apple-tv-assets.swift)
from the current glossy Huddle launcher mark, installed Nunito ExtraBold face,
and current platform-stage implementation art (the room art is used only for
Top Shelf assets). The `platform-stage.png` background is the current shared
TV platform backdrop; the four Top Shelf derivatives are regenerated from it.
It is wired to the experimental `appleTVImages` config for
`@react-native-tvos/config-tv@0.1.6`. These assets are exact platform
derivatives, not a release claim for tvOS.

| Asset | Dimensions | Alpha | Use |
| --- | ---: | :---: | --- |
| `app-icons/apple-tv/huddle-tv-icon-1280x768.png` | 1280×768 | no | Apple TV large icon |
| `app-icons/apple-tv/huddle-tv-icon-400x240.png` | 400×240 | no | Apple TV small icon |
| `app-icons/apple-tv/huddle-tv-icon-800x480.png` | 800×480 | no | Apple TV small icon @2x |
| `app-icons/apple-tv/huddle-tv-top-shelf-1920x720.png` | 1920×720 | no | Apple TV top shelf |
| `app-icons/apple-tv/huddle-tv-top-shelf-3840x1440.png` | 3840×1440 | no | Apple TV top shelf @2x |
| `app-icons/apple-tv/huddle-tv-top-shelf-wide-2320x720.png` | 2320×720 | no | Apple TV wide top shelf |
| `app-icons/apple-tv/huddle-tv-top-shelf-wide-4640x1440.png` | 4640×1440 | no | Apple TV wide top shelf @2x |

## Heartbeat artwork

`heartbeat/` contains the current runtime copies used by the app:

- `brand/` — display and launcher marks.
- `phone/` — join and identity environment art.
- `tv/` — selected platform-stage presentation background (`platform-stage.png`).
- `game-cards/` — text-free Trivia, Voting, Doodle Dash, Quick Poll, and Hot
  Take illustrations.
- `game-worlds/` — Trivia and Voting 16:9 presentation artwork.

The source artwork is text-free and decorative. All labels, room codes, QR
payloads, controls, and status messages remain native and accessible. The
`HEARTBEAT_ARTWORK` map exported from `@huddle/ui/native` is the stable import
surface for Phone and TV. The platform stage is a temporary runtime
implementation asset. The original board remains the only retained visual
reference, and the full screen library remains unapproved.

## Collectible avatars

The ten files under `avatars/` preserve the existing stable `AvatarId`
filenames. Each is a 512×512 transparent PNG runtime derivative. Convex
contracts and seat capacity are unchanged; avatar artwork remains pending
visual approval.
