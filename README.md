# Expo Template Project

A feature-rich starter kit for React Native and Expo applications with pre-built UI components, theming, and modern development tools.

## Features

- 🎨 **Complete UI Component Library** - Buttons, inputs, alerts, popovers, toggles, and more
- 🌓 **Comprehensive Theming** - Dark/light modes with system preference detection
- 📱 **Cross-Platform** - Works on iOS, Android, and Web with consistent styling
- 🧩 **File-based Routing** - Using Expo Router for simplified navigation
- 🔄 **State Management** - Zustand for lightweight global state
- 💪 **TypeScript** - Full type safety with strict mode
- 📊 **Accessibility Focus** - WCAG-compliant contrast utilities
- 📝 **Custom Typography** - Font system with Lato and Merriweather

## UI Components

- **Typography** - Styled text components with custom fonts (SansSerif, Serif, Bold variants)
- **Buttons** - Declarative children pattern with multiple variants (default, primary, outline)
- **Text Inputs** - Regular, password, multiline with secure entry toggle
- **Alerts & Notifications** - Centralized alert management with global state
- **Popovers** - Context-based system with smart positioning and arrow support
- **Toggle Switches** - With optional custom labels and theming
- **Scroll Views** - Enhanced scrolling with keyboard handling

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

- `npm start` - Start the Expo development server
- `npm run ios` - Start on iOS simulator
- `npm run android` - Start on Android emulator
- `npm run web` - Start for web development
- `npm run build` - Build for web
- `npm test` - Run tests in watch mode
- `npm run lint` - Run ESLint

## Architecture

- `/app` - Application screens using file-based routing
  - `index.tsx` - Main showcase page for all UI components
  - `popover-test.tsx` - Dedicated popover testing page
- `/components/ui` - Reusable UI components with TypeScript
- `/constants` - Design tokens and theme configuration
- `/hooks` - Custom React hooks (theme, etc.)
- `/stores` - Global state management with Zustand
- `/assets` - Fonts and images

## Special Features

- **Cross-platform shadows** - Consistent shadows across all platforms
- **Smart contrast detection** - Automatically choose appropriate text colors
- **Responsive layouts** - Adapts to different screen sizes
- **Centralized UI notifications** - Global alert and notification system
- **Declarative component patterns** - Modern React component design
- **Context-based popovers** - Flexible popover system with hooks
- **Comprehensive theming** - Dark/light mode with system detection

## License

MIT