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
        <h4>الطُرق و«هذا» (OOP) 🆕</h4>
        <code>{`بنية نقطة :\n    س\n    ع\n    مهمّة مسافة() :\n        أعد جذر(هذا.س ** 2 + هذا.ع ** 2)\n    انتهى\nانتهى\n\nكنز ن = نقطة(3، 4)\nن.مسافة()`}</code>
      </section>

      <section>
        <h4>الدوال المجهولة (Lambda) 🆕</h4>
        <code>{`كنز ضرب = مهمّة(أ، ب) : أعد أ * ب انتهى\nخريطة([1، 2، 3]، مهمّة(س) : أعد س * 2 انتهى)`}</code>
      </section>

      <section>
        <h4>قوالب نصّية 🆕</h4>
        <code>{'`مرحباً {اسم}، عمرك {عمر + 1}`'}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>استخدم العلامة ` (backtick) و {'{...}'} للتعبيرات.</p>
      </section>

      <section>
        <h4>التطابق النمطي (Match)</h4>
        <code>{`طابق ن :\n    حال 0 : أعد "صفر"\n    حال _ : أعد "أخرى"\nانتهى`}</code>
      </section>

      <section>
        <h4>التقاط الأخطاء 🆕</h4>
        <code>{`حاول :\n    خطأ("رسالة")\nالتقط ع :\n    أرني(ع)\nانتهى`}</code>
      </section>

      <section>
        <h4>القوائم</h4>
        <code>كنز ق = [1، 2، 3]</code>
        <code>إضافة(ق، 4) ، فرز(ق) ، عكس(ق)</code>
        <code>خريطة، تصفية، اختزال</code>
      </section>

      <section>
        <h4>جسون 🆕</h4>
        <code>{`إلى_جسون(كائن، صدق)\nمن_جسون(نص_جسون)`}</code>
      </section>

      <section>
        <h4>التعابير المنتظمة 🆕</h4>
        <code>{`نمط("[0-9]+", "g")\nيطابق_نمط ، استخرج_نمط ، استبدل_نمط`}</code>
      </section>

      <section>
        <h4>الويب والملفات 🆕</h4>
        <code>{`جلب(الرابط)\nجلب_جسون(الرابط)\nاحفظ_ملف("name.txt"، محتوى)`}</code>
      </section>

      <section>
        <h4>التخزين المحلي 🆕</h4>
        <code>{`احفظ("مفتاح"، قيمة)\nحمّل("مفتاح")`}</code>
      </section>

      <section>
        <h4>الذكاء الاصطناعي 🧠</h4>
        <code>شبكة_عصبية([2، 8، 1])</code>
        <code>{`شبكة_عصبية([2، 8، 1]، ["ريلو"، "سيغمويد"])`}</code>
        <p style={{ fontSize: '0.8em', opacity: 0.7 }}>تنشيطات: سيغمويد، ريلو، ظل_زائدي، سوفت_ماكس، خطّي</p>
        <code>درّب(نموذج، بيانات، 1000)</code>
        <code>تنبأ(نموذج، [1، 0])</code>
        <code>{`احفظ_نموذج(نموذج، "اسمي")\nحمّل_نموذج("اسمي")\nنماذج_محفوظة()`}</code>
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
