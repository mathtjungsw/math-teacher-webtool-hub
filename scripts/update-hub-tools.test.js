const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractAppsFromJavaScript,
  extractCardToolsFromHtml,
  extractCandidatesFromHtml,
  getCandidateKey,
  hasMeaningfulOutputChange,
  loadTeachers,
  normalizeIdentityUrl,
  parseJavaScriptLiteral,
  protectAgainstRegression,
  resolveHttpUrl,
  shouldFollow,
} = require("./update-hub-tools.js");

const teacher = {
  name: "Test Teacher",
  tags: ["Probability"],
  url: "https://example.com/",
  crawlUrl: "https://example.com/",
};

test("extracts a linked tool from a nested card", () => {
  const html = `
    <div class="card">
      <div class="card-thumb"></div>
      <div class="card-body">
        <span class="card-tag">Probability</span>
        <h3>Monty Hall Lab</h3>
        <p>Run the probability experiment.</p>
        <a href="./tools/monty.html">Open</a>
      </div>
    </div>
  `;

  const tools = extractCardToolsFromHtml(html, teacher, "https://example.com/category.html");

  assert.equal(tools.length, 1);
  assert.equal(tools[0].title, "Monty Hall Lab");
  assert.equal(tools[0].url, "https://example.com/tools/monty.html");
});

test("does not treat an ordinary interface panel as a webtool card", () => {
  const html = `
    <div class="card">
      <h3>Experiment settings</h3>
      <p>Change the sample size.</p>
    </div>
  `;

  const tools = extractCardToolsFromHtml(html, teacher, "https://example.com/tool.html");

  assert.deepEqual(tools, []);
});

test("extracts article tool cards and prefers the launch link over a manual", () => {
  const html = `
    <article class="tool-card" data-tool-tags="probability-statistics probability simulation class-use">
      <div class="tool-content">
        <h3>Monty Hall Lab</h3>
        <p>Run the probability experiment.</p>
        <a class="guide-link" href="./monty/index.html?manual=1">Manual</a>
        <a href="./monty/index.html">Open</a>
      </div>
    </article>
  `;

  const tools = extractCardToolsFromHtml(html, teacher, "https://example.com/index.html");

  assert.equal(tools.length, 1);
  assert.equal(tools[0].url, "https://example.com/monty/index.html");
  assert.equal(tools[0]._kind, "tool-card");
  assert.ok(tools[0].tags.includes("확률"));
  assert.ok(tools[0].tags.includes("수업활동"));
});

test("ignores unresolved template URLs", () => {
  const html = `<a href="./downloads/\${CONVERTER_DOWNLOAD_URL}">Download converter</a>`;
  const tools = extractCandidatesFromHtml(html, teacher, "https://example.com/tool/index.html");

  assert.deepEqual(tools, []);
});

test("rejects non-HTTP tool links", () => {
  const html = `
    <article class="tool-card">
      <h3>Unsafe tool</h3>
      <p>This link must not be rendered.</p>
      <a href="javascript:alert(1)">Open</a>
    </article>
  `;

  assert.deepEqual(extractCardToolsFromHtml(html, teacher, teacher.url), []);
  assert.equal(resolveHttpUrl("javascript:alert(1)", teacher.url), "");
});

test("deduplicates manual and cache query variants", () => {
  const direct = "https://example.com/tool/index.html";
  const manual = "https://example.com/tool/index.html?manual=1&v=20260719&utm_source=hub";

  assert.equal(normalizeIdentityUrl(manual), direct);
  assert.equal(getCandidateKey({ title: "Tool", url: manual }), getCandidateKey({ title: "Tool", url: direct }));
});

test("follows same-site pages through two link levels only", () => {
  const firstLevel = {
    title: "Probability",
    url: "https://example.com/probability.html",
  };
  const secondLevel = {
    title: "Monty Hall Lab",
    url: "https://example.com/tools/monty.html",
  };

  assert.equal(shouldFollow(firstLevel, teacher, 0), true);
  assert.equal(shouldFollow(secondLevel, teacher, 1), true);
  assert.equal(shouldFollow(secondLevel, teacher, 2), false);
});

test("extracts rendered apps from a JavaScript apps array", () => {
  const script = `
    const apps = [
      {
        title: "몬티홀 실험실",
        subject: "수학",
        category: "확률",
        description: "조건부확률의 직관을 확인하는 실험입니다.",
        tags: ["확률", "시뮬레이션", "게임"],
        url: "./apps/monty-hall/index.html",
      },
    ];

    document.querySelector("#appGrid").innerHTML = "";
  `;

  const tools = extractAppsFromJavaScript(script, teacher, "https://example.com/library/");

  assert.equal(tools.length, 1);
  assert.equal(tools[0].title, "몬티홀 실험실");
  assert.equal(tools[0].url, "https://example.com/library/apps/monty-hall/index.html");
  assert.ok(tools[0].tags.includes("확률"));
});

test("parses data literals without executing expressions", () => {
  const parsed = parseJavaScriptLiteral(`[
    { title: 'Tool', enabled: true, count: 3, tags: ['math'], },
  ]`);

  assert.equal(parsed[0].title, "Tool");
  assert.equal(parsed[0].enabled, true);
  assert.throws(() => parseJavaScriptLiteral("[(() => ({ title: 'Unsafe' }))()]"));

  const tools = extractAppsFromJavaScript(
    "const apps = [(() => ({ title: 'Unsafe', url: 'https://example.com/' }))()];",
    teacher,
    teacher.url,
  );
  assert.deepEqual(tools, []);
});

test("loads teacher data with the restricted literal parser", () => {
  const teachers = loadTeachers();

  assert.ok(teachers.length >= 5);
  assert.equal(teachers[0].name, "정승원");
});

test("keeps the previous index when collection drops by more than twenty percent", () => {
  const previousTools = Array.from({ length: 5 }, (_, index) => ({ title: `Old ${index}`, url: `https://example.com/${index}` }));
  const observedTools = previousTools.slice(0, 3);
  const result = protectAgainstRegression(observedTools, {
    status: "success",
    count: observedTools.length,
    pagesVisited: 8,
    pageErrors: [],
  }, previousTools);

  assert.equal(result.stats.status, "regression");
  assert.equal(result.stats.observedCount, 3);
  assert.deepEqual(result.tools, previousTools);
});

test("ignores generated timestamps when checking for data changes", () => {
  const previous = { generatedAt: "2026-01-01T00:00:00.000Z", teachers: { Teacher: [] }, crawlErrors: [], crawlStats: {} };
  const current = { ...previous, generatedAt: "2026-02-01T00:00:00.000Z" };

  assert.equal(hasMeaningfulOutputChange(current, previous), false);
  current.teachers = { Teacher: [{ title: "New", url: "https://example.com/new" }] };
  assert.equal(hasMeaningfulOutputChange(current, previous), true);
});
