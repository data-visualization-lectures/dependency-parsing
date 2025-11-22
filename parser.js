/**
 * parser.js - Japanese Dependency Parser
 * Uses kuromoji.js for morphological analysis and rule-based dependency estimation
 */

class DependencyParser {
    constructor() {
        this.tokenizer = null;
        this.initialized = false;
    }

    /**
     * Initialize the kuromoji tokenizer
     */
    async initialize() {
        if (this.initialized) return;

        return new Promise((resolve, reject) => {
            kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict" }).build((err, tokenizer) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.tokenizer = tokenizer;
                this.initialized = true;
                resolve();
            });
        });
    }

    /**
     * Parse text and extract dependency structure
     * @param {string} text - Input Japanese text
     * @returns {Object} Parsed result with bunsetsu and dependencies
     */
    parse(text) {
        if (!this.initialized || !this.tokenizer) {
            throw new Error('Parser not initialized');
        }

        // Tokenize the text
        const tokens = this.tokenizer.tokenize(text);

        // Group tokens into bunsetsu (phrases)
        const bunsetsuList = this.groupIntoBunsetsu(tokens);

        // Estimate dependencies between bunsetsu
        const dependencies = this.estimateDependencies(bunsetsuList);

        return {
            bunsetsu: bunsetsuList,
            dependencies: dependencies,
            tokens: tokens
        };
    }

    /**
     * Group morphemes into bunsetsu (文節)
     * A bunsetsu typically consists of content words followed by function words
     */
    groupIntoBunsetsu(tokens) {
        const bunsetsuList = [];
        let currentBunsetsu = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            currentBunsetsu.push(token);

            // Check if this is the end of a bunsetsu
            // End conditions:
            // 1. Next token is a content word (noun, verb, adjective, etc.)
            // 2. Current token is a punctuation
            // 3. This is the last token

            const isLastToken = i === tokens.length - 1;
            const isPunctuation = token.pos === '記号';

            let shouldEndBunsetsu = isLastToken || isPunctuation;

            if (!shouldEndBunsetsu && i < tokens.length - 1) {
                const nextToken = tokens[i + 1];
                const currentIsFunction = this.isFunctionWord(token);
                const nextIsContent = this.isContentWord(nextToken);

                // End bunsetsu if current is function word and next is content word
                shouldEndBunsetsu = currentIsFunction && nextIsContent;
            }

            if (shouldEndBunsetsu && currentBunsetsu.length > 0) {
                bunsetsuList.push({
                    id: bunsetsuList.length,
                    tokens: currentBunsetsu,
                    surface: currentBunsetsu.map(t => t.surface_form).join(''),
                    head: this.findHead(currentBunsetsu)
                });
                currentBunsetsu = [];
            }
        }

        return bunsetsuList;
    }

    /**
     * Check if a token is a content word
     */
    isContentWord(token) {
        const contentPOS = ['名詞', '動詞', '形容詞', '副詞', '連体詞', '感動詞'];
        return contentPOS.includes(token.pos);
    }

    /**
     * Check if a token is a function word
     */
    isFunctionWord(token) {
        const functionPOS = ['助詞', '助動詞', '接続詞'];
        return functionPOS.includes(token.pos);
    }

    /**
     * Find the head (main) token in a bunsetsu
     */
    findHead(tokens) {
        // Priority: 動詞 > 形容詞 > 名詞 > その他
        const priorities = {
            '動詞': 3,
            '形容詞': 2,
            '名詞': 1
        };

        let head = tokens[0];
        let maxPriority = priorities[head.pos] || 0;

        for (const token of tokens) {
            const priority = priorities[token.pos] || 0;
            if (priority > maxPriority) {
                head = token;
                maxPriority = priority;
            }
        }

        return head;
    }

    /**
     * Estimate dependency relationships between bunsetsu
     * Improved rule-based approach for Japanese dependency parsing
     */
    estimateDependencies(bunsetsuList) {
        const dependencies = [];

        for (let i = 0; i < bunsetsuList.length - 1; i++) {
            const source = bunsetsuList[i];
            let targetIndex = this.findDependencyTarget(source, i, bunsetsuList);

            dependencies.push({
                from: i,
                to: targetIndex,
                label: this.getDependencyLabel(source, bunsetsuList[targetIndex])
            });
        }

        return dependencies;
    }

    /**
     * Find the dependency target for a bunsetsu using improved heuristics
     */
    findDependencyTarget(source, sourceIndex, bunsetsuList) {
        const lastToken = source.tokens[source.tokens.length - 1];
        const sourceHead = source.head;

        // Rule 1: Check for clause-ending patterns (て、で、が、etc.)
        // These often connect to distant predicates
        if (this.isClauseConnector(lastToken)) {
            return this.findNextPredicate(sourceIndex, bunsetsuList);
        }

        // Rule 2: Case particles (格助詞) typically attach to the nearest verb
        if (lastToken.pos === '助詞') {
            const particle = lastToken.surface_form;

            // Subject/object markers look for verbs
            if (['は', 'が', 'を', 'に', 'へ', 'で', 'から', 'まで', 'より', 'と'].includes(particle)) {
                return this.findNextVerb(sourceIndex, bunsetsuList);
            }

            // の (possessive/modification) attaches to the next noun
            if (particle === 'の') {
                return this.findNextNoun(sourceIndex, bunsetsuList);
            }
        }

        // Rule 3: Adverbs and adnominals modify the next predicate/noun
        if (sourceHead.pos === '副詞') {
            return this.findNextPredicate(sourceIndex, bunsetsuList);
        }

        if (sourceHead.pos === '連体詞') {
            return this.findNextNoun(sourceIndex, bunsetsuList);
        }

        // Rule 4: Nouns without particles typically modify the next element
        if (sourceHead.pos === '名詞' && lastToken.pos !== '助詞') {
            // Look for the next noun or verb
            for (let j = sourceIndex + 1; j < bunsetsuList.length; j++) {
                const candidate = bunsetsuList[j];
                if (candidate.head.pos === '名詞' || candidate.head.pos === '動詞') {
                    return j;
                }
            }
        }

        // Rule 5: Verbs in non-final form (連用形、連体形) modify the next element
        if (sourceHead.pos === '動詞') {
            const conjugation = sourceHead.pos_detail_1;
            if (conjugation !== '自立' || lastToken.surface_form.match(/[てでたりながら]/)) {
                return this.findNextPredicate(sourceIndex, bunsetsuList);
            }
        }

        // Default: attach to the next bunsetsu
        return sourceIndex + 1;
    }

    /**
     * Check if a token is a clause connector
     */
    isClauseConnector(token) {
        if (token.pos === '助詞') {
            return ['て', 'で', 'ば', 'と', 'ても', 'でも', 'から', 'ので', 'のに', 'けど', 'が'].includes(token.surface_form);
        }
        if (token.pos === '助動詞') {
            return ['た', 'だ', 'です', 'ます'].includes(token.basic_form);
        }
        return false;
    }

    /**
     * Find the next verb bunsetsu
     */
    findNextVerb(fromIndex, bunsetsuList) {
        for (let j = fromIndex + 1; j < bunsetsuList.length; j++) {
            if (bunsetsuList[j].head.pos === '動詞') {
                return j;
            }
        }
        // If no verb found, attach to the last bunsetsu (usually the main predicate)
        return bunsetsuList.length - 1;
    }

    /**
     * Find the next noun bunsetsu
     */
    findNextNoun(fromIndex, bunsetsuList) {
        for (let j = fromIndex + 1; j < bunsetsuList.length; j++) {
            if (bunsetsuList[j].head.pos === '名詞') {
                return j;
            }
        }
        // Default to next bunsetsu
        return fromIndex + 1;
    }

    /**
     * Find the next predicate (verb or adjective) bunsetsu
     */
    findNextPredicate(fromIndex, bunsetsuList) {
        for (let j = fromIndex + 1; j < bunsetsuList.length; j++) {
            const head = bunsetsuList[j].head;
            if (head.pos === '動詞' || head.pos === '形容詞') {
                return j;
            }
        }
        // If no predicate found, attach to the last bunsetsu
        return bunsetsuList.length - 1;
    }

    /**
     * Get a label for the dependency relationship
     */
    getDependencyLabel(source, target) {
        const lastToken = source.tokens[source.tokens.length - 1];

        if (lastToken.pos === '助詞') {
            return lastToken.surface_form;
        }

        return '';
    }
}

// Create a global instance
const parser = new DependencyParser();
