// This script prevents theme flash on initial load
export const themeInitScript = `
  (function() {
    // Default to 'dark' on first visit
    const theme = localStorage.getItem('moshimoshi-theme') || 'dark';
    let resolvedTheme = theme;

    if (theme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme class and color scheme to html
    document.documentElement.classList.add(resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;

    // Set background color on html immediately to prevent white flash
    // These values must match globals.css theme colors
    const bgColor = resolvedTheme === 'dark' ? '#1a202c' : '#eef6fd';
    document.documentElement.style.backgroundColor = bgColor;
  })();
`
