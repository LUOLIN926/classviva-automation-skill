# Classviva Question Helper Skill (Codex & OpenClaw)

An AI agent skill for **Codex** and **OpenClaw** that assists with Classviva/Moodle quizzes: guides manual login, asks for quiz target and question scope, extracts questions with LaTeX formulas intact, prepares Markdown plus JSON payloads for reasoning, fills user-confirmed answers, and verifies recorded field values.

This project is an educational learning helper. Auto-submit and retry behaviors are opt-in, require explicit confirmation for the active quiz, and must never be used to bypass course rules or academic integrity policies.

## Features

- **DOM-Direct Extraction**: Extracts question text directly from the live DOM without truncation.
- **LaTeX Preservation**: Converts MathJax script tags into clean `\(...\)` and `\[...\]` expressions.
- **Dual Outputs**: Generates both human-readable Markdown (`agentPrompt`) and machine-readable JSON controls.
- **Dual-Platform Support**: Seamlessly works with **OpenClaw** (via `openclaw browser`) and **Codex** (via Playwright CLI).
- **Safety First**: Manual login only; answers are only filled after user confirmation; auto-submit requires immediate confirmation.
- **Two-Phase Verification**: Reads live Moodle input states to confirm that answers were recorded by the server before any attempt is finished.

## Repository Layout

```text
.
├── SKILL.md                 # AgentSkill instructions (compatible with Codex & OpenClaw)
├── agents/
│   └── openai.yaml          # Codex UI metadata and invocation policy
├── scripts/
│   └── classviva-extractor.js # Injected extractor, filler, and verifier (runtime-agnostic)
├── references/
│   └── answer-format.md     # Classviva math syntax rules (fractions, roots, powers, etc.)
└── README.md
```

## Installation

### For Codex

Clone or link this repository into your user skills directory:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R classviva-automation-skill "${CODEX_HOME:-$HOME/.codex}/skills/classviva-automation-skill"
```

Validate the skill:

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/classviva-automation-skill"
```

### For OpenClaw

Copy or link this repository into your OpenClaw workspace skills directory:

```bash
mkdir -p "$HOME/.openclaw/workspace/skills"
cp -R classviva-automation-skill "$HOME/.openclaw/workspace/skills/classviva-automation-skill"
openclaw skills info classviva-automation-skill
```

Expected status:

```text
classviva-automation-skill ✓ Ready
```

---

## Usage Guide

### 1. Interactive Scoping

Before opening or starting a quiz attempt, the agent confirms:
1. Target quiz URL, ID, or title.
2. Question scope (defaults to all visible questions).
3. Auto-submit preference (defaults to NO; if YES, requires confirmation immediately before submission).
4. Retry preference (defaults to NO; verifies multiple attempts are permitted by course rules).

---

### 2. Codex Workflow (Playwright CLI)

Open the browser in headed mode for manual login:

```bash
npx --yes --package @playwright/cli playwright-cli open "https://classviva.hkust-gz.edu.cn/" --headed
```

Navigate to the quiz and snapshot the attempt page:

```bash
npx --yes --package @playwright/cli playwright-cli goto "https://classviva.hkust-gz.edu.cn/mod/quiz/view.php?id=<quiz_id>"
npx --yes --package @playwright/cli playwright-cli snapshot
```

Inject the extractor:

```bash
EXTRACTOR="${CODEX_HOME:-$HOME/.codex}/skills/classviva-automation-skill/scripts/classviva-extractor.js"
npx --yes --package @playwright/cli playwright-cli run-code "await page.addScriptTag({ path: '$EXTRACTOR' })"
```

Extract questions with LaTeX:

```bash
npx --yes --package @playwright/cli playwright-cli eval "() => window.ClassvivaExtractor.extract()"
```

Fill confirmed answers:

```bash
npx --yes --package @playwright/cli playwright-cli eval 'answers => window.ClassvivaExtractor.fill(answers)' '{"question-1-1:answer:0":"sqrt(2)"}'
```

Verify recorded values:

```bash
npx --yes --package @playwright/cli playwright-cli eval "() => window.ClassvivaExtractor.verify()"
```

---

### 3. OpenClaw Workflow

Open Classviva for login:

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/"
openclaw browser snapshot
```

In OpenClaw, delegate the quiz work to a `sessions_spawn` worker:

```text
sessions_spawn
  mode: run
  label: classviva-quiz-worker
  runTimeoutSeconds: 7200
  task: |
    Use classviva-automation-skill workflow for the selected quiz.
    Keep all extraction, filling, verification, and optional submit work in this sub-agent.
```

Inject the extractor and extract:

```bash
EXTRACTOR="$HOME/.openclaw/workspace/skills/classviva-automation-skill/scripts/classviva-extractor.js"
openclaw browser evaluate --fn "$(node -e 'const fs=require("fs"); const src=fs.readFileSync(process.argv[1],"utf8"); process.stdout.write(`() => { ${src}; return window.ClassvivaExtractor.version; }`)' "$EXTRACTOR")"
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.extract()'
```

Fill confirmed answers and verify:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.fill({"question-1-1:answer:0":"sqrt(2)"})'
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.verify()'
```

---

## Safety Boundary

- **No credential collection**: Login is strictly manual.
- **No unattended submission**: Auto-submit and retry-until-full-score require explicit opt-in and final confirmation.
- **Respect course rules**: Abort immediately upon attempt limits, lockouts, or policy notices.
- **Math formatting**: Check question-specific instructions first, then consult `references/answer-format.md`.

## Credits

Extractor logic adapted from the MIT-licensed Classviva Question Helper Tampermonkey script by Code IntelliX.
