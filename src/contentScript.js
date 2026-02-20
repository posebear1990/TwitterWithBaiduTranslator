import { retry, createElement, templateReplace } from "./utils/index";
import { getTemplate } from "./constants/template";

let translator = "google";
let targetLanguage = "zh-CN";
let uiLanguage = "zh";

function detectUILanguage(locale = "") {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getDefaultTargetLanguageFromLocale(locale = "") {
  return detectUILanguage(locale) === "zh" ? "zh-CN" : "en";
}

const I18N_TEXT_MAP = {
  zh: {
    translatorLabel: "翻译引擎",
    autoDetect: "自动检测",
    translateFailed: "翻译失败，请稍后重试",
  },
  en: {
    translatorLabel: "Translator",
    autoDetect: "Auto",
    translateFailed: "Translation failed. Please try again.",
  },
};

function t(key) {
  return I18N_TEXT_MAP[uiLanguage]?.[key] || I18N_TEXT_MAP.zh[key] || key;
}
function getTranslatorFromStorage(storage = {}) {
  if (storage.translator) {
    return storage.translator;
  }

  return storage.appId && storage.appKey ? "baidu" : "google";
}

function getProviderLogoPath(provider, theme) {
  if (["google", "baidu"].includes(provider)) {
    return chrome.runtime.getURL(`/images/${provider}_logo_${theme}.png`);
  }

  return chrome.runtime.getURL("/images/main_logo_32.png");
}

function shouldHideTranslatorButton(tweetLang = "") {
  if (!targetLanguage.toLowerCase().startsWith("zh")) {
    return false;
  }

  return tweetLang.toLowerCase().startsWith("zh");
}

function getTweetRawText($textContainer) {
  const $clone = $textContainer.cloneNode(true);
  [
    ".tt-translator-button",
    ".tt-translator-result-container",
    ".tt-translator-loading-container",
  ].forEach((selector) => {
    $clone.querySelectorAll(selector).forEach(($node) => $node.remove());
  });

  return ($clone.textContent || "").trim();
}

function addTranslatorButton($timelineWrapper, $translateButton) {
  const isStatusPage = /.*x.com\/.*\/status\/.*/.test(window.location.href);

  let tweetWrapperList = [
    ...$timelineWrapper.querySelectorAll(
      `div[aria-label] article[role=article]
      div[lang]:not([data-has-translator=true])`
    ),
  ];

  tweetWrapperList = tweetWrapperList.filter(
    ($tweetWrapper) => !shouldHideTranslatorButton($tweetWrapper.getAttribute("lang") || "")
  );

  if (!tweetWrapperList.length) {
    return;
  }

  if (isStatusPage) {
    const $googleTranslateWrapper = tweetWrapperList.find(
      ($tweetWrapper) =>
        $tweetWrapper.nextElementSibling?.getAttribute("role") === "button" ||
        $tweetWrapper.nextElementSibling?.querySelector("div > span[aria-expanded]")
    );

    if ($googleTranslateWrapper?.getAttribute("lang") === "en") {
      tweetWrapperList = tweetWrapperList.filter(
        ($tweetWrapper) => $tweetWrapper !== $googleTranslateWrapper
      );
    } else {
      $googleTranslateWrapper?.nextElementSibling?.getAttribute("role") === "button" &&
        $googleTranslateWrapper.nextElementSibling.remove();
    }
  }
  tweetWrapperList.forEach(($tweetWrapper) => {
    $tweetWrapper.setAttribute("data-has-translator", true);
    $tweetWrapper.textContent && $tweetWrapper.appendChild($translateButton.cloneNode(true));
  });
}

async function init() {
  const storage = (await chrome.storage.local.get()) ?? {};
  translator = getTranslatorFromStorage(storage);
  uiLanguage = detectUILanguage(navigator.language || "zh-CN");
  targetLanguage = storage.targetLanguage || getDefaultTargetLanguageFromLocale(navigator.language);

  const $timelineWrapper = document.querySelector(
    "main[role=main] div[data-testid=primaryColumn] section[role=region] div[aria-label] > div"
  );
  if (!$timelineWrapper?.innerText) {
    throw new Error("time line is not loaded");
  }

  // 添加翻译按钮
  const $aTag = document.querySelector('a[href="/i/keyboard_shortcuts"]');
  const template = getTemplate(uiLanguage);
  const $translateButton = createElement(template.translateButton);
  const buttonColor = $aTag ? getComputedStyle($aTag).color : "rgb(29, 161, 242)";
  $translateButton.style.color = buttonColor;

  addTranslatorButton($timelineWrapper, $translateButton);
  const observer = new MutationObserver(() => {
    addTranslatorButton($timelineWrapper, $translateButton);
  });
  observer.observe($timelineWrapper, { childList: true });

  // 监听导航：推荐/关注切换
  const tabElement = document.querySelector('main[role="main"] nav[role="navigation"] div[role="tablist"] a[role="tab"]');
  if (tabElement) {
    const tabObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-selected') {
          observer.disconnect();
          tabObserver.disconnect();
          retry(init, 1, 15);
        }
      });
    });

    tabObserver.observe(tabElement, {
      attributes: true,
      attributeFilter: ['aria-selected']
    });
  }


  // 添加翻译按钮响应事件
  if ($timelineWrapper.getAttribute("data-is-event-ready") === "true") {
    return true;
  }
  let isLoading = false;
  $timelineWrapper.setAttribute("data-is-event-ready", "true");
  $timelineWrapper.addEventListener(
    "click",
    (e) => {
      if (isLoading) {
        return;
      }
      if (["tt-translator-content", "tt-translator-button"].includes(e.target.className)) {
        const $textContainer = e.target.closest("div[data-has-translator=true]");
        const $button = $textContainer.getElementsByClassName("tt-translator-button")[0];
        const $loading = createElement(template.loading);
        $loading.getElementsByClassName("tt-translator-loading-background")[0].style.stroke =
          buttonColor;
        $loading.getElementsByClassName("tt-translator-loading-front")[0].style.stroke =
          buttonColor;

        const text = getTweetRawText($textContainer);
        const locale =
          { ja: "jp", und: "auto" }[$textContainer.getAttribute("lang")] ??
          $textContainer.getAttribute("lang");
        const localeMap = uiLanguage === "zh" ? { jp: "日语", en: "英语" } : { jp: "Japanese", en: "English" };

        $textContainer.appendChild($loading);
        isLoading = true;
        chrome.runtime?.id &&
          chrome.runtime.sendMessage({ type: "translate", payload: { text, locale } }, (resp) => {
            $loading.remove();
            isLoading = false;
            $button.classList.add("hide");

            const theme = getComputedStyle(document.body).colorScheme === 'dark' ? 'dark' : 'light';
            const provider = resp?.payload?.provider || translator;
            const providerLabel = resp?.payload?.providerLabel || t("translatorLabel");
            const sourceLabel = resp?.payload?.sourceLabel || localeMap[locale] || t("autoDetect");
            const targetLabel = resp?.payload?.targetLabel || t("autoDetect");
            const translateResult = resp?.payload?.translateResult || t("translateFailed");
            const $translateContent = createElement(
              templateReplace(
                template.fromDiv,
                getProviderLogoPath(provider, theme),
                `${providerLabel} / ${sourceLabel} -> ${targetLabel}`,
                translateResult
              )
            );
            const $switch = $translateContent.getElementsByClassName(
              "tt-translator-result-switch"
            )[0];
            $switch.style.color = buttonColor;

            $switch.addEventListener("click", () => {
              $button.classList.remove("hide");
              $translateContent.remove();
            });
            $textContainer.appendChild($translateContent);
          });
      }
    },
    false
  );

  return true;
}

chrome.runtime.onMessage.addListener((request, _sender) => {
  if (request.type === "url-change") {
    retry(init, 1, 15);
  }
});

retry(init, 0.5, 15);
