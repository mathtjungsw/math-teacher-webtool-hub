const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractAppsFromJavaScript,
  extractCardToolsFromHtml,
  extractCandidatesFromHtml,
  getCandidateKey,
  normalizeIdentityUrl,
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
