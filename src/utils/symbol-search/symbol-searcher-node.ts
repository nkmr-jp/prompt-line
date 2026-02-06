/**
 * Symbol Searcher - Cross-platform symbol search using ripgrep
 * Replaces native Swift symbol-searcher binary
 *
 * Enhanced to LSP-level symbol detection quality
 * Go patterns ported from native/symbol-searcher/SymbolPatterns.swift
 * Other languages enhanced with patterns tested against real OSS codebases
 */

import { execFile } from 'child_process';
import { logger } from '../logger';
import type {
  SymbolSearchResponse,
  RgCheckResponse,
  LanguagesResponse,
  SymbolSearchOptions,
  SymbolResult,
  SymbolType
} from '../../managers/symbol-search/types';

const DEFAULT_MAX_SYMBOLS = 200000;
const DEFAULT_SEARCH_TIMEOUT = 5000; // 5 seconds
const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024; // 100MB

/**
 * Pattern definition for symbol detection
 * captureGroup: 1-based index of the capturing group containing the symbol name
 */
interface SymbolPattern {
  type: SymbolType;
  pattern: string;
  captureGroup: number;
}

/**
 * Language configuration
 * rgType: ripgrep's built-in type name for --type filtering
 * extensions: file extensions for --glob fallback
 */
interface LanguageConfig {
  name: string;
  rgType: string;
  extensions: string[];
  patterns: SymbolPattern[];
}

/**
 * Block search configuration for multiline block detection
 * Used for detecting symbols inside multi-line blocks (e.g., Go const/var blocks)
 * Ported from native/symbol-searcher/RipgrepExecutor.swift
 */
interface BlockSearchConfig {
  symbolType: SymbolType;
  blockPattern: string;        // rg multiline pattern (-U --multiline-dotall)
  symbolNameRegex: string;     // Regex to extract symbol name from each line within block
  indentFilter: 'singleLevel' | 'any'; // singleLevel: tab or 2-4 spaces only (top-level block content)
}

/**
 * Language configurations with file extensions and symbol patterns
 * Enhanced to LSP-level symbol detection quality
 * Go patterns ported from native/symbol-searcher/SymbolPatterns.swift
 * Other languages enhanced with patterns tested against real OSS codebases
 */
const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  go: {
    name: 'Go',
    rgType: 'go',
    extensions: ['.go'],
    patterns: [
      // Generic function: func Name[T any](...) or func Name[T any, R comparable](...)
      { type: 'function', pattern: '^func\\s+(\\w+)\\s*\\[[^\\]]+\\]\\s*\\(', captureGroup: 1 },
      // Regular function: func Name(...)
      { type: 'function', pattern: '^func\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      // Generic method: func (r *Receiver) Name[T any](...)
      { type: 'method', pattern: '^func\\s*\\([^)]+\\)\\s+(\\w+)\\s*\\[[^\\]]+\\]\\s*\\(', captureGroup: 1 },
      // Regular method: func (r *Receiver) Name(...)
      { type: 'method', pattern: '^func\\s*\\([^)]+\\)\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      { type: 'struct', pattern: '^type\\s+(\\w+)\\s+struct', captureGroup: 1 },
      { type: 'interface', pattern: '^type\\s+(\\w+)\\s+interface', captureGroup: 1 },
      // Type aliases: slice type (e.g., type Names []string)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+\\[', captureGroup: 1 },
      // Type aliases: map type (e.g., type Cache map[string]int)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+map\\[', captureGroup: 1 },
      // Type aliases: pointer type (e.g., type Handler *http.Handler)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+\\*', captureGroup: 1 },
      // Type aliases: function type (e.g., type HandlerFunc func(...))
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+func\\(', captureGroup: 1 },
      // Type aliases: channel type (e.g., type Signal chan struct{}, type Events <-chan Event)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+<?-?chan\\b', captureGroup: 1 },
      // Type aliases: built-in types (string, int, bool, byte, rune, error, etc.)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+(string|bool|byte|rune|error|any|comparable|u?int(8|16|32|64)?|float(32|64)|complex(64|128)|uintptr)\\b', captureGroup: 1 },
      // Type aliases: package types (e.g., type Handler http.Handler, type Time time.Time)
      { type: 'type', pattern: '^type\\s+(\\w+)\\s+[a-z]\\w*\\.', captureGroup: 1 },
      { type: 'constant', pattern: '^const\\s+(\\w+)\\s*=', captureGroup: 1 },
      // Note: const/var block symbols (inside const ( ... ) and var ( ... )) are detected by
      // block-based multiline search (GO_BLOCK_CONFIGS), not by single-line patterns
      { type: 'variable', pattern: '^var\\s+(\\w+)\\s+', captureGroup: 1 },
    ]
  },
  ts: {
    name: 'TypeScript',
    rgType: 'ts',
    extensions: ['.ts'],
    patterns: [
      // Declare function: declare function foo()
      { type: 'function', pattern: '^(?:export\\s+)?declare\\s+(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Generator function: export function* name() or async function* name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*\\s+(\\w+)', captureGroup: 1 },
      // Regular/default/async function: export default async function name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Declare class: declare class Foo or declare abstract class Foo
      { type: 'class', pattern: '^(?:export\\s+)?declare\\s+(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Regular/default/abstract class: export default class Foo
      { type: 'class', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Declare interface
      { type: 'interface', pattern: '^(?:export\\s+)?declare\\s+interface\\s+(\\w+)', captureGroup: 1 },
      // Regular interface
      { type: 'interface', pattern: '^(?:export\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      // Declare type
      { type: 'type', pattern: '^(?:export\\s+)?declare\\s+type\\s+(\\w+)', captureGroup: 1 },
      // Regular type alias (= for assignment, < for generics like type Foo<T>)
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]', captureGroup: 1 },
      // Const enum (must come before regular enum): export const enum Foo
      { type: 'enum', pattern: '^(?:export\\s+)?(?:declare\\s+)?const\\s+enum\\s+(\\w+)', captureGroup: 1 },
      // Regular enum (with optional declare)
      { type: 'enum', pattern: '^(?:export\\s+)?(?:declare\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      // Declare const/var/let (ambient declarations)
      { type: 'variable', pattern: '^(?:export\\s+)?declare\\s+(?:const|var|let)\\s+(\\w+)', captureGroup: 1 },
      // Regular const (export const foo = or export const foo:)
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
      // Declare namespace
      { type: 'namespace', pattern: '^(?:export\\s+)?declare\\s+namespace\\s+(\\w+)', captureGroup: 1 },
      // Regular namespace
      { type: 'namespace', pattern: '^(?:export\\s+)?namespace\\s+(\\w+)', captureGroup: 1 },
      // Declare module with quoted name: declare module "express"
      { type: 'module', pattern: '^(?:export\\s+)?declare\\s+module\\s+["\']([^"\']+)["\']', captureGroup: 1 },
    ]
  },
  tsx: {
    name: 'TypeScript React',
    rgType: 'ts',
    extensions: ['.tsx'],
    patterns: [
      // Generator function: function* name() or export function* name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*\\s+(\\w+)', captureGroup: 1 },
      // Regular/default/async function: export default async function name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Default/abstract class: export default class Foo
      { type: 'class', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Interface
      { type: 'interface', pattern: '^(?:export\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      // Type alias (= for assignment, < for generics)
      { type: 'type', pattern: '^(?:export\\s+)?type\\s+(\\w+)\\s*[=<]', captureGroup: 1 },
      // Const enum (must come before regular enum)
      { type: 'enum', pattern: '^(?:export\\s+)?const\\s+enum\\s+(\\w+)', captureGroup: 1 },
      // Regular enum
      { type: 'enum', pattern: '^(?:export\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      // Constant (export const foo = or export const foo:)
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*[=:]', captureGroup: 1 },
    ]
  },
  js: {
    name: 'JavaScript',
    rgType: 'js',
    extensions: ['.js'],
    patterns: [
      // Generator function: function* name() or export function* name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*\\s+(\\w+)', captureGroup: 1 },
      // Regular/default/async function: export default async function name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Default class: export default class Foo
      { type: 'class', pattern: '^(?:export\\s+)?(?:default\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Prototype method: ClassName.prototype.methodName = function
      { type: 'method', pattern: '^(\\w+)\\.prototype\\.(\\w+)\\s*=', captureGroup: 2 },
      // Constant
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*=', captureGroup: 1 },
      // Variable (var/let)
      { type: 'variable', pattern: '^(?:export\\s+)?(?:var|let)\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  jsx: {
    name: 'JavaScript React',
    rgType: 'js',
    extensions: ['.jsx'],
    patterns: [
      // Generator function: function* name() or export function* name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*\\s+(\\w+)', captureGroup: 1 },
      // Regular/default/async function: export default async function name()
      { type: 'function', pattern: '^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Default class: export default class Foo
      { type: 'class', pattern: '^(?:export\\s+)?(?:default\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Constant
      { type: 'constant', pattern: '^(?:export\\s+)?const\\s+(\\w+)\\s*=', captureGroup: 1 },
    ]
  },
  py: {
    name: 'Python',
    rgType: 'py',
    extensions: ['.py'],
    patterns: [
      // Top-level function: def name(...) or async def name(...)
      { type: 'function', pattern: '^(?:async\\s+)?def\\s+(\\w+)', captureGroup: 1 },
      // Class definition: class Name(...)
      { type: 'class', pattern: '^class\\s+(\\w+)', captureGroup: 1 },
      // Method (indented def): class methods, nested functions
      { type: 'method', pattern: '^\\s+(?:async\\s+)?def\\s+(\\w+)', captureGroup: 1 },
      // Constant: ALL_CAPS = value
      { type: 'constant', pattern: '^([A-Z_][A-Z0-9_]*)\\s*=', captureGroup: 1 },
      // Type variable: Name = TypeVar('Name') or Name = t.TypeVar('Name')
      { type: 'type', pattern: '^(\\w+)\\s*=\\s*(?:\\w+\\.)?TypeVar\\(', captureGroup: 1 },
    ]
  },
  rs: {
    name: 'Rust',
    rgType: 'rust',
    extensions: ['.rs'],
    patterns: [
      // impl Trait for Type (must come before impl Type)
      { type: 'type', pattern: '^impl(<[^{]*>)?\\s+\\w+(<[^{]*>)?\\s+for\\s+(\\w+)', captureGroup: 3 },
      // impl Type (self-implementation)
      { type: 'type', pattern: '^impl(<[^{]*>)?\\s+(\\w+)', captureGroup: 2 },
      // Trait definition (interface equivalent)
      { type: 'interface', pattern: '^(pub(\\([^)]+\\))?\\s+)?(unsafe\\s+)?trait\\s+(\\w+)', captureGroup: 4 },
      // Function: supports pub/pub(crate)/const/async/unsafe/extern "C" combinations
      { type: 'function', pattern: '^(pub(\\([^)]+\\))?\\s+)?(const\\s+)?(async\\s+)?(unsafe\\s+)?(extern\\s+"[^"]+"\\s+)?fn\\s+(\\w+)', captureGroup: 7 },
      // Macro definitions
      { type: 'function', pattern: '^(pub(\\([^)]+\\))?\\s+)?macro_rules!\\s+(\\w+)', captureGroup: 3 },
      // Struct
      { type: 'struct', pattern: '^(pub(\\([^)]+\\))?\\s+)?struct\\s+(\\w+)', captureGroup: 3 },
      // Enum
      { type: 'enum', pattern: '^(pub(\\([^)]+\\))?\\s+)?enum\\s+(\\w+)', captureGroup: 3 },
      // Union
      { type: 'struct', pattern: '^(pub(\\([^)]+\\))?\\s+)?union\\s+(\\w+)', captureGroup: 3 },
      // Type alias
      { type: 'type', pattern: '^(pub(\\([^)]+\\))?\\s+)?type\\s+(\\w+)', captureGroup: 3 },
      // Constant (colon after name distinguishes from `const fn`)
      { type: 'constant', pattern: '^(pub(\\([^)]+\\))?\\s+)?const\\s+(\\w+)\\s*:', captureGroup: 3 },
      // Static variable (supports `static mut`)
      { type: 'variable', pattern: '^(pub(\\([^)]+\\))?\\s+)?static\\s+(mut\\s+)?(\\w+)', captureGroup: 4 },
      // Module
      { type: 'module', pattern: '^(pub(\\([^)]+\\))?\\s+)?mod\\s+(\\w+)', captureGroup: 3 },
    ]
  },
  java: {
    name: 'Java',
    rgType: 'java',
    extensions: ['.java'],
    patterns: [
      // Record class (Java 14+): public record Name(...)
      { type: 'class', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:final\\s+)?record\\s+(\\w+)', captureGroup: 1 },
      // Annotation type: public @interface Name
      { type: 'interface', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?@interface\\s+(\\w+)', captureGroup: 1 },
      // Class: with access modifiers, abstract, final, sealed, static
      { type: 'class', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:abstract\\s+)?(?:final\\s+)?(?:sealed\\s+)?(?:static\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Interface
      { type: 'interface', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:sealed\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      // Enum
      { type: 'enum', pattern: '^\\s*(?:public\\s+|private\\s+|protected\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      // Static final constant: public static final Type NAME =
      { type: 'constant', pattern: '^\\s+(?:public|private|protected)\\s+static\\s+final\\s+\\w[\\w<>\\[\\]]*\\s+([A-Z_]\\w*)\\s*=', captureGroup: 1 },
      // Method with generic return: public static <T> ReturnType name(
      { type: 'method', pattern: '^\\s+(?:public|private|protected)\\s+(?:static\\s+)?(?:final\\s+)?(?:synchronized\\s+)?(?:abstract\\s+)?<[^>]+>\\s+\\w[\\w<>\\[\\],?\\s]*\\s+(\\w+)\\s*\\(', captureGroup: 1 },
      // Method: access modifier + optional modifiers + return type + name(
      { type: 'method', pattern: '^\\s+(?:public|private|protected)\\s+(?:static\\s+)?(?:final\\s+)?(?:synchronized\\s+)?(?:abstract\\s+)?(?:default\\s+)?\\w[\\w<>\\[\\],?\\s]*\\s+(\\w+)\\s*\\(', captureGroup: 1 },
    ]
  },
  kt: {
    name: 'Kotlin',
    rgType: 'kotlin',
    extensions: ['.kt'],
    patterns: [
      // Data class: data class Name(
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?data\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Sealed class: sealed class Name
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?sealed\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Sealed interface: sealed interface Name
      { type: 'interface', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?sealed\\s+interface\\s+(\\w+)', captureGroup: 1 },
      // Enum class: enum class Name
      { type: 'enum', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?enum\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Annotation class: annotation class Name
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?annotation\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Value class (inline): value class Name
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?(?:@JvmInline\\s+)?value\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Regular class with optional modifiers
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:open\\s+|abstract\\s+)?(?:inner\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Interface
      { type: 'interface', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:fun\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      // Object declaration
      { type: 'module', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?object\\s+(\\w+)', captureGroup: 1 },
      // Companion object
      { type: 'module', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?companion\\s+object\\s+(\\w+)', captureGroup: 1 },
      // Typealias
      { type: 'type', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?typealias\\s+(\\w+)', captureGroup: 1 },
      // Suspend function
      { type: 'function', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:override\\s+)?suspend\\s+fun\\s+(\\w+)', captureGroup: 1 },
      // Inline function
      { type: 'function', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?inline\\s+fun\\s+(?:<[^>]+>\\s+)?(?:\\w[\\w<>?.* ]*\\.)?(\\w+)', captureGroup: 1 },
      // Extension function: fun Type.name(
      { type: 'function', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:override\\s+)?fun\\s+\\w[\\w<>?.* ]*\\.(\\w+)', captureGroup: 1 },
      // Regular function with optional modifiers
      { type: 'function', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:override\\s+)?(?:open\\s+)?fun\\s+(\\w+)', captureGroup: 1 },
      // Const val
      { type: 'constant', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+)?const\\s+val\\s+(\\w+)', captureGroup: 1 },
      // Top-level val (not indented, likely a constant or top-level property)
      { type: 'variable', pattern: '^(?:public\\s+|internal\\s+|private\\s+)?val\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  swift: {
    name: 'Swift',
    rgType: 'swift',
    extensions: ['.swift'],
    patterns: [
      // Protocol: public protocol Name
      { type: 'interface', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?protocol\\s+(\\w+)', captureGroup: 1 },
      // Extension: extension Name
      { type: 'type', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|fileprivate\\s+)?extension\\s+(\\w+)', captureGroup: 1 },
      // Class with access modifiers and final
      { type: 'class', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Struct with access modifiers
      { type: 'struct', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      // Enum with access modifiers
      { type: 'enum', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      // Typealias
      { type: 'type', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?typealias\\s+(\\w+)', captureGroup: 1 },
      // Static/class func
      { type: 'function', pattern: '^\\s+(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:class\\s+|static\\s+)(?:override\\s+)?func\\s+(\\w+)', captureGroup: 1 },
      // Instance func with access modifiers
      { type: 'function', pattern: '^\\s*(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:override\\s+)?(?:mutating\\s+)?func\\s+(\\w+)', captureGroup: 1 },
      // Init
      { type: 'function', pattern: '^\\s+(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:required\\s+|convenience\\s+)?(init)\\s*[?(]', captureGroup: 1 },
      // Property: var/let with type annotation (in type body)
      { type: 'property', pattern: '^\\s+(?:public\\s+|open\\s+|internal\\s+|private\\s+|fileprivate\\s+)?(?:static\\s+|class\\s+)?(?:override\\s+)?(?:var|let)\\s+(\\w+)\\s*:', captureGroup: 1 },
    ]
  },
  rb: {
    name: 'Ruby',
    rgType: 'ruby',
    extensions: ['.rb'],
    patterns: [
      // Top-level class method: def self.name (must come before plain def)
      { type: 'function', pattern: '^def\\s+self\\.(\\w+)', captureGroup: 1 },
      // Top-level function: def name
      { type: 'function', pattern: '^def\\s+(\\w+)', captureGroup: 1 },
      // Indented class method: def self.name
      { type: 'method', pattern: '^\\s+def\\s+self\\.(\\w+)', captureGroup: 1 },
      // Method: indented def name (instance methods in classes/modules)
      { type: 'method', pattern: '^\\s+def\\s+(\\w+)', captureGroup: 1 },
      // Class definition (supports indented/nested classes)
      { type: 'class', pattern: '^\\s*class\\s+(\\w+)', captureGroup: 1 },
      // Module definition
      { type: 'module', pattern: '^\\s*module\\s+(\\w+)', captureGroup: 1 },
      // Indented constant (inside classes)
      { type: 'constant', pattern: '^\\s+([A-Z][A-Z0-9_]*)\\s*=', captureGroup: 1 },
      // Top-level constant
      { type: 'constant', pattern: '^([A-Z]\\w*)\\s*=', captureGroup: 1 },
      // Attribute accessors: attr_accessor :name, attr_reader :name, attr_writer :name
      { type: 'property', pattern: '^\\s+attr_(?:accessor|reader|writer)\\s+:(\\w+)', captureGroup: 1 },
      // Scope (ActiveRecord): scope :name, -> { ... }
      { type: 'method', pattern: '^\\s+scope\\s+:(\\w+)', captureGroup: 1 },
    ]
  },
  cpp: {
    name: 'C++',
    rgType: 'cpp',
    extensions: ['.cpp', '.h', '.hpp'],
    patterns: [
      // Template class/struct: template<...> class/struct Name
      { type: 'class', pattern: '^template\\s*<[^>]*>\\s*(class|struct)\\s+(\\w+)', captureGroup: 2 },
      // Class/struct with optional export macros (e.g., class SPDLOG_API logger)
      { type: 'class', pattern: '^(class|struct)\\s+(?:\\w+\\s+)?(\\w+)\\s*[:{]', captureGroup: 2 },
      // Inline namespace (must come before regular namespace)
      { type: 'namespace', pattern: '^inline\\s+namespace\\s+(\\w+)', captureGroup: 1 },
      // Regular namespace
      { type: 'namespace', pattern: '^namespace\\s+(\\w+)', captureGroup: 1 },
      // Enum (including enum class)
      { type: 'enum', pattern: '^enum\\s+(?:class\\s+)?(\\w+)', captureGroup: 1 },
      // Using type alias: using Name = ...
      { type: 'type', pattern: '^using\\s+(\\w+)\\s*=', captureGroup: 1 },
      // Typedef
      { type: 'type', pattern: '^typedef\\s+.+\\s+(\\w+);', captureGroup: 1 },
      // #define macros
      { type: 'constant', pattern: '^#define\\s+(\\w+)', captureGroup: 1 },
      // Extern declarations
      { type: 'variable', pattern: '^extern\\s+.+\\s+(\\w+);', captureGroup: 1 },
    ]
  },
  c: {
    name: 'C',
    rgType: 'c',
    extensions: ['.c', '.h'],
    patterns: [
      // Static/inline/extern function definitions
      { type: 'function', pattern: '^(static|inline|extern)\\s+.*\\s+(\\w+)\\s*\\(', captureGroup: 2 },
      // Function with basic return type: void/int/char/unsigned long/etc name(
      { type: 'function', pattern: '^(void|int|unsigned\\s+\\w+|size_t|ssize_t|char|long|short|float|double|bool|_Bool)\\s+\\*?\\s*(\\w+)\\s*\\(', captureGroup: 2 },
      // Function returning pointer to custom type: Type *name(
      { type: 'function', pattern: '^\\w+\\s*\\*+\\s*(\\w+)\\s*\\(', captureGroup: 1 },
      // #define macros
      { type: 'constant', pattern: '^#define\\s+(\\w+)', captureGroup: 1 },
      // Struct (with optional typedef)
      { type: 'struct', pattern: '^(typedef\\s+)?struct\\s+(\\w+)', captureGroup: 2 },
      // Enum (with optional typedef)
      { type: 'enum', pattern: '^(typedef\\s+)?enum\\s+(\\w+)', captureGroup: 2 },
      // Union (with optional typedef)
      { type: 'struct', pattern: '^(typedef\\s+)?union\\s+(\\w+)', captureGroup: 2 },
      // Typedef aliases
      { type: 'type', pattern: '^typedef\\s+.+\\s+(\\w+);', captureGroup: 1 },
    ]
  },
  sh: {
    name: 'Shell',
    rgType: 'sh',
    extensions: ['.sh'],
    patterns: [
      // function keyword with parens: function name() {
      { type: 'function', pattern: '^function\\s+(\\w+)\\s*\\(\\)', captureGroup: 1 },
      // function keyword without parens (bash/zsh): function name {
      { type: 'function', pattern: '^function\\s+(\\w+)\\s*\\{', captureGroup: 1 },
      // POSIX style: name() {
      { type: 'function', pattern: '^(\\w+)\\s*\\(\\)', captureGroup: 1 },
      // Alias definitions: alias name='...' or alias name="..."
      { type: 'variable', pattern: '^alias\\s+([\\w-]+)=', captureGroup: 1 },
      // Variable assignment (UPPER_CASE): NAME=value
      { type: 'variable', pattern: '^([A-Z_]\\w*)=', captureGroup: 1 },
      // Export: export NAME or export NAME=value
      { type: 'variable', pattern: '^export\\s+([A-Z_]\\w*)', captureGroup: 1 },
    ]
  },
  make: {
    name: 'Makefile',
    rgType: 'make',
    extensions: ['.mk', 'Makefile'],
    patterns: [
      // Variable assignments: NAME =, NAME :=, NAME ?=, NAME +=
      { type: 'variable', pattern: '^([A-Z_]\\w*)\\s*[:?+]?=', captureGroup: 1 },
      // Targets (with hyphen support, excluding := assignments)
      { type: 'function', pattern: '^([\\w-]+)\\s*:([^=]|$)', captureGroup: 1 },
    ]
  },
  php: {
    name: 'PHP',
    rgType: 'php',
    extensions: ['.php'],
    patterns: [
      // Top-level function (rare in modern PHP)
      { type: 'function', pattern: '^function\\s+(\\w+)', captureGroup: 1 },
      // Class: including abstract, final, readonly modifiers
      { type: 'class', pattern: '^(?:abstract\\s+)?(?:final\\s+)?(?:readonly\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Interface
      { type: 'interface', pattern: '^interface\\s+(\\w+)', captureGroup: 1 },
      // Trait
      { type: 'type', pattern: '^trait\\s+(\\w+)', captureGroup: 1 },
      // Enum (PHP 8.1+)
      { type: 'enum', pattern: '^enum\\s+(\\w+)', captureGroup: 1 },
      // Method with visibility: public/protected/private [static] function name
      { type: 'method', pattern: '^\\s+(?:public|protected|private)\\s+(?:static\\s+)?function\\s+(\\w+)', captureGroup: 1 },
      // Class constant: const NAME or visibility const NAME
      { type: 'constant', pattern: '^\\s+(?:(?:public|protected|private)\\s+)?const\\s+(\\w+)', captureGroup: 1 },
      // Top-level const (outside class)
      { type: 'constant', pattern: '^const\\s+(\\w+)', captureGroup: 1 },
      // Enum case: case Name [= value]; (uppercase first letter avoids switch-case false positives)
      { type: 'constant', pattern: '^\\s+case\\s+([A-Z]\\w*)\\s*[=;]', captureGroup: 1 },
    ]
  },
  cs: {
    name: 'C#',
    rgType: 'csharp',
    extensions: ['.cs'],
    patterns: [
      // Record class/struct (C# 9+): public record Name / public record struct Name
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:sealed\\s+)?(?:abstract\\s+)?(?:partial\\s+)?record\\s+(?:struct\\s+|class\\s+)?(\\w+)', captureGroup: 1 },
      // Delegate: public delegate ReturnType Name(
      { type: 'type', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?delegate\\s+\\w[\\w<>\\[\\],?\\s]*\\s+(\\w+)', captureGroup: 1 },
      // Class with all modifier combinations
      { type: 'class', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:sealed\\s+|abstract\\s+)?(?:static\\s+)?(?:partial\\s+)?(?:new\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Interface
      { type: 'interface', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:partial\\s+)?interface\\s+(\\w+)', captureGroup: 1 },
      // Struct with readonly/ref
      { type: 'struct', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?(?:readonly\\s+)?(?:ref\\s+)?(?:partial\\s+)?struct\\s+(\\w+)', captureGroup: 1 },
      // Enum
      { type: 'enum', pattern: '^\\s*(?:public\\s+|internal\\s+|private\\s+|protected\\s+)?enum\\s+(\\w+)', captureGroup: 1 },
      // Namespace (supports dotted names like System.Text.Json)
      { type: 'namespace', pattern: '^namespace\\s+([\\w.]+)', captureGroup: 1 },
      // Property: public Type Name { get; set; }
      { type: 'property', pattern: '^\\s+(?:public|internal|private|protected)\\s+(?:static\\s+)?(?:virtual\\s+)?(?:override\\s+)?(?:abstract\\s+)?(?:required\\s+)?(?:new\\s+)?\\w[\\w<>\\[\\],?\\s]*\\s+(\\w+)\\s*\\{\\s*(?:get|set|init)', captureGroup: 1 },
      // Const field: public const Type Name =
      { type: 'constant', pattern: '^\\s+(?:public|internal|private|protected)\\s+(?:static\\s+)?(?:new\\s+)?const\\s+\\w[\\w<>\\[\\]]*\\s+(\\w+)\\s*=', captureGroup: 1 },
      // Method with access modifier
      { type: 'method', pattern: '^\\s+(?:public|internal|private|protected)\\s+(?:static\\s+)?(?:virtual\\s+)?(?:override\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:new\\s+)?(?:partial\\s+)?\\w[\\w<>\\[\\],?\\s]*\\s+(\\w+)\\s*[<(]', captureGroup: 1 },
    ]
  },
  scala: {
    name: 'Scala',
    rgType: 'scala',
    extensions: ['.scala'],
    patterns: [
      // Case class (before regular class)
      { type: 'class', pattern: '^\\s*(?:final\\s+)?case\\s+class\\s+(\\w+)', captureGroup: 1 },
      // Sealed trait
      { type: 'type', pattern: '^\\s*sealed\\s+(?:abstract\\s+)?trait\\s+(\\w+)', captureGroup: 1 },
      // Sealed class
      { type: 'class', pattern: '^\\s*sealed\\s+(?:abstract\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Case object
      { type: 'module', pattern: '^\\s*case\\s+object\\s+(\\w+)', captureGroup: 1 },
      // Regular trait
      { type: 'type', pattern: '^\\s*(?:private\\s+|protected\\s+)?trait\\s+(\\w+)', captureGroup: 1 },
      // Regular class with modifiers
      { type: 'class', pattern: '^\\s*(?:private\\s+|protected\\s+)?(?:abstract\\s+)?(?:final\\s+)?class\\s+(\\w+)', captureGroup: 1 },
      // Object declaration (companion and standalone)
      { type: 'module', pattern: '^\\s*(?:private\\s+)?object\\s+(\\w+)', captureGroup: 1 },
      // Type member/alias
      { type: 'type', pattern: '^\\s+type\\s+(\\w+)', captureGroup: 1 },
      // Implicit def
      { type: 'function', pattern: '^\\s*(?:final\\s+)?implicit\\s+def\\s+(\\w+)', captureGroup: 1 },
      // Implicit val
      { type: 'constant', pattern: '^\\s*(?:final\\s+)?implicit\\s+(?:lazy\\s+)?val\\s+(\\w+)', captureGroup: 1 },
      // Regular def with modifiers
      { type: 'function', pattern: '^\\s*(?:override\\s+)?(?:protected\\s+|private\\s+)?(?:final\\s+)?def\\s+(\\w+)', captureGroup: 1 },
      // Lazy val
      { type: 'variable', pattern: '^\\s*(?:private\\s+|protected\\s+)?lazy\\s+val\\s+(\\w+)', captureGroup: 1 },
      // Top-level val (not deeply indented)
      { type: 'constant', pattern: '^\\s*(?:final\\s+)?(?:override\\s+)?val\\s+(\\w+)', captureGroup: 1 },
    ]
  },
  tf: {
    name: 'Terraform',
    rgType: 'tf',
    extensions: ['.tf'],
    patterns: [
      { type: 'resource', pattern: '^resource\\s+"([^"]+)"\\s+"([^"]+)"', captureGroup: 2 },
      { type: 'data', pattern: '^data\\s+"([^"]+)"\\s+"([^"]+)"', captureGroup: 2 },
      { type: 'variable', pattern: '^variable\\s+"([^"]+)"', captureGroup: 1 },
      { type: 'output', pattern: '^output\\s+"([^"]+)"', captureGroup: 1 },
      { type: 'module', pattern: '^module\\s+"([^"]+)"', captureGroup: 1 },
      { type: 'provider', pattern: '^provider\\s+"([^"]+)"', captureGroup: 1 },
      // Fixed: added capture group for "locals" literal (was buggy - no capture group before)
      { type: 'variable', pattern: '^(locals)\\s*\\{', captureGroup: 1 },
      // terraform block
      { type: 'module', pattern: '^(terraform)\\s*\\{', captureGroup: 1 },
    ]
  },
  md: {
    name: 'Markdown',
    rgType: 'markdown',
    extensions: ['.md'],
    patterns: [
      { type: 'heading', pattern: '^#{1,6}\\s+(.+?)\\s*$', captureGroup: 1 },
    ]
  },
  // Language alias: mk -> make
  mk: {
    name: 'Makefile',
    rgType: 'make',
    extensions: ['.mk', 'Makefile'],
    patterns: [
      // Variable assignments: NAME =, NAME :=, NAME ?=, NAME +=
      { type: 'variable', pattern: '^([A-Z_]\\w*)\\s*[:?+]?=', captureGroup: 1 },
      // Targets (with hyphen support, excluding := assignments)
      { type: 'function', pattern: '^([\\w-]+)\\s*:([^=]|$)', captureGroup: 1 },
    ]
  }
};

/**
 * Go block search configurations for multiline block detection
 * Ported from native/symbol-searcher/SymbolPatterns.swift GO_BLOCK_CONFIGS
 *
 * Uses ripgrep multiline mode (-U --multiline-dotall) to match entire
 * const ( ... ) and var ( ... ) blocks, then extracts symbol names line-by-line.
 * This is more reliable than single-line patterns because:
 * 1. Context-aware: knows the line is inside a const/var block (not in a function)
 * 2. Proper indent filtering rejects nested/function-local blocks
 * 3. Negative lookahead excludes Go keywords
 */
const GO_BLOCK_CONFIGS: BlockSearchConfig[] = [
  // var ( ... ) block - detects variables with type annotation
  {
    symbolType: 'variable',
    blockPattern: 'var \\([\\s\\S]*?^\\)',
    symbolNameRegex: '^\\s+(?!(?:if|for|switch|select|case|default|return|break|continue|goto|fallthrough|defer|go|var|const|type|func)\\s)([a-zA-Z_]\\w*)\\s+\\S',
    indentFilter: 'singleLevel'
  },
  // const ( ... ) block - name = value or name Type = value
  {
    symbolType: 'constant',
    blockPattern: 'const \\([\\s\\S]*?^\\)',
    symbolNameRegex: '^\\s+(?!(?:if|for|switch|select|case|default|return|break|continue|goto|fallthrough|defer|go|var|const|type|func)\\s)([a-zA-Z_]\\w*)\\s*((?<![!:<>=])=|\\s+\\w+\\s*(?<![!:<>=])=)',
    indentFilter: 'singleLevel'
  },
  // const ( ... ) block - iota continuation (name only, no = sign)
  // Enhancement over Swift implementation: captures names like StatusCreated in iota sequences
  {
    symbolType: 'constant',
    blockPattern: 'const \\([\\s\\S]*?^\\)',
    symbolNameRegex: '^\\s+(?!(?:if|for|switch|select|case|default|return|break|continue|goto|fallthrough|defer|go|var|const|type|func)\\s)([A-Z]\\w*)\\s*(?://.*)?$',
    indentFilter: 'singleLevel'
  }
];

/**
 * Rust enum variant block detection
 *
 * Rust enum variants are declared inside enum { } blocks without keyword markers
 * on individual lines, making them invisible to single-line patterns.
 * Example: enum Status { Active, Inactive, Pending(String) }
 */
const RUST_BLOCK_CONFIGS: BlockSearchConfig[] = [
  // enum { ... } block - detect enum variants (must start with uppercase)
  {
    symbolType: 'enum',
    blockPattern: 'enum\\s+\\w+[^\\n]*\\{[\\s\\S]*?^\\}',
    symbolNameRegex: '^\\s+([A-Z]\\w*)\\s*(?:[\\({,=]|//|$)',
    indentFilter: 'singleLevel'
  }
];

/**
 * TypeScript/TSX enum member block detection
 *
 * TypeScript enum members are declared inside enum { } blocks without keyword markers.
 * Example: enum Direction { Up = 'UP', Down = 'DOWN' }
 */
const TS_BLOCK_CONFIGS: BlockSearchConfig[] = [
  // enum { ... } block - detect enum members
  {
    symbolType: 'constant',
    blockPattern: '(?:export\\s+)?(?:const\\s+)?enum\\s+\\w+\\s*\\{[\\s\\S]*?^\\}',
    symbolNameRegex: '^\\s+([A-Za-z_]\\w*)\\s*(?:[=,]|$)',
    indentFilter: 'singleLevel'
  }
];

/**
 * Block search configurations by language
 * Languages that need multiline block detection for accurate symbol extraction
 */
const BLOCK_SEARCH_CONFIGS: Record<string, BlockSearchConfig[]> = {
  go: GO_BLOCK_CONFIGS,
  rs: RUST_BLOCK_CONFIGS,
  ts: TS_BLOCK_CONFIGS,
  tsx: TS_BLOCK_CONFIGS
};

/**
 * Check if ripgrep (rg) is available
 */
export async function checkRgAvailable(): Promise<RgCheckResponse> {
  const rgPaths = [
    '/opt/homebrew/bin/rg',  // Apple Silicon Homebrew
    '/usr/local/bin/rg',     // Intel Homebrew
    '/usr/bin/rg',           // System
    'rg'                     // PATH
  ];

  for (const rgPath of rgPaths) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(rgPath, ['--version'], { timeout: 2000 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      return { rgAvailable: true, rgPath };
    } catch {
      continue;
    }
  }

  return { rgAvailable: false, rgPath: null };
}

/**
 * Get list of supported programming languages
 */
export async function getSupportedLanguages(): Promise<LanguagesResponse> {
  const languages = Object.entries(LANGUAGE_CONFIGS).map(([key, config]) => {
    const extension = config.extensions[0];
    if (!extension) {
      throw new Error(`No extensions configured for language: ${key}`);
    }
    return {
      key,
      displayName: config.name,
      extension
    };
  });

  return { languages };
}

/**
 * Parse ripgrep output and extract symbols
 */
function parseRipgrepOutput(
  output: string,
  language: string,
  maxSymbols: number,
  directory: string
): SymbolResult[] {
  const symbols: SymbolResult[] = [];
  const config = LANGUAGE_CONFIGS[language];

  if (!config) {
    return symbols;
  }

  // Pre-compile regexes for performance
  const compiledPatterns = config.patterns.map(p => ({
    type: p.type,
    regex: new RegExp(p.pattern),
    captureGroup: p.captureGroup
  }));

  const lines = output.split('\n');

  for (const line of lines) {
    if (symbols.length >= maxSymbols) {
      break;
    }

    if (!line.trim()) {
      continue;
    }

    // Expected format: path:lineNumber:lineContent
    const parts = line.split(':');
    if (parts.length < 3) {
      continue;
    }

    const filePath = parts[0];
    const lineNumberStr = parts[1];
    const lineContent = parts.slice(2).join(':').trim();

    // Skip if required fields are invalid
    if (!filePath || !lineNumberStr || !lineContent) {
      continue;
    }

    const lineNumber = parseInt(lineNumberStr, 10);

    // Try to match against language patterns
    for (const { type, regex, captureGroup } of compiledPatterns) {
      const match = lineContent.match(regex);

      if (match) {
        // Extract symbol name from the specified capture group
        const name = match[captureGroup];

        // Skip if name is undefined or empty
        if (!name) {
          continue;
        }

        // Calculate relative path
        const relativePath = filePath.startsWith(directory)
          ? filePath.substring(directory.length + 1)
          : filePath;

        symbols.push({
          name,
          type: type as SymbolType,
          filePath,
          relativePath,
          lineNumber,
          lineContent,
          language
        });
        break;
      }
    }
  }

  return symbols;
}

/**
 * Execute a single ripgrep search and return raw output
 */
function executeRg(
  rgCommand: string,
  args: string[],
  timeout: number
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const execOptions = {
      timeout,
      maxBuffer: DEFAULT_MAX_BUFFER,
      killSignal: 'SIGTERM' as const
    };

    execFile(rgCommand, args, execOptions, (error, stdout, stderr) => {
      // rg exits with code 1 when no matches found, which is not an error
      if (error && error.code !== 1) {
        if (error.killed) {
          reject(new Error('ripgrep command timed out'));
        } else {
          reject(error);
        }
        return;
      }

      if (stderr) {
        logger.debug('rg stderr', { stderr });
      }

      resolve(stdout);
    });
  });
}

/**
 * Build rg arguments for a search phase
 * Matches Swift's buildRgArgs behavior
 */
function buildRgArgs(
  directory: string,
  combinedPattern: string,
  rgType: string,
  excludePatterns: string[],
  includePatterns: string[]
): string[] {
  const args = [
    '--line-number',
    '--no-heading',
    '--color', 'never'
  ];

  // When includePatterns are specified, search hidden files and ignore .gitignore rules
  // This matches Swift's behavior: only the include search phase uses --hidden/--no-ignore
  if (includePatterns.length > 0) {
    args.push('--hidden');
    args.push('--no-ignore');
  }

  args.push('--type', rgType);

  // Add exclude patterns using --glob with negation
  for (const pattern of excludePatterns) {
    args.push('--glob', `!${pattern}`);
  }

  // Add include patterns using --glob
  for (const pattern of includePatterns) {
    args.push('--glob', pattern);
  }

  args.push('-e', combinedPattern);
  args.push(directory);

  return args;
}

/**
 * Parse ripgrep multiline output and extract symbols from block content
 * Ported from native/symbol-searcher/RipgrepExecutor.swift parseAndFilterBlockOutput
 *
 * Processes rg output in path:lineNumber:content format, applies indent filtering,
 * and extracts symbol names using the config's symbolNameRegex.
 */
function parseBlockOutput(
  output: string,
  config: BlockSearchConfig,
  language: string,
  directory: string,
  maxSymbols: number
): SymbolResult[] {
  const symbols: SymbolResult[] = [];
  const symbolRegex = new RegExp(config.symbolNameRegex);

  for (const line of output.split('\n')) {
    if (symbols.length >= maxSymbols) break;
    if (!line) continue;

    // Parse "path:lineNumber:content" format
    const firstColon = line.indexOf(':');
    if (firstColon < 0) continue;

    const afterFirst = line.substring(firstColon + 1);
    const secondColon = afterFirst.indexOf(':');
    if (secondColon < 0) continue;

    const filePath = line.substring(0, firstColon);
    const lineNumberStr = afterFirst.substring(0, secondColon);
    const lineNumber = parseInt(lineNumberStr, 10);
    if (isNaN(lineNumber)) continue;

    const content = afterFirst.substring(secondColon + 1);
    const contentTrimmed = content.trim();

    // Skip empty content, comment lines, and closing delimiters
    if (!contentTrimmed || contentTrimmed.startsWith('//') || contentTrimmed === ')' || contentTrimmed === '}') continue;

    // Apply indent filter (matches Swift's indentFilter logic)
    if (config.indentFilter === 'singleLevel') {
      // Reject double tab or 5+ spaces (too deeply indented - likely function-local)
      if (content.startsWith('\t\t') || content.startsWith('     ')) continue;
      // Require some indentation (skip block opening line like "const (")
      if (!content.startsWith('\t') && !content.startsWith('  ')) continue;
    }

    // Extract symbol name using regex
    const match = content.match(symbolRegex);
    if (!match || !match[1]) continue;

    const name = match[1].trim();
    if (!name) continue;

    // Calculate relative path
    const relativePath = filePath.startsWith(directory)
      ? filePath.substring(directory.length + 1)
      : filePath;

    symbols.push({
      name,
      type: config.symbolType as SymbolType,
      filePath,
      relativePath,
      lineNumber,
      lineContent: contentTrimmed,
      language
    });
  }

  return symbols;
}

/**
 * Search for symbols in multiline blocks using ripgrep multiline mode
 * Ported from native/symbol-searcher/RipgrepExecutor.swift searchBlockSymbols
 *
 * Groups configs by blockPattern to avoid redundant rg invocations,
 * then applies each config's symbolNameRegex to the output.
 */
async function searchBlockSymbols(
  rgCommand: string,
  directory: string,
  configs: BlockSearchConfig[],
  language: string,
  rgType: string,
  maxSymbols: number,
  timeout: number,
  excludePatterns: string[]
): Promise<SymbolResult[]> {
  // Group configs by blockPattern to avoid running the same rg search multiple times
  const patternGroups = new Map<string, BlockSearchConfig[]>();
  for (const config of configs) {
    const existing = patternGroups.get(config.blockPattern) || [];
    existing.push(config);
    patternGroups.set(config.blockPattern, existing);
  }

  const allResults: SymbolResult[] = [];

  // Run one rg invocation per unique block pattern
  const promises = Array.from(patternGroups.entries()).map(async ([blockPattern, groupConfigs]) => {
    const args = [
      '-U', '--multiline-dotall',  // Multiline mode (matches Swift's -U --multiline-dotall)
      '--line-number',
      '--no-heading',
      '--color', 'never',
      '--type', rgType
    ];

    // Add exclude patterns
    for (const pattern of excludePatterns) {
      args.push('--glob', `!${pattern}`);
    }

    args.push('-e', blockPattern, directory);

    try {
      const output = await executeRg(rgCommand, args, timeout);
      // Apply each config's symbolNameRegex to the same block output
      for (const config of groupConfigs) {
        const results = parseBlockOutput(output, config, language, directory, maxSymbols);
        allResults.push(...results);
      }
    } catch (error) {
      logger.debug('Block search failed for pattern', { blockPattern, error });
    }
  });

  await Promise.all(promises);
  return allResults;
}

/**
 * Deduplicate and sort symbol results
 * Matches Swift's deduplicateAndSort: dedup by filePath:lineNumber:name, sort by filePath then lineNumber
 */
function deduplicateAndSort(results: SymbolResult[], maxSymbols: number): SymbolResult[] {
  const seen = new Set<string>();
  const unique: SymbolResult[] = [];

  for (const result of results) {
    const key = `${result.filePath}:${result.lineNumber}:${result.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  // Sort by file path, then line number
  unique.sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath < b.filePath ? -1 : 1;
    }
    return a.lineNumber - b.lineNumber;
  });

  // Apply max symbols limit
  if (unique.length > maxSymbols) {
    return unique.slice(0, maxSymbols);
  }
  return unique;
}

/**
 * Search for symbols in a directory for a specific language
 *
 * Uses three-phase search matching Swift implementation:
 * Phase 1: Normal single-line search respecting .gitignore with excludePatterns
 * Phase 2: Include patterns search with --hidden --no-ignore (only when includePatterns specified)
 * Phase 3: Block-based multiline search for languages with block configs (e.g., Go const/var blocks)
 * Results are deduplicated and sorted by filePath then lineNumber
 */
export async function searchSymbols(
  directory: string,
  language: string,
  options: SymbolSearchOptions = {}
): Promise<SymbolSearchResponse> {
  try {
    // Validate inputs
    if (!directory || typeof directory !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid directory'
      };
    }

    if (!language || typeof language !== 'string') {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'Invalid language'
      };
    }

    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: `Unsupported language: ${language}`
      };
    }

    // Check if rg is available
    const { rgAvailable, rgPath } = await checkRgAvailable();
    if (!rgAvailable || !rgPath) {
      return {
        success: false,
        symbols: [],
        symbolCount: 0,
        directory,
        language,
        searchMode: 'full',
        partial: false,
        maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
        error: 'ripgrep (rg) command not found. Install with: brew install ripgrep'
      };
    }

    const rgCommand: string = rgPath;
    const maxSymbols = options.maxSymbols || DEFAULT_MAX_SYMBOLS;
    const timeout = options.timeout || DEFAULT_SEARCH_TIMEOUT;
    const hasIncludePatterns = options.includePatterns && options.includePatterns.length > 0;

    // Combine all pattern regexes into one (used for both phases)
    const combinedPattern = config.patterns.map(p => `(${p.pattern})`).join('|');

    // Phase 1: Normal search (respects .gitignore, uses excludePatterns)
    const normalArgs = buildRgArgs(
      directory,
      combinedPattern,
      config.rgType,
      options.excludePatterns || [],
      [] // No includePatterns for normal search
    );

    const normalOutput = await executeRg(rgCommand, normalArgs, timeout);
    let allSymbols = parseRipgrepOutput(normalOutput, language, maxSymbols, directory);

    // Phase 2: Include patterns search (with --hidden --no-ignore, only when includePatterns specified)
    // This matches Swift behavior: separate rg execution for include patterns
    if (hasIncludePatterns) {
      const includeArgs = buildRgArgs(
        directory,
        combinedPattern,
        config.rgType,
        [], // No excludePatterns for include search
        options.includePatterns!
      );

      const includeOutput = await executeRg(rgCommand, includeArgs, timeout);
      const includeSymbols = parseRipgrepOutput(includeOutput, language, maxSymbols, directory);
      allSymbols = allSymbols.concat(includeSymbols);
    }

    // Phase 3: Block-based multiline search (e.g., Go const/var blocks)
    // Matches Swift's searchBlockSymbols: uses rg -U --multiline-dotall
    const blockConfigs = BLOCK_SEARCH_CONFIGS[language];
    if (blockConfigs && blockConfigs.length > 0) {
      const blockResults = await searchBlockSymbols(
        rgCommand, directory, blockConfigs, language,
        config.rgType, maxSymbols, timeout,
        options.excludePatterns || []
      );
      allSymbols = allSymbols.concat(blockResults);
    }

    // Deduplicate and sort (matching Swift's deduplicateAndSort)
    const symbols = deduplicateAndSort(allSymbols, maxSymbols);

    return {
      success: true,
      symbols,
      symbolCount: symbols.length,
      directory,
      language,
      searchMode: 'full',
      partial: symbols.length >= maxSymbols,
      maxSymbols
    };

  } catch (error) {
    logger.error('Error searching symbols:', error);
    return {
      success: false,
      symbols: [],
      symbolCount: 0,
      directory,
      language,
      searchMode: 'full',
      partial: false,
      maxSymbols: options.maxSymbols || DEFAULT_MAX_SYMBOLS,
      error: error instanceof Error ? error.message : 'Symbol search failed'
    };
  }
}
