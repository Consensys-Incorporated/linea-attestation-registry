import { describe, expect, it } from "vitest";

import { isValidGithubRepositoryUrl } from "./repoUrl.ts";

describe("isValidGithubRepositoryUrl", () => {
  it.each([
    "https://github.com/owner/repo",
    "https://github.com/Owner.Name/repo-name_1",
    "https://github.com/owner/repo/",
    "https://github.com/owner/repo.git",
    "https://github.com/owner/repo.git/",
  ])("accepts a canonical repository URL: %s", (value) => {
    expect(isValidGithubRepositoryUrl(value)).toBe(true);
  });

  it.each([
    "http://github.com/owner/repo",
    "https://github.com/owner/repo?tab=readme",
    "https://github.com/owner/repo#readme",
    "https://user:password@github.com/owner/repo",
    "https://github.com.evil.example/owner/repo",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner%2Frepo",
    "https://github.com//repo",
    "https://github.com/owner/",
    "https://github.com/owner/repo ",
    " https://github.com/owner/repo",
    "https://github.com/../repo",
  ])("rejects a non-repository URL: %s", (value) => {
    expect(isValidGithubRepositoryUrl(value)).toBe(false);
  });
});
