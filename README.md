# AVMoic – Chat + Giọng nói

Website chat đơn giản: **Gemini** trả lời, **Murf API** chuyển câu trả lời thành âm thanh.

## Yêu cầu

- Node.js 18+
- API key [Gemini](https://aistudio.google.com/apikey)
- API key [Murf](https://murf.ai/api/dashboard)

## Cài đặt

```bash
npm install
cp .env.example .env
```

Chỉnh file `.env`:

- `GEMINI_API_KEY` – API key từ Google AI Studio
- `MURF_API_KEY` – API key từ Murf API Dashboard
- `PORT` – cổng chạy server (mặc định 3000)

## Chạy

```bash
npm start
```

Mở trình duyệt: **http://localhost:3000**

- Gõ tin nhắn và gửi → Gemini trả lời.
- Bấm nút loa bên cạnh câu trả lời → Murf TTS phát âm thanh.

## API (backend)

- `POST /api/chat` – body: `{ "message": "...", "history": [] }` → trả về `{ "text": "..." }`
- `POST /api/tts` – body: `{ "text": "...", "voiceId": "en-US-natalie", "format": "MP3" }` → trả về `{ "audio": "<base64>", "format": "MP3" }`

## Cấu trúc

- `server.js` – Express: proxy Gemini + Murf, phục vụ file tĩnh
- `public/index.html` – Giao diện chat và nút phát TTS
# AVMoic
