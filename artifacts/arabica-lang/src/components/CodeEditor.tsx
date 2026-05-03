import { useRef, useCallback } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRun: () => void;
}

const KEYWORDS = ['كنز', 'سرّ', 'سر', 'مهمّة', 'مهمة', 'بنية', 'إن', 'ان', 'وإلا', 'والا', 'كرر', 'جوال', 'من', 'إلى', 'الى', 'في', 'بخطوة', 'أعد', 'اعد', 'قف', 'استمر', 'طابق', 'حال', 'حاول', 'التقط', 'انتهى', 'هذا'];
const BUILTINS = ['أرني', 'ارني', 'شبكة_عصبية', 'درّب', 'تنبأ', 'خسارة', 'دقة', 'احفظ_نموذج', 'حمّل_نموذج', 'نماذج_محفوظة', 'جذر', 'مطلق', 'قوة', 'دور', 'سقف', 'أرضية', 'لوغاريتم', 'جيب', 'جيب_تمام', 'ظل', 'عشوائي', 'عشوائي_صحيح', 'أقصى', 'أدنى', 'مجموع', 'متوسط', 'طول', 'نوع', 'رقم', 'نص', 'قائمة', 'إضافة', 'حذف', 'أول', 'آخر', 'فرز', 'عكس', 'دمج', 'شريحة', 'انضم', 'نطاق', 'مصفوفة', 'مفاتيح', 'قيم', 'تقسيم', 'استبدال', 'تقليم', 'يحتوي', 'يبدأ_بـ', 'ينتهي_بـ', 'حروف_كبيرة', 'حروف_صغيرة', 'تكرار', 'خريطة', 'تصفية', 'اختزال', 'وقت', 'تاريخ', 'مسح', 'تطبيع', 'إلى_جسون', 'من_جسون', 'نمط', 'يطابق_نمط', 'استخرج_نمط', 'استبدل_نمط', 'جلب', 'جلب_جسون', 'احفظ_ملف', 'احفظ', 'حمّل', 'خطأ'];
const BOOLEANS = ['صدق', 'حق', 'كذب', 'باطل', 'عدم', 'لاشيء', 'لا_شيء'];

function highlight(code: string): string {
  const lines = code.split('\n');
  return lines.map(line => {
    // Escape HTML
    let result = '';
    let i = 0;
    const chars = [...line];

    // Simple token-based highlighting
    while (i < chars.length) {
      // Comment
      if (chars[i] === '/' && chars[i + 1] === '/') {
        const comment = chars.slice(i).join('');
        result += `<span class="hl-comment">${escHtml(comment)}</span>`;
        break;
      }
      // String
      if (chars[i] === '"' || chars[i] === "'") {
        const q = chars[i];
        let str = q;
        i++;
        while (i < chars.length && chars[i] !== q) { str += chars[i]; i++; }
        str += q;
        i++;
        result += `<span class="hl-string">${escHtml(str)}</span>`;
        continue;
      }
      // Template string (backtick) — highlight {expr} parts
      if (chars[i] === '`') {
        let str = '`';
        i++;
        while (i < chars.length && chars[i] !== '`') { str += chars[i]; i++; }
        if (i < chars.length) { str += '`'; i++; }
        const html = escHtml(str).replace(/\{([^}]*)\}/g, '<span class="hl-keyword">{</span><span class="hl-ident">$1</span><span class="hl-keyword">}</span>');
        result += `<span class="hl-string">${html}</span>`;
        continue;
      }
      // Number
      if (/[0-9٠-٩]/.test(chars[i])) {
        let num = '';
        while (i < chars.length && /[0-9٠-٩.]/.test(chars[i])) { num += chars[i]; i++; }
        result += `<span class="hl-number">${escHtml(num)}</span>`;
        continue;
      }
      // Identifier / keyword
      if (isIdentChar(chars[i])) {
        let word = '';
        while (i < chars.length && isIdentChar(chars[i])) { word += chars[i]; i++; }
        if (KEYWORDS.includes(word)) result += `<span class="hl-keyword">${escHtml(word)}</span>`;
        else if (BUILTINS.includes(word)) result += `<span class="hl-builtin">${escHtml(word)}</span>`;
        else if (BOOLEANS.includes(word)) result += `<span class="hl-boolean">${escHtml(word)}</span>`;
        else result += `<span class="hl-ident">${escHtml(word)}</span>`;
        continue;
      }
      result += escHtml(chars[i]);
      i++;
    }
    return result;
  }).join('\n');
}

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

export default function CodeEditor({ value, onChange, onRun }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab → insert spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.substring(0, start) + '    ' + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    }
    // Ctrl/Cmd + Enter → run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
  }, [value, onChange, onRun]);

  const highlighted = highlight(value);
  const lines = value.split('\n');

  return (
    <div className="editor-wrap">
      <div className="line-numbers" aria-hidden="true">
        {lines.map((_, i) => (
          <div key={i} className="line-num">{i + 1}</div>
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
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          dir="rtl"
          lang="ar"
          placeholder="// اكتب كودك هنا..."
        />
      </div>
    </div>
  );
}
