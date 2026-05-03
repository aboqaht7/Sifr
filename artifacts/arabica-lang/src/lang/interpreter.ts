import { tokenize } from './lexer';
import { parse } from './parser';
import { ShebkaAsabiyya, normalizeActivation, Activation } from './ai';

class ReturnSignal { constructor(public value: unknown) {} }
class BreakSignal {}
class ContinueSignal {}

class ArabicError extends Error {
  public loc?: { line: number; col: number };
  public arabicStack?: { name: string; loc: { line: number; col: number } | null }[];
  constructor(message: string) { super(message); this.name = 'خطأ'; }
}

interface ModuleEnv {
  env: Environment;
  exports: Set<string>;
}

interface StructDef {
  name: string;
  parent: string | null;
  fields: string[];
  methods: { name: string; params: string[]; body: unknown; declEnv: Environment }[];
}

type EnvEntry = { value: unknown; isConst: boolean; typeName?: string | null };

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
      // Preserve type annotation across re-assignment; the interpreter checks via getTypeAnnotation before calling set
      this.vars.set(name, { value, isConst: false, typeName: e.typeName });
      return;
    }
    if (this.parent) { this.parent.set(name, value); return; }
    throw new ArabicError(`المتغير '${name}' غير معرّف`);
  }
  setTypeAnnotation(name: string, typeName: string) {
    const e = this.vars.get(name);
    if (e) this.vars.set(name, { ...e, typeName });
  }
  getTypeAnnotation(name: string): string | null | undefined {
    const e = this.vars.get(name);
    if (e) return e.typeName ?? null;
    if (this.parent) return this.parent.getTypeAnnotation(name);
    return null;
  }

  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }
  hasOwn(name: string): boolean { return this.vars.has(name); }
  getOwnEntry(name: string): EnvEntry | undefined { return this.vars.get(name); }
  defineEntry(name: string, entry: EnvEntry) { this.vars.set(name, { ...entry }); }
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
  private currentLoc: { line: number; col: number } | null = null;
  private structs = new Map<string, StructDef>();
  private modules = new Map<string, ModuleEnv>();
  private callStack: { name: string; callerLoc: { line: number; col: number } | null }[] = [];
  private testRegistry: { name: string; fn: ArabicFunction }[] = [];
  public canvasEl: HTMLElement | null = null;

  constructor() {
    this.globals = new Environment();
    this.setupBuiltins();
  }

  setCanvas(el: HTMLElement | null) { this.canvasEl = el; }
  resetStructs() { this.structs.clear(); }

  emitEventError(e: unknown, source: string) {
    const msg = e instanceof Error ? e.message : String(e);
    const loc = (e as ArabicError)?.loc;
    const prefix = loc ? `[السطر ${loc.line}] ` : '';
    this.emit(`✗ ${prefix}في ${source}: ${msg}`, 'error');
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

    // ===== EXTENDED STDLIB =====

    // Date helpers
    g.define('الآن', { __b: true, fn: () => new Date() });
    g.define('تاريخ_من', { __b: true, fn: (s: string) => new Date(s) });
    g.define('سنة', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getFullYear() });
    g.define('شهر', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getMonth() + 1 });
    g.define('يوم', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getDate() });
    g.define('ساعة', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getHours() });
    g.define('دقيقة', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getMinutes() });
    g.define('ثانية', { __b: true, fn: (d: Date) => (d instanceof Date ? d : new Date(d)).getSeconds() });
    g.define('تنسيق_تاريخ', { __b: true, fn: (d: Date, fmt?: string) => {
      const date = d instanceof Date ? d : new Date(d);
      if (!fmt) return date.toLocaleString('ar-SA');
      return fmt
        .replace('سنة', String(date.getFullYear()))
        .replace('شهر', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('يوم', String(date.getDate()).padStart(2, '0'))
        .replace('ساعة', String(date.getHours()).padStart(2, '0'))
        .replace('دقيقة', String(date.getMinutes()).padStart(2, '0'))
        .replace('ثانية', String(date.getSeconds()).padStart(2, '0'));
    }});

    // Iteration helpers
    g.define('عدّ', { __b: true, fn: (arr: unknown[]) => arr.map((v, i) => [i, v]) });
    g.define('زوج', { __b: true, fn: (a: unknown[], b: unknown[]) => {
      const len = Math.min(a.length, b.length);
      const out: unknown[] = [];
      for (let i = 0; i < len; i++) out.push([a[i], b[i]]);
      return out;
    }});
    g.define('مجموعة_فريدة', { __b: true, fn: (arr: unknown[]) => {
      const seen = new Set<string>();
      const out: unknown[] = [];
      for (const v of arr) {
        const k = JSON.stringify(v);
        if (!seen.has(k)) { seen.add(k); out.push(v); }
      }
      return out;
    }});
    g.define('عدّ_تكرارات', { __b: true, fn: (arr: unknown[]) => {
      const counts: Record<string, number> = {};
      for (const v of arr) {
        const k = self.arabicStr(v);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return counts;
    }});
    g.define('تجميع', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => {
      const groups: Record<string, unknown[]> = {};
      for (const v of arr) {
        const k = self.arabicStr(self.callFunction(fn, [v]));
        (groups[k] = groups[k] ?? []).push(v);
      }
      return groups;
    }});

    // String formatting
    g.define('حشو_يسار', { __b: true, fn: (s: string, len: number, ch = ' ') => String(s).padStart(len, ch) });
    g.define('حشو_يمين', { __b: true, fn: (s: string, len: number, ch = ' ') => String(s).padEnd(len, ch) });
    g.define('رقم_بصيغة', { __b: true, fn: (n: number, decimals = 2) => Number(n).toFixed(decimals) });
    g.define('عكس_نص', { __b: true, fn: (s: string) => Array.from(s).reverse().join('') });

    // Math additions
    g.define('حد', { __b: true, fn: (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x)) });
    g.define('علامة', { __b: true, fn: (x: number) => Math.sign(x) });
    g.define('بين', { __b: true, fn: (x: number, lo: number, hi: number) => x >= lo && x <= hi });
    g.define('متوسط_موزون', { __b: true, fn: (vals: number[], weights: number[]) => {
      let s = 0, w = 0;
      for (let i = 0; i < vals.length; i++) { s += vals[i] * (weights[i] ?? 1); w += weights[i] ?? 1; }
      return w === 0 ? 0 : s / w;
    }});

    // ===== DOM API: build real web UIs from عربيكا =====
    const ensureCanvas = (): HTMLElement => {
      if (!self.canvasEl) throw new ArabicError('اللوحة غير متاحة (افتح لوحة المعاينة)');
      return self.canvasEl;
    };
    const isEl = (v: unknown): v is HTMLElement =>
      typeof HTMLElement !== 'undefined' && v instanceof HTMLElement;

    g.define('لوحة', { __b: true, fn: () => ensureCanvas() });
    g.define('امسح_اللوحة', { __b: true, fn: () => { ensureCanvas().innerHTML = ''; return null; } });
    g.define('عنصر', { __b: true, fn: (tag: string) => {
      if (typeof document === 'undefined') throw new ArabicError('DOM غير متاح');
      return document.createElement(String(tag || 'div'));
    }});
    g.define('نص_عنصر', { __b: true, fn: (text: string, tag = 'span') => {
      if (typeof document === 'undefined') throw new ArabicError('DOM غير متاح');
      const el = document.createElement(String(tag));
      el.textContent = self.arabicStr(text);
      return el;
    }});
    g.define('عنوان', { __b: true, fn: (text: string, level = 2) => {
      if (typeof document === 'undefined') throw new ArabicError('DOM غير متاح');
      const lv = Math.max(1, Math.min(6, Math.round(Number(level) || 2)));
      const el = document.createElement(`h${lv}`);
      el.textContent = self.arabicStr(text);
      return el;
    }});
    g.define('فقرة', { __b: true, fn: (text: string) => {
      const el = document.createElement('p');
      el.textContent = self.arabicStr(text);
      return el;
    }});
    g.define('زر', { __b: true, fn: (text: string, onClick?: ArabicFunction) => {
      const btn = document.createElement('button');
      btn.textContent = self.arabicStr(text);
      btn.style.cssText = 'padding:8px 16px;margin:4px;border:0;border-radius:8px;background:#10b981;color:#fff;font-family:inherit;cursor:pointer;font-size:14px;';
      if (onClick instanceof ArabicFunction) {
        btn.addEventListener('click', () => {
          try { self.callFunction(onClick, []); }
          catch (e) { self.emitEventError(e, 'الزر'); }
        });
      }
      return btn;
    }});
    g.define('حقل', { __b: true, fn: (placeholder?: string, onInput?: ArabicFunction) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      if (placeholder) inp.placeholder = String(placeholder);
      inp.style.cssText = 'padding:8px 12px;margin:4px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:14px;';
      if (onInput instanceof ArabicFunction) {
        inp.addEventListener('input', () => {
          try { self.callFunction(onInput, [inp.value]); }
          catch (e) { self.emitEventError(e, 'الحقل'); }
        });
      }
      return inp;
    }});
    g.define('حاوية', { __b: true, fn: (...children: unknown[]) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px;';
      for (const c of children) {
        if (isEl(c)) div.appendChild(c);
        else if (c !== null && c !== undefined) {
          const t = document.createElement('span');
          t.textContent = self.arabicStr(c);
          div.appendChild(t);
        }
      }
      return div;
    }});
    g.define('صف', { __b: true, fn: (...children: unknown[]) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;flex-direction:row;gap:8px;align-items:center;flex-wrap:wrap;';
      for (const c of children) {
        if (isEl(c)) div.appendChild(c);
        else if (c !== null && c !== undefined) {
          const t = document.createElement('span'); t.textContent = self.arabicStr(c); div.appendChild(t);
        }
      }
      return div;
    }});
    g.define('صورة', { __b: true, fn: (src: string, alt = '') => {
      const img = document.createElement('img');
      img.src = String(src); img.alt = String(alt);
      img.style.cssText = 'max-width:100%;border-radius:8px;';
      return img;
    }});
    g.define('أضف', { __b: true, fn: (parent: unknown, ...children: unknown[]) => {
      const p = parent === null || parent === undefined ? ensureCanvas() : (parent as HTMLElement);
      if (!isEl(p)) throw new ArabicError('الوالد ليس عنصراً');
      for (const c of children) {
        if (isEl(c)) p.appendChild(c);
        else if (c !== null && c !== undefined) {
          const t = document.createElement('span'); t.textContent = self.arabicStr(c); p.appendChild(t);
        }
      }
      return p;
    }});
    g.define('أنماط', { __b: true, fn: (el: HTMLElement, styles: Record<string, string>) => {
      if (!isEl(el)) throw new ArabicError('ليس عنصراً');
      const cssMap: Record<string, string> = {
        'لون': 'color', 'خلفية': 'background', 'خط': 'fontFamily', 'حجم_خط': 'fontSize',
        'سماكة': 'fontWeight', 'محاذاة': 'textAlign', 'حشو': 'padding', 'هامش': 'margin',
        'حدود': 'border', 'دائرية': 'borderRadius', 'عرض': 'width', 'ارتفاع': 'height',
        'ظل': 'boxShadow', 'شفافية': 'opacity',
      };
      for (const [k, v] of Object.entries(styles ?? {})) {
        const cssKey = cssMap[k] ?? k;
        (el.style as unknown as Record<string, string>)[cssKey] = String(v);
      }
      return el;
    }});
    g.define('استمع', { __b: true, fn: (el: HTMLElement, event: string, handler: ArabicFunction) => {
      if (!isEl(el)) throw new ArabicError('ليس عنصراً');
      const map: Record<string, string> = {
        'نقر': 'click', 'مرور': 'mouseover', 'إدخال': 'input', 'تغيير': 'change',
        'مفتاح': 'keydown', 'تركيز': 'focus',
      };
      const ev = map[event] ?? event;
      el.addEventListener(ev, () => {
        try { self.callFunction(handler, []); }
        catch (e) { self.emitEventError(e, event); }
      });
      return el;
    }});
    g.define('غيّر_نص', { __b: true, fn: (el: HTMLElement, text: unknown) => {
      if (!isEl(el)) throw new ArabicError('ليس عنصراً');
      el.textContent = self.arabicStr(text);
      return el;
    }});

    // ==================== Test framework ====================
    g.define('اختبر', { __b: true, fn: (name: unknown, fn: unknown) => {
      if (typeof name !== 'string') throw new ArabicError(`'اختبر' يحتاج اسم نصّي`);
      if (!(fn instanceof ArabicFunction)) throw new ArabicError(`'اختبر' يحتاج دالّة`);
      self.testRegistry.push({ name, fn });
      return null;
    }});
    g.define('توقّع', { __b: true, fn: (actual: unknown, expected: unknown, label?: unknown) => {
      if (!self.deepEqual(actual, expected)) {
        const lbl = typeof label === 'string' ? ` (${label})` : '';
        throw new ArabicError(`فشل التوقّع${lbl}: متوقع ${self.arabicStr(expected)}، وُجد ${self.arabicStr(actual)}`);
      }
      return null;
    }});
    g.define('توقع', { __b: true, fn: (actual: unknown, expected: unknown, label?: unknown) => {
      if (!self.deepEqual(actual, expected)) {
        const lbl = typeof label === 'string' ? ` (${label})` : '';
        throw new ArabicError(`فشل التوقّع${lbl}: متوقع ${self.arabicStr(expected)}، وُجد ${self.arabicStr(actual)}`);
      }
      return null;
    }});
    g.define('توقّع_صدق', { __b: true, fn: (cond: unknown, label?: unknown) => {
      if (!self.isTruthy(cond)) {
        const lbl = typeof label === 'string' ? ` (${label})` : '';
        throw new ArabicError(`فشل التوقّع${lbl}: متوقع صدق، وُجد ${self.arabicStr(cond)}`);
      }
      return null;
    }});
    g.define('توقّع_خطأ', { __b: true, fn: (fn: unknown, msgPart?: unknown) => {
      if (!(fn instanceof ArabicFunction)) throw new ArabicError(`'توقّع_خطأ' يحتاج دالّة`);
      try {
        self.callFunction(fn, []);
      } catch (e) {
        if (typeof msgPart === 'string') {
          const m = e instanceof Error ? e.message : String(e);
          if (!m.includes(msgPart)) throw new ArabicError(`فشل التوقّع: الخطأ لا يحتوي على '${msgPart}'، الفعلي: ${m}`);
        }
        return null;
      }
      throw new ArabicError(`فشل التوقّع: لم يُرمَ خطأ`);
    }});
    g.define('شغّل_اختبارات', { __b: true, fn: () => {
      if (self.testRegistry.length === 0) {
        self.emit('لا توجد اختبارات مسجّلة', 'info');
        return { نجح: 0, فشل: 0, مجموع: 0 };
      }
      let passed = 0, failed = 0;
      self.emit(`▶ تشغيل ${self.testRegistry.length} اختبار...`, 'info');
      for (const t of self.testRegistry) {
        try {
          self.callFunction(t.fn, []);
          self.emit(`  ✓ ${t.name}`, 'info');
          passed++;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          self.emit(`  ✗ ${t.name}: ${m}`, 'error');
          failed++;
        }
      }
      const summary = `النتيجة: ${passed} نجح، ${failed} فشل من أصل ${self.testRegistry.length}`;
      self.emit(failed === 0 ? `✓ ${summary}` : `✗ ${summary}`, failed === 0 ? 'info' : 'error');
      return { نجح: passed, فشل: failed, مجموع: self.testRegistry.length };
    }});

    // ╔═══════════════════════════════════════════════════════════╗
    // ║         MEGA STDLIB — Tier 6: Big Library                ║
    // ╚═══════════════════════════════════════════════════════════╝

    // ── Math (extended) ──────────────────────────────────────────
    g.define('لو2', { __b: true, fn: (x: number) => Math.log2(x) });
    g.define('لو10', { __b: true, fn: (x: number) => Math.log10(x) });
    g.define('أُس', { __b: true, fn: (x: number) => Math.exp(x) });
    g.define('وتر', { __b: true, fn: (...xs: number[]) => Math.hypot(...xs) });
    g.define('قاطع', { __b: true, fn: (a: number, b: number) => {
      a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b));
      while (b) { [a, b] = [b, a % b]; } return a;
    }});
    g.define('مضاعف', { __b: true, fn: (a: number, b: number) => {
      const gcd = (x: number, y: number): number => { x = Math.abs(Math.trunc(x)); y = Math.abs(Math.trunc(y)); while (y) [x, y] = [y, x % y]; return x; };
      const g0 = gcd(a, b); return g0 === 0 ? 0 : Math.abs(a * b) / g0;
    }});
    g.define('مضروب', { __b: true, fn: (n: number) => {
      n = Math.trunc(n);
      if (n < 0) throw new ArabicError('المضروب لرقم سالب غير معرّف');
      if (n > 170) throw new ArabicError('المضروب أكبر من المسموح');
      let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
    }});
    g.define('فيبوناتشي', { __b: true, fn: (n: number) => {
      n = Math.max(0, Math.trunc(n));
      if (n < 2) return n;
      let a = 0, b = 1; for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; } return b;
    }});
    g.define('أولي؟', { __b: true, fn: (n: number) => {
      n = Math.trunc(n); if (n < 2) return false;
      if (n < 4) return true; if (n % 2 === 0) return false;
      for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
      return true;
    }});
    g.define('قائمة_أوّليات', { __b: true, fn: (limit: number) => {
      limit = Math.max(0, Math.trunc(limit));
      if (limit > 1_000_000) throw new ArabicError(`الحد الأقصى لـ 'قائمة_أوّليات' هو 1،000،000 — طُلب ${limit}`);
      const sieve = new Uint8Array(limit + 1);
      const out: number[] = [];
      for (let i = 2; i <= limit; i++) {
        if (!sieve[i]) { out.push(i); for (let j = i * i; j <= limit; j += i) sieve[j] = 1; }
      }
      return out;
    }});
    g.define('قوس_جيب', { __b: true, fn: (x: number) => Math.asin(x) });
    g.define('قوس_جيب_تمام', { __b: true, fn: (x: number) => Math.acos(x) });
    g.define('قوس_ظل', { __b: true, fn: (x: number) => Math.atan(x) });
    g.define('قوس_ظل2', { __b: true, fn: (y: number, x: number) => Math.atan2(y, x) });
    g.define('إلى_راديان', { __b: true, fn: (deg: number) => deg * Math.PI / 180 });
    g.define('إلى_درجات', { __b: true, fn: (rad: number) => rad * 180 / Math.PI });
    g.define('مسافة', { __b: true, fn: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1) });

    // ── Statistics ───────────────────────────────────────────────
    g.define('وسيط', { __b: true, fn: (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }});
    g.define('منوال', { __b: true, fn: (arr: unknown[]) => {
      const c: Record<string, { v: unknown; n: number }> = {};
      let best: { v: unknown; n: number } | null = null;
      for (const v of arr) {
        const k = self.arabicStr(v);
        const e = c[k] ?? { v, n: 0 }; e.n++; c[k] = e;
        if (!best || e.n > best.n) best = e;
      }
      return best ? best.v : null;
    }});
    g.define('تباين', { __b: true, fn: (arr: number[]) => {
      if (!arr.length) return 0;
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
    }});
    g.define('انحراف_معياري', { __b: true, fn: (arr: number[]) => {
      if (!arr.length) return 0;
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
    }});
    g.define('مئوي', { __b: true, fn: (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const i = Math.max(0, Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1))));
      return s[i];
    }});
    g.define('مدى', { __b: true, fn: (arr: number[]) => arr.length ? Math.max(...arr) - Math.min(...arr) : 0 });
    g.define('فهرس_أقصى', { __b: true, fn: (arr: number[]) => {
      let bi = -1, bv = -Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i] > bv) { bv = arr[i]; bi = i; }
      return bi;
    }});
    g.define('فهرس_أدنى', { __b: true, fn: (arr: number[]) => {
      let bi = -1, bv = Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i] < bv) { bv = arr[i]; bi = i; }
      return bi;
    }});

    // ── Random (extended) ────────────────────────────────────────
    g.define('عشوائي_بين', { __b: true, fn: (lo: number, hi: number) => Math.random() * (hi - lo) + lo });
    g.define('اختر_عشوائي', { __b: true, fn: (arr: unknown[]) => {
      if (!arr.length) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    }});
    g.define('خلط', { __b: true, fn: (arr: unknown[]) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }});
    g.define('عيّنة', { __b: true, fn: (arr: unknown[], n: number) => {
      const a = [...arr]; const out: unknown[] = []; n = Math.min(Math.max(0, Math.trunc(n)), a.length);
      for (let i = 0; i < n; i++) {
        const j = Math.floor(Math.random() * a.length);
        out.push(a.splice(j, 1)[0]);
      }
      return out;
    }});
    g.define('عشوائي_منطقي', { __b: true, fn: () => Math.random() < 0.5 });
    g.define('لون_عشوائي', { __b: true, fn: () => {
      const h = Math.floor(Math.random() * 360);
      return `hsl(${h}، 70%، 55%)`.replace(/،/g, ',');
    }});

    // ── String (extended) ────────────────────────────────────────
    g.define('فهرس_نص', { __b: true, fn: (s: string, sub: string) => String(s).indexOf(String(sub)) });
    g.define('فهرس_نص_أخير', { __b: true, fn: (s: string, sub: string) => String(s).lastIndexOf(String(sub)) });
    g.define('حرف_عند', { __b: true, fn: (s: string, i: number) => String(s).charAt(Math.trunc(i)) });
    g.define('جزء_نص', { __b: true, fn: (s: string, start: number, end?: number) => String(s).substring(Math.trunc(start), end === undefined ? undefined : Math.trunc(end)) });
    g.define('عدّ_تكرار_نص', { __b: true, fn: (s: string, sub: string) => {
      if (!sub) return 0;
      const arr = String(s).split(String(sub));
      return arr.length - 1;
    }});
    g.define('كبّر_أوّل', { __b: true, fn: (s: string) => { s = String(s); return s ? s[0].toUpperCase() + s.slice(1) : s; }});
    g.define('كلمات', { __b: true, fn: (s: string) => String(s).trim().split(/\s+/).filter(Boolean) });
    g.define('أسطر', { __b: true, fn: (s: string) => String(s).split(/\r?\n/) });
    g.define('فارغ؟', { __b: true, fn: (v: unknown) => {
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return v.length === 0;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v as object).length === 0;
      return false;
    }});
    g.define('أمن_html', { __b: true, fn: (s: string) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;') });

    // ── Arabic text (Arabic-specific!) ───────────────────────────
    g.define('بدون_تشكيل', { __b: true, fn: (s: string) => String(s).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') });
    g.define('وحّد_ألف', { __b: true, fn: (s: string) => String(s).replace(/[إأآا]/g, 'ا') });
    g.define('وحّد_همزة', { __b: true, fn: (s: string) => String(s).replace(/[ؤئء]/g, 'ء') });
    g.define('وحّد_تاء', { __b: true, fn: (s: string) => String(s).replace(/ة/g, 'ه') });
    g.define('عربي؟', { __b: true, fn: (s: string) => /[\u0600-\u06FF]/.test(String(s)) });
    g.define('عدد_كلمات', { __b: true, fn: (s: string) => {
      const t = String(s).trim();
      return t ? t.split(/\s+/).length : 0;
    }});
    g.define('تطبيع_عربي', { __b: true, fn: (s: string) => String(s)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim() });
    g.define('أرقام_عربية_إلى_غربية', { __b: true, fn: (s: string) => String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) });
    g.define('أرقام_غربية_إلى_عربية', { __b: true, fn: (s: string) => String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) });

    // ── Array (extended) ─────────────────────────────────────────
    g.define('سطّح', { __b: true, fn: (arr: unknown[], depth = 1) => (arr as unknown[]).flat(Math.max(0, Math.trunc(depth))) });
    g.define('سطّح_تماماً', { __b: true, fn: (arr: unknown[]) => (arr as unknown[]).flat(Infinity) });
    g.define('جد', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => {
      for (const x of arr) if (self.isTruthy(self.callFunction(fn, [x]))) return x;
      return null;
    }});
    g.define('جد_فهرس', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => {
      for (let i = 0; i < arr.length; i++) if (self.isTruthy(self.callFunction(fn, [arr[i]]))) return i;
      return -1;
    }});
    g.define('كل', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => arr.every(x => self.isTruthy(self.callFunction(fn, [x]))) });
    g.define('بعض', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => arr.some(x => self.isTruthy(self.callFunction(fn, [x]))) });
    g.define('فهرس', { __b: true, fn: (arr: unknown[], v: unknown) => {
      for (let i = 0; i < arr.length; i++) if (self.deepEqual(arr[i], v)) return i;
      return -1;
    }});
    g.define('يحوي_عنصر', { __b: true, fn: (arr: unknown[], v: unknown) => arr.some(x => self.deepEqual(x, v)) });
    g.define('قطع', { __b: true, fn: (arr: unknown[], size: number) => {
      size = Math.max(1, Math.trunc(size));
      const out: unknown[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    }});
    g.define('خذ', { __b: true, fn: (arr: unknown[], n: number) => arr.slice(0, Math.max(0, Math.trunc(n))) });
    g.define('اسقط', { __b: true, fn: (arr: unknown[], n: number) => arr.slice(Math.max(0, Math.trunc(n))) });
    g.define('فرز_بـ', { __b: true, fn: (arr: unknown[], fn: ArabicFunction) => [...arr].sort((a, b) => {
      const ka = self.callFunction(fn, [a]) as number; const kb = self.callFunction(fn, [b]) as number;
      if (typeof ka === 'string' && typeof kb === 'string') return (ka as string).localeCompare(kb as string);
      return (ka as number) - (kb as number);
    })});

    // ── Object (extended) ────────────────────────────────────────
    g.define('أزواج', { __b: true, fn: (obj: Record<string, unknown>) => Object.entries(obj).map(([k, v]) => [k, v]) });
    g.define('ادمج_كائنات', { __b: true, fn: (...objs: Record<string, unknown>[]) => Object.assign({}, ...objs) });
    g.define('نسخة_عميقة', { __b: true, fn: (v: unknown) => {
      try { return JSON.parse(JSON.stringify(v)); }
      catch { throw new ArabicError('لا يمكن نسخ هذه القيمة عميقاً'); }
    }});
    g.define('له_مفتاح', { __b: true, fn: (obj: Record<string, unknown>, k: string) => obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, String(k)) });
    g.define('احذف_مفتاح', { __b: true, fn: (obj: Record<string, unknown>, k: string) => { if (obj && typeof obj === 'object') delete obj[String(k)]; return obj; } });

    // ── Validation ───────────────────────────────────────────────
    g.define('بريد_صحيح؟', { __b: true, fn: (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s)) });
    g.define('رابط_صحيح؟', { __b: true, fn: (s: string) => { try { new URL(String(s)); return true; } catch { return false; } } });
    g.define('هاتف_صحيح؟', { __b: true, fn: (s: string) => /^[+]?[\d\s\-()٠-٩]{6,}$/.test(String(s)) });

    // ── Color helpers ────────────────────────────────────────────
    g.define('سداسي_إلى_رغب', { __b: true, fn: (hex: string) => {
      const h = String(hex).replace('#', '');
      if (!/^[0-9a-fA-F]+$/.test(h) || (h.length !== 6 && h.length !== 3)) {
        throw new ArabicError(`لون سداسي غير صالح: '${hex}' (يجب أن يكون 3 أو 6 أحرف 0-9 / a-f)`);
      }
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
    }});
    g.define('رغب_إلى_سداسي', { __b: true, fn: (r: number, g2: number, b: number) => {
      const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
      return '#' + c(r) + c(g2) + c(b);
    }});
    g.define('لون_رغب', { __b: true, fn: (r: number, g2: number, b: number) => `rgb(${Math.round(r)},${Math.round(g2)},${Math.round(b)})` });
    g.define('لون_تدرج', { __b: true, fn: (h: number, s = 70, l = 55) => `hsl(${h},${s}%,${l}%)` });

    // ── Hijri Calendar (Umm al-Qura via Intl) ────────────────────
    const hijriParts = (input: unknown): { year: number; month: number; day: number } => {
      // Coerce to Date safely (accept Date, string, number, or undefined → now)
      const d: Date = input instanceof Date ? input
        : (input === undefined || input === null) ? new Date()
        : new Date(input as string | number);
      if (isNaN(d.getTime())) throw new ArabicError(`تاريخ غير صالح: '${self.arabicStr(input)}'`);
      try {
        const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = fmt.formatToParts(d);
        const get = (t: string) => Number((parts.find(p => p.type === t)?.value ?? '0').replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))));
        return { year: get('year'), month: get('month'), day: get('day') };
      } catch {
        // Approximate fallback
        const julianDay = Math.floor(d.getTime() / 86400000) + 2440588;
        const islamicEpoch = 1948440;
        const days = julianDay - islamicEpoch;
        const year = Math.floor((30 * days + 10646) / 10631);
        const yearStart = Math.ceil((10631 * year - 10617) / 30);
        const dayOfYear = days - yearStart + 1;
        const month = Math.min(12, Math.ceil(dayOfYear / 29.5));
        const day = dayOfYear - Math.floor((month - 1) * 29.5);
        return { year, month, day };
      }
    };
    g.define('سنة_هجرية', { __b: true, fn: (d?: Date) => hijriParts(d ?? new Date()).year });
    g.define('شهر_هجري', { __b: true, fn: (d?: Date) => hijriParts(d ?? new Date()).month });
    g.define('يوم_هجري', { __b: true, fn: (d?: Date) => hijriParts(d ?? new Date()).day });
    const hijriMonthNames = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    g.define('تاريخ_هجري', { __b: true, fn: (d?: Date) => {
      const h = hijriParts(d ?? new Date());
      return `${h.day} ${hijriMonthNames[h.month - 1] ?? ''} ${h.year}هـ`;
    }});

    // ── Crypto / IDs ─────────────────────────────────────────────
    g.define('معرّف_فريد', { __b: true, fn: () => {
      try {
        if (typeof crypto !== 'undefined' && (crypto as Crypto).randomUUID) return (crypto as Crypto).randomUUID();
      } catch { /* fallthrough */ }
      // RFC4122-ish fallback
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }});
    g.define('بصمة', { __b: true, fn: (s: string) => {
      // Simple djb2 hash → unsigned hex
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16);
    }});
    const utf8ToBytes = (s: string): Uint8Array => new TextEncoder().encode(s);
    const bytesToUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);
    g.define('ترميز_64', { __b: true, fn: (s: string) => {
      if (typeof btoa === 'undefined') throw new ArabicError('الترميز Base64 غير متاح في هذه البيئة');
      try {
        const bytes = utf8ToBytes(String(s));
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      } catch (e) {
        throw new ArabicError(`فشل ترميز Base64: ${(e as Error).message}`);
      }
    }});
    g.define('فك_64', { __b: true, fn: (s: string) => {
      if (typeof atob === 'undefined') throw new ArabicError('فك Base64 غير متاح في هذه البيئة');
      try {
        const bin = atob(String(s));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytesToUtf8(bytes);
      } catch {
        throw new ArabicError(`نص Base64 غير صالح: '${String(s).slice(0, 20)}${String(s).length > 20 ? '...' : ''}'`);
      }
    }});

    // ── Storage (extended) ───────────────────────────────────────
    g.define('امسح_التخزين', { __b: true, fn: () => {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith('arabica_') && !k.startsWith('arabica_model_')) keys.push(k);
      }
      keys.forEach(k => window.localStorage.removeItem(k));
      return keys.length;
    }});
    g.define('مفاتيح_التخزين', { __b: true, fn: () => {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const out: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith('arabica_') && !k.startsWith('arabica_model_')) out.push(k.replace('arabica_', ''));
      }
      return out;
    }});
    g.define('له_مفتاح_تخزين', { __b: true, fn: (k: string) => {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return window.localStorage.getItem(`arabica_${k}`) !== null;
    }});

    // ── Audio ────────────────────────────────────────────────────
    let audioCtx: AudioContext | null = null;
    const getAudio = (): AudioContext | null => {
      if (typeof window === 'undefined') return null;
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = W.AudioContext ?? W.webkitAudioContext;
      if (!Ctor) return null;
      if (!audioCtx) audioCtx = new Ctor();
      return audioCtx;
    };
    g.define('نغمة', { __b: true, fn: (freq = 440, duration = 0.2) => {
      const ctx = getAudio(); if (!ctx) return null;
      // Clamp to safe audio ranges to prevent WebAudio errors / abuse
      const f = Number(freq);
      const dur = Number(duration);
      const safeFreq = (isNaN(f) ? 440 : Math.max(20, Math.min(20000, f)));
      const safeDur = (isNaN(dur) ? 0.2 : Math.max(0.01, Math.min(5, dur)));
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = safeFreq; osc.type = 'sine';
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + safeDur);
      osc.start(); osc.stop(ctx.currentTime + safeDur + 0.05);
      return null;
    }});
    g.define('صفير', { __b: true, fn: () => {
      const ctx = getAudio(); if (!ctx) return null;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 880; osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
      return null;
    }});
    g.define('انطق', { __b: true, fn: (text: string, lang = 'ar-SA') => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
      const u = new SpeechSynthesisUtterance(self.arabicStr(text));
      u.lang = String(lang);
      window.speechSynthesis.speak(u);
      return null;
    }});

    // ── Performance / timing ─────────────────────────────────────
    g.define('قياس', { __b: true, fn: (fn: ArabicFunction) => {
      if (!(fn instanceof ArabicFunction)) throw new ArabicError(`'قياس' يحتاج دالة`);
      const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      self.callFunction(fn, []);
      const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      return Math.round((t1 - t0) * 1000) / 1000;
    }});

    // ── Console color/style helpers ──────────────────────────────
    g.define('أرني_خطأ', { __b: true, fn: (...args: unknown[]) => { self.emit(args.map(a => self.arabicStr(a)).join(' '), 'error'); return null; } });
    g.define('أرني_معلومة', { __b: true, fn: (...args: unknown[]) => { self.emit(args.map(a => self.arabicStr(a)).join(' '), 'info'); return null; } });

    // ── Money/format ─────────────────────────────────────────────
    g.define('عملة', { __b: true, fn: (n: number, currency = 'SAR', locale = 'ar-SA') => {
      try { return new Intl.NumberFormat(String(locale), { style: 'currency', currency: String(currency) }).format(Number(n)); }
      catch { return `${Number(n).toFixed(2)} ${currency}`; }
    }});
    g.define('رقم_منسّق', { __b: true, fn: (n: number, locale = 'ar-SA') => {
      try { return new Intl.NumberFormat(String(locale)).format(Number(n)); }
      catch { return String(n); }
    }});
    g.define('نسبة_مئوية', { __b: true, fn: (n: number, decimals = 1) => `${(Number(n) * 100).toFixed(Math.max(0, Math.trunc(decimals)))}%` });

    // ── Conversions ──────────────────────────────────────────────
    g.define('مئوي_إلى_فهرنهايت', { __b: true, fn: (c: number) => c * 9 / 5 + 32 });
    g.define('فهرنهايت_إلى_مئوي', { __b: true, fn: (f: number) => (f - 32) * 5 / 9 });
    g.define('كم_إلى_ميل', { __b: true, fn: (km: number) => km * 0.621371 });
    g.define('ميل_إلى_كم', { __b: true, fn: (mi: number) => mi / 0.621371 });
    g.define('كغ_إلى_رطل', { __b: true, fn: (kg: number) => kg * 2.20462 });
    g.define('رطل_إلى_كغ', { __b: true, fn: (lb: number) => lb / 2.20462 });
  }

  private callFunction(fn: ArabicFunction, args: unknown[], thisObj?: unknown): unknown {
    this.callDepth++;
    if (this.callDepth > this.MAX_DEPTH) throw new ArabicError('تجاوز عمق الاستدعاء الأقصى (تحقق من التكرار اللانهائي)');
    this.callStack.push({ name: fn.name ?? 'مجهولة', callerLoc: this.currentLoc });
    const savedLoc = this.currentLoc;
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
      this.callStack.pop();
      this.currentLoc = savedLoc;
    }
  }

  run(source: string): OutputLine[] {
    this.lines = [];
    this.opCount = 0;
    this.callDepth = 0;
    this.currentLoc = null;
    this.structs.clear();
    this.modules.clear();
    this.callStack = [];
    this.testRegistry = [];
    try {
      const tokens = tokenize(source);
      const ast = parse(tokens);
      this.execBlock(ast.body, this.globals);
    } catch (e: unknown) {
      this.emitError(e);
    }
    return this.lines;
  }

  // Public: evaluate a single snippet against the persistent global env (REPL).
  runSnippet(source: string): OutputLine[] {
    const before = this.lines.length;
    this.opCount = 0;
    this.callDepth = 0;
    this.currentLoc = null;
    this.callStack = [];
    try {
      const tokens = tokenize(source);
      const ast = parse(tokens);
      let lastValue: unknown = undefined;
      for (let i = 0; i < ast.body.length; i++) {
        const stmt = ast.body[i];
        this.tick();
        const s = stmt as unknown as Record<string, unknown>;
        const isLast = i === ast.body.length - 1;
        if (isLast && s.type === 'ExpressionStatement') {
          // For the last expression only, capture the value for REPL echo;
          // route through the same loc/stack-enriching wrapper that execStmt uses.
          const loc = s.loc as { line: number; col: number } | undefined;
          if (loc) this.currentLoc = loc;
          try {
            lastValue = this.evalExpr(s.expression, this.globals);
          } catch (e) {
            if (e instanceof ArabicError) {
              if (!e.loc && loc) e.loc = loc;
              if (!e.arabicStack && this.callStack.length > 0) {
                e.arabicStack = this.callStack.slice().reverse().map(f => ({ name: f.name, loc: f.callerLoc }));
              }
            }
            throw e;
          }
        } else {
          this.execStmt(stmt, this.globals);
        }
      }
      if (lastValue !== undefined && lastValue !== null) {
        // Avoid echoing if the snippet already printed (had output beyond `before`)
        const printedSomething = this.lines.length > before;
        if (!printedSomething) this.emit(`= ${this.arabicStr(lastValue)}`, 'info');
      }
    } catch (e: unknown) {
      this.emitError(e);
    }
    return this.lines.slice(before);
  }

  private emitError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const parseMatch = msg.match(/^خطأ في السطر (\d+)، العمود \d+: (.*)$/s);
    if (parseMatch) {
      this.emit(`✗ [السطر ${parseMatch[1]}] ${parseMatch[2]}`, 'error');
      return;
    }
    const ae = e as ArabicError;
    const loc = ae?.loc ?? this.currentLoc;
    const prefix = loc ? `[السطر ${loc.line}] ` : '';
    this.emit(`✗ ${prefix}${msg}`, 'error');
    // Stack trace (top → bottom: deepest frame first)
    const frames = ae?.arabicStack ?? this.callStack.slice().reverse().map(f => ({ name: f.name, loc: f.callerLoc }));
    if (frames.length > 0) {
      this.emit('  تتبّع الاستدعاءات:', 'error');
      for (const f of frames) {
        const at = f.loc ? `السطر ${f.loc.line}` : 'مكان غير معروف';
        this.emit(`    ← في «${f.name}» (${at})`, 'error');
      }
    }
  }

  private execBlock(statements: unknown[], env: Environment) {
    for (const stmt of statements) { this.tick(); this.execStmt(stmt, env); }
  }

  private execStmt(stmt: unknown, env: Environment) {
    const s = stmt as Record<string, unknown>;
    const loc = s.loc as { line: number; col: number } | undefined;
    if (loc) this.currentLoc = loc;
    try {
      this.execStmtInner(s, env);
    } catch (e) {
      if (e instanceof ArabicError) {
        if (!e.loc && loc) e.loc = loc;
        // Capture call stack snapshot at throw site (deepest first)
        if (!e.arabicStack && this.callStack.length > 0) {
          e.arabicStack = this.callStack.slice().reverse().map(f => ({ name: f.name, loc: f.callerLoc }));
        }
      }
      throw e;
    }
  }

  private checkType(typeName: string, value: unknown): boolean {
    switch (typeName) {
      case 'أي': return true;
      case 'رقم': return typeof value === 'number' && !isNaN(value);
      case 'نص': return typeof value === 'string';
      case 'منطقي': return typeof value === 'boolean';
      case 'قائمة': return Array.isArray(value);
      case 'كائن': return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof ArabicFunction);
      case 'دالة': return value instanceof ArabicFunction || (typeof value === 'object' && value !== null && (value as { __b?: boolean }).__b === true);
      case 'عدم': return value === null || value === undefined;
      default:
        if (this.structs.has(typeName)) {
          const v = value as { __struct__?: string } | null;
          if (!v || typeof v !== 'object') return false;
          let cur: string | undefined = v.__struct__;
          while (cur) {
            if (cur === typeName) return true;
            cur = this.structs.get(cur)?.parent ?? undefined;
          }
          return false;
        }
        // Unknown type names are a hard error (not a silent escape)
        throw new ArabicError(`نوع غير معروف '${typeName}'. الأنواع المتاحة: رقم، نص، منطقي، قائمة، كائن، دالة، عدم، أي + أسماء البُنى`);
    }
  }
  private typeName(v: unknown): string {
    if (v === null || v === undefined) return 'عدم';
    if (typeof v === 'number') return 'رقم';
    if (typeof v === 'string') return 'نص';
    if (typeof v === 'boolean') return 'منطقي';
    if (Array.isArray(v)) return 'قائمة';
    if (v instanceof ArabicFunction) return 'دالة';
    if (typeof v === 'object') {
      const s = (v as { __struct__?: string }).__struct__;
      return s ?? 'كائن';
    }
    return typeof v;
  }
  private assertType(typeName: string | null | undefined, value: unknown, varName: string) {
    if (!typeName) return;
    if (!this.checkType(typeName, value)) {
      throw new ArabicError(`خطأ نوع: المتغيّر '${varName}' من نوع '${typeName}'، لكن وُجد '${this.typeName(value)}'`);
    }
  }

  private execStmtInner(s: Record<string, unknown>, env: Environment) {
    switch (s.type) {
      case 'VarDecl': {
        const value = s.value ? this.evalExpr(s.value, env) : null;
        const typeName = s.typeName as string | null | undefined;
        if (typeName && s.value) this.assertType(typeName, value, s.name as string);
        env.define(s.name as string, value);
        // Remember type for assignment checks (stored on env entry meta)
        if (typeName) env.setTypeAnnotation(s.name as string, typeName);
        break;
      }
      case 'ConstDecl': {
        const value = this.evalExpr(s.value, env);
        const typeName = s.typeName as string | null | undefined;
        if (typeName) this.assertType(typeName, value, s.name as string);
        env.define(s.name as string, value, true);
        if (typeName) env.setTypeAnnotation(s.name as string, typeName);
        break;
      }
      case 'ModuleDecl': {
        const modName = s.name as string;
        const modEnv = new Environment(this.globals);
        const exports = new Set<string>();
        // Track exports via a marker in the module env
        (modEnv as Environment & { __exports?: Set<string> }).__exports = exports;
        this.execBlock(s.body as unknown[], modEnv);
        this.modules.set(modName, { env: modEnv, exports });
        break;
      }
      case 'ExportStmt': {
        const exports = (env as Environment & { __exports?: Set<string> }).__exports;
        if (!exports) throw new ArabicError(`'صدّر' يجب أن يكون داخل وحدة`);
        for (const n of s.names as string[]) {
          // Restrict to module-local bindings only (not inherited globals/builtins)
          if (!env.hasOwn(n)) throw new ArabicError(`لا يمكن تصدير '${n}': يجب تعريفه داخل الوحدة`);
          exports.add(n);
        }
        break;
      }
      case 'ImportStmt': {
        const modName = s.module as string;
        const mod = this.modules.get(modName);
        if (!mod) throw new ArabicError(`الوحدة '${modName}' غير معرّفة`);
        for (const n of s.names as string[]) {
          if (!mod.exports.has(n)) {
            throw new ArabicError(`'${n}' غير مُصدَّر من الوحدة '${modName}'`);
          }
          // Preserve metadata (type annotation, constness) from the module
          const entry = mod.env.getOwnEntry(n);
          if (entry) env.defineEntry(n, entry);
          else env.define(n, mod.env.get(n));
        }
        break;
      }
      case 'FunctionDecl': {
        const fn = new ArabicFunction(s.params as string[], s.body, env, s.name as string);
        env.define(s.name as string, fn);
        break;
      }
      case 'StructDecl': {
        const fields = s.fields as string[];
        const rawMethods = (s.methods as { name: string; params: string[]; body: unknown }[]) ?? [];
        const structName = s.name as string;
        const parentName = (s.parent as string | null) ?? null;
        const declEnv = env;
        const methods = rawMethods.map(m => ({ ...m, declEnv }));

        // Resolve inheritance chain with cycle detection (parent first, child overrides)
        const allFields: string[] = [];
        const allMethods = new Map<string, { params: string[]; body: unknown; declEnv: Environment }>();
        const parents: string[] = [];
        const visited = new Set<string>([structName]);
        let pName: string | null = parentName;
        while (pName) {
          if (visited.has(pName)) throw new ArabicError(`حلقة وراثة عند '${pName}'`);
          visited.add(pName);
          const pDef = this.structs.get(pName);
          if (!pDef) throw new ArabicError(`البنية الأب '${pName}' غير معرّفة`);
          parents.unshift(pName);
          pName = pDef.parent;
        }
        for (const ancName of parents) {
          const def = this.structs.get(ancName)!;
          for (const f of def.fields) if (!allFields.includes(f)) allFields.push(f);
          // Inherited methods keep their original parent declaration env (lexical correctness)
          for (const m of def.methods) allMethods.set(m.name, m);
        }
        for (const f of fields) if (!allFields.includes(f)) allFields.push(f);
        for (const m of methods) allMethods.set(m.name, m);

        this.structs.set(structName, { name: structName, parent: parentName, fields, methods });

        const ctor = {
          __b: true,
          fn: (...args: unknown[]) => {
            const obj: Record<string, unknown> = { __struct__: structName };
            allFields.forEach((f, i) => { obj[f] = args[i] ?? null; });
            for (const [mname, m] of allMethods) {
              obj[mname] = new ArabicFunction(m.params, m.body, m.declEnv, mname);
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
        if (target.type === 'Identifier') {
          const ann = env.getTypeAnnotation(target.name as string);
          if (ann) this.assertType(ann, value, target.name as string);
          env.set(target.name as string, value);
        }
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
