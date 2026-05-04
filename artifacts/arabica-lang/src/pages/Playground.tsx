/**
 * صِفر — لغة البرمجة العربية الأصيلة
 * Copyright (c) 2026 عبدالله سعد علي محمد القحطاني
 *                    Abdullah Saad Ali Mohammed Alqahtani
 * Licensed under the MIT License.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import CodeEditor from '../components/CodeEditor';
import OutputConsole from '../components/OutputConsole';
import ExamplesPanel from '../components/ExamplesPanel';
import { Interpreter, OutputLine } from '../lang/interpreter';

const DEFAULT_CODE = `// 🌙 مرحباً بك في صِفر — لغة البرمجة العربية الأصيلة
// كنز = متغير،  سرّ = ثابت،  مهمّة = دالة،  أرني = أظهر مخرجات
// كل كتلة تبدأ بـ ( : ) وتنتهي بـ ( انتهى )

كنز اسم = "عالم"
أرني("مرحباً يا " + اسم + "! 👋")

// شرط ثلاثي
كنز ساعة = 14
إن ساعة < 12 :
    أرني("صباح الخير ☀️")
وإلا إن ساعة < 18 :
    أرني("مساء النور 🌅")
وإلا :
    أرني("ليلة سعيدة 🌙")
انتهى

// تكرار حلقي
أرني("──── الأرقام الزوجية حتى 10 ────")
جوال ز من 2 إلى 10 بخطوة 2 :
    أرني("→ " + نص(ز))
انتهى

// مهمّة (function) مع تكرار ذاتي
مهمّة مضروب(ن) :
    إن ن <= 1 :
        أعد 1
    انتهى
    أعد ن * مضروب(ن - 1)
انتهى

أرني("10! = " + نص(مضروب(10)))

// 🧠 شبكة عصبية في 3 أسطر!
كنز نموذج = شبكة_عصبية([2، 4، 1])
درّب(نموذج، [[0،0،0]،[0،1،1]،[1،0،1]،[1،1،0]]، 3000، 0.3)
أرني("XOR(1،0) = " + نص(دور(تنبأ(نموذج، [1، 0])[0])))
`;

const interpreter = new Interpreter();

function decodeHashCode(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#code=')) return null;
  try {
    const b64 = decodeURIComponent(hash.slice(6));
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch { return null; }
}

function encodeHashCode(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return encodeURIComponent(btoa(bin));
}

type SifrFile = { id: string; name: string; code: string };

function loadFiles(): SifrFile[] {
  const fromHash = decodeHashCode();
  if (fromHash) return [{ id: '1', name: 'رئيسي.صفر', code: fromHash }];
  try {
    const stored = localStorage.getItem('sifr-files');
    if (stored) {
      const parsed = JSON.parse(stored) as SifrFile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [{ id: '1', name: 'رئيسي.صفر', code: DEFAULT_CODE }];
}

function saveFiles(files: SifrFile[]) {
  try { localStorage.setItem('sifr-files', JSON.stringify(files)); } catch { /* ignore */ }
}

export default function Playground() {
  const [files, setFiles] = useState<SifrFile[]>(loadFiles);
  const [activeId, setActiveId] = useState<string>(() => loadFiles()[0]?.id ?? '1');
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const activeFile = files.find(f => f.id === activeId) ?? files[0];
  const code = activeFile?.code ?? '';

  const setCode = useCallback((val: string) => {
    setFiles(fs => {
      const updated = fs.map(f => f.id === activeId ? { ...f, code: val } : f);
      saveFiles(updated);
      return updated;
    });
  }, [activeId]);

  const addFile = useCallback(() => {
    const id = String(Date.now());
    const name = `ملف_${files.length + 1}.صفر`;
    const newFile: SifrFile = { id, name, code: `// ${name}\n` };
    setFiles(fs => { const u = [...fs, newFile]; saveFiles(u); return u; });
    setActiveId(id);
  }, [files.length]);

  const closeFile = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(fs => {
      if (fs.length <= 1) return fs;
      const idx = fs.findIndex(f => f.id === id);
      const updated = fs.filter(f => f.id !== id);
      saveFiles(updated);
      if (activeId === id) {
        setActiveId(updated[Math.max(0, idx - 1)]?.id ?? updated[0]?.id);
      }
      return updated;
    });
  }, [activeId]);

  const [output, setOutput] = useState<OutputLine[]>([]);
  const [runTime, setRunTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showRepl, setShowRepl] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'full' | 'tablet' | 'mobile'>('full');
  const [replInput, setReplInput] = useState('');
  const [replHistory, setReplHistory] = useState<{ kind: 'in' | OutputLine['kind']; text: string }[]>([]);
  const [replPast, setReplPast] = useState<string[]>([]);
  const [, setReplIdx] = useState<number>(-1);
  const replRef = useRef<HTMLDivElement | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    interpreter.setCanvas(canvasRef.current);
  }, [showCanvas]);

  const run = useCallback(() => {
    setIsRunning(true);
    setOutput([]);
    setErrorLine(null);
    if (canvasRef.current) canvasRef.current.innerHTML = '';
    const start = performance.now();
    setTimeout(() => {
      interpreter.setCanvas(canvasRef.current);
      const lines = interpreter.run(code);
      const elapsed = Math.round(performance.now() - start);
      setOutput(lines);
      setRunTime(elapsed);
      setIsRunning(false);
      if (interpreter.errorLine) setErrorLine(interpreter.errorLine);
      // Auto-show canvas if any DOM was rendered
      if (canvasRef.current && canvasRef.current.children.length > 0 && !showCanvas) {
        setShowCanvas(true);
      }
    }, 0);
  }, [code, showCanvas]);

  const exportHTML = useCallback(() => {
    if (!canvasRef.current) return;
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>موقعي — صُنع بصِفر</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>* { box-sizing: border-box; } body { margin: 0; font-family: 'Noto Naskh Arabic', sans-serif; direction: rtl; }</style>
</head>
<body>
${canvasRef.current.innerHTML}
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'موقعي-صفر.html'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const clear = useCallback(() => {
    setCode('');
    setOutput([]);
    setRunTime(null);
    setErrorLine(null);
    if (canvasRef.current) canvasRef.current.innerHTML = '';
  }, [setCode]);

  const submitRepl = useCallback(() => {
    const src = replInput.trim();
    if (!src) return;
    const newLines: { kind: 'in' | OutputLine['kind']; text: string }[] = [{ kind: 'in', text: src }];
    try {
      const out = interpreter.runSnippet(src);
      for (const l of out) newLines.push({ kind: l.kind, text: l.text });
    } catch (e) {
      newLines.push({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    }
    setReplHistory(h => [...h, ...newLines]);
    setReplPast(p => [...p, src]);
    setReplIdx(-1);
    setReplInput('');
    setTimeout(() => {
      if (replRef.current) replRef.current.scrollTop = replRef.current.scrollHeight;
    }, 0);
  }, [replInput]);

  const onReplKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submitRepl(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setReplIdx(i => {
        const next = i < 0 ? replPast.length - 1 : Math.max(0, i - 1);
        if (replPast[next] !== undefined) setReplInput(replPast[next]);
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setReplIdx(i => {
        if (i < 0) return -1;
        const next = i + 1;
        if (next >= replPast.length) { setReplInput(''); return -1; }
        setReplInput(replPast[next]);
        return next;
      });
    }
  }, [submitRepl, replPast]);

  const share = useCallback(() => {
    const hash = encodeHashCode(code);
    const url = `${window.location.origin}${window.location.pathname}#code=${hash}`;
    window.history.replaceState(null, '', `#code=${hash}`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => { setShareToast('✓ تم نسخ الرابط'); setTimeout(() => setShareToast(null), 2200); },
        () => { setShareToast('✗ فشل النسخ'); setTimeout(() => setShareToast(null), 2200); }
      );
    } else {
      setShareToast('✓ الرابط في شريط العنوان');
      setTimeout(() => setShareToast(null), 2200);
    }
  }, [code]);

  return (
    <div className="playground">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">Σ</span>
          <div className="header-text">
            <h1>صِفر</h1>
            <p>منصّة البرمجة العربية للمؤسّسات</p>
          </div>
        </div>
        <div className="header-actions">
          <a
            className="btn-vscode"
            href="https://github.com/sifr-lang/sifr/tree/main/vscode-sifr"
            target="_blank"
            rel="noopener noreferrer"
            title="إضافة Sifr للـ VSCode"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.86 2.66a1.5 1.5 0 0 1 1.04.36l3.4 2.83c.7.59.7 1.69 0 2.29l-3.4 2.83c-.4.34-.95.43-1.45.21l-7.7-3.32-5.5 4.16 5.5 4.15 7.7-3.32c.5-.21 1.05-.13 1.45.21l3.4 2.83c.7.6.7 1.7 0 2.3l-3.4 2.82c-.7.59-1.79.42-2.27-.36L8.5 14.5l-3.5 2.65a1.5 1.5 0 0 1-2.21-.4L1.4 14.6a1.5 1.5 0 0 1 .25-1.97L4.83 10 1.65 7.37A1.5 1.5 0 0 1 1.4 5.4l1.39-2.15a1.5 1.5 0 0 1 2.21-.4L8.5 5.5l8.13-2.5c.36-.16.7-.27 1.23-.34z"/></svg>
            VSCode
          </a>
          <button
            className={`btn-ghost ${showExamples ? 'active' : ''}`}
            onClick={() => setShowExamples(v => !v)}
          >
            أمثلة
          </button>
          <button
            className={`btn-ghost ${showDocs ? 'active' : ''}`}
            onClick={() => setShowDocs(v => !v)}
          >
            توثيق
          </button>
          <button
            className={`btn-ghost ${showCanvas ? 'active' : ''}`}
            onClick={() => setShowCanvas(v => !v)}
          >
            لوحة
          </button>
          <button
            className={`btn-ghost ${showRepl ? 'active' : ''}`}
            onClick={() => setShowRepl(v => !v)}
            title="جلسة تفاعلية فورية"
          >
            تفاعلي
          </button>
          <button className="btn-ghost" onClick={share} title="انسخ رابطاً يحتوي على كودك">
            شارك
          </button>
          <button className="btn-ghost" onClick={clear}>مسح</button>
          <button
            className={`btn-run ${isRunning ? 'running' : ''}`}
            onClick={run}
            disabled={isRunning}
          >
            {isRunning ? 'جارٍ التنفيذ…' : '▶  تشغيل'}
          </button>
        </div>
        {shareToast && <div className="share-toast">{shareToast}</div>}
      </header>

      <div className="main-layout">
        {showExamples && (
          <aside className="sidebar">
            <ExamplesPanel onSelect={(c) => { setCode(c); setShowExamples(false); }} />
          </aside>
        )}

        {showDocs && (
          <aside className="sidebar docs-sidebar">
            <DocsPanel />
          </aside>
        )}

        <div className="editor-pane">
          <div className="pane-header">
            <span className="pane-title">📝 المحرر</span>
            <span className="pane-hint">Ctrl+Enter للتشغيل • Tab للإكمال • ↑↓ للتنقل</span>
          </div>
          <div className="file-tabs">
            {files.map(f => (
              <button
                key={f.id}
                className={`file-tab${f.id === activeId ? ' active' : ''}`}
                onClick={() => { setActiveId(f.id); setErrorLine(null); }}
              >
                {f.name}
                {files.length > 1 && (
                  <span
                    className="file-tab-close"
                    onClick={(e) => closeFile(f.id, e)}
                    title="إغلاق"
                  >×</span>
                )}
              </button>
            ))}
            <button className="file-tab-add" onClick={addFile} title="ملف جديد">+</button>
          </div>
          <CodeEditor value={code} onChange={setCode} onRun={run} errorLine={errorLine} />
        </div>

        <div className="console-pane">
          <div className="pane-header">
            <span className="pane-title">💻 المخرجات</span>
            {output.length > 0 && (
              <button className="btn-tiny" onClick={() => { setOutput([]); setRunTime(null); }}>
                مسح
              </button>
            )}
          </div>
          <OutputConsole lines={output} runTime={runTime} />
        </div>

        {showCanvas && (
          <div className="canvas-pane">
            <div className="pane-header">
              <span className="pane-title">🌐 المتصفّح</span>
              <div className="canvas-view-btns">
                <button
                  className={`canvas-view-btn ${previewWidth === 'mobile' ? 'active' : ''}`}
                  onClick={() => setPreviewWidth('mobile')}
                  title="عرض الجوّال (375px)"
                >📱</button>
                <button
                  className={`canvas-view-btn ${previewWidth === 'tablet' ? 'active' : ''}`}
                  onClick={() => setPreviewWidth('tablet')}
                  title="عرض اللوح (768px)"
                >💻</button>
                <button
                  className={`canvas-view-btn ${previewWidth === 'full' ? 'active' : ''}`}
                  onClick={() => setPreviewWidth('full')}
                  title="عرض سطح المكتب (كامل)"
                >🖥</button>
              </div>
              <button className="btn-tiny btn-export" onClick={exportHTML} title="حمّل الموقع كملف HTML">
                ⬇ HTML
              </button>
              <button className="btn-tiny" onClick={() => { if (canvasRef.current) canvasRef.current.innerHTML = ''; }}>
                مسح
              </button>
            </div>
            <div className="browser-chrome">
              <div className="browser-dots">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
              </div>
              <div className="browser-url-bar">
                <span className="browser-url-icon">🔒</span>
                <span className="browser-url-text">موقعي.صفر</span>
              </div>
              <div style={{ width: 52 }} />
            </div>
            <div className={`canvas-viewport canvas-viewport-${previewWidth}`}>
              <div ref={canvasRef} className="canvas-surface" dir="rtl" />
            </div>
          </div>
        )}

        {showRepl && (
          <div className="repl-pane">
            <div className="pane-header">
              <span className="pane-title">⌨ جلسة تفاعلية (REPL)</span>
              <span className="pane-hint">↑/↓ للتاريخ • Enter للتشغيل</span>
              <button className="btn-tiny" onClick={() => { setReplHistory([]); }}>مسح</button>
            </div>
            <div ref={replRef} className="repl-history">
              {replHistory.length === 0 && (
                <div className="repl-empty">
                  اكتب أي تعبير وستحصل على نتيجته فوراً. الجلسة تحتفظ بالمتغيّرات بين الأوامر.
                </div>
              )}
              {replHistory.map((l, i) => (
                <div key={i} className={`repl-line repl-${l.kind}`}>
                  {l.kind === 'in' ? <span className="repl-prompt">›</span> : null}
                  {' '}{l.text}
                </div>
              ))}
            </div>
            <div className="repl-input-row">
              <span className="repl-prompt">›</span>
              <input
                className="repl-input"
                value={replInput}
                onChange={e => setReplInput(e.target.value)}
                onKeyDown={onReplKey}
                placeholder="مثال:  كنز س = 5    أو    س * 2"
                dir="rtl"
              />
              <button className="btn-tiny btn-tiny-primary" onClick={submitRepl}>تشغيل</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocsPanel() {
  return (
    <div className="docs-panel">
      <h3>توثيق صِفر</h3>

      <section>
        <h4>الكلمات المفتاحية الأصيلة</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          صِفر لغة جديدة بصياغة فريدة — ليست ترجمة من أي لغة.
        </p>
      </section>

      <section>
        <h4>المتغيّرات والثوابت</h4>
        <code>كنز س = 5</code>
        <code>سرّ ط = 3.14</code>
      </section>

      <section>
        <h4>كتل الكود</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>كل كتلة تبدأ بـ : وتنتهي بـ انتهى</p>
        <code>{`إن س > 0 :\n    أرني("موجب")\nانتهى`}</code>
      </section>

      <section>
        <h4>الشروط والحلقات</h4>
        <code>{`إن شرط :\n    ...\nوإلا :\n    ...\nانتهى`}</code>
        <code>{`جوال ع من 1 إلى 10 :\n    ...\nانتهى`}</code>
        <code>{`جوال ع في قائمة :\n    ...\nانتهى`}</code>
      </section>

      <section>
        <h4>المهمّات (Functions)</h4>
        <code>{`مهمّة جمع(أ، ب) :\n    أعد أ + ب\nانتهى`}</code>
      </section>

      <section>
        <h4>البُنى مع الوراثة 🆕</h4>
        <code>{`بنية حيوان :\n    اسم\n    مهمّة صوت() : أعد "؟" انتهى\nانتهى\n\nبنية كلب وارث حيوان :\n    مهمّة صوت() : أعد "هاو!" انتهى\nانتهى`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>الوراثة بكلمة "وارث" أو "يرث" — الابن يرث حقول وطُرق الأب.</p>
      </section>

      <section>
        <h4>الطُرق و«هذا»</h4>
        <code>{`بنية نقطة :\n    س\n    ع\n    مهمّة مسافة() :\n        أعد جذر(هذا.س ** 2 + هذا.ع ** 2)\n    انتهى\nانتهى`}</code>
      </section>

      <section>
        <h4>الدوال المجهولة (Lambda)</h4>
        <code>{`خريطة([1، 2، 3]، مهمّة(س) : أعد س * 2 انتهى)`}</code>
      </section>

      <section>
        <h4>قوالب نصّية</h4>
        <code>{'`مرحباً {اسم}، عمرك {عمر + 1}`'}</code>
      </section>

      <section>
        <h4>التطابق النمطي + الأخطاء</h4>
        <code>{`طابق ن :\n    حال 0 : أعد "صفر"\n    حال _ : أعد "أخرى"\nانتهى`}</code>
        <code>{`حاول :\n    خطأ("رسالة")\nالتقط ع :\n    أرني(ع)\nانتهى`}</code>
      </section>

      <section>
        <h4>القوائم</h4>
        <code>كنز ق = [1، 2، 3]</code>
        <code>إضافة ، حذف ، فرز ، عكس ، شريحة</code>
        <code>خريطة ، تصفية ، اختزال ، عدّ ، زوج</code>
        <code>مجموعة_فريدة ، عدّ_تكرارات ، تجميع</code>
      </section>

      <section>
        <h4>التواريخ 🆕</h4>
        <code>{`كنز ت = الآن()\nسنة(ت) ، شهر(ت) ، يوم(ت)\nتنسيق_تاريخ(ت، "يوم/شهر/سنة")`}</code>
      </section>

      <section>
        <h4>تنسيق النصوص والأرقام 🆕</h4>
        <code>حشو_يسار("5"، 3، "0") → "005"</code>
        <code>رقم_بصيغة(3.14159، 2) → "3.14"</code>
        <code>عكس_نص("مرحبا") → "ابحرم"</code>
      </section>

      <section>
        <h4>🎨 بناء واجهات حقيقية (DOM) 🆕</h4>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>افتح «لوحة المعاينة» لتشاهد ما تبنيه</p>
        <code>{`كنز عداد = 0\nكنز ع = نص_عنصر(\`العداد: {عداد}\`، "h2")\nكنز ز = زر("+1"، مهمّة() :\n    عداد = عداد + 1\n    غيّر_نص(ع، \`العداد: {عداد}\`)\nانتهى)\nأضف(لوحة()، حاوية(ع، ز))`}</code>
        <p style={{ fontSize: '0.75em', opacity: 0.7 }}>عناصر: عنصر، نص_عنصر، عنوان، فقرة، زر، حقل، حاوية، صف، صورة<br/>عمليات: أضف، أنماط، استمع، غيّر_نص، لوحة، امسح_اللوحة</p>
      </section>

      <section>
        <h4>📦 JSON 🆕</h4>
        <code>{`كنز نص = إلى_جيسون({ اسم: "علي"، عمر: 25 }، 2)\nكنز كائن = من_جيسون(نص)`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>المعامل الثاني في إلى_جيسون = عدد مسافات التنسيق</p>
      </section>

      <section>
        <h4>🌐 جلب HTTP 🆕</h4>
        <code>{`كنز رد = اجلب("https://api.example.com/data")\nإن رد.ناجح :\n    أرني(رد.جيسون.اسم)\nانتهى`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>خصائص الرد: حالة، نص، جيسون، ناجح — خيارات: طريقة، ترويسات، جسم</p>
      </section>

      <section>
        <h4>🎨 رسم 2D على Canvas 🆕</h4>
        <code>{`كنز لوح = رسّام(600، 400)\nكنز قلم = سياق(لوح)\nأضف(لوحة()، لوح)\n\nلون_تعبئة(قلم، "#3b82f6")\nارسم_مستطيل(قلم، 10، 10، 200، 100)\n\nلون_تعبئة(قلم، "#ef4444")\nارسم_دائرة(قلم، 300، 200، 50)\n\nارسم_خط(قلم، 0، 0، 600، 400)\nارسم_نص_لوح(قلم، "مرحبا"، 100، 50، 24)`}</code>
        <p style={{ fontSize: '0.75em', opacity: 0.7 }}>
          <strong>إنشاء:</strong> رسّام، سياق<br/>
          <strong>أشكال:</strong> ارسم_مستطيل، حدود_مستطيل، ارسم_دائرة، حدود_دائرة، ارسم_خط، ارسم_مضلع<br/>
          <strong>نص:</strong> ارسم_نص_لوح، قياس_نص_لوح<br/>
          <strong>ألوان:</strong> لون_تعبئة، لون_حدود، سماكة_خط، شفافية_قلم، تدرج_لوني<br/>
          <strong>تحويل:</strong> احفظ_قلم، استعد_قلم، انقل_قلم، دوّر_قلم، حجم_قلم<br/>
          <strong>مسارات:</strong> مسار_جديد، انقل_إلى، خط_إلى، أغلق_مسار، قوس، املأ_مسار، ارسم_مسار<br/>
          <strong>أخرى:</strong> امسح_لوح، عرض_لوح، ارتفاع_لوح
        </p>
      </section>

      <section>
        <h4>🔍 التعابير المنتظمة (Regex) 🆕</h4>
        <code>{`ابحث_نص("[0-9]+"، "مشروع 2024")  // "2024"\nابحث_كل("[\\\\w]+"، "مرحبا بالعالم")  // قائمة\naستبدل_نمط("hello"، "l"، "L")  // "heLLo"\nيطابق("^\\\\d+$"، "12345")  // صحيح`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>المعامل الثالث في ابحث_نص وابحث_كل = أعلام مثل "g"، "i"، "m"</p>
      </section>

      <section>
        <h4>📋 الحافظة والموقع 🆕</h4>
        <code>انسخ_نص("النص المراد نسخه")</code>
        <code>{`موقعي(مهمّة(بيانات) :\n    أرني(بيانات.خط_عرض)\nانتهى)`}</code>
      </section>

      <section>
        <h4>🔌 WebSocket — اتصال مباشر 🆕</h4>
        <code>{`كنز ws = اتصال_مباشر("wss://echo.websocket.events")\nws.عند_الفتح = مهمّة() : أرني("متصل") انتهى\nws.عند_الرسالة = مهمّة(رسالة) : أرني(رسالة) انتهى\nws.عند_الإغلاق = مهمّة() : أرني("انتهى") انتهى\nأرسل_للاتصال(ws، "مرحبا")\nأغلق_اتصال(ws)`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>خصائص: عند_الفتح، عند_الرسالة، عند_الإغلاق، عند_الخطأ، حالة<br/>دوال: أرسل_للاتصال، أغلق_اتصال</p>
      </section>

      <section>
        <h4>📂 قراءة الملفات 🆕</h4>
        <code>{`اقرأ_ملف(مهمّة(بيانات) :\n    أرني(بيانات.اسم)\n    أرني(بيانات.حجم)\n    أرني(بيانات.محتوى)\nانتهى، مهمّة(خطأ) :\n    أرني("فشل: " + خطأ)\nانتهى، ".csv,.txt")`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>يفتح منتقي الملفات. بيانات الملف: محتوى، اسم، حجم، نوع. المعامل الثالث = أنواع مقبولة</p>
      </section>

      <section>
        <h4>🔔 الإشعارات 🆕</h4>
        <code>{`طلب_إشعار(\n    مهمّة() : أرني("الإذن مُمنح") انتهى،\n    مهمّة() : أرني("رُفض") انتهى\n)\nأشعر("عنوان الإشعار"، { نص: "محتوى الإشعار" })`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>يجب استدعاء طلب_إشعار أولاً. خيارات أشعر: نص، أيقونة</p>
      </section>

      <section>
        <h4>🖱️ السحب والإفلات 🆕</h4>
        <code>{`عنصر.draggable = صدق\nاستمع(عنصر، "سحب"، مهمّة(حد) :\n    حد.dataTransfer.setData("text"، "البيانات")\nانتهى)\nاستمع(منطقة، "إفلات"، مهمّة(حد) :\n    كنز ب = حد.dataTransfer.getData("text")\nانتهى)`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>أحداث: سحب، سحب_فوق، إفلات، سحب_خارج، سحب_دخول، سحب_نهاية</p>
      </section>

      <section>
        <h4>⌨️ بيانات أحداث استمع 🆕</h4>
        <code>{`// أحداث لوحة المفاتيح\nاستمع(عنصر، "مفتاح"، مهمّة(حد) :\n    أرني(حد.مفتاح)  // المفتاح المضغوط\nانتهى)\n// أحداث الماوس\nاستمع(عنصر، "نقر"، مهمّة(حد) :\n    أرني(حد.س)  // إحداثية X\n    أرني(حد.ع)  // إحداثية Y\nانتهى)`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>كل حدث يُمرّر كائن بيانات للمعالج. لوحة مفاتيح: مفتاح، رمز، ctrl، shift. ماوس: س، ع، زر</p>
      </section>

      <section>
        <h4>الويب والتخزين</h4>
        <code>{`احفظ("مفتاح"، قيمة)\nحمّل("مفتاح")\nاحذف_محفوظ("مفتاح")`}</code>
      </section>

      <section>
        <h4>الوحدات (Modules) 🆕</h4>
        <code>{`وحدة رياضيات :\n    سرّ ط = 3.14\n    مهمّة مربع(س) : أعد س * س انتهى\n    صدّر ط، مربع\nانتهى\n\nاستورد ط، مربع من رياضيات`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>كل وحدة بيئة منعزلة. تُصدَّر فقط الأسماء بعد <code>صدّر</code>.</p>
      </section>

      <section>
        <h4>الأنواع الاختيارية 🆕</h4>
        <code>{`كنز عمر: رقم = 25\nكنز اسم: نص = "محمد"\nكنز ق: قائمة = [1، 2]`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>الأنواع: رقم، نص، منطقي، قائمة، كائن، دالة، عدم، أي + أسماء البُنى. تُفحص وقت التشغيل.</p>
      </section>

      <section>
        <h4>إطار الاختبارات 🆕</h4>
        <code>{`اختبر("اسم"، مهمّة() :\n    توقّع(جمع(2،3)، 5)\nانتهى)\n\nشغّل_اختبارات()`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>دوال: <code>اختبر</code>، <code>توقّع</code>، <code>توقّع_صدق</code>، <code>توقّع_خطأ</code>، <code>شغّل_اختبارات</code>.</p>
      </section>

      <section>
        <h4>الجلسة التفاعلية (REPL) 🆕</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          اضغط <strong>⌨ تفاعلي</strong> في الأعلى — تجرّب التعابير سطراً سطراً، مع حفظ المتغيّرات بين الأوامر.
        </p>
      </section>

      <section>
        <h4>تتبّع الاستدعاءات 🆕</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          الأخطاء تُظهر الآن سلسلة الدوال (مثل Python/JS) — يسهّل التشخيص جداً.
        </p>
      </section>

      <section>
        <h4>المكتبة الموسّعة (80+ دالة) 🎁🆕</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.85, lineHeight: 1.7 }}>
          <strong>رياضيات:</strong> <code>لو2</code>، <code>لو10</code>، <code>أُس</code>، <code>وتر</code>، <code>قاطع</code>، <code>مضاعف</code>، <code>مضروب</code>، <code>فيبوناتشي</code>، <code>أولي؟</code>، <code>قائمة_أوّليات</code>، <code>قوس_جيب/ظل</code>، <code>إلى_راديان/درجات</code>، <code>مسافة</code><br/>
          <strong>إحصاء:</strong> <code>وسيط</code>، <code>منوال</code>، <code>تباين</code>، <code>انحراف_معياري</code>، <code>مئوي</code>، <code>مدى</code>، <code>فهرس_أقصى/أدنى</code><br/>
          <strong>عشوائي:</strong> <code>عشوائي_بين</code>، <code>اختر_عشوائي</code>، <code>خلط</code>، <code>عيّنة</code>، <code>لون_عشوائي</code><br/>
          <strong>نص:</strong> <code>فهرس_نص</code>، <code>جزء_نص</code>، <code>كبّر_أوّل</code>، <code>كلمات</code>، <code>أسطر</code>، <code>أمن_html</code>، <code>عدّ_تكرار_نص</code><br/>
          <strong>عربي:</strong> <code>بدون_تشكيل</code>، <code>وحّد_ألف/همزة</code>، <code>تطبيع_عربي</code>، <code>أرقام_عربية_إلى_غربية</code>، <code>عدد_كلمات</code>، <code>عربي؟</code><br/>
          <strong>قوائم:</strong> <code>سطّح</code>، <code>سطّح_تماماً</code>، <code>جد</code>، <code>جد_فهرس</code>، <code>كل</code>، <code>بعض</code>، <code>قطع</code>، <code>خذ</code>، <code>اسقط</code>، <code>فرز_بـ</code><br/>
          <strong>كائنات:</strong> <code>أزواج</code>، <code>ادمج_كائنات</code>، <code>نسخة_عميقة</code>، <code>له_مفتاح</code>، <code>احذف_مفتاح</code><br/>
          <strong>تحقق:</strong> <code>بريد_صحيح؟</code>، <code>رابط_صحيح؟</code>، <code>هاتف_صحيح؟</code>، <code>فارغ؟</code><br/>
          <strong>ألوان:</strong> <code>سداسي_إلى_رغب</code>، <code>رغب_إلى_سداسي</code>، <code>لون_رغب</code>، <code>لون_تدرج</code><br/>
          <strong>تاريخ هجري:</strong> <code>سنة_هجرية</code>، <code>شهر_هجري</code>، <code>يوم_هجري</code>، <code>تاريخ_هجري</code><br/>
          <strong>تشفير:</strong> <code>معرّف_فريد</code>، <code>بصمة</code>، <code>ترميز_64</code>، <code>فك_64</code><br/>
          <strong>صوت:</strong> <code>نغمة(تردد، مدة)</code>، <code>صفير</code>، <code>انطق(نص)</code> 🔊<br/>
          <strong>تنسيق:</strong> <code>عملة</code>، <code>رقم_منسّق</code>، <code>نسبة_مئوية</code><br/>
          <strong>تحويلات:</strong> <code>مئوي↔فهرنهايت</code>، <code>كم↔ميل</code>، <code>كغ↔رطل</code><br/>
          <strong>أداء:</strong> <code>قياس(دالة)</code> — يُرجع زمن التنفيذ بالميلي ثانية
        </p>
      </section>

      <section>
        <h4>☕ هياكل بيانات بمستوى Java (Tier 7) 🆕</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.85, lineHeight: 1.7 }}>
          <strong>قاموس (HashMap):</strong> <code>قاموس()</code>، <code>قاموس_ضع/جلب/له/احذف/حجم/مفاتيح/قيم/أزواج</code><br/>
          <strong>مجموعة (Set):</strong> <code>مجموعة([…])</code>، <code>مجم_أضف/احذف/يحوي/حجم</code>، <code>مجم_اتحاد/تقاطع/فرق</code><br/>
          <strong>طابور (Queue, FIFO):</strong> <code>طابور()</code>، <code>طب_ادفع/اسحب/رأس/حجم/فارغ؟</code><br/>
          <strong>مكدس (Stack, LIFO):</strong> <code>مكدس()</code>، <code>مك_ادفع/اسحب/قمة/حجم/فارغ؟</code><br/>
          <strong>كومة أولوية (Min-Heap):</strong> <code>كومة(?دالة_مفتاح)</code>، <code>كم_ادفع/اسحب/قمة/حجم</code><br/>
          <strong>قائمة مرتبطة:</strong> <code>قائمة_مرتبطة()</code>، <code>قم_أضف_بداية/نهاية</code>، <code>قم_احذف_أول/آخر</code><br/>
          <strong>شجرة بحث:</strong> <code>شجرة_بحث()</code>، <code>شب_أدخل/يحوي/تجوال/أدنى/أقصى/حجم</code><br/>
          <strong>تيارات (Streams):</strong> <code>تيار(قائمة)</code>، <code>تيار_من_نطاق(أ، ب)</code>، عمليات كسولة: <code>تيار_خارطة/تصفية/خذ/اسقط/متميز/مرتب</code>، طرفية: <code>تيار_إلى_قائمة/عد/مجموع/أقصى/أدنى/اختصر/جمّع_بـ</code><br/>
          <strong>خوارزميات:</strong> <code>ترتيب_سريع</code>، <code>ترتيب_دمج</code>، <code>بحث_ثنائي</code>، <code>بحث_خطي</code>، <code>مسافة_تحرير</code>، <code>تشابه_نصوص</code>، <code>بحث_عمق (DFS)</code>، <code>بحث_عرض (BFS)</code>، <code>أقصر_مسار</code><br/>
          <strong>أعداد ضخمة (BigInt):</strong> <code>عدد_كبير(x)</code>، <code>كب_جمع/طرح/ضرب/قسمة/باقي/أس/مقارنة</code>، <code>كب_مضروب(n)</code>، <code>كب_إلى_نص</code>
        </p>
      </section>

      <section>
        <h4>الذكاء الاصطناعي 🧠</h4>
        <code>{`شبكة_عصبية([2، 8، 1]، ["ريلو"، "سيغمويد"])\nدرّب(نموذج، بيانات، 1000)\nتنبأ(نموذج، [1، 0])\nاحفظ_نموذج / حمّل_نموذج`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.8 }}>
          جرّب مثال «🧠 كود عبدالله» في لوحة الأمثلة — مصنّف صحي كامل مدرَّب وجاهز للاستخدام.
        </p>
      </section>

      <section>
        <h4>VSCode Extension 💻</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.85 }}>
          إضافة رسمية لـ VSCode تدعم تلوين الكلمات المفتاحية والدوال المدمجة، مع إغلاق تلقائي للأقواس وإمتدادات <code>.sifr</code> و <code>.صفر</code>.
        </p>
        <code>{`// التثبيت:\n// انسخ مجلد vscode-sifr إلى:\n// ~/.vscode/extensions/sifr-lang-1.0.0\n// ثم أعد تشغيل VSCode`}</code>
      </section>

      <section>
        <h4>📤 المشاركة</h4>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>
          اضغط «شارك» لنسخ رابط يحتوي على كودك — افتحه في أي متصفح ليشتغل تلقائياً.
        </p>
      </section>

      <section style={{ borderTop: '1px solid #2a2a3a', marginTop: '1.5rem', paddingTop: '1.2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.78em', opacity: 0.5, lineHeight: 1.8, margin: 0 }}>
          صِفر — لغة البرمجة العربية الأصيلة<br/>
          <span style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}>Sifr — The Arabic-First Programming Language</span><br/>
          © 2026 <strong style={{ opacity: 0.7 }}>عبدالله سعد علي محمد القحطاني</strong><br/>
          <span style={{ opacity: 0.4, fontSize: '0.9em' }}>Abdullah Saad Ali Mohammed Alqahtani</span><br/>
          <span style={{ opacity: 0.35, fontSize: '0.85em' }}>جميع الحقوق محفوظة · MIT License</span>
        </p>
      </section>
    </div>
  );
}
