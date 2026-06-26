const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT_DIR, "data.js");
const OUTPUT_PATH = path.join(ROOT_DIR, "generated-tools.js");
const MAX_TOOLS_PER_TEACHER = 40;
const MAX_CRAWL_DEPTH = 2;
const MAX_PAGES_PER_TEACHER = 80;

const SKIP_TEXT = new Set([
  "홈",
  "home",
  "소개",
  "about",
  "github",
  "문의",
  "contact",
  "사용 가이드",
  "사용 방법",
  "학습 알림 받기",
  "← 홈으로",
  "홈으로",
]);

const GENERIC_TEXT = new Set([
  "시작하기",
  "학습하기",
  "열기",
  "바로가기",
  "더보기",
  "웹툴 보러가기",
]);

const TAG_KEYWORDS = [
  ["확률", ["확률", "probability", "조건부", "몬티홀", "이항분포"]],
  ["통계", ["통계", "데이터", "분석", "statistics", "정규분포", "추정"]],
  ["기하", ["기하", "도형", "공간", "이차곡선", "스트링아트"]],
  ["함수", ["함수", "그래프", "추세선", "미분", "적분", "극한"]],
  ["인공지능 수학", ["ai", "인공지능", "지도학습", "분류", "감성"]],
  ["경제수학", ["경제", "금융", "이자", "수익"]],
  ["공학도구", ["도구", "웹도구", "공학", "시뮬레이션", "엑셀", "변환"]],
  ["게임형 수업", ["게임", "숫자야구", "주사위", "경매"]],
  ["수업활동", ["수업", "활동", "탐구", "교실", "학생", "학습"]],
];

function loadTeachers() {
  const code = fs.readFileSync(DATA_PATH, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: DATA_PATH });

  return sandbox.window.teachers || [];
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function stripTags(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeText(value) {
  return stripTags(value)
    .replace(/[→↗←🚀📖⚾🧵🔎🚪∑]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonical(value) {
  return normalizeText(value).toLowerCase();
}

function getAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = String(tag || "").match(pattern);
  return match ? decodeEntities(match[1].trim()) : "";
}

function lastMatchText(html, pattern) {
  let text = "";
  for (const match of String(html || "").matchAll(pattern)) {
    const candidate = normalizeText(match[1]);
    if (candidate) text = candidate;
  }
  return text;
}

function firstMatchText(html, pattern) {
  const match = String(html || "").match(pattern);
  return match ? normalizeText(match[1]) : "";
}

function getContext(html, anchorIndex) {
  const start = Math.max(0, anchorIndex - 2600);
  const end = Math.min(html.length, anchorIndex + 900);

  return {
    before: html.slice(start, anchorIndex),
    after: html.slice(anchorIndex, end),
    around: html.slice(start, end),
  };
}

function extractTitle(context, linkText) {
  const linkStrong = firstMatchText(linkText, /<strong[^>]*>([\s\S]*?)<\/strong>/i);
  const nearestHeading = lastMatchText(context.before, /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi);
  const nearestStrong = lastMatchText(context.before, /<strong[^>]*>([\s\S]*?)<\/strong>/gi);
  const cleanLinkText = normalizeText(linkText);

  return [linkStrong, nearestHeading, nearestStrong, cleanLinkText].find((text) => text && !GENERIC_TEXT.has(canonical(text))) || cleanLinkText;
}

function extractDescription(context, linkText, title, teacherName) {
  const linkSmall = firstMatchText(linkText, /<small[^>]*>([\s\S]*?)<\/small>/i);
  const nearestParagraph = lastMatchText(context.before, /<p[^>]*>([\s\S]*?)<\/p>/gi);
  const nearestSmall = lastMatchText(context.before, /<small[^>]*>([\s\S]*?)<\/small>/gi);
  const candidates = [linkSmall, nearestParagraph, nearestSmall]
    .map((text) => normalizeText(text))
    .filter((text) => text && text !== title && text.length >= 8 && !SKIP_TEXT.has(canonical(text)));

  return candidates.find((text) => text.length <= 160) || candidates[0] || `${teacherName} 선생님의 웹툴입니다.`;
}

function inferTags(text, teacherTags) {
  const lowerText = String(text || "").toLowerCase();
  const tags = new Set();

  for (const [tag, keywords] of TAG_KEYWORDS) {
    if (keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      tags.add(tag);
    }
  }

  for (const tag of teacherTags || []) {
    if (lowerText.includes(tag.toLowerCase())) tags.add(tag);
  }

  return [...tags].slice(0, 5);
}

function isHtmlLikeUrl(url) {
  const parsed = new URL(url);
  const basename = parsed.pathname.split("/").pop() || "";

  return basename === "" || basename.endsWith(".html") || !basename.includes(".");
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function normalizePathname(url) {
  return new URL(url).pathname
    .replace(/index\.html$/i, "")
    .replace(/\/+$/, "/");
}

function isRootPage(url, rootUrl) {
  const parsed = new URL(url);
  const root = new URL(rootUrl);

  return parsed.origin === root.origin && normalizePathname(parsed) === normalizePathname(root);
}

function shouldSkip(title, url, pageUrl, rootUrl) {
  const normalizedTitle = canonical(title);
  const parsed = new URL(url);
  const page = new URL(pageUrl);

  if (!title || SKIP_TEXT.has(normalizedTitle)) return true;
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  if (parsed.hostname.includes("github.com")) return true;
  if (parsed.hash && parsed.pathname === page.pathname && parsed.origin === page.origin) return true;
  if (isRootPage(parsed, rootUrl)) return true;

  return false;
}

function shouldFollow(candidate, teacher, depth) {
  if (depth >= MAX_CRAWL_DEPTH) return false;
  if (!isHtmlLikeUrl(candidate.url)) return false;

  const root = new URL(teacher.crawlUrl || teacher.url);
  const parsed = new URL(candidate.url);
  if (parsed.origin !== root.origin) return false;
  if (isRootPage(parsed, root)) return false;

  return !(teacher.crawlExcludePatterns || []).some((pattern) => new RegExp(pattern).test(parsed.pathname));
}

function extractCandidatesFromHtml(html, teacher, pageUrl) {
  const rootUrl = teacher.crawlUrl || teacher.url;
  const candidates = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = getAttribute(match[1], "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    let url;
    try {
      url = new URL(href, pageUrl).href;
    } catch {
      continue;
    }

    const context = getContext(html, match.index || 0);
    const linkText = canonical(match[2]);
    if (SKIP_TEXT.has(linkText)) continue;

    const title = extractTitle(context, match[2]);
    if (shouldSkip(title, url, pageUrl, rootUrl)) continue;

    const description = extractDescription(context, match[2], title, teacher.name);
    const tags = inferTags(`${title} ${description} ${normalizeText(context.around)}`, teacher.tags);

    candidates.push({
      title,
      description,
      tags: tags.length ? tags : (teacher.tags || []).slice(0, 3),
      url,
      _kind: "anchor",
    });
  }

  return candidates;
}

function getClassNames(tag) {
  const className = getAttribute(tag, "class");
  return className.split(/\s+/).filter(Boolean);
}

function extractDivBlocksByClass(html, className) {
  const blocks = [];
  const openPattern = /<div\b[^>]*>/gi;

  for (const openMatch of html.matchAll(openPattern)) {
    if (!getClassNames(openMatch[0]).includes(className)) continue;

    const tokenPattern = /<div\b[^>]*>|<\/div\s*>/gi;
    tokenPattern.lastIndex = (openMatch.index || 0) + openMatch[0].length;
    let depth = 1;
    let closeMatch;

    while ((closeMatch = tokenPattern.exec(html))) {
      depth += /^<div\b/i.test(closeMatch[0]) ? 1 : -1;
      if (depth === 0) {
        blocks.push(html.slice((openMatch.index || 0) + openMatch[0].length, closeMatch.index));
        break;
      }
    }
  }

  return blocks;
}

function extractCardToolsFromHtml(html, teacher, pageUrl) {
  const tools = [];

  for (const cardHtml of extractDivBlocksByClass(html, "card")) {
    const title = firstMatchText(cardHtml, /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i) || firstMatchText(cardHtml, /<strong[^>]*>([\s\S]*?)<\/strong>/i);
    if (!title || SKIP_TEXT.has(canonical(title)) || GENERIC_TEXT.has(canonical(title))) continue;

    const description =
      firstMatchText(cardHtml, /<p[^>]*>([\s\S]*?)<\/p>/i) ||
      firstMatchText(cardHtml, /<small[^>]*>([\s\S]*?)<\/small>/i) ||
      `${teacher.name} 선생님의 웹툴입니다.`;
    const tagText =
      firstMatchText(cardHtml, /<span[^>]*class=["'][^"']*(?:card-tag|tool-badge|tag)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
      "";
    const anchorMatch = cardHtml.match(/<a\b([^>]*)>/i);
    const href = anchorMatch ? getAttribute(anchorMatch[1], "href") : "";
    const pendingLabel =
      firstMatchText(cardHtml, /<(?:span|button)[^>]*class=["'][^"']*(?:btn-wip|is-disabled|coming-soon)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|button)>/i) ||
      "";
    if (!href && !pendingLabel) continue;

    let url = "#";

    if (href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      try {
        url = new URL(href, pageUrl).href;
      } catch {
        url = "#";
      }
    }

    const tags = inferTags(`${title} ${description} ${tagText}`, teacher.tags);
    if (tagText && !tags.includes(tagText)) tags.unshift(tagText);

    tools.push({
      title,
      description,
      tags: tags.length ? tags.slice(0, 5) : (teacher.tags || []).slice(0, 3),
      url,
      _kind: "card",
    });
  }

  return tools;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "math-webtool-hub-crawler/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function findJavaScriptArray(source, variableName) {
  const assignmentPattern = new RegExp(`(?:const|let|var)\\s+${variableName}\\s*=\\s*\\[`, "i");
  const match = assignmentPattern.exec(source);
  if (!match) return "";

  const start = match.index + match[0].lastIndexOf("[");
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "[") depth += 1;
    if (character === "]") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  return "";
}

function extractAppsFromJavaScript(source, teacher, pageUrl) {
  const arraySource = findJavaScriptArray(source, "apps");
  if (!arraySource) return [];

  const sandbox = {};
  let apps;

  try {
    apps = vm.runInNewContext(arraySource, sandbox, { timeout: 1000 });
  } catch {
    return [];
  }

  if (!Array.isArray(apps)) return [];

  return apps
    .filter((app) => app && app.title && app.url)
    .map((app) => {
      let url = "#";

      try {
        url = new URL(app.url, pageUrl).href;
      } catch {
        url = "#";
      }

      const tags = inferTags(
        `${app.title || ""} ${app.subject || ""} ${app.category || ""} ${app.description || ""} ${(app.tags || []).join(" ")}`,
        teacher.tags,
      );
      for (const tag of app.tags || []) {
        if (tag && !tags.includes(tag)) tags.push(tag);
      }

      return {
        title: normalizeText(app.title),
        description: normalizeText(app.description) || `${teacher.name} 선생님의 웹툴입니다.`,
        tags: tags.slice(0, 5),
        url,
        _kind: "script-app",
      };
    });
}

function extractScriptUrls(html, pageUrl) {
  const scripts = [];
  const scriptPattern = /<script\b([^>]*)><\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const src = getAttribute(match[1], "src");
    if (!src) continue;

    try {
      scripts.push(new URL(src, pageUrl).href);
    } catch {
      // Ignore malformed script URLs.
    }
  }

  return scripts;
}

async function extractScriptAppTools(html, teacher, pageUrl) {
  const tools = [];

  for (const scriptUrl of extractScriptUrls(html, pageUrl)) {
    let script;

    try {
      script = await fetchHtml(scriptUrl);
    } catch {
      continue;
    }

    tools.push(...extractAppsFromJavaScript(script, teacher, pageUrl));
  }

  return tools;
}

function getMetaContent(html, attributeName, attributeValue) {
  const metaPattern = /<meta\b[^>]*>/gi;

  for (const match of html.matchAll(metaPattern)) {
    if (canonical(getAttribute(match[0], attributeName)) === canonical(attributeValue)) {
      return normalizeText(getAttribute(match[0], "content"));
    }
  }

  return "";
}

function extractPageTool(html, teacher, pageUrl, sourceCandidate) {
  const heading = firstMatchText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const documentTitle = firstMatchText(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    .split(/\s+[|—]\s+/)[0]
    .trim();
  const metaDescription =
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "property", "og:description");
  const firstParagraph = firstMatchText(html, /<main[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const title = sourceCandidate?.title || heading || documentTitle || `${teacher.name} 선생님의 웹툴`;
  const description =
    sourceCandidate?.description ||
    metaDescription ||
    firstParagraph ||
    `${teacher.name} 선생님의 웹툴입니다.`;
  const tags = inferTags(`${title} ${description} ${heading} ${documentTitle}`, teacher.tags);

  return {
    title,
    description,
    tags: tags.length ? tags : (sourceCandidate?.tags || teacher.tags || []).slice(0, 5),
    url: pageUrl,
  };
}

function getCandidateKey(candidate) {
  if (!candidate.url || candidate.url === "#") {
    return `pending:${canonical(candidate.title)}`;
  }

  try {
    return normalizeUrl(candidate.url).replace(/\/$/, "");
  } catch {
    return `${canonical(candidate.title)}:${candidate.url}`;
  }
}

function extractPageCandidates(html, teacher, pageUrl) {
  const candidates = [
    ...extractCardToolsFromHtml(html, teacher, pageUrl),
    ...extractCandidatesFromHtml(html, teacher, pageUrl),
  ];
  const uniqueCandidates = new Map();

  for (const candidate of candidates) {
    const key = getCandidateKey(candidate);
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, candidate);
    }
  }

  return [...uniqueCandidates.values()];
}

function isExternalToolCandidate(candidate, teacher, depth) {
  if (depth === 0 || candidate._kind !== "card" || !candidate.url || candidate.url === "#") {
    return false;
  }

  const root = new URL(teacher.crawlUrl || teacher.url);
  const parsed = new URL(candidate.url);

  return parsed.origin !== root.origin && ["http:", "https:"].includes(parsed.protocol);
}

function mergeTool(tools, seen, tool) {
  const cleanTool = {
    title: tool.title,
    description: tool.description,
    tags: tool.tags || [],
    url: tool.url || "#",
  };
  const urlKey = getCandidateKey(cleanTool);

  if (seen.has(urlKey)) return;

  seen.add(urlKey);
  tools.push(cleanTool);
}

async function crawlTeacherTools(teacher) {
  const crawlUrl = teacher.crawlUrl || teacher.url;
  const queue = [{ url: crawlUrl, depth: 0, sourceCandidate: null }];
  const visited = new Set();
  const seenTools = new Set();
  const tools = [];

  while (queue.length && tools.length < MAX_TOOLS_PER_TEACHER && visited.size < MAX_PAGES_PER_TEACHER) {
    const current = queue.shift();
    const pageUrl = normalizeUrl(new URL(current.url, crawlUrl));
    const pageKey = pageUrl.replace(/\/$/, "");
    if (visited.has(pageKey)) continue;
    visited.add(pageKey);

    let html;
    try {
      html = await fetchHtml(pageUrl);
    } catch (error) {
      if (current.depth === 0) throw error;
      console.warn(`${teacher.name}: ${pageUrl} (${error.message})`);
      continue;
    }

    const scriptTools = await extractScriptAppTools(html, teacher, pageUrl);
    for (const tool of scriptTools) {
      mergeTool(tools, seenTools, tool);
    }

    const candidates = extractPageCandidates(html, teacher, pageUrl);
    const pendingTools = candidates.filter((candidate) => candidate.url === "#");
    const listedToolCards = candidates.filter((candidate) => candidate._kind === "card");
    let hasChildTools = pendingTools.length > 0 || scriptTools.length > 0;

    if (current.depth >= MAX_CRAWL_DEPTH) {
      if (listedToolCards.length === 0) {
        mergeTool(tools, seenTools, extractPageTool(html, teacher, pageUrl, current.sourceCandidate));
      }
      continue;
    }

    for (const candidate of candidates) {
      if (!candidate.url || candidate.url === "#") continue;

      if (shouldFollow(candidate, teacher, current.depth)) {
        queue.push({
          url: candidate.url,
          depth: current.depth + 1,
          sourceCandidate: candidate,
        });
        hasChildTools = true;
        continue;
      }

      if (isExternalToolCandidate(candidate, teacher, current.depth)) {
        mergeTool(tools, seenTools, candidate);
        hasChildTools = true;
      }

      if (tools.length >= MAX_TOOLS_PER_TEACHER) break;
    }

    if (current.depth > 0 && !hasChildTools) {
      mergeTool(tools, seenTools, extractPageTool(html, teacher, pageUrl, current.sourceCandidate));
    }
  }

  return tools;
}

async function main() {
  const teachers = loadTeachers();
  const output = {
    generatedAt: new Date().toISOString(),
    teachers: {},
    crawlErrors: [],
  };

  for (const teacher of teachers) {
    const crawlUrl = teacher.crawlUrl || teacher.url;
    if (!crawlUrl || crawlUrl === "#") continue;

    try {
      const tools = await crawlTeacherTools(teacher);
      output.teachers[teacher.name] = tools.length ? tools : teacher.tools || [];
      console.log(`${teacher.name}: ${output.teachers[teacher.name].length} tools`);
    } catch (error) {
      output.teachers[teacher.name] = teacher.tools || [];
      output.crawlErrors.push({
        teacher: teacher.name,
        url: crawlUrl,
        message: error.message,
      });
      console.warn(`${teacher.name}: ${error.message}`);
    }
  }

  const file = `window.generatedTeacherTools = ${JSON.stringify(output, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_PATH, file, "utf8");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  crawlTeacherTools,
  extractCardToolsFromHtml,
  extractAppsFromJavaScript,
  extractCandidatesFromHtml,
  extractPageCandidates,
  loadTeachers,
  shouldFollow,
};
