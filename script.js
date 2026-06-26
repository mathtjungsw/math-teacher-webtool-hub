const teacherGrid = document.querySelector("#teacher-grid");
const toolResults = document.querySelector("#tool-results");
const tagFilterContainer = document.querySelector("#tag-filters");
const filterSection = document.querySelector(".filter-section");
const teacherSection = document.querySelector(".teacher-section");
const pageSearchInput = document.querySelector("#page-search-input");
const toolSearchInput = document.querySelector("#tool-search-input");
const clearPageSearchButton = document.querySelector("#clear-page-search");
const clearToolSearchButton = document.querySelector("#clear-tool-search");
const teacherCount = document.querySelector("#teacher-count");
const toolCount = document.querySelector("#tool-count");
const teacherEmpty = document.querySelector("#teacher-empty");
const toolEmpty = document.querySelector("#tool-empty");
const teacherTotal = document.querySelector("#teacher-total");
const toolTotal = document.querySelector("#tool-total");
const tagTotal = document.querySelector("#tag-total");
const crawlStatus = document.querySelector("#crawl-status");

let activeTag = "전체 보기";
let pageSearchTerm = "";
let toolSearchTerm = "";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function hasReadyUrl(url) {
  const trimmedUrl = String(url || "").trim();
  return trimmedUrl !== "" && trimmedUrl !== "#";
}

function getGeneratedTools(teacher) {
  const generated = window.generatedTeacherTools;
  const tools = generated?.teachers?.[teacher.name];

  return Array.isArray(tools) ? tools : [];
}

function getTeacherTools(teacher) {
  const generatedTools = getGeneratedTools(teacher);
  const fallbackTools = teacher.tools || [];
  const preferredTools = generatedTools.length > 0 ? generatedTools : fallbackTools;

  return preferredTools.map((tool) => ({
    ...tool,
    source: generatedTools.length > 0 ? "auto" : "manual",
  }));
}

function getAllTools() {
  return window.teachers.flatMap((teacher) =>
    getTeacherTools(teacher).map((tool) => ({
      ...tool,
      teacherName: teacher.name,
      teacherSchool: teacher.school,
      teacherUrl: teacher.url,
      teacherTags: teacher.tags || [],
    })),
  );
}

function getTeacherSearchText(teacher) {
  return normalize([
    teacher.name,
    teacher.school,
    teacher.description,
    ...(teacher.tags || []),
  ].join(" "));
}

function getToolSearchText(tool) {
  return normalize([
    tool.title,
    tool.description,
    tool.teacherName,
    tool.teacherSchool,
    ...(tool.tags || []),
  ].join(" "));
}

function matchesActiveTag(tags) {
  return activeTag === "전체 보기" || (tags || []).includes(activeTag);
}

function teacherHasActiveTag(teacher) {
  if (activeTag === "전체 보기") return true;

  return getTeacherTools(teacher).some((tool) => matchesActiveTag(tool.tags));
}

function getFilteredTeachers() {
  return window.teachers.filter((teacher) => {
    const matchesTag = teacherHasActiveTag(teacher);
    const matchesSearch = !pageSearchTerm || getTeacherSearchText(teacher).includes(pageSearchTerm);

    return matchesTag && matchesSearch;
  });
}

function getFilteredTools() {
  return getAllTools().filter((tool) => {
    const matchesTag = toolSearchTerm ? true : matchesActiveTag(tool.tags);
    const matchesSearch = !toolSearchTerm || getToolSearchText(tool).includes(toolSearchTerm);

    return matchesTag && matchesSearch;
  });
}

function getTagCount(tag) {
  const tools = getAllTools();

  if (tag === "전체 보기") return tools.length;
  return tools.filter((tool) => (tool.tags || []).includes(tag)).length;
}

function renderTagFilters() {
  const filters = ["전체 보기", ...window.tagFilters];

  tagFilterContainer.innerHTML = filters
    .map((tag) => {
      const isActive = tag === activeTag;
      const count = getTagCount(tag);

      return `
        <button
          class="tag-filter${isActive ? " is-active" : ""}"
          type="button"
          data-tag="${escapeHtml(tag)}"
          aria-pressed="${isActive}"
        >
          ${escapeHtml(tag)}
          <span>${count}</span>
        </button>
      `;
    })
    .join("");
}

function renderTeacherImage(teacher) {
  if (teacher.image) {
    return `
      <figure class="teacher-image">
        <img src="${escapeHtml(teacher.image)}" alt="${escapeHtml(teacher.imageAlt || `${teacher.name} 웹툴 모음 페이지 이미지`)}" />
      </figure>
    `;
  }

  return `
    <figure class="teacher-image is-placeholder" aria-label="${escapeHtml(teacher.name)} 웹툴 모음 페이지 이미지 자리">
      <span>${escapeHtml(teacher.name.slice(0, 1))}</span>
      <small>PAGE PREVIEW</small>
    </figure>
  `;
}

function renderTags(tags, className = "tag") {
  return (tags || []).map((tag) => `<span class="${className}">${escapeHtml(tag)}</span>`).join("");
}

function renderTeacherCard(teacher) {
  const isReady = hasReadyUrl(teacher.url);
  const tools = getTeacherTools(teacher);
  const toolCountText = `${tools.length}개 웹툴`;
  const toolSourceText = tools.some((tool) => tool.source === "auto") ? "자동 수집" : "수동 등록";

  return `
    <article class="teacher-card">
      ${renderTeacherImage(teacher)}
      <div class="teacher-card-body">
        <div class="teacher-meta">
          <span>${escapeHtml(toolCountText)}</span>
          <span>${escapeHtml(toolSourceText)}</span>
          <span>${escapeHtml(teacher.school)}</span>
        </div>
        <h3>${escapeHtml(teacher.name)}</h3>
        <p class="teacher-description">${escapeHtml(teacher.description)}</p>
        <div class="teacher-tags" aria-label="${escapeHtml(teacher.name)} 주요 주제 태그">
          ${renderTags(teacher.tags, "teacher-tag")}
        </div>
        ${
          isReady
            ? `<a class="teacher-link" href="${escapeHtml(teacher.url)}" target="_blank" rel="noopener noreferrer">웹툴 보러가기</a>`
            : `<span class="teacher-link is-disabled" aria-disabled="true">준비 중</span>`
        }
      </div>
    </article>
  `;
}

function renderToolResult(tool) {
  const linkUrl = hasReadyUrl(tool.url) ? tool.url : "";
  const hasLink = hasReadyUrl(linkUrl);

  return `
    <article class="tool-result">
      <div class="tool-result-main">
        <p>${escapeHtml(tool.teacherName)} · ${escapeHtml(tool.teacherSchool)}</p>
        <h3>${escapeHtml(tool.title)}</h3>
        <span>${escapeHtml(tool.description)}</span>
        <div class="tool-tags">${renderTags(tool.tags, "tool-tag")}</div>
      </div>
      ${
        hasLink
          ? `<a class="tool-link" href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer">열기</a>`
          : `<span class="tool-link is-disabled" aria-disabled="true">준비 중</span>`
      }
    </article>
  `;
}

function renderTeachers() {
  const filteredTeachers = getFilteredTeachers();

  teacherGrid.innerHTML = filteredTeachers.map(renderTeacherCard).join("");
  teacherCount.textContent = `총 ${filteredTeachers.length}개의 웹툴 모음 페이지`;
  teacherEmpty.hidden = filteredTeachers.length > 0;
}

function renderTools() {
  const filteredTools = getFilteredTools();
  const countLabel = toolSearchTerm ? `검색 결과 ${filteredTools.length}개` : `등록된 웹툴 ${filteredTools.length}개`;

  toolResults.innerHTML = filteredTools.map(renderToolResult).join("");
  toolCount.textContent = countLabel;
  toolEmpty.hidden = filteredTools.length > 0;
}

function renderSummary() {
  teacherTotal.textContent = window.teachers.length;
  toolTotal.textContent = getAllTools().length;
  tagTotal.textContent = window.tagFilters.length;

  const generatedAt = window.generatedTeacherTools?.generatedAt;
  crawlStatus.textContent = generatedAt ? `자동 수집 ${new Date(generatedAt).toLocaleDateString("ko-KR")}` : "";
}

function updateSearchMode() {
  const isToolSearching = toolSearchTerm !== "";

  filterSection.hidden = isToolSearching;
  teacherSection.hidden = isToolSearching;
}

function updateView() {
  updateSearchMode();
  renderTagFilters();
  renderTeachers();
  renderTools();
  renderSummary();
}

tagFilterContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;

  activeTag = button.dataset.tag;
  updateView();
});

pageSearchInput.addEventListener("input", (event) => {
  pageSearchTerm = normalize(event.target.value);
  clearPageSearchButton.hidden = pageSearchTerm === "";
  renderTeachers();
});

toolSearchInput.addEventListener("input", (event) => {
  toolSearchTerm = normalize(event.target.value);
  clearToolSearchButton.hidden = toolSearchTerm === "";
  updateSearchMode();
  renderTools();
});

clearPageSearchButton.addEventListener("click", () => {
  pageSearchInput.value = "";
  pageSearchTerm = "";
  clearPageSearchButton.hidden = true;
  pageSearchInput.focus();
  renderTeachers();
});

clearToolSearchButton.addEventListener("click", () => {
  toolSearchInput.value = "";
  toolSearchTerm = "";
  clearToolSearchButton.hidden = true;
  toolSearchInput.focus();
  updateView();
});

updateView();
