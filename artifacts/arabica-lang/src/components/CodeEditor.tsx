/**
 * صِفر — لغة البرمجة العربية الأصيلة
 * Copyright (c) 2026 عبدالله سعد علي محمد القحطاني
 *                    Abdullah Saad Ali Mohammed Alqahtani
 * Licensed under the MIT License.
 */
import { useRef, useCallback, useState, useEffect } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRun: () => void;
  errorLine?: number | null;
}

const KEYWORDS = [
  'قيمة', 'سرّ', 'سر', 'مهمّة', 'مهمة', 'بنية', 'إن', 'ان', 'وإلا', 'والا',
  'وإلا إن', 'كرر', 'جوال', 'من', 'إلى', 'الى', 'في', 'بخطوة', 'أعد', 'اعد',
  'قف', 'استمر', 'طابق', 'حال', 'حاول', 'التقط', 'انتهى', 'هذا', 'وارث',
  'يرث', 'وحدة', 'صدّر', 'استورد', 'وَ', 'أو',
];

const BUILTINS = [
  // Output
  'أرني', 'ارني', 'أرني_خطأ', 'أرني_معلومة',
  // Math
  'جذر', 'مطلق', 'قوة', 'دور', 'سقف', 'أرضية', 'لوغاريتم', 'لو2', 'لو10', 'أُس',
  'جيب', 'جيب_تمام', 'ظل', 'قوس_جيب', 'قوس_جيب_تمام', 'قوس_ظل',
  'عشوائي', 'عشوائي_بين', 'عشوائي_صحيح', 'أقصى', 'أدنى', 'مجموع', 'متوسط',
  'إلى_راديان', 'إلى_درجات', 'مسافة', 'وتر', 'مضروب', 'فيبوناتشي',
  'أولي؟', 'قائمة_أوليات', 'مضاعف', 'مقسوم_عليه',
  // Arrays
  'طول', 'إضافة', 'إضافة_أمام', 'حذف', 'حذف_آخر', 'حذف_أول', 'أول', 'آخر',
  'فرز', 'عكس', 'دمج', 'شريحة', 'انضم', 'نطاق', 'مصفوفة', 'صفر_مصفوفة',
  'خريطة', 'تصفية', 'اختزال', 'زوج', 'عدّ', 'جد', 'جد_فهرس', 'كل', 'بعض',
  'مجموعة_فريدة', 'عدّ_تكرارات', 'تجميع', 'قطع', 'خذ', 'اسقط', 'فرز_بـ',
  'سطّح', 'سطّح_تماماً',
  // Strings
  'نص', 'رقم', 'نوع', 'حروف_كبيرة', 'حروف_صغيرة', 'تقليم', 'تقسيم',
  'استبدال', 'يحتوي', 'يبدأ_بـ', 'ينتهي_بـ', 'تكرار', 'فهرس_نص',
  'جزء_نص', 'كبّر_أوّل', 'كلمات', 'أسطر', 'عكس_نص', 'حشو_يسار',
  'حشو_يمين', 'أمن_html', 'عدّ_تكرار_نص', 'رقم_بصيغة',
  // Arabic
  'بدون_تشكيل', 'وحّد_ألف', 'وحّد_همزة', 'تطبيع_عربي',
  'أرقام_عربية_إلى_غربية', 'عدد_كلمات', 'عربي؟',
  // Objects
  'مفاتيح', 'قيم', 'أزواج', 'كائن_من_قوائم', 'ادمج_كائنات', 'نسخة_عميقة',
  'له_مفتاح', 'احذف_مفتاح',
  // Date/Time
  'الآن', 'سنة', 'شهر', 'يوم', 'ساعة', 'دقيقة', 'ثانية', 'تنسيق_تاريخ',
  'سنة_هجرية', 'شهر_هجري', 'يوم_هجري', 'تاريخ_هجري',
  // Validation
  'منطقي', 'قائمة', 'فارغ؟', 'بريد_صحيح؟', 'رابط_صحيح؟', 'هاتف_صحيح؟',
  // Storage
  'احفظ', 'حمّل', 'احذف_محفوظ', 'حمّل_كل', 'احفظ_ملف',
  // AI
  'شبكة_عصبية', 'درّب', 'تنبأ', 'خسارة', 'دقة', 'احفظ_نموذج', 'حمّل_نموذج',
  'نماذج_محفوظة',
  // DOM
  'لوحة', 'امسح_اللوحة', 'عنصر', 'نص_عنصر', 'عنوان', 'فقرة', 'زر', 'حقل',
  'حاوية', 'صف', 'صورة', 'رابط', 'بند', 'قائمة_ب', 'قائمة_ر', 'شبكة',
  'مربع_نص', 'منتقي', 'فاصل', 'بطاقة', 'بادج', 'مؤشر_تقدم', 'تنبيه',
  'أضف', 'أنماط', 'استمع', 'غيّر_نص', 'غيّر_قيمة', 'غيّر_خاصية',
  'اقرأ_قيمة', 'اقرأ_محدد', 'احصل_على', 'احصل_على_كل',
  'احذف_عنصر', 'فرّغ', 'انزلق_لـ',
  'عيّن_صنف', 'أضف_صنف', 'احذف_صنف', 'تبديل_صنف',
  'أنماط_صفحة', 'لوحة_من',
  'بعد', 'كل_مدة', 'ألغ_مؤقت',
  // Canvas 2D
  'رسّام', 'سياق', 'عرض_لوح', 'ارتفاع_لوح',
  'لون_تعبئة', 'لون_حدود', 'سماكة_خط', 'شفافية_قلم',
  'ارسم_مستطيل', 'حدود_مستطيل', 'ارسم_دائرة', 'حدود_دائرة',
  'ارسم_خط', 'ارسم_مضلع', 'ارسم_نص_لوح', 'قياس_نص_لوح',
  'امسح_لوح', 'امسح_منطقة', 'احفظ_قلم', 'استعد_قلم',
  'انقل_قلم', 'دوّر_قلم', 'حجم_قلم', 'تدرج_لوني',
  'مسار_جديد', 'انقل_إلى', 'خط_إلى', 'أغلق_مسار',
  'قوس', 'املأ_مسار', 'ارسم_مسار', 'صورة_لوح',
  // JSON
  'إلى_جيسون', 'من_جيسون',
  // HTTP
  'اجلب',
  // Regex
  'ابحث_نص', 'ابحث_كل', 'استبدل_نمط', 'يطابق', 'مجموعات_بحث',
  // Clipboard / Geo / WS / File
  'انسخ_نص', 'موقعي',
  'اتصال_مباشر', 'أرسل_للاتصال', 'أغلق_اتصال',
  'اقرأ_ملف', 'طلب_إشعار', 'أشعر',
  // Testing
  'اختبر', 'توقّع', 'توقّع_صدق', 'توقّع_خطأ', 'شغّل_اختبارات',
  // Data structures
  'قاموس', 'مجموعة', 'طابور', 'مكدس', 'كومة', 'قائمة_مرتبطة', 'شجرة_بحث',
  // Stats / Random
  'وسيط', 'منوال', 'تباين', 'انحراف_معياري', 'مئوي', 'مدى',
  'فهرس_أقصى', 'فهرس_أدنى',
  'اختر_عشوائي', 'خلط', 'عيّنة', 'لون_عشوائي',
  // Colors
  'سداسي_إلى_رغب', 'رغب_إلى_سداسي', 'لون_رغب', 'لون_تدرج',
  // Format / Units
  'عملة', 'رقم_منسّق', 'نسبة_مئوية',
  'مئوي_إلى_فهرنهايت', 'فهرنهايت_إلى_مئوي', 'كم_إلى_ميل', 'ميل_إلى_كم',
  'كغ_إلى_رطل', 'رطل_إلى_كغ',
  // Crypto/ID
  'معرّف_فريد', 'بصمة', 'ترميز_64', 'فك_64',
  // Audio
  'نغمة', 'صفير', 'انطق',
  // Perf / Error
  'قياس', 'خطأ',
  // Algorithms
  'فرز_سريع', 'ترتيب_دمج', 'بحث_ثنائي', 'بحث_خطي', 'تشابه_نص',
  'مسافة_ليفنشتاين',
];

const BOOLEANS = ['صدق', 'حق', 'كذب', 'باطل', 'عدم', 'لاشيء', 'لا_شيء'];

const ALL_WORDS = [...KEYWORDS, ...BUILTINS, ...BOOLEANS];

function isIdentChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x0600 && code <= 0x06FF) ||
    (code >= 0x0750 && code <= 0x077F) ||
    (code >= 0x064B && code <= 0x065F) ||
    /[a-zA-Z0-9_]/.test(ch);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(line: string, isErrorLine: boolean): string {
  let result = '';
  let i = 0;
  const chars = [...line];
  while (i < chars.length) {
    if (chars[i] === '/' && chars[i + 1] === '/') {
      result += `<span class="hl-comment">${escHtml(chars.slice(i).join(''))}</span>`;
      break;
    }
    if (chars[i] === '"' || chars[i] === "'") {
      const q = chars[i]; let str = q; i++;
      while (i < chars.length && chars[i] !== q) { str += chars[i]; i++; }
      str += q; i++;
      result += `<span class="hl-string">${escHtml(str)}</span>`;
      continue;
    }
    if (chars[i] === '`') {
      let str = '`'; i++;
      while (i < chars.length && chars[i] !== '`') { str += chars[i]; i++; }
      if (i < chars.length) { str += '`'; i++; }
      const html = escHtml(str).replace(/\{([^}]*)\}/g, '<span class="hl-keyword">{</span><span class="hl-ident">$1</span><span class="hl-keyword">}</span>');
      result += `<span class="hl-string">${html}</span>`;
      continue;
    }
    if (/[0-9٠-٩]/.test(chars[i])) {
      let num = '';
      while (i < chars.length && /[0-9٠-٩.]/.test(chars[i])) { num += chars[i]; i++; }
      result += `<span class="hl-number">${escHtml(num)}</span>`;
      continue;
    }
    if (isIdentChar(chars[i])) {
      let word = '';
      while (i < chars.length && isIdentChar(chars[i])) { word += chars[i]; i++; }
      if (KEYWORDS.includes(word)) result += `<span class="hl-keyword">${escHtml(word)}</span>`;
      else if (BUILTINS.includes(word)) result += `<span class="hl-builtin">${escHtml(word)}</span>`;
      else if (BOOLEANS.includes(word)) result += `<span class="hl-boolean">${escHtml(word)}</span>`;
      else result += `<span class="hl-ident">${escHtml(word)}</span>`;
      continue;
    }
    result += escHtml(chars[i]); i++;
  }
  if (isErrorLine) {
    return `<span class="hl-error-line">${result}</span>`;
  }
  return result;
}

function highlight(code: string, errorLine: number | null | undefined): string {
  return code.split('\n').map((line, i) =>
    highlightLine(line, errorLine === i + 1)
  ).join('\n');
}

function getWordAtCursor(text: string, pos: number): string {
  let start = pos;
  while (start > 0 && isIdentChar(text[start - 1])) start--;
  return text.slice(start, pos);
}

export default function CodeEditor({ value, onChange, onRun, errorLine }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [acItems, setAcItems] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acPrefix, setAcPrefix] = useState('');

  // Close autocomplete on outside click
  useEffect(() => {
    const handle = () => setAcItems([]);
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const acceptCompletion = useCallback((item: string, prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const start = pos - prefix.length;
    const next = value.substring(0, start) + item + value.substring(pos);
    onChange(next);
    setAcItems([]);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + item.length;
      el.focus();
    });
  }, [value, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const pos = e.target.selectionStart;
    onChange(newVal);
    const word = getWordAtCursor(newVal, pos);
    if (word.length >= 2) {
      const matches = ALL_WORDS.filter(w => w.startsWith(word) && w !== word);
      if (matches.length > 0) {
        setAcItems(matches.slice(0, 9));
        setAcIndex(0);
        setAcPrefix(word);
        return;
      }
    }
    setAcItems([]);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acItems.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => (i + 1) % acItems.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex(i => (i - 1 + acItems.length) % acItems.length); return; }
      if (e.key === 'Tab') { e.preventDefault(); acceptCompletion(acItems[acIndex], acPrefix); return; }
      if (e.key === 'Enter' && acItems.length > 0) {
        // only accept if user explicitly navigated
        if (acIndex > 0) { e.preventDefault(); acceptCompletion(acItems[acIndex], acPrefix); return; }
      }
      if (e.key === 'Escape') { setAcItems([]); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.substring(0, start) + '    ' + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); }
  }, [value, onChange, onRun, acItems, acIndex, acPrefix, acceptCompletion]);

  const lines = value.split('\n');
  const highlighted = highlight(value, errorLine);

  return (
    <div className="editor-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <div className="line-numbers" aria-hidden="true">
        {lines.map((_, i) => (
          <div key={i} className={`line-num${errorLine === i + 1 ? ' line-num-error' : ''}`}>
            {errorLine === i + 1 ? '⚠' : i + 1}
          </div>
        ))}
      </div>
      <div className="editor-inner">
        <pre
          className="highlight-layer"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
        <textarea
          ref={textareaRef}
          className="code-textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          dir="rtl"
          lang="ar"
          placeholder="// اكتب كودك هنا..."
        />
        {acItems.length > 0 && (
          <div className="ac-popup" onMouseDown={e => e.preventDefault()}>
            <div className="ac-popup-title">اقتراحات</div>
            {acItems.map((item, i) => (
              <div
                key={item}
                className={`ac-item${i === acIndex ? ' ac-item-active' : ''}`}
                onMouseDown={() => acceptCompletion(item, acPrefix)}
              >
                <span className="ac-kind">
                  {KEYWORDS.includes(item) ? 'k' : BOOLEANS.includes(item) ? 'b' : 'f'}
                </span>
                <span className="ac-prefix">{acPrefix}</span>
                <span className="ac-rest">{item.slice(acPrefix.length)}</span>
              </div>
            ))}
            <div className="ac-hint">Tab للقبول · ↑↓ للتنقل · Esc للإغلاق</div>
          </div>
        )}
      </div>
    </div>
  );
}
