import md5 from "blueimp-md5";
import config from "./constants/config";
import { randomString, stringifyQueryParameter, retry } from "./utils/index";

const { googleTranslatorAPI, baiduTranslatorAPI, llmAPIs } = config;

const DEFAULT_LLM_PROVIDER = "openai";
const DEFAULT_UI_LANGUAGE = "zh";
const PROVIDER_LABEL_MAP = {
  google: "Google Translate",
  baidu: "Baidu Translate",
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  groq: "Groq",
  siliconflow: "SiliconFlow",
};
const LLM_DEFAULT_MODEL_MAP = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.0-flash",
  openrouter: "deepseek/deepseek-chat-v3-0324:free",
  deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  siliconflow: "Qwen/Qwen2.5-7B-Instruct",
};
const SOURCE_LANGUAGE_MAP = {
  auto: { zh: "自动检测", en: "Auto" },
  und: { zh: "自动检测", en: "Auto" },
  jp: { zh: "日语", en: "Japanese" },
  ja: { zh: "日语", en: "Japanese" },
  en: { zh: "英语", en: "English" },
  ko: { zh: "韩语", en: "Korean" },
  fr: { zh: "法语", en: "French" },
  de: { zh: "德语", en: "German" },
  es: { zh: "西班牙语", en: "Spanish" },
  id: { zh: "印尼语", en: "Indonesian" },
  tr: { zh: "土耳其语", en: "Turkish" },
  pt: { zh: "葡萄牙语", en: "Portuguese" },
  ar: { zh: "阿拉伯语", en: "Arabic" },
  hi: { zh: "印地语", en: "Hindi" },
};
const TARGET_LANGUAGE_MAP = {
  "zh-CN": {
    labels: { zh: "简体中文", en: "Simplified Chinese" },
    google: "zh-CN",
    baidu: "zh",
  },
  "zh-TW": {
    labels: { zh: "繁体中文", en: "Traditional Chinese" },
    google: "zh-TW",
    baidu: "cht",
  },
  en: {
    labels: { zh: "英语", en: "English" },
    google: "en",
    baidu: "en",
  },
  ja: {
    labels: { zh: "日语", en: "Japanese" },
    google: "ja",
    baidu: "jp",
  },
  ko: {
    labels: { zh: "韩语", en: "Korean" },
    google: "ko",
    baidu: "kor",
  },
  fr: {
    labels: { zh: "法语", en: "French" },
    google: "fr",
    baidu: "fra",
  },
  de: {
    labels: { zh: "德语", en: "German" },
    google: "de",
    baidu: "de",
  },
  es: {
    labels: { zh: "西班牙语", en: "Spanish" },
    google: "es",
    baidu: "spa",
  },
  id: {
    labels: { zh: "印尼语", en: "Indonesian" },
    google: "id",
    baidu: "id",
  },
  tr: {
    labels: { zh: "土耳其语", en: "Turkish" },
    google: "tr",
    baidu: "tr",
  },
  pt: {
    labels: { zh: "葡萄牙语", en: "Portuguese" },
    google: "pt",
    baidu: "pt",
  },
  ar: {
    labels: { zh: "阿拉伯语", en: "Arabic" },
    google: "ar",
    baidu: "ara",
  },
  hi: {
    labels: { zh: "印地语", en: "Hindi" },
    google: "hi",
    baidu: "hi",
  },
};
const MESSAGE_MAP = {
  zh: {
    llmApiKeyRequired: "请先在插件设置中填写 LLM API Key",
    providerHttpError: "{provider} API 调用失败（HTTP {status}）",
    providerEmpty: "{provider} 返回内容为空",
    baiduConfigError: "百度翻译 API 配置错误，请检查 API 配置",
    baiduBalanceError: "百度翻译 API 余额不足，请确认账户余额",
    baiduCredentialRequired: "请先在插件设置中填写 Baidu APP ID 和密钥",
    translateErrorPrefix: "发生错误，错误信息为",
  },
  en: {
    llmApiKeyRequired: "Please fill in LLM API key in plugin settings first.",
    providerHttpError: "{provider} API request failed (HTTP {status})",
    providerEmpty: "{provider} returned an empty result",
    baiduConfigError: "Baidu Translate API config is invalid. Please check APP ID and key.",
    baiduBalanceError: "Baidu Translate API balance is insufficient.",
    baiduCredentialRequired: "Please fill in Baidu APP ID and key in plugin settings first.",
    translateErrorPrefix: "Error: ",
  },
};

function detectUILanguage(locale = "") {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getDefaultTargetLanguageFromLocale(locale = "") {
  return detectUILanguage(locale) === "zh" ? "zh-CN" : "en";
}

function getTranslatorFromStorage(storage = {}) {
  if (storage.translator) {
    return storage.translator;
  }

  return storage.appId && storage.appKey ? "baidu" : "google";
}

function getMessage(key, uiLanguage, params = {}) {
  const language = uiLanguage === "en" ? "en" : "zh";
  const template = MESSAGE_MAP[language][key] || MESSAGE_MAP.zh[key] || "";
  return template.replace(/\{(\w+)\}/g, (_match, token) => params[token] || "");
}

function localeToName(locale = "auto", uiLanguage = DEFAULT_UI_LANGUAGE) {
  const language = uiLanguage === "en" ? "en" : "zh";
  return SOURCE_LANGUAGE_MAP[locale]?.[language] || SOURCE_LANGUAGE_MAP.auto[language] || locale;
}

function getTargetLanguageConfig(targetLanguage) {
  return TARGET_LANGUAGE_MAP[targetLanguage] || TARGET_LANGUAGE_MAP["zh-CN"];
}

function getTargetLanguageLabel(targetLanguage, uiLanguage = DEFAULT_UI_LANGUAGE) {
  const language = uiLanguage === "en" ? "en" : "zh";
  const configItem = getTargetLanguageConfig(targetLanguage);
  return configItem.labels[language] || configItem.labels.zh;
}

function createProviderErrorMessage(provider, status, uiLanguage) {
  return getMessage("providerHttpError", uiLanguage, {
    provider: PROVIDER_LABEL_MAP[provider] || provider,
    status: String(status),
  });
}

function createLLMTranslatePrompt(
  text,
  locale = "auto",
  targetLanguage = "zh-CN",
  uiLanguage = DEFAULT_UI_LANGUAGE
) {
  const sourceLabel = localeToName(locale, uiLanguage);
  const targetLabel = getTargetLanguageLabel(targetLanguage, uiLanguage);

  if (uiLanguage === "en") {
    return [
      `Please translate the following text into ${targetLabel}.`,
      "Requirements:",
      "1. Output translation only, without explanations or prefixes/suffixes.",
      "2. Preserve tone, paragraphs, lists, emoji, @mentions, and #hashtags.",
      "3. Keep URLs unchanged.",
      `Source language: ${sourceLabel}`,
      "Text:",
      text,
    ].join("\n");
  }

  return [
    `请将下面文本翻译成${targetLabel}。`,
    "要求：",
    "1. 只输出译文，不要附加解释、注释或前后缀。",
    "2. 保留原文的语气、分段、列表、表情和 @提及/#话题。",
    "3. URL 保持不变。",
    `原文语言：${sourceLabel}`,
    "原文：",
    text,
  ].join("\n");
}

async function init() {
  const storage = (await chrome.storage.local.get()) ?? {};
  const browserLanguage = globalThis.navigator?.language || "zh-CN";
  const uiLanguage = detectUILanguage(browserLanguage);
  const llmProvider = storage.llmProvider || DEFAULT_LLM_PROVIDER;
  const targetLanguage = TARGET_LANGUAGE_MAP[storage.targetLanguage]
    ? storage.targetLanguage
    : getDefaultTargetLanguageFromLocale(browserLanguage);

  globalThis.config = {
    appId: storage.appId ?? "",
    appKey: storage.appKey ?? "",
    translator: getTranslatorFromStorage(storage),
    targetLanguage,
    uiLanguage,
    llmProvider,
    llmApiKey: storage.llmApiKey ?? "",
    llmModel: storage.llmModel || LLM_DEFAULT_MODEL_MAP[llmProvider],
  };
}

function generateSignature({ appid, q, salt }, appkey) {
  return md5(`${appid}${q}${salt}${appkey}`);
}

function parseOpenAICompatibleResponse(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.type === "text") {
          return item?.text || "";
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function parseAnthropicResponse(payload) {
  return (payload?.content || [])
    .map((item) => (item?.type === "text" ? item?.text || "" : ""))
    .join("")
    .trim();
}

function parseGeminiResponse(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((item) => item?.text || "")
    .join("")
    .trim();
}

async function translateByOpenAICompatible(text, locale, provider, targetLanguage, uiLanguage) {
  const apiKey = globalThis.config?.llmApiKey;
  const model = globalThis.config?.llmModel || LLM_DEFAULT_MODEL_MAP[provider];
  const url = llmAPIs[provider];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Output translation only.",
        },
        {
          role: "user",
          content: createLLMTranslatePrompt(text, locale, targetLanguage, uiLanguage),
        },
      ],
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status, uiLanguage)));
  }

  const payload = await response.json();
  const result = parseOpenAICompatibleResponse(payload);
  if (!result) {
    return Promise.reject(
      new Error(
        getMessage("providerEmpty", uiLanguage, {
          provider: PROVIDER_LABEL_MAP[provider] || provider,
        })
      )
    );
  }

  return result;
}

async function translateByAnthropic(text, locale, targetLanguage, uiLanguage) {
  const provider = "anthropic";
  const apiKey = globalThis.config?.llmApiKey;
  const model = globalThis.config?.llmModel || LLM_DEFAULT_MODEL_MAP[provider];
  const response = await fetch(llmAPIs[provider], {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0,
      system: "You are a professional translator. Output translation only.",
      messages: [
        { role: "user", content: createLLMTranslatePrompt(text, locale, targetLanguage, uiLanguage) },
      ],
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status, uiLanguage)));
  }

  const payload = await response.json();
  const result = parseAnthropicResponse(payload);
  if (!result) {
    return Promise.reject(
      new Error(
        getMessage("providerEmpty", uiLanguage, {
          provider: PROVIDER_LABEL_MAP[provider] || provider,
        })
      )
    );
  }

  return result;
}

async function translateByGemini(text, locale, targetLanguage, uiLanguage) {
  const provider = "gemini";
  const apiKey = globalThis.config?.llmApiKey;
  const model = globalThis.config?.llmModel || LLM_DEFAULT_MODEL_MAP[provider];
  const url = `${llmAPIs[provider]}/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: createLLMTranslatePrompt(text, locale, targetLanguage, uiLanguage) }] }],
      generationConfig: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status, uiLanguage)));
  }

  const payload = await response.json();
  const result = parseGeminiResponse(payload);
  if (!result) {
    return Promise.reject(
      new Error(
        getMessage("providerEmpty", uiLanguage, {
          provider: PROVIDER_LABEL_MAP[provider] || provider,
        })
      )
    );
  }

  return result;
}

async function translateByLLM(text, locale, targetLanguage, uiLanguage) {
  const provider = llmAPIs[globalThis.config?.llmProvider]
    ? globalThis.config?.llmProvider
    : DEFAULT_LLM_PROVIDER;

  if (!globalThis.config?.llmApiKey) {
    return getMessage("llmApiKeyRequired", uiLanguage);
  }

  if (provider === "anthropic") {
    return translateByAnthropic(text, locale, targetLanguage, uiLanguage);
  }

  if (provider === "gemini") {
    return translateByGemini(text, locale, targetLanguage, uiLanguage);
  }

  return translateByOpenAICompatible(text, locale, provider, targetLanguage, uiLanguage);
}

async function translateWithGoogle(text, targetLanguage, uiLanguage) {
  const target = getTargetLanguageConfig(targetLanguage);
  const url =
    googleTranslatorAPI +
    stringifyQueryParameter({
      q: text,
      tl: target.google,
      sl: "auto",
      client: "dict-chrome-ex",
    });
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage("google", response.status, uiLanguage)));
  }

  const payload = await response.json();
  return payload[0]
    .map((item) => item[0])
    .filter((item) => typeof item === "string")
    .join("");
}

async function translateWithBaidu(text, targetLanguage, uiLanguage) {
  const target = getTargetLanguageConfig(targetLanguage);
  const salt = randomString(5);
  const params = {
    q: text,
    from: "auto",
    to: target.baidu,
    appid: globalThis.config?.appId,
    salt,
  };
  params.sign = generateSignature(params, globalThis.config?.appKey);
  const url = `${baiduTranslatorAPI}?${stringifyQueryParameter(params)}`;
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage("baidu", response.status, uiLanguage)));
  }

  const payload = await response.json();

  if (payload.error_code === "52003") {
    return getMessage("baiduConfigError", uiLanguage);
  }
  if (payload.error_code === "54004") {
    return getMessage("baiduBalanceError", uiLanguage);
  }
  if (payload.error_code) {
    return Promise.reject(new Error("translate result error!"));
  }

  return payload.trans_result.map((item) => item.dst).join("\n");
}

async function translate(text, locale) {
  const provider = globalThis.config?.translator || "google";
  const targetLanguage = globalThis.config?.targetLanguage || "zh-CN";
  const uiLanguage = globalThis.config?.uiLanguage || DEFAULT_UI_LANGUAGE;
  const targetLabel = getTargetLanguageLabel(targetLanguage, uiLanguage);

  if (provider === "llm") {
    const llmProvider = globalThis.config?.llmProvider || DEFAULT_LLM_PROVIDER;
    const translateResult = await translateByLLM(text, locale, targetLanguage, uiLanguage);
    return {
      provider: llmProvider,
      providerLabel: PROVIDER_LABEL_MAP[llmProvider] || "LLM",
      targetLabel,
      translateResult,
    };
  }

  if (provider === "baidu") {
    if (!globalThis.config?.appId || !globalThis.config?.appKey) {
      return {
        provider,
        providerLabel: PROVIDER_LABEL_MAP.baidu,
        targetLabel,
        translateResult: getMessage("baiduCredentialRequired", uiLanguage),
      };
    }

    return {
      provider,
      providerLabel: PROVIDER_LABEL_MAP.baidu,
      targetLabel,
      translateResult: await translateWithBaidu(text, targetLanguage, uiLanguage),
    };
  }

  return {
    provider: "google",
    providerLabel: PROVIDER_LABEL_MAP.google,
    targetLabel,
    translateResult: await translateWithGoogle(text, targetLanguage, uiLanguage),
  };
}

function updateAllTabsConfig() {
  chrome.tabs.query({ url: "*://*.x.com/*" }, (tabs) => {
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
    const uiLanguage = globalThis.config?.uiLanguage || DEFAULT_UI_LANGUAGE;

    if (!text) {
      return;
    }

    retry(
      async () => {
        const res = await translate(text, locale);
        return Promise.resolve(res);
      },
      1,
      5
    )
      .then((result) => {
        sendResponse({
          type: "translate-result",
          payload: {
            translateResult: result.translateResult,
            provider: result.provider,
            providerLabel: result.providerLabel,
            sourceLabel: localeToName(locale, uiLanguage),
            targetLabel: result.targetLabel,
          },
        });
      })
      .catch((error) => {
        sendResponse({
          type: "translate-error",
          payload: {
            translateResult: `${getMessage("translateErrorPrefix", uiLanguage)}${
              error?.message || error.toString()
            }`,
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
    if (/.*x.com\/.*/.test(activeTab.url)) {
      chrome.action.setIcon({ path: "images/main_logo_128.png" });
    } else {
      chrome.action.setIcon({ path: "images/main_logo_disabled.png" });
    }
  });
});
