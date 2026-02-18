# Mission Control - Tauri macOS App

This wraps the Mission Control Node.js dashboard in a native macOS app using Tauri.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Rust** (install via [rustup](https://rustup.rs/))
3. **Xcode Command Line Tools** (for macOS development)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Xcode Command Line Tools
xcode-select --install
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Tauri CLI:
```bash
npm install -g @tauri-apps/cli
# OR use npx
npx @tauri-apps/cli --version
```

## Development

Run the app in development mode (with hot reload):

```bash
npm run tauri:dev
```

This will:
1. Start the Node.js server
2. Launch the Tauri window
3. Load the app from `http://localhost:1337`

## Building for macOS

Build the production app:

```bash
npm run tauri:build
```

This creates:
- **`.dmg`** installer in `src-tauri/target/release/bundle/dmg/`
- **`.app`** bundle in `src-tauri/target/release/bundle/macos/`

## Installing

### Option 1: DMG Installer
1. Open `src-tauri/target/release/bundle/dmg/Mission-Control_1.0.0_x64.dmg`
2. Drag "Mission Control" to your Applications folder

### Option 2: App Bundle
1. Copy `src-tauri/target/release/bundle/macos/Mission Control.app` to your Applications folder
2. First launch: Right-click the app → "Open" (to bypass Gatekeeper)

## Features

- **System Tray**: App runs in the menu bar - click the icon to show/hide
- **Auto-start Server**: Node.js server starts automatically when the app launches
- **Window Management**: 
  - Close button hides to tray (doesn't quit)
  - Quit via system tray menu

## Customizing Icons

Replace the placeholder icons in `src-tauri/icons/`:
- `icon.icns` - macOS app icon (use [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html))
- `icon.ico` - Windows icon
- `icon.png` - Linux/system tray icon (512x512 recommended)
- `32x32.png`, `128x128.png`, `128x128@2x.png` - Various sizes

To generate icons from a single PNG:
```bash
npm install -g @tauri-apps/cli
npx @tauri-apps/cli icon /path/to/your/icon.png
```

## Troubleshooting

### "App is damaged" error
Run this to bypass Gatekeeper:
```bash
xattr -cr "/Applications/Mission Control.app"
```

### Server doesn't start
Check that Node.js is in your PATH:
```bash
which node
node --version
```

### Build fails
1. Make sure Rust is up to date:
```bash
rustup update
```

2. Clean and rebuild:
```bash
cargo clean --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

## Architecture

The Tauri app works by:
1. Starting the Node.js server as a subprocess
2. Loading `http://localhost:1337` in a WebView
3. Providing native features (system tray, window management)

The Node.js server runs the same as the standalone version - all your config, database, etc. work the same way.
