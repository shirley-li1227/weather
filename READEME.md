这个项目要实现天气查询功能。
用户输入城市名称，查询当前天气，显示温度、天气状况、湿度、风速等信息。
还要显示未来几天的天气预报。
可以自动获取用户位置并显示天气。
常用的城市可以收藏起来，方便下次查询。

技术选型上，前端用 React + TypeScript + Vite,样式用 Tailwind CSS,天气数据通过 OpenWeatherMap API 获取(免费)，收藏的城市用LocalStorage 保存。

