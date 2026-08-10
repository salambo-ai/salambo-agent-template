---
name: salambo-artifacts
description: Design generated files and user-visible artifacts for a Salambo agent. Use when the agent creates reports, exports, PDFs, spreadsheets, images, or other files that users must download or inspect.
---

# Publish agent artifacts

Write working files under `/workspace`, preferably `/workspace/outputs`.

Artifact publication is explicit. Publish only files the user should receive. Use a stable logical path such as `/reports/summary.pdf` and give the user a concise response that explains the file.

Use the platform-provided artifact upload URL and short-lived token through the supported helper or hosted tool. Never add object-storage credentials to the sandbox.

Do not publish credentials, private scratch files, or raw logs that can contain secrets.
