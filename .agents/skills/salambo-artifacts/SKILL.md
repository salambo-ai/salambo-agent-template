---
name: salambo-artifacts
description: Design generated files and user-visible artifacts for a Salambo agent. Use when the agent creates reports, exports, PDFs, spreadsheets, images, or other files that users must download or inspect.
---

# Publish agent artifacts

Write working files under `/workspace`, preferably `/workspace/outputs`.

Artifact publication is explicit. Publish only files the user should receive. Use a stable logical path such as `/reports/summary.pdf` and give the user a concise response that explains the file.

Publish a file with the `share_file` tool from `.pi/extensions/share-file.mjs`. It takes the file's path under `/workspace` and an optional display name, uploads it to the platform, and the file is attached to the agent's reply as a download link. Tell the user what the file contains; never reply with a `sandbox:` or `/workspace` path, because the user cannot open it.

The tool reads the run's `SALAMBO_ARTIFACT_UPLOAD_URL` and `SALAMBO_ARTIFACT_TOKEN`, which the platform injects, and posts the raw bytes with `Authorization: Bearer`, `x-display-path`, `x-file-name`, `Content-Type` and `Content-Length`. The display path is `/<file name>`; sharing the same name again replaces the earlier file. The limit is 100 MB per file. Never add object-storage credentials to the sandbox.

Do not publish credentials, private scratch files, or raw logs that can contain secrets.
