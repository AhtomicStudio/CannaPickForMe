// Test-only module loader: lets bare `import x from './x.json'` resolve under
// `node --test`. Node 22 otherwise requires an import attribute (`with { type:
// 'json' }`), but the app's source uses the bare form (Vite handles it). We turn
// any .json import into a tiny ES module exporting the parsed data as default.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const json = readFileSync(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${json};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
