export function retry(fn, interval = 5, maxLimit = 5, intervalStep = 0) {
  const result = fn();

  // eslint-disable-next-line no-param-reassign
  maxLimit -= 1;
  const attempt = () =>
    retry(fn, intervalStep ? interval + intervalStep : interval, maxLimit, intervalStep);

  if (result instanceof Promise) {
    return new Promise((resolve, reject) => {
      result.then(resolve).catch((err) => {
        if (maxLimit) {
          setTimeout(() => {
            attempt().then(resolve).catch(reject);
          }, interval * 1000);
        } else {
          const error = new Error("Time out!");
          error.name = "timeout";
          error.detail = err;

          reject(error);
        }
      });
    });
  }
  if (maxLimit && (typeof result === "boolean" ? !result : true)) {
    setTimeout(attempt, interval * 1000);
  }
}

export function createElement(innerHtml) {
  const $Wrapper = document.createElement("div");
  $Wrapper.innerHTML = innerHtml;
  return $Wrapper.firstElementChild;
}

export function randomString(len) {
  return Math.random().toString(36).substr(2).substr(0, len);
}

export function stringifyQueryParameter(data) {
  const ret = Object.keys(data).map(
    (key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`
  );
  return ret.join("&");
}

export function templateReplace(template = "", ...args) {
  let templateString = template.trim();
  templateString = templateString.replace(/\n/g, "");

  if (Array.isArray(args)) {
    args.forEach((param, i) => {
      templateString = templateString.replace(`{${i}}`, param.trim());
    });
    return templateString;
  }
}

export function debounce(fn, wait = 1) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.call(this, ...args), wait);
  };
}
