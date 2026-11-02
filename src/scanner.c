// Statement and item terminators for Ferron.
//
// Statements follow the compiler's D28 rule (`syntax/lexer.rs`
// `insert_terminators`): a line break ends a statement unless the next line
// starts with a continuation-only token, which is any operator except `-`, `!`,
// `~` and `|` (they can start an expression), `.`, `,`, `in`, `not in`, `else`,
// `and` or `or`. `(`, `[`, `{` and literals always start a new statement.
// Whether the line before can end an expression (an endless `a..` can, `a..=`
// can't), and whether a `(`/`[` is open, needs no check: the parser accepts a
// terminator only after a whole statement, and the scanner is not asked
// otherwise. `script/check-statement-ends.mjs` runs the compiler's
// statement-end corpus against this.
//
// Items are grouped by keyword in the compiler, not by line breaks, so between
// items a line starting with `{`, `|`, `where` or `receives` (or attributes
// before a `| Variant`) continues the item's header or variant list too.

#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>

enum TokenType { NEWLINE, ITEM_NEWLINE, ERROR_SENTINEL };

void *tree_sitter_ferron_external_scanner_create(void) { return NULL; }
void tree_sitter_ferron_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_ferron_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_ferron_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

static bool is_word_char(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
}

static void skip_spaces(TSLexer *lexer) {
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
         lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
  }
}

// Reads a word of at most 8 characters; longer words come back empty.
static void read_word(TSLexer *lexer, char word[9]) {
  unsigned length = 0;
  while (is_word_char(lexer->lookahead)) {
    if (length == 8) {
      length = 0;
      break;
    }
    word[length++] = (char)lexer->lookahead;
    lexer->advance(lexer, false);
  }
  word[length] = '\0';
}

enum Trivia { CONTINUES, ENDS, DECIDE_ON_LOOKAHEAD };

// Skips blank lines and comments after the terminator's end mark (the peek is
// lookahead only, so the comments still become extras); in item mode also
// attributes, so a `#[...]` between `| A` and `| B` keeps the variant list.
static enum Trivia skip_trivia(TSLexer *lexer, bool item) {
  for (;;) {
    skip_spaces(lexer);
    if (item && lexer->lookahead == '#') {
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
      // The `/` operator.
      return CONTINUES;
    }
  }
}

static bool continues_line(TSLexer *lexer, bool item) {
  switch (skip_trivia(lexer, item)) {
    case CONTINUES: return true;
    case ENDS: return false;
    case DECIDE_ON_LOOKAHEAD: break;
  }
  switch (lexer->lookahead) {
    // Lone `-`, `!`, `~`, `|` start an expression; `->`, `-=`, `!=`, `|>`,
    // `||`, `|=` only continue one. Between items a `|` starts the next variant.
    case '-':
      lexer->advance(lexer, false);
      return lexer->lookahead == '>' || lexer->lookahead == '=';
    case '!':
      lexer->advance(lexer, false);
      return lexer->lookahead == '=';
    case '~':
      return false;
    case '|':
      lexer->advance(lexer, false);
      return item || lexer->lookahead == '>' || lexer->lookahead == '|' || lexer->lookahead == '=';
    case '{':
      return item;
    case '+': case '*': case '%': case '=': case '?': case '<': case '>': case '&': case '^':
    case ':': case '.': case ',':
      return true;
    default:
      break;
  }
  char word[9];
  read_word(lexer, word);
  if (strcmp(word, "in") == 0 || strcmp(word, "else") == 0 || strcmp(word, "and") == 0 ||
      strcmp(word, "or") == 0) {
    return true;
  }
  if (item && (strcmp(word, "where") == 0 || strcmp(word, "receives") == 0)) return true;
  if (strcmp(word, "not") == 0) {
    skip_spaces(lexer);
    read_word(lexer, word);
    return strcmp(word, "in") == 0;
  }
  return false;
}

bool tree_sitter_ferron_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[ERROR_SENTINEL]) return false;
  bool statement = valid_symbols[NEWLINE];
  if (!statement && !valid_symbols[ITEM_NEWLINE]) return false;
  lexer->result_symbol = statement ? NEWLINE : ITEM_NEWLINE;

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
  if (lexer->eof(lexer)) return true;
  if (!newline) return false;

  // Zero-width token before the next line; the peek below is lookahead only.
  lexer->mark_end(lexer);
  return !continues_line(lexer, !statement);
}
