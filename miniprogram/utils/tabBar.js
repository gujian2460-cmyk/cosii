/**
 * 自定义 TabBar 选中态（需在对应 tab 页 onShow 调用）
 * @param {number} index 0 首页 1 买&搜 2 发布 3 消息 4 我的
 */
function setTabBarSelected(index) {
  try {
    if (typeof getCurrentPages !== "function") {
      return;
    }
    var pages = getCurrentPages();
    var cur = pages[pages.length - 1];
    if (!cur || typeof cur.getTabBar !== "function") {
      return;
    }
    var tab = cur.getTabBar();
    if (tab && typeof tab.setData === "function") {
      tab.setData({ selected: index });
    }
  } catch (_) {
    /* ignore */
  }
}

module.exports = { setTabBarSelected };
