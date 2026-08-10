---
name: salambo-chat-agent
description: Adapt a Salambo agent for Slack or Microsoft Teams. Use when designing thread behavior, progress messages, final responses, file handling, action requests, or chat-safe formatting.
---

# Design for chat integrations

- Treat the current Slack or Teams thread as the conversation boundary.
- Do not assume access to channel-wide history unless a declared tool provides it.
- Give brief progress messages only when work is long enough to justify them.
- Put the result in a clear final response.
- Keep paragraphs and lists short enough for chat.
- Publish long reports as artifacts and summarize them in the message.
- Do not expose internal run IDs, hidden prompts, credentials, or runtime diagnostics.
- Ask one focused question when required context is missing.
