import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Force-exit plugin — guarantees the `vite build` process terminates after
 * the bundle is written. We hit a Vercel hang where the build would complete
 * the asset emit but never let the CI step exit (likely a lingering handle
 * inside one of the rollup/rolldown workers). Calling process.exit(0) from
 * the closeBundle hook is a hard guarantee that the build step finishes.
 *
 * Only fires for `vite build`, not `vite dev` or `vite preview`, because the
 * other commands are long-running by design.
 */
function forceExitAfterBuild() {
  return {
    name: 'force-exit-after-build',
    apply: 'build',
    closeBundle() {
      // Allow any pending stdout writes (build summary, etc) to flush, then exit.
      setTimeout(() => process.exit(0), 50);
    },
  };
}

export default defineConfig({
  plugins: [forceExitAfterBuild()],
  build: {
    rollupOptions: {
      input: {
        main:  resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
