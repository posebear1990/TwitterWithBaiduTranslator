import md5 from 'blueimp-md5';
import config from './constants/config';
import { randomString, stringifyQueryParameter, retry } from './utils/index';

function generateSignature({ appid, q, salt }, appkey) {
  return md5(`${appid}${q}${salt}${appkey}`);
}

const translator = config.appid ? 'baidu' : 'google';

async function translate(text, locale) {
  let url = '';
  if (translator === 'google') {
    url =
      config.googleTranslatorAPI +
      stringifyQueryParameter({
        q: text,
        tl: 'zh_CN',
        sl: 'auto',
        client: 'dict-chrome-ex',
      });
  } else {
    const salt = randomString(5);
    const params = {
      q: text,
      from: locale,
      to: 'zh',
      appid: config.appid,
      salt,
    };
    params.sign = generateSignature(params, config.appkey);
    url = config.baiduTranslatorAPI + stringifyQueryParameter(params);
  }

  const response = await fetch(url, {
    method: 'GET',
  });

  const resp = await response.json();

  if (resp.error_code) {
    return Promise.reject(new Error('translate result error!'));
  }

  if ((translator = 'google')) {
    return resp[0]
      .map((item) => item[0])
      .filter((item) => typeof item === 'string')
      .join('');
  } else {
    return resp.trans_result.map((item) => item.dst).join('\n');
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'translate') {
    const { text, locale = 'auto' } = request?.payload || {};

    if (!text) {
      return;
    }

    retry(
      async () => {
        const res = await translate(text, locale);
        if (!res.error_code) {
          return Promise.resolve(res);
        }

        return Promise.reject(new Error('Exceed the maximum number of concurrent!'));
      },
      1,
      5
    )
      .then((resp) => {
        sendResponse({
          type: 'translate-result',
          payload: {
            translateResult: resp,
          },
        });
      })
      .catch((error) => {
        sendResponse({
          type: 'translate-error',
          payload: error,
        });
      });
  }

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      type: 'url-change',
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enable: true });

  chrome.tabs.query({ url: '*://*.twitter.com/*', currentWindow: true }, (tabs) => {
    tabs.forEach((item) => {
      chrome.tabs.reload(item.id);
    });
  });
});

chrome.browserAction.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (/.*twitter.com\/.*/.test(activeTab.url)) {
      chrome.storage.local.get('enable', (resp) => {
        chrome.storage.local.set({ enable: !resp.enable });
        chrome.browserAction.setIcon({ path: resp.enable ? 'images/main_logo_disabled.png' : 'images/main_logo_128.png' });
        chrome.tabs.reload(activeTab.id);
      });
    }
  });
});

let isActived = false;
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (/.*twitter.com\/.*/.test(activeTab.url)) {
      isActived = true;
      chrome.storage.local.get('enable', (resp) => {
        chrome.browserAction.setIcon({ path: resp.enable ? 'images/main_logo_128.png' : 'images/main_logo_disabled.png' });
      });
    } else if (isActived) {
      isActived = false;
      chrome.browserAction.setIcon({ path: 'images/main_logo_disabled.png' });
    }
  });
});
