import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, ThemeProvider, useRouter } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { createEntitlementStore, createPurchases, PurchasesProvider } from "@mrmeg/expo-purchases";
import { UIProvider } from "@mrmeg/expo-ui/components";
import { registerIcons } from "@mrmeg/expo-ui/components/Icon";
import { colors } from "@mrmeg/expo-ui/constants";
import { useResources, useTheme } from "@mrmeg/expo-ui/hooks";
import { useAuth } from "@/client/auth";
import { appIcons } from "@/client/icons.generated";

// Makes the icons in client/icons.json drawable by name.
registerIcons(appIcons);

const queryClient = new QueryClient();

const purchases = createPurchases({
  entitlement: "pro",
  iosKey: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  androidKey: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  onError: (error, context) => console.warn("purchases", context, error),
});
const entitlementStore = createEntitlementStore({ storage: AsyncStorage });

export default function RootLayout() {
  const { scheme } = useTheme();
  const { loaded } = useResources();
  const { userId } = useAuth();
  const router = useRouter();

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
            <PurchasesProvider
              client={purchases}
              store={entitlementStore}
              userId={userId}
              serverUntil={null}
              onBlocked={() => router.push("/pro-report")}
            >
              <Stack />
            </PurchasesProvider>
          </UIProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
