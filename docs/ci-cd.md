# CI/CD Pipeline

## GitHub Actions CI

The project includes a CI workflow at `.github/workflows/ci.yml` that runs on every PR and push to `main` and `dev`.

### What it checks

1. **Install** — `bun install --frozen-lockfile` (fails if lockfile is out of sync)
2. **Type check** — `tsc --noEmit` (catches type errors)
3. **Lint** — `expo lint` (enforces code style)
4. **Test** — `jest --ci --coverage --forceExit` (runs all tests with coverage)

### Local equivalents

```bash
bun run typecheck    # tsc --noEmit
bun run lint         # expo lint
bun run test:ci      # jest --ci --coverage --forceExit
```

### Concurrency

The workflow uses `cancel-in-progress: true` to prevent wasted CI minutes when multiple pushes happen in quick succession. Only the latest run for a given branch/PR is kept.

## Extending with EAS Build

To add automatic builds on main branch merges:

### 1. Add EXPO_TOKEN secret

Go to your GitHub repo Settings > Secrets > Actions and add `EXPO_TOKEN` with your Expo access token (from `expo.dev/settings/access-tokens`).

### 2. Add a build job

Add this job to `.github/workflows/ci.yml`:

```yaml
  build:
    name: EAS Build
    needs: ci
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: bun install --frozen-lockfile

      - run: eas build --platform all --profile production --non-interactive
```

### 3. Build profiles

Configure `eas.json` with different profiles:

```json
{
  "build": {
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

- Use `preview` for PR builds (internal distribution)
- Use `production` for main branch builds (store distribution)

## Bun Version

The CI uses `bun-version: latest`. To pin a specific version:

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: "1.1.0"
```
