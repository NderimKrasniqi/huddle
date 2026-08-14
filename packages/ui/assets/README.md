# Huddle shared technical assets

The shared UI package ships no product artwork. Its only checked-in bitmaps are
the native launcher, splash, adaptive-icon, and Android TV banner resources.

| Asset | Dimensions | Use |
| --- | ---: | --- |
| `app-icons/huddle-app-icon-light.png` | 1024×1024 | iOS light and default Expo icon |
| `app-icons/huddle-app-icon-dark.png` | 1024×1024 | iOS dark icon |
| `app-icons/huddle-android-legacy.png` | 1024×1024 | Android legacy launcher icon |
| `app-icons/huddle-android-tv-icon.png` | 1024×1024 | Android TV launcher icon |
| `app-icons/huddle-android-adaptive-foreground.png` | 1024×1024 | Transparent black adaptive foreground |
| `app-icons/huddle-android-monochrome.png` | 1024×1024 | Transparent black monochrome foreground |
| `app-icons/huddle-splash.png` | 1024×1024 | Neutral splash placeholder |
| `app-icons/huddle-android-tv-banner.png` | 640×360 | White Android TV banner with black “Huddle” |

Every opaque resource is white with a black `H`; the adaptive and monochrome
foregrounds are transparent with a black `H`. App configuration is the only
consumer of these files. The illustrated Join Room slice is an app-owned
exception: its three supplied runtime PNGs live under
`apps/phone/assets/join-room`, outside this shared boundary. The illustrated TV
Room Invitation is a second app-owned exception under
`apps/tv/assets/room-invitation`: its clean background and phone icon are runtime
artwork, while `tv-lobby-empty.png` is retained only as an unbundled comparison
reference. All other product visuals and the previous redesign importer remain
absent; Git history is the archive for superseded artwork.
