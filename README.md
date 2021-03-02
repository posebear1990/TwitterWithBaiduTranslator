# TwitterWithBaiduTranslator

推特翻译熊 - Twitter with Baidu Translator 是一款显著提高日推（Twitter）刷推体验的 Chrome 插件。 针对日语推文，采用百度翻译代替默认的 Google 翻译，大幅提高日语翻译质量。

## 安装

[通过 ChromeWebStore 进行安装](https://chrome.google.com/webstore/detail/%E6%8E%A8%E7%89%B9%E7%BF%BB%E8%AF%91%E7%86%8A-twitter-with-baidu/jfoppggphfkahfohdamcijagmpgffenp?hl=zh-CN&authuser=0)

## 开发

```bash
git clone https://github.com/posebear1990/TwitterWithBaiduTranslator.git
cd TwitterWithBaiduTranslator
npm install
# 替换 .env 文件里的 appId 和 appKey ，参考 https://fanyi-api.baidu.com/
npm run build
```

浏览器输入 chrome://extensions/ -> 开启开发者模式 -> 加载已解压的拓展程序 -> 选择 dist 文件夹
