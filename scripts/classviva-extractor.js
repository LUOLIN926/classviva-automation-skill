(() => {
  'use strict';

  const API_VERSION = '0.1.0';
  const DATA_KEY = 'cvqaKey';
  const DATA_GROUP_KEY = 'cvqaGroupKey';

  function normalizeSpaces(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\r\f\v]+/g, ' ')
      .replace(/ *\n+ */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => {
      const hex = char.charCodeAt(0).toString(16).toUpperCase();
      return '\\' + hex + ' ';
    });
  }

  function attrSelector(name, value) {
    return '[' + name + '="' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]';
  }

  function safeKeyPart(value, fallback) {
    const cleaned = normalizeSpaces(value || fallback || '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return cleaned || String(fallback || 'item');
  }

  function uniqueElements(elements) {
    const seen = new Set();
    return elements.filter((element) => {
      if (!element || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function assignElementKey(element, key) {
    element.dataset[DATA_KEY] = key;
    return attrSelector('data-cvqa-key', key);
  }

  function assignGroupKey(element, key) {
    element.dataset[DATA_GROUP_KEY] = key;
    return attrSelector('data-cvqa-group-key', key);
  }

  function textFromElement(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, input, textarea, select, button, .accesshide').forEach((node) => node.remove());
    return normalizeSpaces(clone.textContent || '');
  }

  function labelForControl(control) {
    const id = control.id;
    const aria = control.getAttribute('aria-label') || control.getAttribute('aria-labelledby');
    const placeholder = control.getAttribute('placeholder');
    const title = control.getAttribute('title');
    if (aria && !aria.includes(' ')) {
      const labelById = document.getElementById(aria);
      if (labelById) return textFromElement(labelById);
    }
    if (aria) return normalizeSpaces(aria);
    if (id) {
      const explicit = document.querySelector('label[for="' + cssEscape(id) + '"]');
      if (explicit) return textFromElement(explicit);
    }
    const wrappingLabel = control.closest('label');
    if (wrappingLabel) return textFromElement(wrappingLabel);
    if (placeholder) return normalizeSpaces(placeholder);
    if (title) return normalizeSpaces(title);

    let previous = control.previousElementSibling;
    for (let i = 0; previous && i < 2; i += 1) {
      const text = textFromElement(previous);
      if (text) return text;
      previous = previous.previousElementSibling;
    }
    return '';
  }

  function shouldIgnoreNode(element) {
    if (!element || !element.matches) return false;
    return element.matches([
      'input[type="hidden"]',
      'script:not([type*="math/tex"])',
      'style',
      'button',
      '.material-icons',
      '.MathJax_Preview',
      'mjx-container',
      '.mjx-chtml',
      '.MathJax_CHTML',
      '.MathJax',
      'p.footer'
    ].join(','));
  }

  function cleanCloneForText(clone) {
    clone.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach((control) => {
      const type = (control.getAttribute('type') || control.tagName || '').toLowerCase();
      const replacement = type === 'radio' || type === 'checkbox' ? ' ' : ' [answer] ';
      const marker = clone.ownerDocument.createTextNode(replacement);
      control.replaceWith(marker);
    });
    clone.querySelectorAll('input[type="hidden"], script:not([type*="math/tex"]), style, button, .material-icons, .MathJax_Preview, mjx-container, .mjx-chtml, .MathJax_CHTML, .MathJax, p.footer').forEach((node) => node.remove());
  }

  function traverseText(node, pieces) {
    if (node.nodeType === 3) {
      const text = normalizeSpaces(node.textContent || '');
      if (text) pieces.push(text);
      return;
    }

    if (node.nodeType !== 1) return;

    const tag = node.tagName;
    if (tag === 'SCRIPT' && (node.type || '').includes('math/tex')) {
      const latex = normalizeSpaces(node.textContent || '');
      if (latex) {
        pieces.push((node.type || '').includes('mode=display') ? '\\[' + latex + '\\]' : '\\(' + latex + '\\)');
      }
      return;
    }

    if (tag === 'ANNOTATION' && (node.getAttribute('encoding') || '').toLowerCase() === 'application/x-tex') {
      const latex = normalizeSpaces(node.textContent || '');
      if (latex) pieces.push('\\(' + latex + '\\)');
      return;
    }

    if (tag === 'BR') {
      pieces.push('\n');
      return;
    }

    if (shouldIgnoreNode(node)) return;

    Array.from(node.childNodes).forEach((child) => traverseText(child, pieces));

    if (['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL'].includes(tag)) {
      pieces.push('\n');
    }
  }

  function extractText(container) {
    if (!container) return '';
    const clone = container.cloneNode(true);
    cleanCloneForText(clone);
    const pieces = [];
    traverseText(clone, pieces);
    return normalizeSpaces(pieces.join(' '));
  }

  function findQuestionElements() {
    const exact = Array.from(document.querySelectorAll('div[id^="question-"]'))
      .filter((element) => /^question-\d+(?:-\d+)?$/.test(element.id) || element.querySelector('.local_testopaqueqe, .formulation, .qtext, .answer'));
    const moodle = Array.from(document.querySelectorAll('.que[id], .que, .question'))
      .filter((element) => element.querySelector('.qtext, .answer, input, textarea, select'));
    return uniqueElements(exact.concat(moodle));
  }

  function contentRootFor(questionElement) {
    return questionElement.querySelector('.local_testopaqueqe, .formulation, .content') || questionElement;
  }

  function questionNumber(questionElement, index) {
    const infoText = textFromElement(questionElement.querySelector('.info .no, .info h3, .qno, .number, .qnbutton .thispageholder'));
    const match = infoText.match(/(?:Question|题目|问题)?\s*(\d+)/i);
    if (match) return match[1];
    const idMatch = (questionElement.id || '').match(/question-(\d+)-(\d+)/);
    if (idMatch) return idMatch[2];
    return String(index + 1);
  }

  function optionLabel(input) {
    const direct = labelForControl(input);
    if (direct) return direct;
    const item = input.closest('.r0, .r1, .answer div, li, p, div');
    if (item) return textFromElement(item);
    return input.value || '';
  }

  function collectControls(questionElement, questionId) {
    const controls = [];
    const root = contentRootFor(questionElement);
    const rawControls = Array.from(root.querySelectorAll('input, textarea, select'))
      .filter((control) => {
        const type = (control.getAttribute('type') || control.tagName || '').toLowerCase();
        return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
      });

    let answerIndex = 0;
    const grouped = new Map();

    rawControls.forEach((control) => {
      const tag = control.tagName.toLowerCase();
      const type = (control.getAttribute('type') || tag).toLowerCase();
      if (type === 'radio' || type === 'checkbox') {
        const groupName = control.name || control.id || type + '-' + grouped.size;
        const mapKey = type + ':' + groupName;
        if (!grouped.has(mapKey)) {
          grouped.set(mapKey, { type, groupName, inputs: [] });
        }
        grouped.get(mapKey).inputs.push(control);
        return;
      }

      const key = questionId + ':answer:' + answerIndex;
      answerIndex += 1;
      const selector = assignElementKey(control, key);
      const controlType = tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : 'text';
      const entry = {
        key,
        type: controlType,
        selector,
        id: control.id || undefined,
        name: control.name || undefined,
        label: labelForControl(control) || undefined,
        value: tag === 'select'
          ? Array.from(control.selectedOptions || []).map((option) => option.value)
          : control.value || ''
      };

      if (tag === 'select') {
        entry.options = Array.from(control.options || []).map((option, index) => ({
          index,
          value: option.value,
          label: normalizeSpaces(option.textContent || option.label || option.value),
          selected: option.selected
        }));
      }

      controls.push(entry);
    });

    Array.from(grouped.values()).forEach((group) => {
      const key = questionId + ':' + group.type + ':' + safeKeyPart(group.groupName, controls.length);
      group.inputs.forEach((input) => assignGroupKey(input, key));
      const options = group.inputs.map((input, index) => {
        const optionKey = key + ':option:' + index;
        const selector = assignElementKey(input, optionKey);
        return {
          index,
          key: optionKey,
          value: input.value,
          label: optionLabel(input),
          selector,
          checked: Boolean(input.checked)
        };
      });
      controls.push({
        key,
        type: group.type,
        selector: attrSelector('data-cvqa-group-key', key),
        name: group.groupName || undefined,
        label: group.groupName || undefined,
        options,
        value: group.type === 'radio'
          ? (options.find((option) => option.checked) || null)
          : options.filter((option) => option.checked).map((option) => option.value)
      });
    });

    return controls;
  }

  function controlSummary(control) {
    if (control.type === 'radio' || control.type === 'checkbox') {
      const optionLines = (control.options || []).map((option) => {
        return '  - [' + option.index + '] value="' + option.value + '" label="' + option.label + '"';
      });
      return '- key `' + control.key + '` type `' + control.type + '` options:\n' + optionLines.join('\n');
    }
    return '- key `' + control.key + '` type `' + control.type + '` label "' + (control.label || '') + '" current "' + (Array.isArray(control.value) ? control.value.join(', ') : control.value || '') + '"';
  }

  function buildAgentPrompt(payload) {
    const lines = [
      '# Classviva Quiz Extraction',
      '',
      'URL: ' + payload.url,
      'Questions: ' + payload.questions.length,
      '',
      'Use this for explanation, answer-format checking, or filling user-confirmed answers. Do not submit the quiz from this payload.'
    ];

    payload.questions.forEach((question) => {
      lines.push('', '## Question ' + question.number, '', question.text || '(No question text extracted)');
      if (question.controls.length > 0) {
        lines.push('', 'Controls:');
        question.controls.forEach((control) => lines.push(controlSummary(control)));
      }
    });

    return lines.join('\n');
  }

  function extract(options = {}) {
    const questionElements = findQuestionElements();
    const questions = questionElements.map((questionElement, index) => {
      const id = questionElement.id || 'question-' + (index + 1);
      const number = questionNumber(questionElement, index);
      const root = contentRootFor(questionElement);
      return {
        id,
        number,
        text: extractText(root),
        controls: collectControls(questionElement, id)
      };
    });

    const payload = {
      version: API_VERSION,
      url: window.location.href,
      title: document.title || '',
      extractedAt: new Date().toISOString(),
      questions
    };

    if (options.agentPrompt !== false) {
      payload.agentPrompt = buildAgentPrompt(payload);
    }

    window.ClassvivaExtractor.lastPayload = payload;
    return payload;
  }

  function dispatchInputEvents(element) {
    ['input', 'change', 'keyup'].forEach((eventName) => {
      element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }

  function matchOption(options, wanted) {
    if (typeof wanted === 'number') {
      return options.find((option) => option.index === wanted);
    }
    const text = normalizeSpaces(wanted);
    return options.find((option) => {
      return option.value === wanted ||
        option.selector === wanted ||
        option.key === wanted ||
        normalizeSpaces(option.label) === text ||
        String(option.index) === String(wanted);
    });
  }

  function findControlByKey(payload, key) {
    for (const question of payload.questions) {
      const found = question.controls.find((control) => control.key === key);
      if (found) return found;
    }
    return null;
  }

  function setSimpleControl(control, wanted) {
    const element = document.querySelector(control.selector);
    if (!element) return { status: 'error', message: 'Element not found', key: control.key };
    if (element.disabled || element.readOnly) return { status: 'skipped', message: 'Element disabled or readonly', key: control.key };

    if (control.type === 'select') {
      const wantedText = normalizeSpaces(wanted);
      const option = Array.from(element.options || []).find((item, index) => {
        return item.value === wanted ||
          normalizeSpaces(item.textContent || item.label || item.value) === wantedText ||
          String(index) === String(wanted);
      });
      if (!option) return { status: 'error', message: 'Select option not found', key: control.key, wanted };
      element.value = option.value;
    } else {
      element.value = String(wanted);
    }

    dispatchInputEvents(element);
    return { status: 'filled', key: control.key, value: element.value };
  }

  function setRadioControl(control, wanted) {
    const option = matchOption(control.options || [], wanted);
    if (!option) return { status: 'error', message: 'Radio option not found', key: control.key, wanted };
    const element = document.querySelector(option.selector);
    if (!element) return { status: 'error', message: 'Radio element not found', key: control.key, wanted };
    if (element.disabled) return { status: 'skipped', message: 'Radio element disabled', key: control.key, wanted };
    element.checked = true;
    dispatchInputEvents(element);
    return { status: 'filled', key: control.key, value: option.value, label: option.label };
  }

  function setCheckboxControl(control, wanted) {
    const options = control.options || [];
    const wants = Array.isArray(wanted) ? wanted : [wanted];
    const singleBoolean = options.length === 1 && typeof wanted === 'boolean';
    const matched = new Set();

    if (!singleBoolean) {
      wants.forEach((item) => {
        const option = matchOption(options, item);
        if (option) matched.add(option.key);
      });
    }

    const results = [];
    options.forEach((option) => {
      const element = document.querySelector(option.selector);
      if (!element) {
        results.push({ option: option.value, status: 'error', message: 'Checkbox element not found' });
        return;
      }
      if (element.disabled) {
        results.push({ option: option.value, status: 'skipped', message: 'Checkbox disabled' });
        return;
      }
      element.checked = singleBoolean ? Boolean(wanted) : matched.has(option.key);
      dispatchInputEvents(element);
      results.push({ option: option.value, label: option.label, checked: element.checked, status: 'filled' });
    });

    return { status: 'filled', key: control.key, options: results };
  }

  function fill(answerMap) {
    const payload = extract({ agentPrompt: false });
    const entries = Object.entries(answerMap || {});
    const results = entries.map(([key, wanted]) => {
      const control = findControlByKey(payload, key);
      if (!control) return { status: 'error', key, message: 'Control key not found; re-run extract and use current keys' };
      if (control.type === 'radio') return setRadioControl(control, wanted);
      if (control.type === 'checkbox') return setCheckboxControl(control, wanted);
      return setSimpleControl(control, wanted);
    });

    return {
      version: API_VERSION,
      filledAt: new Date().toISOString(),
      requested: entries.length,
      filled: results.filter((result) => result.status === 'filled').length,
      results
    };
  }

  function verify() {
    const payload = extract({ agentPrompt: false });
    return {
      version: API_VERSION,
      url: window.location.href,
      verifiedAt: new Date().toISOString(),
      questions: payload.questions.map((question) => ({
        id: question.id,
        number: question.number,
        controls: question.controls.map((control) => ({
          key: control.key,
          type: control.type,
          label: control.label,
          value: control.value,
          options: control.options
        }))
      }))
    };
  }

  const api = {
    version: API_VERSION,
    extract,
    fill,
    verify,
    lastPayload: null
  };

  window.ClassvivaExtractor = api;
  window.ClassvivaQuestionAgent = api;
})();
