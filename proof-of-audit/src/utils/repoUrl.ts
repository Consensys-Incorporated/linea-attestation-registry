const GITHUB_REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]+$/;

/**
 * Accept canonical HTTPS GitHub repository URLs only. A single trailing slash
 * and a case-insensitive `.git` suffix are accepted but preserved as entered;
 * credentials, query strings, fragments, extra path segments, and whitespace
 * are rejected. No network request is made for the supplied URL.
 */
export const isValidGithubRepositoryUrl = (value: string): boolean => {
  if (!value || value !== value.trim()) return false;
  const rawUrl = value.match(/^https:\/\/github\.com(\/[^?#]*)$/i);
  if (!rawUrl) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== rawUrl[1] ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return false;
  }

  const path = url.pathname.replace(/\/$/, "").replace(/\.git$/i, "");
  const segments = path.slice(1).split("/");
  return segments.length === 2 && segments.every((segment) => GITHUB_REPOSITORY_SEGMENT.test(segment));
};
