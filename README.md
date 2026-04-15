# Expo Template Project

A professional, feature-rich starter kit for React Native and Expo applications with pre-built UI components, internationalization, and modern development tools.

## Features

### Core
- 🎨 **Complete UI Component Library** - Buttons, inputs, alerts, popovers, toggles, accordions, dropdown menus, and more
- 🌓 **Comprehensive Theming** - Dark/light modes with system preference detection
- 📱 **Cross-Platform** - Works on iOS, Android, and Web with consistent styling
- 🧩 **File-based Routing** - Using Expo Router for simplified navigation
- 🔄 **State Management** - Zustand for lightweight global state
- 💪 **TypeScript** - Full type safety with strict mode
- 📊 **Accessibility Focus** - WCAG-compliant contrast utilities

### Infrastructure
- 🌍 **Internationalization (i18n)** - Multi-language support with expo-localization and i18next
- 🔌 **API Service Layer** - Typed fetch wrapper with error handling, works with React Query
- 💾 **Storage Utilities** - Cross-platform AsyncStorage abstraction
- ⚙️ **Environment Configuration** - Dev/prod config system with typed settings
- 🛡️ **Error Boundary** - Global error catching with user-friendly fallback UI

### Developer Experience
- 🧪 **Testing Infrastructure** - Jest + React Native Testing Library with example tests
- 🔍 **Reactotron Integration** - Advanced debugging for native platforms
- 🏗️ **Generator CLI** - Scaffold components and screens consistently
- 📝 **Custom Typography** - Font system with Lato and Merriweather

## UI Components

Built on `@rn-primitives` with full theme integration:

- **Typography** - Styled text components with custom fonts (SansSerif, Serif, Bold variants)
- **Button** - 6 variants (default, outline, ghost, link, destructive, secondary), 3 sizes, loading state
- **TextInput** - Regular, password, multiline with secure entry toggle
- **Checkbox** - Controlled component with theme-aware styling
- **Switch** - Toggle with optional labels
- **Toggle & ToggleGroup** - Single/multiple selection toggle buttons
- **Accordion** - Animated collapsible sections
- **Collapsible** - Smooth expand/collapse animations
- **Popover** - Smart positioning with portal rendering
- **DropdownMenu** - Full menu system with items, checkboxes, radio groups, sub-menus
- **Alerts & Notifications** - Centralized alert management with global state
- **Icon** - Lucide icons wrapper with theme color support

## Getting Started

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/template.git my-app
   cd my-app
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm start
   ```

4. Choose your platform
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web browser

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the Expo development server |
| `npm run ios` | Start on iOS simulator |
| `npm run android` | Start on Android emulator |
| `npm run web` | Start for web development |
| `npm run build` | Build for web |
| `npm test` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run generate component <Name>` | Generate a new component |
| `npm run generate screen <Name>` | Generate a new screen |

### Generator CLI

Quickly scaffold new components or screens:

```bash
# Generate a component
npm run generate component MyButton

# Generate a screen
npm run generate screen Settings
```

Generated files follow project patterns with proper theming and TypeScript.

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test -- --watchAll=false

# Run with coverage
npm test -- --coverage --watchAll=false
```

### Reactotron Debugging

For native development:
1. Install [Reactotron](https://github.com/infinitered/reactotron/releases)
2. Run the app in development mode
3. Reactotron auto-connects to show network requests, AsyncStorage, and logs

## Architecture

```
/app                          # File-based routing (Expo Router)
  ├── _layout.tsx             # Root layout with providers
  ├── index.tsx               # Entry redirect
  └── (main)/                 # Main app routes
      ├── (tabs)/             # Tab navigation (home, profile, settings)
      └── showcase.tsx        # Component showcase

/client
  ├── components/ui/          # Reusable UI components
  │   └── __tests__/          # Component tests
  ├── config/                 # Environment configuration
  ├── constants/              # Design tokens (colors, spacing, fonts)
  ├── devtools/               # Reactotron configuration
  ├── hooks/                  # Custom React hooks
  ├── i18n/                   # Internationalization
  ├── screens/                # Screen components (ErrorScreen)
  ├── services/api/           # API client and types
  ├── stores/                 # Zustand state stores
  └── utils/storage/          # AsyncStorage utilities

/scripts                      # CLI tools (generator)
/test                         # Test setup and utilities
```

## Internationalization

Multi-language support with type-safe translation keys:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <Text>{t('common.ok')}</Text>;
}

// Or with the tx prop on Text components
<Text tx="common.ok" />
```

Add new languages in `/client/i18n/`.

## API Service

Typed API client with error handling:

```tsx
import { api } from '@/client/lib/api/apiClient';

// Make requests
const result = await api.get<User>('/users/me');

if (result.kind === 'ok') {
  console.log(result.data);
} else {
  console.error(result.kind); // 'timeout', 'unauthorized', etc.
}

// Set auth token if needed
api.setAuthToken(token);
```

Works seamlessly with React Query for caching and state management.

## Configuration

Environment-based configuration in `/client/config/`:

```tsx
import Config from '@/client/config';

console.log(Config.apiUrl);        // API base URL
console.log(Config.catchErrors);   // Error catching mode
```

## Theming

Access theme anywhere with the `useTheme` hook:

```tsx
import { useTheme } from '@/client/hooks/useTheme';
import { spacing } from '@/client/constants/spacing';

function MyComponent() {
  const { theme, scheme, getShadowStyle, getContrastingColor } = useTheme();

  return (
    <View style={[
      { backgroundColor: theme.colors.bgPrimary },
      getShadowStyle('base')
    ]}>
      <Text style={{ color: theme.colors.textPrimary }}>
        Current theme: {scheme}
      </Text>
    </View>
  );
}
```

## Billing (Stripe, hosted-external)

The template ships with a hosted Stripe subscription integration off by
default. To turn it on:

```bash
# .env
EXPO_PUBLIC_BILLING_ENABLED=true
EXPO_PUBLIC_APP_URL=http://localhost:8081
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...             # from `stripe listen`
STRIPE_PRICE_ID_PRO_MONTH=price_...
STRIPE_PRICE_ID_PRO_YEAR=price_...
```

Then forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Full walkthrough (products, prices, disabling cleanly) lives in
[`Agent/Docs/BILLING.md`](./Agent/Docs/BILLING.md). Without Stripe env
vars the `/api/billing/*` routes return a typed `503 billing-disabled`
and the UI hides purchase CTAs — no Stripe traffic is ever generated.

## Special Features

- **Cross-platform shadows** - Consistent shadows across all platforms
- **Smart contrast detection** - Automatically choose appropriate text colors
- **Responsive layouts** - Adapts to different screen sizes
- **RTL support** - Right-to-left layout support for i18n
- **Error boundaries** - Graceful error handling with recovery
- **Keyboard handling** - Smart keyboard avoidance and management

## Tech Stack

- **Expo SDK 55** - Latest Expo features
- **React Native 0.83** - Core framework
- **React 19** - Latest React with compiler optimizations
- **TypeScript** - Type safety
- **Expo Router v6** - File-based navigation
- **Zustand** - State management
- **React Query** - Server state management
- **i18next** - Internationalization
- **Jest** - Testing framework
- **@rn-primitives** - Accessible UI primitives
- **Lucide Icons** - Icon library

## IDE Setup

This project includes VSCode workspace settings in `.vscode/`. Open the project in VSCode and accept the recommended extensions prompt for the best experience.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and PR guidelines.

## License

MIT
