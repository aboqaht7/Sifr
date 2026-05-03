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

### Tier 1 — Essentials (added)
- **Try/catch**: `حاول : ... التقط ع : ... انتهى` (catch var optional)
- **Throw**: `خطأ("رسالة")` raises ArabicError caught by catch
- **Lambdas**: `مهمّة(أ، ب) : أعد أ + ب انتهى` as expression (anonymous)
- **Methods on structs** with `هذا` (this binding):
  ```
  بنية نقطة :
      س
      ع
      مهمّة مسافة() :
          أعد جذر(هذا.س ** 2 + هذا.ع ** 2)
      انتهى
  انتهى
  ```
- **Template strings**: `` `مرحباً {اسم}، عمرك {عمر + 1}` ``
  Uses `\{` / `\}` for literal braces. Implementation: lexer emits TEMPLATE token with NUL-marker escapes; interpreter re-tokenizes/parses each `{expr}` substring.

### Tier 2 — World Connection (added)
- **JSON**: `إلى_جسون(كائن، صدق)` (pretty-print flag), `من_جسون(نص)`
- **Regex**: `نمط(pat, flags)`, `يطابق_نمط`, `استخرج_نمط`, `استبدل_نمط`
- **HTTP** (synchronous via XHR — fits sync interpreter): `جلب(url)`, `جلب_جسون(url)`
- **File save** (browser download): `احفظ_ملف(name, content)`
- **localStorage**: `احفظ(key, value)` / `حمّل(key)` (auto JSON-encoded, prefixed `arabica_`)

### Tier 3 — Advanced AI (added)
- **Multiple activations** per layer: `شبكة_عصبية([2، 8، 1]، ["ريلو"، "سيغمويد"])`
  Supported: `سيغمويد`, `ريلو`, `ظل_زائدي` (tanh), `سوفت_ماكس`, `خطّي`
- **Smart weight init**: He init for ReLU, Xavier for sigmoid/tanh
- **Save/load models** to localStorage: `احفظ_نموذج(net, key)`, `حمّل_نموذج(key)`, `نماذج_محفوظة()`
- Core AI: `شبكة_عصبية`, `درّب`, `تنبأ`, `خسارة`, `دقة`

### Tier 4 — Real Language Upgrades (added)
- **Line-numbered errors**: every Statement carries `loc { line, col }` from the parser; runtime errors are prefixed with `[السطر N]`. Parser errors are reformatted to the same prefix. Errors raised inside DOM event handlers also carry location via `emitEventError`.
- **Struct inheritance**: `بنية كلب وارث حيوان : ... انتهى`
  Resolves the chain at declaration time with cycle detection (`حلقة وراثة` error). Inherited methods preserve their **parent's** declaration environment for correct lexical capture; child overrides win on name conflict.
- **DOM API** (build real interactive UIs from عربيكا):
  - Elements: `لوحة`, `عنصر`, `نص_عنصر`, `عنوان`, `فقرة`, `زر`, `حقل`, `حاوية`, `صف`, `صورة`
  - Operations: `أضف`, `أنماط` (Arabic CSS keys: لون/خلفية/حشو/...), `استمع`, `غيّر_نص`, `امسح_اللوحة`
  - Events bind ArabicFunction handlers; errors in handlers print to the output console with line info.
  - Wired via `interpreter.setCanvas(el)` — Playground exposes a "🎨 لوحة" pane.
- **Extended stdlib**:
  - Dates: `الآن`, `سنة`, `شهر`, `يوم`, `ساعة`, `دقيقة`, `ثانية`, `تنسيق_تاريخ(t, "يوم/شهر/سنة ساعة:دقيقة")`
  - Iteration: `عدّ` (enumerate), `زوج` (zip), `مجموعة_فريدة`, `عدّ_تكرارات`, `تجميع(list, fn)`
  - Format: `حشو_يسار/يمين`, `رقم_بصيغة(n, decimals)`, `عكس_نص`
  - Math: `حد(x, lo, hi)` (clamp), `علامة` (sign), `بين(x, lo, hi)`, `متوسط_موزون`
- **Share via URL**: 📤 button base64-encodes the current code into `#code=...` hash; the hash auto-decodes on page load (UTF-8 safe via TextEncoder/Decoder).

### Language Files
- `src/lang/lexer.ts` — Arabic tokenizer (handles diacritics, Arabic digits, Arabic comma)
- `src/lang/parser.ts` — Recursive descent parser → AST
- `src/lang/ai.ts` — `ShebkaAsabiyya` neural network class
- `src/lang/interpreter.ts` — Tree-walking interpreter with closures, environment chain
- `src/components/CodeEditor.tsx` — RTL code editor with syntax highlighting
- `src/components/OutputConsole.tsx` — Output display
- `src/components/ExamplesPanel.tsx` — 18 built-in examples (5 categories)
- `src/pages/Playground.tsx` — Main IDE layout (editor + console + canvas + share)

### Examples Included (18 total, 5 categories)
**أساسي (Basics)**: Hello World, Math, Control flow, Functions & recursion, Arrays & structs, Dates & stats
**تطبيقات (Apps)**: Interactive counter, Todo list (full DOM apps)
**خوارزميات (Algorithms)**: Pattern matching, Sorting / primes / GCD
**متقدم (Advanced)**: Try/catch, Lambdas + templates, OOP with methods, JSON + regex, Inheritance
**ذكاء اصطناعي (AI)**: XOR network, Multi-activation + save/load, 2D classifier

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/arabica-lang run dev` — run IDE locally
