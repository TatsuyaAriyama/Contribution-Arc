# Contribution Arc

Contribution Arc is a quiet developer workspace built with React, TypeScript, Vite, and Electron.

## Development

```bash
npm install
npm run dev
```

## Electron

Run the desktop app in development mode:

```bash
npm run electron
```

Build the Mac app:

```bash
npm run electron:build
```

Build the Windows installer:

```bash
npm run electron:build:win
```

The Windows build uses Electron Builder with the NSIS target and outputs to `release/`.
The installer artifact is named:

```text
Contribution-Arc-Setup-${version}.exe
```

Windows icon assets live at:

```text
build/icons/icon.ico
```

This keeps Mac `.dmg` / `.zip` and Windows `.exe` artifacts ready to attach to future GitHub Releases.
