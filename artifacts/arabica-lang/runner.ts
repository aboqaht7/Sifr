import { readFileSync } from 'fs';
import { Interpreter } from './src/lang/interpreter';
const code = readFileSync('/tmp/sifr-model-code.sifr', 'utf8');
const interp = new Interpreter();
const out = interp.run(code);
for (const line of out) console.log((line as any).text ?? JSON.stringify(line));
