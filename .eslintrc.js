module.exports = {
  extends: ["airbnb-base", "prettier"],
  env: {
    webextensions: true,
    browser: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module"
  },
  rules: {
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }], // 循环里允许使用++
    "no-unused-vars": ["error", { args: "none" }], // 作为函数参数时允许只定义不使用
    "no-unused-expressions": ["error", { allowShortCircuit: true }], // 允许短路执行
    "object-curly-newline": ["error", { consistent: true }],
    "prefer-destructuring": [
      "error",
      {
        array: false,
        object: true
      }
    ],
    "consistent-return": "off"
  }
};
