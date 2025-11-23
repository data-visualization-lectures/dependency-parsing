/**
 * visualizer.js - Dependency Visualization using D3.js and Cytoscape.js
 * Uses D3 hierarchy layout for tree visualization and Cytoscape dagre for network graphs
 */

class DependencyVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.cy = null; // Cytoscape instance
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
    visualize(parseResult, chartTypeParam = 'tree') {
        // Clear previous visualization
        this.container.innerHTML = '';
        this.nodeSizes = {}; // Reset node sizes

        const { bunsetsu, dependencies } = parseResult;

        if (!bunsetsu || bunsetsu.length === 0) {
            this.showPlaceholder('解析結果が空です');
            return;
        }

        // Store data for use in visualization methods
        this.currentBunsetsu = bunsetsu;
        this.currentDependencies = dependencies;

        // Call appropriate visualization method based on chart type
        switch (chartTypeParam) {
            case 'tree':
                this.visualizeTree(bunsetsu, dependencies);
                break;
            case 'force':
                this.visualizeForce(bunsetsu, dependencies);
                break;
            case 'cytoscape':
                this.visualizeCytoscape(bunsetsu, dependencies);
                break;
            default:
                this.visualizeTree(bunsetsu, dependencies);
        }
    }

    /**
     * Visualize as tree diagram (current implementation)
     */
    visualizeTree(bunsetsu, dependencies) {
        // Calculate dynamic node sizes based on text length
        this.calculateNodeSizes(bunsetsu);

        // Build hierarchy structure for D3
        const hierarchyData = this.buildHierarchy(bunsetsu, dependencies);

        // Calculate dimensions
        this.calculateDimensions(hierarchyData);

        // Constrain width to container width for responsiveness
        const containerWidth = this.container.clientWidth - 40; // Account for padding
        const maxAllowedWidth = containerWidth;
        this.width = Math.min(maxAllowedWidth, this.width);
        this.maxAllowedWidth = maxAllowedWidth; // Store for later use

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', 'dependencyGraph')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .style('display', 'block')
            .style('margin', '0 auto')
            .style('overflow', 'visible');

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

        // Calculate scale factor to fit within container
        let scaleX = 1;
        let scaleY = 1;
        const svgWidth = graphWidth + 2 * padding;
        const svgHeight = graphHeight + 2 * padding;

        // If graph is too wide, scale it down
        if (svgWidth > this.maxAllowedWidth) {
            scaleX = this.maxAllowedWidth / svgWidth;
            scaleY = scaleX; // Maintain aspect ratio
        }

        // Update SVG dimensions (use actual calculated size or max allowed)
        const finalWidth = Math.min(this.maxAllowedWidth, svgWidth);
        const finalHeight = svgHeight * scaleY;

        this.svg
            .attr('width', finalWidth)
            .attr('height', finalHeight);

        // Center the graph with proper offsets
        const translateX = (finalWidth - (graphWidth * scaleX)) / 2 - (minX * scaleX);
        const translateY = (padding - minY) * scaleY;

        g.attr('transform', `translate(${translateX}, ${translateY}) scale(${scaleX})`);

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
        // Check if Cytoscape is active
        if (this.cy) {
            // Cytoscape doesn't support SVG export directly (canvas-based)
            // Convert to PNG instead
            const pngData = this.cy.png({ full: true, bg: '#ffffff' });

            // Create SVG wrapper with embedded PNG
            const width = this.cy.extent().w;
            const height = this.cy.extent().h;

            const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#ffffff"/>
    <image xlink:href="${pngData}" width="${width}" height="${height}"/>
</svg>`;

            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = 'dependency-tree.svg';
            link.click();

            URL.revokeObjectURL(url);
            return;
        }

        // Export D3 SVG
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
        // Check if Cytoscape is active
        if (this.cy) {
            // Export Cytoscape as PNG
            const pngData = this.cy.png({ full: true, bg: '#ffffff' });
            const link = document.createElement('a');
            link.href = pngData;
            link.download = 'dependency-tree.png';
            link.click();
            return;
        }

        // Export D3 SVG to PNG
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

    /**
     * Visualize as force graph
     */
    visualizeForce(bunsetsu, dependencies) {
        // Prepare data for force simulation with fixed node sizing
        const nodeRadius = 25;
        const nodes = bunsetsu.map((b, i) => ({
            id: i,
            bunsetsu: b,
            surface: b.surface,
            radius: nodeRadius
        }));

        const links = dependencies.map(dep => ({
            source: dep.from,
            target: dep.to,
            label: dep.label
        }));

        // Set SVG dimensions (responsive to container width)
        const containerWidth = this.container.clientWidth - 40; // Account for padding
        this.width = Math.min(containerWidth, 1200); // Constrain to container width
        this.height = Math.max(600, window.innerHeight - 400);

        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', 'dependencyGraph')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('xmlns', 'http://www.w3.org/2000/svg')
            .style('display', 'block')
            .style('margin', '0 auto');

        // Create main group
        const g = this.svg.append('g');

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(100)
                .strength(0.5))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collide', d3.forceCollide().radius(nodeRadius + 5));

        // Create links (edges)
        const link = g.selectAll('.link')
            .data(links)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', '#4a90e2')
            .attr('stroke-width', 2)
            .attr('opacity', 0.6)
            .attr('marker-end', 'url(#arrowhead)');

        // Create arrow marker for directed edges
        this.svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('markerWidth', 10)
            .attr('markerHeight', 10)
            .attr('refX', 25)
            .attr('refY', 3)
            .attr('orient', 'auto')
            .append('polygon')
            .attr('points', '0 0, 10 3, 0 6')
            .attr('fill', '#4a90e2');

        // Create nodes (circles)
        const node = g.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        // Add circles with fixed sizing
        node.append('circle')
            .attr('r', nodeRadius)
            .attr('fill', '#ffffff')
            .attr('stroke', '#4a90e2')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', function (event, d) {
                // Highlight this node and connected nodes
                d3.select(this)
                    .attr('r', nodeRadius * 1.2)
                    .attr('fill', '#f0f8ff')
                    .attr('stroke-width', 3);

                // Highlight connected links
                link.style('opacity', linkDatum => {
                    return (linkDatum.source.id === d.id || linkDatum.target.id === d.id) ? 1 : 0.2;
                });

                // Dim other nodes
                node.selectAll('circle').style('opacity', nodeDatum => {
                    return (nodeDatum.id === d.id ||
                            links.some(l => (l.source.id === d.id && l.target.id === nodeDatum.id) ||
                                            (l.target.id === d.id && l.source.id === nodeDatum.id)))
                        ? 1 : 0.4;
                });
            })
            .on('mouseleave', function () {
                d3.select(this)
                    .attr('r', nodeRadius)
                    .attr('fill', '#ffffff')
                    .attr('stroke-width', 2)
                    .style('opacity', 1);

                link.style('opacity', 0.6);
            })
            .on('click', (_event, d) => {
                this.showBunsetsuDetails(d.bunsetsu);
            });

        // Add text labels below nodes (not inside circles)
        node.append('text')
            .attr('x', 0)
            .attr('y', nodeRadius + 20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#333333')
            .attr('font-size', 11)
            .attr('font-weight', 500)
            .text(d => d.surface)
            .style('pointer-events', 'none')
            .style('user-select', 'none');

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    }

    /**
     * Visualize as Cytoscape network graph
     */
    visualizeCytoscape(bunsetsu, dependencies) {

        // Set container dimensions
        const containerWidth = this.container.clientWidth - 40;
        const containerHeight = Math.max(600, window.innerHeight - 400);

        // Create container div for Cytoscape
        const cytoscapeContainer = document.createElement('div');
        cytoscapeContainer.id = 'cytoscape-container';
        cytoscapeContainer.style.width = containerWidth + 'px';
        cytoscapeContainer.style.height = containerHeight + 'px';
        cytoscapeContainer.style.margin = '0 auto';
        this.container.appendChild(cytoscapeContainer);

        // Prepare nodes and edges for Cytoscape
        const nodes = bunsetsu.map((b, i) => ({
            data: {
                id: `node-${i}`,
                label: b.surface
            }
        }));

        const edges = dependencies.map((dep, i) => ({
            data: {
                id: `edge-${i}`,
                source: `node-${dep.from}`,
                target: `node-${dep.to}`,
                label: dep.label
            }
        }));

        // Initialize Cytoscape
        this.cy = window.cytoscape({
            container: cytoscapeContainer,
            elements: nodes.concat(edges),
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#11479e',
                        'content': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'font-size': 12,
                        'font-weight': 500,
                        'padding': '8px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 4,
                        'target-arrow-shape': 'triangle',
                        'line-color': '#9dbaea',
                        'target-arrow-color': '#9dbaea',
                        'curve-style': 'bezier'
                    }
                }
            ],
            wheelSensitivity: 0.1
        });

        // Apply dagre layout
        this.cy.layout({
            name: 'dagre',
            directed: true,
            rankDir: 'TB',
            animate: false,
            spacingFactor: 1.2
        }).run();

        // Add click handler for node details
        this.cy.on('tap', 'node', (event) => {
            const nodeId = parseInt(event.target.id().split('-')[1]);
            this.showBunsetsuDetails(bunsetsu[nodeId]);
        });

        // Fit graph to view
        this.cy.fit();
    }
}

// Create a global instance
const visualizer = new DependencyVisualizer('visualizationContainer');
