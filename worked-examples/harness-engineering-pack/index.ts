/**
 * harness-engineering-pack
 * ─────────────────────────
 * A Pi extension that bolts the framework's portable NON-NEGOTIABLES onto Pi's
 * thin core. This is the concrete answer to "can Pi be the substrate and our
 * framework the outer ring?" — yes, AT PI'S COORDINATE (single-user /
 * inside-sandbox / coding-adjacent / permissive-OK).
 *
 * It implements, as the OUTER Safety & Scale ring around Pi's INNER loop:
 *   1. pre-stop verification gate   (FRAMEWORK non-negotiable #1)
 *   2. tiered permissions           (#2)
 *   3. independent evaluator        (#3)
 *   4. observability + cost meter   (#7)
 *   5. ratchet log                  (#8)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PACK CANNOT DO (verified against Pi source, 2026-06-01) — these
 * are properties of WHERE THE LOOP PROCESS RUNS, not behaviors a plugin can add:
 *   • Multi-user identity / per-user credentials with the loop
 *   • Outside-the-sandbox execution (loop on backend infra, tools dispatched in)
 *   • Durable execution (resume mid-loop after process death)
 *   • A TRUE termination veto. `agent_end`/`turn_end` carry no result type
 *     (types.ts:642,655), so #1 below is a RE-DRIVE workaround, not a blocking
 *     gate like Claude SDK's `Stop` hook. If your project needs any of the
 *     above, Pi is the wrong substrate — see architectural-decisions.md (Beyond-
 *     seven debate A) and route to outside-sandbox + durable execution.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";

// ── Config ────────────────────────────────────────────────────────────────
const CONFIG = {
	verifyCommand: ["make", "check"], // computational verification (component 10)
	maxReverify: 3, // cap re-drives so a never-passing check can't loop forever
	evalModel: "anthropic:claude-opus-4-8", // DIFFERENT model than the worker (anti self-eval bias)
	rubricPath: ".pi/rubric.md",
	decisionsPath: "DECISIONS.md",
	// Risk tiers — FRAMEWORK Decision 5. tier>=3 ⇒ confirm; tier 4 ⇒ typed confirm.
	toolTiers: { read: 0, grep: 0, find: 0, ls: 0, edit: 1, write: 1, bash: 2 } as Record<string, number>,
	// Command-level escalation for the catch-all `bash` tool.
	bashTier3: [/\bgit\s+push\b/i, /\b(npm|pnpm|yarn)\s+publish\b/i, /\bcurl\b.*\|\s*(ba)?sh/i, /\bssh\b/i],
	bashTier4: [/\brm\s+-rf?\b/i, /\bgit\s+push\b.*--force\b/i, /\bdrop\s+(table|database)\b/i, /\bsudo\b/i],
};

export default function harnessEngineeringPack(pi: ExtensionAPI) {
	const reverifyCount = new Map<string, number>(); // keyed by session leaf, best-effort
	let turnTokens = 0;
	let sessionTokens = 0;

	// ── 1. pre-stop verification gate (#1) — RE-DRIVE, not veto ──────────────
	// The agent "ends" when the model stops calling tools. We intercept that,
	// run the verification command, and if it fails we re-drive the loop with an
	// actionable ERROR/WHY/FIX message. This is the closest faithful port given
	// Pi exposes no stop-veto (see header caveat).
	pi.on("agent_end", async (_event, ctx) => {
		const key = (await safeLeaf(ctx)) ?? "default";
		const { stdout, stderr, code } = await pi.exec(CONFIG.verifyCommand[0], CONFIG.verifyCommand.slice(1));
		if (code === 0) {
			reverifyCount.delete(key);
			return;
		}
		const attempts = (reverifyCount.get(key) ?? 0) + 1;
		reverifyCount.set(key, attempts);
		if (attempts > CONFIG.maxReverify) {
			notify(ctx, `⛔ Verification still failing after ${CONFIG.maxReverify} attempts — surfacing to you.`, "error");
			return; // give up re-driving; do NOT mask the failure (no silent victory)
		}
		// Re-drive the loop. sendUserMessage always triggers a turn.
		pi.sendUserMessage(
			`ERROR: verification failed (\`${CONFIG.verifyCommand.join(" ")}\` exited ${code}).\n` +
				`WHY: the change does not pass the project's verification command.\n` +
				`FIX: address the failures below, then stop again to re-verify.\n\n` +
				`${(stderr || stdout).slice(-4000)}`,
		);
	});

	// ── 2. tiered permissions (#2) ───────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		const tier = computeTier(event.toolName, event.input);
		if (tier <= 1) return undefined; // auto-allow read/edit
		if (tier === 2) return undefined; // local execute — allow (trusted project); log only
		if (!ctx.hasUI) return { block: true, reason: `tier ${tier} requires confirmation; no UI available` };

		if (tier >= 4) {
			const typed = await ctx.ui.input(`⚠️ IRREVERSIBLE (tier 4). Type CONFIRM to allow:\n  ${describe(event)}`);
			return typed?.trim() === "CONFIRM" ? undefined : { block: true, reason: "tier-4 typed confirm not given" };
		}
		const choice = await ctx.ui.select(`External effect (tier 3). Allow?\n  ${describe(event)}`, ["Yes", "No"]);
		return choice === "Yes" ? undefined : { block: true, reason: "tier-3 confirm declined" };
	});

	// ── 3. independent evaluator (#3) ────────────────────────────────────────
	// Faithful to the canon: a SEPARATE process + DIFFERENT model + explicit
	// rubric (self-eval bias is real). Modeled on Pi's own subagent example,
	// which spawns a separate `pi` process for context isolation.
	pi.registerCommand("evaluate", {
		description: "Grade the latest output with an independent evaluator (separate model + rubric).",
		handler: async (ctx: ExtensionContext) => {
			const rubric = readOr(CONFIG.rubricPath, "Grade A–D on: correctness, completeness, and fit to the request.");
			const artifact = lastAssistantText(ctx);
			if (!artifact) return notify(ctx, "Nothing to evaluate yet.", "warn");
			// TODO: confirm your print/JSON flags — Pi ships a print mode (modes/print-mode.ts).
			const { stdout, code } = await pi.exec("pi", [
				"--print",
				"--model",
				CONFIG.evalModel,
				`You are NOT the author. Grade fairly against this rubric:\n${rubric}\n\nArtifact:\n${artifact}`,
			]);
			notify(ctx, code === 0 ? `Evaluator verdict:\n${stdout}` : "Evaluator failed to run.", code === 0 ? "info" : "error");
		},
	});

	// ── 4. observability + cost meter (#7) ───────────────────────────────────
	pi.on("turn_start", () => {
		turnTokens = 0;
	});
	pi.on("after_provider_response", (event) => {
		// TODO: map your provider's usage shape; this is the accumulation point.
		const used = (event as any)?.usage?.totalTokens ?? 0;
		turnTokens += used;
		sessionTokens += used;
		trace("llm_call", { turnTokens, sessionTokens });
	});
	pi.on("tool_execution_end", (event) => trace("tool", { tool: (event as any)?.toolName }));
	pi.registerCommand("cost", {
		description: "Show token usage for this session.",
		handler: (ctx) => notify(ctx, `Session tokens: ${sessionTokens} (last turn: ${turnTokens})`, "info"),
	});

	// ── 5. ratchet log (#8) ──────────────────────────────────────────────────
	pi.registerCommand("ratchet", {
		description: "Append a DECISIONS.md entry: every failure becomes a permanent harness change.",
		handler: async (ctx: ExtensionContext) => {
			const what = await ctx.ui.input("What changed? (one line)");
			if (!what) return;
			const why = (await ctx.ui.input("Why? (the failure this prevents)")) ?? "";
			const entry = `\n## ${nowISO()} — ${what}\n\n**Why:** ${why}\n\n**Rejected alternatives:** \n`;
			fs.appendFileSync(CONFIG.decisionsPath, entry);
			notify(ctx, "Logged to DECISIONS.md.", "info");
		},
	});
}

// ── helpers ─────────────────────────────────────────────────────────────────
function computeTier(tool: string, input: Record<string, unknown>): number {
	if (tool === "bash") {
		const cmd = String(input.command ?? "");
		if (CONFIG.bashTier4.some((p) => p.test(cmd))) return 4;
		if (CONFIG.bashTier3.some((p) => p.test(cmd))) return 3;
		return 2;
	}
	return CONFIG.toolTiers[tool] ?? 2;
}
function describe(event: { toolName: string; input: Record<string, unknown> }): string {
	return `${event.toolName} ${JSON.stringify(event.input).slice(0, 160)}`;
}
function lastAssistantText(ctx: ExtensionContext): string {
	const entries = ctx.sessionManager.getEntries();
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i];
		if (e.type === "message" && e.message.role === "assistant") {
			const c = e.message.content;
			return Array.isArray(c) ? c.filter((x: any) => x.type === "text").map((x: any) => x.text).join("\n") : String(c);
		}
	}
	return "";
}
async function safeLeaf(ctx: ExtensionContext): Promise<string | null> {
	try {
		return (await (ctx as any).sessionManager?.getLeafId?.()) ?? null;
	} catch {
		return null;
	}
}
function readOr(path: string, fallback: string): string {
	try {
		return fs.readFileSync(path, "utf-8");
	} catch {
		return fallback;
	}
}
function notify(ctx: ExtensionContext, msg: string, level: "info" | "warn" | "error") {
	if (ctx.hasUI) ctx.ui.notify(msg, level === "warn" ? "warning" : level);
	else console.error(`[harness-pack] ${msg}`);
}
function trace(span: string, attrs: Record<string, unknown>) {
	// Stub. Real OpenTelemetry wiring is project-specific (component 10).
	console.error(`[otel] ${span} ${JSON.stringify(attrs)}`);
}
// Date.now()/new Date() used here intentionally — extension runtime, not a workflow script.
function nowISO(): string {
	return new Date().toISOString();
}
