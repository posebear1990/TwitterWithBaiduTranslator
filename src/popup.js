import { debounce } from "./utils";

const init = async () => {
  const { appId, appKey } = (await chrome.storage.local.get()) ?? {};

  document.querySelector(".tt-popup-form-input[name=appId]").value = appId ?? "";
  document.querySelector(".tt-popup-form-input[name=appKey]").value = appKey ?? "";
};

const saveApiConfig = async () => {
  const appId = document.querySelector(".tt-popup-form-input[name=appId]")?.value;
  const appKey = document.querySelector(".tt-popup-form-input[name=appKey]")?.value;

  await Promise.all([chrome.storage.local.set({ appId }), chrome.storage.local.set({ appKey })]);

  const needUpdate = (appId && appKey) || (!appId && !appKey);
  needUpdate && chrome.runtime?.id && chrome.runtime.sendMessage({ type: "config-update" });
};

let hideCheckIconContext = {};
const onInput = debounce(($inputContainer) => {
  const $loading = $inputContainer.querySelector(".loader");
  const $checkIcon = $inputContainer.querySelector(".check-icon");

  $loading.style.display = "";
  $checkIcon.style.display = "block";

  if (hideCheckIconContext.eventId && hideCheckIconContext.$container === $inputContainer) {
    clearTimeout(hideCheckIconContext.eventId);
  }
  hideCheckIconContext = {
    eventId: setTimeout(() => {
      $checkIcon.style.display = "";
    }, 3000),
    $container: $inputContainer,
  };

  saveApiConfig();
}, 400);

document.querySelectorAll(".tt-popup-form-input").forEach(($input) => {
  $input.addEventListener("input", (e) => {
    const $inputContainer = e.target.parentElement;
    const $loading = $inputContainer.querySelector(".loader");
    const $checkIcon = $inputContainer.querySelector(".check-icon");

    if (!$loading.style.display) {
      $loading.style.display = "grid";
      $checkIcon.style.display = "";
    }

    onInput($inputContainer);
  });
});

init();
