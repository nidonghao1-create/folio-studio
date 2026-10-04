import test from "node:test";
import assert from "node:assert/strict";
import { fetchGithubProfile, repositoryToProject } from "../src/github.js";
import { normalizePortfolio } from "../src/model.js";

const profile = {
  login: "real-owner",
  id: 7,
  name: "Real Creator",
  public_repos: 0,
};
const repo = (id) => ({
  id,
  name: `work-${id}`,
  full_name: `real-owner/work-${id}`,
  private: false,
  html_url: `https://github.com/real-owner/work-${id}`,
  homepage: "",
  description: "",
  language: null,
  topics: [],
});
const response = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.ok(responses.length, "no unexpected extra API request");
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetchImpl, calls };
}

test("invalid usernames fail before sending a request", async () => {
  let calls = 0;
  for (const name of [
    "",
    "-bad",
    "bad-",
    "bad--name",
    "a".repeat(40),
    "https://github.com/person",
    "../secret",
    "name?token=secret",
    null,
  ]) {
    await assert.rejects(
      fetchGithubProfile(name, {
        fetchImpl: () => {
          calls++;
        },
      }),
      { code: "INVALID_USERNAME" },
    );
  }
  assert.equal(calls, 0);
});

test("real zero repositories is a success with an empty list and no fabricated metadata", async () => {
  const mock = mockFetch([response(profile), response([])]);
  const result = await fetchGithubProfile(" real-owner ", mock);
  assert.deepEqual(result, {
    user: profile,
    repositories: [],
    truncated: false,
  });
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[0].url, "https://api.github.com/users/real-owner");
  assert.match(mock.calls[1].url, /type=owner.*per_page=100&page=1$/);
  assert.equal(mock.calls[0].options.credentials, "omit");
  assert.equal(
    Object.hasOwn(mock.calls[0].options.headers, "Authorization"),
    false,
  );
});

test("pagination uses public owner repositories and preserves API order without duplicates", async () => {
  const first = Array.from({ length: 100 }, (_, i) => repo(i + 1));
  const mock = mockFetch([
    response(profile),
    response(first, 200, {
      link: '<https://api.github.com/users/real-owner/repos?page=2>; rel="next"',
    }),
    response([repo(100), repo(101), { ...repo(102), private: true }]),
  ]);
  const result = await fetchGithubProfile("real-owner", mock);
  assert.equal(result.repositories.length, 101);
  assert.equal(result.repositories.at(-1).id, 101);
  assert.equal(result.truncated, false);
  assert.match(mock.calls.at(-1).url, /page=2$/);
});

test("server pagination links cannot redirect an import to an arbitrary host", async () => {
  const mock = mockFetch([
    response(profile),
    response([repo(1)], 200, {
      link: '<https://evil.test/secret>; rel="next"',
    }),
    response([]),
  ]);
  await fetchGithubProfile("real-owner", mock);
  assert.ok(
    mock.calls.every(({ url }) =>
      url.startsWith("https://api.github.com/users/real-owner"),
    ),
  );
});

test("the ten-page cap is explicit and does not claim an incomplete import is complete", async () => {
  const responses = [response(profile)];
  for (let page = 1; page <= 10; page++)
    responses.push(
      response(
        Array.from({ length: 100 }, (_, i) => repo((page - 1) * 100 + i + 1)),
        200,
        {
          link: `<https://api.github.com/users/real-owner/repos?page=${page + 1}>; rel="next"`,
        },
      ),
    );
  const mock = mockFetch(responses);
  const result = await fetchGithubProfile("real-owner", mock);
  assert.equal(result.repositories.length, 1000);
  assert.equal(result.truncated, true);
  assert.equal(mock.calls.length, 11);
});

test("a missing account is distinct from a valid account with no repositories", async () => {
  const mock = mockFetch([response({ message: "Not Found" }, 404)]);
  await assert.rejects(
    fetchGithubProfile("missing-person", mock),
    (error) =>
      error.code === "NOT_FOUND" &&
      error.status === 404 &&
      /account could not be found/.test(error.message),
  );
  assert.equal(mock.calls.length, 1);
});

test("primary rate limits expose the server reset and do not automatically retry", async () => {
  const reset = Math.floor(Date.now() / 1000) + 120;
  const mock = mockFetch([
    response({ message: "API rate limit exceeded" }, 403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(reset),
    }),
  ]);
  await assert.rejects(
    fetchGithubProfile("real-owner", mock),
    (error) =>
      error.code === "RATE_LIMIT" &&
      error.retryAfterSeconds >= 119 &&
      error.retryAfterSeconds <= 120 &&
      Number.isFinite(error.retryAt),
  );
  assert.equal(mock.calls.length, 1);
});

test("secondary rate limits respect retry-after even with unreadable error bodies", async () => {
  const mock = mockFetch([
    new Response("temporarily limited", {
      status: 429,
      headers: { "retry-after": "37" },
    }),
  ]);
  await assert.rejects(
    fetchGithubProfile("real-owner", mock),
    (error) => error.code === "RATE_LIMIT" && error.retryAfterSeconds === 37,
  );
  const forbidden = mockFetch([response({ message: "Access forbidden" }, 403)]);
  await assert.rejects(fetchGithubProfile("real-owner", forbidden), {
    code: "REQUEST_FAILED",
    status: 403,
  });
});

test("network errors and service outages never become empty success results", async () => {
  const failed = mockFetch([new TypeError("Failed to fetch")]);
  await assert.rejects(fetchGithubProfile("real-owner", failed), {
    code: "NETWORK",
  });
  const outage = mockFetch([
    new Response("<html>outage</html>", { status: 503 }),
  ]);
  await assert.rejects(fetchGithubProfile("real-owner", outage), {
    code: "UNAVAILABLE",
    status: 503,
  });
});

test("aborts before and during a request remain cancellation events", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    fetchGithubProfile("real-owner", {
      signal: controller.signal,
      fetchImpl: () => {
        calls++;
      },
    }),
    { code: "ABORTED", name: "AbortError" },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    fetchGithubProfile("real-owner", {
      fetchImpl: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    }),
    { code: "ABORTED", name: "AbortError" },
  );
  const during = new AbortController();
  await assert.rejects(
    fetchGithubProfile("real-owner", {
      signal: during.signal,
      fetchImpl: async () => {
        during.abort();
        return response(profile);
      },
    }),
    { code: "ABORTED" },
  );
});

test("incomplete or invalid successful API data is an error, not fabricated projects", async () => {
  for (const body of [null, [], { login: "../oops" }])
    await assert.rejects(
      fetchGithubProfile("real-owner", mockFetch([response(body)])),
      { code: "INVALID_RESPONSE" },
    );
  await assert.rejects(
    fetchGithubProfile(
      "real-owner",
      mockFetch([response(profile), response({ items: [] })]),
    ),
    { code: "INVALID_RESPONSE" },
  );
  await assert.rejects(
    fetchGithubProfile(
      "real-owner",
      mockFetch([new Response("not-json", { status: 200 })]),
    ),
    { code: "INVALID_RESPONSE" },
  );
});

test("repository mapping includes only known metadata without invented results or screenshots", () => {
  const input = {
    ...repo(4),
    name: "Useful tool",
    description: "A real description",
    language: "TypeScript",
    topics: ["local-first", "local-first"],
    homepage: "https://example.com/tool",
  };
  const project = repositoryToProject(input);
  assert.equal(project.id, "github-4");
  assert.equal(project.description, "A real description");
  assert.equal(project.url, "https://example.com/tool");
  assert.equal(project.source, input.html_url);
  assert.deepEqual(project.tags, ["local-first", "TypeScript"]);
  for (const field of ["challenge", "solution", "outcome", "image"])
    assert.equal(project[field], "");
  const doc = normalizePortfolio({
    version: 1,
    name: "Creator",
    profession: "developer",
    projects: [project],
  });
  assert.equal(doc.sample, false);
});

test("repository homepage and source cannot smuggle executable URLs", () => {
  const project = repositoryToProject({
    ...repo(1),
    homepage: "javascript:alert(1)",
    html_url: "data:text/html,attack",
  });
  assert.equal(project.url, "");
  assert.equal(project.source, "");
  assert.throws(() => repositoryToProject({ ...repo(1), private: true }), {
    code: "PRIVATE_REPOSITORY",
  });
  assert.throws(() => repositoryToProject({ name: "" }), {
    code: "INVALID_REPOSITORY",
  });
});
