(line_comment) @comment
(block_comment) @comment
(string) @string
(number) @number
(boolean) @constant.builtin

(module_declaration) @keyword
(use_declaration) @keyword
(const_declaration) @keyword
(record_declaration) @keyword
(type_declaration) @keyword
(trait_declaration) @keyword
(impl_declaration) @keyword
(associated_type_declaration) @keyword
(resource_declaration) @keyword
(capability_declaration) @keyword
(actor_declaration) @keyword
(test_declaration) @keyword
(function_declaration) @keyword
(uses_clause) @keyword
(scheduler_clause) @keyword
(match_expression) @keyword
(with_statement) @keyword
(let_statement) @keyword
(var_statement) @keyword
(return_statement) @keyword
(continue_statement) @keyword
(exit_statement) @keyword
(visibility) @keyword

(attribute
  name: (identifier) @attribute)

(module_declaration
  (path) @module)

(use_item_path) @module

(function_declaration
  name: (identifier) @function)

(function_signature
  name: (identifier) @function)

(call_expression
  function: (identifier) @function.call)

(member_expression
  property: (identifier) @property)

(record_declaration
  name: (type_identifier) @type)

(type_declaration
  name: (type_identifier) @type)

(trait_declaration
  name: (type_identifier) @type)

(associated_type_declaration
  name: (type_identifier) @type)

(resource_declaration
  name: (type_identifier) @type)

(capability_declaration
  name: (type_identifier) @type)

(actor_declaration
  name: (type_identifier) @type)

(type_identifier) @type
(constructor_identifier) @constructor

(parameter
  name: (identifier) @variable.parameter)

(field_declaration
  name: (identifier) @property)

(field_initializer
  name: (identifier) @property)
