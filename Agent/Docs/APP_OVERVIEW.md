# App Overview

A **production-ready Expo template** for building cross-platform mobile and web applications. Not a specific product — a starting point with best practices baked in.

## What This Template Provides

### UI Component Library (35 components)
Shadcn/ui-inspired design system with zinc palette, border-driven aesthetic, and WCAG contrast compliance. Includes: Button, TextInput, Dialog, Tabs, Select, RadioGroup, Progress, Slider, InputOTP, Card, Checkbox, Switch, Toggle, Accordion, BottomSheet, Drawer, DropdownMenu, Popover, Tooltip, Badge, Skeleton, EmptyState, and more.

### Screen Templates (13 templates)
Pre-built, configurable screen layouts: Settings, Profile, List, Pricing, Welcome, CardGrid, Chat, Dashboard, Form (multi-step wizard), NotificationList, SearchResults, Error (5 variants), DetailHero.

### Feature Modules (7 features)
Self-contained, copy-portable features: Auth (Cognito), Media (R2/S3 upload/compress), i18n (en/es with RTL), Notifications (global toast), Onboarding (carousel), Keyboard handling, Web navigation.

### Form System
react-hook-form + zod adapters wrapping existing UI components: FormTextInput, FormCheckbox, FormSwitch, FormSelect. Multi-step FormScreen template with per-step validation.

### Developer Experience
- Generator CLI: `npx tsx scripts/generate.ts component|screen|hook|form <Name>`
- VSCode workspace settings + recommended extensions
- CONTRIBUTING.md with code style, git workflow, PR checklist
- GitHub Actions CI (typecheck, lint, test)
- Bundle size analysis with 10% budget threshold
- Sentry error tracking (zero-impact without DSN)
- Reactotron for dev debugging

## Platform Support

| Platform | Status |
|----------|--------|
| iOS | Full support (new architecture) |
| Android | Full support (new architecture) |
| Web | Full support (async routes, SEO meta tags) |

## Key Architectural Decisions

1. **Feature folder isolation** — features never import from other features
2. **Two API clients** — typed discriminated unions (apiClient) + Amplify-aware (authenticatedFetch)
3. **Platform-aware storage** — AsyncStorage (native) / localStorage (web) via Platform.OS checks
4. **Reanimated for all animations** — consistent reduced motion support
5. **@rn-primitives** — accessible, unstyled primitives styled in-house
6. **Environment validation** — fails fast with clear errors on missing env vars
