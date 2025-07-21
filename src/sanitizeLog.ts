export function sanitizeLog(log: string): string {
    // Get user and home info
    const username = process.env.USERNAME || process.env.USER || '';
    const home = process.env.HOME || process.env.USERPROFILE || '';
    let sanitized = log;

    // Step 1: Aggressively sanitize 'Checking file decoration for:' lines
    sanitized = sanitized.replace(/^([\w\s\[\]:-]+)?(Checking file decoration for: )(.*)$/gmi, (match, logLevel, prefix, path) => {
        return `${logLevel || ''}${prefix}<fsPath>`;
    });

    // Replace home directory
    if (home) {
        const homeRegex = new RegExp(home.replace(/\\/g, '\\\\'), 'gi');
        sanitized = sanitized.replace(homeRegex, '<home>');
    }
    // Replace username in paths
    if (username) {
        const userRegex = new RegExp(username, 'gi');
        sanitized = sanitized.replace(userRegex, '<user>');
    }
    // Mask email addresses
    sanitized = sanitized.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<email>');

    return sanitized;
}
