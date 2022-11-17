import md5 from "blueimp-md5";
import config from "./constants/config";
import { randomString, stringifyQueryParameter, retry } from "./utils/index";

const { googleTranslatorAPI, baiduTranslatorAPI } = config;

async function init() {
  const { appId, appKey } = (await chrome.storage.local.get()) ?? {};
  globalThis.config = { appId, appKey, translator: appId && appKey ? "baidu" : "google" };
}

function generateSignature({ appid, q, salt }, appkey) {
  return md5(`${appid}${q}${salt}${appkey}`);
}

async function translate(text, locale) {
  let url = "";
  if (globalThis.config?.translator === "google") {
    url =
      googleTranslatorAPI +
      stringifyQueryParameter({
        q: text,
        tl: "zh_CN",
        sl: "auto",
        client: "dict-chrome-ex",
      });
  } else {
    const salt = randomString(5);
    const params = {
      q: text,
      from: locale,
      to: "zh",
      appid: globalThis.config?.appId,
      salt,
    };
    params.sign = generateSignature(params, globalThis.config?.appKey);
    url = `${baiduTranslatorAPI}?${stringifyQueryParameter(params)}`;
  }

  const response = await fetch(url, {
    method: "GET",
  });

  const resp = await response.json();

  if (resp.error_code === "52003") {
    return "百度翻译 API 配置错误，请检查 API 配置";
  } else if (resp.error_code === "54004") {
    return "百度翻译 API 余额不足，请确认账户余额";
  } else if (resp.error_code) {
    return Promise.reject(new Error("translate result error!"));
  }

  if (globalThis.config?.translator === "google") {
    return resp[0]
      .map((item) => item[0])
      .filter((item) => typeof item === "string")
      .join("");
  }

  return resp.trans_result.map((item) => item.dst).join("\n");
}

function updateAllTabsConfig() {
  chrome.tabs.query({ url: "*://*.twitter.com/*" }, (tabs) => {
    tabs.forEach((item) => {
      chrome.tabs.sendMessage(item.id, {
        type: "url-change",
      });
    });
  });
}

init();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === "translate") {
    const { text, locale = "auto" } = request?.payload || {};

    if (!text) {
      return;
    }

    retry(
      async () => {
        const res = await translate(text, locale);
        if (!res.error_code) {
          return Promise.resolve(res);
        }

        return Promise.reject(new Error("Exceed the maximum number of concurrent!"));
      },
      1,
      5
    )
      .then((resp) => {
        sendResponse({
          type: "translate-result",
          payload: {
            translateResult: resp,
          },
        });
      })
      .catch((error) => {
        sendResponse({
          type: "translate-error",
          payload: {
            translateResult: "发生错误，错误信息为" + error.toString(),
          },
        });
      });
  }

  if (request?.type === "config-update") {
    init();
    updateAllTabsConfig();
  }

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      type: "url-change",
    });
  }
});
chrome.runtime.onInstalled.addListener(() => {
  updateAllTabsConfig();
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (/.*twitter.com\/.*/.test(activeTab.url)) {
      chrome.action.setIcon({ path: "images/main_logo_128.png" });
    } else {
      chrome.action.setIcon({ path: "images/main_logo_disabled.png" });
    }
  });
});
