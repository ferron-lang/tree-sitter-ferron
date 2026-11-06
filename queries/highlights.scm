(line_comment) @comment
(block_comment) @comment

; Only the quotes and text are string: an interpolation's `{expr}` keeps
; expression colors, so `{"left":<8}` shows a nested string literal.
(string "\"" @string)
(raw_string) @string
(string_content) @string
(escape_sequence) @string.escape
(brace_escape) @string.escape
(format_spec) @string.special

(number) @number
(boolean) @constant.builtin

[
  "actor"
  "as"
  "const"
  "dyn"
  "send"
  "fn"
  "impl"
  "on"
  "receives"
  "resource"
  "struct"
  "newtype"
  "opaque"
  "extern"
  "trait"
  "type"
  "use"
  "where"
  "let"
  "var"
  "with"
  "move"
  "comptime"
  "not"
  "in"
  "and"
  "or"
] @keyword

; Not in the list above: a mode `(mut)` would match `"mut"` too.
(unary_expression
  operator: "mut" @keyword)

[
  "if"
  "else"
  "match"
  "for"
  "while"
  "return"
  "break"
  "continue"
  (exit_statement)
] @keyword.control

[
  (visibility)
  (take)
  (mut)
] @keyword.modifier

(self) @variable.builtin

(attribute
  "#" @attribute
  name: (identifier) @attribute)

(use_path) @module
(path_type
  (identifier) @module)

(function_declaration
  name: (identifier) @function)
(extern_function
  name: (_) @function)

(call_expression
  function: (identifier) @function.call)
(call_expression
  function: (member_expression
    property: (identifier) @function.method.call))

(member_expression
  property: (identifier) @property)
(field_declaration
  name: (identifier) @property)
(field_initializer
  name: (identifier) @property)
(shorthand_field_initializer
  (identifier) @property)
(field_pattern
  name: (identifier) @property)
(named_argument
  name: (identifier) @variable.parameter)

(parameter
  name: (identifier) @variable.parameter)
(closure_parameters
  name: (identifier) @variable.parameter)

(label
  (identifier) @label)
(break_statement
  label: (identifier) @label)
(continue_statement
  label: (identifier) @label)

(primitive_type) @type.builtin
(type_identifier) @type
(constructor_identifier) @constructor
(variant_declaration
  name: (type_identifier) @constructor)

[
  "+" "-" "*" "**" "/" "%" "&+" "&-" "&*"
  "==" "!=" "<" "<=" ">" ">="
  "&&" "||" "!" "~" "&" "|" "^" "<<" ">>"
  "=" "+=" "-=" "*=" "/=" "%=" "&=" "|=" "^=" "<<=" ">>=" "**="
  ".." "..=" "?" "->" "=>" "@"
] @operator

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," "." ":" ";"] @punctuation.delimiter

; After the generic brackets: for one node the last matching pattern wins.
(interpolation
  "{" @punctuation.special
  "}" @punctuation.special)
