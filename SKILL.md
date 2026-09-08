---
name: classviva-automation-skill
description: "Classviva and Moodle quiz helper to extract questions with LaTeX intact, prepare Markdown and JSON controls, fill user-confirmed answers, and verify recorded values in OpenClaw or Codex."
metadata:
  user-invocable: true
  argument-hint: "[start|extract|fill|verify]"
---

# Classviva Question Helper

Extract Classviva/Moodle quiz questions with LaTeX formulas intact, hand the extracted Markdown and JSON payload to an agent for analysis or syntax checking, fill user-confirmed answers, and verify live Moodle recorded values.

Supported agent environments:
- **OpenClaw**: uses `openclaw browser` and `sessions_spawn` sub-agent delegation.
- **Codex**: uses Playwright CLI (`playwright-cli` or `npx @playwright/cli`) or Playwright runtime.

## Core Rules & Safety Boundary

- **Manual login**: Always let the user log in manually. Never ask for, store, or enter credentials.
- **Course rules**: Do not bypass platform constraints or course policies.
- **No unconfirmed submissions**: Auto-submit and retry-until-full-score are OFF by default. They require explicit opt-in for the current quiz and immediate re-confirmation before final submission.
- **Math syntax**: Follow each question's stated answer format first; otherwise strictly adhere to `references/answer-format.md`.

## Files & References

- `scripts/classviva-extractor.js`: Browser-injected script providing `window.ClassvivaExtractor` (`extract()`, `fill()`, `verify()`). Framework-agnostic.
- `references/answer-format.md`: Syntax guide for math expressions (powers, fractions, roots, Greek letters, interval notation, trig functions).
- `agents/openai.yaml`: Codex skill UI interface and invocation policy.

## Skill Path Discovery

Locate `scripts/classviva-extractor.js` based on your active runtime:

- **Codex**:
  ```bash
  EXTRACTOR_PATH="${CODEX_HOME:-$HOME/.codex}/skills/classviva-automation-skill/scripts/classviva-extractor.js"
  ```
- **OpenClaw**:
  ```bash
  EXTRACTOR_PATH="$HOME/.openclaw/workspace/skills/classviva-automation-skill/scripts/classviva-extractor.js"
  ```
- **Source repository checkout**:
  ```bash
  EXTRACTOR_PATH="$(pwd)/scripts/classviva-extractor.js"
  ```

---

## Interactive Initialization

Before opening a quiz attempt, collect user intent in plain language:

1. **Target quiz**: Ask for the quiz URL, quiz ID, title, or navigation path.
2. **Question scope**: Default to all visible questions in the current attempt.
3. **Auto-submit**: Default NO. If enabled, require explicit confirmation again right before submitting.
4. **Retry until full score**: Default NO. If enabled, verify the quiz permits multiple attempts, and stop on lockout, attempt limits, or unexpected feedback.

---

## Workflow: Codex Mode

In Codex, use Playwright CLI (`playwright-cli` or `npx --yes --package @playwright/cli playwright-cli`).

### 1. Open Classviva & Guide Login

```bash
npx --yes --package @playwright/cli playwright-cli open "https://classviva.hkust-gz.edu.cn/" --headed
```

Wait for the user to complete login manually. Snapshot to confirm the session:

```bash
npx --yes --package @playwright/cli playwright-cli snapshot
```

### 2. Navigate to Quiz

```bash
npx --yes --package @playwright/cli playwright-cli goto "https://classviva.hkust-gz.edu.cn/mod/quiz/view.php?id=<quiz_id>"
npx --yes --package @playwright/cli playwright-cli snapshot
```

Confirm this is the intended quiz. If starting a new attempt or continuing, click the attempt button using its snapshot ref:

```bash
npx --yes --package @playwright/cli playwright-cli click <attempt_button_ref>
```

### 3. Inject Extractor

Inject `scripts/classviva-extractor.js` into the page:

```bash
npx --yes --package @playwright/cli playwright-cli run-code "await page.addScriptTag({ path: '$EXTRACTOR_PATH' })"
```

Verify the extractor is ready:

```bash
npx --yes --package @playwright/cli playwright-cli eval "() => window.ClassvivaExtractor && window.ClassvivaExtractor.version"
```

### 4. Extract Questions

```bash
npx --yes --package @playwright/cli playwright-cli eval "() => window.ClassvivaExtractor.extract()"
```

The output contains:
- `agentPrompt`: Markdown representation preserving MathJax LaTeX (`\(...\)` and `\[...\]`).
- `questions`: Structured list of questions and their input `controls` (with keys like `question-1-1:answer:0`).

### 5. Check & Confirm Answers

1. Review `agentPrompt` and reason through answers.
2. Read `references/answer-format.md` to format math expressions.
3. Present proposed answers to the user for confirmation before filling.

### 6. Fill Answers

Construct the answer map and fill without submitting:

```bash
npx --yes --package @playwright/cli playwright-cli eval 'answers => window.ClassvivaExtractor.fill(answers)' '{"question-1-1:answer:0":"sqrt(2)"}'
```

### 7. Verify Values

```bash
npx --yes --package @playwright/cli playwright-cli eval "() => window.ClassvivaExtractor.verify()"
```

Compare reported live values against confirmed answers.

### 8. Optional Submit or Retry

Only proceed if user explicitly opted in:
1. Re-verify values and show a final summary of answers to be submitted.
2. Request final user confirmation immediately before clicking submit.
3. Snapshot, locate Moodle submit/finish button, click it, and handle Moodle's second confirmation modal.
4. Take a screenshot:
   ```bash
   npx --yes --package @playwright/cli playwright-cli screenshot
   ```

---

## Workflow: OpenClaw Mode

In OpenClaw, use `openclaw browser` and delegate quiz execution to a sub-agent to keep the main session free.

### 1. Open Classviva & Manual Login

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/"
openclaw browser snapshot
```

Prompt the user to complete login in the browser. Confirm with `openclaw browser snapshot`.

### 2. Sub-agent Delegation

Collect quiz choices and spawn exactly one `sessions_spawn` worker:

```text
sessions_spawn
  mode: run
  label: classviva-quiz-worker
  runTimeoutSeconds: 7200
  task: |
    You are the Classviva quiz worker sub-agent. The main session must stay free; do all Classviva quiz work in this sub-agent.

    Context:
    - User logged in manually.
    - Target quiz: <URL/ID/title>
    - Questions scope: <all or specific>
    - Auto-submit: <yes/no>
    - Retry until full score: <yes/no>

    Workflow:
    1. Open quiz attempt: openclaw browser open "<quiz_url>"
    2. Inject extractor: scripts/classviva-extractor.js
    3. Extract questions: window.ClassvivaExtractor.extract()
    4. Format math answers per references/answer-format.md
    5. Fill confirmed answers: window.ClassvivaExtractor.fill(answerMap)
    6. Verify: window.ClassvivaExtractor.verify()
    7. If auto-submit is enabled, require immediate confirmation before clicking submit.
    8. Report final summary back to main session.
```

### 3. OpenClaw Browser Commands

Inside the worker (or direct session):

- **Inject extractor**:
  ```bash
  openclaw browser evaluate --fn "$(node -e 'const fs=require("fs"); const src=fs.readFileSync(process.argv[1],"utf8"); process.stdout.write(`() => { ${src}; return window.ClassvivaExtractor.version; }`)' "$EXTRACTOR_PATH")"
  ```
- **Extract**:
  ```bash
  openclaw browser evaluate --fn '() => window.ClassvivaExtractor.extract()'
  ```
- **Fill**:
  ```bash
  openclaw browser evaluate --fn '() => window.ClassvivaExtractor.fill({"question-1-1:answer:0":"sqrt(2)"})'
  ```
- **Verify**:
  ```bash
  openclaw browser evaluate --fn '() => window.ClassvivaExtractor.verify()'
  ```
- **Snapshot / Click**:
  ```bash
  openclaw browser snapshot
  openclaw browser click <ref>
  ```

---

## Control Value Formats

The `ClassvivaExtractor.fill(answerMap)` method accepts:

- **Text / Textarea / Select**: String value (e.g. `"sqrt(2)"`, `"optionA"`).
- **Radio**: Option value, label text, selector, or zero-based option index (e.g. `"A"` or `0`).
- **Checkbox**: Array of option values/labels/indexes (e.g. `["A", "B"]`), or boolean for single toggle (`true`/`false`).

The filler dispatches native `input` and `change` events so Moodle saves the state reliably.
