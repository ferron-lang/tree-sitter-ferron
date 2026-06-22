# Ferron Tree-sitter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a working Tree-sitter grammar package for Ferron v0.2 that parses the current reference examples and exposes basic highlights.

**Architecture:** Use a conventional `grammar.js` parser with permissive expression/type handling where semantic precision belongs to the Ferron compiler. Add corpus tests first, then implement the minimal grammar needed to parse the examples and common v0.2 forms. Keep highlighting in `queries/highlights.scm` independent from parser generation.

**Tech Stack:** Tree-sitter CLI, JavaScript grammar DSL, Node/npm package metadata, Tree-sitter corpus tests and highlight queries.

---

### Task 1: Package Metadata And RED Corpus

**Files:**
- Create: `package.json`
- Create: `tree-sitter.json`
- Create: `test/corpus/simple.txt`
- Create: `test/corpus/logstats_fragments.txt`

- [ ] **Step 1: Add package metadata**

Create `package.json` with:

```json
{
  "name": "tree-sitter-ferron",
  "version": "0.1.0",
  "description": "Ferron grammar for tree-sitter",
  "type": "module",
  "main": "bindings/node",
  "keywords": [
    "tree-sitter",
    "ferron"
  ],
  "license": "MIT",
  "devDependencies": {
    "tree-sitter-cli": "^0.25.0"
  },
  "scripts": {
    "generate": "tree-sitter generate",
    "test": "tree-sitter test",
    "parse:examples": "tree-sitter parse ../ferron/examples/simple/src/simple.fer ../ferron/examples/logstats/main.fer"
  },
  "tree-sitter": [
    {
      "scope": "source.ferron",
      "file-types": [
        "fer"
      ]
    }
  ]
}
```

Create `tree-sitter.json` with language metadata for `source.ferron` and `.fer`.

- [ ] **Step 2: Add RED corpus tests**

Create corpus tests that exercise the simple example, module/import structure,
records, ADTs, functions, effects, match, actors, and tests.

- [ ] **Step 3: Run RED command**

Run: `npx tree-sitter test`

Expected before grammar implementation: failure because `grammar.js` or generated parser files do not exist.

### Task 2: Grammar Implementation

**Files:**
- Create: `grammar.js`

- [ ] **Step 1: Implement lexical extras**

Define whitespace, `//` line comments, and `/* ... */` block comments as extras.

- [ ] **Step 2: Implement declarations**

Implement `module`, `use`, `record`, `type`, variants, `resource`, `cap`, `actor`, `test`, `const`, and `fn`.

- [ ] **Step 3: Implement blocks, statements, and expressions**

Implement blocks, `let`, `var`, `return`, `continue`, `exit`, `with`, `match`, calls, member access, unary/binary operators, list literals, record literals, lambdas, paths, strings, numbers, and booleans.

- [ ] **Step 4: Run GREEN command**

Run: `npx tree-sitter generate && npx tree-sitter test`

Expected after grammar implementation: parser generation succeeds and corpus tests pass.

### Task 3: Highlight Queries And Example Parse Checks

**Files:**
- Create: `queries/highlights.scm`

- [ ] **Step 1: Add highlight captures**

Capture Ferron keywords, attributes, functions, types, constructors, strings,
numbers, comments, operators, and punctuation.

- [ ] **Step 2: Parse real examples**

Run:

```bash
npx tree-sitter parse ../ferron/examples/simple/src/simple.fer ../ferron/examples/logstats/main.fer
```

Expected: parse trees are printed without `ERROR` nodes for the current examples.

- [ ] **Step 3: Final verification**

Run:

```bash
npm test
npm run parse:examples
```

Expected: tests pass and example parsing succeeds.

## Self-Review

The plan covers package metadata, tests, grammar, highlighting, and example
verification. It intentionally leaves exact compiler-CST parity out of scope
because the MVP target is editor usefulness and parse resilience.
