---
name: example
description: Use this skill when the user asks how this template is organized.
disableModelInvocation: true
---

This template separates deployment config, agent behavior, sandbox workspace files, and sandbox-executed tool code.

- Deployment and snapshot settings live in `salambo.yaml`.
- Agent instructions live in `agent/system.md`.
- Optional skills live in `agent/skills/**/SKILL.md`.
- Optional prompt templates live in `agent/prompts/*.md`.
- Sandbox workspace seed files live in `workspace/`.
- Custom tool code lives in `tools/` and runs only inside the sandbox.
