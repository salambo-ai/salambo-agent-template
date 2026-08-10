# Salambo managed agent template

A minimal starting point for a Pi agent that runs on Salambo's managed runtime.

Salambo owns the model loop, runtime image, sandbox lifecycle, durable sessions,
and workspace checkpoints. This repository owns the agent's instructions,
declared resources, sandbox packages, and initial workspace files.

## Project layout

```text
agent/
  settings.json          Default model and active tools
  system.md              Base agent instructions
  skills/                Reusable runtime skills
  prompts/               Optional prompt templates
  extensions/            Optional hosted extension modules

sandbox/
  packages.json          Declarative managed-image packages
  workspace/             Files copied into new run workspaces

.agents/skills/          Builder guidance for editing this project
salambo.yaml              Deployment and runtime configuration
```

There is no project Dockerfile, app server, or local Pi process. Hosted builds
use an immutable Salambo base image. The worker runs the agent loop, and the
sandbox provides isolated file and command execution.

## Start a project

Use this repository as a GitHub template or clone it directly. A compatible
Salambo CLI release pins a versioned tag of this template for `salambo init`.

Update the project identity in `salambo.yaml`, then configure CLI access:

```bash
salambo auth set --api-url https://YOUR_SALAMBO_HOST
salambo auth set --key "$SALAMBO_API_KEY"
export OPENAI_API_KEY="YOUR_PROVIDER_KEY"
```

Validate before deploying:

```bash
salambo manifest --path . --json
node scripts/validate-template.mjs
```

The template currently targets CLI `0.2.0` for manifest and deployment
compatibility. Its legacy Docker checks in `salambo doctor` will be removed in
the CLI phase of SAL-373 before `salambo init` points at this template.

Deploy and run a hosted smoke request:

```bash
salambo deploy
salambo smoke "Review the workspace and explain what this agent can do."
```

## Customize the agent

- Change the role and operating rules in `agent/system.md`.
- Change the model, thinking level, or active tools in `agent/settings.json`.
- Add focused reusable instructions under `agent/skills/<name>/SKILL.md`.
- Add prompt templates under `agent/prompts/`.
- Add executable tools or hooks under `agent/extensions/` and declare them in
  `salambo.yaml`.

The default active tools are `read`, `write`, `edit`, and `bash`. These are the
supported hosted Pi file and command tools. Shell utilities such as `grep`,
`find`, and `ls` are commands used through `bash`, not separate active tools.

## Customize the managed sandbox

Declare optional packages in `sandbox/packages.json`:

```json
{
  "version": 1,
  "apt": ["poppler-utils"],
  "npm": ["cowsay@1.6.0"],
  "pip": ["rapidfuzz==3.10.1"]
}
```

The package file is declarative. It cannot contain setup scripts or lifecycle
commands. Files under `sandbox/workspace/` seed `/workspace` for a new run.
Later turns restore that run's durable workspace instead of replacing it.

## Network and secrets

The default sandbox egress allowlist is empty. Add only the destinations needed
by sandbox tools or extensions. Provider calls are made by the trusted worker,
so the sandbox does not need direct OpenAI access for the default model.

`OPENAI_API_KEY` is read from the deployer's environment and exposed only to
the trusted runtime. Never commit secret values.

## Builder guidance

Project-local skills under `.agents/skills/` explain the supported ownership
boundaries for agent behavior, managed packages, hosted extensions, artifacts,
and chat integrations. They guide engineers and coding assistants editing this
repository; they are not projected into the deployed agent.

## Compatibility policy

The template default branch is the development source. Released CLI versions
must pin an immutable `cli-v<version>` template tag instead of cloning the
moving default branch. Create the tag only after the template contract passes
against that CLI release, and never move an existing compatibility tag.
