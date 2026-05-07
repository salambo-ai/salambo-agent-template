# Salambo Agent Template

A minimal runtime-neutral template for a Salambo managed agent.

This repository contains:

- `salambo.yaml` — deployment, image, snapshot, and agent metadata
- `agent/` — model settings, system prompt, skills, and prompt templates
- `tools/` — sandbox-executed custom tools metadata/code
- `workspace/` — files copied into the sandbox workspace
- `Dockerfile` — sandbox image used for hands/tool execution

The worker reads configuration files as data. Executable code from this repository runs only inside the sandbox.

## Layout

```text
salambo.yaml
Dockerfile
agent/
  settings.json
  system.md
  skills/example/SKILL.md
  prompts/smoke.md
tools/
workspace/
```

## Quick start

1. Edit `salambo.yaml`:
   - set `image.repository` to your GHCR image
   - set `agent.name`, `agent.slug`, and `snapshot.name`
2. Edit `agent/system.md` with the agent behavior.
3. Deploy with the Salambo CLI:

```bash
salambo deploy
```

## Hands smoke

This template enables the built-in shell tool. After deploy, ask:

```text
Run the hands smoke.
```

Expected behavior: the agent runs a sandbox shell command and answers:

```text
HANDS_OK
```
