import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-3.5-flash";

const ALLOWED_DOC_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origin === "null") return cb(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        return cb(null, true);
      cb(Object.assign(new Error("Not allowed by CORS"), { status: 403 }));
    },
  }),
);

app.use("/api", (req, res, next) => {
  if (!process.env.API_SECRET) return next();
  if (req.header("x-api-key") !== process.env.API_SECRET)
    return res.status(401).json({ error: "Unauthorized" });
  next();
});

app.use(
  "/api",
  rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true }),
);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.post("/generate-text", async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });
    if (typeof prompt !== "string" || prompt.length > 4000)
      return res
        .status(400)
        .json({ error: "Prompt must be a string up to 4000 chars" });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/generate-image", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!req.file)
      return res.status(400).json({ error: "Image file is required" });
    if (!req.file.mimetype.startsWith("image/"))
      return res.status(400).json({ error: "Only image files are allowed" });

    const base64Image = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { text: prompt ?? "", type: "text" },
        { inlineData: { data: base64Image, mimeType: req.file.mimetype } },
      ],
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/generate-document", upload.single("document"), async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!req.file)
      return res.status(400).json({ error: "Document file is required" });
    if (!ALLOWED_DOC_MIMETYPES.includes(req.file.mimetype))
      return res.status(400).json({ error: "Unsupported document type" });

    const base64Document = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          text:
            prompt && typeof prompt === "string" && prompt.length <= 4000
              ? prompt
              : "Tolong buatkan ringkasan dari dokumen berikut ini!",
          type: "text",
        },
        { inlineData: { data: base64Document, mimeType: req.file.mimetype } },
      ],
    });

    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/generate-audio", upload.single("audio"), async (req, res) => {
  try {
    const { prompt } = req.body ?? {};
    if (!req.file)
      return res.status(400).json({ error: "Audio file is required" });
    if (!req.file.mimetype.startsWith("audio/"))
      return res.status(400).json({ error: "Only audio files are allowed" });

    const base64Audio = req.file.buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          text:
            prompt && typeof prompt === "string" && prompt.length <= 4000
              ? prompt
              : "Tolong buatkan transkrip dari rekaman berikut ini!",
          type: "text",
        },
        { inlineData: { data: base64Audio, mimeType: req.file.mimetype } },
      ],
    });
    res.status(200).json({ result: response.text });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { conversation } = req.body ?? {};
    if (!Array.isArray(conversation))
      return res.status(400).json({ error: "Messages must be an array" });
    if (conversation.length === 0)
      return res.status(400).json({ error: "Conversation cannot be empty" });
    if (conversation.length > 20)
      return res.status(400).json({ error: "Conversation too long" });

    const contents = conversation.map(({ role, text }) => {
      if (role !== "user" && role !== "model")
        throw { status: 400, message: "Invalid message role" };
      if (typeof text !== "string" || text.length > 4000)
        throw { status: 400, message: "Invalid message text" };
      return { role, parts: [{ text }] };
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `
Nama Anda adalah Ztravel, asisten travel berpengalaman 10 tahun yang ramah, antusias, dan profesional ✈️.
Gunakan bahasa yang natural, sopan, dan sampaikan semua jawaban sepadat serta seefisien mungkin tanpa berbelit-belit. Gunakan emotikon yang relevan agar percakapan terasa hidup 🧳.

BATASAN TOPIK (STRICT):
1. HANYA jawab pertanyaan terkait travel, destinasi wisata, rekomendasi tempat, dan perencanaan liburan.
2. Jika pengguna bertanya di luar topik travel, tolak secara sopan dan singkat: "Maaf, Ztravel hanya fokus membantu perencanaan liburan dan destinasi wisata. Ada tempat impian yang ingin Anda kunjungi? ✈️" lalu arahkan kembali ke topik wisata.

ALUR RESPONS (Sangat Padat & Ringkas):
1. Jika pengguna BELUM menyebutkan destinasi atau durasi:
   - Sapa ramah & kenalkan diri singkat sebagai Ztravel.
   - Tanyakan destinasi dan durasi liburannya.

2. Jika pengguna SUDAH memberikan destinasi dan durasi:
   - Buatkan itinerary harian yang terstruktur, padat, dan nyaman.
   - Sertakan rincian perkiraan budget singkat (akomodasi, transportasi lokal, tiket masuk, dan konsumsi harian).
   - Berikan catatan 1 kalimat bahwa angka budget bersifat estimasi dan dapat berubah.
`,
      },
    });
    res.status(200).json({ result: response.text });
  } catch (e) {
    console.error(e);
    const status = typeof e.status === "number" ? e.status : 500;
    if (status >= 500)
      return res.status(500).json({ error: "Internal server error" });
    res
      .status(status)
      .json({ error: "Gemini API error, please try again later" });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  if (err.status === 403)
    return res.status(403).json({ error: "Not allowed by CORS" });
  if (err.status === 400) return res.status(400).json({ error: "Bad request" });
  if (err instanceof multer.MulterError)
    return res.status(400).json({
      error:
        err.code === "LIMIT_FILE_SIZE" ? "File too large (max 10MB)" : err.code,
    });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, HOST, () =>
  console.log(`Server Ready on http://${HOST}:${PORT}`),
);
