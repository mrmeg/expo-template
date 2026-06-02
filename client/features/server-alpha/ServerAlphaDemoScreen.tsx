import { useCallback, useMemo, useReducer } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLoaderData } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrmeg/expo-ui/components/Card";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import {
  SansSerifBoldText,
  SansSerifText,
} from "@mrmeg/expo-ui/components/StyledText";
import { Seo } from "@/client/components/Seo";
import type { Theme } from "@mrmeg/expo-ui/constants";
import { serverAlphaLoader } from "@/client/features/server-alpha/loaders";
import type { TemplateServerCatalog } from "@/server/api/template/examples";
import type { TemplateServerStatus } from "@/server/api/template/status";

type TemplateEchoResponse = {
  body: unknown;
  echoedAt: string;
  status: TemplateServerStatus;
};

type ApiDemoState = {
  apiStatus: TemplateServerStatus | null;
  apiCatalog: TemplateServerCatalog | null;
  echoResult: TemplateEchoResponse | null;
  apiLoading: boolean;
  catalogLoading: boolean;
  echoLoading: boolean;
};

type ApiDemoAction =
  | { type: "apiStatusLoading"; loading: boolean }
  | { type: "apiStatusLoaded"; apiStatus: TemplateServerStatus }
  | { type: "apiCatalogLoading"; loading: boolean }
  | { type: "apiCatalogLoaded"; apiCatalog: TemplateServerCatalog }
  | { type: "echoLoading"; loading: boolean }
  | { type: "echoLoaded"; echoResult: TemplateEchoResponse };

const INITIAL_API_DEMO_STATE: ApiDemoState = {
  apiStatus: null,
  apiCatalog: null,
  echoResult: null,
  apiLoading: false,
  catalogLoading: false,
  echoLoading: false,
};

function apiDemoReducer(state: ApiDemoState, action: ApiDemoAction): ApiDemoState {
  switch (action.type) {
  case "apiStatusLoading":
    return { ...state, apiLoading: action.loading };
  case "apiStatusLoaded":
    return { ...state, apiStatus: action.apiStatus, apiLoading: false };
  case "apiCatalogLoading":
    return { ...state, catalogLoading: action.loading };
  case "apiCatalogLoaded":
    return { ...state, apiCatalog: action.apiCatalog, catalogLoading: false };
  case "echoLoading":
    return { ...state, echoLoading: action.loading };
  case "echoLoaded":
    return { ...state, echoResult: action.echoResult, echoLoading: false };
  }
}

export default function ServerAlphaDemo() {
  const catalog = useLoaderData<typeof serverAlphaLoader>();
  const { status, examples } = catalog;
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [apiDemo, dispatchApiDemo] = useReducer(
    apiDemoReducer,
    INITIAL_API_DEMO_STATE
  );
  const {
    apiStatus,
    apiCatalog,
    echoResult,
    apiLoading,
    catalogLoading,
    echoLoading,
  } = apiDemo;

  const refreshApiStatus = useCallback(async () => {
    if (Platform.OS !== "web") {
      return;
    }

    dispatchApiDemo({ type: "apiStatusLoading", loading: true });
    try {
      const response = await fetch("/api/template/status");
      dispatchApiDemo({
        type: "apiStatusLoaded",
        apiStatus: (await response.json()) as TemplateServerStatus,
      });
    } finally {
      dispatchApiDemo({ type: "apiStatusLoading", loading: false });
    }
  }, []);

  const refreshApiCatalog = useCallback(async () => {
    if (Platform.OS !== "web") {
      return;
    }

    dispatchApiDemo({ type: "apiCatalogLoading", loading: true });
    try {
      const response = await fetch("/api/template/examples");
      dispatchApiDemo({
        type: "apiCatalogLoaded",
        apiCatalog: (await response.json()) as TemplateServerCatalog,
      });
    } finally {
      dispatchApiDemo({ type: "apiCatalogLoading", loading: false });
    }
  }, []);

  const postEchoSample = useCallback(async () => {
    if (Platform.OS !== "web") {
      return;
    }

    dispatchApiDemo({ type: "echoLoading", loading: true });
    try {
      const response = await fetch("/api/template/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ui-demo",
          exampleCount: examples.length,
          source: "server-alpha-screen",
        }),
      });
      dispatchApiDemo({
        type: "echoLoaded",
        echoResult: (await response.json()) as TemplateEchoResponse,
      });
    } finally {
      dispatchApiDemo({ type: "echoLoading", loading: false });
    }
  }, [examples.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Seo
        title="Expo Router Server Alpha - Expo Template"
        description="A template baseline for Expo Router server rendering, middleware, data loaders, and API routes."
      />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="server" color={theme.colors.primaryForeground} size={24} />
        </View>
        <View style={styles.heroText}>
          <SansSerifBoldText style={styles.title}>
            Expo Router Server Alpha
          </SansSerifBoldText>
          <SansSerifText style={styles.subtitle}>
            SSR, API routes, data loaders, and middleware are enabled for new projects.
          </SansSerifText>
        </View>
      </View>

      <View style={styles.badges}>
        <Badge variant="outline" text="server output" />
        <Badge variant="outline" text="loader data" />
        <Badge variant="outline" text="API middleware" />
        <Badge variant="outline" text="dynamic routes" />
      </View>

      <Card variant="outline" style={styles.card}>
        <CardHeader>
          <CardTitle>Overview Loader</CardTitle>
        </CardHeader>
        <CardContent style={styles.rows}>
          <InfoRow label="Served at" value={status.servedAt} />
          <InfoRow label="Mode" value={status.runtime.mode} />
          <InfoRow label="Request path" value={status.request.path ?? "(static export)"} />
          <InfoRow label="Runtime origin" value={status.runtime.origin ?? "(not provided)"} />
          <InfoRow label="Environment" value={status.runtime.environment ?? "(default)"} />
        </CardContent>
      </Card>

      <Card variant="outline" style={styles.card}>
        <CardHeader>
          <CardTitle>Patterns</CardTitle>
        </CardHeader>
        <CardContent style={styles.patternList}>
          {examples.map((example) => (
            <Pressable
              key={example.id}
              onPress={() => router.push(example.route as never)}
              style={styles.patternRow}
            >
              <View style={styles.patternIcon}>
                <Icon name="arrow-right" color={theme.colors.primary} size={16} />
              </View>
              <View style={styles.patternText}>
                <SansSerifBoldText style={styles.patternTitle}>
                  {example.label}
                </SansSerifBoldText>
                <SansSerifText style={styles.patternDescription}>
                  {example.pattern}
                </SansSerifText>
              </View>
            </Pressable>
          ))}
        </CardContent>
      </Card>

      <Card variant="outline" style={styles.card}>
        <CardHeader>
          <CardTitle>Matching API Routes</CardTitle>
        </CardHeader>
        <CardContent style={styles.rows}>
          <InfoRow label="Endpoint" value="/api/template/status" />
          <InfoRow label="Catalog endpoint" value="/api/template/examples" />
          <InfoRow label="POST endpoint" value="/api/template/echo" />
          <InfoRow label="Middleware header" value="X-Expo-Router-Middleware: 1" />
          <InfoRow label="Caching" value="Cache-Control: no-store" />
          <View style={styles.apiActions}>
            <Button
              preset="outline"
              size="sm"
              onPress={refreshApiStatus}
              disabled={apiLoading || Platform.OS !== "web"}
              style={styles.actionButton}
            >
              <Icon name="refresh-cw" color={theme.colors.primary} size={14} />
              <SansSerifText style={styles.actionText}>
                {apiLoading ? " Refreshing" : " Refresh status"}
              </SansSerifText>
            </Button>
            <Button
              preset="outline"
              size="sm"
              onPress={refreshApiCatalog}
              disabled={catalogLoading || Platform.OS !== "web"}
              style={styles.actionButton}
            >
              <Icon name="list" color={theme.colors.primary} size={14} />
              <SansSerifText style={styles.actionText}>
                {catalogLoading ? " Loading" : " Load catalog"}
              </SansSerifText>
            </Button>
            <Button
              preset="outline"
              size="sm"
              onPress={postEchoSample}
              disabled={echoLoading || Platform.OS !== "web"}
              style={styles.actionButton}
            >
              <Icon name="send" color={theme.colors.primary} size={14} />
              <SansSerifText style={styles.actionText}>
                {echoLoading ? " Posting" : " POST echo"}
              </SansSerifText>
            </Button>
          </View>
          {apiStatus ? (
            <InfoRow label="Client fetched" value={apiStatus.servedAt} />
          ) : null}
          {apiCatalog ? (
            <InfoRow
              label="Catalog fetched"
              value={`${apiCatalog.examples.length} patterns at ${apiCatalog.generatedAt}`}
            />
          ) : null}
          {echoResult ? (
            <InfoRow
              label="Echo response"
              value={`${echoResult.echoedAt}: ${JSON.stringify(echoResult.body)}`}
            />
          ) : null}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <SansSerifText style={styles.rowLabel}>{label}</SansSerifText>
      <SansSerifText style={styles.rowValue}>{value}</SansSerifText>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      gap: spacing.md,
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    hero: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      borderRadius: spacing.radiusMd,
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    heroText: {
      flex: 1,
      gap: spacing.xxs,
    },
    title: {
      color: theme.colors.foreground,
      fontSize: 22,
    },
    subtitle: {
      color: theme.colors.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.card,
    },
    rows: {
      gap: spacing.sm,
    },
    patternList: {
      gap: spacing.xs,
    },
    patternRow: {
      alignItems: "center",
      borderColor: theme.colors.border,
      borderRadius: spacing.radiusMd,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    patternIcon: {
      alignItems: "center",
      backgroundColor: theme.colors.muted,
      borderRadius: 16,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    patternText: {
      flex: 1,
      gap: spacing.xxs,
    },
    patternTitle: {
      color: theme.colors.foreground,
      fontSize: 14,
    },
    patternDescription: {
      color: theme.colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    apiActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    actionButton: {
      alignSelf: "flex-start",
    },
    actionText: {
      color: theme.colors.primary,
      fontSize: 13,
    },
    row: {
      borderBottomColor: theme.colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.xxs,
      paddingBottom: spacing.sm,
    },
    rowLabel: {
      color: theme.colors.mutedForeground,
      fontSize: 12,
      textTransform: "uppercase",
    },
    rowValue: {
      color: theme.colors.foreground,
      fontSize: 14,
      lineHeight: 20,
    },
  });
