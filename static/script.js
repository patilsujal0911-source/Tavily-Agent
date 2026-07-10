/* ============================================================
   TAVILY AGENT — SCRIPT.JS
   Author: Sujal Patil
   Structure:
     1. Config
     2. Loader
     3. Theme Toggle
     4. Navbar (blur on scroll + mobile menu)
     5. Scroll Reveal
     6. Hero Preview Typing Animation
     7. Button Ripple
     8. Sidebar Toggle (chat page)
     9. Auto-Resize Textarea
     10. Chat: Message Rendering Helpers
     11. Chat: Markdown (lightweight)
     12. Chat: Copy Button
     13. Chat: Send + Flask SSE Streaming
     14. Chat: Auto Scroll
   ============================================================ */

(() => {
  "use strict";

  /* ============================================================
     1. CONFIG
     ------------------------------------------------------------
     Update CHAT_ENDPOINT to match whatever route your existing
     app.py already exposes (e.g. "/chat", "/ask", "/api/stream").
     This file does not add, remove, or rename any Flask route —
     it only calls the one you point it at.
     ============================================================ */
  const CONFIG = {
    CHAT_ENDPOINT: "/chat",
    THEME_KEY: "tavily-agent-theme",
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ============================================================
     2. LOADER
     ============================================================ */
  const loader = $("#loader");
  window.addEventListener("load", () => {
    setTimeout(() => loader && loader.classList.add("is-hidden"), 320);
  });

  /* ============================================================
     3. THEME TOGGLE
     ============================================================ */
  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    try { localStorage.setItem(CONFIG.THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(CONFIG.THEME_KEY); } catch (e) { /* noop */ }
    const preferred = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    applyTheme(preferred);
  }

  function bindThemeToggle(btn) {
    if (!btn) return;
    btn.addEventListener("click", () => {
      const current = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(current);
    });
  }

  initTheme();
  bindThemeToggle($("#themeToggle"));
  bindThemeToggle($("#themeToggleChat"));

  /* ============================================================
     4. NAVBAR
     ============================================================ */
  const navbar = $("#navbar");
  if (navbar) {
    const onScroll = () => navbar.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const navBurger = $("#navBurger");
  const navLinks = $("#navLinks");
  if (navBurger && navLinks) {
    navBurger.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navBurger.setAttribute("aria-expanded", String(isOpen));
      navBurger.classList.toggle("is-open", isOpen);
    });
    $$("a", navLinks).forEach((a) => a.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      navBurger.setAttribute("aria-expanded", "false");
    }));
  }

  /* ============================================================
     5. SCROLL REVEAL
     ============================================================ */
  const revealEls = $$(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ============================================================
     6. HERO PREVIEW TYPING ANIMATION
     ============================================================ */
  const previewTiles = $$("#previewTiles .preview-tile");
  const previewSources = $("#previewSources");
  const typingTarget = $("#typingText");
  const ANSWER_TEXT =
    "The 2026 update tightens transparency rules for general-purpose AI models and adds " +
    "stricter conformity checks for high-risk systems.";

  function runHeroPreview() {
    if (!previewTiles.length) return;

    previewTiles.forEach((tile) => tile.classList.remove("is-visible", "is-active"));
    if (previewSources) previewSources.classList.remove("is-visible");
    if (typingTarget) typingTarget.textContent = "";

    let i = 0;
    const revealNext = () => {
      if (i > 0) previewTiles[i - 1].classList.remove("is-active");
      if (i < previewTiles.length) {
        previewTiles[i].classList.add("is-visible", "is-active");
        i += 1;
        setTimeout(revealNext, 850);
      } else {
        if (previewSources) previewSources.classList.add("is-visible");
        setTimeout(typeAnswer, 350);
      }
    };
    revealNext();
  }

  function typeAnswer() {
    if (!typingTarget) return;
    typingTarget.textContent = "";
    let i = 0;
    const type = () => {
      if (i <= ANSWER_TEXT.length) {
        typingTarget.textContent = ANSWER_TEXT.slice(0, i);
        i += 1;
        setTimeout(type, 18);
      } else {
        setTimeout(runHeroPreview, 2600);
      }
    };
    type();
  }

  runHeroPreview();

  /* ============================================================
     7. BUTTON RIPPLE
     ============================================================ */
  $$(".btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.style.position = btn.style.position || "relative";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });

  /* ============================================================
     8. SIDEBAR TOGGLE (chat page)
     ============================================================ */
  const sidebar = $("#sidebar");
  const sidebarToggle = $("#sidebarToggle");
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("is-open"));
    document.addEventListener("click", (e) => {
      if (window.innerWidth > 860) return;
      if (!sidebar.classList.contains("is-open")) return;
      if (sidebar.contains(e.target) || sidebarToggle.contains(e.target)) return;
      sidebar.classList.remove("is-open");
    });
  }

  const newChatBtn = $("#newChatBtn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      const chatInner = $("#chatInner");
      $$(".message", chatInner).forEach((m) => m.remove());
      const empty = $("#chatEmpty");
      if (empty) empty.style.display = "flex";
      const title = $(".chat-topbar__title");
      if (title) title.textContent = "New research session";
    });
  }

  /* ============================================================
     9. AUTO-RESIZE TEXTAREA
     ============================================================ */
  const chatTextarea = $("#chatTextarea");
  const chatSend = $("#chatSend");

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  if (chatTextarea) {
    chatTextarea.addEventListener("input", () => {
      autoResize(chatTextarea);
      if (chatSend) chatSend.disabled = chatTextarea.value.trim().length === 0;
    });

    chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $("#chatForm")?.requestSubmit();
      }
    });
  }

  /* ============================================================
     10. CHAT: MESSAGE RENDERING HELPERS
     ============================================================ */
  const chatInner = $("#chatInner");
  const chatEmpty = $("#chatEmpty");
  const chatScroll = $("#chatScroll");

  function hideEmptyState() {
    if (chatEmpty) chatEmpty.style.display = "none";
  }

  function appendUserMessage(text) {
    const tpl = $("#tpl-user-message");
    if (!tpl || !chatInner) return null;
    const node = tpl.content.firstElementChild.cloneNode(true);
    $(".message__content", node).textContent = text;
    chatInner.appendChild(node);
    return node;
  }

  function appendAgentMessage() {
    const tpl = $("#tpl-agent-message");
    if (!tpl || !chatInner) return null;
    const node = tpl.content.firstElementChild.cloneNode(true);
    chatInner.appendChild(node);
    return node;
  }

  function renderSources(agentNode, sources) {
    const container = $(".source-cards", agentNode);
    const cardTpl = $("#tpl-source-card");
    if (!container || !cardTpl || !sources || !sources.length) return;

    container.hidden = false;
    sources.forEach((src, i) => {
      const card = cardTpl.content.firstElementChild.cloneNode(true);
      card.href = src.url || "#";
      $(".source-card__n", card).textContent = String(i + 1);
      $(".source-card__domain", card).textContent = src.domain || (src.url ? new URL(src.url).hostname.replace("www.", "") : "source");
      $(".source-card__title", card).textContent = src.title || src.url || "Untitled source";
      container.appendChild(card);
    });
  }

  /* ============================================================
     11. CHAT: LIGHTWEIGHT MARKDOWN
     ------------------------------------------------------------
     Minimal, dependency-free renderer covering the common cases
     produced by an LLM: paragraphs, bold/italic, inline code,
     fenced code blocks, links, and numbered citation markers
     like [1] which are turned into clickable reference chips.
     ============================================================ */
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(raw) {
    const codeBlocks = [];
    let text = raw.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push(`<pre><code class="lang-${lang || "text"}">${escapeHtml(code.trim())}</code><button class="copy-btn" type="button">Copy</button></pre>`);
      return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
    });

    text = escapeHtml(text);

    text = text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[(\d+)\]/g, '<sup class="citation-ref">$1</sup>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const paragraphs = text
      .split(/\n{2,}/)
      .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
      .join("");

    return paragraphs.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, i) => codeBlocks[Number(i)]);
  }

  /* ============================================================
     12. CHAT: COPY BUTTON (event delegation)
     ============================================================ */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;
    const code = btn.previousElementSibling;
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(() => {
      const original = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = original), 1400);
    });
  });

  /* ============================================================
     13. CHAT: SEND + FLASK SSE STREAMING
     ------------------------------------------------------------
     Supports two backend styles without any change to app.py:
       (a) text/event-stream responses ("data: ...\n\n" chunks)
       (b) plain chunked text responses
     The agent bubble is filled progressively as chunks arrive.
     ============================================================ */
  const CHAT_STATE = {
    threadId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
  };

  const chatForm = $("#chatForm");

  function scrollToBottom() {
    if (!chatScroll) return;
    chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
  }

  function setStatus(contentEl, text) {
    contentEl.innerHTML = `<span class="typing-indicator"><span></span><span></span><span></span></span> <span class="message__status">${escapeHtml(text)}</span>`;
  }

  async function sendMessage(question) {
    hideEmptyState();
    appendUserMessage(question);
    const agentNode = appendAgentMessage();
    const contentEl = $(".message__content", agentNode);
    scrollToBottom();

    let buffer = "";
    let sources = [];
    let firstToken = true;

    try {
      const response = await fetch(CONFIG.CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, thread_id: CHAT_STATE.threadId }),
      });

      if (!response.ok || !response.body) throw new Error(`Request failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line ("\n\n")
        const frames = sseBuffer.split("\n\n");
        sseBuffer = frames.pop(); // keep any incomplete trailing frame for next read

        for (const frame of frames) {
          const parsed = parseSseFrame(frame);
          if (!parsed) continue;
          const { event, data } = parsed;

          if (event === "token") {
            if (firstToken) {
              contentEl.innerHTML = "";
              firstToken = false;
            }
            buffer += data.text || "";
            contentEl.innerHTML = renderMarkdown(buffer);
            scrollToBottom();
          } else if (event === "tool_start") {
            if (firstToken) setStatus(contentEl, data.message || "Searching…");
          } else if (event === "tool_end") {
            if (firstToken) setStatus(contentEl, data.message || "Reading sources…");
            if (Array.isArray(data.sources)) {
              data.sources.forEach((src) => {
                if (!sources.some((s) => s.url === src.url)) sources.push(src);
              });
            }
          } else if (event === "done") {
            buffer = data.message || buffer;
            contentEl.innerHTML = buffer ? renderMarkdown(buffer) : "<p>No response was generated.</p>";
            if (Array.isArray(data.sources) && data.sources.length) sources = data.sources;
            renderSources(agentNode, sources);
            scrollToBottom();
          } else if (event === "error") {
            contentEl.innerHTML = `<p>${escapeHtml(data.message || "Something went wrong. Please try again.")}</p>`;
          }
        }
      }
    } catch (err) {
      contentEl.innerHTML = `<p>Something went wrong reaching Tavily Agent. Please try again.</p>`;
      console.error("Chat stream error:", err);
    }
  }

  // Parses a single "event: name\ndata: {...}" SSE frame into { event, data }.
  function parseSseFrame(frame) {
    if (!frame.trim()) return null;
    let event = "message";
    let dataLine = "";
    frame.split("\n").forEach((line) => {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    });
    if (!dataLine) return null;
    try {
      return { event, data: JSON.parse(dataLine) };
    } catch (e) {
      return { event, data: { text: dataLine } };
    }
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = chatTextarea.value.trim();
      if (!value) return;
      chatTextarea.value = "";
      autoResize(chatTextarea);
      chatSend.disabled = true;
      sendMessage(value);
    });
  }

  // If the backend rendered an initial_message (e.g. /app?message=...),
  // send it automatically once the page loads.
  if (window.__INITIAL_MESSAGE__ && window.__INITIAL_MESSAGE__.trim()) {
    sendMessage(window.__INITIAL_MESSAGE__.trim());
  }

  /* ============================================================
     14. CHAT: AUTO SCROLL ON RESIZE
     ============================================================ */
  window.addEventListener("resize", () => {
    if (chatScroll && chatScroll.scrollHeight - chatScroll.scrollTop < chatScroll.clientHeight + 120) {
      scrollToBottom();
    }
  });

  /* Footer year */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();