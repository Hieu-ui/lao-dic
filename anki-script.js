(function() {
  'use strict';

  // API endpoint cho Edge TTS
  const TTS_API = 'https://tts.ai.ms/speech/synthesize/cognitiveservices/v1';
  
  // Hàm lấy token từ Microsoft
  async function getAuthToken() {
    try {
      const response = await fetch('https://edge.microsoft.com/translate/auth', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      return await response.text();
    } catch (error) {
      console.error('❌ Lỗi lấy token:', error);
      return null;
    }
  }

  // Hàm chuyển đổi rate ("+10%" → 1.1)
  function parseRate(rateStr) {
    if (!rateStr) return '+0%';
    return rateStr;
  }

  // Hàm tạo SSML (Speech Synthesis Markup Language)
  function createSSML(text, voice, rate) {
    const rateValue = parseRate(rate);
    return `
      <speak version="1.0" xml:lang="en-US">
        <voice name="${voice}">
          <prosody rate="${rateValue}">
            ${escapeXML(text)}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }

  // Escape XML characters
  function escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Hàm phát âm thanh từ blob
  function playAudio(audioBlob) {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play().catch(err => console.error('❌ Lỗi phát âm:', err));
  }

  // Hàm chính để tổng hợp giọng nói
  async function synthesizeSpeech(text, voice, rate) {
    if (!text.trim()) {
      console.warn('⚠️ Text trống');
      return;
    }

    const ssml = createSSML(text, voice, rate);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.error('❌ Không lấy được token');
        return;
      }

      const response = await fetch(TTS_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'Mozilla/5.0'
        },
        body: ssml
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      playAudio(audioBlob);
      console.log('✅ Phát âm thành công:', voice);

    } catch (error) {
      console.error('❌ Lỗi tổng hợp giọng nói:', error);
    }
  }

  // Xử lý tất cả các div.tts
  function initTTS() {
    const ttsElements = document.querySelectorAll('div.tts');
    
    ttsElements.forEach((element) => {
      const text = element.getAttribute('text');
      const voice = element.getAttribute('voice') || 'en-US-AriaNeural';
      const rate = element.getAttribute('rate') || '+0%';

      // Tạo nút để phát âm thanh
      const button = document.createElement('button');
      button.innerHTML = '🔊 Phát âm';
      button.style.cssText = `
        padding: 8px 12px;
        margin: 5px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
      `;

      button.onmouseover = () => button.style.backgroundColor = '#45a049';
      button.onmouseout = () => button.style.backgroundColor = '#4CAF50';

      button.addEventListener('click', () => {
        button.innerHTML = '⏳ Đang xử lý...';
        button.disabled = true;
        
        synthesizeSpeech(text, voice, rate).finally(() => {
          button.innerHTML = '🔊 Phát âm';
          button.disabled = false;
        });
      });

      element.appendChild(button);
    });
  }

  // Khởi động khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTTS);
  } else {
    initTTS();
  }
})();
