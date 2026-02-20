import md5 from "blueimp-md5";
import config from "./constants/config";
import { randomString, stringifyQueryParameter, retry } from "./utils/index";

const { googleTranslatorAPI, baiduTranslatorAPI, llmAPIs } = config;

const DEFAULT_LLM_PROVIDER = "openai";
const DEFAULT_TARGET_LANGUAGE = "zh-CN";
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
const LOCALE_NAME_MAP = {
  auto: "自动检测",
  und: "自动检测",
  jp: "日语",
  ja: "日语",
  en: "英语",
  ko: "韩语",
  fr: "法语",
  de: "德语",
  es: "西班牙语",
  id: "印尼语",
  tr: "土耳其语",
  pt: "葡萄牙语",
  ar: "阿拉伯语",
  hi: "印地语",
};
const TARGET_LANGUAGE_MAP = {
  "zh-CN": {
    label: "简体中文",
    google: "zh-CN",
    baidu: "zh",
  },
  "zh-TW": {
    label: "繁体中文",
    google: "zh-TW",
    baidu: "cht",
  },
  en: {
    label: "英语",
    google: "en",
    baidu: "en",
  },
  ja: {
    label: "日语",
    google: "ja",
    baidu: "jp",
  },
  ko: {
    label: "韩语",
    google: "ko",
    baidu: "kor",
  },
  fr: {
    label: "法语",
    google: "fr",
    baidu: "fra",
  },
  de: {
    label: "德语",
    google: "de",
    baidu: "de",
  },
  es: {
    label: "西班牙语",
    google: "es",
    baidu: "spa",
  },
  id: {
    label: "印尼语",
    google: "id",
    baidu: "id",
  },
  tr: {
    label: "土耳其语",
    google: "tr",
    baidu: "tr",
  },
  pt: {
    label: "葡萄牙语",
    google: "pt",
    baidu: "pt",
  },
  ar: {
    label: "阿拉伯语",
    google: "ar",
    baidu: "ara",
  },
  hi: {
    label: "印地语",
    google: "hi",
    baidu: "hi",
  },
};

function getTranslatorFromStorage(storage = {}) {
  if (storage.translator) {
    return storage.translator;
  }

  return storage.appId && storage.appKey ? "baidu" : "google";
}

async function init() {
  const storage = (await chrome.storage.local.get()) ?? {};
  const llmProvider = storage.llmProvider || DEFAULT_LLM_PROVIDER;
  const targetLanguage = TARGET_LANGUAGE_MAP[storage.targetLanguage]
    ? storage.targetLanguage
    : DEFAULT_TARGET_LANGUAGE;
  globalThis.config = {
    appId: storage.appId ?? "",
    appKey: storage.appKey ?? "",
    translator: getTranslatorFromStorage(storage),
    targetLanguage,
    llmProvider,
    llmApiKey: storage.llmApiKey ?? "",
    llmModel: storage.llmModel || LLM_DEFAULT_MODEL_MAP[llmProvider],
  };
}

function generateSignature({ appid, q, salt }, appkey) {
  return md5(`${appid}${q}${salt}${appkey}`);
}

function localeToName(locale = "auto") {
  return LOCALE_NAME_MAP[locale] || locale;
}

function getTargetLanguageConfig(targetLanguage = DEFAULT_TARGET_LANGUAGE) {
  return TARGET_LANGUAGE_MAP[targetLanguage] || TARGET_LANGUAGE_MAP[DEFAULT_TARGET_LANGUAGE];
}

function createLLMTranslatePrompt(text, locale = "auto", targetLanguage = DEFAULT_TARGET_LANGUAGE) {
  const targetLabel = getTargetLanguageConfig(targetLanguage).label;
  return [
    `请将下面文本翻译成${targetLabel}。`,
    "要求：",
    "1. 只输出译文，不要附加解释、注释或前后缀。",
    "2. 保留原文的语气、分段、列表、表情和 @提及/#话题。",
    "3. URL 保持不变。",
    `原文语言：${localeToName(locale)}`,
    "原文：",
    text,
  ].join("\n");
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

function createProviderErrorMessage(provider, status) {
  return `${PROVIDER_LABEL_MAP[provider] || provider} API 调用失败（HTTP ${status}）`;
}

async function translateByOpenAICompatible(text, locale, provider, targetLanguage) {
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
          content: createLLMTranslatePrompt(text, locale, targetLanguage),
        },
      ],
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status)));
  }

  const payload = await response.json();
  const result = parseOpenAICompatibleResponse(payload);
  if (!result) {
    return Promise.reject(new Error(`${PROVIDER_LABEL_MAP[provider]} 返回内容为空`));
  }

  return result;
}

async function translateByAnthropic(text, locale, targetLanguage) {
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
      messages: [{ role: "user", content: createLLMTranslatePrompt(text, locale, targetLanguage) }],
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status)));
  }

  const payload = await response.json();
  const result = parseAnthropicResponse(payload);
  if (!result) {
    return Promise.reject(new Error(`${PROVIDER_LABEL_MAP[provider]} 返回内容为空`));
  }

  return result;
}

async function translateByGemini(text, locale, targetLanguage) {
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
      contents: [{ parts: [{ text: createLLMTranslatePrompt(text, locale, targetLanguage) }] }],
      generationConfig: { temperature: 0 },
    }),
  });

  if (!response.ok) {
    return Promise.reject(new Error(createProviderErrorMessage(provider, response.status)));
  }

  const payload = await response.json();
  const result = parseGeminiResponse(payload);
  if (!result) {
    return Promise.reject(new Error(`${PROVIDER_LABEL_MAP[provider]} 返回内容为空`));
  }

  return result;
}

async function translateByLLM(text, locale, targetLanguage) {
  const provider = llmAPIs[globalThis.config?.llmProvider]
    ? globalThis.config?.llmProvider
    : DEFAULT_LLM_PROVIDER;
  if (!globalThis.config?.llmApiKey) {
    return "请先在插件设置中填写 LLM API Key";
  }

  if (provider === "anthropic") {
    return translateByAnthropic(text, locale, targetLanguage);
  }

  if (provider === "gemini") {
    return translateByGemini(text, locale, targetLanguage);
  }

  return translateByOpenAICompatible(text, locale, provider, targetLanguage);
}

async function translateWithGoogle(text, targetLanguage) {
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
    return Promise.reject(new Error(createProviderErrorMessage("google", response.status)));
  }

  const payload = await response.json();
  return payload[0]
    .map((item) => item[0])
    .filter((item) => typeof item === "string")
    .join("");
}

async function translateWithBaidu(text, targetLanguage) {
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
    return Promise.reject(new Error(createProviderErrorMessage("baidu", response.status)));
  }

  const payload = await response.json();

  if (payload.error_code === "52003") {
    return "百度翻译 API 配置错误，请检查 API 配置";
  }
  if (payload.error_code === "54004") {
    return "百度翻译 API 余额不足，请确认账户余额";
  }
  if (payload.error_code) {
    return Promise.reject(new Error("translate result error!"));
  }

  return payload.trans_result.map((item) => item.dst).join("\n");
}

async function translate(text, locale) {
  const provider = globalThis.config?.translator || "google";
  const targetLanguage = globalThis.config?.targetLanguage || DEFAULT_TARGET_LANGUAGE;
  const targetLabel = getTargetLanguageConfig(targetLanguage).label;
  if (provider === "llm") {
    const llmProvider = globalThis.config?.llmProvider || DEFAULT_LLM_PROVIDER;
    const translateResult = await translateByLLM(text, locale, targetLanguage);
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
        translateResult: "请先在插件设置中填写 Baidu APP ID 和密钥",
      };
    }

    return {
      provider,
      providerLabel: PROVIDER_LABEL_MAP.baidu,
      targetLabel,
      translateResult: await translateWithBaidu(text, targetLanguage),
    };
  }

  return {
    provider: "google",
    providerLabel: PROVIDER_LABEL_MAP.google,
    targetLabel,
    translateResult: await translateWithGoogle(text, targetLanguage),
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
            sourceLabel: localeToName(locale),
            targetLabel: result.targetLabel,
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
    if (/.*x.com\/.*/.test(activeTab.url)) {
      chrome.action.setIcon({ path: "images/main_logo_128.png" });
    } else {
      chrome.action.setIcon({ path: "images/main_logo_disabled.png" });
    }
  });
});
