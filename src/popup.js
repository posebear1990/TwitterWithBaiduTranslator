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

let hideSavedStatusTimer = null;
const isZhUILanguage = (chrome.i18n.getUILanguage() || "").toLowerCase().startsWith("zh");

function getDefaultTargetLanguageFromLocale(locale = "") {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function t(key) {
  return chrome.i18n.getMessage(key) || key;
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
  document.documentElement.lang = isZhUILanguage ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach(($node) => {
    const key = $node.getAttribute("data-i18n");
    const text = t(key);
    if (!text) {
      return;
    }

    if (key.startsWith("tip_")) {
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
    $baiduVideoTip.style.display = isZhUILanguage ? "" : "none";
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
