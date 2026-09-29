const requestedTheme = new URLSearchParams(window.location.search).get('theme');
let darkThemeEnabled = requestedTheme === 'dark';

if (!requestedTheme) {
    try {
        darkThemeEnabled = localStorage.getItem('darkThemeEnabled') === 'true';
    } catch {
        darkThemeEnabled = false;
    }
}

if (darkThemeEnabled) {
    document.documentElement.classList.add('dark-theme');
}