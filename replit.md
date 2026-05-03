# Workspace

## Overview

This project is a pnpm workspace monorepo centered around the development of **صِفر (Sifr)**, a unique Arabic programming language IDE (workspace package id remains `@workspace/arabica-lang`). The primary goal is to provide a comprehensive and intuitive development environment for an Arabic-first programming language, featuring a distinctive syntax and a rich set of built-in functionalities. The project aims to bring a complete Arabic programming experience, from core language features to advanced capabilities like AI, collections, and DOM manipulation, making programming accessible and natural for Arabic speakers.

## User Preferences

I prefer detailed explanations.
Do not make changes to the folder `artifacts/api-server`.
Do not make changes to the folder `src/lang/ai.ts`.
Do not make changes to the folder `src/lang/interpreter.ts`.
Do not make changes to the folder `src/lang/lexer.ts`.
Do not make changes to the folder `src/lang/parser.ts`.

## System Architecture

The project utilizes a pnpm monorepo structure with Node.js 24 and TypeScript 5.9. The frontend, which houses the Arabica IDE, is built with React and Vite.

**Arabica Language Design:**
- **Unique Syntax:** The language features a distinctive Arabic syntax for control flow (`:` for block open, `انتهى` for close), variable declaration (`كنز`), constants (`سرّ`), functions (`مهمّة`), and other constructs, deliberately avoiding direct translation of existing languages.
- **Data Structures:** Includes native support for arrays, objects, structs (`بنية`), and advanced collections like `قاموس` (HashMap), `مجموعة` (Set), `طابور` (Queue), `مكدس` (Stack), `كومة` (Min-Heap), `قائمة_مرتبطة` (Doubly-LinkedList), and `شجرة_بحث` (BinarySearchTree).
- **Control Flow:** Implements `إن/وإلا إن/وإلا` (if/else), `كرر` (while), `جوال ع من .. إلى` (for range), `جوال ك في ..` (foreach), `طابق` (match), `حاول/التقط` (try/catch).
- **Functional Programming:** Supports recursion, closures, higher-order functions, and anonymous functions (lambdas).
- **Object-Oriented Features:** Structs can have methods with `هذا` (this binding) and support inheritance with cycle detection.
- **Type System:** Optional type annotations are supported (`كنز س: رقم = 5`) for primitive types, collections, and custom structs, enforced at declaration and assignment.
- **Module System:** A `وحدة` (module) system provides isolated environments and controlled export/import mechanisms.
- **Error Handling:** Features robust stack traces for `ArabicError` instances, providing detailed call-stack information and line-numbered errors for both parser and runtime issues.
- **Standard Library:** A comprehensive standard library with over 80 functions across domains like Math, Statistics, Random, String manipulation (including Arabic-specific text processing), Array, Object, Validation, Color, Hijri Calendar, Crypto/IDs, Audio, Performance, Formatting, and unit Conversions.
- **BigInt Support:** Arbitrary-precision integer arithmetic is provided through `عدد_كبير` for large number operations.
- **Streams API:** A lazy-evaluated Streams API for efficient data processing on collections, supporting source, lazy, and terminal operations.
- **Algorithms:** Built-in algorithms for sorting (quicksort, mergesort), searching (binary, linear), string similarity (Levenshtein), and graph traversal (DFS, BFS, shortest path).

**Sifr-Native AI Model (نموذج_صِفر):**
- A complete Arabic AI assistant written 100% in Sifr code (no external APIs/libraries).
- Components: Arabic tokenizer/normalizer, vocabulary builder, Bigram language model (weighted random next-word generation), bag-of-words vectorizer, cosine-similarity retrieval engine over a Q&A knowledge base.
- Lives as the `sifr-model` example in `ExamplesPanel.tsx`. Demonstrates training, generation, and intent-style retrieval with confidence scores — fully offline in the browser.

**IDE Features:**
- **RTL Code Editor:** A custom `CodeEditor.tsx` component designed for right-to-left languages with syntax highlighting.
- **Output Console:** `OutputConsole.tsx` for displaying program output and errors.
- **Interactive REPL:** A Read-Eval-Print Loop allowing persistent global state and echoing of expression values.
- **DOM API:** Provides a native Arabic DOM API to build interactive user interfaces directly within Arabica, including elements like `لوحة` (canvas), `زر` (button), `حقل` (input), and operations like `أضف` (append), `أنماط` (styles), `استمع` (event listeners).
- **Testing Framework:** An integrated `اختبر` framework for writing and running tests with `توقّع` assertions.
- **Share Functionality:** Allows sharing code via URL by base64-encoding the current editor content.

**AI Capabilities:**
- **Neural Networks:** `شبكة_عصبية` (ShebkaAsabiyya) class for neural network creation, supporting multiple activation functions (`ريلو`, `سيغمويد`, `ظل_زائدي`, `سوفت_ماكس`, `خطّي`) and smart weight initialization.
- **Model Management:** Functions to save and load AI models to/from local storage.
- **عبدالله Example:** Complete ready-to-use AI demo (`abdullah-ai`) — a 4-feature health classifier (age/glucose/weight/pressure) trained on 16 samples, with a `شخّص` prediction function and model persistence.

**VSCode Extension (`vscode-sifr/`):**
- Standalone TextMate grammar extension for Sifr at the repo root.
- Files: `package.json`, `language-configuration.json`, `syntaxes/sifr.tmLanguage.json`, `README.md`.
- Highlights keywords (كنز/سرّ/مهمّة/إن/جوال/طابق/بنية/وحدة/…), built-ins, types, and template literals.
- Supports `.sifr`, `.صفر`, `.arb` file extensions; manual install or `vsce package`.

**Enterprise Visual Theme:**
- Refined dark palette (#07080d base) with subdued gold accent and `Enterprise` badge.
- Logo updated to `Σ` (Sigma) for a corporate identity.
- Header includes a dedicated VSCode link button (linking to `vscode-sifr/`).

## External Dependencies

- **Vite:** Frontend build tool.
- **React:** Frontend library.
- **Intl.DateTimeFormat:** Used for Hijri calendar functionality and date/number formatting.
- **Web Audio API:** Utilized for audio functions like `نغمة` and `انطق`.
- **localStorage:** Used for persisting AI models and general key-value storage.
- **XHR (XMLHttpRequest):** Used for synchronous HTTP requests (e.g., `جلب`).
- **URL constructor:** Used for URL validation.
- **TextEncoder/TextDecoder:** Used for UTF-8 safe URL sharing.