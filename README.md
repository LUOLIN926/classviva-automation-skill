# OpenClaw Classviva Question Helper Skill

An OpenClaw skill for extracting Classviva/Moodle quiz questions, LaTeX, options, and answer controls into a structured payload that an agent can use for explanation, answer-format checking, or filling user-confirmed answers.

This project is a learning helper. It is not an auto-solver and it does not submit graded coursework.

## Features

- Extract question text directly from the DOM, avoiding snapshot truncation.
- Preserve LaTeX from MathJax script tags as `\(...\)` and `\[...\]`.
- Return both Markdown (`agentPrompt`) and structured JSON controls.
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

Open a logged-in Classviva quiz page with OpenClaw, then inject the extractor:

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

- Do not use this skill to auto-solve graded coursework.
- Do not use this skill to click final submit buttons or confirmation dialogs.
- Only fill answers that the user has confirmed.

## Credits

The extractor logic is adapted from the MIT-licensed Classviva Question Helper Tampermonkey project by Code IntelliX.
