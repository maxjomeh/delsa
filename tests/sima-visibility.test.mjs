import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reveal=readFileSync('components/ScrollReveal.js','utf8');
const dashboard=readFileSync('components/CustomerDashboard.js','utf8');
const customerCss=readFileSync('components/customer-dashboard.css','utf8');

test('long authenticated CRM sections are never enrolled in landing-page scroll reveal',()=>{
 assert.match(reveal,/if \(pathname !== '\/'\) return;/);
 assert.match(reveal,/node\.closest\('\.customer-shell, \.panel-shell, \[data-app-workspace\]'\)/);
 assert.match(reveal,/root\.classList\.remove\('scroll-reveal-enabled'\)/);
 assert.match(reveal,/observer\.disconnect\(\)/);
});

test('marketing reveal does not require 12 percent of an arbitrarily long section to intersect',()=>{
 assert.match(reveal,/threshold:\s*0\b/);
 assert.doesNotMatch(reveal,/threshold:\s*0\.12\b/);
});

test('SIMA workbench is independent of historical 1160px width cap',()=>{
 assert.match(dashboard,/customer-main customer-main--crm/);
 assert.match(customerCss,/\.customer-main--crm\s*\{[^}]*width:\s*100%/s);
 assert.match(customerCss,/\.customer-main--crm\s*\{[^}]*max-width:\s*none/s);
 assert.match(customerCss,/html\.scroll-reveal-enabled \.customer-shell > \.customer-content/);
});
