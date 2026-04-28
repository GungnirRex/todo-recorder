# 小段的待办事项记录\("▔□▔)/

这是一个纯静态网页应用，直接打开 `index.html` 即可使用。要让对方在自己的网络下打开，需要部署到公网静态托管服务，例如 GitHub Pages、Vercel、Netlify 或 Cloudflare Pages。

线上地址：https://gungnirrex.github.io/todo-recorder/

## 功能

- 在文本框粘贴代办原文，自动生成：代办总结、记录时间、计划完成时间、信息提炼。
- 原文会完整保存到“代办原文”字段。
- 数据保存在浏览器 `localStorage`，刷新页面后仍在。
- 支持编辑、完成状态、删除、搜索、筛选。
- 支持 JSON/CSV 导出，支持 JSON 导入。
- 支持复制网页链接和当前代办分享链接。

## 本地使用

直接打开：

```bash
open /Users/rex/todo-recorder/index.html
```

## 公网分享

推荐方式：把 `/Users/rex/todo-recorder` 这个文件夹上传到任意静态网站托管服务。

### GitHub Pages

1. 新建一个 GitHub 仓库。
2. 上传 `index.html`、`styles.css`、`app.js`、`README.md`。
3. 在仓库 `Settings` -> `Pages` 中选择从默认分支部署。
4. GitHub 会生成一个类似 `https://用户名.github.io/仓库名/` 的公网地址。

### Vercel / Netlify / Cloudflare Pages

1. 新建静态网站项目。
2. 上传或连接包含这些文件的仓库。
3. 构建命令留空。
4. 发布目录填写项目根目录，通常是 `/`。
5. 发布后平台会生成一个 `https://...` 公网地址。

## 数据说明

当前版本的数据保存在每个用户自己的浏览器里。也就是说，对方打开公网地址后可以正常使用和记忆自己的记录，但不会自动看到你浏览器里的记录。

如果要多人共享同一份代办数据，需要增加后端数据库，例如 Supabase、Firebase、Airtable 或自建 API。

## 临时本地预览

仅用于自己电脑预览，不适合发给外网用户：

```bash
cd /Users/rex/todo-recorder
python3 -m http.server 8080 --bind 0.0.0.0
```
