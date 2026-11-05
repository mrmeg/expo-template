/** The local supervisor's browser contract; never contains tokens or env vars. */
export interface ServerLabProcess {
  name: string;
  pid: number;
  status: "running" | "stopped";
  rssMiB: number | null;
  peakMiB: number | null;
}

export interface ServerLabSample {
  at: number;
  bunMiB: number | null;
  rustMiB: number | null;
  supervisorMiB: number | null;
}

export interface ServerLabRow {
  target: string;
  workload: string;
  repeat: number;
  idleMiB: number;
  peakMiB: number;
  postLoadMiB: number;
  requests: number;
  errors: number;
  rps: number;
  p95ms: number | null;
}

export interface ServerLabState {
  version: 1;
  at: number;
  platform: string;
  arch: string;
  processes: ServerLabProcess[];
  samples: ServerLabSample[];
  logs: { id: number; at: string; source: string; message: string }[];
  run: {
    status: "idle" | "running" | "stopping" | "cancelled" | "complete" | "failed";
    workload: string | null;
    profile: string | null;
    stage: { target: string; phase: string; rssMiB?: number; elapsedSeconds?: number } | null;
    rows: ServerLabRow[];
  };
}
