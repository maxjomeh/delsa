import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../components/DevOSBacklog.css',import.meta.url),'utf8');
const tokens=['--bg','--panel','--panel2','--ink','--line','--muted'];
test('DevOS uses the site design system tokens, not unrelated shadcn defaults',()=>{
  for(const token of tokens)assert.ok(css.includes('var('+token+')'),token+' is absent');
  assert.doesNotMatch(css,/var\(--(?:background|card|foreground|muted-foreground|border)\b/);
});
test('all task fields adapt to the site theme, including native dropdown options',()=>{
  assert.match(css,/html\[data-theme="dark"\] \.dev-root \.devos-root\{color-scheme:dark\}/);
  assert.match(css,/\.dev-root \.devos-root :is\(input,select,textarea\)\s*\{/);
  assert.match(css,/\.dev-root \.devos-root select option\s*\{/);
  assert.match(css,/background-color:var\(--bg\)/);
  assert.match(css,/color:var\(--ink\)/);
});
test('dark browser-autofilled fields inherit dark surface and legible text',()=>{
  assert.match(css,/html\[data-theme="dark"\].*:is\(input,textarea\):-webkit-autofill/);
  assert.match(css,/-webkit-text-fill-color:var\(--ink\)/);
  assert.match(css,/-webkit-box-shadow:0 0 0 1000px var\(--bg\) inset/);
});
