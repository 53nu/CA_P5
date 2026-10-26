import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { yearSeconds, ratesAt, integratedCounts } from '../clock.js';

const { years } = JSON.parse(await readFile(new URL('../demography.json',import.meta.url)));
const start = Date.UTC(2026,9,24);

test('2026 rates use the verified annual UN projections', () => {
  const rates = ratesAt(start, years);
  assert.equal(rates.sourceYear, 2026);
  assert.equal(rates.births, 132503470/31536000);
  assert.equal(rates.deaths, 63637310/31536000);
  assert.deepEqual(integratedCounts(start,start+1000,years),{births:4,deaths:2});
  assert.deepEqual(integratedCounts(start,start+60000,years),{births:252,deaths:121});
});

test('counts are independent of rendering frequency and hidden-tab duration', () => {
  const end = start+86400000;
  const oneStep = integratedCounts(start,end,years);
  for(let t=start;t<end;t+=56789) integratedCounts(start,t,years);
  assert.deepEqual(integratedCounts(start,end,years),oneStep);
  assert.equal(oneStep.births,Math.floor(years['2026'].births/365));
  assert.deepEqual(integratedCounts(start,start-100,years),{births:0,deaths:0});
});

test('year rollover switches the annual projection without resetting counts', () => {
  const newYear = Date.UTC(2027,0,1);
  const expectedBirths = Math.floor((ratesAt(newYear-1000,years).births+ratesAt(newYear,years).births)*10);
  const expectedDeaths = Math.floor((ratesAt(newYear-1000,years).deaths+ratesAt(newYear,years).deaths)*10);
  assert.deepEqual(integratedCounts(newYear-10000,newYear+10000,years),{births:expectedBirths,deaths:expectedDeaths});
});

test('leap years have the correct duration and full-year counts', () => {
  assert.equal(yearSeconds(2028),31622400);
  assert.deepEqual(integratedCounts(Date.UTC(2028,0,1),Date.UTC(2029,0,1),years),years['2028']);
});
