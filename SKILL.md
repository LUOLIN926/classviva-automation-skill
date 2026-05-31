---
name: classviva-automation-skill
description: "Classviva/Moodle quiz learning helper for OpenClaw. Use when opening Classviva, guiding manual login, asking which quiz/questions to work on, then spawning exactly one sub-agent to extract question text, LaTeX, answer controls, options, and current values, prepare Markdown plus JSON for answer work, fill confirmed answers, verify Moodle recorded values, and handle confirmed auto-submit or retry behavior. Do not bypass course rules or auto-submit graded coursework without explicit user confirmation."
user-invocable: true
argument-hint: "[start|extract|fill|verify]"
---

# Classviva Question Helper

Use this OpenClaw skill to extract Classviva quiz questions with LaTeX intact, hand the extracted Markdown/JSON to an agent for explanation or answer checking, fill answers that the user has already confirmed, and verify that Moodle recorded the values.

Do not bypass course rules. Auto-submit and retry-until-full-score are off by default and require explicit user confirmation for the current quiz. If the quiz is graded and the user has not confirmed that automation is allowed, stop at extraction, explanation, filling confirmed answers, and verification.

Use exactly one OpenClaw sub-agent for quiz work so the main session is not occupied. The main agent only opens Classviva for login, collects user choices, spawns the worker, and reports the worker's result.

## Files

- `scripts/classviva-extractor.js`: browser-injected extractor/fill/verify API.
- `references/answer-format.md`: Classviva math answer syntax rules. Read it before validating or filling math expressions.

## Start Workflow

Always start by opening Classviva and letting the user log in manually:

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/"
openclaw browser snapshot
```

If the page is not logged in, tell the user to finish login in the browser. Do not ask for or type the user's password. After the user says login is complete, run:

```bash
openclaw browser snapshot
```

Before opening a quiz attempt, ask the user these questions in plain language:

1. Which quiz or assignment should I work on? Ask for the quiz URL, quiz id, title, or enough course/timeline detail to locate it.
2. Which questions should I handle? Default to all visible questions in the current attempt.
3. Should I auto-submit after filling verified answers? Default: no. If yes, require explicit confirmation again immediately before final submission.
4. Should I retry/re-attempt until full score if the platform allows multiple attempts? Default: no. If yes, confirm that retries are allowed by the course rules and stop after any attempt limit, lockout, or non-full score that needs user judgment.

Then spawn exactly one sub-agent to perform the quiz work. Do not continue the quiz workflow in main.

## Sub-agent Delegation

After login and user choices are collected, use one `sessions_spawn` worker:

```text
sessions_spawn
  mode: run
  label: classviva-quiz-worker
  runTimeoutSeconds: 7200
  task: |
    You are the Classviva quiz worker sub-agent. The main session must stay free; do all Classviva quiz work in this sub-agent.

    Context:
    - The user has manually logged in to Classviva in the OpenClaw browser.
    - Quiz target: <quiz URL/id/title from user>
    - Question scope: <all visible questions or selected question numbers>
    - Auto-submit: <yes/no>. Default no.
    - Retry until full score: <yes/no>. Default no.

    Required workflow:
    1. Open the quiz or continue from the current Classviva tab.
    2. Confirm this is the intended quiz before starting/continuing an attempt.
    3. Load `scripts/classviva-extractor.js` from the OpenClaw workspace skill path.
    4. Extract questions with `window.ClassvivaExtractor.extract()`.
    5. Read `references/answer-format.md` before formatting math answers.
    6. Follow each question's own answer-format instructions first; otherwise strictly follow `answer-format.md`.
    7. Fill only answers that are confirmed in the worker context or confirmed by the user during the run.
    8. Verify with `window.ClassvivaExtractor.verify()` after filling.
    9. If auto-submit is enabled, summarize answers and request final confirmation immediately before clicking submit.
    10. If retry-until-full-score is enabled, retry only within course rules and stop on attempt limits, lockouts, ambiguous feedback, or any warning.
    11. Report final status, filled questions, verification result, submit/retry outcome, and any blockers back to the main session.

    Safety:
    - Do not ask for credentials.
    - Do not bypass course rules.
    - Do not hide progress in a background loop.
    - Do not submit unless the user explicitly opted in for this quiz and confirmed the final submit step.
```

The main agent should tell the user that a sub-agent has been started and then wait for/report the worker result.

When the sub-agent opens the quiz, use:

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/mod/quiz/view.php?id=<quiz_id>"
openclaw browser snapshot
```

If the page shows a start/continue attempt button, click it with the ref from the snapshot only after the user confirms this is the intended quiz.

## Load The Extractor

Use the active OpenClaw workspace copy when available:

```bash
EXTRACTOR_PATH="$HOME/.openclaw/workspace/skills/classviva-automation-skill/scripts/classviva-extractor.js"
```

If working from the source checkout instead, use:

```bash
EXTRACTOR_PATH="/Users/lin/Desktop/classviva-automation-skill/scripts/classviva-extractor.js"
```

Inject the script into the current page:

```bash
openclaw browser evaluate --fn "$(node -e 'const fs=require("fs"); const src=fs.readFileSync(process.argv[1],"utf8"); process.stdout.write(`() => { ${src}; return window.ClassvivaExtractor.version; }`)' "$EXTRACTOR_PATH")"
```

## Extract Questions

Run extraction after the attempt page is loaded:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.extract()'
```

Use `agentPrompt` for human-readable analysis and `questions[].controls[]` for structured filling. The extractor reads the DOM directly, so it is not limited by `openclaw browser snapshot` truncation.

Expected payload shape:

```json
{
  "questions": [
    {
      "id": "question-1-1",
      "number": "1",
      "text": "Question text with \\(...\\) and \\[...\\]",
      "controls": [
        {
          "key": "question-1-1:answer:0",
          "type": "text",
          "selector": "[data-cvqa-key=\"question-1-1:answer:0\"]",
          "label": "Answer"
        }
      ]
    }
  ],
  "agentPrompt": "Markdown for explanation or answer checking"
}
```

## Explain Or Check Answers

When handing content to an agent:

1. Provide the extracted `agentPrompt`.
2. Read `references/answer-format.md` before judging answer syntax.
3. Ask for explanation, intermediate reasoning, and syntax checking.
4. Require the user to confirm any final answer before filling it into the quiz page.
5. Follow the exact answer format required by the question first. If the question does not state a special format, strictly follow `references/answer-format.md`.

## Fill User-Confirmed Answers

Build an answer map from extracted control keys to user-confirmed values:

```json
{
  "question-1-1:answer:0": "sqrt(2)",
  "question-1-2:radio:q123:answer": "A"
}
```

Fill without submitting:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.fill({"question-1-1:answer:0":"sqrt(2)"})'
```

Supported values:

- Text, textarea, and select controls: string value.
- Radio controls: option value, label text, selector, or zero-based option index.
- Checkbox controls: array of option values/labels/selectors/indexes, or a boolean for a single checkbox.

The filler sets values and dispatches `input` and `change` events so Moodle can record the update.

## Verify Values

After filling, verify the live page state:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.verify()'
```

Compare the reported values against the user-confirmed answer map. If values are missing, do not submit; re-extract and fill again using the current keys.

## Optional Submit Or Retry

Submission is a separate step and is never enabled by default.

If the user explicitly opted into auto-submit for this quiz:

1. Verify all filled values with `window.ClassvivaExtractor.verify()`.
2. Summarize the answers that will be submitted.
3. Ask for final confirmation immediately before clicking the submit control.
4. Use `openclaw browser snapshot` to find the Moodle submit/finish controls and click only the relevant refs.
5. Handle Moodle's second confirmation dialog/page only after the user has already confirmed auto-submit for this quiz.
6. Take a screenshot or snapshot after submission and report the result.

If the user explicitly opted into retry-until-full-score:

1. Only proceed if the quiz allows multiple attempts and the user confirms retrying is permitted.
2. After each submitted attempt, inspect the score/review page.
3. If full score is achieved, stop and report.
4. If not full score, report the score and any visible feedback, then ask before starting another attempt unless the user already gave explicit retry permission for this quiz.
5. Stop immediately on attempt limits, lockouts, missing feedback, ambiguous scoring, or any course-policy warning.

## Safety Rules

- Do not ask for credentials; login is manual.
- Do not submit or retry unless the user explicitly opted in for the current quiz and confirmed the final submission step.
- Do not run a background loop that hides progress from the user.
- Do not bypass course rules, attempt limits, lockouts, or warnings.
- For math answers, obey the question's special instructions first; otherwise strictly follow `references/answer-format.md`.
