---
name: classviva-automation-skill
description: "Classviva/Moodle quiz learning helper for OpenClaw. Use when extracting Classviva question text, LaTeX, answer controls, options, and current values; preparing Markdown plus JSON for an agent to explain or check answers; filling user-confirmed answers; and verifying Moodle recorded those values. Do not use to auto-solve or auto-submit graded coursework."
user-invocable: true
argument-hint: "[extract|fill|verify]"
---

# Classviva Question Helper

Use this OpenClaw skill to extract Classviva quiz questions with LaTeX intact, hand the extracted Markdown/JSON to an agent for explanation or answer checking, fill answers that the user has already confirmed, and verify that Moodle recorded the values.

Do not auto-solve graded coursework, do not invent final answers on behalf of the user, and do not submit attempts. Submission is outside this skill.

## Files

- `scripts/classviva-extractor.js`: browser-injected extractor/fill/verify API.
- `references/answer-format.md`: Classviva math answer syntax rules. Read it before validating or filling math expressions.

## Open The Quiz

Use the logged-in OpenClaw browser context.

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/mod/quiz/view.php?id=<quiz_id>"
openclaw browser snapshot
```

If the page shows a start/continue attempt button, click it with the ref from the snapshot. If login is required, ask the user to log in manually.

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

## Safety Rules

- Do not click final submit buttons or confirmation dialogs from this skill.
- Do not run a background loop that answers the quiz without user participation.
- If the user asks for automatic submission, decline that part and continue with extraction, explanation, filling confirmed answers, and verification.
- For math answers, use ASCII symbols and the reference syntax file.
