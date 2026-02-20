# TwitterWithBaiduTranslator

推特翻译熊 - Twitter with Baidu Translator 是一款显著提高日推（Twitter）刷推体验的 Chrome 插件。  
现在支持三类翻译引擎：

- Google Translate（默认）
- Baidu Translate（可配置 APP ID / 密钥）
- LLM API（支持 OpenAI、Anthropic、Gemini、OpenRouter、DeepSeek、Groq、SiliconFlow）

并支持在插件弹窗中选择目标翻译语言（默认简体中文）。

## 安装

[通过 ChromeWebStore 进行安装](https://chrome.google.com/webstore/detail/%E6%8E%A8%E7%89%B9%E7%BF%BB%E8%AF%91%E7%86%8A-twitter-with-baidu/jfoppggphfkahfohdamcijagmpgffenp?hl=zh-CN&authuser=0)

## 开发

```bash
git clone https://github.com/posebear1990/TwitterWithBaiduTranslator.git
cd TwitterWithBaiduTranslator
npm install
npm run build
```

浏览器输入 chrome://extensions/ -> 开启开发者模式 -> 加载已解压的拓展程序 -> 选择 dist 文件夹
