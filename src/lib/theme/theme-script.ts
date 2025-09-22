// This script prevents theme flash on initial load
export const themeInitScript = `
  (function() {
    // Default to 'dark' on first visit
    const theme = localStorage.getItem('moshimoshi-theme') || 'dark';
    let resolvedTheme = theme;

    if (theme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.classList.add(resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  })();
`;