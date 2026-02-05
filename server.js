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
const MURF_API_KEY = process.env.MURF_API_KEY;

app.post("/api/chat", async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Thiếu GEMINI_API_KEY trong .env" });
  }
  const { message, history = [] } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Cần gửi message (string)" });
  }

  // Define system prompt ở đây (có thể lấy từ .env hoặc hard-code)
  const systemPrompt = `
Bạn là một cô gái dịu dàng, thanh lịch,
Sử dụng từ ngữ tinh tế, trả lời ngắn gọn, không dài dòng, giữ sự duyên dáng và ấm áp.
Không dùng từ hiện đại lóng, giữ phong cách nữ tính cổ điển.
`;

  const contents = [
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: message.trim() }] },
  ];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
        systemInstruction: {
          role: "model",
          parts: [{ text: systemPrompt }],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({
        error: "Lỗi Gemini API",
        detail: err,
      });
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
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


app.post("/api/tts", async (req, res) => {
  if (!MURF_API_KEY) {
    return res.status(500).json({ error: "Thiếu MURF_API_KEY trong .env" });
  }
  const { text, voiceId = "en-US-natalie", format = "MP3" } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Cần gửi text (string)" });
  }

  const textToSpeak = text.slice(0, 3000);

  try {
    const response = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": MURF_API_KEY,
      },
      body: JSON.stringify({
        text: textToSpeak,
        voiceId,
        format,
        encodeAsBase64: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({
        error: "Lỗi Murf API",
        detail: err,
      });
    }

    const data = await response.json();
    const audioBase64 = data?.encodedAudio;
    if (!audioBase64) {
      return res.status(500).json({
        error: "Murf không trả về audio",
        raw: data,
      });
    }
    res.json({ audio: audioBase64, format });
  } catch (e) {1
    console.error("Murf error:", e);
    res.status(500).json({ error: e.message || "Lỗi kết nối Murf" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  if (!GEMINI_API_KEY) console.warn("Cảnh báo: Chưa cấu hình GEMINI_API_KEY");
  if (!MURF_API_KEY) console.warn("Cảnh báo: Chưa cấu hình MURF_API_KEY");
});
