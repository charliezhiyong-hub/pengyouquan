const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const fileCount = document.getElementById("fileCount");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultBox = document.getElementById("resultBox");
const copyBtn = document.getElementById("copyBtn");
const uploadArea = document.getElementById("uploadArea");
const historyList = document.getElementById("historyList");
const refreshHistory = document.getElementById("refreshHistory");
const currentUser = document.getElementById("currentUser");
const switchUser = document.getElementById("switchUser");
const loginMask = document.getElementById("loginMask");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");

let files = [];
let username = localStorage.getItem("username") || "";

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

const updateLoginUI = () => {
  currentUser.textContent = username || "未登录";
  loginMask.classList.toggle("show", !username);
  if (!username) {
    usernameInput.value = "";
    usernameInput.focus();
  }
};

const getAuthHeaders = () => {
  if (!username) {
    return {};
  }
  return { "X-Username": username };
};

const ensureLogin = () => {
  if (!username) {
    updateLoginUI();
    throw new Error("未登录");
  }
};

const loadHistory = async () => {
  if (!username) {
    renderHistory([]);
    updateLoginUI();
    return;
  }
  const response = await fetch("/api/history", {
    headers: getAuthHeaders()
  });
  const data = await response.json();
  if (!response.ok) {
    renderHistory([]);
    if (response.status === 401) {
      username = "";
      localStorage.removeItem("username");
      updateLoginUI();
    }
    return;
  }
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
    ensureLogin();
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      headers: getAuthHeaders()
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

loginBtn.addEventListener("click", async () => {
  const value = usernameInput.value.trim();
  if (!value) {
    usernameInput.focus();
    return;
  }
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: value })
  });
  const data = await response.json();
  if (!response.ok) {
    return;
  }
  username = data.username;
  localStorage.setItem("username", username);
  updateLoginUI();
  loadHistory();
});

usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginBtn.click();
  }
});

switchUser.addEventListener("click", () => {
  username = "";
  localStorage.removeItem("username");
  updateLoginUI();
});

refresh();
updateLoginUI();
loadHistory();
