import { useState, useEffect } from "react";

// ─── RESPONSIVE HOOK ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── API KEYS ────────────────────────────────────────────────────────────────
const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NDdiOWRlZTFkYjU2OGIzZjUxMmQ1YmI5NjNmMWQ0NCIsIm5iZiI6MTc3MjQzNDQwMi4wNzAwMDAyLCJzdWIiOiI2OWE1MzNlMjFjZTA4ZjA4OWE0MThkOWQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.bJ66RQfu9YwKpH0AMH3Oy1IGQ5rcU8CdOpM6E319Pbs";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";

// ─── MOODS ───────────────────────────────────────────────────────────────────
const MOODS = [
  { id: "happy",     label: "Happy",     emoji: "✨", color: "#FFD700", desc: "Feeling bright & joyful",    searchQuery: "feeling happy and cheerful, want uplifting feel-good movies" },
  { id: "sad",       label: "Sad",       emoji: "🌧",  color: "#6EA8D4", desc: "Need a good cry or comfort", searchQuery: "feeling sad and need warmth and emotional comfort" },
  { id: "depressed", label: "Depressed", emoji: "🌫",  color: "#9B8EA8", desc: "Feeling heavy & low",        searchQuery: "feeling depressed, heavy, and need hope and healing" },
  { id: "anxious",   label: "Anxious",   emoji: "🌀",  color: "#7EC8A4", desc: "Mind won't stop racing",     searchQuery: "feeling anxious and overwhelmed, need calm and stillness" },
  { id: "angry",     label: "Angry",     emoji: "🔥",  color: "#E8735A", desc: "Need to release tension",    searchQuery: "feeling angry and frustrated, need cathartic release" },
  { id: "numb",      label: "Numb",      emoji: "🤍",  color: "#B0B0B0", desc: "Feeling disconnected",       searchQuery: "feeling numb and disconnected, need to feel something again" },
];

// ─── CURATED QUOTES for well-known TMDb IDs ──────────────────────────────────
const KNOWN_QUOTES = {
  194:    "Times are hard for dreamers.",
  129:    "Once you meet someone, you never really forget them.",
  489:    "It's not your fault.",
  150540: "Crying helps me slow down and obsess over the weight of life's problems.",
  8392:   "When you're scared, the magic gets inside you.",
  496243: "You know what kind of plan never fails? No plan at all.",
  153:    "The more you know who you are, the less you let things upset you.",
  38365:  "Meet me in Montauk.",
  152601: "The past is just a story we tell ourselves.",
  120467: "There are still faint glimmers of civilization left in this barbaric slaughterhouse.",
  773:    "A real loser is someone so afraid of not winning, they don't even try.",
  370755: "Sometimes an empty page presents the most possibilities.",
  116745: "To see the world, things dangerous to come to — to draw closer, to find each other.",
  155304: "We're all travelling through time together, every day of our lives.",
  2582802:"There are no two words more harmful than 'good job'.",
  4935:   "Even miracles take a little time.",
  62:     "To infinity and beyond.",
  129798: "Adventure is out there!",
  10193:  "The only way to get what you want in this world is through hard work.",
};

// ─── TMDb helpers ─────────────────────────────────────────────────────────────
async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`TMDb error ${res.status}`);
  return res.json();
}

async function getGenreMap() {
  const data = await tmdbFetch("/genre/movie/list", { language: "en-US" });
  return Object.fromEntries((data.genres || []).map(g => [g.id, g.name]));
}

async function getProviders(tmdbId) {
  try {
    const data = await tmdbFetch(`/movie/${tmdbId}/watch/providers`);
    const region = data.results?.US || data.results?.GB || Object.values(data.results || {})[0];
    if (!region) return "Check JustWatch";
    const all = [...(region.flatrate || []), ...(region.buy || [])];
    if (!all.length) return "Check JustWatch";
    return [...new Set(all.slice(0, 3).map(p => p.provider_name))].join(", ");
  } catch { return "Check JustWatch"; }
}

// ─── Claude API (via Render proxy) ───────────────────────────────────────────
const CLAUDE_SERVER = "https://film-receipt-api.onrender.com/api/claude";

async function askClaude(feeling, exclude = []) {
  const system = `You are a movie recommendation assistant. Suggest 4 movies that match the user's mood.
Return ONLY a JSON array. No markdown, no extra text.
Format: [{"title":"...","year":2000,"genre":"...","quote":"...","reason":"...","description":"..."}]
Rules: real movies shown in cinemas only. quote under 120 chars. reason under 80 chars. description = 1-2 sentences about the plot under 120 chars.`;

  const excludeNote = exclude.length > 0
    ? `I'm feeling: ${feeling}\n\nDo NOT suggest any of these films: ${exclude.join(", ")}. Suggest 4 completely different movies.`
    : `I'm feeling: ${feeling}`;

  const res = await fetch(CLAUDE_SERVER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: excludeNote }],
    }),
  });

  if (!res.ok) {
    let code = res.status;
    try { const e = await res.json(); code = e?.error?.code || code; } catch (_) {}
    throw new Error(`Claude API ${code}`);
  }

  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "[]";
  const cleaned = text.replace(/^```json/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function enrichWithTMDb(claudeMovies, genreMap) {
  return Promise.all(claudeMovies.map(async m => {
    try {
      const search = await tmdbFetch("/search/movie", { query: m.title, language: "en-US", include_adult: false });
      const match = (search.results || []).find(r =>
        r.title?.toLowerCase() === m.title.toLowerCase() ||
        Math.abs(((r.release_date || "").slice(0, 4) | 0) - m.year) <= 1
      ) || search.results?.[0];
      if (!match) return { ...m, poster: "", watch: "Check JustWatch", fromAPI: true };
      const watch = await getProviders(match.id);
      const genre = (match.genre_ids || []).slice(0, 2).map(id => genreMap[id]).filter(Boolean).join(" / ") || m.genre;
      return { ...m, tmdb_id: match.id, poster: match.poster_path ? TMDB_IMG + match.poster_path : "", genre, rating: match.vote_average?.toFixed(1) || null, watch, fromAPI: true };
    } catch { return { ...m, poster: "", watch: "Check JustWatch", fromAPI: true }; }
  }));
}

// ─── Receipt Printer ──────────────────────────────────────────────────────────
function buildReceiptLines(movie) {
  const quoteWords = (movie.quote || "A film worth watching.").split(" ");
  const quoteLines = [];
  let cur = "";
  for (const word of quoteWords) {
    if (!cur) { cur = word; }
    else if ((cur + " " + word).length <= 22) { cur += " " + word; }
    else { quoteLines.push({ t: "quote", v: cur }); cur = word; }
  }
  if (cur) quoteLines.push({ t: "quote", v: cur });
  const all = [];
  all.push({ t: "div",    v: "━━━━━━━━━━━━━━━━━━━━━━" });
  all.push({ t: "banner", v: "✦  FILM  RECEIPT  ✦" });
  all.push({ t: "div",    v: "━━━━━━━━━━━━━━━━━━━━━━" });
  all.push({ t: "head",   v: (movie.title || "").toUpperCase() });
  all.push({ t: "sub",    v: `${movie.year || ""}  ·  ${movie.genre || ""}` });
  if (movie.rating) all.push({ t: "sub", v: `★ ${movie.rating} / 10` });
  all.push({ t: "gap",    v: "" });
  all.push({ t: "label",  v: "QUOTE:" });
  quoteLines.forEach(l => all.push(l));
  all.push({ t: "gap",    v: "" });
  all.push({ t: "label",  v: "WHERE TO WATCH:" });
  all.push({ t: "sub",    v: movie.watch || "Check JustWatch" });
  all.push({ t: "gap",    v: "" });
  all.push({ t: "div",    v: "━━━━━━━━━━━━━━━━━━━━━━" });
  all.push({ t: "footer", v: "may this film heal you" });
  all.push({ t: "div",    v: "━━━━━━━━━━━━━━━━━━━━━━" });
  return all;
}

function lineHeight(line) {
  return line.t === "div" ? 16 : line.t === "gap" ? 10 : 23;
}

function ReceiptPrinter({ movie, printing, receiptKey, savedLines, onSave }) {
  const [lines, setLines] = useState([]);
  const [paperHeight, setPaperHeight] = useState(0);

  useEffect(() => {
    if (!movie) return;
    // Restore instantly if we already printed this movie before
    const validSaved = savedLines && savedLines.length > 0 && savedLines.every(l => l && l.t);
    if (validSaved) {
      const fullHeight = savedLines.reduce((h, l) => h + lineHeight(l), 0);
      setLines(savedLines);
      setPaperHeight(fullHeight);
      return;
    }
    // Fresh print animation
    setLines([]);
    setPaperHeight(0);
    if (!printing) return;
    const all = buildReceiptLines(movie);
    let i = 0;
    const iv = setInterval(() => {
      if (i < all.length) {
        const line = all[i];
        const isLast = i === all.length - 1;
        setLines(p => {
          const next = [...p, line];
          if (isLast && onSave) onSave(next);
          return next;
        });
        setPaperHeight(p => p + lineHeight(line));
        i++;
      } else clearInterval(iv);
    }, 65);
    return () => clearInterval(iv);
  }, [receiptKey]);

  const S = {
    div:    { fontFamily: "monospace",                                           fontSize: 8,  color: "#bbb", letterSpacing: 0.3, lineHeight: "16px" },
    banner: { fontFamily: "monospace", fontSize: 10, color: "#1a1a1a", fontWeight: 700, letterSpacing: 3, textAlign: "center", lineHeight: "23px", display: "block", width: "100%" },
    head:   { fontFamily: "monospace",                                           fontSize: 11, color: "#1a1a1a", fontWeight: 700, letterSpacing: 0.8, lineHeight: "23px" },
    sub:    { fontFamily: "monospace",                                           fontSize: 9,  color: "#555",    letterSpacing: 0.3, lineHeight: "23px" },
    label:  { fontFamily: "monospace",                                           fontSize: 8,  color: "#aaa",    letterSpacing: 2, textTransform: "uppercase", lineHeight: "23px" },
    quote:  { fontFamily: "monospace", fontWeight: 700, fontSize: 10.5, color: "#1a1a1a", lineHeight: "22px", letterSpacing: 0.3 },
    footer: { fontFamily: "monospace", fontSize: 8, color: "#999", letterSpacing: 2, textAlign: "center", fontStyle: "italic", lineHeight: "23px", display: "block", width: "100%" },
    gap:    { lineHeight: "10px" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Printer body */}
      <div style={{
        width: 192, height: 88,
        background: "linear-gradient(180deg,#ece4d8 0%,#d8ccbc 100%)",
        borderRadius: 8, border: "3px solid #2a2a2a", zIndex: 2, position: "relative",
        boxShadow: "4px 4px 0px #2a2a2a",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        <div style={{ width: 134, height: 9, background: "#2a2a2a", borderRadius: 2 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {[printing ? "#ff4444" : "#44ff88", "#ffcc00", "#ccc"].map((bg, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: bg, border: "2px solid #2a2a2a", boxShadow: i === 0 ? `0 0 8px ${bg}` : "none", transition: "all 0.4s" }} />
          ))}
        </div>
        <div style={{ fontSize: 7, fontFamily: "monospace", color: "#888", letterSpacing: 3 }}>FILM RECEIPT 3000</div>
      </div>
      {/* Paper */}
      <div style={{ width: 172, background: "linear-gradient(180deg,#fffef9 0%,#fdf6e8 100%)", borderLeft: "1px solid #ddd", borderRight: "1px solid #ddd", height: paperHeight, overflow: "hidden", transition: "height 0.06s linear", zIndex: 1, marginTop: -2 }}>
        <div style={{ padding: "10px 10px 6px" }}>
          {lines.filter(l => l && l.t && S[l.t]).map((line, i) => (
            <div key={i} style={{ ...(S[line.t] || S.sub), whiteSpace: "pre-wrap" }}>{line.v || "\u00A0"}</div>
          ))}
        </div>
      </div>
      {/* Torn edge */}
      {lines.length > 0 && (
        <svg viewBox="0 0 172 14" style={{ width: 172, display: "block", marginTop: -1 }}>
          <path d="M0,0 Q9,14 18,7 Q27,0 36,9 Q45,18 54,7 Q63,-4 72,9 Q81,22 90,7 Q99,-8 108,8 Q117,24 126,7 Q135,-10 144,8 Q153,26 162,7 Q168,-4 172,0 L172,14 L0,14 Z"
            fill="#fdf6e8" stroke="#ddd" strokeWidth="0.5" />
        </svg>
      )}
    </div>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────
function MovieCard({ movie, active, index, total, isMobile }) {
  const mid = Math.floor(total / 2);
  const [imgError, setImgError] = useState(false);
  return (
    <div style={{
      position: "absolute", width: isMobile ? 200 : 260, height: isMobile ? 300 : 390,
      transform: `translateX(${active ? 0 : (index - mid) * 9}px) rotate(${active ? 0 : (index - mid) * 3}deg) scale(${active ? 1 : 0.91})`,
      transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      zIndex: active ? 10 : 5 - Math.abs(index - mid),
      borderRadius: 12, overflow: "hidden",
      boxShadow: active ? "8px 8px 0px #1a1a1a" : "3px 3px 0px #1a1a1a",
      border: "3px solid #1a1a1a",
    }}>
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg,#c00 0%,#7a0000 100%)", position: "relative" }}>
        {!imgError && movie.poster
          ? <img src={movie.poster} alt={movie.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={() => setImgError(true)} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>🎬</div>
        }
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.9))", padding: "36px 12px 12px" }}>
          <div style={{ background: "#FFD700", color: "#1a1a1a", display: "inline-block", fontFamily: "monospace", fontSize: 7, fontWeight: 700, padding: "2px 6px", letterSpacing: 1.5, marginBottom: 5, transform: "rotate(-1deg)", border: "1.5px solid #1a1a1a" }}>
            {movie.genre.toUpperCase()}
          </div>
          <div style={{ color: "#fff", fontFamily: "'Georgia',serif", fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{movie.title}</div>
          <div style={{ color: "#FFD700", fontFamily: "monospace", fontSize: 9, marginTop: 3 }}>
            {movie.year}{movie.rating ? `  ★ ${movie.rating}` : ""}
          </div>
        </div>
        {movie.fromAPI && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "#c00", color: "#fff", fontFamily: "monospace", fontSize: 6, padding: "2px 5px", border: "1px solid #fff", letterSpacing: 1 }}>AI PICK</div>
        )}
      </div>
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
function SearchBar({ onSearch, loading, isMobile }) {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) onSearch(val.trim()); };
  return (
    <div style={{ width: "100%", maxWidth: isMobile ? 420 : 600, marginTop: 24 }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 3, color: "#aaa", textAlign: "center", marginBottom: 8 }}>
        — OR DESCRIBE A SPECIFIC FEELING —
      </div>
      <div style={{ display: "flex", border: "2.5px solid #1a1a1a", borderRadius: 8, overflow: "hidden", boxShadow: "3px 3px 0px #1a1a1a", background: "#fff" }}>
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder='"missing someone", "starting over", "lonely at night"...'
          style={{ flex: 1, border: "none", outline: "none", padding: "12px 14px", fontFamily: "monospace", fontSize: 10, color: "#1a1a1a", background: "transparent" }}
        />
        <button onClick={submit} disabled={loading || !val.trim()} style={{
          padding: "12px 16px", background: loading ? "#888" : "#c00", color: "#fff",
          border: "none", cursor: loading ? "default" : "pointer",
          fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          borderLeft: "2px solid #1a1a1a", minWidth: 68, transition: "background 0.2s",
        }}>
          {loading ? "···" : "SEARCH"}
        </button>
      </div>
      <div style={{ marginTop: 5, fontSize: 8, fontFamily: "monospace", color: "#ccc", textAlign: "right", letterSpacing: 1 }}>
        claude ai · theatrical releases only
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const isMobile = useIsMobile();
  const [screen, setScreen] = useState("mood");
  const [selectedMood, setSelectedMood] = useState(null);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [receiptKey, setReceiptKey] = useState(0);
  const [fading, setFading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("finding your films...");
  const [genreMap, setGenreMap] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [printedSet, setPrintedSet] = useState(new Set());
  const [savedLinesMap, setSavedLinesMap] = useState({});

  useEffect(() => { getGenreMap().then(setGenreMap).catch(() => {}); }, []);

  const triggerReceipt = (index = 0) => {
    setPrinting(false);
    setTimeout(() => {
      setPrinting(true);
      setReceiptKey(k => k + 1);
      setPrintedSet(prev => new Set(prev).add(index));
    }, 200);
  };

  const showMovies = (list, mood) => {
    setMovies(list); setCurrentIndex(0);
    setSelectedMood(mood);
    setPrintedSet(new Set());
    setSavedLinesMap({});
    setScreen("movies");
    setTimeout(() => triggerReceipt(0), 500);
  };

  const selectMood = (mood) => {
    handleSearch(mood.searchQuery, mood);
  };

  const handleSearch = async (query, moodOverride) => {
    setSearchLoading(true);
    setSearchError("");
    const mood = moodOverride || { id: "search", label: query, emoji: "🔍", color: "#c00" };
    try {
      setLoadingMsg(`asking Claude about "${moodOverride ? mood.label.toLowerCase() : query}"...`);
      setSelectedMood(mood);
      setScreen("loading");
      const claudePicks = await askClaude(query);
      setLoadingMsg("fetching posters & streaming info...");
      const enriched = await enrichWithTMDb(claudePicks, genreMap);
      showMovies(enriched, mood);
    } catch (e) {
      console.error("Search error:", e);
      const msg = e.message || "";
      const friendlyError = msg.includes("529") || msg.includes("overloaded")
        ? "Too many people watching movies right now. Wait a few sec and try again!"
        : msg.includes("400")
        ? "Something went wrong with that request. Try rephrasing your feeling!"
        : msg.includes("401") || msg.includes("403")
        ? "Authentication hiccup. Please refresh the page."
        : "Couldn't reach the server just now. Take a breath and try again!";
      setSearchError(friendlyError);
      setScreen("mood");
    }
    setSearchLoading(false);
  };

  const handleRefresh = async () => {
    if (!selectedMood || refreshing) return;
    setRefreshing(true);
    const query = selectedMood.searchQuery || selectedMood.label;
    const alreadySeen = movies.map(m => m.title).filter(Boolean);
    try {
      setLoadingMsg("finding more films for you...");
      setScreen("loading");
      const claudePicks = await askClaude(query, alreadySeen);
      const enriched = await enrichWithTMDb(claudePicks, genreMap);
      showMovies(enriched, selectedMood);
    } catch (e) {
      setScreen("movies");
    }
    setRefreshing(false);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (screen !== "movies") return;
      if (e.key === "ArrowRight") goToMovie(currentIndex + 1);
      if (e.key === "ArrowLeft")  goToMovie(currentIndex - 1);
      if (e.key === " ") {
        e.preventDefault();
        if (cur) window.open(`https://www.google.com/search?q=${encodeURIComponent(cur.title + " " + (cur.year || "") + " film")}`, "_blank");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [screen, currentIndex, movies.length]);

  const goToMovie = (i) => {
    if (i >= movies.length) {
return;
    }
    if (i === currentIndex || i < 0) return;
    setFading(true); setPrinting(false);
    setTimeout(() => {
      setCurrentIndex(i);
      setFading(false);
      if (printedSet.has(i)) {
        // already printed — restore instantly, no animation needed
        setPrinting(true);
      } else {
        // first time — run the print animation
        setTimeout(() => triggerReceipt(i), 280);
      }
    }, 320);
  };

  const cur = movies[currentIndex];

  // ── MOOD SCREEN ──────────────────────────────────────────────────────────────
  if (screen === "mood") return (
    <div style={{ minHeight: "100vh", width: "100%", boxSizing: "border-box", background: "#f5f0e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? 24 : 48, fontFamily: "'Georgia',serif", backgroundImage: "radial-gradient(circle at 20% 20%,rgba(255,200,100,0.1) 0%,transparent 60%),radial-gradient(circle at 80% 80%,rgba(200,100,100,0.08) 0%,transparent 60%)" }}>
      <div style={{ textAlign: "center", marginBottom: 36, width: "100%" }}>
        <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 6, color: "#bbb", marginBottom: 10 }}>✦ FILM RECEIPT ✦</div>
        <h1 style={{ fontSize: isMobile ? 40 : 56, fontWeight: 700, color: "#1a1a1a", margin: 0, lineHeight: 1.1, letterSpacing: -1 }}>
          How are you<br /><span style={{ color: "#c00", fontStyle: "italic" }}>feeling</span> today?
        </h1>
        <div style={{ width: 60, height: 3, background: "#c00", margin: "14px auto 0", borderRadius: 2 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(6,1fr)", gap: 10, maxWidth: isMobile ? 420 : 780, width: "100%", margin: "0 auto" }}>
        {MOODS.map(mood => (
          <button key={mood.id} onClick={() => selectMood(mood)} style={{ background: "#fff", border: "2.5px solid #1a1a1a", borderRadius: 10, padding: "14px 8px", cursor: "pointer", transition: "all 0.15s", boxShadow: "3px 3px 0px #1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = "5px 5px 0px #1a1a1a"; e.currentTarget.style.background = mood.color + "22"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "3px 3px 0px #1a1a1a"; e.currentTarget.style.background = "#fff"; }}>
            <span style={{ fontSize: 26 }}>{mood.emoji}</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "#1a1a1a" }}>{mood.label}</span>
            <span style={{ fontSize: 8, color: "#888", fontFamily: "monospace", textAlign: "center", lineHeight: 1.4 }}>{mood.desc}</span>
          </button>
        ))}
      </div>

      <SearchBar onSearch={handleSearch} loading={searchLoading} isMobile={isMobile} />
      {searchError && <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 10, color: "#c00", letterSpacing: 1 }}>⚠ {searchError}</div>}
      <div style={{ marginTop: 24, fontFamily: "monospace", fontSize: 8, color: "#ccc", letterSpacing: 2, textAlign: "center" }}>THEATRICAL RELEASES ONLY · TMDB + CLAUDE AI</div>
    </div>
  );

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: "#fff" }}>
      <div style={{ fontSize: 44, marginBottom: 20, animation: "spin 1.2s linear infinite" }}>🎬</div>
      <div style={{ fontSize: 10, letterSpacing: 4, color: "#555", textTransform: "uppercase", marginBottom: 8 }}>{loadingMsg}</div>
      <div style={{ fontSize: 13, color: selectedMood?.color || "#FFD700" }}>{selectedMood?.emoji} {selectedMood?.label}</div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── MOVIES ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "24px 16px 52px" : "40px 48px 80px", backgroundImage: "radial-gradient(circle at 50% 0%,rgba(200,0,0,0.05) 0%,transparent 60%)" }}>
      {/* Top bar */}
      <div style={{ width: "100%", maxWidth: isMobile ? 700 : 1100, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <button onClick={() => { setScreen("mood"); setMovies([]); setReceiptKey(0); setPrinting(false); setPrintedSet(new Set()); setSavedLinesMap({}); }}
          style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 2, background: "none", border: "1.5px solid #1a1a1a", padding: "6px 12px", cursor: "pointer", borderRadius: 4, color: "#1a1a1a", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#1a1a1a"; }}>← BACK</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, fontFamily: "monospace", letterSpacing: 5, color: "#bbb", marginBottom: 2 }}>FILM RECEIPT</div>
          <div style={{ fontSize: 15, fontFamily: "'Georgia',serif", color: "#c00", fontWeight: 700, fontStyle: "italic" }}>{selectedMood?.emoji} {selectedMood?.label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#bbb", letterSpacing: 1 }}>{currentIndex + 1} / {movies.length}</span>
          <div style={{ boxShadow: "2px 2px 0px #1a1a1a", borderRadius: "50%", display: "inline-block" }}>
            <button onClick={handleRefresh} disabled={refreshing} title="Get new recommendations"
              style={{ width: 26, height: 26, border: "1.5px solid #1a1a1a", borderRadius: "50%", background: refreshing ? "#eee" : "#fff", cursor: refreshing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", outline: "none" }}
              onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background = "#FFD700"; e.currentTarget.querySelector("span").style.transform = "rotate(180deg)"; }}}
              onMouseLeave={e => { e.currentTarget.style.background = refreshing ? "#eee" : "#fff"; e.currentTarget.querySelector("span").style.transform = "rotate(0deg)"; }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1, transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)", transform: "rotate(0deg)", marginTop: "-1px" }}>
                {refreshing ? "·" : "↻"}
              </span>
            </button>
          </div>
          <span style={{ fontSize: 8, fontFamily: "monospace", color: "#888", letterSpacing: 2, marginTop: 2 }}>REFRESH</span>
        </div>
      </div>

      {/* Cards + Printer */}
      <div style={{ display: "flex", gap: isMobile ? 44 : 80, alignItems: "flex-start", justifyContent: "center", width: "100%", maxWidth: isMobile ? 700 : 1100, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ position: "relative", width: isMobile ? 200 : 260, height: isMobile ? 300 : 390 }}>
            {movies.map((m, i) => <MovieCard key={m.tmdb_id || m.title + i} movie={m} active={i === currentIndex} index={i} total={movies.length} isMobile={isMobile} />)}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => goToMovie(currentIndex - 1)} disabled={currentIndex === 0}
              style={{ width: 30, height: 30, border: "2px solid #1a1a1a", borderRadius: "50%", background: currentIndex === 0 ? "#eee" : "#1a1a1a", color: currentIndex === 0 ? "#bbb" : "#fff", cursor: currentIndex === 0 ? "default" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 }}>←</button>
            {movies.map((_, i) => (
              <div key={i} onClick={() => goToMovie(i)} style={{ width: i === currentIndex ? 22 : 8, height: 8, borderRadius: 4, background: i === currentIndex ? "#c00" : "#ccc", cursor: "pointer", transition: "all 0.3s", border: "1.5px solid #1a1a1a" }} />
            ))}
            <button onClick={() => goToMovie(currentIndex + 1)} disabled={currentIndex === movies.length - 1}
              style={{ width: 30, height: 30, border: "2px solid #1a1a1a", borderRadius: "50%", background: currentIndex === movies.length - 1 ? "#eee" : "#1a1a1a", color: currentIndex === movies.length - 1 ? "#bbb" : "#fff", cursor: currentIndex === movies.length - 1 ? "default" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 }}>→</button>
          </div>
          {cur && (
            <a href={`https://www.google.com/search?q=${encodeURIComponent(cur.title + " " + (cur.year || "") + " film")}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "2px solid #1a1a1a", borderRadius: 6, padding: "8px 14px", fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#1a1a1a", textDecoration: "none", boxShadow: "3px 3px 0px #1a1a1a", transition: "all 0.15s", opacity: fading ? 0 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = "5px 5px 0px #1a1a1a"; e.currentTarget.style.background = "#f5f0e8"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "3px 3px 0px #1a1a1a"; e.currentTarget.style.background = "#fff"; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              SEARCH ON GOOGLE
            </a>
          )}
        </div>

        <div style={{ opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}>
          {cur && <ReceiptPrinter key={currentIndex} movie={cur} printing={printing} receiptKey={receiptKey} savedLines={printedSet.has(currentIndex) ? (savedLinesMap[currentIndex] || null) : null} onSave={lines => setSavedLinesMap(prev => ({ ...prev, [currentIndex]: lines }))} />}
        </div>
      </div>

      {/* Reason tag */}
      {cur && (
        <div style={{ marginTop: 28, maxWidth: isMobile ? 440 : 700, textAlign: "center", opacity: fading ? 0 : 1, transition: "opacity 0.4s ease 0.15s" }}>
          <div style={{ background: "#FFD700", border: "2px solid #1a1a1a", padding: "10px 18px", borderRadius: 6, fontFamily: "monospace", fontSize: 10, letterSpacing: 0.5, boxShadow: "3px 3px 0px #1a1a1a", maxWidth: 380, lineHeight: 1.7, textAlign: "center" }}>
            💛 {cur.description || cur.reason}
          </div>
        </div>
      )}
    </div>
  );
}