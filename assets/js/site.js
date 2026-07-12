(function() {
  const themeToggle = document.getElementById('themeToggle');
  const languageToggle = document.getElementById('languageToggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
  const description = document.querySelector('meta[name="description"]');
  const searchShell = document.querySelector('.site-search');
  const searchToggle = document.getElementById('searchToggle');
  const searchForm = document.getElementById('siteSearchForm');
  const searchInput = document.getElementById('siteSearchInput');

  function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (themeIcon) {
      themeIcon.classList.toggle('fa-sun', isDark);
      themeIcon.classList.toggle('fa-moon', !isDark);
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  function setLanguage(language) {
    document.querySelectorAll('[data-i18n]').forEach(function(element) {
      const value = element.dataset[language];
      if (value !== undefined) {
        element.textContent = value;
      }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function(element) {
      const value = element.dataset[language];
      if (value !== undefined) {
        element.innerHTML = value;
      }
    });

    const isChinese = language === 'zh';
    const root = document.documentElement;
    root.lang = isChinese ? 'zh-CN' : 'en';
    document.title = isChinese ? root.dataset.titleZh : root.dataset.titleEn;

    if (description) {
      description.setAttribute('content', isChinese ? root.dataset.descriptionZh : root.dataset.descriptionEn);
    }

    if (languageToggle) {
      languageToggle.textContent = isChinese ? 'EN' : '中';
      languageToggle.setAttribute('aria-label', isChinese ? 'Switch to English' : '切换到中文');
      languageToggle.setAttribute('title', isChinese ? 'Switch to English' : '切换到中文');
    }

    if (searchInput) {
      searchInput.placeholder = isChinese ? searchInput.dataset.placeholderZh : searchInput.dataset.placeholderEn;
      searchInput.setAttribute('aria-label', isChinese ? '搜索' : 'Search');
    }

    localStorage.setItem('language', language);
    document.dispatchEvent(new CustomEvent('site:languagechange', { detail: { language: language } }));
  }

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

  const savedLanguage = localStorage.getItem('language');
  setLanguage(savedLanguage === 'zh' ? 'zh' : 'en');

  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(!isDark);
    });
  }

  if (languageToggle) {
    languageToggle.addEventListener('click', function() {
      const currentLanguage = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
      setLanguage(currentLanguage === 'en' ? 'zh' : 'en');
    });
  }

  function setSearchOpen(isOpen) {
    if (!searchShell || !searchToggle) return;
    searchShell.classList.toggle('is-open', isOpen);
    searchToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen && searchInput) {
      window.setTimeout(function() { searchInput.focus(); }, 0);
    }
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', function() {
      setSearchOpen(!searchShell.classList.contains('is-open'));
    });
  }

  function submitSearch() {
    if (!searchForm || !searchInput) return;
    const query = searchInput.value.trim();
    const destination = searchForm.getAttribute('action') || 'search.html';
    window.location.href = query ? destination + '?q=' + encodeURIComponent(query) : destination;
  }

  if (searchForm) {
    searchForm.addEventListener('submit', function(event) {
      event.preventDefault();
      submitSearch();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitSearch();
      }
    });
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') setSearchOpen(false);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.section').forEach(function(element) {
      observer.observe(element);
    });
  } else {
    document.querySelectorAll('.section').forEach(function(element) {
      element.classList.add('visible');
    });
  }
})();
