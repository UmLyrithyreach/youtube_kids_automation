// Local, confidential persistence: node:sqlite (zero-config, in Node 26 stdlib).
// DB path can be redirected with YK_HOME (defaults to ~/.youtubekids-platform).
// Separation: jobs/run history here; media files on fs under data/media/;
// config (accounts/endpoints) in config.json next to the DB.

import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import type {
  Job,
  ProgressEvent,
  WorkflowGraph,
  WorkflowRecord,
} from "./types.ts"

export const YK_HOME =
  process.env.YK_HOME ?? path.join(os.homedir(), ".youtubekids-platform")
export const MEDIA_DIR = path.join(YK_HOME, "media")
const DB_PATH = path.join(YK_HOME, "platform.db")

fs.mkdirSync(MEDIA_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    graph TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    prompt_record TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    node_state TEXT NOT NULL DEFAULT '{}',
    outputs TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
`)

const now = () => Date.now()
const genId = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`

// ---- Workflows ----------------------------------------------------------

export function listWorkflows(): Omit<WorkflowRecord, "graph">[] {
  return db
    .prepare("SELECT id, name, created_at, updated_at FROM workflows ORDER BY updated_at DESC")
    .all() as Omit<WorkflowRecord, "graph">[]
}

export function getWorkflow(id: string): WorkflowRecord | null {
  const row = db
    .prepare("SELECT id, name, graph, created_at, updated_at FROM workflows WHERE id = ?")
    .get(id) as { graph: string } | undefined
  if (!row) return null
  const base = db
    .prepare("SELECT id, name, created_at, updated_at FROM workflows WHERE id = ?")
    .get(id) as Omit<WorkflowRecord, "graph">
  return { ...base, graph: JSON.parse(row.graph) as WorkflowGraph }
}

export function saveWorkflow(name: string, graph: WorkflowGraph, id?: string): WorkflowRecord {
  const rec: WorkflowRecord = {
    id: id ?? genId("wf"),
    name,
    graph,
    created_at: now(),
    updated_at: now(),
  }
  const prev = id
    ? (db.prepare("SELECT created_at FROM workflows WHERE id = ?").get(id) as
        | { created_at: number }
        | undefined)
    : undefined
  if (prev && id) {
    rec.created_at = prev.created_at
    db.prepare(
      "UPDATE workflows SET name = ?, graph = ?, updated_at = ? WHERE id = ?",
    ).run(name, JSON.stringify(graph), rec.updated_at, id)
  } else {
    db.prepare(
      "INSERT INTO workflows (id, name, graph, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(rec.id, name, JSON.stringify(graph), rec.created_at, rec.updated_at)
  }
  return rec
}

export function deleteWorkflow(id: string): void {
  db.prepare("DELETE FROM workflows WHERE id = ?").run(id)
}

// ---- Jobs ---------------------------------------------------------------

const jobCols = "id, workflow_id, workflow_name, prompt_record, status, node_state, outputs, error, created_at, updated_at"

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    workflowName: row.workflow_name as string,
    promptRecord: JSON.parse(row.prompt_record as string),
    status: row.status as Job["status"],
    nodeState: JSON.parse(row.node_state as string),
    outputs: JSON.parse(row.outputs as string),
    error: (row.error as string) ?? undefined,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }
}

export function insertJob(
  workflowId: string,
  workflowName: string,
  promptRecord: Job["promptRecord"],
): Job {
  const job: Job = {
    id: genId("job"),
    workflowId,
    workflowName,
    promptRecord,
    status: "queued",
    nodeState: Object.fromEntries(Object.keys(promptRecord).map((k) => [k, "pending"])),
    outputs: {},
    created_at: now(),
    updated_at: now(),
  }
  db.prepare(
    "INSERT INTO jobs (id, workflow_id, workflow_name, prompt_record, status, node_state, outputs, error, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, '{}', NULL, ?, ?)",
  ).run(
    job.id,
    workflowId,
    workflowName,
    JSON.stringify(promptRecord),
    JSON.stringify(job.nodeState),
    job.created_at,
    job.updated_at,
  )
  return job
}

export function getJob(id: string): Job | null {
  const row = db.prepare(`SELECT ${jobCols} FROM jobs WHERE id = ?`).get(id)
  return row ? rowToJob(row as Record<string, unknown>) : null
}

export function listJobs(limit = 50): Job[] {
  const rows = db
    .prepare(`SELECT ${jobCols} FROM jobs ORDER BY created_at DESC LIMIT ?`)
    .all(limit)
  return (rows as unknown as Record<string, unknown>[]).map(rowToJob)
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const job = getJob(id)
  if (!job) return
  const merged = { ...job, ...patch, updated_at: now() }
  db.prepare(
    "UPDATE jobs SET status = ?, node_state = ?, outputs = ?, error = ?, updated_at = ? WHERE id = ?",
  ).run(
    merged.status,
    JSON.stringify(merged.nodeState),
    JSON.stringify(merged.outputs),
    merged.error ?? null,
    merged.updated_at,
    id,
  )
}

/** On server boot: jobs left mid-flight from a previous run are stale. */
export function requeueOrphans(): void {
  db.prepare("UPDATE jobs SET status = 'queued', updated_at = ? WHERE status IN ('running','paused')").run(now())
}

// ---- Events (WS fan-out) ------------------------------------------------

type Listener = (e: ProgressEvent) => void
const listeners = new Set<Listener>()
export function onJobEvent(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function emitJobEvent(e: ProgressEvent): void {
  for (const fn of listeners) fn(e)
}