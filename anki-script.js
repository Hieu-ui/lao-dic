/**
 * 🎯 Anki Edge TTS - Text-to-Speech Integration
 * 
 * Tích hợp Edge TTS trực tiếp vào Anki
 * ✅ Streaming real-time
 * ✅ Hỗ trợ nhiều giọng đọc
 * ✅ Điều chỉnh tốc độ
 * ✅ Caching audio
 * ✅ Error handling
 * ✅ Loading indicator
 */

class AnkiEdgeTTS {
  constructor(options = {}) {
    // 🔧 Cấu hình mặc định
    this.config = {
      cdnUrl: "https://cdn.jsdelivr.net/gh/Mrntn161/langki_anki/edge_tts.js",
      cacheEnabled: options.cacheEnabled !== false,
      maxCacheSize: options.maxCacheSize || 50,
      defaultVoice: options.defaultVoice || "en-US-EmmaMultilingualNeural",
      defaultRate: options.defaultRate || "+0%",
      fontSize: options.fontSize || "40px",
      color: options.color || "#333",
      hoverColor: options.hoverColor || "#007bff",
      loadingColor: options.loadingColor || "#ff9800",
      errorColor: options.errorColor || "#f44336",
      debug: options.debug || false,
    };

    // 💾 Cache
    this.audioCache = new Map();
    this.EdgeTTSLib = null;
    this.isLibraryLoaded = false;

    // 🎨 SVG Icons
    this.icons = {
      play: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m14.752 11.168-3.197-2.132A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664Z"/><path d="M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0Z"/></svg>`,
      pause: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 16 16"><path fill="currentColor" d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14.5a6.5 6.5 0 1 1 0-13a6.5 6.5 0 0 1 0 13zM5 5h2v6H5zm4 0h2v6H9z"/></svg>`,
      loading: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke-linecap="round"/></svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4v.01"/></svg>`,
    };

    this.init();
  }

  /**
   * 🚀 Khởi tạo script
   */
  async init() {
    try {
      // Load thư viện Edge TTS
      await this.loadEdgeTTSLibrary();

      // Tìm và xử lý tất cả phần tử .tts
      this.processAllElements();

      this.log("✅ Anki Edge TTS initialized successfully");
    } catch (error) {
      this.error("Failed to initialize Anki Edge TTS", error);
    }
  }

  /**
   * 📥 Tải thư viện Edge TTS từ CDN
   */
  async loadEdgeTTSLibrary() {
    if (this.isLibraryLoaded) return;

    try {
      // Kiểm tra đã load chưa
      if (document.getElementById("edge-tts-lib")) {
        this.EdgeTTSLib = window.BrowserCommunicate;
        this.isLibraryLoaded = true;
        return;
      }

      // Tải từ CDN
      const response = await fetch(this.config.cdnUrl);
      if (!response.ok) {
        throw new Error(`CDN load failed: ${response.status}`);
      }

      const scriptContent = await response.text();
      const script = document.createElement("script");
      script.id = "edge-tts-lib";
      script.text = scriptContent;
      document.body.prepend(script);

      // Đợi library được load
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (window.BrowserCommunicate) {
            clearInterval(interval);
            this.EdgeTTSLib = window.BrowserCommunicate;
            this.isLibraryLoaded = true;
            resolve();
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 10000); // Timeout 10s
      });
    } catch (error) {
      throw new Error(`Failed to load Edge TTS library: ${error.message}`);
    }
  }

  /**
   * 🔍 Tìm và xử lý tất cả phần tử .tts
   */
  processAllElements() {
    const elements = document.querySelectorAll(".tts");
    this.log(`Found ${elements.length} TTS elements`);

    elements.forEach((element, index) => {
      const text = element.getAttribute("text");
      const voice = element.getAttribute("voice") || this.config.defaultVoice;
      const rate = element.getAttribute("rate") || this.config.defaultRate;

      if (!text) {
        this.error(`Element ${index} missing 'text' attribute`);
        return;
      }

      this.attachTTSButton(element, text, voice, rate);
    });
  }

  /**
   * 🎛️ Gắn TTS button vào element
   */
  attachTTSButton(element, text, voice, rate) {
    const ttsManager = new TTSManager(text, voice, rate, this);

    // Styling
    this.applyStyles(element);

    // Icon mặc định
    element.innerHTML = this.icons.play;
    element.setAttribute("data-tts-state", "idle"); // idle | loading | playing | paused | error

    // Event listeners
    element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      ttsManager.togglePlayPause(element);
    });

    element.addEventListener("mouseenter", () => {
      if (element.getAttribute("data-tts-state") === "idle") {
        element.style.color = this.config.hoverColor;
      }
    });

    element.addEventListener("mouseleave", () => {
      if (element.getAttribute("data-tts-state") === "idle") {
        element.style.color = this.config.color;
      }
    });

    element.addEventListener("mousedown", () => {
      element.style.transform = "scale(0.9)";
    });

    element.addEventListener("mouseup", () => {
      element.style.transform = "scale(1)";
    });

    // Lưu reference
    element._ttsManager = ttsManager;
  }

  /**
   * 🎨 Áp dụng styling
   */
  applyStyles(element) {
    Object.assign(element.style, {
      fontSize: this.config.fontSize,
      color: this.config.color,
      cursor: "pointer",
      userSelect: "none",
      transition: "transform 0.2s, color 0.2s",
      display: "inline-block",
      padding: "0",
      border: "none",
      background: "transparent",
    });
  }

  /**
   * 💾 Lưu audio vào cache
   */
  cacheAudio(key, audioBlob) {
    if (!this.config.cacheEnabled) return;

    // Giới hạn cache size
    if (this.audioCache.size >= this.config.maxCacheSize) {
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }

    this.audioCache.set(key, audioBlob);
  }

  /**
   * 🔍 Lấy audio từ cache
   */
  getFromCache(key) {
    return this.audioCache.get(key);
  }

  /**
   * 🗑️ Xóa cache
   */
  clearCache() {
    this.audioCache.clear();
    this.log("Cache cleared");
  }

  /**
   * 📊 Log debug
   */
  log(message) {
    if (this.config.debug) {
      console.log(`[AnkiEdgeTTS] ${message}`);
    }
  }

  /**
   * ⚠️ Log error
   */
  error(message, error = null) {
    console.error(`[AnkiEdgeTTS] ${message}`, error);
  }
}

/**
 * 🎙️ TTS Manager - Quản lý từng instance TTS
 */
class TTSManager {
  constructor(text, voice, rate, ankiTTS) {
    this.text = text;
    this.voice = voice;
    this.rate = rate;
    this.ankiTTS = ankiTTS;

    this.isPlaying = false;
    this.isPaused = false;
    this.audio = null;
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.chunks = [];
    this.isStreaming = false;
    this.controller = null;
  }

  /**
   * ▶️/⏸️ Toggle play/pause
   */
  async togglePlayPause(element) {
    try {
      // Resume từ pause
      if (this.isPaused && this.audio && this.isStreaming) {
        this.audio.play();
        this.isPlaying = true;
        this.isPaused = false;
        element.innerHTML = this.ankiTTS.icons.pause;
        element.setAttribute("data-tts-state", "playing");
        return;
      }

      // Pause
      if (this.isPlaying && this.audio && !this.audio.paused) {
        this.audio.pause();
        this.isPlaying = false;
        this.isPaused = true;
        element.innerHTML = this.ankiTTS.icons.play;
        element.setAttribute("data-tts-state", "paused");
        return;
      }

      // First play
      if (!this.isPlaying) {
        await this.play(element);
      }
    } catch (error) {
      this.showError(element, error);
    }
  }

  /**
   * 🎵 Phát audio
   */
  async play(element) {
    try {
      element.innerHTML = this.ankiTTS.icons.loading;
      element.setAttribute("data-tts-state", "loading");
      element.style.color = this.ankiTTS.config.loadingColor;

      // Tạo cache key
      const cacheKey = `${this.text}|${this.voice}|${this.rate}`;

      // Kiểm tra cache
      const cachedAudio = this.ankiTTS.getFromCache(cacheKey);
      if (cachedAudio) {
        this.ankiTTS.log(`Loaded from cache: ${cacheKey}`);
        this.playFromBlob(cachedAudio, element);
        return;
      }

      // Stream từ Edge TTS
      await this.streamAudio(element, cacheKey);
    } catch (error) {
      this.showError(element, error);
    }
  }

  /**
   * 🔊 Stream audio từ Edge TTS
   */
  async streamAudio(element, cacheKey) {
    try {
      this.mediaSource = new MediaSource();
      const audioUrl = URL.createObjectURL(this.mediaSource);
      this.audio = new Audio(audioUrl);
      this.isPlaying = true;
      this.isStreaming = true;
      this.chunks = [];

      // Setup media source
      this.mediaSource.addEventListener("sourceopen", async () => {
        try {
          this.sourceBuffer = this.mediaSource.addSourceBuffer(
            "audio/mpeg"
          );

          this.sourceBuffer.addEventListener("updateend", () => {
            if (this.chunks.length > 0 && !this.sourceBuffer.updating) {
              this.sourceBuffer.appendBuffer(this.chunks.shift());
            }
          });

          // Gọi Edge TTS
          const EdgeTTS = this.ankiTTS.EdgeTTSLib;
          const communicate = new EdgeTTS(this.text, {
            voice: this.voice,
            format: "audio-16khz-32kbitrate-mono-mp3",
            rate: this.rate,
          });

          let fullBuffer = null;

          // Stream từng chunk
          for await (const chunk of communicate.stream()) {
            if (!this.isStreaming) break;

            if (chunk.type === "audio" && chunk.data) {
              const buffer = new Uint8Array(chunk.data).buffer;

              // Lưu lại toàn bộ buffer để cache
              if (!fullBuffer) {
                fullBuffer = new Uint8Array(chunk.data);
              } else {
                const temp = new Uint8Array(
                  fullBuffer.length + chunk.data.length
                );
                temp.set(fullBuffer);
                temp.set(new Uint8Array(chunk.data), fullBuffer.length);
                fullBuffer = temp;
              }

              // Append vào source buffer
              if (this.sourceBuffer.updating || this.chunks.length > 0) {
                this.chunks.push(buffer);
              } else {
                this.sourceBuffer.appendBuffer(buffer);
              }
            }
          }

          // Lưu vào cache
          if (fullBuffer) {
            const blob = new Blob([fullBuffer], { type: "audio/mpeg" });
            this.ankiTTS.cacheAudio(cacheKey, blob);
          }

          // Kết thúc stream
          if (!this.sourceBuffer.updating) {
            this.mediaSource.endOfStream();
          }
        } catch (error) {
          this.showError(element, error);
        }
      });

      // Play
      this.audio.play();
      element.innerHTML = this.ankiTTS.icons.pause;
      element.setAttribute("data-tts-state", "playing");
      element.style.color = this.ankiTTS.config.color;

      // Cleanup on end
      this.audio.onended = () => {
        this.isPlaying = false;
        this.isStreaming = false;
        this.isPaused = false;
        element.innerHTML = this.ankiTTS.icons.play;
        element.setAttribute("data-tts-state", "idle");
        element.style.color = this.ankiTTS.config.color;
      };

      this.audio.onerror = (e) => {
        this.showError(element, new Error("Audio playback error"));
      };
    } catch (error) {
      this.showError(element, error);
    }
  }

  /**
   * 🎵 Phát từ Blob (cached)
   */
  playFromBlob(blob, element) {
    const url = URL.createObjectURL(blob);
    this.audio = new Audio(url);
    this.isPlaying = true;
    this.isStreaming = true;

    this.audio.play();
    element.innerHTML = this.ankiTTS.icons.pause;
    element.setAttribute("data-tts-state", "playing");
    element.style.color = this.ankiTTS.config.color;

    this.audio.onended = () => {
      this.isPlaying = false;
      this.isStreaming = false;
      this.isPaused = false;
      element.innerHTML = this.ankiTTS.icons.play;
      element.setAttribute("data-tts-state", "idle");
      element.style.color = this.ankiTTS.config.color;
    };

    this.audio.onerror = (e) => {
      this.showError(element, new Error("Audio playback error"));
    };
  }

  /**
   * ❌ Hiển thị error
   */
  showError(element, error) {
    this.ankiTTS.error(`TTS Error: ${error.message}`, error);

    this.isPlaying = false;
    this.isStreaming = false;
    this.isPaused = false;

    element.innerHTML = this.ankiTTS.icons.error;
    element.setAttribute("data-tts-state", "error");
    element.style.color = this.ankiTTS.config.errorColor;

    // Timeout - reset sau 3s
    setTimeout(() => {
      if (element.getAttribute("data-tts-state") === "error") {
        element.innerHTML = this.ankiTTS.icons.play;
        element.setAttribute("data-tts-state", "idle");
        element.style.color = this.ankiTTS.config.color;
      }
    }, 3000);
  }

  /**
   * 🛑 Stop
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.isPlaying = false;
    this.isStreaming = false;
    this.isPaused = false;
  }
}

/**
 * 🚀 Auto-initialize khi DOM ready
 */
(async () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new AnkiEdgeTTS({
        debug: false, // Đổi thành true để xem logs
        cacheEnabled: true,
        maxCacheSize: 50,
      });
    });
  } else {
    new AnkiEdgeTTS({
      debug: false,
      cacheEnabled: true,
      maxCacheSize: 50,
    });
  }
})();
