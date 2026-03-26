/** 与 app.js 中 globalData 对齐（可选，供编辑器类型提示） */
interface IAppOption {
  globalData: {
    apiBase: string;
    /** 开发期对接后端 X-User-Id，生产替换为登录态 */
    devUserId: string;
  };
}
