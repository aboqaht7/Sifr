import { useState, useCallback, useEffect, useRef } from 'react';
import CodeEditor from '../components/CodeEditor';
import OutputConsole from '../components/OutputConsole';
import ExamplesPanel from '../components/ExamplesPanel';
import { Interpreter, OutputLine } from '../lang/interpreter';

const DEFAULT_CODE = `// 🌙 أهلاً بك في عربيكا — لغة برمجة عربية أصيلة بتصميم فريد
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

export default function Playground() {
  const [code, setCode] = useState(() => decodeHashCode() ?? DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [runTime, setRunTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [showRepl, setShowRepl] = useState(false);
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
    if (canvasRef.current) canvasRef.current.innerHTML = '';
    const start = performance.now();
    setTimeout(() => {
      interpreter.setCanvas(canvasRef.current);
      const lines = interpreter.run(code);
      const elapsed = Math.round(performance.now() - start);
      setOutput(lines);
      setRunTime(elapsed);
      setIsRunning(false);
      // Auto-show canvas if any DOM was rendered
      if (canvasRef.current && canvasRef.current.children.length > 0 && !showCanvas) {
        setShowCanvas(true);
      }
    }, 0);
  }, [code, showCanvas]);

  const clear = useCallback(() => {
    setCode('');
    setOutput([]);
    setRunTime(null);
    if (canvasRef.current) canvasRef.current.innerHTML = '';
  }, []);

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
          <span className="header-logo">ع</span>
          <div className="header-text">
            <h1>عربيكا</h1>
            <p>لغة برمجة عربية أصيلة</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`btn-ghost ${showExamples ? 'active' : ''}`}
            onClick={() => setShowExamples(v => !v)}
          >
            📚 أمثلة
          </button>
          <button
            className={`btn-ghost ${showDocs ? 'active' : ''}`}
            onClick={() => setShowDocs(v => !v)}
          >
            📖 توثيق
          </button>
          <button
            className={`btn-ghost ${showCanvas ? 'active' : ''}`}
            onClick={() => setShowCanvas(v => !v)}
          >
            🎨 لوحة
          </button>
          <button
            className={`btn-ghost ${showRepl ? 'active' : ''}`}
            onClick={() => setShowRepl(v => !v)}
            title="جلسة تفاعلية فورية"
          >
            ⌨ تفاعلي
          </button>
          <button className="btn-ghost" onClick={share} title="انسخ رابطاً يحتوي على كودك">
            📤 شارك
          </button>
          <button className="btn-ghost" onClick={clear}>🗑 مسح</button>
          <button
            className={`btn-run ${isRunning ? 'running' : ''}`}
            onClick={run}
            disabled={isRunning}
          >
            {isRunning ? '⏳ جارٍ التنفيذ...' : '▶ تشغيل'}
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
            <span className="pane-hint">Ctrl+Enter للتشغيل • Tab للمسافة</span>
          </div>
          <CodeEditor value={code} onChange={setCode} onRun={run} />
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
              <span className="pane-title">🎨 لوحة المعاينة</span>
              <button className="btn-tiny" onClick={() => { if (canvasRef.current) canvasRef.current.innerHTML = ''; }}>
                مسح
              </button>
            </div>
            <div ref={canvasRef} className="canvas-surface" dir="rtl" />
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
      <h3>توثيق عربيكا</h3>

      <section>
        <h4>الكلمات المفتاحية الأصيلة</h4>
        <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
          عربيكا لغة جديدة بصياغة فريدة — ليست ترجمة من أي لغة.
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
        <h4>جسون والتعابير المنتظمة</h4>
        <code>{`إلى_جسون(كائن، صدق)\nمن_جسون(نص_جسون)\nنمط("[0-9]+", "g")`}</code>
      </section>

      <section>
        <h4>الويب والتخزين</h4>
        <code>{`جلب(الرابط)\nاحفظ_ملف("name.txt"، محتوى)\nاحفظ("مفتاح"، قيمة)\nحمّل("مفتاح")`}</code>
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
        <h4>الذكاء الاصطناعي 🧠</h4>
        <code>{`شبكة_عصبية([2، 8، 1]، ["ريلو"، "سيغمويد"])\nدرّب(نموذج، بيانات، 1000)\nتنبأ(نموذج، [1، 0])\nاحفظ_نموذج / حمّل_نموذج`}</code>
      </section>

      <section>
        <h4>📤 المشاركة</h4>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>
          اضغط «شارك» لنسخ رابط يحتوي على كودك — افتحه في أي متصفح ليشتغل تلقائياً.
        </p>
      </section>
    </div>
  );
}
