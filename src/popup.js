import { debounce } from "./utils";

const DEFAULT_LLM_PROVIDER = "openai";
const TARGET_LANGUAGE_VALUES = [
  "zh-CN",
  "zh-TW",
  "en",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "id",
  "tr",
  "pt",
  "ar",
  "hi",
];
const LLM_DEFAULT_MODEL_MAP = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.0-flash",
  openrouter: "deepseek/deepseek-chat-v3-0324:free",
  deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  siliconflow: "Qwen/Qwen2.5-7B-Instruct",
};

const I18N_TEXT_MAP = {
  zh: {
    title: "翻译引擎配置",
    translatorLabel: "翻译引擎",
    "translator.google": "Google Translate（默认）",
    "translator.llm": "LLM API（主流提供商）",
    targetLanguageLabel: "目标语言",
    "target.zh-CN": "简体中文",
    "target.zh-TW": "繁体中文",
    "target.en": "英语",
    "target.ja": "日语",
    "target.ko": "韩语",
    "target.fr": "法语",
    "target.de": "德语",
    "target.es": "西班牙语",
    "target.id": "印尼语",
    "target.tr": "土耳其语",
    "target.pt": "葡萄牙语",
    "target.ar": "阿拉伯语",
    "target.hi": "印地语",
    baiduAppIdLabel: "Baidu APP ID",
    baiduKeyLabel: "Baidu 密钥",
    llmProviderLabel: "LLM 提供商",
    llmApiKeyLabel: "API Key",
    llmModelLabel: "模型（可自定义）",
    savedStatus: "配置已保存",
    "tip.targetLanguage": "支持在弹窗中选择翻译目标语言（默认按浏览器语言在中文/英语间选择）。",
    "tip.google": "引擎选择为 <b>Google</b> 时无需配置 API。",
    "tip.baidu": "引擎选择为 <b>Baidu</b> 时请填写 APP ID + 密钥。",
    "tip.llm": "引擎选择为 <b>LLM API</b> 时请填写提供商、API Key 与模型名称。",
    "tip.mappingIssue":
      '由于测试不足，如果配置映射有问题，可以联系我：<a href="mailto:posebear1990@gmail.com">posebear1990@gmail.com</a>。',
    "tip.baiduVideoPrefix": "百度配置方法可参考",
    "tip.baiduVideoLink": "本视频",
    "tip.baiduVideoSuffix": "❤",
  },
  en: {
    title: "Translator Settings",
    translatorLabel: "Translator",
    "translator.google": "Google Translate (Default)",
    "translator.llm": "LLM API (Mainstream Providers)",
    targetLanguageLabel: "Target language",
    "target.zh-CN": "Simplified Chinese",
    "target.zh-TW": "Traditional Chinese",
    "target.en": "English",
    "target.ja": "Japanese",
    "target.ko": "Korean",
    "target.fr": "French",
    "target.de": "German",
    "target.es": "Spanish",
    "target.id": "Indonesian",
    "target.tr": "Turkish",
    "target.pt": "Portuguese",
    "target.ar": "Arabic",
    "target.hi": "Hindi",
    baiduAppIdLabel: "Baidu APP ID",
    baiduKeyLabel: "Baidu Key",
    llmProviderLabel: "LLM provider",
    llmApiKeyLabel: "API key",
    llmModelLabel: "Model (customizable)",
    savedStatus: "Saved",
    "tip.targetLanguage":
      "You can choose the target language in this popup (default picks Chinese or English by browser language).",
    "tip.google": "No API setup is needed when using <b>Google</b>.",
    "tip.baidu": "Fill in APP ID and key when using <b>Baidu</b>.",
    "tip.llm": "Fill in provider, API key, and model when using <b>LLM API</b>.",
    "tip.mappingIssue":
      'Due to limited testing, if any mapping configuration is incorrect, contact me: <a href="mailto:posebear1990@gmail.com">posebear1990@gmail.com</a>.',
    "tip.baiduVideoPrefix": "Baidu setup guide:",
    "tip.baiduVideoLink": "video",
    "tip.baiduVideoSuffix": "",
  },
};

let hideSavedStatusTimer = null;
let uiLanguage = "zh";

function detectUILanguage(locale = "") {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getDefaultTargetLanguageFromLocale(locale = "") {
  return detectUILanguage(locale) === "zh" ? "zh-CN" : "en";
}

function t(key) {
  return I18N_TEXT_MAP[uiLanguage]?.[key] || I18N_TEXT_MAP.zh[key] || key;
}

function getInput(name) {
  return document.querySelector(`.tt-popup-form-input[name=${name}]`);
}

function getValue(name) {
  return getInput(name)?.value?.trim() || "";
}

function setValue(name, value = "") {
  const $input = getInput(name);
  if ($input) {
    $input.value = value;
  }
}

function getTranslatorFromStorage(storage = {}) {
  if (storage.translator) {
    return storage.translator;
  }

  return storage.appId && storage.appKey ? "baidu" : "google";
}

function normalizeTargetLanguage(targetLanguage, browserLanguage) {
  if (TARGET_LANGUAGE_VALUES.includes(targetLanguage)) {
    return targetLanguage;
  }

  return getDefaultTargetLanguageFromLocale(browserLanguage);
}

function toggleGroup(name, isVisible) {
  const $group = document.querySelector(`.tt-popup-form-group[data-group=${name}]`);
  if (!$group) {
    return;
  }

  $group.classList.toggle("is-hidden", !isVisible);
}

function updateVisibility() {
  const translator = getValue("translator") || "google";
  toggleGroup("baidu", translator === "baidu");
  toggleGroup("llm", translator === "llm");
}

function maybeApplyDefaultModel(force = false) {
  const llmProvider = getValue("llmProvider") || DEFAULT_LLM_PROVIDER;
  const model = getValue("llmModel");

  if (force || !model) {
    setValue("llmModel", LLM_DEFAULT_MODEL_MAP[llmProvider]);
  }
}

function applyI18n() {
  document.documentElement.lang = uiLanguage === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach(($node) => {
    const key = $node.getAttribute("data-i18n");
    const text = t(key);
    if (!text) {
      return;
    }

    if (key.startsWith("tip.")) {
      $node.innerHTML = text;
      return;
    }

    $node.textContent = text;
  });

  document.querySelectorAll("[data-i18n-option]").forEach(($node) => {
    const key = $node.getAttribute("data-i18n-option");
    const text = t(key);
    if (text) {
      $node.textContent = text;
    }
  });

  const $baiduVideoTip = document.querySelector("[data-role=baidu-video-tip]");
  if ($baiduVideoTip) {
    $baiduVideoTip.style.display = uiLanguage === "zh" ? "" : "none";
  }
}

function showSavedStatus() {
  const $status = document.querySelector("[data-role=save-status]");
  if (!$status) {
    return;
  }

  $status.classList.add("is-visible");
  if (hideSavedStatusTimer) {
    clearTimeout(hideSavedStatusTimer);
  }

  hideSavedStatusTimer = setTimeout(() => {
    $status.classList.remove("is-visible");
  }, 1500);
}

async function saveApiConfig() {
  const browserLanguage = navigator.language || "zh-CN";
  const translator = getValue("translator") || "google";
  const targetLanguage = normalizeTargetLanguage(getValue("targetLanguage"), browserLanguage);
  const llmProvider = getValue("llmProvider") || DEFAULT_LLM_PROVIDER;
  const llmModel = getValue("llmModel") || LLM_DEFAULT_MODEL_MAP[llmProvider];
  const payload = {
    translator,
    targetLanguage,
    appId: getValue("appId"),
    appKey: getValue("appKey"),
    llmProvider,
    llmApiKey: getValue("llmApiKey"),
    llmModel,
  };

  await chrome.storage.local.set(payload);
  chrome.runtime?.id && chrome.runtime.sendMessage({ type: "config-update" });
  showSavedStatus();
}

const onFieldChange = debounce(saveApiConfig, 400);

async function init() {
  const browserLanguage = navigator.language || "zh-CN";
  const storage = (await chrome.storage.local.get()) ?? {};
  uiLanguage = detectUILanguage(browserLanguage);
  applyI18n();

  const translator = getTranslatorFromStorage(storage);
  const llmProvider = storage.llmProvider || DEFAULT_LLM_PROVIDER;
  const targetLanguage = normalizeTargetLanguage(storage.targetLanguage, browserLanguage);

  setValue("translator", translator);
  setValue("targetLanguage", targetLanguage);
  setValue("appId", storage.appId ?? "");
  setValue("appKey", storage.appKey ?? "");
  setValue("llmProvider", llmProvider);
  setValue("llmApiKey", storage.llmApiKey ?? "");
  setValue("llmModel", storage.llmModel || LLM_DEFAULT_MODEL_MAP[llmProvider]);

  updateVisibility();
}

document.querySelectorAll(".tt-popup-form-input").forEach(($input) => {
  const handleChange = () => {
    if ($input.name === "llmProvider") {
      maybeApplyDefaultModel();
    }

    updateVisibility();
    onFieldChange();
  };

  $input.addEventListener("input", handleChange);
  $input.addEventListener("change", handleChange);
});

init();
