import { tokenize } from './lexer';
import { parse } from './parser';
import { ShebkaAsabiyya, normalizeActivation, Activation } from './ai';

class ReturnSignal { constructor(public value: unknown) {} }
class BreakSignal {}
class ContinueSignal {}

class ArabicError extends Error {
  constructor(message: string) { super(message); this.name = 'خطأ'; }
}

type EnvEntry = { value: unknown; isConst: boolean };

class Environment {
  private vars = new Map<string, EnvEntry>();
  constructor(private parent: Environment | null = null) {}

  define(name: string, value: unknown, isConst = false) {
    this.vars.set(name, { value, isConst });
  }

  get(name: string): unknown {
    const e = this.vars.get(name);
    if (e !== undefined) return e.value;
    if (this.parent) return this.parent.get(name);
    throw new ArabicError(`المتغير '${name}' غير معرّف`);
  }

  set(name: string, value: unknown) {
    const e = this.vars.get(name);
    if (e !== undefined) {
      if (e.isConst) throw new ArabicError(`لا يمكن تغيير قيمة الثابت '${name}'`);
      this.vars.set(name, { value, isConst: false });
      return;
    }
    if (this.parent) { this.parent.set(name, value); return; }
    throw new ArabicError(`المتغير '${name}' غير معرّف`);
  }

  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }
}

class ArabicFunction {
  constructor(
    public params: string[],
    public body: unknown,
    public closure: Environment,
    public name?: string
  ) {}
}

export type OutputLine = { kind: 'output' | 'error' | 'info'; text: string };

export class Interpreter {
  private lines: OutputLine[] = [];
  private globals: Environment;
  private callDepth = 0;
  private readonly MAX_DEPTH = 500;
  private opCount = 0;
  private readonly MAX_OPS = 2_000_000;

  constructor() {
    this.globals = new Environment();
    this.setupBuiltins();
  }

  private emit(text: string, kind: OutputLine['kind'] = 'output') {
    this.lines.push({ kind, text });
  }

  private arabicStr(v: unknown): string {
    if (v === null || v === undefined) return 'عدم';
    if (v === true) return 'صدق';
    if (v === false) return 'كذب';
    if (v instanceof ShebkaAsabiyya) return v.summary();
    if (v instanceof ArabicFunction) return `[مهمّة: ${v.name ?? 'مجهولة'}]`;
    if (Array.isArray(v)) return '[' + v.map((x) => this.arabicStr(x)).join('، ') + ']';
    if (typeof v === 'object' && v !== null) {
      const obj = v as Record<string, unknown>;
      const structName = obj.__struct__ as string | undefined;
      const entries = Object.entries(obj)
        .filter(([k]) => k !== '__struct__')
        .map(([k, val]) => `${k}: ${this.arabicStr(val)}`);
      const inner = entries.join('، ');
      return structName ? `${structName}{${inner}}` : `{${inner}}`;
    }
    return String(v);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!this.deepEqual(a[i], b[i])) return false;
      return true;
    }
    return false;
  }

  private tick() {
    this.opCount++;
    if (this.opCount > this.MAX_OPS) throw new ArabicError('انتهى الحد الأقصى للعمليات (تحقق من الحلقات اللانهائية)');
  }

  private setupBuiltins() {
    const g = this.globals;
    const self = this;

    // Print  ("show me")
    g.define('أرني', { __b: true, fn: (...args: unknown[]) => { self.emit(args.map(a => self.arabicStr(a)).join(' ')); return null; } });
    g.define('ارني', { __b: true, fn: (...args: unknown[]) => { self.emit(args.map(a => self.arabicStr(a)).join(' ')); return null; } });
    g.define('أدخل', { __b: true, fn: (prompt?: string) => { self.emit(`[إدخال: ${prompt ?? ''}]`, 'info'); return ''; } });
    g.define('مسح', { __b: true, fn: () => { self.lines = []; return null; } });

    // Math
    g.define('جذر', { __b: true, fn: (x: number) => Math.sqrt(x) });
    g.define('مطلق', { __b: true, fn: (x: number) => Math.abs(x) });
    g.define('قوة', { __b: true, fn: (x: number, y: number) => Math.pow(x, y) });
    g.define('دور', { __b: true, fn: (x: number) => Math.round(x) });
    g.define('سقف', { __b: true, fn: (x: number) => Math.ceil(x) });
    g.define('أرضية', { __b: true, fn: (x: number) => Math.floor(x) });
    g.define('لوغاريتم', { __b: true, fn: (x: number) => Math.log(x) });
    g.define('جيب', { __b: true, fn: (x: number) => Math.sin(x) });
    g.define('جيب_تمام', { __b: true, fn: (x: number) => Math.cos(x) });
    g.define('ظل', { __b: true, fn: (x: number) => Math.tan(x) });
    g.define('عشوائي', { __b: true, fn: () => Math.random() });
    g.define('عشوائي_صحيح', { __b: true, fn: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min });
    g.define('أقصى', { __b: true, fn: (...args: unknown[]) => {
      const arr = args.length === 1 && Array.isArray(args[0]) ? args[0] as number[] : args as number[];
      return Math.max(...arr);
    }});
    g.define('أدنى', { __b: true, fn: (...args: unknown[]) => {
      const arr = args.length === 1 && Array.isArray(args[0]) ? args[0] as number[] : args as number[];
      return Math.min(...arr);
    }});
    g.define('مجموع', { __b: true, fn: (arr: number[]) => arr.reduce((a, b) => a + b, 0) });
    g.define('متوسط', { __b: true, fn: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length });
    g.define('π', Math.PI);
    g.define('ط', Math.PI);
    g.define('ه', Math.E);

    // Type conversion
    g.define('رقم', { __b: true, fn: (x: unknown) => Number(x) });
    g.define('نص', { __b: true, fn: (x: unknown) => self.arabicStr(x) });
    g.define('قائمة', { __b: true, fn: (x: unknown) => Array.isArray(x) ? x : [x] });
    g.define('نوع', { __b: true, fn: (x: unknown) => {
      if (x === null) return 'فارغ';
      if (Array.isArray(x)) return 'قائمة';
      if (x instanceof ShebkaAsabiyya) return 'شبكة_عصبية';
      if (x instanceof ArabicFunction || (x as Record<string, unknown>)?.__b) return 'دالة';
      if (typeof x === 'object') return 'كائن';
      const map: Record<string, string> = { number: 'رقم', string: 'نص', boolean: 'منطقي' };
      return map[typeof x] ?? typeof x;
    }});
    g.define('صحيح_رقمياً', { __b: true, fn: (x: unknown) => !isNaN(Number(x)) });

    // Array functions
    g.define('طول', { __b: true, fn: (x: unknown) => {
      if (Array.isArray(x)) return x.length;
      if (typeof x === 'string') return x.length;
      if (x && typeof x === 'object') return Object.keys(x).length;
      return 0;
    }});
    g.define('إضافة', { __b: true, fn: (arr: unknown[], item: unknown) => { (arr as unknown[]).push(item); return arr; } });
    g.define('حذف', { __b: true, fn: (arr: unknown[], idx?: number) => (arr as unknown[]).splice(idx ?? arr.length - 1, 1)[0] });
    g.define('أول', { __b: true, fn: (arr: unknown[]) => arr[0] ?? null });
    g.define('آخر', { __b: true, fn: (arr: unknown[]) => arr[arr.length - 1] ?? null });
    g.define('فرز', { __b: true, fn: (arr: unknown[]) => [...arr].sort((a, b) => (a as number) - (b as number)) });
    g.define('عكس', { __b: true, fn: (arr: unknown[]) => [...arr].reverse() });
    g.define('دمج', { __b: true, fn: (a: unknown[], b: unknown[]) => [...a, ...b] });
    g.define('شريحة', { __b: true, fn: (arr: unknown[], s: number, e?: number) => arr.slice(s, e) });
    g.define('انضم', { __b: true, fn: (arr: unknown[], sep?: string) => arr.map(x => self.arabicStr(x)).join(sep ?? '، ') });
    g.define('خريطة', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => arr.map(item => self.callFunction(fn, [item])) });
    g.define('تصفية', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => arr.filter(item => self.isTruthy(self.callFunction(fn, [item]))) });
    g.define('اختزال', { __b: true, fn: (arr: unknown[], fn: ArabicFunction, init: unknown) => arr.reduce((acc, item) => self.callFunction(fn, [acc, item]), init) });
    g.define('نطاق', { __b: true, fn: (from: number, to: number, step = 1) => {
      const arr: number[] = [];
      for (let i = from; i <= to; i += step) arr.push(i);
      return arr;
    }});
    g.define('مصفوفة', { __b: true, fn: (len: number, val: unknown = 0) => Array.from({ length: len }, () => val) });
    g.define('صفر_مصفوفة', { __b: true, fn: (len: number) => Array.from({ length: len }, () => 0) });

    // Object functions
    g.define('مفاتيح', { __b: true, fn: (obj: Record<string, unknown>) => Object.keys(obj) });
    g.define('قيم', { __b: true, fn: (obj: Record<string, unknown>) => Object.values(obj) });
    g.define('كائن_من_قوائم', { __b: true, fn: (keys: string[], vals: unknown[]) => {
      const obj: Record<string, unknown> = {};
      keys.forEach((k, i) => { obj[k] = vals[i] ?? null; });
      return obj;
    }});

    // String functions
    g.define('تقسيم', { __b: true, fn: (str: string, sep: string) => str.split(sep) });
    g.define('استبدال', { __b: true, fn: (str: string, from: string, to: string) => str.replaceAll(from, to) });
    g.define('تقليم', { __b: true, fn: (str: string) => str.trim() });
    g.define('يحتوي', { __b: true, fn: (str: string, sub: string) => str.includes(sub) });
    g.define('يبدأ_بـ', { __b: true, fn: (str: string, p: string) => str.startsWith(p) });
    g.define('ينتهي_بـ', { __b: true, fn: (str: string, s: string) => str.endsWith(s) });
    g.define('حروف_كبيرة', { __b: true, fn: (str: string) => str.toUpperCase() });
    g.define('حروف_صغيرة', { __b: true, fn: (str: string) => str.toLowerCase() });
    g.define('تكرار', { __b: true, fn: (str: string, n: number) => str.repeat(n) });

    // AI functions
    g.define('شبكة_عصبية', { __b: true, fn: (layers: number[], activations?: string[]) => {
      const acts = activations ? activations.map(a => normalizeActivation(a)) as Activation[] : undefined;
      return new ShebkaAsabiyya(layers, acts);
    }});
    g.define('احفظ_نموذج', { __b: true, fn: (net: ShebkaAsabiyya, key: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`arabica_model_${key}`, net.serialize());
      }
      return null;
    }});
    g.define('حمّل_نموذج', { __b: true, fn: (key: string) => {
      if (typeof window === 'undefined' || !window.localStorage) throw new ArabicError('التخزين المحلي غير متاح');
      const data = window.localStorage.getItem(`arabica_model_${key}`);
      if (!data) throw new ArabicError(`النموذج '${key}' غير موجود`);
      return ShebkaAsabiyya.deserialize(data);
    }});
    g.define('نماذج_محفوظة', { __b: true, fn: () => {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith('arabica_model_')) out.push(k.replace('arabica_model_', ''));
      }
      return out;
    }});
    g.define('درّب', { __b: true, fn: (net: ShebkaAsabiyya, data: number[][], epochs = 1000, lr = 0.1) => {
      self.emit(`[جارٍ التدريب: ${epochs} دورة على ${data.length} عينة...]`, 'info');
      net.train(data, epochs, lr);
      self.emit(`[✓ اكتمل التدريب]`, 'info');
      return null;
    }});
    g.define('تنبأ', { __b: true, fn: (net: ShebkaAsabiyya, input: number[]) => net.predict(input) });
    g.define('خسارة', { __b: true, fn: (preds: number[][], targets: number[][]) => {
      let total = 0;
      for (let i = 0; i < preds.length; i++)
        for (let j = 0; j < preds[i].length; j++) {
          const d = preds[i][j] - targets[i][j]; total += d * d;
        }
      return total / preds.length;
    }});
    g.define('دقة', { __b: true, fn: (net: ShebkaAsabiyya, data: number[][]) => {
      let correct = 0;
      for (const sample of data) {
        const input = sample.slice(0, net.layers[0]);
        const target = sample.slice(net.layers[0]);
        const pred = net.predict(input);
        const predClass = pred.indexOf(Math.max(...pred));
        const targetClass = target.indexOf(Math.max(...target));
        if (predClass === targetClass) correct++;
      }
      return (correct / data.length) * 100;
    }});

    // Math helpers for AI
    g.define('دالة_سيغمويد', { __b: true, fn: (x: number) => 1 / (1 + Math.exp(-x)) });
    g.define('دالة_ريلو', { __b: true, fn: (x: number) => Math.max(0, x) });
    g.define('حاصل_الضرب_النقطي', { __b: true, fn: (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0) });
    g.define('تطبيع', { __b: true, fn: (arr: number[]) => {
      const min = Math.min(...arr), max = Math.max(...arr), range = max - min || 1;
      return arr.map(x => (x - min) / range);
    }});

    // Time
    g.define('وقت', { __b: true, fn: () => Date.now() });
    g.define('تاريخ', { __b: true, fn: () => new Date().toLocaleString('ar') });

    // JSON
    g.define('إلى_جسون', { __b: true, fn: (v: unknown, pretty?: boolean) => {
      const replacer = (_k: string, val: unknown) =>
        val instanceof ShebkaAsabiyya ? JSON.parse(val.serialize()) :
        val instanceof ArabicFunction ? `[مهمّة]` : val;
      return JSON.stringify(v, replacer, pretty ? 2 : undefined);
    }});
    g.define('من_جسون', { __b: true, fn: (s: string) => {
      try { return JSON.parse(s); } catch (e) { throw new ArabicError(`جسون غير صالح: ${(e as Error).message}`); }
    }});

    // Regex
    g.define('نمط', { __b: true, fn: (pat: string, flags?: string) => {
      try { return new RegExp(pat, flags ?? ''); } catch (e) { throw new ArabicError(`نمط غير صالح: ${(e as Error).message}`); }
    }});
    g.define('يطابق_نمط', { __b: true, fn: (str: string, pat: RegExp | string) => {
      const r = pat instanceof RegExp ? pat : new RegExp(pat);
      return r.test(str);
    }});
    g.define('استخرج_نمط', { __b: true, fn: (str: string, pat: RegExp | string) => {
      let r: RegExp;
      try {
        if (pat instanceof RegExp) {
          r = pat.flags.includes('g') ? pat : new RegExp(pat.source, pat.flags + 'g');
        } else {
          r = new RegExp(pat, 'g');
        }
        return Array.from(str.matchAll(r), m => m[0]);
      } catch (e) {
        throw new ArabicError(`فشل استخراج النمط: ${(e as Error).message}`);
      }
    }});
    g.define('استبدل_نمط', { __b: true, fn: (str: string, pat: RegExp | string, repl: string) => {
      try {
        let r: RegExp;
        if (pat instanceof RegExp) {
          r = pat.flags.includes('g') ? pat : new RegExp(pat.source, pat.flags + 'g');
        } else {
          r = new RegExp(pat, 'g');
        }
        return str.replace(r, repl);
      } catch (e) {
        throw new ArabicError(`فشل استبدال النمط: ${(e as Error).message}`);
      }
    }});

    // HTTP (synchronous fetch via XHR)
    g.define('جلب', { __b: true, fn: (url: string) => {
      if (typeof XMLHttpRequest === 'undefined') throw new ArabicError('الجلب غير متاح هنا');
      const xhr = new XMLHttpRequest();
      try {
        xhr.open('GET', url, false);
        xhr.send();
        if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
        throw new ArabicError(`فشل الجلب: ${xhr.status} ${xhr.statusText}`);
      } catch (e) {
        if (e instanceof ArabicError) throw e;
        throw new ArabicError(`خطأ في الجلب: ${(e as Error).message}`);
      }
    }});
    g.define('جلب_جسون', { __b: true, fn: (url: string) => {
      if (typeof XMLHttpRequest === 'undefined') throw new ArabicError('الجلب غير متاح هنا');
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send();
      if (xhr.status < 200 || xhr.status >= 300) throw new ArabicError(`فشل: ${xhr.status}`);
      try { return JSON.parse(xhr.responseText); } catch { throw new ArabicError('الاستجابة ليست جسون صالحاً'); }
    }});

    // File save (browser download)
    g.define('احفظ_ملف', { __b: true, fn: (name: string, content: string) => {
      if (typeof document === 'undefined') return null;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return null;
    }});

    // localStorage helpers
    g.define('احفظ', { __b: true, fn: (key: string, value: unknown) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`arabica_${key}`, JSON.stringify(value));
      }
      return null;
    }});
    g.define('حمّل', { __b: true, fn: (key: string) => {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const v = window.localStorage.getItem(`arabica_${key}`);
      return v === null ? null : JSON.parse(v);
    }});

    // Error throwing
    g.define('خطأ', { __b: true, fn: (msg: string) => { throw new ArabicError(msg); } });
  }

  private callFunction(fn: ArabicFunction, args: unknown[], thisObj?: unknown): unknown {
    this.callDepth++;
    if (this.callDepth > this.MAX_DEPTH) throw new ArabicError('تجاوز عمق الاستدعاء الأقصى (تحقق من التكرار اللانهائي)');
    try {
      const fnEnv = new Environment(fn.closure);
      if (thisObj !== undefined) fnEnv.define('هذا', thisObj);
      for (let i = 0; i < fn.params.length; i++) {
        fnEnv.define(fn.params[i], args[i] ?? null);
      }
      try {
        this.execBlock((fn.body as { body: unknown[] }).body, fnEnv);
        return null;
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    } finally {
      this.callDepth--;
    }
  }

  run(source: string): OutputLine[] {
    this.lines = [];
    this.opCount = 0;
    this.callDepth = 0;
    try {
      const tokens = tokenize(source);
      const ast = parse(tokens);
      this.execBlock(ast.body, this.globals);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.emit(`✗ ${msg}`, 'error');
    }
    return this.lines;
  }

  private execBlock(statements: unknown[], env: Environment) {
    for (const stmt of statements) { this.tick(); this.execStmt(stmt, env); }
  }

  private execStmt(stmt: unknown, env: Environment) {
    const s = stmt as Record<string, unknown>;
    switch (s.type) {
      case 'VarDecl':
        env.define(s.name as string, s.value ? this.evalExpr(s.value, env) : null);
        break;
      case 'ConstDecl':
        env.define(s.name as string, this.evalExpr(s.value, env), true);
        break;
      case 'FunctionDecl': {
        const fn = new ArabicFunction(s.params as string[], s.body, env, s.name as string);
        env.define(s.name as string, fn);
        break;
      }
      case 'StructDecl': {
        const fields = s.fields as string[];
        const methods = (s.methods as { name: string; params: string[]; body: unknown }[]) ?? [];
        const structName = s.name as string;
        const declEnv = env;
        const ctor = {
          __b: true,
          fn: (...args: unknown[]) => {
            const obj: Record<string, unknown> = { __struct__: structName };
            fields.forEach((f, i) => { obj[f] = args[i] ?? null; });
            for (const m of methods) {
              obj[m.name] = new ArabicFunction(m.params, m.body, declEnv, m.name);
            }
            return obj;
          },
        };
        env.define(structName, ctor);
        break;
      }
      case 'TryStatement': {
        const tryBlock = s.tryBlock as unknown[];
        const catchBlock = s.catchBlock as unknown[] | null;
        const catchVar = s.catchVar as string | null;
        try {
          this.execBlock(tryBlock, new Environment(env));
        } catch (err) {
          if (err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal) throw err;
          // No catch clause → rethrow (don't silently swallow)
          if (!catchBlock) throw err;
          const catchEnv = new Environment(env);
          const msg = err instanceof Error ? err.message : String(err);
          if (catchVar) catchEnv.define(catchVar, msg);
          this.execBlock(catchBlock, catchEnv);
        }
        break;
      }
      case 'ForEachStatement': {
        const iterable = this.evalExpr(s.iterable, env);
        const items: unknown[] = Array.isArray(iterable)
          ? iterable
          : (typeof iterable === 'string' ? Array.from(iterable as string) : []);
        if (!Array.isArray(iterable) && typeof iterable !== 'string') {
          throw new ArabicError('لا يمكن المرور إلا على القوائم والنصوص');
        }
        const loopVar = s.variable as string;
        for (const item of items) {
          this.tick();
          try {
            const loopEnv = new Environment(env);
            loopEnv.define(loopVar, item);
            this.execBlock((s.body as { body: unknown[] }).body, loopEnv);
          } catch (er) {
            if (er instanceof BreakSignal) break;
            if (er instanceof ContinueSignal) continue;
            throw er;
          }
        }
        break;
      }
      case 'MatchStatement': {
        const matchValue = this.evalExpr(s.value, env);
        const cases = s.cases as { value: unknown | null; body: unknown[] }[];
        for (const c of cases) {
          let matched = false;
          if (c.value === null) {
            matched = true; // wildcard _
          } else {
            const cv = this.evalExpr(c.value, env);
            matched = this.deepEqual(matchValue, cv);
          }
          if (matched) {
            this.execBlock(c.body, new Environment(env));
            break;
          }
        }
        break;
      }
      case 'IfStatement': {
        const cond = this.evalExpr(s.condition, env);
        if (this.isTruthy(cond)) {
          this.execBlock((s.consequent as { body: unknown[] }).body, new Environment(env));
        } else if (s.alternate) {
          this.execStmt(s.alternate, env);
        }
        break;
      }
      case 'WhileStatement': {
        let iters = 0;
        while (this.isTruthy(this.evalExpr(s.condition, env))) {
          this.tick();
          if (++iters > 1_000_000) throw new ArabicError('حلقة لانهائية محتملة');
          try {
            this.execBlock((s.body as { body: unknown[] }).body, new Environment(env));
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      }
      case 'ForStatement': {
        const from = Number(this.evalExpr(s.from, env));
        const to = Number(this.evalExpr(s.to, env));
        const step = s.step ? Number(this.evalExpr(s.step, env)) : (from <= to ? 1 : -1);
        const loopVar = s.variable as string;
        const ascending = step > 0;
        for (let i = from; ascending ? i <= to : i >= to; i += step) {
          this.tick();
          try {
            const loopEnv = new Environment(env);
            loopEnv.define(loopVar, i);
            this.execBlock((s.body as { body: unknown[] }).body, loopEnv);
          } catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        break;
      }
      case 'ReturnStatement':
        throw new ReturnSignal(s.value ? this.evalExpr(s.value, env) : null);
      case 'BreakStatement':
        throw new BreakSignal();
      case 'ContinueStatement':
        throw new ContinueSignal();
      case 'Block':
        this.execBlock(s.body as unknown[], new Environment(env));
        break;
      case 'ExpressionStatement':
        this.evalExpr(s.expression, env);
        break;
    }
  }

  private evalExpr(expr: unknown, env: Environment): unknown {
    this.tick();
    const e = expr as Record<string, unknown>;
    switch (e.type) {
      case 'NumberLiteral': return e.value;
      case 'StringLiteral': return e.value;
      case 'BooleanLiteral': return e.value;
      case 'NullLiteral': return null;

      case 'Identifier': return env.get(e.name as string);

      case 'LambdaExpr':
        return new ArabicFunction(e.params as string[], e.body, env, '<مجهولة>');

      case 'TemplateLiteral': {
        const raw = (e.raw as string)
          .replace(/\x00OPEN\x00/g, '\x01')
          .replace(/\x00CLOSE\x00/g, '\x02');
        let result = '';
        let i = 0;
        while (i < raw.length) {
          if (raw[i] === '{') {
            i++;
            let exprSrc = '';
            let depth = 1;
            // String-aware brace scanner: skip braces inside string literals
            while (i < raw.length && depth > 0) {
              const ch = raw[i];
              if (ch === '"' || ch === "'") {
                const q = ch;
                exprSrc += ch; i++;
                while (i < raw.length && raw[i] !== q) {
                  if (raw[i] === '\\' && i + 1 < raw.length) { exprSrc += raw[i] + raw[i+1]; i += 2; continue; }
                  exprSrc += raw[i]; i++;
                }
                if (i < raw.length) { exprSrc += raw[i]; i++; }
                continue;
              }
              if (ch === '{') depth++;
              else if (ch === '}') { depth--; if (depth === 0) break; }
              exprSrc += ch; i++;
            }
            if (i >= raw.length) throw new ArabicError('قالب نصّي غير مغلق: ينقص }');
            i++; // consume closing }
            try {
              const subTokens = tokenize(exprSrc);
              const subAst = parse(subTokens);
              if (subAst.body.length !== 1) {
                throw new ArabicError('تعبير القالب يجب أن يكون تعبيراً واحداً');
              }
              const stmt = subAst.body[0] as { type?: string; expression?: unknown };
              if (stmt.type !== 'ExpressionStatement' || !stmt.expression) {
                throw new ArabicError('تعبير القالب يجب أن يكون تعبيراً واحداً');
              }
              result += this.arabicStr(this.evalExpr(stmt.expression, env));
            } catch (err) {
              if (err instanceof ArabicError) throw err;
              throw new ArabicError(`في تعبير القالب: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else if (raw[i] === '\x01') { result += '{'; i++; }
          else if (raw[i] === '\x02') { result += '}'; i++; }
          else { result += raw[i]; i++; }
        }
        return result;
      }

      case 'ArrayLiteral':
        return (e.elements as unknown[]).map(el => this.evalExpr(el, env));

      case 'ObjectLiteral': {
        const obj: Record<string, unknown> = {};
        for (const prop of e.properties as { key: string; value: unknown }[]) {
          obj[prop.key] = this.evalExpr(prop.value, env);
        }
        return obj;
      }

      case 'AssignExpr': {
        const value = this.evalExpr(e.value, env);
        const target = e.target as Record<string, unknown>;
        if (target.type === 'Identifier') env.set(target.name as string, value);
        else if (target.type === 'IndexExpr') {
          const obj = this.evalExpr(target.object, env);
          const idx = this.evalExpr(target.index, env);
          (obj as Record<string | number, unknown>)[idx as string | number] = value;
        } else if (target.type === 'MemberExpr') {
          const obj = this.evalExpr(target.object, env);
          (obj as Record<string, unknown>)[target.property as string] = value;
        }
        return value;
      }

      case 'BinaryExpr': {
        const left = this.evalExpr(e.left, env);
        const right = this.evalExpr(e.right, env);
        switch (e.op) {
          case '+': return typeof left === 'string' || typeof right === 'string'
            ? this.arabicStr(left) + this.arabicStr(right)
            : (left as number) + (right as number);
          case '-': return (left as number) - (right as number);
          case '*': return (left as number) * (right as number);
          case '/':
            if (right === 0) throw new ArabicError('القسمة على صفر');
            return (left as number) / (right as number);
          case '%': return (left as number) % (right as number);
          case '**': return Math.pow(left as number, right as number);
          case '==': return left === right;
          case '!=': return left !== right;
          case '<': return (left as number) < (right as number);
          case '>': return (left as number) > (right as number);
          case '<=': return (left as number) <= (right as number);
          case '>=': return (left as number) >= (right as number);
          case '&&': return this.isTruthy(left) ? right : left;
          case '||': return this.isTruthy(left) ? left : right;
        }
        break;
      }

      case 'UnaryExpr': {
        const val = this.evalExpr(e.operand, env);
        if (e.op === '-') return -(val as number);
        if (e.op === '!') return !this.isTruthy(val);
        break;
      }

      case 'MemberExpr': {
        const obj = this.evalExpr(e.object, env);
        if (obj === null || obj === undefined)
          throw new ArabicError(`لا يمكن الوصول إلى '${e.property}' من قيمة فارغة`);
        const prop = e.property as string;
        if (Array.isArray(obj)) {
          if (prop === 'طول') return obj.length;
        }
        if (typeof obj === 'string') {
          if (prop === 'طول') return obj.length;
        }
        return (obj as Record<string, unknown>)[prop] ?? null;
      }

      case 'IndexExpr': {
        const obj = this.evalExpr(e.object, env);
        const idx = this.evalExpr(e.index, env);
        if (obj === null || obj === undefined)
          throw new ArabicError('لا يمكن الوصول إلى فهرس من قيمة فارغة');
        return (obj as Record<string | number, unknown>)[idx as string | number] ?? null;
      }

      case 'CallExpr': {
        const args = (e.args as unknown[]).map(a => this.evalExpr(a, env));

        // Method calls: obj.method(...)
        if ((e.callee as Record<string, unknown>).type === 'MemberExpr') {
          const callee = e.callee as Record<string, unknown>;
          const obj = this.evalExpr(callee.object, env);
          const method = callee.property as string;

          if (Array.isArray(obj)) {
            switch (method) {
              case 'إضافة': obj.push(args[0]); return obj;
              case 'حذف': return obj.splice((args[0] as number) ?? obj.length - 1, 1)[0];
              case 'طول': return obj.length;
              case 'فرز': return obj.sort((a, b) => (a as number) - (b as number));
              case 'عكس': return obj.reverse();
              case 'يحتوي': return obj.includes(args[0]);
              case 'انضم': return obj.map(x => this.arabicStr(x)).join((args[0] as string) ?? '، ');
              case 'شريحة': return obj.slice(args[0] as number, args[1] as number);
              case 'خريطة': if (args[0] instanceof ArabicFunction) return obj.map(item => this.callFunction(args[0] as ArabicFunction, [item])); break;
              case 'تصفية': if (args[0] instanceof ArabicFunction) return obj.filter(item => this.isTruthy(this.callFunction(args[0] as ArabicFunction, [item]))); break;
            }
          }
          if (typeof obj === 'string') {
            switch (method) {
              case 'طول': return obj.length;
              case 'تقسيم': return obj.split((args[0] as string) ?? '');
              case 'استبدال': return obj.replaceAll(args[0] as string, args[1] as string);
              case 'تقليم': return obj.trim();
              case 'يحتوي': return obj.includes(args[0] as string);
              case 'يبدأ_بـ': return obj.startsWith(args[0] as string);
              case 'ينتهي_بـ': return obj.endsWith(args[0] as string);
            }
          }
          // Fall through to regular property call
          const maybeMethod = (obj as Record<string, unknown>)?.[method];
          if (maybeMethod instanceof ArabicFunction) {
            return this.callFunction(maybeMethod, args, obj);
          }
          if (maybeMethod && (maybeMethod as Record<string, unknown>).__b) {
            return (maybeMethod as { __b: boolean; fn: (...a: unknown[]) => unknown }).fn(...args);
          }
        }

        const callee = this.evalExpr(e.callee, env);

        if (callee && typeof callee === 'object' && (callee as Record<string, unknown>).__b) {
          return (callee as { __b: boolean; fn: (...a: unknown[]) => unknown }).fn(...args);
        }

        if (callee instanceof ArabicFunction) {
          return this.callFunction(callee, args);
        }

        const calleeName = (e.callee as Record<string, unknown>).name as string ?? '???';
        throw new ArabicError(`'${calleeName}' ليست دالة`);
      }
    }
    return null;
  }

  private isTruthy(val: unknown): boolean {
    if (val === null || val === undefined || val === false || val === 0 || val === '') return false;
    return true;
  }
}
