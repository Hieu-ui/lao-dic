/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║        ANKI EDGE TTS - IMPROVED VERSION                       ║
 * ║  Text-to-Speech trực tiếp trên Anki với streaming & cache    ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

(async () => {
  // ======================== CONFIG ========================
  const CONFIG = {
    CDN_URL: "https://cdn.jsdelivr.net/gh/Mrntn161/langki_anki/edge_tts.js",
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    TIMEOUT: 30000, // 30 giây timeout
    DEBOUNCE_DELAY: 100, // ms
    DEFAULT_VOICE: "en-US-EmmaMultilingualNeural",
    DEFAULT_RATE: "+0%",
    STORAGE_KEY: "anki_tts_cache",
  };

  // ======================== CACHE MANAGER ========================
  class CacheManager {
    constructor() {
      this.cache = this.loadCache();
    }

    loadCache() {
      try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.error("[TTS] Cache load error:", e);
        return {};
      }
    }

    saveCache() {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.cache));
      } catch (e) {
        console.error("[TTS] Cache save error:", e);
      }
    }

    getCacheKey(text, voice, rate) {
      return `${voice}|${rate}|${text}`.replace(/\s+/g, "_");
    }

    get(text, voice, rate) {
      const key = this.getCacheKey(text, voice, rate);
      const cached = this.cache[key];

      if (!cached) return null;

      // Kiểm tra cache có hết hạn không
      if (Date.now() - cached.timestamp > CONFIG.CACHE_DURATION) {
        delete this.cache[key];
        this.saveCache();
        return null;
      }

      return cached.data;
    }

    set(text, voice, rate, data) {
      const key = this.getCacheKey(text, voice, rate);
      this.cache[key] = {
        data,
        timestamp: Date.now(),
      };

      // Giới hạn cache size (max 50 items)
      const keys = Object.keys(this.cache);
      if (keys.length > 50) {
        const oldestKey = keys.reduce((oldest, current) =>
          this.cache[current].timestamp < this.cache[oldest].timestamp
            ? current
            : oldest
        );
        delete this.cache[oldestKey];
      }

      this.saveCache();
    }

    clear() {
      this.cache = {};
      localStorage.removeItem(CONFIG.STORAGE_KEY);
    }
  }

  // ======================== UI MANAGER ========================
  class UIManager {
    static getPlayIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.1)"/>
          <path d="m9.5 7.5 6.5 4.5-6.5 4.5Z"/>
        </svg>`;
    }

    static getPauseIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.1)"/>
          <path d="M9 8v8M15 8v8" stroke="currentColor" stroke-width="2"/>
        </svg>`;
    }

    static getLoadingIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" opacity="0.3"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-dasharray="15.7" stroke-dashoffset="0" style="animation: spin 1s linear infinite"/>
        </svg>
        <style>
          @keyframes spin {
            to { stroke-dashoffset: -31.4; }
          }
        </style>`;
    }

    static getErrorIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="#ff4444"/>
          <text x="12" y="14" text-anchor="middle" fill="white" font-size="14" font-weight="bold">!</text>
        </svg>`;
    }

    static createStyleSheet() {
      if (document.getElementById("anki-tts-styles")) return;

      const style = document.createElement("style");
      style.id = "anki-tts-styles";
      style.textContent = `
        .tts {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          color: #333;
          background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
          border: 2px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-size: 24px;
        }

        .tts:hover:not(.tts-loading):not(.tts-error) {
          color: #007bff;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border-color: #007bff;
          box-shadow: 0 4px 8px rgba(0,123,255,0.2);
          transform: scale(1.05);
        }

        .tts:active:not(.tts-loading):not(.tts-error) {
          transform: scale(0.95);
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .tts-playing {
          color: #ff6b6b;
          background: linear-gradient(135deg, #ffe3e3 0%, #ffc9c9 100%);
          border-color: #ff6b6b;
          box-shadow: 0 4px 8px rgba(255,107,107,0.2);
        }

        .tts-loading {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .tts-error {
          color: #ff4444;
          background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
          border-color: #ff4444;
          opacity: 0.8;
        }

        .tts-tooltip {
          position: absolute;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 10000;
          margin-top: -35px;
          display: none;
        }

        .tts:hover .tts-tooltip {
          display: block;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .tts {
            width: 45px;
            height: 45px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ======================== TTS PLAYER ========================
  class TTSPlayer {
    constructor(element, text, voice, rate) {
      this.element = element;
      this.text = text;
      this.voice = voice || CONFIG.DEFAULT_VOICE;
      this.rate = rate || CONFIG.DEFAULT_RATE;

      this.isPlaying = false;
      this.isLoading = false;
      this.audio = null;
      this.mediaSource = null;
      this.sourceBuffer = null;
      this.queue = [];
      this.ended = false;
      this.controller = null;

      this.init();
    }

    init() {
      this.element.classList.add("tts");
      this.element.innerHTML = UIManager.getPlayIcon();

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "tts-tooltip";
      tooltip.textContent = "Click để phát";
      this.element.appendChild(tooltip);

      // Event listeners
      this.element.addEventListener("click", () => this.handleClick());
    }

    async handleClick() {
      if (this.isLoading) return;

      // Tiếp tục nếu bị tạm dừng
      if (this.isPlaying && this.audio?.paused) {
        this.audio.play();
        this.element.innerHTML = UIManager.getPauseIcon();
        return;
      }

      // Tạm dừng nếu đang phát
      if (this.isPlaying && !this.audio?.paused) {
        this.audio.pause();
        this.element.innerHTML = UIManager.getPlayIcon();
        this.element.classList.remove("tts-playing");
        return;
      }

      // Phát lần đầu
      await this.play();
    }

    async play() {
      try {
        this.setLoading(true);

        // Kiểm tra cache
        const cached = cacheManager.get(this.text, this.voice, this.rate);
        if (cached) {
          this.playFromBuffer(cached);
          return;
        }

        // Stream từ API
        await this.streamAudio();
      } catch (error) {
        this.handleError(error);
      } finally {
        this.setLoading(false);
      }
    }

    async streamAudio() {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), CONFIG.TIMEOUT)
      );

      try {
        this.controller = new AbortController();
        const EdgeTTS = await this.loadEdgeTTS();

        // Setup media source
        this.mediaSource = new MediaSource();
        const audioUrl = URL.createObjectURL(this.mediaSource);
        this.audio = new Audio(audioUrl);
        this.isPlaying = true;
        this.ended = false;

        this.element.innerHTML = UIManager.getPauseIcon();
        this.element.classList.add("tts-playing");

        this.mediaSource.addEventListener("sourceopen", async () => {
          this.sourceBuffer = this.mediaSource.addSourceBuffer(
            "audio/mpeg"
          );

          this.sourceBuffer.addEventListener("updateend", () => {
            if (this.queue.length > 0 && !this.sourceBuffer.updating) {
              this.sourceBuffer.appendBuffer(this.queue.shift());
            } else if (this.ended && !this.sourceBuffer.updating) {
              this.mediaSource.endOfStream();
            }
          });

          const communicate = new EdgeTTS(this.text, {
            voice: this.voice,
            format: "audio-16khz-32kbitrate-mono-mp3",
            rate: this.rate,
          });

          let audioChunks = [];

          for await (const chunk of communicate.stream()) {
            if (!this.isPlaying) break;

            if (chunk.type === "audio" && chunk.data) {
              const buffer = new Uint8Array(chunk.data).buffer;
              audioChunks.push(buffer);

              if (this.sourceBuffer.updating || this.queue.length > 0) {
                this.queue.push(buffer);
              } else {
                this.sourceBuffer.appendBuffer(buffer);
              }
            }
          }

          // Cache audio
          const audioData = new Blob(
            audioChunks.map((b) => new Uint8Array(b))
          );
          cacheManager.set(this.text, this.voice, this.rate, audioData);

          this.ended = true;
          if (!this.sourceBuffer.updating) {
            this.mediaSource.endOfStream();
          }
        });

        this.audio.play();

        this.audio.onended = () => {
          this.isPlaying = false;
          this.element.innerHTML = UIManager.getPlayIcon();
          this.element.classList.remove("tts-playing");
        };

        await Promise.race([
          new Promise((resolve) => (this.audio.onended = resolve)),
          timeout,
        ]);
      } catch (error) {
        throw error;
      }
    }

    playFromBuffer(audioBlob) {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audio = new Audio(audioUrl);
        this.isPlaying = true;

        this.element.innerHTML = UIManager.getPauseIcon();
        this.element.classList.add("tts-playing");

        this.audio.play();

        this.audio.onended = () => {
          this.isPlaying = false;
          this.element.innerHTML = UIManager.getPlayIcon();
          this.element.classList.remove("tts-playing");
        };
      } catch (error) {
        this.handleError(error);
      }
    }

    setLoading(loading) {
      this.isLoading = loading;
      if (loading) {
        this.element.innerHTML = UIManager.getLoadingIcon();
        this.element.classList.add("tts-loading");
      } else {
        this.element.classList.remove("tts-loading");
      }
    }

    handleError(error) {
      console.error("[TTS Error]", error);
      this.isPlaying = false;
      this.element.innerHTML = UIManager.getErrorIcon();
      this.element.classList.add("tts-error");

      setTimeout(() => {
        if (!this.isPlaying) {
          this.element.innerHTML = UIManager.getPlayIcon();
          this.element.classList.remove("tts-error");
        }
      }, 3000);
    }

    async loadEdgeTTS() {
      if (window.BrowserCommunicate) {
        return window.BrowserCommunicate;
      }

      await this.installCDN();
      return window.BrowserCommunicate;
    }

    async installCDN() {
      return new Promise((resolve, reject) => {
        try {
          const script = document.createElement("script");
          script.src = CONFIG.CDN_URL;
          script.async = true;

          script.onload = () => {
            resolve();
          };

          script.onerror = () => {
            reject(new Error("Failed to load TTS library"));
          };

          document.body.appendChild(script);
        } catch (e) {
          reject(e);
        }
      });
    }

    stop() {
      this.isPlaying = false;
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
      if (this.controller) {
        this.controller.abort();
      }
      this.element.innerHTML = UIManager.getPlayIcon();
      this.element.classList.remove("tts-playing");
    }
  }

  // ======================== INITIALIZATION ========================
  const cacheManager = new CacheManager();

  // Tạo stylesheet
  UIManager.createStyleSheet();

  // Tìm tất cả phần tử TTS
  const elements = document.querySelectorAll("[data-tts]");

  if (elements.length === 0) {
    // Fallback cho class="tts"
    const legacyElements = document.querySelectorAll(".tts");
    legacyElements.forEach((el) => {
      const text = el.getAttribute("text");
      const voice = el.getAttribute("voice");
      const rate = el.getAttribute("rate");

      if (text) {
        new TTSPlayer(el, text, voice, rate);
      }
    });
  } else {
    elements.forEach((el) => {
      const text = el.getAttribute("data-tts");
      const voice = el.getAttribute("data-voice");
      const rate = el.getAttribute("data-rate");

      if (text) {
        new TTSPlayer(el, text, voice, rate);
      }
    });
  }

  // ======================== GLOBAL API ========================
  window.TTSManager = {
    clearCache: () => {
      cacheManager.clear();
      console.log("[TTS] Cache cleared");
    },

    getCache: () => {
      return cacheManager.cache;
    },

    stopAll: () => {
      document.querySelectorAll(".tts").forEach((el) => {
        const audio = el._ttsPlayer?.audio;
        if (audio) audio.pause();
      });
    },
  };

  console.log("[TTS] ✅ Anki Edge TTS Improved loaded successfully");
})();
