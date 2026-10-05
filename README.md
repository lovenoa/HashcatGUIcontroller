# Hashcat Studio

Learning-first desktop UI for hashcat. The application configures and runs the local hashcat executable without reimplementing hashcat algorithms.

## Requirements

- Windows 10/11 x64
- Node.js 24+
- Rust stable
- Tauri 2 prerequisites / WebView2
- hashcat 7.1.2 binary package in `hashcat-7.1.2-binaries/`

## Development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` for the browser preview. Browser preview validates configuration and commands but does not start hashcat.

For the desktop application:

```powershell
npm run tauri dev
```

## Release

```powershell
npm run release:check
npm run release:build
```

`release:check` runs tests, frontend production build, Rust Clippy with warnings denied, and release configuration checks.
`release:build` creates the Windows NSIS installer in `src-tauri/target/release/bundle/nsis/`.

## Checks

```powershell
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

`npm run generate:catalog` rebuilds the 582-mode catalog from the bundled hashcat documentation and `--hash-info` output.

## Current Scope

- Hash target input and algorithm catalog
- Attack modes `0`, `1`, `3`, `6`, `7`, and `9`
- Wordlist, rule, mask, Markov, output, device, session, Brain, Bridge, and risk settings
- Live command generation and command-line import
- Runtime capability probing and process-control Tauri commands
- Short hover guidance with expandable detail

Task drafts and exports omit pasted hashes and Brain passwords. SQLite history remains a future enhancement; current run history is stored locally in the webview.
