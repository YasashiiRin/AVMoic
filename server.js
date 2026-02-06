import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FPT_API_KEY = process.env.FPT_API_KEY;

app.post("/api/chat", async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Thiếu GEMINI_API_KEY" });
  }

  const { message, history = [] } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Cần gửi message (string)" });
  }

  const systemPrompt = `
Bạn là một cô gái dịu dàng, thanh lịch,
Sử dụng từ ngữ tinh tế, trả lời không quá dài nhưng đủ để cuộc trò chuyện không bị mất cảm giác.
`;

  // ✅ system prompt nằm TRONG contents
  const contents = [
    {
      role: "user",
      parts: [{ text: systemPrompt.trim() }],
    },
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    {
      role: "user",
      parts: [{ text: message.trim() }],
    },
  ];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini raw error:", err);
      return res.status(response.status).json({
        error: "Lỗi Gemini API",
        detail: err,
      });
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return res.status(500).json({
        error: "Gemini không trả về nội dung",
        raw: data,
      });
    }

    res.json({ text });
  } catch (e) {
    console.error("Gemini error:", e);
    res.status(500).json({ error: e.message || "Lỗi kết nối Gemini" });
  }
});

function sanitizeVietnameseText(text) {
  return text
    // bỏ emoji
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    // đổi smart quote → quote thường
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // bỏ ký tự lạ
    .replace(/[~*_`^]/g, "")
    // gom whitespace
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/api/tts/active", async (req, res) => {
  if (!FPT_API_KEY) {
    return res.status(500).json({ error: "Thiếu FPT_API_KEY trong .env (lấy tại console.fpt.ai)" });
  }
  const { text, voice = "linhsan", format = "mp3", speed = 0 } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Cần gửi text (string)" });
  }

  const textToSpeak = text.slice(0, 5000).trim();
  const cleanText = sanitizeVietnameseText(textToSpeak);
  if (cleanText.length < 3) {
    return res.status(400).json({ error: "Văn bản tối thiểu 3 ký tự" });
  }

  try {
    // Theo doc: POST, header api-key, voice, speed; body = raw text
    const speedVal = Number(speed);
    const speedHeader = Number.isFinite(speedVal) ? String(Math.max(-3, Math.min(3, speedVal))) : "";
    const response = await fetch("https://api.fpt.ai/hmi/tts/v5", {
      method: "POST",
      headers: {
        "api-key": FPT_API_KEY,
        "voice": voice,
        "speed": speedHeader,
        "format": format === "wav" ? "wav" : "mp3",
        "Cache-Control": "no-cache",
      },
      body: cleanText,
    });

    const data = await response.json();
    if (data.error !== 0) {
      return res.status(500).json({
        error: "Lỗi FPT TTS",
        detail: data.message || data,
      });
    }

    const asyncUrl = data.async;
    if (!asyncUrl) {
      return res.status(500).json({
        error: "FPT không trả về link audio",
        raw: data,
      });
    }

    const audioBuffer = await fetchFptAudioAsync(asyncUrl);
    const audioBase64 = audioBuffer.toString("base64");
    const mime = format === "wav" ? "wav" : "mp3";
    res.json({ audio: audioBase64, format: mime });
  } catch (e) {
    console.error("FPT TTS error:", e);
    res.status(500).json({ error: e.message || "Lỗi kết nối FPT TTS" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  if (!FPT_API_KEY) console.warn("Cảnh báo: Chưa cấu hình FPT_API_KEY (console.fpt.ai)");
});
