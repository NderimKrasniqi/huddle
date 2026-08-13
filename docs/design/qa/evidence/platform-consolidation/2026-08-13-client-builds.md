# Client build proof — 2026-08-13

This record covers `REL-001` and `REL-002`. Build configuration and generated
native projects used the Convex development runtime only:

- Runtime URL: `https://colorful-viper-224.convex.cloud`
- Production targeting: none; no production deployment or reset command was used.
- Source checkpoint: `142fe6c` (`complete development deployment cutover`)
- Toolchain: Xcode 26.5 (17F42), Node 24.18.0, pnpm 10.13.1, Java 17.0.20,
  Expo 57.0.8, Android compile/target SDK 36

## Native identity and export checks

Clean Expo prebuilds completed for Phone iOS, Phone Android, TV Android, and
experimental TV iOS. The generated identities were inspected before building:

| Target | Native identity | Result |
| --- | --- | --- |
| Phone iOS | `tv.huddle.phone` / `TARGETED_DEVICE_FAMILY=1` | passed |
| Phone Android | `tv.huddle.phone` | passed |
| Android TV | `tv.huddle.hub` | passed |
| experimental tvOS | `tv.huddle.hub` / `TARGETED_DEVICE_FAMILY=3` | generated; compile result below |

These exports completed with `EXPO_PUBLIC_CONVEX_URL` loaded from the app
`.env` files, and each bundle-seam check passed with no Trivia pack content:

```text
pnpm --filter @huddle/phone exec expo export --platform ios --output-dir /private/tmp/huddle-client-proof.EToGgL/phone-ios
pnpm --filter @huddle/phone exec expo export --platform android --output-dir /private/tmp/huddle-client-proof.EToGgL/phone-android
EXPO_TV=1 pnpm --filter @huddle/tv exec expo export --platform android --output-dir /private/tmp/huddle-client-proof.EToGgL/tv-android
pnpm verify:bundle-seam -- /private/tmp/huddle-client-proof.EToGgL/phone-ios
pnpm verify:bundle-seam -- /private/tmp/huddle-client-proof.EToGgL/phone-android
pnpm verify:bundle-seam -- /private/tmp/huddle-client-proof.EToGgL/tv-android
```

All three export commands and all three seam checks exited zero.

## Supported release artifacts

The following local release commands exited zero:

```text
xcodebuild -workspace apps/phone/ios/Huddle.xcworkspace -scheme Huddle -configuration Release -sdk iphonesimulator -destination id=1028B055-2C18-4DC1-A80C-4E092A31FC81 -derivedDataPath /private/tmp/huddle-client-proof.EToGgL/phone-ios-build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO ONLY_ACTIVE_ARCH=YES build
NODE_ENV=production ./apps/phone/android/gradlew -p apps/phone/android assembleRelease
NODE_ENV=production ./apps/tv/android/gradlew -p apps/tv/android clean assembleRelease --rerun-tasks
```

Artifact and package checks:

- Phone iOS: `/private/tmp/huddle-client-proof.EToGgL/phone-ios-build/Build/Products/Release-iphonesimulator/Huddle.app`, `CFBundleIdentifier=tv.huddle.phone`.
- Phone Android: local ignored build output at apps/phone/android/app/build/outputs/apk/release/app-release.apk, 142 MB, package `tv.huddle.phone`.
- Android TV: local ignored build output at apps/tv/android/app/build/outputs/apk/release/app-release.apk, 121 MB, package `tv.huddle.hub`.
- Android TV packaged metadata reports `leanback-launchable-activity` for
  `tv.huddle.hub.MainActivity`, required `android.software.leanback`, optional
  touchscreen/faketouch, and the TV banner/icon resources.

## Experimental tvOS result

CocoaPods installation completed and the Apple TV simulator compile was
attempted with:

```text
EXPO_TV=1 xcodebuild -workspace apps/tv/ios/Huddle.xcworkspace -scheme Huddle -configuration Release -sdk appletvsimulator -destination id=091BC127-357A-4104-8321-EE294BEF1311 -derivedDataPath /private/tmp/huddle-client-proof.EToGgL/tv-tvos-build CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO ONLY_ACTIVE_ARCH=YES build
```

The experimental compile exited 65 in the upstream `ExpoImage` pod:
`ModuleRegistry.getModule(implementing:)` is inaccessible due to `internal`
protection in the tvOS Expo Modules Core build. This is recorded as the
known experimental limitation; it does not block the supported Phone or
Android TV release artifacts.
