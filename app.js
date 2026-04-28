(function () {
  const storageKey = "todo-recorder.records.v1";
  const draftKey = "todo-recorder.draft.v1";
  const $ = (selector) => document.querySelector(selector);

  const els = {
    source: $("#sourceInput"),
    save: $("#saveBtn"),
    clearDraft: $("#clearDraftBtn"),
    list: $("#recordList"),
    count: $("#recordCount"),
    search: $("#searchInput"),
    statusFilter: $("#statusFilter"),
    exportJson: $("#exportJsonBtn"),
    exportCsv: $("#exportCsvBtn"),
    importFile: $("#importFile"),
    copyAppLink: $("#copyAppLinkBtn"),
    toast: $("#toast"),
    template: $("#recordTemplate"),
  };

  let records = loadRecords();
  let toastTimer = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateTime(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function cleanText(text) {
    return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function compactText(text, length) {
    const value = cleanText(text).replace(/[。！？!?；;，,、]+/g, " ");
    return value.length > length ? value.slice(0, length).trim() : value;
  }

  function loadRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function persistRecords() {
    localStorage.setItem(storageKey, JSON.stringify(records));
  }

  function persistDraft() {
    const draft = collectDraft();
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "{}");
    } catch {
      return {};
    }
  }

  function getWeekdayTarget(text, now) {
    const match = text.match(/(?:本周|这周|下周|周|星期|礼拜)([一二三四五六日天1-7])/);
    if (!match) return null;
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };
    const target = map[match[1]];
    const date = new Date(now);
    const current = date.getDay();
    let delta = (target - current + 7) % 7;
    if (match[0].startsWith("下周")) delta += 7;
    if (delta === 0 && !/(本周|这周)/.test(match[0])) delta = 7;
    date.setDate(date.getDate() + delta);
    return date;
  }

  function parseTime(text, date) {
    const timeMatch = text.match(/(上午|早上|中午|下午|晚上|今晚|夜里)?\s*(\d{1,2})(?:[:：](\d{1,2})|[点时](\d{1,2})?)\s*(半)?/);
    const result = new Date(date);
    if (!timeMatch) {
      result.setHours(18, 0, 0, 0);
      return result;
    }
    let hour = Number(timeMatch[2]);
    const minute = timeMatch[5] ? 30 : Number(timeMatch[3] || timeMatch[4] || 0);
    const period = timeMatch[1] || "";
    if (/(下午|晚上|今晚|夜里)/.test(period) && hour < 12) hour += 12;
    if (/中午/.test(period) && hour < 11) hour += 12;
    result.setHours(Math.min(hour, 23), Math.min(minute, 59), 0, 0);
    return result;
  }

  function parseDueTime(text) {
    const value = cleanText(text);
    const now = new Date();
    let date = null;

    const iso = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
    const monthDay = value.match(/(?:^|[^\d])(\d{1,2})月(\d{1,2})[日号]?/);
    const relativeMap = [
      [/大后天/, 3],
      [/后天/, 2],
      [/明天|明日/, 1],
      [/今天|今日|今晚/, 0],
    ];

    if (iso) {
      date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    } else if (monthDay) {
      date = new Date(now.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]));
      if (date < now && date.getMonth() < now.getMonth()) date.setFullYear(date.getFullYear() + 1);
    } else {
      for (const [pattern, delta] of relativeMap) {
        if (pattern.test(value)) {
          date = new Date(now);
          date.setDate(now.getDate() + delta);
          break;
        }
      }
    }

    if (!date) date = getWeekdayTarget(value, now);

    if (!date && /月底/.test(value)) {
      date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const hasTime = /(上午|早上|中午|下午|晚上|今晚|夜里)?\s*\d{1,2}[:：点时]/.test(value);
    if (!date && hasTime) {
      date = new Date(now);
    }

    if (!date && /(尽快|尽早|马上|立即|今天内|asap)/i.test(value)) {
      date = new Date(now);
      date.setHours(18, 0, 0, 0);
      return `${formatDateTime(date)}（根据“尽快”推断）`;
    }

    if (!date) return "未识别，可手动填写";

    const parsed = parseTime(value, date);
    if (parsed < now && hasTime && !/(今天|今日|今晚)/.test(value)) {
      parsed.setDate(parsed.getDate() + 1);
    }
    return formatDateTime(parsed);
  }

  function splitSentences(text) {
    return cleanText(text)
      .split(/[\n。！？!?；;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function inferSummary(text) {
    const sentences = splitSentences(text);
    if (!sentences.length) return "";
    const taskLike = sentences.find((line) => /(需要|请|麻烦|记得|安排|完成|提交|确认|跟进|处理|整理|发送|发给|回复|预约|开会|对接|更新)/.test(line));
    const candidate = taskLike || sentences[0];
    return compactText(candidate.replace(/^(hi|你好|收到|备注|todo|待办)[:：\s-]*/i, ""), 64);
  }

  function cleanKeyPoint(text) {
    return cleanText(text)
      .replace(/^.*?(?:事项|要点|总结|待办)[:：]\s*/i, "")
      .replace(/(?:^|[｜|]\s*)(?:时间|相关人|类型|补充)[:：][^｜|]*/g, "")
      .replace(/^@?[\u4e00-\u9fa5A-Za-z0-9_-]{1,12}[:：]\s*/, "")
      .replace(/^(hi|你好|大家好|收到|备注|todo|待办)[:：\s-]*/i, "")
      .replace(/^(请|麻烦|辛苦|帮忙|需要|记得|请尽快|麻烦尽快)\s*/, "")
      .replace(/\s*[｜|]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractKeyPoint(text) {
    const value = cleanText(text);
    if (!value) return "";
    const sentences = splitSentences(value);
    const actionPattern = /(需要|请|麻烦|记得|安排|完成|提交|确认|跟进|处理|整理|发送|发给|回复|预约|开会|对接|更新|准备|检查|修改|补充|同步|通知|联系|推进|交付|上线|发布)/;
    const deadlinePattern = /(今天|明天|后天|本周|这周|下周|月底|\d{1,2}月\d{1,2}[日号]?|\d{1,2}[:：点时])/;

    const ranked = sentences
      .map((line, index) => {
        let score = 0;
        if (actionPattern.test(line)) score += 4;
        if (deadlinePattern.test(line)) score += 2;
        if (line.length >= 8 && line.length <= 90) score += 1;
        if (/^(收到|好的|ok|OK|嗯|谢谢|辛苦了)$/.test(line)) score -= 5;
        return { line, score, index };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const candidate = ranked[0]?.line || value;
    return compactText(cleanKeyPoint(candidate), 96) || compactText(cleanKeyPoint(value), 96);
  }

  function inferInsight(text) {
    return extractKeyPoint(text);
  }

  function inferFields(text) {
    const source = cleanText(text);
    const dueTime = parseDueTime(source);
    return {
      summary: inferSummary(source),
      recordTime: formatDateTime(new Date()),
      dueTime,
      insight: inferInsight(source),
      original: source,
    };
  }

  function setDraft(record) {
    els.source.value = record.original || "";
    persistDraft();
  }

  function collectDraft() {
    return inferFields(els.source.value);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      showToast("复制失败，请手动复制地址栏内容");
    }
  }

  function saveRecord() {
    const draft = collectDraft();
    if (!draft.original) {
      showToast("请先粘贴代办原文");
      els.source.focus();
      return;
    }
    const record = {
      id: crypto.randomUUID(),
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...draft,
    };

    records.unshift(record);
    showToast("已保存");
    persistRecords();
    localStorage.removeItem(draftKey);
    clearDraft(false);
    renderRecords();
  }

  function clearDraft(showMessage = true) {
    setDraft({});
    localStorage.removeItem(draftKey);
    if (showMessage) showToast("已清空");
  }

  function renderRecords() {
    const query = cleanText(els.search.value).toLowerCase();
    const status = els.statusFilter.value;
    const filtered = records.filter((record) => {
      const matchStatus = status === "all" || record.status === status;
      const haystack = `${record.summary} ${record.recordTime} ${record.dueTime} ${record.insight} ${record.original}`.toLowerCase();
      return matchStatus && (!query || haystack.includes(query));
    });

    els.count.textContent = `${records.length} 条`;
    els.list.innerHTML = "";
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = records.length ? "没有匹配的记录" : "暂无记录";
      els.list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const record of filtered) {
      const node = els.template.content.firstElementChild.cloneNode(true);
      node.dataset.id = record.id;
      node.classList.toggle("done", record.status === "done");
      node.querySelector(".status-pill").textContent = record.status === "done" ? "已完成" : "未完成";
      node.querySelector('[data-field="recordTime"]').textContent = record.recordTime || "-";
      node.querySelector('[data-field="dueTime"]').value = record.dueTime || "";
      node.querySelector('[data-field="insight"]').textContent = extractKeyPoint(record.insight || record.summary || record.original || "未识别，可从原文确认").replace(/…/g, "");
      node.querySelector('[data-field="original"]').textContent = record.original || "-";
      fragment.append(node);
    }
    els.list.append(fragment);
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    downloadFile(`todo-records-${Date.now()}.json`, JSON.stringify(records, null, 2), "application/json;charset=utf-8");
    showToast("已导出 JSON");
  }

  function csvEscape(value) {
    return `"${String(value || "").replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const header = ["代办总结", "记录时间", "计划完成时间", "信息提炼", "代办原文", "状态"];
    const rows = records.map((record) => [
      record.summary,
      record.recordTime,
      record.dueTime,
      record.insight,
      record.original,
      record.status === "done" ? "已完成" : "未完成",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadFile(`todo-records-${Date.now()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    showToast("已导出 CSV");
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
        const normalized = parsed
          .filter((item) => item && item.original)
          .map((item) => ({
            id: item.id || crypto.randomUUID(),
            status: item.status === "done" ? "done" : "open",
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            summary: item.summary || inferSummary(item.original),
            recordTime: item.recordTime || formatDateTime(new Date()),
            dueTime: item.dueTime || parseDueTime(item.original),
            insight: item.insight || inferInsight(item.original),
            original: item.original,
          }));
        records = [...normalized, ...records];
        persistRecords();
        renderRecords();
        showToast(`已导入 ${normalized.length} 条`);
      } catch {
        showToast("导入失败，请选择有效 JSON 文件");
      } finally {
        els.importFile.value = "";
      }
    };
    reader.readAsText(file);
  }

  function attachEvents() {
    els.source.addEventListener("input", persistDraft);

    els.save.addEventListener("click", saveRecord);
    els.clearDraft.addEventListener("click", () => clearDraft(true));
    els.search.addEventListener("input", renderRecords);
    els.statusFilter.addEventListener("change", renderRecords);
    els.exportJson.addEventListener("click", exportJson);
    els.exportCsv.addEventListener("click", exportCsv);
    els.importFile.addEventListener("change", (event) => importJson(event.target.files[0]));
    els.copyAppLink.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.hash = "";
      copyText(url.toString(), "已复制网页链接");
    });
    els.list.addEventListener("click", (event) => {
      const item = event.target.closest(".todo-item");
      if (!item) return;
      const record = records.find((entry) => entry.id === item.dataset.id);
      if (!record) return;

      if (event.target.closest(".check-btn")) {
        record.status = record.status === "done" ? "open" : "done";
        record.updatedAt = new Date().toISOString();
        persistRecords();
        renderRecords();
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      const action = actionButton?.dataset.action;
      if (action === "delete") {
        records = records.filter((entry) => entry.id !== record.id);
        persistRecords();
        renderRecords();
        showToast("已删除");
      }
    });

    els.list.addEventListener("change", (event) => {
      const input = event.target.closest('[data-field="dueTime"]');
      if (!input) return;
      const item = input.closest(".todo-item");
      const record = records.find((entry) => entry.id === item?.dataset.id);
      if (!record) return;
      record.dueTime = cleanText(input.value);
      record.updatedAt = new Date().toISOString();
      persistRecords();
      showToast("计划完成时间已保存");
    });
  }

  function init() {
    attachEvents();
    setDraft(loadDraft());
    renderRecords();
  }

  init();
})();
