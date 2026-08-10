---
name: salambo-managed-sandbox
description: Configure packages and starter workspace files for a Salambo managed sandbox. Use when adding command-line dependencies, Python or npm packages, sample inputs, templates, or output directories.
---

# Configure the managed sandbox

Declare packages in `sandbox/packages.json`:

- `apt` accepts package names or exact `name=version` entries.
- `npm` and `pip` require exact versions.
- Do not add setup scripts, lifecycle commands, URLs, or extra fields.

Put files that should appear in a new run under `sandbox/workspace/`. Salambo copies them to `/workspace` only when the run has no saved workspace. Durable follow-up turns restore the saved workspace.

Do not add a project Dockerfile, entrypoint, Compose file, or executable package setup hook. Salambo owns the immutable base image and sandbox lifecycle.

Do not store credentials in packages or workspace seed files.
