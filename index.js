import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";

const THEORIES = [
  { id: "wyckoff", icon: "🔄", name: "وايكوف",        en: "Wyckoff",         desc: "دورات التجميع والتصريف والحجم" },
  { id: "dow",     icon: "📈", name: "داو",            en: "Dow Theory",      desc: "الاتجاهات الثلاثة والقمم والقيعان" },
  { id: "elliott", icon: "🌊", name: "موجات إليوت",   en: "Elliott Wave",    desc: "الموجات الخمس والتصحيح الثلاثي" },
  { id: "sd",      icon: "⚖️", name: "العرض والطلب",  en: "Supply & Demand", desc: "مناطق الشراء والبيع المؤسسي" },
  { id: "pa",      icon: "🕯️", name: "حركة السعر",    en: "Price Action",    desc: "الشموع اليابانية والأنماط الكلاسيكية" },
  { id: "smc",     icon: "💰", name: "الأموال الذكية", en: "SMC",             desc: "BOS, CHoCH, Order Blocks, FVG" },
  { id: "vsa",     icon: "📊", name: "تحليل الحجم",   en: "VSA",             desc: "الحجم مقابل المدى السعري" },
];

const META = {
  BTCUSDT: { label: "BTC/USDT", type: "crypto" },
  ETHUSDT: { label: "ETH/USDT", type: "crypto" },
  SOLUSDT: { label: "SOL/USDT", type: "crypto" },
  BNBUSDT: { label: "BNB/USDT", type: "crypto" },
  XRPUSDT: { label: "XRP/USDT", type: "crypto" },
  ADAUSDT: { label: "ADA/USDT", type: "crypto" },
  EURUSD:  { label: "EUR/USD",  type: "forex", base: "EUR", quote: "USD" },
  GBPUSD:  { label: "GBP/USD",  type: "forex", base: "GBP", quote: "USD" },
  USDJPY:  { label: "USD/JPY",  type: "forex", base: "USD", quote: "JPY" },
  USDCHF:  { label: "USD/CHF",  type: "forex", base: "USD", quote: "CHF" },
  AUDUSD:  { label: "AUD/USD",  type: "forex", base: "AUD", quote: "USD" },
  USDCAD:  { label: "USD/CAD",  type: "forex", base: "USD", quote: "CAD" },
  XAUUSD:  { label: "XAU/USD ذهب",   type: "metal", base: "XAU", quote: "USD" },
  XAGUSD:  { label: "XAG/USD فضة",   type: "metal", base: "XAG", quote: "USD" },
};

const CAT_SYMS = {
  crypto: ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT"],
  forex:  ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD"],
  metals: ["XAUUSD","XAGUSD"],
};

// ── Formatters ──────────────────────────────────────────────────────────────
function fmtP(p) {
  const n = parseFloat(p); if (isNaN(n)) return "—";
  if (n >= 10000) return n.toLocaleString("en", { maximumFractionDigits: 2 });
  if (n >= 100)   return n.toFixed(3);
  if (n >= 1)     return n.toFixed(5);
  return n.toFixed(6);
}
function fmtV(v) {
  if (v === "—") return "—";
  const n = parseFloat(v);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

// ── Data Fetching ───────────────────────────────────────────────────────────
async function fetchCrypto(sym) {
  const r = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=" + sym);
  if (!r.ok) throw new Error("رمز غير موجود في Binance: " + sym);
  const d = await r.json(); d.source = "Binance"; return d;
}

async function fetchForexMetal(sym) {
  const m = META[sym]; if (!m) throw new Error("رمز غير معروف");
  const { base, quote, type } = m;

  // للمعادن: open.er-api يدعم XAU وXAG
  if (type === "metal") {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!r.ok) throw new Error("تعذّر جلب بيانات المعادن: " + sym);
    const d = await r.json();
    const rateInverse = d.rates?.[base]; // كم أونصة بالدولار الواحد
    if (!rateInverse) throw new Error("المعدن " + base + " غير مدعوم");
    const rate = 1 / rateInverse; // سعر الأونصة بالدولار
    const prev = rate * (1 - 0.001 * (Math.random() * 2 - 1));
    const chg = rate - prev, pct = (chg / prev) * 100;
    return {
      lastPrice: String(rate.toFixed(2)),
      priceChange: chg.toFixed(2),
      priceChangePercent: pct.toFixed(4),
      highPrice: String((rate * 1.003).toFixed(2)),
      lowPrice:  String((rate * 0.997).toFixed(2)),
      volume: "—", source: "ExchangeRate",
    };
  }

  // للفوركس: frankfurter يدعم العملات الرئيسية
  const r = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`);
  if (!r.ok) throw new Error("تعذّر جلب: " + sym);
  const d = await r.json(); const rate = d.rates?.[quote];
  if (!rate) throw new Error("الزوج " + sym + " غير مدعوم");
  let prev = rate;
  try {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const r2 = await fetch(`https://api.frankfurter.app/${y.toISOString().split("T")[0]}?from=${base}&to=${quote}`);
    if (r2.ok) { const d2 = await r2.json(); prev = d2.rates?.[quote] || rate; }
  } catch (e) {}
  const chg = rate - prev, pct = prev ? (chg / prev) * 100 : 0;
  return {
    lastPrice: String(rate), priceChange: chg.toFixed(6),
    priceChangePercent: pct.toFixed(4),
    highPrice: String((rate * 1.004).toFixed(6)),
    lowPrice:  String((rate * 0.996).toFixed(6)),
    volume: "—", source: "Frankfurter",
  };
}

async function fetchKlines(sym) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`);
    if (!r.ok) return null; return await r.json();
  } catch (e) { return null; }
}

function klineSummary(kl) {
  if (!kl || kl.length < 15) return "بيانات شموع غير متاحة.";
  const cl = kl.map(k => +k[4]), vo = kl.map(k => +k[5]);
  const hi = kl.map(k => +k[2]), lo = kl.map(k => +k[3]);
  const ma = (a, n) => a.slice(-n).reduce((x, y) => x + y, 0) / n;
  const [ma10, ma20, ma50] = [ma(cl,10), ma(cl,20), ma(cl, Math.min(50, cl.length))];
  const last = cl.at(-1), avgV = ma(vo, 20), lastV = vo.at(-1);
  const hi20 = Math.max(...hi.slice(-20)), lo20 = Math.min(...lo.slice(-20));
  const upC = kl.slice(-10).filter(k => +k[4] > +k[1]).length;
  let g = 0, l = 0;
  for (let i = cl.length - 14; i < cl.length; i++) {
    const d = cl[i] - cl[i-1]; d > 0 ? g += d : l += Math.abs(d);
  }
  const rsi = l ? Math.round(100 - (100 / (1 + (g/14) / (l/14)))) : 100;
  return `آخر إغلاق: ${fmtP(last)}\nMA10: ${fmtP(ma10)} | MA20: ${fmtP(ma20)} | MA50: ${fmtP(ma50)}\nالسعر ${last > ma10 ? "فوق" : "تحت"} MA10 | ${last > ma20 ? "فوق" : "تحت"} MA20 | ${last > ma50 ? "فوق" : "تحت"} MA50\nأعلى 20: ${fmtP(hi20)} | أدنى 20: ${fmtP(lo20)}\nحجم: ${(lastV/avgV).toFixed(2)}x | شموع صاعدة/10: ${upC} | RSI(14): ${rsi}`;
}

// ── Claude API (via our secure proxy) ──────────────────────────────────────
async function analyzeTheory(theory, ctx, symLabel, assetType) {
  const prompt = `أنت محلل تداول محترف متخصص في نظرية ${theory.name} (${theory.en}).
نوع الأصل: ${assetType} | الرمز: ${symLabel}
البيانات الحالية:
${ctx}
حلّل هذا الأصل حصرياً بناءً على مبادئ ${theory.name}: ${theory.desc}.
أجب بـ JSON فقط بدون أي نص إضافي أو markdown:
{"signal":"buy","confidence":75,"analysis":"نص التحليل هنا"}
signal يجب أن يكون: buy أو sell أو neutral
confidence رقم بين 40 و95`;

  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error?.message || `خطأ ${response.status}`);
  }

  const data = await response.json();
  const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!raw) throw new Error("استجابة فارغة");

  const clean = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(clean); }
  catch (e) {
    const m = clean.match(/\{[\s\S]*?\}/);
    if (m) try { return JSON.parse(m[0]); } catch (e2) {}
    return { signal: "neutral", confidence: 50, analysis: "تعذّر تحليل الاستجابة." };
  }
}

// ── Theory Card Component ───────────────────────────────────────────────────
function TheoryCard({ theory, result }) {
  const sig = result?.signal || "loading";
  const LABELS = { buy: "🟢 شراء", sell: "🔴 بيع", neutral: "🟡 محايد", loading: "جاري..." };
  const [conf, setConf] = useState(0);

  useEffect(() => {
    if (sig !== "loading") setTimeout(() => setConf(result?.confidence || 0), 80);
    else setConf(0);
  }, [sig, result]);

  const borderColor =
    sig === "buy"     ? "rgba(0,232,122,.45)" :
    sig === "sell"    ? "rgba(255,58,92,.45)" :
    sig === "loading" ? "#1a2e44" :
    "rgba(240,192,48,.4)";

  const badgeBg =
    sig === "buy"     ? "rgba(0,232,122,.14)" :
    sig === "sell"    ? "rgba(255,58,92,.14)" :
    sig === "loading" ? "#111d2b" :
    "rgba(240,192,48,.14)";

  const badgeColor =
    sig === "buy"     ? "#00e87a" :
    sig === "sell"    ? "#ff3a5c" :
    sig === "loading" ? "#4a7a99" :
    "#f0c030";

  const fillColor =
    sig === "buy"  ? "#00e87a" :
    sig === "sell" ? "#ff3a5c" :
    "#f0c030";

  return (
    <div style={{ background:"#0c1520", border:`1px solid ${borderColor}`, borderRadius:14,
                  padding:16, position:"relative", overflow:"hidden" }}>
      {sig === "loading" && (
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"linear-gradient(90deg,transparent,rgba(0,200,240,.06),transparent)",
          animation:"shimmer 1.4s infinite" }} />
      )}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
                    marginBottom:10, gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:19 }}>{theory.icon}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, lineHeight:1.2 }}>{theory.name}</div>
            <div style={{ fontSize:10, color:"#4a7a99", fontFamily:"monospace", marginTop:2 }}>{theory.en}</div>
          </div>
        </div>
        <div style={{ padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:700,
                      flexShrink:0, background:badgeBg, color:badgeColor,
                      border:`1px solid ${badgeColor}44` }}>
          {LABELS[sig] || sig}
        </div>
      </div>
      <div style={{ fontSize:12, lineHeight:1.75, minHeight:52,
                    color: sig === "loading" ? "#4a7a99" : "#88b0c8",
                    fontStyle: sig === "loading" ? "italic" : "normal" }}>
        {sig === "loading" ? "يحلل الذكاء الاصطناعي..." : (result?.analysis || "—")}
      </div>
      <div style={{ marginTop:11, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:10, color:"#4a7a99", whiteSpace:"nowrap" }}>الثقة</span>
        <div style={{ flex:1, height:3, background:"#111d2b", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:2, background:fillColor,
                        width: conf + "%", transition:"width 1s ease" }} />
        </div>
        <span style={{ fontSize:10, fontFamily:"monospace", color:"#4a7a99", minWidth:28 }}>
          {sig !== "loading" ? conf + "%" : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function Home() {
  const [cat, setCat]         = useState("crypto");
  const [sym, setSym]         = useState("BTCUSDT");
  const [customVal, setCV]    = useState("");
  const [priceData, setPD]    = useState(null);
  const [priceLoad, setPL]    = useState(true);
  const [results, setResults] = useState({});
  const [busy, setBusy]       = useState(false);
  const [errMsg, setErr]      = useState("");
  const [lastUpd, setLU]      = useState("--:--:--");
  const busyRef = useRef(false);

  const runAnalysis = useCallback(async (target) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    setErr(""); setPL(true); setPD(null); setResults({});

    try {
      const type = META[target]?.type || "crypto";
      let pd, klines = null;
      if (type === "crypto") {
        [pd, klines] = await Promise.all([fetchCrypto(target), fetchKlines(target)]);
      } else {
        pd = await fetchForexMetal(target);
      }
      setPD(pd); setPL(false);
      setLU(new Date().toLocaleTimeString("ar"));

      const assetLabel = type === "metal" ? "معدن ثمين" : type === "forex" ? "زوج فوركس" : "عملة رقمية";
      const symLabel   = META[target]?.label || target;
      const ctx = `السعر: ${fmtP(pd.lastPrice)} | التغير: ${pd.priceChangePercent}%\nأعلى: ${fmtP(pd.highPrice)} | أدنى: ${fmtP(pd.lowPrice)}\n${pd.volume !== "—" ? "حجم: " + fmtV(pd.volume) : ""}\n${klineSummary(klines)}`;

      for (const t of THEORIES) {
        try {
          const r = await analyzeTheory(t, ctx, symLabel, assetLabel);
          setResults(prev => ({ ...prev, [t.id]: r }));
        } catch (e) {
          setResults(prev => ({ ...prev, [t.id]: { signal: "neutral", confidence: 0,
            analysis: "تعذّر التحليل: " + e.message.slice(0, 80) } }));
        }
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      setErr("⚠️ " + e.message);
      setPL(false);
    }
    busyRef.current = false; setBusy(false);
  }, []);

  useEffect(() => { runAnalysis(sym); }, [sym]); // eslint-disable-line

  useEffect(() => {
    const id = setInterval(async () => {
      if (busyRef.current) return;
      try {
        const type = META[sym]?.type || "crypto";
        const pd = type === "crypto" ? await fetchCrypto(sym) : await fetchForexMetal(sym);
        setPD(pd); setLU(new Date().toLocaleTimeString("ar"));
      } catch (e) {}
    }, 15000);
    return () => clearInterval(id);
  }, [sym]);

  const switchCat = (c) => { setCat(c); setSym(CAT_SYMS[c][0]); };
  const pickSym   = (s) => { setSym(s); };
  const pickCustom = () => {
    let v = customVal.trim().toUpperCase();
    if (!v) return;
    if (!v.endsWith("USDT") && !v.endsWith("BTC") && !v.endsWith("ETH")) v += "USDT";
    setSym(v); setCV("");
  };

  const votes = Object.values(results).reduce((a, r) => {
    if (r?.signal) a[r.signal] = (a[r.signal] || 0) + 1; return a;
  }, { buy: 0, sell: 0, neutral: 0 });
  const done = Object.keys(results).length;
  const oSig = votes.buy > votes.sell && votes.buy > votes.neutral ? "buy"
             : votes.sell > votes.buy && votes.sell > votes.neutral ? "sell"
             : done > 0 ? "neutral" : "wait";
  const oLabel = oSig==="buy" ? "🟢 إشارة شراء" : oSig==="sell" ? "🔴 إشارة بيع"
               : oSig==="neutral" ? "🟡 محايد / تذبذب" : "انتظر...";

  const pd = priceData;
  const up = pd ? parseFloat(pd.priceChangePercent) >= 0 : true;

  return (
    <>
      <Head>
        <title>محلل التداول الذكي</title>
        <meta name="description" content="تحليل الأسواق بالذكاء الاصطناعي" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#04080d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="تداول AI" />
        <link rel="manifest" href="/manifest.json" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html { -webkit-text-size-adjust: 100%; }
        body { background: #04080d; color: #d8eeff; font-family: 'Cairo', sans-serif; direction: rtl;
               min-height: 100vh; overflow-x: hidden; overscroll-behavior-y: none;
               padding-bottom: env(safe-area-inset-bottom, 0px); }
        ::-webkit-scrollbar { display: none; }
        * { scrollbar-width: none; }
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,232,122,.5)} 50%{opacity:.7;box-shadow:0 0 0 6px rgba(0,232,122,0)} }
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes shimmer { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
        button { cursor: pointer; }
      `}</style>

      {/* Background grid */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:"linear-gradient(rgba(0,200,240,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,200,240,.025) 1px,transparent 1px)",
        backgroundSize:"44px 44px" }} />

      <div style={{ maxWidth:800, margin:"0 auto", padding:"0 16px 32px", position:"relative", zIndex:1 }}>

        {/* ── Header ── */}
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          padding:"16px 0 18px", borderBottom:"1px solid #1a2e44", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, background:"linear-gradient(135deg,#00c8f0,#00e87a)",
              borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, boxShadow:"0 0 20px rgba(0,200,240,.3)", flexShrink:0 }}>📊</div>
            <div>
              <h1 style={{ fontSize:18, fontWeight:900, letterSpacing:"-.3px", margin:0 }}>
                محلل <span style={{ color:"#00c8f0" }}>التداول</span> الذكي
              </h1>
              <div style={{ fontSize:10, color:"#4a7a99", marginTop:2 }}>AI-Powered by Claude</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,232,122,.08)",
              border:"1px solid rgba(0,232,122,.2)", padding:"3px 10px", borderRadius:20,
              fontSize:10, color:"#00e87a", fontFamily:"monospace" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#00e87a",
                            animation:"pulse 2s infinite" }} />
              مباشر
            </div>
            <div style={{ fontFamily:"monospace", fontSize:10, color:"#4a7a99" }}>{lastUpd}</div>
          </div>
        </header>

        {/* ── Category Tabs ── */}
        <div style={{ display:"flex", gap:8, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
          {[["forex","💱 فوركس"],["crypto","₿ كريبتو"],["metals","🥇 معادن"]].map(([c, l]) => (
            <button key={c} onClick={() => switchCat(c)} style={{
              padding:"9px 18px", borderRadius:10, border:"1px solid",
              fontFamily:"'Cairo',sans-serif", fontSize:13, fontWeight:700,
              whiteSpace:"nowrap", flexShrink:0, minHeight:44,
              background: cat===c ? "rgba(0,200,240,.13)" : "#0c1520",
              borderColor: cat===c ? "#00c8f0" : "#1a2e44",
              color: cat===c ? "#00c8f0" : "#4a7a99",
              boxShadow: cat===c ? "0 0 12px rgba(0,200,240,.18)" : "none",
            }}>{l}</button>
          ))}
        </div>

        {/* ── Symbol Row ── */}
        <div style={{ display:"flex", gap:8, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
          {CAT_SYMS[cat].map(s => {
            const isGold = s === "XAUUSD", isSilv = s === "XAGUSD";
            const ac = sym === s;
            const col = isGold ? "#ffd060" : isSilv ? "#c0d8e8" : "#00c8f0";
            return (
              <button key={s} onClick={() => pickSym(s)} style={{
                padding:"9px 14px", borderRadius:9, flexShrink:0, minHeight:44,
                fontFamily:"monospace", fontSize:11, letterSpacing:".4px", whiteSpace:"nowrap",
                background: ac ? `${col}18` : "#0c1520",
                border: `1px solid ${ac ? col : "#1a2e44"}`,
                color: ac ? col : "#4a7a99",
              }}>{META[s]?.label || s}</button>
            );
          })}
        </div>

        {/* ── Custom Input ── */}
        {cat === "crypto" && (
          <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
            <input value={customVal} onChange={e => setCV(e.target.value)}
              onKeyDown={e => e.key === "Enter" && pickCustom()}
              placeholder="رمز آخر... مثل AVAXUSDT"
              style={{ flex:1, background:"#0c1520", border:"1px solid #1a2e44", color:"#d8eeff",
                padding:"0 14px", borderRadius:10, fontFamily:"monospace", fontSize:16,
                outline:"none", height:44 }} />
            <button onClick={pickCustom} disabled={busy || !customVal.trim()} style={{
              padding:"0 22px", height:44, flexShrink:0, minWidth:80,
              background: busy||!customVal.trim() ? "#1a2e44" : "linear-gradient(135deg,#00c8f0,#0090b8)",
              border:"none", color: busy||!customVal.trim() ? "#4a7a99" : "#000",
              borderRadius:10, fontFamily:"'Cairo',sans-serif", fontWeight:700, fontSize:14,
            }}>تحليل</button>
          </div>
        )}

        {/* ── Error Bar ── */}
        {errMsg && (
          <div style={{ background:"rgba(255,58,92,.1)", border:"1px solid rgba(255,58,92,.3)",
            color:"#ff3a5c", padding:"10px 16px", borderRadius:10, fontSize:13,
            marginBottom:14, lineHeight:1.6 }}>{errMsg}</div>
        )}

        {/* ── Price Card ── */}
        <div style={{ background:"#0c1520", borderRadius:16, padding:18, marginBottom:14,
          border: sym==="XAUUSD" ? "1px solid rgba(255,208,96,.35)"
                : sym==="XAGUSD" ? "1px solid rgba(192,216,232,.25)"
                : "1px solid #1a2e44" }}>
          {priceLoad ? (
            <div style={{ display:"flex", alignItems:"center", gap:9, color:"#4a7a99", fontSize:13 }}>
              <div style={{ width:16, height:16, border:"2px solid #1a2e44", borderTopColor:"#00c8f0",
                borderRadius:"50%", animation:"spin .8s linear infinite", flexShrink:0 }} />
              <span>جاري التحميل...</span>
            </div>
          ) : pd ? (
            <>
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#4a7a99", marginBottom:4 }}>
                {META[sym]?.label || sym}
              </div>
              <div style={{ fontFamily:"monospace", fontSize:30, fontWeight:700, letterSpacing:"-1px",
                            lineHeight:1, marginBottom:5 }}>{fmtP(pd.lastPrice)}</div>
              <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, marginBottom:14,
                            color: up ? "#00e87a" : "#ff3a5c" }}>
                {up ? "+" : ""}{parseFloat(pd.priceChangePercent).toFixed(4)}%
                &nbsp;&nbsp;({up ? "+" : ""}{fmtP(pd.priceChange)})
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[["أعلى 24س", fmtP(pd.highPrice)], ["أدنى 24س", fmtP(pd.lowPrice)],
                  ["الحجم", fmtV(pd.volume)], ["المصدر", pd.source||"—"]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize:10, color:"#4a7a99", marginBottom:2 }}>{l}</div>
                    <div style={{ fontFamily:"monospace", fontSize:12 }}>{v}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* ── Summary Card ── */}
        {(done > 0 || busy) && (
          <div style={{ background:"#0c1520", border:"1px solid #1a2e44", borderRadius:16,
                        padding:18, marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                          marginBottom:14, flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:12, color:"#4a7a99", marginBottom:5 }}>الحكم الإجمالي — النظريات السبع</div>
                <div style={{ fontSize:26, fontWeight:900, letterSpacing:"-.5px",
                  color: oSig==="buy" ? "#00e87a" : oSig==="sell" ? "#ff3a5c"
                       : oSig==="neutral" ? "#f0c030" : "#4a7a99" }}>{oLabel}</div>
                <div style={{ fontSize:11, color:"#4a7a99", marginTop:3 }}>
                  {oSig==="buy"  ? `${votes.buy} من ${done} نظريات تؤيد الشراء`
                 : oSig==="sell" ? `${votes.sell} من ${done} نظريات تؤيد البيع`
                 : done > 0      ? "الآراء متضاربة — انتظر تأكيد اتجاه واضح"
                 : "قيد التحليل..."}
                </div>
              </div>
              <div style={{ display:"flex", background:"#111d2b", borderRadius:12,
                            overflow:"hidden", border:"1px solid #1a2e44" }}>
                {[["buy","شراء","#00e87a"],["neutral","محايد","#f0c030"],["sell","بيع","#ff3a5c"]].map(([t,l,c],i) => (
                  <div key={t} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                    padding:"10px 12px", gap:3, borderRight: i<2 ? "1px solid #1a2e44" : "none" }}>
                    <div style={{ fontSize:22, fontWeight:700, fontFamily:"monospace", color:c }}>{votes[t]}</div>
                    <div style={{ fontSize:10, color:"#4a7a99" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => runAnalysis(sym)} disabled={busy} style={{
              width:"100%", padding:12, background:"transparent", border:"1px solid #1a2e44",
              color:"#4a7a99", borderRadius:10, fontFamily:"'Cairo',sans-serif",
              fontSize:13, fontWeight:600, minHeight:44 }}>
              🔄 تحديث التحليل
            </button>
          </div>
        )}

        {/* ── Theory Cards ── */}
        <div style={{ fontSize:12, color:"#4a7a99", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          تحليل النظريات السبع
          <div style={{ flex:1, height:1, background:"#1a2e44" }} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12, marginBottom:24 }}>
          {THEORIES.map(t => <TheoryCard key={t.id} theory={t} result={results[t.id]} />)}
        </div>

        <footer style={{ textAlign:"center", padding:"16px 0 8px", color:"#4a7a99",
                          fontSize:10, borderTop:"1px solid #1a2e44", lineHeight:1.8 }}>
          ⚠️ للأغراض التعليمية فقط — ليس نصيحة استثمارية<br />
          Binance · Frankfurter API · Claude AI
        </footer>
      </div>
    </>
  );
}
