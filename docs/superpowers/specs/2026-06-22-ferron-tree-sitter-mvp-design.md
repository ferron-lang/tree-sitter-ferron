# Ferron Tree-sitter MVP Design

## Goal

Build a practical Tree-sitter grammar for Ferron v0.2 that is useful in editors:
syntax highlighting, structural navigation, and parser recovery for the current
reference examples in `../ferron`.

## Scope

The MVP targets the language surface used by:

- `../ferron/docs/FERRON_LANGUAGE_SPEC_V0_2.md`
- `../ferron/examples/simple/src/simple.fer`
- `../ferron/examples/logstats/main.fer`

It covers modules, imports, attributes, records, ADTs and variants, resources,
capabilities, actors, tests, functions, effects, blocks, statements, match
expressions, resource `with` blocks, compile-time expressions, calls, member
access, collection literals, string interpolation as recoverable string content,
comments, and common operators.

The MVP does not try to mirror the Rust compiler CST exactly. The compiler in
`../ferron` remains the semantic source of truth. This parser is an editor
grammar optimized for resilience and useful node shapes.

## Architecture

The repository is a standard Tree-sitter grammar package:

- `grammar.js` defines the parser.
- `tree-sitter.json` and `package.json` describe package metadata and file
  types.
- `test/corpus/*.txt` contains parse corpus tests built from Ferron examples.
- `queries/highlights.scm` provides basic editor highlighting.

The grammar is intentionally permissive in expression and type positions where
Ferron semantic validation belongs to the compiler. It should parse incomplete
editor buffers without requiring every future type or expression form to be
fully modeled.

## Testing

Validation uses:

- `tree-sitter generate`
- `tree-sitter test`
- `tree-sitter parse ../ferron/examples/simple/src/simple.fer`
- `tree-sitter parse ../ferron/examples/logstats/main.fer`

If the local machine does not have the Tree-sitter CLI, install dependencies
with `npm install` and run the local CLI through `npx tree-sitter`.
