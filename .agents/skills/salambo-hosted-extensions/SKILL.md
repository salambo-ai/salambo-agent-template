---
name: salambo-hosted-extensions
description: Add or update JavaScript hosted extension tools and lifecycle hooks in a Salambo agent project. Use when executable agent behavior must register a tool, call an external API, or use a supported hosted Pi hook.
---

# Build a hosted extension

Put runnable JavaScript ESM modules under `agent/extensions/` and declare each entrypoint in `salambo.yaml`.

Use an extension for executable behavior. Use a runtime skill when the agent only needs instructions or a workflow.

For a tool:

1. Register it with `pi.registerTool(...)`.
2. Define a bounded JSON schema with required fields and `additionalProperties: false`.
3. Validate untrusted inputs and return structured content.
4. Add the registered name to `agent/settings.json` when it should start active.

Hosted extensions run in the sandbox sidecar. They cannot use local Pi terminal UI APIs, shortcuts, or arbitrary worker internals. Keep secrets in Salambo configuration and use the managed egress contract for sandbox network calls.

Run `salambo manifest --path . --json` and require zero diagnostics.
