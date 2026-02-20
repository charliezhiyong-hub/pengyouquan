const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const fileCount = document.getElementById("fileCount");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultBox = document.getElementById("resultBox");
const copyBtn = document.getElementById("copyBtn");
const uploadArea = document.getElementById("uploadArea");
const historyList = document.getElementById("historyList");
const refreshHistory = document.getElementById("refreshHistory");

let files = [];

const refresh = () => {
  preview.innerHTML = "";
  fileCount.textContent = String(files.length);
  analyzeBtn.disabled = files.length < 5;
  copyBtn.disabled = !resultBox.textContent || resultBox.textContent === "等待分析";

  files.forEach((file, index) => {
    const card = document.createElement("div");
    card.className = "preview-item";

    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      files = files.filter((_, i) => i !== index);
      refresh();
    });

    card.appendChild(img);
    card.appendChild(remove);
    preview.appendChild(card);
  });
};

const formatTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const renderHistory = (items) => {
  historyList.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "暂无历史记录";
    historyList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${formatTime(item.createdAt)} · ${item.imageCount} 张`;

    const text = document.createElement("div");
    text.className = "history-text";
    text.textContent = item.text || "";

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "ghost";
    viewBtn.textContent = "查看";
    viewBtn.addEventListener("click", () => {
      resultBox.textContent = item.text || "未获取到分析结果";
      refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const copyBtnItem = document.createElement("button");
    copyBtnItem.className = "ghost";
    copyBtnItem.textContent = "复制";
    copyBtnItem.addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.text || "");
      copyBtnItem.textContent = "已复制";
      setTimeout(() => {
        copyBtnItem.textContent = "复制";
      }, 1200);
    });

    actions.appendChild(viewBtn);
    actions.appendChild(copyBtnItem);
    card.appendChild(meta);
    card.appendChild(text);
    card.appendChild(actions);
    historyList.appendChild(card);
  });
};

const loadHistory = async () => {
  const response = await fetch("/api/history");
  const data = await response.json();
  renderHistory(Array.isArray(data.items) ? data.items : []);
};

fileInput.addEventListener("change", (event) => {
  const selected = Array.from(event.target.files || []);
  files = files.concat(selected);
  fileInput.value = "";
  refresh();
});

uploadArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadArea.classList.remove("dragover");
  const dropped = Array.from(event.dataTransfer.files || []).filter((f) =>
    f.type.startsWith("image/")
  );
  files = files.concat(dropped);
  refresh();
});

analyzeBtn.addEventListener("click", async () => {
  if (files.length < 5) {
    return;
  }

  analyzeBtn.disabled = true;
  resultBox.textContent = "分析中，请稍候…";

  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      resultBox.textContent = data.error || "分析失败，请稍后重试";
    } else {
      resultBox.textContent = data.text || "未获取到分析结果";
      loadHistory();
    }
  } catch (error) {
    resultBox.textContent = String(error);
  } finally {
    analyzeBtn.disabled = files.length < 5;
    refresh();
  }
});

refreshHistory.addEventListener("click", () => {
  loadHistory();
});

copyBtn.addEventListener("click", async () => {
  if (!resultBox.textContent || resultBox.textContent === "等待分析") {
    return;
  }
  await navigator.clipboard.writeText(resultBox.textContent);
  copyBtn.textContent = "已复制";
  setTimeout(() => {
    copyBtn.textContent = "复制结果";
  }, 1200);
});

refresh();
loadHistory();
