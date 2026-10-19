import type { Guide } from "../schema";

export const STAGES = [
  { id: "resolve", label: "Identify the app and its developer docs" },
  { id: "research", label: "Read official docs on OAuth setup and review" },
  { id: "classify", label: "Extract requirements per scenario (with quotes)" },
  { id: "plan", label: "Write steps, blockers and who does what" },
  { id: "verify", label: "Check every quote against the source page (code)" },
  { id: "score", label: "Compute difficulty from the rubric (code)" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export type AgentEvent =
  | { type: "meta"; mode: "live" | "demo"; model?: string }
  | { type: "stage"; stage: StageId; status: "start" | "done" | "error"; detail?: string }
  | { type: "log"; message: string }
  | { type: "source"; url: string; title: string }
  | { type: "done"; slug: string; guide: Guide; cached?: boolean; saved?: boolean }
  | { type: "error"; message: string };

export type Emit = (e: AgentEvent) => void;
