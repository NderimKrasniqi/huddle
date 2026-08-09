# Huddle Design System — Expo Phone + TV

Huddle uses one shared visual language across **two Expo/React Native applications**:

- **Phone app** — the personal controller used by host and players.
- **TV app** — the shared room/game stage designed for viewing from across a room.

This package intentionally has **no NativeWind/Tailwind dependency**. The design tokens are plain JSON and TypeScript and can be consumed directly by Expo/React Native components.

## 1. Approved brand palette

These values are the exact approved Huddle brand colors and are the source of truth.

| Token | Hex | Primary use |
|---|---|---|
| `brand.orange` | `#FF6B4A` | Huddle symbol, primary actions, selected/focused states |
| `brand.softPeach` | `#FFE9DE` | Soft accent surfaces and avatar wells |
| `brand.warmOffWhite` | `#FFF7F2` | Main app canvas |
| `brand.deepNavy` | `#0F172A` | Primary text, headings, icons, wordmark |
| `brand.sage` | `#A7B3A6` | Decorative/supporting accent |
| `brand.warmGrey` | `#E9E6E2` | Borders, dividers, inactive surfaces |

The approved direction is **Soft Minimal**: warm off-white canvases, deep navy typography, restrained orange emphasis, rounded geometry, subtle shadows, and quiet sage/peach decoration.

## 2. Shared vs platform-specific system

Use `expo/base-theme.ts` for values that should stay visually consistent across both applications:

- brand and semantic colors
- spacing scale
- corner radii
- border treatment
- avatar/game-art rules

Use `expo/phone-theme.ts` for phone-specific sizing and interaction defaults.

Use `expo/tv-theme.ts` for TV-specific sizing, safe margins, focus treatment, and distance-readable typography.

Do **not** use one universal screen scale for both apps. The TV is not a stretched phone UI.

## 3. Phone app rules

The phone is an interactive controller, so optimize for touch, density, and private information.

- Default content padding: `24`.
- Interactive controls should generally be at least `48` high.
- Keep room-code entry, avatar selection, answers, voting, and host controls easy to reach.
- Primary CTA uses Huddle Orange with white foreground.
- Use compact labels and clear state feedback.
- Respect phone safe areas through Expo Router/native screen structure.
- Private player information belongs here, not on the TV.

## 4. TV app rules

The TV is a **display-first shared stage**, not a large touch interface.

- Use substantially larger type and spacing than the phone app.
- Keep important content inside a generous safe margin (`64` implementation baseline).
- Prefer large, simple compositions readable from across a room.
- Avoid dense phone-style lists and tiny chips.
- Focused items must be visually unmistakable when remote/D-pad navigation is used.
- Default TV focus uses Huddle Orange, a visible focus border, and a subtle scale lift.
- The center of the screen should stay visually clear; decoration belongs near edges.
- The TV must never expose private information belonging to one player.

## 5. Typography

The final approved UI uses a clean, friendly sans-serif. The exact production font family was not locked as part of the visual approval, so the token files use the **platform system sans-serif by default** rather than introducing a font dependency.

The Huddle wordmark should use supplied brand artwork instead of being recreated from a text font.

### Phone baseline

- Screen title: `32/40`, bold
- Heading: `24/32`, bold
- Body: `16/24`
- Label: `13/18`, semibold
- Caption: `12/16`

### TV baseline

- Display: `56/64`, bold
- Heading: `40/48`, bold
- Body: `22/30`
- Label: `18/24`, semibold
- Caption: `16/22`

These measurements are implementation baselines inferred from the approved layouts, not additional brand identity rules.

## 6. Spacing

Shared rhythm:

`4, 8, 12, 16, 24, 32, 40, 48, 64, 80`

Phone layouts may use the lower/middle part of the scale more heavily. TV layouts should use the larger values generously.

## 7. Radius

- Small UI/chips: `8–12`
- Inputs/buttons: `12–16`
- Cards/sheets: `18–24`
- Pills: `999`
- Circular avatars: true circle with **no white border**

## 8. Buttons and focus

### Phone primary action

- Background: `#FF6B4A`
- Foreground: white
- Minimum height: `48`
- Pressed state should darken slightly or use a subtle transform/opacity response.

### TV focused action/card

- Orange focus border
- Small scale lift (implementation baseline `1.04`)
- Do not depend on scale alone; focused state must remain obvious at a distance.
- Keep focus treatment consistent across game cards and TV actions.

## 9. Avatars

Production avatar rules are strict:

1. One character per image.
2. Each character has a square asset whose full background belongs to that character's color family.
3. Each character has a circular asset.
4. Circular assets have no white border.
5. Square assets are suitable for phone avatar pickers/cards.
6. Circular assets are suitable for player presence rows and TV player strips.

## 10. Game art

- Full-bleed artwork; never add white side gutters.
- Individual games may have distinct colors while sharing the polished Huddle illustration language.
- Keep reusable artwork separate from dynamic UI text when possible.
- TV carousel: focused game is large and dominant; neighboring cards are smaller previews.
- Phone game picker may use the same artwork in a denser presentation.

## 11. Backgrounds

The approved TV background is quiet and low contrast:

- warm off-white base
- subtle soft shapes
- plants/decorative elements near edges
- clear central content zone

Do not place decorative elements where they compete with QR codes, room codes, players, game cards, or gameplay state.

## 12. Status language

Visual conventions from the approved UI:

- Host: orange + crown
- Online/connected: green indicator
- Just joined: blue informational pill
- Away/inactive: neutral grey
- Selected/focused: orange

The exact non-brand semantic green/blue hex values are implementation values, not approved Huddle brand colors.

## 13. Expo implementation

Recommended organization if the two Expo apps share a workspace:

```text
apps/
  phone/
  tv/
packages/
  design-system/
    base-theme.ts
    phone-theme.ts
    tv-theme.ts
```

The package does not require this exact folder structure; the important rule is that both apps import the same base brand tokens while applying their own platform scale.

Use ordinary React Native/Expo styling. The examples use style objects and `StyleSheet`; no CSS/Tailwind layer is assumed.

## 14. Reference hierarchy

When sources conflict, use this order:

1. `brand/huddle-brand-guide.png` — exact identity and approved core palette.
2. `design-system/reference/huddle-soft-minimal-ui-board.png` — final Soft Minimal phone/TV UI direction.
3. Production imagery in `avatars/`, `game-art/`, `app-icons/`, and `tv-backgrounds/`.
4. `tokens.json` and `expo/*.ts` — normalized implementation tokens.

Older dark/purple Huddle explorations are not part of the current visual system.
