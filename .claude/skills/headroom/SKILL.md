---
name: headroom
description: Use this skill when the user wants to install, configure, or run Headroom (headroom-ai), an open-source context/token compression tool for AI agents. Trigger on requests to reduce token usage, wrap Claude Code with compression, set up an MCP/proxy compression server, or any mention of "headroom" for compressing tool outputs, logs, files, or RAG chunks before they reach an LLM.
---

# Headroom (headroomlabs-ai/headroom)

Headroom is a context-compression tool that reduces token usage (roughly
60-95% on JSON, 15-20% on code) by compressing tool outputs, logs, files,
RAG chunks, and conversation history before they reach an LLM. Source:
https://github.com/headroomlabs-ai/headroom

It is **not** a native Claude Code skill/plugin — it is a standalone
CLI/library that wraps coding agents (including Claude Code).

## Installing

Python CLI (recommended, includes all compressors):

```bash
pip install "headroom-ai[all]"
```

TypeScript SDK only:

```bash
npm install headroom-ai
```

Docker images are also published; see the repo's `docker-compose.yml` for
the proxy/MCP-server deployment mode.

Requires Python 3.10+.

## Using it with Claude Code

Wrap the Claude Code CLI so its context is compressed transparently:

```bash
headroom wrap claude
```

Other deployment modes: library import, HTTP proxy, or MCP server — pick
based on whether compression should apply to one process, all traffic
through a proxy, or be exposed as MCP tools. Check `headroom --help` and
the repo's `/docs` for the current flags, since this is a fast-moving
project.

## Key concepts to know before recommending changes

- **Compressors**: SmartCrusher (JSON), CodeCompressor (AST-based code),
  Kompress-v2-base (a small model for prose).
- **CCR (Content Cache Retrieval)**: compression is reversible — originals
  are cached locally so the LLM can request the uncompressed version
  within a configured TTL.
- **Cross-agent memory**: shared, deduplicated context across Claude,
  Codex, Gemini, etc.
- **`headroom learn`**: mines failed sessions and writes corrections to
  gitignored markdown files.

This project (rosa-clavel-2025-centro-jas-ventanilla) is a static HTML
site with no package manager manifest and no existing agent tooling, so
installing headroom here means setting it up as a local dev/session tool
(via pip/npm/Docker) — not adding it as a project runtime dependency.
