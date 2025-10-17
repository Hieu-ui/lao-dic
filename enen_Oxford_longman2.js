// Glosbe Lao -> Vietnamese custom script for Online Dictionary Helper
// - Primary: use Glosbe public gapi JSON endpoint
// - Fallback: scrape Glosbe HTML if API unavailable
// - Output: array of strings (definitions + examples)

function findWord(word) {
  if (!word || typeof word !== 'string') {
    return Promise.resolve(["No word provided"]);
  }

  // normalize
  const phrase = word.trim();

  // 1) Try Glosbe JSON API (gapi)
  const apiUrl = "https://glosbe.com/gapi/translate?from=lo&dest=vi&format=json&phrase=" + encodeURIComponent(phrase) + "&pretty=true";

  return fetch(apiUrl, { method: 'GET' })
    .then(response => {
      // If non-JSON or error, fallback will handle
      if (!response.ok) throw new Error("API not OK");
      return response.json().catch(() => { throw new Error("Not JSON"); });
    })
    .then(json => {
      let out = [];
      // Extract direct translations / meanings from tuc array
      if (json && Array.isArray(json.tuc) && json.tuc.length > 0) {
        json.tuc.forEach(item => {
          if (item.meanings && item.meanings.length) {
            item.meanings.forEach(m => {
              if (m.text) out.push("→ " + m.text);
            });
          } else if (item.phrase && item.phrase.text) {
            out.push("→ " + item.phrase.text);
          }
        });
      }

      // Examples from "examples" field (if provided)
      if (json && Array.isArray(json.examples) && json.examples.length) {
        out.push("\nExamples:");
        json.examples.slice(0, 6).forEach(ex => {
          // ex.first (source), ex.second (target)
          let s = [];
          if (ex.first) s.push(ex.first);
          if (ex.second) s.push("— " + ex.second);
          out.push(s.join(" "));
        });
      }

      // If we got nothing useful, fallback to HTML scraping
      if (out.length === 0) {
        throw new Error("Empty API result, fallback to HTML");
      }

      // Clean duplicates and return
      out = Array.from(new Set(out)).filter(Boolean);
      return out;
    })
    .catch(_err => {
      // Fallback: scrape Glosbe HTML page
      const pageUrl = "https://glosbe.com/lo/vi/" + encodeURIComponent(phrase);
      return fetch(pageUrl, { method: 'GET' })
        .then(resp => {
          if (!resp.ok) throw new Error("Page fetch failed");
          return resp.text();
        })
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          let results = [];

          // Try several selectors used by Glosbe pages:
          // translations / meanings
          const meaningSelectors = [
            '.meaning',               // sometimes present
            '.translation .text',     // translations block
            '.translation', 
            '.phrase .translation',
            '.tu-meaning', 
            '.translation-block .translation'
          ];

          for (let sel of meaningSelectors) {
            const els = doc.querySelectorAll(sel);
            if (els && els.length) {
              els.forEach(e => {
                let txt = e.textContent.trim();
                if (txt) results.push(txt);
              });
            }
          }

          // Examples selectors
          const exampleSelectors = [
            '.example .text',
            '.examples .example',
            '.example',
            '.example-sentence'
          ];
          let examples = [];
          for (let sel of exampleSelectors) {
            const els = doc.querySelectorAll(sel);
            if (els && els.length) {
              els.forEach(e => {
                let txt = e.textContent.trim();
                if (txt) examples.push(txt);
              });
            }
          }

          // If still empty, try meta description
          if (results.length === 0) {
            const metaDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
            if (metaDesc && metaDesc.content) {
              results.push(metaDesc.content.trim());
            }
          }

          // Compose output: meanings then examples
          let out = [];
          if (results.length) {
            out = out.concat(results.slice(0, 12)); // limit to avoid quá dài
          } else {
            // If nothing, give entire page text truncated
            let bodyText = (doc.body && doc.body.textContent) ? doc.body.textContent.trim().replace(/\s+/g, ' ') : '';
            if (bodyText) out.push(bodyText.substring(0, 800));
          }

          if (examples.length) {
            out.push("\nExamples:");
            examples.slice(0, 8).forEach(x => out.push(x));
          }

          // Final cleanup: remove duplicates & empty
          out = Array.from(new Set(out)).filter(Boolean);
          return out;
        })
        .catch(e => {
          // Last resort: return the query string as fallback
          return ["No definition found (offline fallback). Try Google Translate or check internet connection."];
        });
    });
}

// Wrapper: getDefinition returns a single string or array join
function getDefinition(word) {
  return new Promise(function (resolve, reject) {
    findWord(word)
      .then(results => {
        // Join with two line breaks for readability in ODH popup
        if (!results || results.length === 0) {
          resolve("No result found");
        } else {
          resolve(results.join("\n\n"));
        }
      })
      .catch(error => {
        console.error("getDefinition error:", error);
        resolve("Error getting definition");
      });
  });
}

// Main: use selectedText provided by ODH environment
getDefinition(selectedText)
  .then(definition => {
    // sendResponse is provided by ODH to return the string to the popup
    sendResponse(definition);
  })
  .catch(error => {
    console.error(error);
    sendResponse("Error");
  });
