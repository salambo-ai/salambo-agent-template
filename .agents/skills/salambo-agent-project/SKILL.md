---
name: salambo-agent-project
description: Customize a Salambo managed Pi agent project. Use when changing the agent role, model, active tools, runtime skills, prompts, deployment configuration, or project structure.
---

# Customize a Salambo agent project

Keep ownership explicit:

- Put role, policy, and response rules in `.pi/SYSTEM.md`.
- Put the default model and thinking level in `.pi/settings.json`.
- Register custom providers in a Pi extension with `pi.registerProvider()`.
- Put reusable runtime instructions in `.pi/skills/<name>/SKILL.md`.
- Put optional prompt templates in `.pi/prompts/`.
- Put hosted tools and lifecycle hooks in `.pi/extensions/`.
- Put deployment, egress, environment, secrets, and extension declarations in `salambo.yaml`.

Use only supported built-in tool names: `read`, `write`, `edit`, and `bash`.
Run shell utilities such as `grep`, `find`, and `ls` through `bash`.

Keep secret values out of source files. Reference deployment secrets by environment name in `salambo.yaml`.

Validate changes with:

```bash
salambo manifest --path . --json
node scripts/validate-template.mjs
```
