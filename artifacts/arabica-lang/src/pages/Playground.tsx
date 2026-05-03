import { useState, useCallback } from 'react';
import CodeEditor from '../components/CodeEditor';
import OutputConsole from '../components/OutputConsole';
import ExamplesPanel from '../components/ExamplesPanel';
import { Interpreter, OutputLine } from '../lang/interpreter';

const DEFAULT_CODE = `// مرحباً بعربيكا — لغة البرمجة العربية 🌙
// اضغط Ctrl+Enter أو زر التشغيل لتنفيذ الكود

عرّف اسم = "عالم"
اطبع("مرحباً يا " + اسم + "!")

// جدول ضرب 3
اطبع("--- جدول ضرب 3 ---")
لكل ع من 1 حتى 10 {
    اطبع("3 × " + نص(ع) + " = " + نص(3 * ع))
}

// دالة تحسب مجموع الأرقام
دالة مجموع_حتى(ن) {
    أعِد ن * (ن + 1) / 2
}

اطبع("مجموع من 1 إلى 100 = " + نص(مجموع_حتى(100)))
`;

const interpreter = new Interpreter();

export default function Playground() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [runTime, setRunTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeCategory, setActiveCategory] = useState('الكل');
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
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">ع</span>
          <div className="header-text">
            <h1>عربيكا</h1>
            <p>لغة البرمجة العربية</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`btn-ghost ${showExamples ? 'active' : ''}`}
            onClick={() => setShowExamples(v => !v)}
            title="أمثلة"
          >
            📚 أمثلة
          </button>
          <button
            className={`btn-ghost ${showDocs ? 'active' : ''}`}
            onClick={() => setShowDocs(v => !v)}
            title="توثيق"
          >
            📖 توثيق
          </button>
          <button className="btn-ghost" onClick={clear} title="مسح">
            🗑 مسح
          </button>
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
        {/* Examples Sidebar */}
        {showExamples && (
          <aside className="sidebar">
            <ExamplesPanel
              onSelect={(c) => { setCode(c); setShowExamples(false); }}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </aside>
        )}

        {/* Docs Sidebar */}
        {showDocs && (
          <aside className="sidebar docs-sidebar">
            <DocsPanel />
          </aside>
        )}

        {/* Editor */}
        <div className="editor-pane">
          <div className="pane-header">
            <span className="pane-title">📝 المحرر</span>
            <span className="pane-hint">Ctrl+Enter للتشغيل • Tab للمسافة</span>
          </div>
          <CodeEditor value={code} onChange={setCode} onRun={run} />
        </div>

        {/* Console */}
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
        <h4>المتغيرات</h4>
        <code>عرّف س = 5</code>
        <code>ثابت ط = 3.14</code>
      </section>

      <section>
        <h4>الشروط</h4>
        <code>{`إذا (شرط) { ... } وإلا { ... }`}</code>
      </section>

      <section>
        <h4>الحلقات</h4>
        <code>{`لكل ع من 1 حتى 10 { ... }`}</code>
        <code>{`طالما (شرط) { ... }`}</code>
        <code>{`لكل ع من 1 حتى 10 بخطوة 2 { ... }`}</code>
      </section>

      <section>
        <h4>الدوال</h4>
        <code>{`دالة جمع(أ، ب) { أعِد أ + ب }`}</code>
      </section>

      <section>
        <h4>الذكاء الاصطناعي</h4>
        <code>شبكة_عصبية([2، 4، 1])</code>
        <code>درّب(نموذج، بيانات، 1000)</code>
        <code>تنبأ(نموذج، [1، 0])</code>
      </section>

      <section>
        <h4>القوائم</h4>
        <code>عرّف ق = [1، 2، 3]</code>
        <code>إضافة(ق، 4)</code>
        <code>فرز(ق)</code>
        <code>طول(ق)</code>
      </section>

      <section>
        <h4>الرياضيات</h4>
        <code>جذر(25) → 5</code>
        <code>مطلق(-7) → 7</code>
        <code>دور(3.7) → 4</code>
        <code>عشوائي() → 0..1</code>
        <code>π ، ط ، ه</code>
      </section>

      <section>
        <h4>النصوص</h4>
        <code>تقسيم(نص، "،")</code>
        <code>استبدال(نص، من، إلى)</code>
        <code>يحتوي(نص، بحث)</code>
      </section>

      <section>
        <h4>القيم المنطقية</h4>
        <code>صحيح ، خطأ ، فارغ</code>
        <code>&& ، || ، !</code>
      </section>
    </div>
  );
}
