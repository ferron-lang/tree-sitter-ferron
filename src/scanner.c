// Statement terminators for Ferron.
//
// A newline ends a statement or item wherever the grammar accepts one, unless
// the next line starts with a continuation token (`ast/body.rs`
// `newline_continues_statement`): `.` (not `..`), a binary operator, `,`, a
// closing bracket, `{`, `|`, or the words `else`, `where`, `receives`.
// Trailing continuations (`a +` at line end) need no check: the parser does not
// accept a terminator there, so the scanner is not asked.

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>

enum TokenType { NEWLINE, ERROR_SENTINEL };

void *tree_sitter_ferron_external_scanner_create(void) { return NULL; }
void tree_sitter_ferron_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_ferron_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_ferron_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

static bool is_word_char(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
}

enum Trivia { CONTINUES, ENDS, DECIDE_ON_LOOKAHEAD };

// Skips blank lines, comments, and attributes after the terminator's end mark,
// so a doc comment or `#[...]` between `| A` and `| B` keeps the variant list.
static enum Trivia skip_trivia(TSLexer *lexer) {
  for (;;) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
           lexer->lookahead == '\n') {
      lexer->advance(lexer, false);
    }
    if (lexer->lookahead == '#') {
      lexer->advance(lexer, false);
      if (lexer->lookahead != '[') return ENDS;
      unsigned depth = 0;
      bool in_string = false;
      do {
        if (lexer->eof(lexer)) return ENDS;
        int32_t c = lexer->lookahead;
        lexer->advance(lexer, false);
        if (in_string) {
          if (c == '\\') lexer->advance(lexer, false);
          else if (c == '"') in_string = false;
        } else if (c == '"') {
          in_string = true;
        } else if (c == '[') {
          depth++;
        } else if (c == ']') {
          depth--;
        }
      } while (depth > 0);
      continue;
    }
    if (lexer->lookahead != '/') return DECIDE_ON_LOOKAHEAD;
    lexer->advance(lexer, false);
    if (lexer->lookahead == '/') {
      while (lexer->lookahead != '\n' && !lexer->eof(lexer)) lexer->advance(lexer, false);
    } else if (lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      for (;;) {
        if (lexer->eof(lexer)) return ENDS;
        int32_t c = lexer->lookahead;
        lexer->advance(lexer, false);
        if (c == '*' && lexer->lookahead == '/') {
          lexer->advance(lexer, false);
          break;
        }
      }
    } else {
      // A `/` operator continues the previous line.
      return CONTINUES;
    }
  }
}

static bool continues_statement(TSLexer *lexer) {
  switch (skip_trivia(lexer)) {
    case CONTINUES: return true;
    case ENDS: return false;
    case DECIDE_ON_LOOKAHEAD: break;
  }
  switch (lexer->lookahead) {
    case '.':
      lexer->advance(lexer, false);
      return lexer->lookahead != '.';
    case '!':
      lexer->advance(lexer, false);
      return lexer->lookahead == '=';
    case '|': case '+': case '-': case '*': case '%': case '&': case '^':
    case '<': case '>': case '=': case '?': case ',': case ')': case ']':
    case '}': case '{':
      return true;
    default:
      break;
  }
  char word[9];
  unsigned length = 0;
  while (is_word_char(lexer->lookahead)) {
    if (length == sizeof(word) - 1) return false;
    word[length++] = (char)lexer->lookahead;
    lexer->advance(lexer, false);
  }
  word[length] = '\0';
  return strcmp(word, "else") == 0 || strcmp(word, "where") == 0 || strcmp(word, "receives") == 0;
}

bool tree_sitter_ferron_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[ERROR_SENTINEL] || !valid_symbols[NEWLINE]) return false;

  bool newline = false;
  for (;;) {
    int32_t c = lexer->lookahead;
    if (c == '\n') {
      newline = true;
    } else if (c != ' ' && c != '\t' && c != '\r' && c != 0xFEFF) {
      break;
    }
    lexer->advance(lexer, true);
  }
  if (lexer->eof(lexer)) {
    lexer->result_symbol = NEWLINE;
    return true;
  }
  if (!newline) return false;

  // Zero-width token before the next line; the peek below is lookahead only.
  lexer->mark_end(lexer);
  if (continues_statement(lexer)) return false;
  lexer->result_symbol = NEWLINE;
  return true;
}
