# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the **عربيكا (Arabica)** Arabic programming language IDE as the main artifact.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/arabica-lang)
- **API framework**: Express 5 (artifacts/api-server, unused)
- **Database**: PostgreSQL + Drizzle ORM (unused)
- **Build**: Vite

## Arabica Language (عربيكا)

The main artifact at `artifacts/arabica-lang/` implements a complete Arabic programming language with:

### Language Features (UNIQUE syntax — not a translation of any language)
Block delimiters: `:` opens a block, `انتهى` closes it (Pascal-inspired but distinctive).

- Variables: `كنز س = 5` (treasure)
- Constants: `سرّ ط = 3.14` (secret)
- Functions: `مهمّة جمع(أ، ب) : أعد أ + ب  انتهى` (mission)
- Structs: `بنية طالب : اسم درجة انتهى` → `طالب("أحمد"، 95)`
- If/else: `إن شرط : ... وإلا إن شرط٢ : ... وإلا : ... انتهى`
- While: `كرر شرط : ... انتهى` (repeat)
- For range: `جوال ع من 1 إلى 10 [بخطوة 2] : ... انتهى` (traveler)
- Foreach: `جوال ك في قائمة : ... انتهى`
- Match: `طابق ن : حال 1 : ... حال _ : ... انتهى`
- Booleans: `صدق` / `كذب` ; null: `عدم`
- Print: `أرني(...)` ; return: `أعد` ; break: `قف` ; continue: `استمر`
- Arrays, objects, recursion, closures, higher-order functions

### Built-in AI Functions
- `شبكة_عصبية([2، 4، 1])` — create feedforward neural network
- `درّب(نموذج، بيانات، دورات، معدل_التعلم)` — backpropagation training
- `تنبأ(نموذج، مدخل)` — make predictions
- `خسارة(تنبؤات، حقيقية)` — MSE loss
- `دقة(نموذج، بيانات)` — accuracy %

### Language Files
- `src/lang/lexer.ts` — Arabic tokenizer (handles diacritics, Arabic digits, Arabic comma)
- `src/lang/parser.ts` — Recursive descent parser → AST
- `src/lang/ai.ts` — `ShebkaAsabiyya` neural network class
- `src/lang/interpreter.ts` — Tree-walking interpreter with closures, environment chain
- `src/components/CodeEditor.tsx` — RTL code editor with syntax highlighting
- `src/components/OutputConsole.tsx` — Output display
- `src/components/ExamplesPanel.tsx` — 9 built-in examples
- `src/pages/Playground.tsx` — Main IDE layout

### Examples Included
1. مرحباً بالعالم (Hello World)
2. العمليات الحسابية (Math)
3. الشروط والحلقات (Control flow)
4. الدوال والتكرار (Functions & recursion)
5. القوائم والكائنات (Arrays & objects)
6. خوارزمية الفرز (Sorting algorithms)
7. شبكة XOR العصبية (AI: XOR neural network)
8. مصنف الذكاء الاصطناعي (AI: classifier)
9. خوارزميات قياسية (Primes, GCD)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/arabica-lang run dev` — run IDE locally
