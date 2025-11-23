#!/usr/bin/env node

/**
 * Build script to minify and bundle files to docs folder
 */

const fs = require('fs');
const path = require('path');
const terser = require('terser');
const CleanCSS = require('clean-css');

const SOURCE_DIR = __dirname;
const DOCS_DIR = path.join(__dirname, 'docs');

// Create docs directory if it doesn't exist
if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log('✓ Created docs directory');
}

// 1. Copy and minify HTML (update script/css references to minified versions)
const htmlPath = path.join(SOURCE_DIR, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Update script references to minified versions
htmlContent = htmlContent
    .replace(/src="app\.js"/g, 'src="app.min.js"')
    .replace(/src="parser\.js"/g, 'src="parser.min.js"')
    .replace(/src="visualizer\.js"/g, 'src="visualizer.min.js"');

// Update CSS reference to minified version
htmlContent = htmlContent
    .replace(/href="styles\.css"/g, 'href="styles.min.css"');

// Minify HTML (preserve script and style content)
const minifiedHtml = htmlContent
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/\n\s+/g, '\n')  // Remove excess whitespace
    .replace(/\>\s+\</g, '><'); // Remove whitespace between tags

fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), minifiedHtml);
console.log('✓ HTML minified and copied (with updated script references)');

// 2. Minify JavaScript files
const jsFiles = ['app.js', 'parser.js', 'visualizer.js'];

jsFiles.forEach(file => {
    const inputPath = path.join(SOURCE_DIR, file);
    const outputPath = path.join(DOCS_DIR, `${path.basename(file, '.js')}.min.js`);

    const code = fs.readFileSync(inputPath, 'utf8');

    terser.minify(code).then(result => {
        if (result.error) {
            console.error(`Error minifying ${file}:`, result.error);
        } else {
            fs.writeFileSync(outputPath, result.code);
            console.log(`✓ ${file} minified → ${path.basename(outputPath)}`);
        }
    });
});

// 3. Minify CSS
const cssPath = path.join(SOURCE_DIR, 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const output = new CleanCSS().minify(cssContent);
if (output.errors.length > 0) {
    console.error('Error minifying CSS:', output.errors);
} else {
    fs.writeFileSync(path.join(DOCS_DIR, 'styles.min.css'), output.styles);
    console.log('✓ CSS minified → styles.min.css');
}

// 4. Copy kuromoji dictionary
const dictSource = path.join(SOURCE_DIR, 'node_modules/kuromoji/dict');
const dictDest = path.join(DOCS_DIR, 'dict');
if (fs.existsSync(dictSource)) {
    fs.cpSync(dictSource, dictDest, { recursive: true, force: true });
    console.log('✓ kuromoji dictionary copied');
}

// 4b. Copy cytoscape-dagre library
const cytoscapeDagreSource = path.join(SOURCE_DIR, 'node_modules/cytoscape-dagre/cytoscape-dagre.js');
const cytoscapeDagreDest = path.join(DOCS_DIR, 'cytoscape-dagre.min.js');
if (fs.existsSync(cytoscapeDagreSource)) {
    fs.copyFileSync(cytoscapeDagreSource, cytoscapeDagreDest);
    console.log('✓ cytoscape-dagre library copied');
}

// 5. Copy additional files (SVG dependencies)
const copyFiles = ['package.json'];
copyFiles.forEach(file => {
    const inputPath = path.join(SOURCE_DIR, file);
    if (fs.existsSync(inputPath)) {
        const outputPath = path.join(DOCS_DIR, file);
        fs.copyFileSync(inputPath, outputPath);
        console.log(`✓ ${file} copied`);
    }
});

// 6. Create .nojekyll file to disable Jekyll processing on GitHub Pages
fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');
console.log('✓ .nojekyll created (GitHub Pages Jekyll disabled)');

console.log('\n✅ Build complete! Files generated in ./docs directory');
console.log('\nGenerated files:');
console.log('  - index.html (minified)');
console.log('  - app.min.js');
console.log('  - parser.min.js');
console.log('  - visualizer.min.js');
console.log('  - styles.min.css');
console.log('  - package.json');
console.log('  - dict/ (kuromoji dictionary)');
console.log('  - .nojekyll (GitHub Pages configuration)');
