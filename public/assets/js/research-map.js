(function() {
  const root = document.getElementById('researchMap');
  if (!root) return;

  const details = document.getElementById('researchMapDetails');
  const resetButton = document.getElementById('researchMapReset');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let graph;
  let svg;
  let width = 720;
  let height = 500;
  let animationFrame;
  let draggingNode = null;
  let activeNode;
  let simulationAlpha = 1;

  function currentLanguage() {
    return document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
  }

  function labelFor(item) {
    return item && item[currentLanguage()] ? item[currentLanguage()] : item.en;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(svgNamespace, name);
    Object.keys(attributes || {}).forEach(function(key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function setInitialPositions() {
    const layout = {
      'dual-fairness': [0.16, 0.16],
      'federated-imaging': [0.16, 0.66],
      'fairness': [0.38, 0.30],
      'medical-ai': [0.49, 0.52],
      'deployment': [0.72, 0.28],
      'reliability': [0.70, 0.54],
      'vision-language': [0.62, 0.74],
      'chest-xray': [0.87, 0.59],
      'hd-cal': [0.86, 0.77],
      'medlitenet': [0.22, 0.78]
    };

    graph.nodes.forEach(function(node, index) {
      const position = layout[node.id] || [0.5, 0.5];
      node.x = Math.max(30, Math.min(width - 30, width * position[0]));
      node.y = Math.max(30, Math.min(height - 30, height * position[1]));
      node.vx = 0;
      node.vy = 0;
      node.phase = index * 0.83;
    });
    simulationAlpha = 1;
  }

  function nodeRadius(node) {
    if (node.group === 'core') return 22;
    if (node.group === 'work') return 15;
    if (node.group === 'method') return 12;
    return 17;
  }

  function connectedIds(nodeId) {
    const ids = new Set([nodeId]);
    graph.links.forEach(function(link) {
      if (link.source === nodeId) ids.add(link.target);
      if (link.target === nodeId) ids.add(link.source);
    });
    return ids;
  }

  function highlightNode(nodeId) {
    const activeIds = nodeId ? connectedIds(nodeId) : null;
    graph.nodeElements.forEach(function(item) {
      item.group.classList.toggle('is-dim', Boolean(activeIds && !activeIds.has(item.node.id)));
    });
    graph.linkElements.forEach(function(item) {
      const isActive = Boolean(activeIds && (activeIds.has(item.link.source) && activeIds.has(item.link.target)));
      item.line.classList.toggle('is-active', isActive);
    });
  }

  function renderDetails(node) {
    if (!details || !node) return;
    activeNode = node;
    const language = currentLanguage();
    const links = (node.links || []).map(function(link) {
      const target = link.external ? ' target="_blank" rel="noopener"' : '';
      return '<a class="research-map-detail-link" href="' + escapeHtml(link.href) + '"' + target + '>' + escapeHtml(labelFor(link.label)) + '</a>';
    }).join('');
    const kicker = language === 'zh' ? '选中节点' : 'Selected node';
    details.innerHTML = '<p class="research-map-detail-kicker">' + kicker + '</p>' +
      '<h3>' + escapeHtml(labelFor(node.label)) + '</h3>' +
      '<p>' + escapeHtml(labelFor(node.description)) + '</p>' +
      (links ? '<div class="research-map-detail-links">' + links + '</div>' : '');
  }

  function selectNode(node) {
    renderDetails(node);
    graph.nodeElements.forEach(function(item) {
      item.group.classList.toggle('is-selected', item.node.id === node.id);
    });
    highlightNode(node.id);
  }

  function updateLabels() {
    if (!graph) return;
    graph.nodeElements.forEach(function(item) {
      item.text.textContent = labelFor(item.node.label);
      item.group.setAttribute('aria-label', labelFor(item.node.label));
    });
    renderDetails(activeNode || graph.nodes[0]);
  }

  function pointerPosition(event) {
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(18, Math.min(width - 18, (event.clientX - rect.left) * width / rect.width)),
      y: Math.max(18, Math.min(height - 18, (event.clientY - rect.top) * height / rect.height))
    };
  }

  function finishDrag(event) {
    if (!draggingNode) return;
    if (event && event.pointerId !== undefined && svg.releasePointerCapture) {
      try { svg.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    }
    draggingNode = null;
  }

  function addInteractions(item) {
    const node = item.node;
    item.group.addEventListener('pointerdown', function(event) {
      selectNode(node);
      draggingNode = node;
      simulationAlpha = Math.max(simulationAlpha, 0.2);
      node.vx = 0;
      node.vy = 0;
      if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    item.group.addEventListener('click', function() { selectNode(node); });
    item.group.addEventListener('mouseenter', function() { highlightNode(node.id); });
    item.group.addEventListener('mouseleave', function() { highlightNode(activeNode ? activeNode.id : null); });
    item.group.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectNode(node);
      }
    });
  }

  function updatePositions(timestamp) {
    const nodes = graph.nodes;
    const links = graph.links;
    const alpha = Math.max(0.02, simulationAlpha);
    const now = timestamp || Date.now();
    nodes.forEach(function(node) {
      node.vx += (width / 2 - node.x) * 0.00035 * alpha;
      node.vy += (height / 2 - node.y) * 0.00035 * alpha;
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const first = nodes[i];
        const second = nodes[j];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        const distanceSquared = dx * dx + dy * dy || 1;
        const distance = Math.sqrt(distanceSquared);
        const force = Math.min(0.7, 1800 / distanceSquared) * alpha;
        dx /= distance;
        dy /= distance;
        first.vx -= dx * force;
        first.vy -= dy * force;
        second.vx += dx * force;
        second.vy += dy * force;
      }
    }

    links.forEach(function(link) {
      const source = graph.nodeById[link.source];
      const target = graph.nodeById[link.target];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (distance - 130) * 0.0025 * alpha;
      source.vx += dx / distance * force;
      source.vy += dy / distance * force;
      target.vx -= dx / distance * force;
      target.vy -= dy / distance * force;
    });

    nodes.forEach(function(node) {
      if (node !== draggingNode) {
        const damping = simulationAlpha > 0.04 ? 0.88 : 0.985;
        node.vx *= damping;
        node.vy *= damping;
        node.x = Math.max(28, Math.min(width - 28, node.x + node.vx));
        node.y = Math.max(28, Math.min(height - 28, node.y + node.vy));
      }
    });

    simulationAlpha *= 0.985;
    const idleMotion = Math.min(1, (1 - simulationAlpha) / 0.86);
    const seconds = now * 0.00045;
    const renderPositions = {};
    nodes.forEach(function(node) {
      const driftX = draggingNode === node ? 0 : Math.sin(seconds + node.phase) * 1.8 * idleMotion;
      const driftY = draggingNode === node ? 0 : Math.cos(seconds * 0.9 + node.phase) * 1.2 * idleMotion;
      renderPositions[node.id] = { x: node.x + driftX, y: node.y + driftY };
    });

    graph.linkElements.forEach(function(item) {
      const source = renderPositions[item.link.source];
      const target = renderPositions[item.link.target];
      item.line.setAttribute('x1', source.x);
      item.line.setAttribute('y1', source.y);
      item.line.setAttribute('x2', target.x);
      item.line.setAttribute('y2', target.y);
    });
    graph.nodeElements.forEach(function(item) {
      const node = item.node;
      const position = renderPositions[node.id];
      item.group.setAttribute('transform', 'translate(' + position.x + ' ' + position.y + ')');
    });

    if (!reduceMotion) animationFrame = window.requestAnimationFrame(updatePositions);
  }

  function resize() {
    if (!graph || !svg) return;
    width = Math.max(300, root.clientWidth || 720);
    height = width < 560 ? 390 : 500;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    setInitialPositions();
    updatePositions(Date.now());
  }

  function render(data) {
    graph = {
      nodes: data.nodes.map(function(node) { return Object.assign({}, node); }),
      links: data.links.map(function(link) { return Object.assign({}, link); }),
      nodeById: {},
      nodeElements: [],
      linkElements: []
    };
    graph.nodes.forEach(function(node) { graph.nodeById[node.id] = node; });
    root.innerHTML = '';
    svg = createSvgElement('svg', { class: 'research-map-svg', role: 'img', 'aria-label': 'Interactive research map' });
    root.appendChild(svg);
    const linkLayer = createSvgElement('g', { class: 'research-map-links' });
    const nodeLayer = createSvgElement('g', { class: 'research-map-nodes' });
    svg.appendChild(linkLayer);
    svg.appendChild(nodeLayer);

    graph.links.forEach(function(link) {
      const line = createSvgElement('line', { class: 'research-map-link' });
      linkLayer.appendChild(line);
      graph.linkElements.push({ link: link, line: line });
    });

    graph.nodes.forEach(function(node) {
      const group = createSvgElement('g', {
        class: 'research-map-node ' + node.group,
        tabindex: '0',
        role: 'button',
        'aria-label': labelFor(node.label)
      });
      const circle = createSvgElement('circle', { r: nodeRadius(node) });
      const text = createSvgElement('text', { y: nodeRadius(node) + 17, 'text-anchor': 'middle' });
      text.textContent = labelFor(node.label);
      group.appendChild(circle);
      group.appendChild(text);
      nodeLayer.appendChild(group);
      const item = { node: node, group: group, text: text };
      graph.nodeElements.push(item);
      addInteractions(item);
    });

    svg.addEventListener('pointermove', function(event) {
      if (!draggingNode) return;
      const position = pointerPosition(event);
      draggingNode.x = position.x;
      draggingNode.y = position.y;
      draggingNode.vx = 0;
      draggingNode.vy = 0;
    });
    svg.addEventListener('pointerup', finishDrag);
    svg.addEventListener('pointercancel', finishDrag);
    setInitialPositions();
    updatePositions(Date.now());
    selectNode(graph.nodes[0]);
  }

  fetch('assets/data/research-map.json')
    .then(function(response) {
      if (!response.ok) throw new Error('Research map data could not be loaded.');
      return response.json();
    })
    .then(function(data) {
      render(data);
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(resize);
        observer.observe(root);
      } else {
        window.addEventListener('resize', resize);
      }
      document.addEventListener('site:languagechange', updateLabels);
      if (resetButton) resetButton.addEventListener('click', function() {
        setInitialPositions();
        updatePositions(Date.now());
        selectNode(graph.nodes[0]);
      });
    })
    .catch(function(error) {
      root.innerHTML = '<p class="research-map-error">' + escapeHtml(error.message) + '</p>';
      if (details) details.innerHTML = '<p class="research-map-error">Research map unavailable.</p>';
    });
})();
