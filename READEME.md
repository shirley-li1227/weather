# Weather App

一个基于 `React + TypeScript + Vite` 的移动端风格天气应用，支持城市查询、定位天气、未来 5 天趋势和收藏城市快捷查询。

## 功能概览

- 城市天气查询：输入城市名，获取实时天气信息
- 自动定位：首次进入自动请求浏览器定位并展示当前位置天气
- 多城市卡片：支持城市卡片左右滑动切换
- 城市详情页：展示体感温度、湿度、气压、风速、能见度、日出日落等
- 5 天趋势预报：按天汇总未来天气变化
- 城市收藏：
  - 查询过的城市可一键收藏
  - 收藏列表持久化到 `LocalStorage`
  - 点击收藏城市可快速查询
  - 支持删除收藏城市

## 技术栈

- 框架：`React 19`
- 语言：`TypeScript 5`
- 构建工具：`Vite 7`
- 样式：原生 `CSS`（非 Tailwind）
- 天气数据：`OpenWeatherMap API`
- 本地持久化：`LocalStorage`

## 项目结构（核心）

- `src/App.tsx`：页面 UI、交互逻辑、状态管理（查询/定位/收藏/详情/轮播）
- `src/api/weatherApi.ts`：天气 API 请求封装与错误处理
- `src/index.css`：全局与页面样式
- `src/vite-env.d.ts`：Vite 环境变量类型声明

## 环境变量

在项目根目录创建 `.env`（或 `.env.local`）：

```bash
VITE_OPENWEATHER_API_KEY=你的OpenWeatherMapKey
# 可选，不填则使用默认地址
VITE_OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5
```

> `VITE_OPENWEATHER_API_KEY` 为必填，否则应用会提示缺少 API Key。

## 本地开发

```bash
npm install
npm run dev
```

## 构建与预览

```bash
npm run build
npm run preview
```

## 交互说明

- 点击右上角 `+` 可添加查询城市
- 点击城市卡片进入天气详情
- 卡片底部可执行“收藏城市”或“删除城市”
- 顶部“收藏城市”区域可快速触发查询，右侧 `×` 可移除收藏

## 后续可扩展方向

- 收藏城市排序/拖拽
- 查询历史记录
- 小时级预报
- 天气图标与背景动效联动

