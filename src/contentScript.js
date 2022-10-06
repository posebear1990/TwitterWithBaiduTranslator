import { retry, createElement, templateReplace } from "./utils/index";
import template from "./constants/template";

function addTranslatorButton($timelineWrapper, $translateButton) {
  const isStatusPage = /.*twitter.com\/.*\/status\/.*/.test(window.location.href);

  let tweetWrapperList = [
    ...$timelineWrapper.querySelectorAll(
      `div[aria-label] article[role=article]
      div[lang]:not([data-has-translator=true]):not([lang^=zh])`
    )
  ];

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

function init() {
  const $timelineWrapper = document.querySelector(
    "main[role=main] div[data-testid=primaryColumn] section[role=region] div[aria-label] > div"
  );
  if (!$timelineWrapper?.innerText) {
    return false;
  }

  // 添加翻译按钮
  const $translateButton = createElement(template.translateButton);
  const buttonColor =
    getComputedStyle(document.querySelector('header[role="banner"] a[href="/compose/tweet"]'))?.[
      "background-color"
    ] || "rgb(29, 161, 242)";
  $translateButton.style.color = buttonColor;

  addTranslatorButton($timelineWrapper, $translateButton);
  const observer = new MutationObserver(() => {
    addTranslatorButton($timelineWrapper, $translateButton);
  });
  observer.observe($timelineWrapper, { childList: true });

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

        const text = ($textContainer.textContent || "").split("翻译推文")[0];
        const locale =
          $textContainer.getAttribute("lang") === "ja" ? "jp" : $textContainer.getAttribute("lang");
        const localeMap = { jp: "日语", en: "英语" };

        $textContainer.appendChild($loading);
        isLoading = true;
        chrome?.runtime?.sendMessage &&
          chrome.runtime.sendMessage({ type: "translate", payload: { text, locale } }, (resp) => {
            if (resp?.type === "translate-result") {
              $loading.remove();
              isLoading = false;
              $button.classList.add("hide");

              const $translateContent = createElement(
                templateReplace(
                  template.fromDiv,
                  localeMap[locale] || "自动检测",
                  resp?.payload?.translateResult
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
            } else if (resp?.type === "translate-error") {
              $loading.remove();
              isLoading = false;
            }
          });
      }
    },
    false
  );

  return true;
}

chrome.storage.local.get("enable", (resp) => {
  const isEnable = resp.enable;

  if (isEnable) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "url-change") {
        retry(init, 1, 15);
      }
    });

    retry(init, 1, 15);
  }
});
