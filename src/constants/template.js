function msg(key, fallback = "") {
  return chrome.i18n.getMessage(key) || fallback;
}

export function getTemplate() {
  const copy = {
    translatedFrom: msg("content_translated_from", "Translated from"),
    translatePost: msg("content_translate_post", "Translate post"),
  };

  return {
    fromDiv: `<div class="tt-translator-result-container">
              <div class="tt-translator-result-header">
                <span class="tt-translator-result-switch" role="button">${copy.translatedFrom} {0}</span>
              </div>
              <textarea class="tt-translator-result" readonly>{1}</textarea>
            </div>`,
    translateButton: `<div class="tt-translator-button" role="button"><span class="tt-translator-content">${copy.translatePost}</span></div>`,
    loading:
      '<div class="tt-translator-loading-container"><svg class="tt-translator-loading" viewBox="0 0 32 32"><circle class="tt-translator-loading-background" cx="16" cy="16" fill="none" r="14" stroke-width="4" style="stroke: #1da1f2; opacity: 0.2;"></circle><circle class="tt-translator-loading-front" cx="16" cy="16" fill="none" r="14" stroke-width="4" style="stroke: #1da1f2; stroke-dasharray: 80; stroke-dashoffset: 60;"></circle></svg></div>',
  };
}

export default getTemplate();
