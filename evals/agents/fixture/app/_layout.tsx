import { Stack, ThemeProvider } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { UIProvider } from "@mrmeg/expo-ui/components";
import { registerIcons } from "@mrmeg/expo-ui/components/Icon";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { appIcons } from "@/client/icons.generated";

// Makes the icons in client/icons.json drawable by name.
registerIcons(appIcons);

const queryClient = new QueryClient();

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded } = useResources();

  if (!loaded) return null;

  return (
    <ThemeProvider
      value={{
        dark: colors[scheme ?? "light"].dark,
        colors: colors[scheme ?? "light"].navigation,
        fonts: colors[scheme ?? "light"].fonts,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <UIProvider>
            <Stack />
          </UIProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
