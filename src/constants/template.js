function normalizeUILanguage(uiLanguage = "zh") {
  return uiLanguage === "en" ? "en" : "zh";
}

const I18N_TEXT_MAP = {
  zh: {
    poweredBy: "由",
    translatedFrom: "翻译自",
    translatePost: "翻译帖子",
  },
  en: {
    poweredBy: "By",
    translatedFrom: "Translated from",
    translatePost: "Translate post",
  },
};

export function getTemplate(uiLanguage = "zh") {
  const language = normalizeUILanguage(uiLanguage);
  const copy = I18N_TEXT_MAP[language];

  return {
    fromDiv: `<div class="tt-translator-result-container">
              <div class="tt-translator-result-header">
                ${copy.poweredBy}<a target="_blank" role="link" data-focusable="true" class="tt-translator-result-supporter" rel="noopener noreferrer"> <img src="{0}" /> </a><span class="tt-translator-result-switch" role="button">${copy.translatedFrom} {1}</span>
              </div>
              <textarea class="tt-translator-result" readonly>{2}</textarea>
            </div>`,
    translateButton: `<div class="tt-translator-button" role="button"><span class="tt-translator-content">${copy.translatePost}</span></div>`,
    loading:
      '<div class="tt-translator-loading-container"><svg class="tt-translator-loading" viewBox="0 0 32 32"><circle class="tt-translator-loading-background" cx="16" cy="16" fill="none" r="14" stroke-width="4" style="stroke: #1da1f2; opacity: 0.2;"></circle><circle class="tt-translator-loading-front" cx="16" cy="16" fill="none" r="14" stroke-width="4" style="stroke: #1da1f2; stroke-dasharray: 80; stroke-dashoffset: 60;"></circle></svg></div>',
  };
}

export default getTemplate("zh");
