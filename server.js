const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const app = express();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dataDir = path.join(__dirname, "data");
const historyPath = path.join(dataDir, "history.json");

const ensureHistoryFile = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
};

const readHistory = () => {
  ensureHistoryFile();
  const raw = fs.readFileSync(historyPath, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return Array.isArray(parsed.items) ? parsed.items : [];
};

const writeHistory = (items) => {
  ensureHistoryFile();
  fs.writeFileSync(historyPath, JSON.stringify({ items }, null, 2), "utf8");
};

const getUsername = (req) => {
  const value = req.get("x-username");
  if (!value) {
    return "";
  }
  return String(value).trim();
};

app.post("/api/login", (req, res) => {
  const username = String((req.body && req.body.username) || "").trim();
  if (!username) {
    res.status(400).json({ error: "请输入用户名" });
    return;
  }
  res.json({ username });
});

app.get("/api/history", (req, res) => {
  try {
    const items = readHistory();
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const filtered = items.filter((record) => record.username === username);
    res.json({ items: filtered });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.get("/api/history/:id", (req, res) => {
  try {
    const items = readHistory();
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const item = items.find(
      (record) => record.id === req.params.id && record.username === username
    );
    if (!item) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    res.json({ item });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.get("/api/history/export", (req, res) => {
  try {
    const items = readHistory();
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const filtered = items.filter((record) => record.username === username);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="history-${encodeURIComponent(username)}.json"`
    );
    res.send(JSON.stringify({ items: filtered }, null, 2));
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.delete("/api/history", (req, res) => {
  try {
    const items = readHistory();
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const nextItems = items.filter((record) => record.username !== username);
    writeHistory(nextItems);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.delete("/api/history/:id", (req, res) => {
  try {
    const items = readHistory();
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const nextItems = items.filter(
      (record) => !(record.id === req.params.id && record.username === username)
    );
    if (nextItems.length === items.length) {
      res.status(404).json({ error: "记录不存在" });
      return;
    }
    writeHistory(nextItems);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.post("/api/analyze", upload.array("images", 20), async (req, res) => {
  try {
    const username = getUsername(req);
    if (!username) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ARK_API_KEY 未配置" });
      return;
    }

    const files = req.files || [];
    if (files.length < 5) {
      res.status(400).json({ error: "请上传 5 张及以上照片或截图" });
      return;
    }

    const systemPrompt =
      "你是一个寻找朋友的客户，对于个人的心理和外在表现，有非常强的洞察，也有一套很厉害的识别朋友匹配度的技巧！擅长于输出简短但有效的分析和建议。";
    const userPrompt =
      "请基于这些朋友圈照片或截图，输出简短但有效的分析与建议，目标是帮助用户与对方成为好朋友。请按以下结构输出：\n1) 性格特征（外向/内向倾向、社交偏好、情绪风格）\n2) 画像总结（兴趣、生活方式、价值观倾向）\n3) 互动策略（聊天切入点、话题建议）\n4) 风险提示（可能的误读与谨慎建议）\n5) 行动清单（3-5 条可执行步骤）\n6) 推荐话术（2-3 条个性化开场白）";

    const imageParts = files.map((file) => ({
      type: "input_image",
      image_url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
    }));

    const body = {
      model: "ep-20260218111935-hr9jq",
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }, ...imageParts]
        }
      ]
    };

    const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText });
      return;
    }

    const data = await response.json();
    let text = "";

    if (typeof data.output_text === "string") {
      text = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              text += part.text;
            }
          }
        }
      }
    }

    if (!text) {
      text = JSON.stringify(data);
    }

    const items = readHistory();
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      imageCount: files.length,
      username,
      text
    };
    const sameUser = items.filter((item) => item.username === username);
    const otherUsers = items.filter((item) => item.username !== username);
    const nextUserItems = [record, ...sameUser].slice(0, 50);
    const nextItems = [...nextUserItems, ...otherUsers];
    writeHistory(nextItems);

    res.json({ text, record });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message ? error.message : error) });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
