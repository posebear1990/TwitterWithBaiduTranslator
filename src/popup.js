import { debounce } from "./utils";

const DEFAULT_LLM_PROVIDER = "openai";
const DEFAULT_TARGET_LANGUAGE = "zh-CN";
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
  const translator = getValue("translator") || "google";
  const targetLanguage = getValue("targetLanguage") || DEFAULT_TARGET_LANGUAGE;
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
  const storage = (await chrome.storage.local.get()) ?? {};
  const translator = getTranslatorFromStorage(storage);
  const llmProvider = storage.llmProvider || DEFAULT_LLM_PROVIDER;
  const targetLanguage = storage.targetLanguage || DEFAULT_TARGET_LANGUAGE;

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
