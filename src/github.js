import { safeUrl } from "./model.js";

const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const API = "https://api.github.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export class GithubError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = code === "ABORTED" ? "AbortError" : "GithubError";
    this.code = code;
    Object.assign(this, details);
  }
}

function checkAbort(signal) {
  if (signal?.aborted)
    throw new GithubError("ABORTED", "GitHub import was cancelled.");
}

function retryTime(headers) {
  const now = Date.now();
  const after = headers?.get?.("retry-after");
  let seconds = null;
  if (after !== null && after !== undefined) {
    if (/^\d+$/.test(after.trim())) seconds = Number(after);
    else {
      const date = Date.parse(after);
      if (Number.isFinite(date))
        seconds = Math.max(0, Math.ceil((date - now) / 1000));
    }
  }
  if (seconds === null) {
    const reset = Number(headers?.get?.("x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0)
      seconds = Math.max(0, Math.ceil((reset * 1000 - now) / 1000));
  }
  seconds = seconds === null ? 60 : Math.min(seconds, 7 * 24 * 60 * 60);
  return { retryAfterSeconds: seconds, retryAt: now + seconds * 1000 };
}

async function request(path, { signal, fetchImpl }) {
  checkAbort(signal);
  let response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      signal,
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError")
      throw new GithubError("ABORTED", "GitHub import was cancelled.");
    throw new GithubError(
      "NETWORK",
      "Could not reach GitHub. Check your connection and try again.",
    );
  }
  checkAbort(signal);
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError")
      throw new GithubError("ABORTED", "GitHub import was cancelled.");
    if (response.ok)
      throw new GithubError(
        "INVALID_RESPONSE",
        "GitHub returned an unreadable response. Please try again.",
        { status: response.status },
      );
    data = {};
  }
  checkAbort(signal);
  if (!response.ok) {
    const limited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers?.get?.("x-ratelimit-remaining") === "0" ||
          response.headers?.get?.("retry-after") != null ||
          /rate.?limit|abuse/i.test(
            typeof data?.message === "string" ? data.message : "",
          )));
    if (limited) {
      const retry = retryTime(response.headers);
      const minutes = Math.max(1, Math.ceil(retry.retryAfterSeconds / 60));
      throw new GithubError(
        "RATE_LIMIT",
        `GitHub's public request limit was reached. Try again in about ${minutes} ${minutes === 1 ? "minute" : "minutes"}. No token is needed.`,
        { status: response.status, ...retry },
      );
    }
    if (response.status === 404)
      throw new GithubError(
        "NOT_FOUND",
        "That GitHub account could not be found. Check the username and try again.",
        { status: 404 },
      );
    if (response.status >= 500)
      throw new GithubError(
        "UNAVAILABLE",
        "GitHub is temporarily unavailable. Please try again later.",
        { status: response.status },
      );
    throw new GithubError(
      "REQUEST_FAILED",
      "GitHub could not complete this request. Please try again.",
      { status: response.status },
    );
  }
  return { data, headers: response.headers };
}

export async function fetchGithubProfile(
  username,
  { signal, fetchImpl = globalThis.fetch } = {},
) {
  if (typeof username !== "string" || !USERNAME.test(username.trim())) {
    throw new GithubError(
      "INVALID_USERNAME",
      "Enter a GitHub username using 1–39 letters, numbers, and single hyphens.",
    );
  }
  if (typeof fetchImpl !== "function")
    throw new GithubError(
      "NETWORK",
      "This browser does not support GitHub import. You can add projects manually.",
    );
  const requested = username.trim();
  const profile = await request(`/users/${encodeURIComponent(requested)}`, {
    signal,
    fetchImpl,
  });
  const user = profile.data;
  if (
    !user ||
    Array.isArray(user) ||
    typeof user !== "object" ||
    typeof user.login !== "string" ||
    !USERNAME.test(user.login)
  ) {
    throw new GithubError(
      "INVALID_RESPONSE",
      "GitHub returned an invalid profile. Please try again.",
    );
  }
  const repositories = [];
  const seen = new Set();
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await request(
      `/users/${encodeURIComponent(user.login)}/repos?type=owner&sort=updated&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
      { signal, fetchImpl },
    );
    if (!Array.isArray(response.data))
      throw new GithubError(
        "INVALID_RESPONSE",
        "GitHub returned an invalid project list. Please try again.",
      );
    for (const repo of response.data) {
      if (
        !repo ||
        typeof repo !== "object" ||
        Array.isArray(repo) ||
        typeof repo.name !== "string"
      ) {
        throw new GithubError(
          "INVALID_RESPONSE",
          "GitHub returned an incomplete project. Please try again.",
        );
      }
      if (repo.private === true) continue;
      const key = repo.id ?? repo.full_name ?? repo.name;
      if (!seen.has(key)) {
        repositories.push(repo);
        seen.add(key);
      }
    }
    const link = response.headers?.get?.("link") ?? "";
    const hasNext =
      /<[^>]+>\s*;\s*rel="next"/i.test(link) ||
      (!link && response.data.length === PAGE_SIZE);
    if (!hasNext) break;
    if (page === MAX_PAGES) truncated = true;
  }
  return { user, repositories, truncated };
}

export function repositoryToProject(repo) {
  if (
    !repo ||
    typeof repo !== "object" ||
    Array.isArray(repo) ||
    typeof repo.name !== "string" ||
    !repo.name.trim()
  ) {
    throw new GithubError(
      "INVALID_REPOSITORY",
      "Choose a valid public GitHub repository.",
    );
  }
  if (repo.private === true)
    throw new GithubError(
      "PRIVATE_REPOSITORY",
      "Only public GitHub repositories can be imported.",
    );
  const cleanText = (value, limit) =>
    typeof value === "string" ? value.trim().slice(0, limit) : "";
  const topics = Array.isArray(repo.topics)
    ? repo.topics
        .filter((topic) => typeof topic === "string")
        .map((topic) => cleanText(topic, 32))
        .filter(Boolean)
    : [];
  const language = cleanText(repo.language, 32);
  const tags = [...new Set([...topics, ...(language ? [language] : [])])].slice(
    0,
    8,
  );
  const id =
    typeof repo.id === "number" && Number.isSafeInteger(repo.id) && repo.id > 0
      ? `github-${repo.id}`
      : `github-${repo.name.replace(/[^a-z\d_-]/gi, "-").slice(0, 80)}`;
  // The homepage is a candidate for review, never proof of an online demo.
  return {
    id,
    title: cleanText(repo.name, 120),
    category: language ? `${language} project` : "Open-source project",
    description: cleanText(repo.description, 1200),
    challenge: "",
    solution: "",
    outcome: "",
    url: safeUrl(repo.homepage),
    source: safeUrl(repo.html_url),
    image: "",
    tags,
    featured: true,
  };
}
