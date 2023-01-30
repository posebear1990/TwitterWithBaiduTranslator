/* eslint-disable no-useless-escape */
/* eslint-disable import/no-extraneous-dependencies  */
const fs = require("fs");
const path = require("path");
const rollup = require("rollup");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");

function combineConf(conf, outputConf) {
  return {
    ...conf,
    output: outputConf,
    watch: {
      incude: "src/",
    },
  };
}

function eventHandler(event) {
  const stderr = console.error.bind(console);

  switch (event.code) {
    case "BUNDLE_START":
      stderr(`${event.input}: 正在构建单个文件束...`);
      break;
    case "BUNDLE_END":
      stderr(`${event.input}: 用 ${event.duration}ms 完成构建. 监听变化中...`);
      break;
    case "ERROR":
      stderr(`${event.input}: 发生错误: ${event.error}`);
      break;
    case "FATAL":
      stderr(`${event.input}: 发生未知错误: ${event.error}`);
      break;
    default:
      break;
  }
}

function pack(conf, outputConf) {
  rollup
    .rollup(conf)
    .then((bundle) => {
      bundle.write(outputConf);

      console.log(`${outputConf.file}: 文件打包完成。`);
    })
    .catch((err) => {
      console.error("文件打包过程出现错误：\n", err);
    });

  // watch 调用时需要在命令行加  --watch 参数
  if (process.argv.includes("--watch") || process.argv.includes("-w")) {
    const watcher = rollup.watch(combineConf(conf, outputConf));
    watcher.on("event", eventHandler);
  }
}

function readFiles(dirPath, callback) {
  fs.readdir(dirPath, (err, files) => {
    if (err) throw err;

    files.forEach((file) => {
      fs.stat(path.join(dirPath, file), (error, stat) => {
        if (error) throw error;

        if (stat.isFile()) {
          callback(file, path.join(dirPath, file));
        }
      });
    });
  });
}

readFiles("./src", (fileName, filePath) => {
  const isJSFile = /([a-zA-Z0-9\s_\\.\-\(\):])+(.js)$/.test(fileName);

  if (isJSFile) {
    pack(
      {
        input: filePath,
        plugins: [nodeResolve(), commonjs()],
      },
      {
        file: `dist/${fileName}`,
        format: "cjs",
      }
    );
  } else {
    fs.copyFile(filePath, `dist/${fileName}`, (err) => {
      if (err) throw err;
      console.log(`success copy ${filePath} to dist/${fileName}`);
    });
  }
});
