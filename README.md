# Chess Topper — Download Hub

A lightweight, responsive download website for the Chess Topper desktop app, browser extension, and Android app. The visual direction is inspired by ArtCraft's clean, editorial product-marketing layout while keeping Chess Topper's own brand identity.

## Run locally

No build tools or package installation are required.

```bash
python -m http.server 8000
```

Open http://localhost:8000.

## Release sources

The site reads public GitHub release metadata in the browser:

- **Desktop:** latest release from [Chess-topper-app](https://github.com/official-knightly/Chess-topper-app/releases/latest). Installer links are selected from the assets published with that release.
- **Android:** the `mobile-latest` release from [Chess-topper-mobile](https://github.com/official-knightly/Chess-topper-mobile/releases/tag/mobile-latest). The preferred `chess.topper.apk` asset is offered when present.
- **Browser extension:** a ZIP source archive from the `main` branch of [Chess-topper-extension](https://github.com/official-knightly/Chess-topper-extension). The extension repository currently has no tagged release, so the download is clearly presented as a source ZIP rather than a packaged store installation.

If GitHub's API is temporarily unavailable or rate-limited, the release cards fall back to the corresponding GitHub release pages.

## Deployment

This is a plain static site. It can be hosted on GitHub Pages or any static hosting provider. For GitHub Pages, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save. GitHub will show the published site URL on that page.

## Project files

- `index.html` — semantic page structure and content
- `styles.css` — responsive design system and component states
- `app.js` — GitHub release lookup, platform selection, and mobile navigation

## Accessibility and behavior

- Keyboard-accessible navigation and download links with visible focus indicators.
- A skip link and semantic landmarks/headings.
- Responsive layouts for narrow screens and touch targets.
- Reduced-motion preference support.
- Live release status announced with `aria-live`.
- No third-party analytics, account login, or data collection.

## Fair-play note

Use engine assistance only where the chess platform permits it. The mobile overlay is intended for training, puzzles, self-play, and post-game review — not assistance during live rated games.
