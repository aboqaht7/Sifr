import { useState, useCallback } from 'react';
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

export default function Playground() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [runTime, setRunTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [showDocs, setShowDocs] = useState(false);

  const run = useCallback(() => {
    setIsRunning(true);
    setOutput([]);
    const start = performance.now();
    setTimeout(() => {
      const lines = interpreter.run(code);
      const elapsed = Math.round(performance.now() - start);
      setOutput(lines);
      setRunTime(elapsed);
      setIsRunning(false);
    }, 0);
  }, [code]);

  const clear = useCallback(() => {
    setCode('');
    setOutput([]);
    setRunTime(null);
  }, []);

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
          <button className="btn-ghost" onClick={clear}>🗑 مسح</button>
          <button
            className={`btn-run ${isRunning ? 'running' : ''}`}
            onClick={run}
            disabled={isRunning}
          >
            {isRunning ? '⏳ جارٍ التنفيذ...' : '▶ تشغيل'}
          </button>
        </div>
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
        <h4>الشروط</h4>
        <code>{`إن شرط :\n    ...\nوإلا إن شرط٢ :\n    ...\nوإلا :\n    ...\nانتهى`}</code>
      </section>

      <section>
        <h4>الحلقات</h4>
        <code>{`جوال ع من 1 إلى 10 :\n    أرني(ع)\nانتهى`}</code>
        <code>{`جوال ع من 2 إلى 20 بخطوة 2 :\n    ...\nانتهى`}</code>
        <code>{`جوال عنصر في قائمة :\n    أرني(عنصر)\nانتهى`}</code>
        <code>{`كرر شرط :\n    ...\nانتهى`}</code>
      </section>

      <section>
        <h4>المهمّات (Functions)</h4>
        <code>{`مهمّة جمع(أ، ب) :\n    أعد أ + ب\nانتهى`}</code>
      </section>

      <section>
        <h4>البُنى (Structs) ⚡</h4>
        <code>{`بنية طالب :\n    اسم\n    درجة\nانتهى\n\nكنز م = طالب("محمد"، 95)\nأرني(م.اسم)`}</code>
      </section>

      <section>
        <h4>التطابق النمطي (Match) ⚡</h4>
        <code>{`طابق ن :\n    حال 0 : أعد "صفر"\n    حال 1 : أعد "واحد"\n    حال _ : أعد "أخرى"\nانتهى`}</code>
      </section>

      <section>
        <h4>القوائم</h4>
        <code>كنز ق = [1، 2، 3]</code>
        <code>إضافة(ق، 4)</code>
        <code>فرز(ق) ، عكس(ق) ، طول(ق)</code>
      </section>

      <section>
        <h4>الذكاء الاصطناعي</h4>
        <code>شبكة_عصبية([2، 4، 1])</code>
        <code>درّب(نموذج، بيانات، 1000)</code>
        <code>تنبأ(نموذج، [1، 0])</code>
      </section>

      <section>
        <h4>القيم المنطقية</h4>
        <code>صدق ، كذب ، عدم</code>
        <code>&& ، || ، !</code>
      </section>

      <section>
        <h4>المعاملات</h4>
        <code>+ - * / % **</code>
        <code>{`==  !=  <  >  <=  >=`}</code>
      </section>
    </div>
  );
}
