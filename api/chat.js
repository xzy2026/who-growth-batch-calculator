// Vercel Serverless Function：儿童营养师 AI 代理（DeepSeek）
// 部署后地址：https://你的项目.vercel.app/api/chat
// 环境变量：AI_API_KEY（必填，DeepSeek API Key）

// 延长超时时间（DeepSeek 可能较慢；Hobby 计划上限约 10s，Pro 可更大）
export const config = { maxDuration: 30 };

const ALLOWED_ORIGINS = [
  "https://xzy2026.github.io",
  "https://who-growth-batch-calculator.vercel.app",
  "http://localhost:8080",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:3000",
  "null",
];

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

function getOrigin(req) {
  const origin = (req.headers && req.headers.origin) || "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // 未在白名单时用 *，便于本地 file:// 或任意端口访问（本接口不携带凭证）
  return "*";
}

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  const origin = getOrigin(req);
  setCors(res, origin);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.AI_API_KEY || "";
  if (!apiKey) {
    res.status(500).json({
      error: "代理未配置 AI_API_KEY",
      hint: "请在 Vercel 项目 Settings → Environment Variables 中添加 AI_API_KEY",
    });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {}

  const question = body.question || "";
  const context = body.context || "";
  const userContent = [context, question].filter(Boolean).join("\n\n");

  const apiBody = {
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "你是一名儿童营养与生长方面的助手。用户会附带当前儿童的生长报告摘要，包括基本信息、体格数据（身高/体重/BMI）、各指标评价值与评价结果、图表中的实际值与标准值对比、以及报告给出的健康建议。请结合这些报告内容分析用户的问题，引用具体指标或数据作答，给出简短、温和、可操作的建议。回答控制在 200 字以内，并提醒仅供参考、不作为诊断依据。",
      },
      { role: "user", content: userContent || "你好" },
    ],
  };

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify(apiBody),
    });

    const text = await response.text();
    if (!response.ok) {
      res.status(502).json({
        error: "AI 服务返回错误",
        status: response.status,
        detail: text.slice(0, 500),
      });
      return;
    }

    const data = JSON.parse(text);
    const content =
      data.choices?.[0]?.message?.content ??
      data.result?.output?.text ??
      data.output?.text ??
      "";

    res.status(200).json({
      answer: content || "未获取到有效回复。",
    });
  } catch (err) {
    res.status(502).json({
      error: "代理请求失败",
      message: (err && err.message) || String(err),
    });
  }
}
