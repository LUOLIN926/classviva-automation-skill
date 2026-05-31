# OpenClaw Classviva Question Helper Skill

An OpenClaw skill for opening Classviva, guiding manual login, asking which quiz/questions to work on, extracting Classviva/Moodle quiz questions, LaTeX, options, and answer controls into a structured payload, and filling verified answers.

This project is a learning helper. Auto-submit and retry behavior are opt-in, require confirmation for the current quiz, and must not be used to bypass course rules.

## Features

- Extract question text directly from the DOM, avoiding snapshot truncation.
- Preserve LaTeX from MathJax script tags as `\(...\)` and `\[...\]`.
- Return both Markdown (`agentPrompt`) and structured JSON controls.
- Ask the user which quiz/questions to handle and whether permitted auto-submit or retry behavior is desired.
- Fill user-confirmed answers for text, textarea, select, radio, and checkbox controls.
- Verify live Moodle field values after filling.

## Layout

```text
.
├── SKILL.md
├── scripts/
│   └── classviva-extractor.js
└── references/
    └── answer-format.md
```

## Install For OpenClaw

Copy or clone this repository into the OpenClaw workspace skills directory.

```bash
mkdir -p "$HOME/.openclaw/workspace/skills"
cp -R classviva-automation-skill "$HOME/.openclaw/workspace/skills/classviva-automation-skill"
openclaw skills info classviva-automation-skill
```

Expected status:

```text
classviva-automation-skill ✓ Ready
```

## Basic Usage

Open Classviva with OpenClaw and let the user log in manually:

```bash
openclaw browser open "https://classviva.hkust-gz.edu.cn/"
openclaw browser snapshot
```

After login, ask which quiz/questions to handle, whether to auto-submit after verification, and whether to retry if multiple attempts are allowed. Auto-submit and retry are off by default and should only proceed with explicit user confirmation for the current quiz.

On the quiz attempt page, inject the extractor:

```bash
EXTRACTOR_PATH="$HOME/.openclaw/workspace/skills/classviva-automation-skill/scripts/classviva-extractor.js"
openclaw browser evaluate --fn "$(node -e 'const fs=require("fs"); const src=fs.readFileSync(process.argv[1],"utf8"); process.stdout.write(`() => { ${src}; return window.ClassvivaExtractor.version; }`)' "$EXTRACTOR_PATH")"
```

Extract questions:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.extract()'
```

Fill user-confirmed answers:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.fill({"question-1-1:answer:0":"sqrt(2)"})'
```

Verify filled values:

```bash
openclaw browser evaluate --fn '() => window.ClassvivaExtractor.verify()'
```

## Safety Boundary

- Do not ask for credentials; login is manual.
- Do not bypass course rules, attempt limits, lockouts, or warnings.
- Do not submit or retry unless the user explicitly opted in for the current quiz and confirmed the final submit step.
- Follow each question's stated answer requirements first; otherwise strictly follow `references/answer-format.md`.

## Credits

The extractor logic is adapted from the MIT-licensed Classviva Question Helper Tampermonkey project by Code IntelliX.
