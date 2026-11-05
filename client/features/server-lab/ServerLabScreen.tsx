import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@mrmeg/expo-ui/components/Button";
import { Screen } from "@mrmeg/expo-ui/components/Screen";
import { EmptyState } from "@mrmeg/expo-ui/components/EmptyState";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@mrmeg/expo-ui/components/Item";
import { BodyText, CaptionText, HeadingText, MonoText, TitleText } from "@mrmeg/expo-ui/components/StyledText";
import { spacing, type Theme } from "@mrmeg/expo-ui/constants";
import { useTheme } from "@mrmeg/expo-ui/hooks";
import { createThemedStyles } from "@mrmeg/expo-ui/lib";
import { Seo } from "@/client/components/Seo";
import type { ServerLabSample, ServerLabState } from "@/shared/serverLab";

const queryKey = ["server-lab"];
const mib = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(1)} MiB`;

async function labRequest(path: string, body?: object) {
  const response = await fetch(`/_server-lab/${path}`, {
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Lab request failed (${response.status}). Start bun run server:lab and open its local URL.`);
  return response.json();
}

export default function ServerLabScreen() {
  return Platform.OS === "web" ? <WebServerLab /> : (
    <Screen edges={["bottom"]}><EmptyState icon="server" title="Open Server Lab on web" description="Run bun run build, then bun run server:lab. Open http://localhost:3000/server-lab on the computer running the servers." /></Screen>
  );
}

function WebServerLab() {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [paused, setPaused] = useState(false);
  const state = useQuery<ServerLabState>({
    queryKey,
    queryFn: async () => {
      const data = await labRequest("state");
      if (data.version !== 1) throw new Error("Server Lab is unavailable. Run bun run server:lab.");
      return data;
    },
    refetchInterval: query => paused || query.state.status === "error" ? false : 1000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: !paused,
  });
  const data = state.data;
  const connected = !!data && !state.isError;

  return (
    <Screen edges={["bottom"]} scroll padded={false} contentContainerStyle={styles.content}>
      <Seo title="Server Lab - Expo Template" description="Local Rust server metrics, runtime comparisons, and console logs." />
      <View style={styles.section}>
        <TitleText>Server Lab</TitleText>
        <BodyText>Rust API + Bun rendering. Watch memory and console output, then compare Node, Bun, and Rust with the same workload.</BodyText>
        <View style={styles.actions}>
          <Button preset="outline" onPress={() => setPaused(!paused)}><Button.Text>{paused ? "Resume live updates" : "Pause live updates"}</Button.Text></Button>
          <CaptionText>{paused ? "Updates paused" : connected ? "Live · refreshes every second" : state.isPending ? "Connecting…" : "Disconnected"}</CaptionText>
        </View>
        {state.error ? <BodyText accessibilityRole="alert">{state.error.message}</BodyText> : null}
        {!connected ? <View style={styles.instructions}>
          <HeadingText>Start the local lab</HeadingText>
          <MonoText selectable>bun run build{"\n"}bun run server:lab</MonoText>
          <BodyText>Open http://localhost:3000/server-lab. Rust and Cargo, Node, and Bun must be installed. The first start builds the Rust services.</BodyText>
          <Button preset="outline" onPress={() => void state.refetch()}><Button.Text>Reconnect</Button.Text></Button>
        </View> : null}
      </View>

      <ProcessMetrics data={data} />
      <RustProbe connected={connected} />
      <BenchmarkPanel data={data} connected={connected} />
      <ConsoleLogs logs={data?.logs ?? []} />
    </Screen>
  );
}

function ProcessMetrics({ data }: { data?: ServerLabState }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const current = data?.samples.at(-1);
  const total = current?.bunMiB != null && current.rustMiB != null ? current.bunMiB + current.rustMiB : null;
  return <>
      <ItemGroup title="Live processes" footer="RSS is sampled once per second. The Bun + Rust total includes both application processes; the lab supervisor and benchmark runner are additional tooling overhead.">
        {(data?.processes ?? []).map(process => (
          <Item key={process.name}>
            <ItemContent>
              <ItemTitle>{process.name} · {mib(process.rssMiB)}</ItemTitle>
              <ItemDescription>PID {process.pid} · {process.status} · session peak {mib(process.peakMiB)}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
        <Item><ItemContent><ItemTitle>Bun + Rust · {mib(total)}</ItemTitle><ItemDescription>Combined application memory</ItemDescription></ItemContent></Item>
        <Item><ItemContent><ItemTitle>Lab supervisor · {mib(current?.supervisorMiB)}</ItemTitle><ItemDescription>{data ? `${data.platform} / ${data.arch}` : "Local metrics unavailable"}</ItemDescription></ItemContent></Item>
      </ItemGroup>

      <View style={styles.section}>
        <HeadingText>Memory over the last minute</HeadingText>
        <MemoryChart samples={data?.samples ?? []} theme={theme} />
        <CaptionText>Bun (primary) · Rust (accent) · supervisor (muted). Sampled peaks may miss short spikes.</CaptionText>
      </View>

  </>;
}

function RustProbe({ connected }: { connected: boolean }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const client = useQueryClient();
  const probe = useMutation({
    mutationFn: async (kind: "health" | "items" | "echo") => {
      const response = await fetch(`/api/rust/${kind}`, {
        ...(kind === "echo" ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Hello from Server Lab" }) } : {}),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Rust request failed (${response.status})`);
      const result = JSON.stringify(await response.json(), null, 2);
      return result.length > 1400 ? `${result.slice(0, 1400)}\n… (preview truncated)` : result;
    },
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return (
      <View style={styles.section}>
        <HeadingText>Try the Rust API</HeadingText>
        <BodyText>These endpoints use public demo data. Each request appears in the Rust console below.</BodyText>
        <View style={styles.actions}>
          {(["health", "items", "echo"] as const).map(kind => <Button key={kind} preset="outline" disabled={!connected || probe.isPending} onPress={() => probe.mutate(kind)}><Button.Text>{kind === "health" ? "Check health" : kind === "items" ? "Read SQLite items" : "Send JSON echo"}</Button.Text></Button>)}
        </View>
        {probe.error ? <BodyText accessibilityRole="alert">{probe.error.message}</BodyText> : null}
        {probe.data ? <MonoText size="xs" selectable>{probe.data}</MonoText> : null}
      </View>

  );
}

function BenchmarkPanel({ data, connected }: { data?: ServerLabState; connected: boolean }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const client = useQueryClient();
  const [workload, setWorkload] = useState<"api" | "tiny">("api");
  const [profile, setProfile] = useState<"steady" | "burst">("steady");
  const busy = data?.run.status === "running" || data?.run.status === "stopping";
  const control = useMutation({
    mutationFn: ({ action }: { action: "run" | "stop" }) => labRequest(action, action === "run" ? { workload, profile } : {}),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  return <>
      <View style={styles.section}>
        <HeadingText>Compare runtimes</HeadingText>
        <BodyText>Each runtime gets its own isolated process. One pass takes about a minute. The API test verifies RS256 tokens and reads SQLite; it uses synthetic fixtures, separate from the Rust demo service.</BodyText>
        <View style={styles.actions}>
          <Button preset={workload === "api" ? "default" : "outline"} disabled={busy} onPress={() => setWorkload("api")}><Button.Text>Auth + SQLite</Button.Text></Button>
          <Button preset={workload === "tiny" ? "default" : "outline"} disabled={busy} onPress={() => setWorkload("tiny")}><Button.Text>Tiny JSON</Button.Text></Button>
        </View>
        <View style={styles.actions}>
          <Button preset={profile === "steady" ? "default" : "outline"} disabled={busy} onPress={() => setProfile("steady")}><Button.Text>200 req/s</Button.Text></Button>
          <Button preset={profile === "burst" ? "default" : "outline"} disabled={busy} onPress={() => setProfile("burst")}><Button.Text>2,000 req/s</Button.Text></Button>
        </View>
        <View style={styles.actions}>
          <Button disabled={!connected || busy || control.isPending} onPress={() => control.mutate({ action: "run" })}><Button.Text>Run comparison</Button.Text></Button>
          <Button preset="outline" disabled={!connected || !busy || control.isPending || data?.run.status === "stopping"} onPress={() => control.mutate({ action: "stop" })}><Button.Text>Stop comparison</Button.Text></Button>
        </View>
        <RunProgress run={data?.run} />
        {control.error ? <BodyText accessibilityRole="alert">{control.error.message}</BodyText> : null}
      </View>

      <ComparisonResults rows={data?.run.rows ?? []} />

  </>;
}

function RunProgress({ run }: { run?: ServerLabState["run"] }) {
  const busy = run?.status === "running" || run?.status === "stopping";
  return (
        <BodyText accessibilityLiveRegion="polite">{run?.status ?? "idle"}{run?.workload ? ` · ${run.workload} / ${run.profile}` : ""}{busy && run?.stage ? ` · ${run.stage.target}: ${run.stage.phase} · ${mib(run.stage.rssMiB)}${run.stage.elapsedSeconds != null ? ` · ${run.stage.elapsedSeconds.toFixed(0)}s / 10s` : ""}` : ""}</BodyText>
  );
}

function ComparisonResults({ rows }: { rows: ServerLabState["run"]["rows"] }) {
  return (
      <ItemGroup title="Latest comparison" footer="These are benchmark child processes, separate from the live Bun + Rust stack above. Local RSS and latency are directional; Linux container billing and your real app dependencies may differ.">
        {rows.length ? rows.map(row => <Item key={`${row.target}-${row.repeat}`}><ItemContent>
          <ItemTitle>{row.target} · peak {mib(row.peakMiB)}</ItemTitle>
          <ItemDescription>Idle {mib(row.idleMiB)} · after load {mib(row.postLoadMiB)}</ItemDescription>
          <ItemDescription>{row.rps.toFixed(0)} req/s · p95 {row.p95ms?.toFixed(2) ?? "—"} ms · {row.requests.toLocaleString()} requests · {row.errors} errors</ItemDescription>
        </ItemContent></Item>) : <Item><ItemContent><ItemDescription>Run a comparison to see memory, latency, throughput, and errors.</ItemDescription></ItemContent></Item>}
      </ItemGroup>
  );
}

function ConsoleLogs({ logs }: { logs: ServerLabState["logs"] }) {
  const { theme } = useTheme();
  const styles = themedStyles(theme);
  const [logSource, setLogSource] = useState("all");
  const [logFloor, setLogFloor] = useState(0);
  const visibleLogs = logs.filter(log => log.id > logFloor && (logSource === "all" || log.source === logSource)).slice(-80).reverse();
  return (
      <View style={styles.section}>
        <HeadingText>Console logs</HeadingText>
        <CaptionText>Newest first · latest 80 matching lines from a 400-line buffer · current session only</CaptionText>
        <View style={styles.actions}>
          {["all", "rust-api", "bun-ssr", "benchmark", "lab"].map(source => <Button key={source} preset={logSource === source ? "default" : "outline"} onPress={() => setLogSource(source)}><Button.Text>{source}</Button.Text></Button>)}
          <Button preset="ghost" onPress={() => setLogFloor(logs.at(-1)?.id ?? 0)}><Button.Text>Clear view</Button.Text></Button>
        </View>
        <ScrollView style={styles.logs} nestedScrollEnabled accessibilityLabel="Server console logs">
          {visibleLogs.length ? visibleLogs.map(log => <MonoText key={log.id} size="xs" selectable>{log.at.slice(11, 23)} [{log.source}] {log.message}{"\n"}</MonoText>) : <CaptionText>No matching logs yet.</CaptionText>}
        </ScrollView>
      </View>
  );
}

function MemoryChart({ samples, theme }: { samples: ServerLabSample[]; theme: Theme }) {
  const maximum = Math.max(10, ...samples.flatMap(sample => [sample.bunMiB ?? 0, sample.rustMiB ?? 0, sample.supervisorMiB ?? 0]));
  const series = (["bunMiB", "rustMiB", "supervisorMiB"] as const).map((key, index) => ({
    key, color: [theme.colors.primary, theme.colors.accent, theme.colors.mutedForeground][index],
    points: samples.map((sample, offset) => sample[key] == null ? null : `${offset / 59 * 640},${130 - sample[key]! / maximum * 120}`).filter(Boolean).join(" "),
  }));
  return <View>
    <CaptionText>0–{maximum.toFixed(0)} MiB · {samples.length} samples</CaptionText>
    <Svg width="100%" height={140} viewBox="0 0 640 140" accessibilityRole="image" accessibilityLabel={`Process memory over the last minute, scale zero to ${maximum.toFixed(0)} MiB`}>
      {series.map(line => <Polyline key={line.key} points={line.points} fill="none" stroke={line.color} strokeWidth={2} />)}
    </Svg>
  </View>;
}

const themedStyles = createThemedStyles((_theme: Theme) => ({
  content: { width: "100%", maxWidth: 960, alignSelf: "center", paddingVertical: spacing.sectionSpacing, gap: spacing.sectionSpacing },
  section: { paddingHorizontal: spacing.screenPadding, gap: spacing.smd },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  instructions: { gap: spacing.smd, paddingVertical: spacing.md },
  logs: { maxHeight: 320 },
} as const));
