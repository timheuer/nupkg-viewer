const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Plugin to copy Codicon assets to media directory
 * @type {import('esbuild').Plugin}
 */
const copyCodiconAssetsPlugin = {
  name: 'copy-codicon-assets',
  setup(build) {
    build.onStart(() => {
      // Ensure media/codicons directory exists
      const codiconsDir = path.join(__dirname, 'media', 'codicons');
      if (!fs.existsSync(codiconsDir)) {
        fs.mkdirSync(codiconsDir, { recursive: true });
      }

      // Copy codicon.ttf from node_modules (we inline the CSS)
      const sourceDir = path.join(__dirname, 'node_modules', '@vscode', 'codicons', 'dist');
      const filesToCopy = ['codicon.ttf'];
      
      filesToCopy.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(codiconsDir, file);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`[codicons] Copied ${file} to media/codicons/`);
        }
      });
    });
  },
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      /* add to the end of plugins array       copyCodiconAssetsPlugin,*/
      esbuildProblemMatcherPlugin,
    ],
    // Define NODE_ENV for production builds
    define: {
      'process.env.NODE_ENV': production ? '"production"' : '"development"'
    },
    // Handle node modules properly for VS Code extension context
    mainFields: ['module', 'main'],
    conditions: ['node'],
    // Enable tree shaking
    treeShaking: true,
    // Bundle all dependencies except vscode
    packages: 'bundle',
    // Resolve node modules
    resolveExtensions: ['.ts', '.js', '.json'],
  });
  
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
