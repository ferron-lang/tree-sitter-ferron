/**
 * @file Ferron grammar for tree-sitter
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  assign: 1,
  range: 2,
  or: 3,
  and: 4,
  compare: 5,
  add: 6,
  multiply: 7,
  unary: 8,
  postfix: 9,
};

const commaSep = (rule) => optional(seq(rule, repeat(seq(',', rule)), optional(',')));
const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)), optional(','));
const sep1 = (rule, separator) => seq(rule, repeat(seq(separator, rule)));

export default grammar({
  name: 'ferron',

  word: $ => $.identifier,

  extras: $ => [
    /[\s\uFEFF\u2060\u200B]/,
    $.line_comment,
    $.block_comment,
  ],

  conflicts: $ => [
    [$.map_literal, $.block],
    [$._expression, $.path_type],
    [$.type_identifier, $.constructor_identifier],
  ],

  rules: {
    source_file: $ => repeat($._declaration),

    line_comment: _ => token(seq('//', /.*/)),
    block_comment: _ => token(seq('/*', /([^*]|\*[^/])*/, '*/')),

    _declaration: $ => choice(
      $.module_declaration,
      $.use_declaration,
      $.const_declaration,
      $.record_declaration,
      $.type_declaration,
      $.resource_declaration,
      $.capability_declaration,
      $.actor_declaration,
      $.test_declaration,
      $.function_declaration,
    ),

    attribute: $ => seq(
      '#[',
      field('name', $.identifier),
      optional(field('arguments', $.attribute_argument_list)),
      ']',
    ),

    attribute_argument_list: $ => seq('(', commaSep($._attribute_argument), ')'),
    _attribute_argument: $ => choice($.identifier, $.type_identifier, $.string, $.number),

    module_declaration: $ => seq('module', $.path),

    use_declaration: $ => seq('use', $.use_path),
    use_path: $ => choice(
      seq($.use_prefix, '.', $.use_group),
      $.use_item_path,
      $.path,
    ),
    use_prefix: _ => token(seq(/[a-z_][A-Za-z0-9_]*/, repeat(seq('.', /[a-z_][A-Za-z0-9_]*/)))),
    use_item_path: _ => token(seq(
      /[a-z_][A-Za-z0-9_]*/,
      repeat(seq('.', /[a-z_][A-Za-z0-9_]*/)),
      '.',
      /[A-Z][A-Za-z0-9_]*/,
    )),
    use_group: $ => seq('{', commaSep1(choice($.identifier, $.type_identifier)), '}'),

    const_declaration: $ => seq(
      repeat($.attribute),
      'const',
      field('name', choice($.identifier, $.constructor_identifier)),
      optional(seq(':', field('type', $._type))),
      '=',
      field('value', $._expression),
    ),

    record_declaration: $ => seq(
      repeat($.attribute),
      'record',
      field('name', $.type_identifier),
      field('body', $.field_declaration_list),
    ),

    field_declaration_list: $ => seq('{', commaSep($.field_declaration), '}'),
    field_declaration: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $._type),
    ),

    type_declaration: $ => seq(
      repeat($.attribute),
      'type',
      field('name', $.type_identifier),
      optional(field('parameters', $.type_parameter_list)),
      optional(seq(':', field('trait', $.identifier))),
      '=',
      choice(
        field('variants', $.variant_list),
        field('value', $._type),
      ),
      optional(seq('where', field('constraint', $._expression))),
    ),

    variant_list: $ => prec.right(seq('|', $.variant_declaration, repeat(seq('|', $.variant_declaration)))),
    variant_declaration: $ => prec.right(seq(
      field('name', $.constructor_identifier),
      optional(field('fields', $.variant_field_list)),
    )),
    variant_field_list: $ => seq('(', commaSep($.field_declaration), ')'),

    resource_declaration: $ => seq(
      repeat($.attribute),
      'resource',
      field('name', $.type_identifier),
    ),

    capability_declaration: $ => seq(
      repeat($.attribute),
      'cap',
      field('name', $.type_identifier),
      field('body', $.capability_body),
    ),

    capability_body: $ => seq('{', repeat(choice($.function_signature, $.function_declaration)), '}'),

    function_signature: $ => seq(
      'fn',
      field('name', $.identifier),
      optional('!'),
      field('parameters', $.parameter_list),
      optional(seq('->', field('return_type', $._type))),
      optional($.uses_clause),
    ),

    function_declaration: $ => seq(
      repeat($.attribute),
      'fn',
      field('name', $.identifier),
      optional('!'),
      field('parameters', $.parameter_list),
      optional(seq('->', field('return_type', $._type))),
      optional($.uses_clause),
      field('body', $.block),
    ),

    actor_declaration: $ => seq(
      repeat($.attribute),
      'actor',
      field('name', $.type_identifier),
      field('parameters', $.parameter_list),
      optional(seq('receives', field('receives', $._type))),
      optional($.uses_clause),
      field('body', $.actor_body),
    ),

    actor_body: $ => seq('{', repeat(choice($.on_handler, $._statement, $._declaration)), '}'),

    on_handler: $ => seq(
      'on',
      field('pattern', $.pattern),
      field('body', $.block),
    ),

    test_declaration: $ => seq(
      repeat($.attribute),
      'test',
      field('name', $.string),
      optional(field('parameters', $.parameter_list)),
      optional($.scheduler_clause),
      optional($.uses_clause),
      field('body', $.block),
    ),

    scheduler_clause: $ => seq(
      'scheduler',
      field('name', $.identifier),
      optional(field('arguments', $.argument_list)),
    ),

    uses_clause: $ => seq('uses', field('effects', $.effect_list)),
    effect_list: $ => seq('[', commaSep($.effect_path), ']'),
    effect_path: $ => prec.left(sep1($.identifier, '.')),

    parameter_list: $ => seq('(', commaSep($.parameter), ')'),
    parameter: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $._type),
    ),

    type_parameter_list: $ => seq('[', commaSep($.type_identifier), ']'),
    type_argument_list: $ => seq('[', commaSep($._type), ']'),

    _type: $ => choice(
      $.generic_type,
      $.path_type,
      $.type_identifier,
      $.tuple_type,
    ),

    generic_type: $ => prec(1, seq(
      field('name', choice($.type_identifier, $.path_type)),
      field('arguments', $.type_argument_list),
    )),

    path_type: $ => seq(
      choice($.identifier, $.type_identifier),
      repeat1(seq('.', choice($.identifier, $.type_identifier))),
    ),
    tuple_type: $ => seq('(', commaSep($._type), ')'),

    block: $ => seq('{', repeat($._statement), '}'),

    _statement: $ => choice(
      $.let_statement,
      $.var_statement,
      $.return_statement,
      $.continue_statement,
      $.exit_statement,
      $.for_statement,
      $.with_statement,
      $.assignment_statement,
      $.expression_statement,
    ),

    let_statement: $ => seq(
      'let',
      field('name', $.identifier),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expression))),
    ),

    var_statement: $ => seq(
      'var',
      field('name', $.identifier),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expression))),
    ),

    return_statement: $ => seq('return', $._expression),
    continue_statement: _ => 'continue',
    exit_statement: _ => 'exit',

    for_statement: $ => seq(
      'for',
      field('pattern', $.pattern),
      'in',
      field('value', $._expression),
      field('body', $.block),
    ),

    with_statement: $ => seq(
      'with',
      field('name', $.identifier),
      optional(seq(':', field('type', $._type))),
      '=',
      field('value', $._expression),
      field('body', $.block),
    ),

    assignment_statement: $ => prec.right(PREC.assign, seq(
      field('left', choice($.identifier, $.member_expression)),
      '=',
      field('right', $._expression),
    )),

    expression_statement: $ => $._expression,

    _expression: $ => choice(
      $.match_expression,
      $.comptime_expression,
      $.lambda_expression,
      $.if_expression,
      $.binary_expression,
      $.unary_expression,
      $.try_expression,
      $.call_expression,
      $.member_expression,
      $.index_expression,
      $.record_literal,
      $.map_literal,
      $.list_literal,
      $.parenthesized_expression,
      $.identifier,
      $.constructor_identifier,
      $.number,
      $.string,
      $.boolean,
    ),

    match_expression: $ => seq(
      'match',
      field('value', $._expression),
      field('body', $.match_body),
    ),

    match_body: $ => seq('{', repeat($.match_arm), '}'),
    match_arm: $ => seq(
      field('pattern', $.pattern),
      '=>',
      field('value', choice($.block, $._expression)),
      optional(','),
    ),

    if_expression: $ => prec.right(seq(
      'if',
      field('condition', $._expression),
      field('consequence', $.block),
      optional(seq('else', field('alternative', choice($.block, $.if_expression)))),
    )),

    comptime_expression: $ => seq('comptime', $._expression),

    lambda_expression: $ => seq(
      '|',
      commaSep($.identifier),
      '|',
      field('body', choice($.block, $._expression)),
    ),

    binary_expression: $ => choice(
      ...[
        ['++', PREC.add],
        ['or', PREC.or],
        ['and', PREC.and],
        ['==', PREC.compare],
        ['!=', PREC.compare],
        ['<', PREC.compare],
        ['<=', PREC.compare],
        ['>', PREC.compare],
        ['>=', PREC.compare],
        ['..<', PREC.range],
        ['..', PREC.range],
        ['+', PREC.add],
        ['-', PREC.add],
        ['*', PREC.multiply],
        ['/', PREC.multiply],
        ['%', PREC.multiply],
      ].map(([operator, precedence]) => prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', $._expression),
      ))),
    ),

    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('!', '-', 'not')),
      field('argument', $._expression),
    )),

    try_expression: $ => prec(PREC.postfix, seq(
      field('expression', $._expression),
      '?',
    )),

    call_expression: $ => prec(PREC.postfix, seq(
      field('function', choice($.identifier, $.constructor_identifier, $.member_expression)),
      optional('!'),
      optional(field('type_arguments', $.type_argument_list)),
      field('arguments', $.argument_list),
    )),

    member_expression: $ => prec.left(PREC.postfix, seq(
      field('object', $._expression),
      '.',
      field('property', $.identifier),
    )),

    index_expression: $ => prec(PREC.postfix, seq(
      field('collection', choice(
        $.identifier,
        $.constructor_identifier,
        $.member_expression,
        $.call_expression,
        $.index_expression,
      )),
      '[',
      field('index', $._expression),
      ']',
    )),

    argument_list: $ => seq('(', commaSep(choice($.named_argument, $._expression)), ')'),
    named_argument: $ => seq(field('name', $.identifier), ':', field('value', $._expression)),

    parenthesized_expression: $ => seq('(', $._expression, ')'),
    list_literal: $ => seq('[', commaSep($._expression), ']'),

    record_literal: $ => prec(PREC.postfix, seq(
      field('name', $.constructor_identifier),
      field('body', $.field_initializer_list),
    )),

    field_initializer_list: $ => seq('{', commaSep($.field_initializer), '}'),
    field_initializer: $ => choice(
      seq(field('name', $.identifier), ':', field('value', $._expression)),
      field('name', $.identifier),
    ),

    map_literal: $ => seq('{', commaSep($.map_entry), '}'),
    map_entry: $ => seq(field('key', $._expression), ':', field('value', $._expression)),

    pattern: $ => choice(
      $.call_pattern,
      $.list_pattern,
      $.tuple_pattern,
      $.wildcard_pattern,
      $.constructor_identifier,
      $.identifier,
      $.string,
      $.number,
    ),

    call_pattern: $ => seq(
      field('name', $.constructor_identifier),
      field('arguments', $.pattern_list),
    ),

    pattern_list: $ => seq('(', commaSep($.pattern), ')'),
    tuple_pattern: $ => seq('(', commaSep1($.pattern), ')'),
    list_pattern: $ => seq('[', commaSep(choice($.pattern, $.rest_pattern)), ']'),
    rest_pattern: $ => seq('..', $.identifier),
    wildcard_pattern: _ => '_',

    path: $ => prec.left(sep1($.identifier, '.')),

    boolean: _ => choice('true', 'false'),
    number: _ => token(choice(
      /0x[0-9a-fA-F_]+/,
      /0b[01_]+/,
      /[0-9][0-9_]*/,
    )),
    string: _ => token(seq('"', repeat(choice(/[^"\\]+/, /\\./)), '"')),

    identifier: _ => /[a-z_][A-Za-z0-9_]*/,
    type_identifier: _ => /[A-Z][A-Za-z0-9_]*/,
    constructor_identifier: _ => /[A-Z][A-Za-z0-9_]*/,
  },
});
