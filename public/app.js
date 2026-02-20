const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const fileCount = document.getElementById("fileCount");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultBox = document.getElementById("resultBox");
const copyBtn = document.getElementById("copyBtn");
const uploadArea = document.getElementById("uploadArea");

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
    }
  } catch (error) {
    resultBox.textContent = String(error);
  } finally {
    analyzeBtn.disabled = files.length < 5;
    refresh();
  }
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
