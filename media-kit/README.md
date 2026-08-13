# Classfully media kit

This folder contains production-ready Classfully brand assets for product listings, press, social profiles, presentations, and launch placements.

## Quick picks

| Need | File | Size |
|---|---|---:|
| Primary logo | `logos/classfully-lockup-color.svg` | Vector |
| Square brand mark | `logos/classfully-mark-color-2048.png` | 2048 × 2048 |
| App/store icon master | `logos/classfully-app-icon-1024.png` | 1024 × 1024 |
| LinkedIn / X profile image | `logos/classfully-profile-400.png` | 400 × 400 |
| Apple app icon, no alpha | `logos/classfully-apple-app-icon-1024.png` | 1024 × 1024 |
| Google Play icon | `logos/classfully-google-play-icon-512.png` | 512 × 512 |
| Universal presentation/video banner | `banners/classfully-master-16x9-3840x2160.png` | 3840 × 2160 |
| LinkedIn company cover | `banners/classfully-linkedin-cover-4200x700.png` | 4200 × 700 |
| X header | `banners/classfully-x-header-1500x500.png` | 1500 × 500 |
| YouTube channel art | `banners/classfully-youtube-channel-2560x1440.png` | 2560 × 1440 |
| Link preview / Open Graph | `social/classfully-open-graph-1200x630.png` | 1200 × 630 |
| Square social post | `social/classfully-square-2160x2160.png` | 2160 × 2160 |
| Portrait feed post | `social/classfully-portrait-2160x2700.png` | 2160 × 2700 |
| Vertical story / reel cover | `social/classfully-story-2160x3840.png` | 2160 × 3840 |
| Google Play feature graphic | `store/classfully-google-play-feature-1024x500.png` | 1024 × 500 |
| Product listing gallery image | `store/classfully-listing-gallery-1600x900.png` | 1600 × 900 |

PNG exports are rendered at their final placement dimensions. SVG logo files remain the preferred source for print, large-format use, and future resizing.

`asset-manifest.json` records the exact pixel dimensions, format, alpha state, and file size of every distributable asset.

## Brand foundation

- Primary ink: `#101A38`
- Classfully violet: `#5146E5`
- Warm paper: `#FFFEFA`
- Arrival coral: `#DF664E`
- Muted text: `#697087`
- Display typography: Fraunces in-product; Georgia is used as the portable media-kit fallback
- Interface typography: Inter in-product; Arial/system sans is used as the portable fallback

The visual motif represents individual student responses arriving into a shared classroom signal. Indigo carries the participation field. Coral is reserved for one meaningful arrival or emphasis point.

## Usage guidance

- Keep at least one mark-height of clear space around the logo.
- Use the color lockup on warm paper or white.
- Use the reversed lockup only on deep navy.
- Keep important copy inside the center safe area on banners because platforms crop differently by device.
- Do not recolor individual parts of the mark, add shadows, stretch it, or place it over visually busy texture.
- Do not add decorative gradients. The response field already supplies the brand texture.
- Use the 16:9 master when a listing does not publish a specific requirement.

## Current placement references

The exports cover the dimensions most commonly requested by current social, video, and app-store surfaces:

- LinkedIn Page logo 400 × 400 and Page cover 4200 × 700: <https://www.linkedin.com/help/recruiter/answer/a569383>
- X profile 400 × 400 and header 1500 × 500: <https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo>
- YouTube channel art 2560 × 1440, with important content kept in the centered safe area: <https://support.google.com/youtube/answer/10456525>
- Google Play icon 512 × 512 and feature graphic 1024 × 500: <https://support.google.com/googleplay/android-developer/answer/9866151?hl=en>
- Apple product screenshot specifications change by device family and should be generated from current product captures when a native listing is prepared: <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/>

Always check the destination immediately before a major launch. Platform crop behavior and file-size limits can change even when the aspect ratio remains stable.

## Regenerating exports

The logo and layout exports are deterministic. From the application root, run:

```bash
node scripts/build-media-kit.mjs
```

The two response-field source images are retained under `source/`. They were generated as text-free brand artwork, then the exact Classfully mark and copy were applied separately to keep the identity crisp and accurate.
