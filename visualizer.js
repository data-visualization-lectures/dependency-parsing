/**
 * visualizer.js - Dependency Visualization using D3.js
 * Uses D3 hierarchy layout for proper tree visualization
 */

class DependencyVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.width = 0;
        this.height = 0;
        this.minBoxWidth = 80;
        this.maxBoxWidth = 200;
        this.boxHeight = 60;
        this.nodeSpacing = 20;
        this.levelSpacing = 120;
        this.nodeSizes = {}; // Store calculated node sizes
    }

    /**
     * Visualize the parsed dependency structure
     */
    visualize(parseResult) {
        // Clear previous visualization
        this.container.innerHTML = '';
        this.nodeSizes = {}; // Reset node sizes

        const { bunsetsu, dependencies } = parseResult;

        if (!bunsetsu || bunsetsu.length === 0) {
            this.showPlaceholder('解析結果が空です');
            return;
        }

        // Calculate dynamic node sizes based on text length
        this.calculateNodeSizes(bunsetsu);

        // Build hierarchy structure for D3
        const hierarchyData = this.buildHierarchy(bunsetsu, dependencies);

        // Calculate dimensions
        this.calculateDimensions(hierarchyData);

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', 'dependencyGraph')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('xmlns', 'http://www.w3.org/2000/svg');

        // Create main group
        const g = this.svg.append('g')
            .attr('transform', `translate(${this.width / 2}, 50)`);

        // Create D3 tree layout with dynamic node spacing
        const treeLayout = d3.tree()
            .nodeSize([this.maxBoxWidth + this.nodeSpacing, this.levelSpacing])
            .separation((a, b) => {
                // Adjust separation based on actual node widths
                const aWidth = this.nodeSizes[a.data.id] || this.minBoxWidth;
                const bWidth = this.nodeSizes[b.data.id] || this.minBoxWidth;
                return (aWidth + bWidth) / (2 * this.maxBoxWidth) + 0.5;
            });

        // Generate tree
        const root = d3.hierarchy(hierarchyData);
        const treeData = treeLayout(root);

        // Invert Y coordinates (root at bottom)
        const maxDepth = d3.max(treeData.descendants(), d => d.depth);
        treeData.descendants().forEach(d => {
            d.y = (maxDepth - d.depth) * this.levelSpacing;
        });

        // Calculate bounds of all nodes
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        treeData.descendants().forEach(d => {
            const nodeWidth = this.nodeSizes[d.data.id] || this.minBoxWidth;
            minX = Math.min(minX, d.x - nodeWidth / 2);
            maxX = Math.max(maxX, d.x + nodeWidth / 2);
            minY = Math.min(minY, d.y);
            maxY = Math.max(maxY, d.y + this.boxHeight);
        });

        // Calculate translation to center the graph
        const graphWidth = maxX - minX;
        const graphHeight = maxY - minY;
        const padding = 40;

        // Update SVG dimensions if needed
        this.width = Math.max(this.width, graphWidth + 2 * padding);
        this.height = Math.max(this.height, graphHeight + 2 * padding);

        this.svg
            .attr('width', this.width)
            .attr('height', this.height);

        // Center the graph with proper offsets
        const translateX = (this.width - graphWidth) / 2 - minX;
        const translateY = padding - minY;

        g.attr('transform', `translate(${translateX}, ${translateY})`);

        // Draw links (connections) with Bezier curves
        g.selectAll('.link')
            .data(treeData.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => {
                // Get node positions
                const sourceX = d.source.x;
                const sourceY = d.source.y;  // Top of child box
                const targetX = d.target.x;
                const targetY = d.target.y + this.boxHeight;  // Bottom of parent box

                // Calculate control points for Bezier curve
                // Vertical distance between nodes
                const distanceY = Math.abs(targetY - sourceY);
                const controlOffsetY = distanceY * 0.4;

                // Bezier curve: M (start) C (control1) (control2) (end)
                // Create smooth curve that flows upward
                return `M ${sourceX} ${sourceY}
                        C ${sourceX} ${sourceY - controlOffsetY},
                          ${targetX} ${targetY + controlOffsetY},
                          ${targetX} ${targetY}`;
            })
            .attr('fill', 'none')
            .attr('stroke', '#4a90e2')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7);

        // Draw nodes (boxes)
        const nodes = g.selectAll('.node')
            .data(treeData.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Add rectangles with dynamic sizing
        nodes.append('rect')
            .attr('x', d => {
                const width = this.nodeSizes[d.data.id] || this.minBoxWidth;
                return -width / 2;
            })
            .attr('y', 0)
            .attr('width', d => this.nodeSizes[d.data.id] || this.minBoxWidth)
            .attr('height', this.boxHeight)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', '#ffffff')
            .attr('stroke', '#d0d0d0')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', function () {
                d3.select(this)
                    .attr('fill', '#f0f8ff')
                    .attr('stroke', '#2563eb')
                    .attr('stroke-width', 3);
            })
            .on('mouseleave', function () {
                d3.select(this)
                    .attr('fill', '#ffffff')
                    .attr('stroke', '#d0d0d0')
                    .attr('stroke-width', 2);
            })
            .on('click', (_event, d) => {
                this.showBunsetsuDetails(d.data.bunsetsu);
            });

        // Add numbers (top-left)
        nodes.append('text')
            .attr('x', d => {
                const width = this.nodeSizes[d.data.id] || this.minBoxWidth;
                return -width / 2 + 8;
            })
            .attr('y', 20)
            .attr('fill', '#666666')
            .attr('font-size', 12)
            .attr('font-weight', 500)
            .text(d => d.data.id + 1);

        // Add text (centered both horizontally and vertically)
        nodes.append('text')
            .attr('x', 0)
            .attr('y', this.boxHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#333333')
            .attr('font-size', 14)
            .attr('font-weight', 500)
            .text(d => {
                const text = d.data.bunsetsu.surface;
                const width = this.nodeSizes[d.data.id] || this.minBoxWidth;
                const maxChars = Math.floor((width - 20) / 12);
                return text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : text;
            });
    }

    /**
     * Calculate dynamic node sizes based on text length
     */
    calculateNodeSizes(bunsetsu) {
        bunsetsu.forEach((b, i) => {
            // Calculate width based on text length
            // Each character is approximately 12px in font-size 14
            const textLength = b.surface.length;
            const padding = 40;
            let width = Math.ceil(textLength * 14) + padding;
            width = Math.max(this.minBoxWidth, Math.min(width, this.maxBoxWidth));

            this.nodeSizes[i] = width;
        });
    }

    /**
     * Build hierarchy structure from bunsetsu and dependencies
     */
    buildHierarchy(bunsetsu, dependencies) {
        // Create node map
        const nodes = bunsetsu.map((b, i) => ({
            id: i,
            bunsetsu: b,
            children: []
        }));

        // Build parent-child relationships
        dependencies.forEach(dep => {
            nodes[dep.to].children.push(nodes[dep.from]);
        });

        // Find root nodes (nodes with no parent)
        const parentIds = new Set(dependencies.map(d => d.from));
        const roots = nodes.filter((n, i) => !parentIds.has(i));

        // If multiple roots, create a virtual root
        if (roots.length > 1) {
            return {
                id: -1,
                bunsetsu: { surface: 'ROOT' },
                children: roots
            };
        } else if (roots.length === 1) {
            return roots[0];
        } else {
            // No roots found, use first node
            return nodes[0];
        }
    }

    /**
     * Calculate SVG dimensions
     */
    calculateDimensions(hierarchyData) {
        const root = d3.hierarchy(hierarchyData);
        const leafCount = root.leaves().length;
        const depth = root.height;

        // Use maxBoxWidth for dimension calculation
        this.width = Math.max(1000, leafCount * (this.maxBoxWidth + this.nodeSpacing) + 200);
        this.height = Math.max(500, (depth + 1) * this.levelSpacing + 200);
    }

    /**
     * Show detailed information about a bunsetsu
     */
    showBunsetsuDetails(bunsetsu) {
        const infoPanel = document.getElementById('infoPanel');
        const infoContent = document.getElementById('infoContent');

        let html = `<div class="info-item"><span class="info-label">文節:</span><span class="info-value">${bunsetsu.surface}</span></div>`;
        html += `<div class="info-item"><span class="info-label">主辞:</span><span class="info-value">${bunsetsu.head.surface_form} (${bunsetsu.head.pos})</span></div>`;
        html += `<div class="info-item"><span class="info-label">形態素:</span></div>`;

        bunsetsu.tokens.forEach(token => {
            html += `<div class="info-item" style="margin-left: 1rem;">`;
            html += `<span class="info-value">${token.surface_form}</span> `;
            html += `<span class="info-label">[${token.pos}]</span>`;
            if (token.basic_form !== token.surface_form) {
                html += ` <span class="info-label">基本形: ${token.basic_form}</span>`;
            }
            html += `</div>`;
        });

        infoContent.innerHTML = html;
        infoPanel.style.display = 'block';
    }

    /**
     * Show placeholder message
     */
    showPlaceholder(message) {
        this.container.innerHTML = `
            <div class="placeholder">
                <div class="placeholder-icon">⚠️</div>
                <p class="placeholder-text">${message}</p>
            </div>
        `;
    }

    /**
     * Export visualization as SVG
     */
    exportSVG() {
        const svgElement = this.container.querySelector('svg');
        if (!svgElement) return;

        const svgString = svgElement.outerHTML;
        const fullSvg = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

        const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'dependency-tree.svg';
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Export visualization as PNG
     */
    exportPNG() {
        const svgElement = this.container.querySelector('svg');
        if (!svgElement) return;

        const svgString = svgElement.outerHTML;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = this.width;
        canvas.height = this.height;

        img.onload = () => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'dependency-tree.png';
                link.click();
                URL.revokeObjectURL(url);
            });
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
    }
}

// Create a global instance
const visualizer = new DependencyVisualizer('visualizationContainer');
