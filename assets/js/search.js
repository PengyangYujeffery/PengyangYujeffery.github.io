(function() {
  const results = document.getElementById('searchResults');
  if (!results) return;

  const input = document.getElementById('siteSearchInput');
  const searchShell = document.querySelector('.site-search');
  const searchToggle = document.getElementById('searchToggle');
  const items = [
    {
      category: { en: 'Research', zh: '研究' },
      title: { en: 'Interactive Research Map', zh: '交互式研究地图' },
      excerpt: { en: 'Explore the connections between medical AI, reliability, fairness, clinical deployment, and current projects.', zh: '探索医学 AI、可靠性、公平性、临床部署和当前研究项目之间的联系。' },
      keywords: 'medical ai reliability fairness deployment HD-Cal MedLiteNet dual fairness',
      href: 'research.html#research-map-section'
    },
    {
      category: { en: 'Research', zh: '研究' },
      title: { en: 'Reliable and Fair Medical AI Across Clinical Settings', zh: '不同临床场景下可靠与公平的医学人工智能' },
      excerpt: { en: 'Research on auditing, monitoring, and responsibly deploying medical foundation models.', zh: '关于医学基础模型审计、监测和负责任部署的研究。' },
      keywords: 'medical foundation models clinical shift calibration monitoring',
      href: 'research.html'
    },
    {
      category: { en: 'Publication', zh: '论文' },
      title: { en: 'Fairness in federated medical imaging: a systematic review through the dual fairness lens', zh: '联邦医学影像中的公平性：双重公平视角下的系统综述' },
      excerpt: { en: 'Published in Artificial Intelligence Review on 2026-07-05.', zh: '发表于 Artificial Intelligence Review，发表日期为 2026-07-05。' },
      keywords: 'fairness federated imaging dual fairness DOI 10.1007/s10462-026-11632-4',
      href: 'publications.html#published-work'
    },
    {
      category: { en: 'Publication', zh: '论文' },
      title: { en: 'MedLiteNet: Lightweight Hybrid Medical Image Segmentation Model for the Medical Internet of Things (MIoT)', zh: 'MedLiteNet：面向医疗物联网的轻量化混合医学图像分割模型' },
      excerpt: { en: 'Published on 2025-12-25 in IEEE Journal of Selected Areas in Sensors.', zh: '于 2025-12-25 发表于 IEEE Journal of Selected Areas in Sensors。' },
      keywords: 'MedLiteNet segmentation medical image IoT DOI 10.1109/JSAS.2025.3648685',
      href: 'publications.html#published-work'
    },
    {
      category: { en: 'Current work', zh: '当前研究' },
      title: { en: 'HD-Cal', zh: 'HD-Cal' },
      excerpt: { en: 'Few-shot reliability estimation for cross-domain hallucination heterogeneity in chest X-ray vision-language models.', zh: '面向胸部 X 光视觉语言模型跨域幻觉异质性的少样本可靠性估计。' },
      keywords: 'HD-Cal chest X-ray vision language hallucination reliability',
      href: 'publications.html#current-work'
    },
    {
      category: { en: 'Teaching', zh: '教学' },
      title: { en: 'COMP47780 · Cloud Computing', zh: 'COMP47780 · 云计算' },
      excerpt: { en: 'Demonstrator at University College Dublin, 2025 Autumn.', zh: '都柏林大学 Demonstrator，2025 秋季学期。' },
      keywords: 'teaching demonstrator cloud computing undergraduate postgraduate',
      href: 'teaching.html#teaching-experience'
    },
    {
      category: { en: 'Teaching', zh: '教学' },
      title: { en: 'COMP20180 · Intro to Operating Systems', zh: 'COMP20180 · 操作系统导论' },
      excerpt: { en: 'Demonstrator at University College Dublin, 2026 Spring.', zh: '都柏林大学 Demonstrator，2026 春季学期。' },
      keywords: 'teaching demonstrator operating systems undergraduate postgraduate',
      href: 'teaching.html#teaching-experience'
    }
  ];

  function language() {
    return document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render() {
    const currentLanguage = language();
    const query = new URLSearchParams(window.location.search).get('q')?.trim() || '';
    if (input) input.value = query;
    if (query && searchShell && searchToggle) {
      searchShell.classList.add('is-open');
      searchToggle.setAttribute('aria-expanded', 'true');
    }

    if (!query) {
      results.innerHTML = '<div class="search-empty"><h3>' + (currentLanguage === 'zh' ? '开始搜索' : 'Start searching') + '</h3><p>' + (currentLanguage === 'zh' ? '点击右上角的放大镜，输入关键词。' : 'Use the magnifying-glass icon in the top navigation to search by keyword.') + '</p></div>';
      return;
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const matches = items.filter(function(item) {
      const haystack = [item.title.en, item.title.zh, item.excerpt.en, item.excerpt.zh, item.keywords].join(' ').toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });

    if (!matches.length) {
      results.innerHTML = '<div class="search-empty"><h3>' + (currentLanguage === 'zh' ? '没有找到结果' : 'No results found') + '</h3><p>' + escapeHtml(query) + '</p></div>';
      return;
    }

    results.innerHTML = '<p class="search-count">' + (currentLanguage === 'zh' ? '找到 ' + matches.length + ' 条结果' : matches.length + ' result' + (matches.length === 1 ? '' : 's') + ' found') + '</p>' + matches.map(function(item) {
      return '<article class="search-result"><p class="search-result-category">' + escapeHtml(item.category[currentLanguage]) + '</p><h3><a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.title[currentLanguage]) + '</a></h3><p>' + escapeHtml(item.excerpt[currentLanguage]) + '</p></article>';
    }).join('');
  }

  document.addEventListener('site:languagechange', render);
  render();
})();
