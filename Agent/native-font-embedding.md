---
status: in-review
mode: HITL
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/198
---

# Embed Inter on native instead of loading it at startup

## Goal
Stop the kit's `useResources` from loading font files before the app is ready on iOS and Android, if a measurement shows that wait is worth removing.

## Context
- `packages/ui/src/hooks/useResources.ts` `loadNativeInterFonts()` calls `Font.loadAsync(interFontMap)` before the app reports ready. The map is in `packages/ui/src/lib/interFonts.native.ts`: `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, from `@expo-google-fonts/inter`. Apps can also pass `serifFonts`.
- `packages/ui/src/constants/fonts.ts` resolves native weights to those same names, so every kit text style uses them as `fontFamily`.
- `app.config.ts` lists the `expo-font` config plugin with no `fonts` option, so nothing is embedded today.
- The startup cost has never been measured. An audit counted nine TTFs (about 2 MB) loaded before ready in the template, and only suspected this affects startup.
- Embedded fonts are not addressed by the `loadAsync` key. iOS uses the font's PostScript name and Android the resource name, so `Inter_400Regular` may not resolve until names are mapped. Check the actual names in the TTFs.
- `useResources` is public kit API used by every consuming app. Embedding needs a native build, so it can't ship by OTA.

## Work
1. **Measure first.** On a release build on a real iOS device and a real Android device, log the time spent in `loadNativeInterFonts` and any `serifFonts` load, cold start, three runs each. Report the numbers. If the wait is under about 50 ms on the slower device, stop, say so in the PR, and delete this spec.
2. **Embed in the template.** Pass the four Inter faces (and the serif faces if the preset uses them) to the `expo-font` plugin's `fonts` option in `app.config.ts`. Prefer the plugin's Android `fontDefinitions` form if it lets the family name stay `Inter_400Regular`.
3. **Make the kit skip the load.** Add an opt-in `useResources` option, default off, so apps that haven't embedded keep today's behavior. Resolve native family names per platform in `constants/fonts.ts` only if step 1's name check requires it. Keep Expo Go and dev-client behavior working, since they can't use embedded fonts from a new config without a rebuild.
4. **Document it.** `packages/ui/README.md`, `packages/ui/CHANGELOG.md`, and `docs/template-modernization-guide.md`. Run `bun run docs:llms`.

## Validation
- `bun run verify`, `bun run pkg ui consumer-smoke`.
- Release build on a real iOS device and a real Android device: every weight renders in Inter, not a system fallback, including the serif preset; repeat step 1's measurement and report before and after.
- A consumer without the new option behaves as before.

## Exclusions
- Web fonts: already self-hosted or served from a stylesheet, and unaffected.
- Rolling this out to the apps: each app's `bundle-follow-ups` spec defers to this one, so add an app step only after this ships.
