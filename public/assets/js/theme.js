/*
 * Light/dark theme. Loaded in <head> so the theme is set before the page is drawn.
 *
 * Dark from 19:00 to 06:00, light otherwise. Pressing the toggle overrides the
 * schedule until its next switch (06:00 or 19:00); the choice is kept across
 * pages, reloads and tabs, and the schedule takes over again after that.
 */
(function() {
  const root = document.documentElement;
  const storageKey = 'themeOverride';
  const darkFrom = 19;
  const darkUntil = 6;
  let memoryOverride = null;
  let storageWritable = true;

  function isNight(date) {
    const hour = date.getHours();
    return hour >= darkFrom || hour < darkUntil;
  }

  function nextSwitch(date) {
    const next = new Date(date);
    const hour = date.getHours();
    if (hour < darkUntil) {
      next.setHours(darkUntil, 0, 0, 0);
    } else if (hour < darkFrom) {
      next.setHours(darkFrom, 0, 0, 0);
    } else {
      next.setDate(next.getDate() + 1);
      next.setHours(darkUntil, 0, 0, 0);
    }
    return next;
  }

  function readOverride() {
    let saved = memoryOverride;
    if (storageWritable) {
      try {
        saved = JSON.parse(localStorage.getItem(storageKey));
      } catch (error) {
        saved = memoryOverride;
      }
    }
    if (saved && (saved.theme === 'dark' || saved.theme === 'light') && Date.now() < saved.until) {
      return saved.theme;
    }
    return null;
  }

  function writeOverride(theme) {
    memoryOverride = theme ? { theme: theme, until: nextSwitch(new Date()).getTime() } : null;
    try {
      if (memoryOverride) {
        localStorage.setItem(storageKey, JSON.stringify(memoryOverride));
      } else {
        localStorage.removeItem(storageKey);
      }
      storageWritable = true;
    } catch (error) {
      storageWritable = false; // e.g. storage blocked: the choice lasts for this page only
    }
  }

  function scheduledTheme() {
    return isNight(new Date()) ? 'dark' : 'light';
  }

  function applyTheme() {
    root.setAttribute('data-theme', readOverride() || scheduledTheme());
  }

  function scheduleNextSwitch() {
    const now = new Date();
    window.setTimeout(function() {
      applyTheme();
      scheduleNextSwitch();
    }, Math.max(1000, nextSwitch(now).getTime() - now.getTime() + 100));
  }

  applyTheme();
  scheduleNextSwitch();

  window.addEventListener('focus', applyTheme);
  window.addEventListener('storage', function(event) {
    if (event.key === storageKey) applyTheme();
  });
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) applyTheme();
  });

  document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.addEventListener('click', function() {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      writeOverride(next === scheduledTheme() ? null : next);
      root.setAttribute('data-theme', next);
    });
  });
})();
