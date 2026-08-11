import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { spacing } from "@mrmeg/expo-ui/constants";
import { Badge } from "@mrmeg/expo-ui/components/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@mrmeg/expo-ui/components/Card";
import { Icon } from "@mrmeg/expo-ui/components/Icon";
import {
  SansSerifBoldText,
  SansSerifText,
} from "@mrmeg/expo-ui/components/StyledText";
import { Seo } from "@/client/components/Seo";
import type { Theme } from "@mrmeg/expo-ui/constants";
import type { TemplateServerCatalog } from "@/server/api/template/examples";

const CATALOG_ENDPOINT = "/api/template/examples";

/**
 * This route has no loader on purpose. `expo export` runs loaders once at build
 * time and keys the payload by file path, so a param'd route's snapshot lands at
 * `_expo/loaders/.../[example]` while the browser asks for the substituted path
 * and gets a 404. Route params therefore drive a client fetch of the API route
 * that exposes the same catalog.
 */
type CatalogState =
  | { phase: "native" }
  | { phase: "loading" }
  | { phase: "ready"; catalog: TemplateServerCatalog }
  | { phase: "failed"; message: string };

export default function ServerAlphaExampleScreen() {
  const params = useLocalSearchParams<{ example?: string | string[] }>();
  const requestedExample = Array.isArray(params.example)
    ? params.example[0]
    : params.example ?? null;
  const [state, setState] = useState<CatalogState>(() =>
    Platform.OS === "web" ? { phase: "loading" } : { phase: "native" },
  );
  const { theme } = useTheme();
  const styles = themedStyles(theme);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    let cancelled = false;
    setState({ phase: "loading" });

    void (async () => {
      try {
        const response = await fetch(CATALOG_ENDPOINT);
        if (!response.ok) {
          throw new Error(`${CATALOG_ENDPOINT} responded ${response.status}`);
        }
        const catalog = (await response.json()) as TemplateServerCatalog;
        if (!cancelled) {
          setState({ phase: "ready", catalog });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const example =
    state.phase === "ready"
      ? state.catalog.examples.find((entry) => entry.id === requestedExample) ?? null
      : null;
  const title =
    example?.label ?? (state.phase === "ready" ? "Unknown Server Pattern" : "Server Pattern");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Seo
        title={`${title} - Expo Template`}
        description="Dynamic Expo Router route param example for the server-alpha template demo."
      />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon
            name={state.phase === "ready" && !example ? "alert-triangle" : "server"}
            color={theme.colors.primaryForeground}
            size={24}
          />
        </View>
        <View style={styles.heroText}>
          <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
          <SansSerifText style={styles.subtitle}>
            Route params, a client fetch of the matching API route, and copyable code pointers.
          </SansSerifText>
        </View>
      </View>

      {example ? (
        <>
          <View style={styles.badges}>
            <Badge variant="outline" text="dynamic route" />
            <Badge variant="outline" text="route params" />
            {example.apiPath ? <Badge variant="outline" text="matching API" /> : null}
          </View>

          <Card variant="outline" style={styles.card}>
            <CardHeader>
              <CardTitle>Pattern</CardTitle>
            </CardHeader>
            <CardContent style={styles.rows}>
              <InfoRow label="Route" value={example.route} />
              <InfoRow label="Loader endpoint" value={example.loaderPath ?? "(none)"} />
              <InfoRow label="API endpoint" value={example.apiPath ?? "(none)"} />
              <InfoRow label="Pattern" value={example.pattern} />
              <InfoRow label="Use case" value={example.useCase} />
            </CardContent>
          </Card>

          <Card variant="outline" style={styles.card}>
            <CardHeader>
              <CardTitle>Code Pointers</CardTitle>
            </CardHeader>
            <CardContent style={styles.rows}>
              {example.codePointers.map((pointer) => (
                <InfoRow key={pointer} label="File" value={pointer} />
              ))}
            </CardContent>
          </Card>
        </>
      ) : state.phase === "ready" ? (
        <Card variant="outline" style={styles.card}>
          <CardHeader>
            <CardTitle>Not Found</CardTitle>
          </CardHeader>
          <CardContent style={styles.rows}>
            <InfoRow label="Requested" value={String(requestedExample ?? "(missing)")} />
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outline" style={styles.card}>
        <CardHeader>
          <CardTitle>Where This Data Comes From</CardTitle>
        </CardHeader>
        <CardContent style={styles.rows}>
          <InfoRow label="Route param" value={String(requestedExample ?? "(missing)")} />
          <InfoRow label="Fetched from" value={CATALOG_ENDPOINT} />
          <InfoRow
            label="Why not a loader"
            value="A loader payload is a build-time snapshot keyed by the route file, so a param'd route would 404. Params read an API route instead."
          />
          {state.phase === "ready" ? (
            <>
              <InfoRow label="Served at" value={state.catalog.status.servedAt} />
              <InfoRow
                label="Request path"
                value={state.catalog.status.request.path ?? "(no request)"}
              />
              <InfoRow label="Mode" value={state.catalog.status.runtime.mode} />
            </>
          ) : null}
          {state.phase === "loading" ? (
            <InfoRow label="Status" value="Fetching the catalog…" />
          ) : null}
          {state.phase === "failed" ? (
            <InfoRow label="Fetch failed" value={state.message} />
          ) : null}
          {state.phase === "native" ? (
            <InfoRow
              label="Status"
              value="The catalog endpoint is relative, so this card only fills in on the web build."
            />
          ) : null}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);

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

const themedStyles = createThemedStyles(createStyles);
