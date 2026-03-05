import express from "express";
import cors from "cors";

const app = express();

const ALLOWED_ORIGINS = [
  "https://film-receipt.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    // allow all localhost (any port) for local dev
    if (!origin || origin.startsWith("http://localhost:") || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
}));
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

app.post("/api/claude", async (req, res) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
