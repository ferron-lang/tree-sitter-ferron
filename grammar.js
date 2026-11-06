/**
 * @file Ferron grammar for tree-sitter
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Mirrors the compiler's Pratt binding powers (`ast/expr/parser.rs`).
const PREC = {
  assign: -1,
  or: 2,
  and: 3,
  compare: 4,
  range: 5,
  bit_or: 6,
  bit_xor: 7,
  bit_and: 8,
  shift: 9,
  add: 10,
  multiply: 11,
  unary: 12,
  // `**` binds tighter than a unary operator on its left (D75).
  power: 13,
  postfix: 14,
};

const ASSIGNMENT_OPERATORS = [
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
  "**=",
  "&+=",
  "&-=",
  "&*=",
];

const commaSep = (rule) => optional(commaSep1(rule));
const commaSep1 = (rule) => seq(rule, repeat(seq(",", rule)), optional(","));
const sep1 = (rule, separator) => seq(rule, repeat(seq(separator, rule)));
// Newline- or `;`-separated members of a braced body.
// Members of a braced body separated by `terminator`.
const lines = (rule, terminator) =>
  optional(seq(sep1(rule, terminator), optional(terminator)));

export default grammar({
  name: "ferron",

  word: ($) => $.identifier,

  externals: ($) => [$._newline, $._item_newline, $._error_sentinel],

  extras: ($) => [/[\s\uFEFF\u2060\u200B]/, $.line_comment, $.block_comment],

  supertypes: ($) => [$._expression, $._type, $._pattern],

  conflicts: ($) => [
    [$._expression, $.generic_type_identifier],
    [$._expression, $.struct_literal],
    [$._expression, $.path_type],
    [$._expression, $.label],
  ],

  rules: {
    source_file: ($) => lines($._item, $._item_terminator),

    // Statements end per the compiler's D28 rule; items and fields also let a
    // header or variant list continue on lines starting with `{`, `|`, `where`.
    _terminator: ($) => choice($._newline, ";"),
    _item_terminator: ($) => choice($._item_newline, ";"),

    line_comment: (_) => token(seq("//", /.*/)),
    block_comment: (_) => token(seq("/*", /([^*]|\*+[^*/])*\*+/, "/")),

    _item: ($) =>
      choice(
        $.use_declaration,
        $.const_declaration,
        $.struct_declaration,
        $.type_declaration,
        $.newtype_declaration,
        $.opaque_type_declaration,
        $.extern_block,
        $.trait_declaration,
        $.impl_declaration,
        $.resource_declaration,
        $.actor_declaration,
        $.function_declaration,
      ),

    // `pub(pkg)` (D59) is one token, as in the compiler's lexer.
    visibility: (_) => choice("pub", "pub(pkg)"),

    attribute: ($) =>
      seq(
        "#",
        "[",
        field("name", $.identifier),
        optional(field("arguments", $.attribute_arguments)),
        "]",
      ),
    attribute_arguments: ($) =>
      seq(
        "(",
        commaSep(choice($.attribute_named_argument, $._attribute_value)),
        ")",
      ),
    // `rename: "term"`, `close = LLVMContextDispose`.
    attribute_named_argument: ($) =>
      seq(
        field("name", $.identifier),
        choice(":", "="),
        field("value", $._attribute_value),
      ),
    _attribute_value: ($) =>
      choice(
        $.identifier,
        $.type_identifier,
        $.string,
        $.raw_string,
        $.number,
        $.negative_number,
        $.boolean,
      ),

    // `use std.io.{Reader, Writer as W}`; segments may be keywords.
    use_declaration: ($) =>
      seq(
        optional($.visibility),
        "use",
        field("path", $.use_path),
        choice(
          seq(".", field("group", $.use_group)),
          optional($.use_alias),
        ),
      ),
    use_path: (_) =>
      token(seq(/[A-Za-z_][A-Za-z0-9_]*/, repeat(seq(".", /[A-Za-z_][A-Za-z0-9_]*/)))),
    use_group: ($) => seq("{", commaSep1($.use_item), "}"),
    use_item: ($) => seq(field("path", $.use_path), optional($.use_alias)),
    use_alias: ($) =>
      seq(
        "as",
        field(
          "alias",
          choice($.identifier, $.type_identifier, $.wildcard_import),
        ),
      ),
    wildcard_import: (_) => "_",

    const_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "const",
        field("name", choice($.identifier, $.type_identifier)),
        optional(seq(":", field("type", $._type))),
        "=",
        field("value", $._expression),
      ),

    struct_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "struct",
        field("name", $.type_identifier),
        optional(field("type_parameters", $.type_parameters)),
        optional(seq(":", field("marker", $.identifier))),
        repeat($.where_clause),
        field("body", $.field_declaration_list),
      ),
    field_declaration_list: ($) =>
      seq(
        "{",
        optional(
          seq(
            sep1($.field_declaration, choice(",", $._item_terminator)),
            optional(choice(",", $._item_terminator)),
          ),
        ),
        "}",
      ),
    field_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        field("name", $.identifier),
        ":",
        field("type", $._type),
      ),

    // ADTs (`= | A(x: T) | B`, or `= A(x: T) | B` with the first `|` left
    // out) and refinements (`= Int where value > 0`).
    type_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "type",
        field("name", $.type_identifier),
        optional(field("type_parameters", $.type_parameters)),
        optional(seq(":", field("marker", $.identifier))),
        "=",
        choice(
          field("variants", $.variant_list),
          seq(
            field("value", $._type),
            optional(seq("where", field("predicate", $._expression))),
          ),
        ),
      ),
    // `newtype UserId = Int`, `pub newtype X = pub Base where value > 0`.
    newtype_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "newtype",
        field("name", $.type_identifier),
        optional(field("type_parameters", $.type_parameters)),
        "=",
        optional(field("base_visibility", $.visibility)),
        field("base", $._type),
        optional(seq("where", field("predicate", $._expression))),
      ),
    // `opaque type LLVMOpaqueContext`: a C type known only by address.
    opaque_type_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "opaque",
        "type",
        field("name", $.type_identifier),
      ),

    variant_list: ($) =>
      prec.right(
        seq(
          optional(alias($._bare_variant_declaration, $.variant_declaration)),
          repeat1($.variant_declaration),
        ),
      ),
    // `| IntEQ = 32`: a payload-less variant may carry an explicit value.
    _bare_variant_declaration: ($) =>
      seq(
        field("name", $.type_identifier),
        optional(
          choice(field("fields", $.variant_field_list), $._variant_value),
        ),
      ),
    variant_declaration: ($) =>
      prec.right(
        seq(
          repeat($.attribute),
          "|",
          field("name", $.type_identifier),
          optional(
            choice(field("fields", $.variant_field_list), $._variant_value),
          ),
        ),
      ),
    variant_field_list: ($) => seq("(", commaSep($.field_declaration), ")"),
    _variant_value: ($) =>
      seq("=", field("value", choice($.number, $.negative_number))),

    trait_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "trait",
        field("name", $.type_identifier),
        optional(field("type_parameters", $.type_parameters)),
        optional(seq(":", field("supertraits", $.trait_bounds))),
        repeat($.where_clause),
        field("body", $.declaration_list),
      ),

    impl_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "impl",
        optional(field("type_parameters", $.type_parameters)),
        choice(
          seq(field("trait", $._type), "for", field("type", $._type)),
          field("type", $._type),
        ),
        repeat($.where_clause),
        field("body", $.declaration_list),
      ),

    declaration_list: ($) =>
      seq(
        "{",
        lines(
          choice(
            $.associated_type_declaration,
            $.const_declaration,
            $.function_declaration,
          ),
          $._item_terminator,
        ),
        "}",
      ),

    associated_type_declaration: ($) =>
      seq(
        "type",
        field("name", $.type_identifier),
        optional(seq("=", field("value", $._type))),
      ),

    resource_declaration: ($) =>
      prec.right(
        seq(
          repeat($.attribute),
          optional($.visibility),
          "resource",
          field("name", $.type_identifier),
          optional(seq("{", "}")),
        ),
      ),

    actor_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility),
        "actor",
        field("name", $.type_identifier),
        field("parameters", $.parameters),
        optional(seq("receives", field("receives", $._type))),
        field("body", $.actor_body),
      ),
    actor_body: ($) =>
      seq("{", lines(choice($.on_handler, $._statement), $._terminator), "}"),
    on_handler: ($) =>
      seq(
        "on",
        field("message", choice($.identifier, $.type_identifier, $.path_type)),
        optional(field("arguments", $.pattern_arguments)),
        field("body", $.block),
      ),

    // A body-less function is an intrinsic or a trait requirement.
    function_declaration: ($) =>
      prec.right(
        seq(
          repeat($.attribute),
          optional($.visibility),
          "fn",
          field("name", $.identifier),
          optional(field("type_parameters", $.type_parameters)),
          field("parameters", $.parameters),
          optional(seq("->", field("return_type", $._type))),
          repeat($.where_clause),
          optional(field("body", $.block)),
        ),
      ),

    // `extern "C" { pub fn f(x: i32) -> i32 }`: C signatures, no bodies;
    // C names may start upper-case (`LLVMContextCreate`).
    extern_block: ($) =>
      seq(
        "extern",
        field("abi", $.string),
        "{",
        lines($.extern_function, $._item_terminator),
        "}",
      ),
    extern_function: ($) =>
      seq(
        optional($.visibility),
        "fn",
        field("name", choice($.identifier, $.type_identifier)),
        field("parameters", $.parameters),
        optional(seq("->", field("return_type", $._type))),
      ),

    parameters: ($) =>
      seq("(", commaSep(choice($.self_parameter, $.parameter)), ")"),
    self_parameter: ($) => seq(optional($._mode), $.self),
    parameter: ($) =>
      choice(
        seq(
          optional($.take),
          field("name", choice($.identifier, $._mode_identifier)),
          ":",
          optional($._mode),
          field("type", $._type),
        ),
        $._pattern_parameter,
      ),
    // `(a, b): take Pair` or `take (a, b): Pair`.
    _pattern_parameter: ($) =>
      seq(
        optional($.take),
        field("pattern", $._parameter_pattern),
        ":",
        optional($._mode),
        field("type", $._type),
      ),
    // An irrefutable destructuring parameter (D50); a plain name is `name`.
    _parameter_pattern: ($) =>
      choice(
        $.at_pattern,
        $.constructor_pattern,
        $.struct_pattern,
        $.tuple_pattern,
        $.wildcard_pattern,
      ),
    // `mut` and `take` are contextual (D68): elsewhere they are names.
    _mode: ($) => choice($.mut, $.take),
    _mode_identifier: ($) => alias(choice("mut", "take"), $.identifier),
    mut: (_) => "mut",
    take: (_) => "take",
    self: (_) => "self",

    type_parameters: ($) => seq("[", commaSep1($.type_parameter), "]"),
    type_parameter: ($) =>
      seq(
        field("name", $.type_identifier),
        optional(seq(":", field("bounds", $.trait_bounds))),
      ),
    trait_bounds: ($) => sep1($._type, "+"),

    where_clause: ($) => seq("where", commaSep1($.where_predicate)),
    where_predicate: ($) =>
      seq(field("left", $._type), ":", field("bounds", $.trait_bounds)),

    // Types

    _type: ($) =>
      choice(
        $.generic_type,
        $.function_type,
        $.callable_type,
        $.tuple_type,
        $.path_type,
        $.type_identifier,
        alias($.identifier, $.primitive_type),
      ),

    generic_type: ($) =>
      prec(
        1,
        seq(
          field("name", choice($.path_type, $.type_identifier, alias($.identifier, $.primitive_type))),
          field("arguments", $.type_arguments),
        ),
      ),
    type_arguments: ($) =>
      seq("[", commaSep1(choice($.associated_type_binding, $._type)), "]"),
    associated_type_binding: ($) =>
      seq(field("name", $.type_identifier), "=", field("value", $._type)),

    path_type: ($) =>
      seq(
        choice($.identifier, $.type_identifier),
        repeat1(seq(".", choice($.identifier, $.type_identifier))),
      ),

    function_type: ($) =>
      prec.right(
        seq(
          "fn",
          field("parameters", $.tuple_type),
          optional(seq("->", field("return_type", $._type))),
        ),
      ),

    // `dyn Callable[(A), R] + send` may cross actors (D68).
    callable_type: ($) =>
      choice(
        seq("impl", field("type", choice($.generic_type, $.type_identifier))),
        prec.right(
          seq(
            "dyn",
            field("type", choice($.generic_type, $.type_identifier)),
            optional(field("marker", $.send_marker)),
          ),
        ),
      ),
    send_marker: (_) => seq("+", "send"),

    // Modes appear in function types: `Callable[(mut Rng, Int), T]`.
    tuple_type: ($) => seq("(", commaSep(choice($._type, $.moded_type)), ")"),
    moded_type: ($) => seq($._mode, field("type", $._type)),

    // Statements

    block: ($) => prec(1, seq("{", lines($._statement, $._terminator), "}")),

    _statement: ($) =>
      choice(
        $.let_statement,
        $.var_statement,
        $.return_statement,
        $.break_statement,
        $.continue_statement,
        $.exit_statement,
        $.for_statement,
        $.while_statement,
        $.with_statement,
        $.assignment_statement,
        $.expression_statement,
      ),

    let_statement: ($) =>
      seq(
        "let",
        field("pattern", $._pattern),
        optional(seq(":", field("type", $._type))),
        optional(seq("=", field("value", $._expression))),
        optional(seq("else", field("alternative", $.block))),
      ),

    var_statement: ($) =>
      seq(
        "var",
        field("name", $.identifier),
        optional(seq(":", field("type", $._type))),
        optional(seq("=", field("value", $._expression))),
      ),

    return_statement: ($) =>
      prec.right(seq("return", optional(field("value", $._expression)))),
    break_statement: ($) =>
      prec.right(seq("break", optional(field("label", $.identifier)))),
    continue_statement: ($) =>
      prec.right(seq("continue", optional(field("label", $.identifier)))),
    exit_statement: (_) => "exit",

    label: ($) => seq($.identifier, ":"),

    for_statement: ($) =>
      seq(
        optional(field("label", $.label)),
        "for",
        field("pattern", $._pattern),
        "in",
        field("value", $._expression),
        field("body", $.block),
      ),

    while_statement: ($) =>
      seq(
        optional(field("label", $.label)),
        "while",
        field("condition", choice($._expression, $.let_condition)),
        field("body", $.block),
      ),

    with_statement: ($) =>
      seq("with", commaSep1($.with_binding), field("body", $.block)),
    with_binding: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $._type))),
        "=",
        field("value", $._expression),
      ),

    assignment_statement: ($) =>
      prec.right(
        PREC.assign,
        seq(
          field("left", $._expression),
          field("operator", choice(...ASSIGNMENT_OPERATORS)),
          field("right", $._expression),
        ),
      ),

    expression_statement: ($) => $._expression,

    // Expressions

    _expression: ($) =>
      choice(
        $.match_expression,
        $.if_expression,
        $.lambda_expression,
        $.function_expression,
        $.binary_expression,
        $.range_expression,
        $.unary_expression,
        $.try_expression,
        $.call_expression,
        $.member_expression,
        $.index_expression,
        $.struct_literal,
        $.map_literal,
        $.list_literal,
        $.tuple_expression,
        $.unit_expression,
        $.parenthesized_expression,
        $.string,
        $.raw_string,
        $.number,
        $.boolean,
        $.self,
        $.identifier,
        // `move`/`mut` prefix an operand only before a name or `self`; as
        // in the compiler, `mut(a)`, `move - 1`, `f(mut)` use the name.
        prec(PREC.postfix + 1, alias(choice("move", "mut"), $.identifier)),
        alias($.type_identifier, $.constructor_identifier),
      ),

    match_expression: ($) =>
      seq("match", field("value", $._expression), field("body", $.match_body)),
    match_body: ($) => seq("{", lines($.match_arm, $._terminator), "}"),
    match_arm: ($) =>
      seq(
        optional("|"),
        field("pattern", $._pattern),
        optional(seq("if", field("guard", $._expression))),
        "=>",
        field(
          "value",
          choice(
            prec(1, $.block),
            $.return_statement,
            $.break_statement,
            $.continue_statement,
            $.exit_statement,
            $.assignment_statement,
            $._expression,
          ),
        ),
      ),

    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          field("condition", choice($._expression, $.let_condition)),
          field("consequence", $.block),
          optional(
            seq("else", field("alternative", choice($.block, $.if_expression))),
          ),
        ),
      ),
    let_condition: ($) =>
      seq("let", field("pattern", $._pattern), "=", field("value", $._expression)),

    lambda_expression: ($) =>
      prec.right(
        seq(
          choice(
            "||",
            seq(
              "|",
              commaSep(choice($._binding_pattern, $.lambda_parameter)),
              "|",
            ),
          ),
          field(
            "body",
            choice(prec(1, $.block), $._expression, $.assignment_statement),
          ),
        ),
      ),
    // `|text: String| ..`, `|P { x, .. }: P| x`.
    lambda_parameter: ($) =>
      seq(
        field("pattern", $._binding_pattern),
        ":",
        optional($._mode),
        field("type", $._type),
      ),

    function_expression: ($) =>
      seq(
        "fn",
        field("parameters", $.closure_parameters),
        optional(seq("->", field("return_type", $._type))),
        field("body", $.block),
      ),
    closure_parameters: ($) =>
      seq(
        "(",
        commaSep(
          choice(
            seq(
              field("name", $.identifier),
              optional(seq(":", optional($._mode), field("type", $._type))),
            ),
            alias($._pattern_parameter, $.parameter),
          ),
        ),
        ")",
      ),

    binary_expression: ($) =>
      choice(
        ...[
          ["||", PREC.or],
          ["or", PREC.or],
          ["&&", PREC.and],
          ["and", PREC.and],
          ["==", PREC.compare],
          ["!=", PREC.compare],
          ["<", PREC.compare],
          ["<=", PREC.compare],
          [">", PREC.compare],
          [">=", PREC.compare],
          ["in", PREC.compare],
          [seq("not", "in"), PREC.compare],
          ["|", PREC.bit_or],
          ["^", PREC.bit_xor],
          ["&", PREC.bit_and],
          ["<<", PREC.shift],
          [">>", PREC.shift],
          ["+", PREC.add],
          ["-", PREC.add],
          ["++", PREC.add],
          ["&+", PREC.add],
          ["&-", PREC.add],
          ["*", PREC.multiply],
          ["/", PREC.multiply],
          ["%", PREC.multiply],
          ["&*", PREC.multiply],
        ].map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(
              field("left", $._expression),
              field("operator", operator),
              field("right", $._expression),
            ),
          ),
        ),
        // Right-associative: `2 ** 3 ** 2` is `2 ** (3 ** 2)`.
        prec.right(
          PREC.power,
          seq(
            field("left", $._expression),
            field("operator", "**"),
            field("right", $._expression),
          ),
        ),
      ),

    // `a..b`, `a..=b`, and the endless `a..`; `..=` needs its end.
    range_expression: ($) =>
      prec.left(
        PREC.range,
        choice(
          seq(
            field("start", $._expression),
            field("operator", ".."),
            optional(field("end", $._expression)),
          ),
          seq(
            field("start", $._expression),
            field("operator", "..="),
            field("end", $._expression),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(
          field("operator", choice("-", "!", "~", "move", "mut", "comptime")),
          field("argument", $._expression),
        ),
      ),

    try_expression: ($) =>
      prec(PREC.postfix, seq(field("expression", $._expression), "?")),

    call_expression: ($) =>
      prec(
        PREC.postfix,
        seq(field("function", $._expression), field("arguments", $.arguments)),
      ),
    arguments: ($) =>
      seq("(", commaSep(choice($.named_argument, $._expression)), ")"),
    named_argument: ($) =>
      seq(field("name", $.identifier), ":", field("value", $._expression)),

    member_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("object", $._expression),
          ".",
          field(
            "property",
            choice(
              $.identifier,
              alias($.type_identifier, $.constructor_identifier),
              alias($._tuple_index, $.number),
            ),
          ),
        ),
      ),
    // `t.0.1` lexes `0.1` as one token.
    _tuple_index: (_) => /[0-9]+(\.[0-9]+)?/,

    // Also covers explicit type arguments: `f[T](x)`, `List[T].new()`.
    index_expression: ($) =>
      prec(
        PREC.postfix,
        seq(
          field("value", $._expression),
          "[",
          commaSep1(field("index", $._expression)),
          "]",
        ),
      ),

    // Lowest dynamic precedence: in `if x == Low {` the `{` opens the block.
    struct_literal: ($) =>
      prec.dynamic(
        -1,
        seq(
          field(
            "name",
            choice(
              alias($.type_identifier, $.constructor_identifier),
              alias($.path_type, $.scoped_type_identifier),
              $.generic_type_identifier,
            ),
          ),
          field("body", $.field_initializer_list),
        ),
      ),
    generic_type_identifier: ($) =>
      seq(
        field("name", choice($.type_identifier, $.path_type)),
        field("arguments", $.type_arguments),
      ),
    field_initializer_list: ($) =>
      seq(
        "{",
        commaSep(
          choice($.base_field_initializer, $.field_initializer, $.shorthand_field_initializer),
        ),
        "}",
      ),
    field_initializer: ($) =>
      seq(field("name", $.identifier), ":", field("value", $._expression)),
    shorthand_field_initializer: ($) => $.identifier,
    base_field_initializer: ($) => seq("..", field("value", $._expression)),

    map_literal: ($) => seq("{", commaSep($.map_entry), "}"),
    map_entry: ($) =>
      seq(field("key", $._expression), ":", field("value", $._expression)),

    list_literal: ($) => seq("[", commaSep($._expression), "]"),
    tuple_expression: ($) =>
      seq("(", $._expression, ",", commaSep1($._expression), ")"),
    unit_expression: (_) => seq("(", ")"),
    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // Patterns

    _pattern: ($) => choice($.or_pattern, $._binding_pattern),
    _binding_pattern: ($) =>
      choice(
        $.at_pattern,
        $.range_pattern,
        $.constructor_pattern,
        $.struct_pattern,
        $.tuple_pattern,
        $.list_pattern,
        $.unit_pattern,
        $.path_pattern,
        $.wildcard_pattern,
        $.var_pattern,
        $.self,
        $.identifier,
        alias($.type_identifier, $.constructor_identifier),
        $.string,
        $.raw_string,
        $.number,
        $.negative_number,
        $.boolean,
      ),

    or_pattern: ($) =>
      prec.left(seq($._pattern, "|", $._pattern)),

    path_pattern: ($) =>
      seq(
        choice($.identifier, $.type_identifier),
        repeat1(seq(".", choice($.identifier, $.type_identifier))),
      ),

    constructor_pattern: ($) =>
      seq(
        field(
          "name",
          choice(alias($.type_identifier, $.constructor_identifier), $.path_pattern),
        ),
        field("arguments", $.pattern_arguments),
      ),
    pattern_arguments: ($) => seq("(", commaSep($._pattern), ")"),

    struct_pattern: ($) =>
      seq(
        optional(
          field(
            "name",
            choice(alias($.type_identifier, $.constructor_identifier), $.path_pattern),
          ),
        ),
        "{",
        commaSep(choice($.field_pattern, $.rest_pattern)),
        "}",
      ),
    // `{ x }`, `{ x: p }`, or the mutable shorthand `{ var x }`.
    field_pattern: ($) =>
      choice(
        seq(
          field("name", $.identifier),
          optional(seq(":", field("pattern", $._pattern))),
        ),
        field("pattern", $.var_pattern),
      ),
    // `Some(var p)` binds a mutable copy (D68).
    var_pattern: ($) => seq("var", field("name", $.identifier)),

    tuple_pattern: ($) => seq("(", $._pattern, ",", commaSep1($._pattern), ")"),
    unit_pattern: (_) => seq("(", ")"),
    list_pattern: ($) => seq("[", commaSep(choice($._pattern, $.rest_pattern)), "]"),
    rest_pattern: ($) => prec.right(seq("..", optional($._binding_pattern))),
    wildcard_pattern: (_) => "_",
    at_pattern: ($) =>
      seq(field("name", $.identifier), "@", field("pattern", $._binding_pattern)),
    range_pattern: ($) =>
      seq(
        field("start", $._range_pattern_bound),
        field("operator", choice("..", "..=")),
        field("end", $._range_pattern_bound),
      ),
    _range_pattern_bound: ($) => choice($.number, $.negative_number),

    negative_number: ($) => seq("-", $.number),

    // Literals

    boolean: (_) => choice("true", "false"),

    number: (_) =>
      token(
        choice(
          /0x[0-9a-fA-F]+(_[0-9a-fA-F]+)*([iu](8|16|32|64|128|size))?/,
          /[0-9]+(_[0-9]+)*(\.[0-9]+(_[0-9]+)*)?([eE][+-]?[0-9]+(_[0-9]+)*)?([iu](8|16|32|64|128|size)|f(32|64|128)|dec)?/,
        ),
      ),

    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            $.string_content,
            $.escape_sequence,
            $.brace_escape,
            $.interpolation,
          ),
        ),
        token.immediate('"'),
      ),
    string_content: (_) => token.immediate(prec(1, /[^"\\{}]+/)),
    escape_sequence: (_) => token.immediate(/\\./),
    brace_escape: (_) => token.immediate(choice("{{", "}}")),
    interpolation: ($) =>
      seq(
        token.immediate("{"),
        field("value", $._expression),
        optional(seq(":", optional(field("format", $.format_spec)))),
        "}",
      ),
    format_spec: (_) => token.immediate(/[^}"]+/),

    raw_string: (_) =>
      token(
        choice(
          /r"[^"]*"/,
          /r#"([^"]|"[^#])*"#/,
          /r##"([^"]|"[^#]|"#[^#])*"##/,
        ),
      ),

    identifier: (_) => /[a-z_][A-Za-z0-9_]*/,
    type_identifier: (_) => /[A-Z][A-Za-z0-9_]*/,
  },
});
