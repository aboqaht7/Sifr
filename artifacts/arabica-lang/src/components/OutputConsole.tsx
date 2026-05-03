import { useEffect, useRef } from 'react';
import type { OutputLine } from '../lang/interpreter';

interface OutputConsoleProps {
  lines: OutputLine[];
  runTime: number | null;
}

export default function OutputConsole({ lines, runTime }: OutputConsoleProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="console-empty">
        <div className="console-empty-icon">▶</div>
        <p>اضغط تشغيل لرؤية النتائج</p>
        <p className="console-hint">أو استخدم Ctrl + Enter</p>
      </div>
    );
  }

  return (
    <div className="console-output">
      {lines.map((line, i) => (
        <div key={i} className={`console-line console-${line.kind}`} dir="rtl">
          <span className="console-prompt">
            {line.kind === 'error' ? '✗' : line.kind === 'info' ? 'ℹ' : '›'}
          </span>
          <span className="console-text">{line.text}</span>
        </div>
      ))}
      {runTime !== null && (
        <div className="console-timing">
          ⏱ اكتمل في {runTime}ms
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
