# Contributing & Branch Strategy

## Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Stable, tested releases | 🔒 Only merge after testing |
| `develop` | Latest development code | ⚡ Active development |
| `feat/*` | New features | 🔨 Branched from `develop` |
| `fix/*` | Bug fixes | 🐛 Branched from `develop` |

## Workflow

1. **New work** → Create branch from `develop` (e.g., `feat/party-awareness`)
2. **When ready** → Merge into `develop`
3. **After testing** → Merge `develop` into `main`, tag a release

## Tags

- `v0.1.0-beta` — Initial release, pre-testing
- Future: `v0.1.0` — First stable release after user testing
