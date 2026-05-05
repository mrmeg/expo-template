import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLoaderData } from "expo-router";
import { setResponseHeaders } from "expo-server";
import type { LoaderFunction } from "expo-router/server";
import { useTheme } from "@mrmeg/expo-ui/hooks";
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
import { SEO } from "@/client/components/SEO";
import type { Theme } from "@mrmeg/expo-ui/constants";
import type { TemplateServerExample } from "@/server/api/template/examples";
import type { TemplateServerStatus } from "@/server/api/template/status";

type ExampleLoaderData = {
  example: TemplateServerExample | null;
  requestedExample: string | string[] | null;
  status: TemplateServerStatus;
};

export const loader: LoaderFunction<ExampleLoaderData> = async (
  request,
  params,
) => {
  try {
    setResponseHeaders({ "Cache-Control": "no-store" });
  } catch {
    // Static export and direct unit-test calls do not have an active Expo Server request scope.
  }

  const [{ getTemplateServerExample }, { getTemplateServerStatus }] =
    await Promise.all([
      import("@/server/api/template/examples"),
      import("@/server/api/template/status"),
    ]);

  return {
    example: getTemplateServerExample(params.example),
    requestedExample: params.example ?? null,
    status: getTemplateServerStatus(request),
  };
};

export default function ServerAlphaExampleScreen() {
  const { example, requestedExample, status } = useLoaderData<typeof loader>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = example?.label ?? "Unknown Server Pattern";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SEO
        title={`${title} - Expo Template`}
        description="Dynamic Expo Router loader example for the server-alpha template demo."
      />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name={example ? "server" : "alert-triangle"} color={theme.colors.primaryForeground} size={24} />
        </View>
        <View style={styles.heroText}>
          <SansSerifBoldText style={styles.title}>{title}</SansSerifBoldText>
          <SansSerifText style={styles.subtitle}>
            Dynamic loader params, request-scoped runtime data, and copyable code pointers.
          </SansSerifText>
        </View>
      </View>

      {example ? (
        <>
          <View style={styles.badges}>
            <Badge variant="outline">dynamic route</Badge>
            <Badge variant="outline">loader params</Badge>
            {example.apiPath ? <Badge variant="outline">matching API</Badge> : null}
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
      ) : (
        <Card variant="outline" style={styles.card}>
          <CardHeader>
            <CardTitle>Not Found</CardTitle>
          </CardHeader>
          <CardContent style={styles.rows}>
            <InfoRow label="Requested" value={String(requestedExample ?? "(missing)")} />
          </CardContent>
        </Card>
      )}

      <Card variant="outline" style={styles.card}>
        <CardHeader>
          <CardTitle>Loader Result</CardTitle>
        </CardHeader>
        <CardContent style={styles.rows}>
          <InfoRow label="Served at" value={status.servedAt} />
          <InfoRow label="Request path" value={status.request.path ?? "(static export)"} />
          <InfoRow label="Runtime origin" value={status.runtime.origin ?? "(not provided)"} />
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
