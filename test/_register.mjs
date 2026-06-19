// Registers the JSON loader for the test run. Used via:
//   node --import ./test/_register.mjs --test
import { register } from 'node:module';
register('./_loader.mjs', import.meta.url);
