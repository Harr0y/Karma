# Karma Refactor Architecture (Phase 0 Baseline)

## Goals

1. Keep orchestration logic in engineering code.
2. Move reading strategy and conversational tactics to prompt policy.
3. Minimize duplicated runtime code across initial and follow-up turns.
4. Keep interfaces (CLI/Telegram) thin and transport-focused.

## Responsibility Boundaries

### Engineering Layer (Python)

- Input/output transport (CLI and Telegram handlers).
- Session lifecycle and persistence:
  - user profile
  - conversation history
  - session logs
  - generated artifact files (audio/files)
- Claude SDK invocation/runtime:
  - query execution
  - stream handling
  - tool-call logging
  - error handling/retry policy
- Optional post-processing services (e.g., TTS generation).
- Configuration loading and validation.

### Prompt Layer (System/User Prompt Contracts)

- Reading strategy and narrative style.
- Feedback interpretation strategy (confirm/deny/partial/question pivots).
- Domain reasoning policy (how to use time windows, world events, metaphysics language).
- Output formatting contract for downstream channels.

## Current Runtime Contract

- `agent.py` should expose a unified turn execution path.
- Initial and follow-up flows should only differ in:
  - context construction
  - conversation persistence semantics
  - audio prefix naming
- Shared flow must include:
  - session header logging
  - Claude query execution
  - stream parsing
  - final response logging
  - optional audio generation

## Refactor Roadmap

### Phase 0 (this document)

- Freeze boundaries and contracts.
- Identify violations (hardcoded conversational strategy in code).

### Phase 1 (runtime consolidation)

- Introduce a single internal execution pipeline for Claude queries.
- Remove duplicated stream/logging/TTS code in initial/follow-up methods.
- Keep behavior stable.

### Phase 2 (prompt-driven strategy)

- Remove Python-side feedback classification and strategy branching.
- Push tactical logic into prompt templates.
- Keep Python as pure runtime/orchestration.

### Phase 3 (module split)

- Split monolithic `agent.py` into:
  - `core/runtime.py`
  - `core/session_store.py`
  - `adapters/claude_client.py`
  - `adapters/tts.py`
  - `interfaces/cli.py`
  - `interfaces/telegram.py`

### Phase 4 (test hardening)

- Add contract tests for output shape and channel safety.
- Add regression tests for initial + follow-up turn loops.

## Current Progress

- Completed:
  - Phase 0 boundary definition
  - Phase 1 runtime consolidation (shared query execution path)
  - Phase 2 strategy de-hardcoding (follow-up strategy moved out of Python branching)
  - Phase 3 initial module split:
    - `karma/core/store.py`
    - `karma/core/runner.py`
    - `karma/core/audio.py`
    - `karma/core/prompt_builder.py`
    - `karma/core/__init__.py`
- Remaining:
  - Phase 3 deeper split (move large prompt builders out of `agent.py`)
  - Phase 4 contract/regression test expansion

## Non-Goals (for now)

- No immediate product behavior redesign.
- No immediate user data format migration.
- No prompt copy rewrite in this phase, only architecture cleanup.
