(() => {
  // ====== CONFIG ======
  const API_KEY = "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"; // leave "" to use the encrypted passphrase flow instead
  const MODEL = "openai/gpt-oss-120b"; // text-only questions
  const VISION_MODEL = "qwen/qwen3.8-27b"; // used when the question has images (fallback: "qwen/qwen3.6-27b")
  const SELECTOR = '[class*="_TextElement_"]';
  // ====================

  // Remove any previous panel
  document.getElementById("zinc-panel")?.remove();
  document.getElementById("zinc-style")?.remove();

  // ---------- Styles ----------
  const style = document.createElement("style");
  style.id = "zinc-style";
  style.textContent = `
    #zinc-panel{
      position:fixed;top:40px;right:40px;z-index:2147483647;width:780px;max-width:94vw;
      background:rgba(24,24,27,.96);color:#e4e4e7;border:1px solid #3f3f46;border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.55);font:15px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;
      backdrop-filter:blur(12px);overflow:hidden;
      opacity:0;transform:translateY(-12px) scale(.97);
      transition:opacity .3s ease,transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;
    }
    #zinc-panel.show{opacity:1;transform:translateY(0) scale(1)}
    #zinc-panel.dragging{box-shadow:0 28px 80px rgba(0,0,0,.7);transition:none;cursor:grabbing}
    #zinc-head{display:flex;align-items:center;gap:12px;padding:20px 24px;cursor:grab;user-select:none;
      background:linear-gradient(180deg,#27272a,#1f1f22);border-bottom:1px solid #3f3f46}
    #zinc-dot{width:16px;height:16px;border-radius:50%;background:#a1a1aa;transition:background .3s,box-shadow .3s}
    #zinc-dot.busy{background:#fbbf24;box-shadow:0 0 10px #fbbf24;animation:zpulse 1s infinite}
    #zinc-dot.done{background:#4ade80;box-shadow:0 0 10px #4ade80}
    #zinc-dot.err{background:#f87171;box-shadow:0 0 10px #f87171}
    #zinc-title{font-weight:700;font-size:26px;letter-spacing:.14em;color:#fafafa;flex:1}
    .zinc-btn{background:transparent;border:2px solid #3f3f46;color:#d4d4d8;border-radius:12px;
      padding:12px 22px;font:inherit;font-size:19px;font-weight:600;cursor:pointer;transition:all .18s ease}
    .zinc-btn:hover{background:#3f3f46;color:#fafafa;transform:translateY(-1px)}
    .zinc-btn:active{transform:translateY(0) scale(.96)}
    #zinc-wrap{display:grid;grid-template-rows:1fr;transition:grid-template-rows .35s ease}
    #zinc-panel.min #zinc-wrap{grid-template-rows:0fr}
    #zinc-inner{overflow:hidden;min-height:0}
    #zinc-body{padding:28px 30px;max-height:62vh;overflow:auto;white-space:pre-wrap;word-break:break-word;
      font-size:40px;line-height:1.4;font-weight:700;color:#fafafa;
      scrollbar-width:thin;scrollbar-color:#52525b transparent}
    #zinc-body.fade{animation:zfade .45s ease}
    #zinc-q{padding:12px 24px;font-size:15px;color:#71717a;border-top:1px solid #27272a;
      max-height:64px;overflow:auto;white-space:pre-wrap}
    .zinc-loader{display:flex;gap:6px;align-items:center;color:#a1a1aa}
    .zinc-loader i{width:8px;height:8px;border-radius:50%;background:#a1a1aa;animation:zbounce 1.2s infinite ease-in-out}
    .zinc-loader i:nth-child(2){animation-delay:.15s}.zinc-loader i:nth-child(3){animation-delay:.3s}
    #zinc-timer{min-width:120px;font-variant-numeric:tabular-nums}
    #zinc-timer.run{color:#fbbf24;border-color:#fbbf24}
    #zinc-timer.end{color:#4ade80;border-color:#4ade80;animation:zpulse .6s 6}
    @keyframes zbounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
    @keyframes zpulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes zfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  `;
  document.head.appendChild(style);

  // ---------- Panel ----------
  const panel = document.createElement("div");
  panel.id = "zinc-panel";
  panel.innerHTML = `
    <div id="zinc-head">
      <div id="zinc-dot"></div>
      <div id="zinc-title">ZINC</div>
      <button class="zinc-btn" id="zinc-timer" title="Click to start / reset a 1 minute timer">⏱ 1:00</button>
      <button class="zinc-btn" id="zinc-ask">Ask again</button>
      <button class="zinc-btn" id="zinc-set" title="Settings">⚙</button>
      <button class="zinc-btn" id="zinc-min">–</button>
      <button class="zinc-btn" id="zinc-x">✕</button>
    </div>
    <div id="zinc-settings" style="display:none;padding:16px 24px;border-bottom:1px solid #3f3f46;background:#1c1c1f;font-size:18px;color:#d4d4d8">
      <label style="cursor:pointer;display:flex;gap:8px;align-items:center">
        <input type="checkbox" id="zinc-wait" style="width:22px;height:22px"> Wait for the 1 min timer before showing the answer
      </label>
      <label style="cursor:pointer;display:flex;gap:8px;align-items:center;margin-top:12px">
        <input type="checkbox" id="zinc-next" style="width:22px;height:22px"> After I press Enter twice, read the next question for me
      </label>
    </div>
    <div id="zinc-wrap"><div id="zinc-inner">
      <div id="zinc-body"></div>
      <div id="zinc-q"></div>
    </div></div>`;
  document.body.appendChild(panel);
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("show")));

  const $ = id => panel.querySelector("#" + id);
  const head = $("zinc-head"), dot = $("zinc-dot"), body = $("zinc-body"), qBox = $("zinc-q");

  // ---------- Dragging ----------
  let sx, sy, ox, oy, drag = false;
  head.addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    drag = true;
    const r = panel.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    panel.style.right = "auto";
    panel.style.left = ox + "px";
    panel.style.top = oy + "px";
    panel.classList.add("dragging");
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", e => {
    if (!drag) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    let x = ox + e.clientX - sx, y = oy + e.clientY - sy;
    x = Math.max(-w + 80, Math.min(innerWidth - 80, x));
    y = Math.max(0, Math.min(innerHeight - 50, y));
    panel.style.left = x + "px";
    panel.style.top = y + "px";
  });
  const stop = () => { drag = false; panel.classList.remove("dragging"); };
  head.addEventListener("pointerup", stop);
  head.addEventListener("pointercancel", stop);

  // ---------- Buttons ----------
  $("zinc-min").onclick = () => {
    panel.classList.toggle("min");
    $("zinc-min").textContent = panel.classList.contains("min") ? "+" : "–";
  };
  $("zinc-x").onclick = () => {
    panel.classList.remove("show");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(() => { panel.remove(); style.remove(); }, 320);
  };
  $("zinc-ask").onclick = () => run();

  // 1 minute countdown timer (click to start, click again to reset)
  const timerBtn = $("zinc-timer");
  const TIMER_SECONDS = 60;
  let timerId = null;
  const fmt = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  let onTimerEnd = null;
  function resetTimer() {
    clearInterval(timerId); timerId = null; onTimerEnd = null;
    timerBtn.className = "zinc-btn";
    timerBtn.textContent = "⏱ " + fmt(TIMER_SECONDS);
  }
  function startTimer(cb) {
    resetTimer();
    onTimerEnd = cb || null;
    let left = TIMER_SECONDS;
    timerBtn.className = "zinc-btn run";
    timerBtn.textContent = "⏱ " + fmt(left);
    timerId = setInterval(() => {
      left--;
      timerBtn.textContent = "⏱ " + fmt(left);
      if (left <= 0) {
        clearInterval(timerId); timerId = null;
        timerBtn.className = "zinc-btn end";
        timerBtn.textContent = "⏱ 0:00";
        const f = onTimerEnd; onTimerEnd = null;
        if (f) f();
      }
    }, 1000);
  }
  timerBtn.onclick = () => {
    if (timerId && onTimerEnd) return; // answer is being held: the timer can't be skipped (turn it off in ⚙ settings instead)
    else if (timerId) resetTimer();
    else startTimer();
  };

  // Settings: hold the answer back until the timer ends (on by default, can be turned off)
  let waitEnabled = true;
  try { if (localStorage.getItem("zinc_wait") === "0") waitEnabled = false; } catch (e) {}
  const waitBox = $("zinc-wait");
  waitBox.checked = waitEnabled;
  waitBox.onchange = () => {
    waitEnabled = waitBox.checked;
    try { localStorage.setItem("zinc_wait", waitEnabled ? "1" : "0"); } catch (e) {}
  };
  // Detect YOUR Enter key presses. After an answer has been shown and you press Enter yourself,
  // Zinc waits for the next question to appear on the page and then reads it. It never presses keys itself.
  let autoNext = false;
  try { autoNext = localStorage.getItem("zinc_next") === "1"; } catch (e) {}
  const nextBox = $("zinc-next");
  nextBox.checked = autoNext;
  nextBox.onchange = () => {
    autoNext = nextBox.checked;
    try { localStorage.setItem("zinc_next", autoNext ? "1" : "0"); } catch (e) {}
  };
  let pollId = null, quietTimer = null, lastPress = 0, count = 0, blockedUntil = 0;
  function watchForNextQuestion() {
    clearInterval(pollId);
    let tries = 0;
    pollId = setInterval(() => {
      tries++;
      const q = readQuestion();
      if (q && q !== lastQuestion && !busy) { clearInterval(pollId); setTimeout(run, 800); }
      else if (tries > 20) clearInterval(pollId);              // give up after ~20 seconds
    }, 1000);
  }
  function onKey(e) {
    if (!e.isTrusted || e.key !== "Enter" || e.repeat) return; // isTrusted = a real keypress, not one made by a script
    if (!autoNext || !revealed || busy) return;                // only after an answer has been shown
    const now = Date.now();
    const gap = now - lastPress;
    lastPress = now;
    clearTimeout(quietTimer);                                  // any new press cancels a pending trigger
    if (gap < 350) { count = 0; blockedUntil = now + 2000; return; } // pressing too fast = spam, ignore until calm
    if (now < blockedUntil) return;
    count = gap > 8000 ? 1 : count + 1;                        // presses more than 8 s apart start a new count
    if (count === 2) {
      // exactly two presses: only fire if no third press follows within 1.5 s
      quietTimer = setTimeout(() => { count = 0; watchForNextQuestion(); }, 1500);
    } else if (count > 2) {
      count = 0; blockedUntil = now + 2000;                    // a third press looks like spamming
    }
  }
  if (window.__zincKeyHandler) document.removeEventListener("keydown", window.__zincKeyHandler, true);
  window.__zincKeyHandler = onKey;
  document.addEventListener("keydown", onKey, true);

  $("zinc-set").onclick = () => {
    const s = $("zinc-settings");
    s.style.display = s.style.display === "none" ? "block" : "none";
  };

  // ---------- Read question (KaTeX -> LaTeX) ----------
  function readNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.tagName === "BR") return "\n";
    if (node.classList.contains("katex")) {
      const tex = node.querySelector('annotation[encoding="application/x-tex"]');
      return " " + (tex ? "$" + tex.textContent + "$" : node.textContent) + " ";
    }
    return [...node.childNodes].map(readNode).join("");
  }
  function readQuestion() {
    const els = [...document.querySelectorAll(SELECTOR)].filter(e => !panel.contains(e));
    if (!els.length) return "";
    const roots = els.filter(e => !els.some(o => o !== e && o.contains(e)));
    return roots.map(readNode).join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Turn an <img> into a base64 data URL so the vision model can see it
  async function imgToDataURL(img) {
    try {
      const blob = await (await fetch(img.currentSrc || img.src, { credentials: "include" })).blob();
      return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    } catch (e) {
      // fallback: draw onto a canvas (works if the image is same-origin / CORS-enabled)
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/png");
    }
  }
  const blobToDataURL = blob => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
  async function urlToDataURL(url) {
    if (url.startsWith("data:")) return url;
    const r = await fetch(url, { credentials: "include" });
    return await blobToDataURL(await r.blob());
  }
  // Shrink big images so they fit Groq's size limit
  async function shrink(dataUrl) {
    try {
      const im = new Image();
      im.src = dataUrl;
      await im.decode();
      const max = 1800, s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.85);
    } catch (e) { return dataUrl; }
  }
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 60 && r.height > 40; };

  // Screenshot of the current tab (the browser asks you to allow it once; the permission is reused after that)
  async function getScreenshot() {
    let stream = window.__zincStream;
    if (!stream || !stream.active) {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
      window.__zincStream = stream;
    }
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    panel.style.visibility = "hidden"; // keep our own panel out of the shot
    await new Promise(r => setTimeout(r, 400));
    const c = document.createElement("canvas");
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    panel.style.visibility = "";
    video.pause(); video.srcObject = null;
    return c.toDataURL("image/png");
  }

  let failedImages = 0, lastCandidates = 0;
  async function readImages() {
    failedImages = 0;
    const sources = [];
    // 1) <img> tags and <canvas> anywhere in the page content (not our panel, not tiny icons)
    document.querySelectorAll("img, canvas, svg image").forEach(el => {
      if (panel.contains(el) || !visible(el)) return;
      sources.push(el);
    });
    // 2) CSS background images inside image containers
    document.querySelectorAll('[class*="ImageContainer"] *, [class*="Zoomable"] *').forEach(el => {
      if (panel.contains(el)) return;
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
      if (m && visible(el)) sources.push({ bgUrl: m[1] });
    });

    lastCandidates = sources.length;
    console.log("Image candidates found:", sources);
    const out = [], seen = new Set();
    for (const s of sources) {
      if (out.length >= 4) break;
      try {
        let data;
        if (s.bgUrl) data = await urlToDataURL(s.bgUrl);
        else if (s.tagName === "CANVAS") data = s.toDataURL("image/png");
        else if (s.tagName === "IMAGE") data = await urlToDataURL(s.href.baseVal);
        else data = await imgToDataURL(s);
        if (!data || seen.has(data.slice(-200))) continue;
        seen.add(data.slice(-200));
        out.push(await shrink(data));
      } catch (e) {
        failedImages++;
        console.warn("Could not read image directly (CDN blocks it):", s, e);
      }
    }
    // The CDN blocks both script access and Groq's own download (403), so fall back to a screenshot of this tab
    if (failedImages > 0) {
      try {
        out.length = 0;
        out.push(await shrink(await getScreenshot()));
        console.log("Using tab screenshot instead of the blocked image");
      } catch (e) {
        console.warn("Screenshot failed or was cancelled:", e);
      }
    }
    return out;
  }

  const setBody = (html, isText) => {
    body.classList.remove("fade");
    void body.offsetWidth;
    if (isText) body.textContent = html; else body.innerHTML = html;
    body.classList.add("fade");
  };

  // ---------- Encrypted API key (passphrase -> PBKDF2 -> AES-GCM) ----------
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }
  async function getKey() {
    if (API_KEY) return API_KEY; // key is set in the file, no prompts
    if (window.__zincKey) return window.__zincKey; // already unlocked in this tab
    let stored = null;
    try { stored = localStorage.getItem("zinc_k"); } catch (e) {}
    try {
      if (stored) {
        const { s, iv, c } = JSON.parse(stored);
        const pass = prompt("Zinc passphrase:");
        if (!pass) return null;
        const k = await deriveKey(pass, unb64(s));
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, k, unb64(c));
        window.__zincKey = new TextDecoder().decode(plain);
        return window.__zincKey;
      }
      const key = (prompt("First run: paste your Groq API key") || "").trim();
      if (!key) return null;
      const pass = prompt("Choose a passphrase to encrypt it with (you'll type it each session):");
      if (!pass) return null;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const k = await deriveKey(pass, salt);
      const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(key));
      try { localStorage.setItem("zinc_k", JSON.stringify({ s: b64(salt), iv: b64(iv), c: b64(c) })); } catch (e) {}
      window.__zincKey = key;
      return key;
    } catch (e) {
      alert("Wrong passphrase (or the saved key is damaged). To start over, run localStorage.removeItem('zinc_k') in the console.");
      return null;
    }
  }

  // ---------- Ask the AI ----------
  let busy = false, revealed = false, lastQuestion = "";
  async function run() {
    if (busy) return;
    busy = true;
    resetTimer();
    revealed = false;
    const apiKey = await getKey();
    if (!apiKey) {
      dot.className = "err";
      setBody("No API key entered. Press Ask again to try again.", true);
      body.style.fontSize = "24px";
      busy = false;
      return;
    }
    dot.className = "busy";
    setBody('<div class="zinc-loader"><i></i><i></i><i></i><span style="margin-left:6px">Reading…</span></div>');
    const question = readQuestion();
    const images = await readImages();
    if (!question && !images.length) {
      dot.className = "err";
      setBody("No question found on the page. Check SELECTOR.", true);
      busy = false;
      return;
    }
    lastQuestion = question;
    console.log("Question read:\n", question, "\nImages:", images.length, "failed:", failedImages);
    // If the question points at a picture we couldn't read, stop instead of letting the AI guess
    if (!images.length && /\b(shown|diagram|table|graph|chart|picture|image|pictogram|drawn|sketch)\b|\bbelow\b/i.test(question)) {
      qBox.textContent = question + `\n[images read: 0, failed: ${failedImages}, candidates: ${lastCandidates}]`;
      dot.className = "err";
      setBody("Couldn't read the image on this page, so any answer would be a guess. Open the Console (F12) and look for \"Could not read image\".", true);
      body.style.fontSize = "24px";
      busy = false;
      return;
    }
    body.style.fontSize = "";
    qBox.textContent = (question || "(image only)") +
      `\n[images read: ${images.length}${failedImages ? `, failed: ${failedImages}` : ""}]`;

    const userContent = images.length
      ? [
          { type: "text", text: question || "Answer the question shown in the image." },
          ...images.map(url => ({ type: "image_url", image_url: { url } })),
        ]
      : question;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model: images.length ? VISION_MODEL : MODEL,
          temperature: 0.1,
          // Groq's free tier caps the vision model at 1000 output tokens per minute, so keep that request small
          max_tokens: images.length ? 700 : 6000,
          ...(images.length ? {} : { reasoning_effort: "high" }),
          messages: [
            {
              role: "system",
              content:
                "You answer UK school maths questions. The text uses LaTeX between $...$ and may come with " +
                "images (diagrams, graphs, tables) that are part of the question. " +
                "Never invent numbers. Use only values given in the text or visible in the images. " +
                "If a needed value is missing, end with 'ANSWER: MISSING INFO' and nothing else. " +
                (images.length
                  ? "Keep any working to two or three short lines. "
                  : "Work through the problem carefully step by step and double-check the arithmetic and units. ") +
                "Then finish with a final line that starts with 'ANSWER:' followed ONLY by the final answer " +
                "for each part (e.g. 'ANSWER: a) increase  b) 12'). Give money as a plain number like 2.85 " +
                "and round only if the question says so. Plain text, no LaTeX markup in the ANSWER line.",
            },
            { role: "user", content: userContent },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || res.statusText);
      const full = (data.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      const i = full.lastIndexOf("ANSWER:");
      const answer = (i >= 0 ? full.slice(i + 7) : full).trim() || "(no answer returned, press Ask again)";
      const working = i >= 0 ? full.slice(0, i).trim() : "";
      const reveal = () => {
      setBody(answer, true);
      if (working) {
        const d = document.createElement("details");
        d.style.cssText = "margin-top:14px;font-size:13px;font-weight:400;color:#a1a1aa";
        const s = document.createElement("summary");
        s.textContent = "Show working";
        s.style.cursor = "pointer";
        const w = document.createElement("div");
        w.textContent = working;
        w.style.cssText = "margin-top:8px;white-space:pre-wrap";
        d.append(s, w);
        body.appendChild(d);
      }
      dot.className = "done";
      revealed = true;
      };
      if (waitEnabled) {
        dot.className = "busy";
        setBody("Answer ready.\nAnswer after the timer has ended.", true);
        body.style.fontSize = "30px";
        startTimer(() => { body.style.fontSize = ""; reveal(); });
      } else {
        reveal();
      }
    } catch (err) {
      console.error(err);
      setBody("Error: " + err.message, true);
      dot.className = "err";
    } finally {
      busy = false;
    }
  }

  run();
})();
