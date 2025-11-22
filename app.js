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
const exportButtons = document.getElementById('exportButtons');
const loadingOverlay = document.getElementById('loadingOverlay');
const infoPanel = document.getElementById('infoPanel');

// Sample sentences
const sampleSentences = [
    '太郎は花子にプレゼントをあげた。',
    '私は昨日、図書館で面白い本を読んだ。',
    '彼女は美しい花を庭に植えた。',
    '先生が生徒に宿題を出した。',
    '猫が窓の外を静かに見ている。',
    '友達と一緒に映画を見に行った。',
    '母は毎朝、新鮮な野菜を市場で買う。'
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

    // Enter key in textarea
    inputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleAnalyze();
        }
    });
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

        // Visualize the result
        visualizer.visualize(currentParseResult);

        // Show export buttons
        exportButtons.style.display = 'flex';

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
