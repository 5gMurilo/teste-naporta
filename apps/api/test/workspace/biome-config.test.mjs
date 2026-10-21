import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../../', import.meta.url);
const biome = JSON.parse(await readFile(new URL('biome.json', root), 'utf8'));
const rootPackage = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const apiPackage = JSON.parse(await readFile(new URL('apps/api/package.json', root), 'utf8'));

test('Biome enforces the reviewed LF, quote, indentation, and width policy', () => {
  assert.equal(biome.formatter.lineEnding, 'lf');
  assert.equal(biome.formatter.indentStyle, 'space');
  assert.equal(biome.formatter.indentWidth, 2);
  assert.equal(biome.formatter.lineWidth, 100);
  assert.equal(biome.javascript.formatter.quoteStyle, 'single');
});

test('Biome includes source and tests while excluding only generated outputs', () => {
  const includes = biome.files.includes;
  assert.equal(includes[0], '**');
  assert.equal(
    includes.some((pattern) => pattern.includes('src/**')),
    false,
  );
  assert.equal(
    includes.some((pattern) => pattern.includes('test/**')),
    false,
  );
  for (const output of ['node_modules', 'dist', 'generated', 'coverage', '.turbo']) {
    assert.ok(includes.includes(`!**/${output}/**`), `${output} must be excluded`);
  }
});

test('Biome keeps the reviewed decorator/assist settings without unsafe fixes', () => {
  assert.equal(biome.javascript.parser.unsafeParameterDecoratorsEnabled, true);
  assert.equal(biome.assist.actions.source.organizeImports, 'on');
  assert.equal(biome.linter.rules.style.useImportType, 'off');
  assert.equal(apiPackage.scripts['lint:fix'].includes('--unsafe'), false);
  assert.equal(rootPackage.scripts['lint:fix'].includes('--unsafe'), false);
});
