import { readFileSync } from 'fs';

const content = readFileSync('./hardening/hardening.txt', 'utf-8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
console.log('First 10 lines:', lines.slice(0, 10).join('\n'));
