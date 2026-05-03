import { readFileSync } from 'fs';
import { Interpreter } from './src/lang/interpreter';
const code = readFileSync('/tmp/extracted.sifr', 'utf8');
const interp = new Interpreter();
const out = interp.run(code);
const errs = out.filter((l: any) => l.text && l.text.startsWith('✗'));
console.log('Total lines:', out.length, 'Errors:', errs.length);
if (errs.length) errs.forEach((e: any) => console.log(e.text));
