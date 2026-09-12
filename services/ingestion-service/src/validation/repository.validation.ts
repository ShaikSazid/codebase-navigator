export function isValidGitHubRepositoryUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        if(parsedUrl.protocol !== "https:") {
            return false;
        }
        if(parsedUrl.hostname !== "github.com") {
            return false;
        }
        const parts = parsedUrl.pathname.replace(/^\/|\/$/g, "").split("/");
        if(parts.length !== 2) {
            return false;
        }
        const [owner, repository] = parts;
        if(!owner || !repository) {
            return false;
        }
        return true
    } catch {
        return false;
    }
}