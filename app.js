/**
 * app.js - Main Application Logic
 * Handles user interactions and coordinates parser and visualizer
 */

// DOM Elements
const inputText = document.getElementById('inputText');
const analyzeBtn = document.getElementById('analyzeBtn');
const sampleBtn = document.getElementById('sampleBtn');
const clearBtn = document.getElementById('clearBtn');
const exportSvgBtn = document.getElementById('exportSvgBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const exportGexfBtn = document.getElementById('exportGexfBtn');
const exportButtons = document.getElementById('exportButtons');
const chartSelector = document.getElementById('chartSelector');
const chartType = document.getElementById('chartType');
const loadingOverlay = document.getElementById('loadingOverlay');
const infoPanel = document.getElementById('infoPanel');

// Sample sentences
const sampleSentences = [
    '今日もまたまた出場情報です。それもそのはずギリギリになりましたから、急遽失礼します。本日日本テレビさんにて「なんでそんなこと言ったの？TV」に出場しています💁🏼🎶 こちらは、過去をわざわざ遡りなぜ人はあんなことを言ったのかを聞くというそれなりに題名そのままな番組です。私は全体的に端っこのほうで、MC軍団に聞かれたら答える、聞かれたら答えるの繰り返しで、こんな感じに目のやられる蛍光色たぶらかして座っています。是非、胸のザワザワ感が好きな方は見ていたら楽しいと思うので見てください。待っています。',
    '太郎は花子にプレゼントをあげた。',
    '私は昨日、図書館で面白い本を読んだ。',
    '彼女は美しい花を庭に植えた。',
    '先生が生徒に宿題を出した。',
    '猫が窓の外を静かに見ている。',
    '友達と一緒に映画を見に行った。'
];

// Application state
let currentParseResult = null;

/**
 * Initialize the application
 */
async function initializeApp() {
    showLoading(true);

    try {
        // Initialize the parser (load kuromoji dictionary)
        await parser.initialize();
        console.log('Parser initialized successfully');

        // Set up event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Failed to initialize parser:', error);
        alert('パーサーの初期化に失敗しました。ページを再読み込みしてください。');
    } finally {
        showLoading(false);
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Analyze button
    analyzeBtn.addEventListener('click', handleAnalyze);

    // Sample button
    sampleBtn.addEventListener('click', handleSample);

    // Clear button
    clearBtn.addEventListener('click', handleClear);

    // Export buttons
    exportSvgBtn.addEventListener('click', () => visualizer.exportSVG());
    exportPngBtn.addEventListener('click', () => visualizer.exportPNG());
    exportDataBtn.addEventListener('click', handleDownloadData);
    exportGexfBtn.addEventListener('click', handleDownloadGexf);

    // Enter key in textarea
    inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleAnalyze();
        }
    });

    // Chart type selector
    chartType.addEventListener('change', handleChartTypeChange);
}

/**
 * Handle analyze button click
 */
async function handleAnalyze() {
    const text = inputText.value.trim();

    if (!text) {
        alert('テキストを入力してください。');
        return;
    }

    showLoading(true);
    infoPanel.style.display = 'none';

    try {
        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Parse the text
        currentParseResult = parser.parse(text);
        console.log('Parse result:', currentParseResult);

        // Visualize the result with current chart type
        visualizer.visualize(currentParseResult, chartType.value);

        // Show export buttons and chart selector
        exportButtons.style.display = 'flex';
        chartSelector.style.display = 'flex';

    } catch (error) {
        console.error('Analysis failed:', error);
        alert('解析に失敗しました: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Handle sample button click
 */
function handleSample() {
    const randomSentence = sampleSentences[Math.floor(Math.random() * sampleSentences.length)];
    inputText.value = randomSentence;
    inputText.focus();
}

/**
 * Handle clear button click
 */
function handleClear() {
    inputText.value = '';
    inputText.focus();
}

/**
 * Handle chart type change
 */
function handleChartTypeChange() {
    if (!currentParseResult) return;

    // Visualize with selected chart type
    visualizer.visualize(currentParseResult, chartType.value);
}

/**
 * Handle data download button click
 */
function handleDownloadData() {
    if (!currentParseResult) {
        alert('ダウンロードするデータがありません。');
        return;
    }

    // Create JSON data
    const jsonData = JSON.stringify(currentParseResult, null, 2);

    // Create blob and download
    const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'dependency-parsing-data.json';
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Handle GEXF download button click
 */
function handleDownloadGexf() {
    if (!currentParseResult) {
        alert('ダウンロードするデータがありません。');
        return;
    }

    const { bunsetsu, dependencies } = currentParseResult;

    // Create GEXF XML structure
    let gexfXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gexfXml += '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n';
    gexfXml += '  <graph mode="static" defaultedgetype="directed">\n';

    // Add nodes
    gexfXml += '    <nodes>\n';
    bunsetsu.forEach((b, i) => {
        // Escape XML special characters
        const label = escapeXml(b.surface);
        gexfXml += `      <node id="${i}" label="${label}"/>\n`;
    });
    gexfXml += '    </nodes>\n';

    // Add edges
    gexfXml += '    <edges>\n';
    dependencies.forEach((dep, i) => {
        const label = escapeXml(dep.label);
        gexfXml += `      <edge id="${i}" source="${dep.from}" target="${dep.to}" label="${label}"/>\n`;
    });
    gexfXml += '    </edges>\n';

    gexfXml += '  </graph>\n';
    gexfXml += '</gexf>';

    // Create blob and download
    const blob = new Blob([gexfXml], { type: 'application/gexf+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'dependency-parsing-data.gexf';
    link.click();

    URL.revokeObjectURL(url);
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.getElementById('visualizationContainer');
    container.innerHTML = `
        <div class="placeholder">
            <div class="placeholder-icon">❌</div>
            <p class="placeholder-text">エラー</p>
            <p class="placeholder-subtext">${message}</p>
        </div>
    `;
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
