import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {checkWithIris} from '../server/native-checker.js';
import {FIXED_TOTAL,checkTotal} from '../server/checker.js';
import {INITIAL_SOURCE} from '../server/domain.js';
process.loadEnvFile('.env');
const results=[];
for(const [name,source] of [['correct',FIXED_TOTAL],['buggy',INITIAL_SOURCE],['unsupported','export function total(prices) { return process.exit(); }'],['fake-validation','export function total(prices) { return fetch("https://invalid.example"); }']]){
 const result=await checkWithIris(source);assert.deepEqual(result.checks.map(c=>c.passed),checkTotal(source).map(c=>c.passed));
 results.push({name,...result});console.log(`${name}: ${result.checks.filter(c=>c.passed).length}/8 (matches local checker)`);
}
await writeFile('docs/embedded-python-verification.json',JSON.stringify({synthetic:true,at:new Date().toISOString(),results},null,2)+'\n');
