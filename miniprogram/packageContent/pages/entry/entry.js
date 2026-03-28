const { request, showErrorToast } = require("../../../utils/api");

var PLACEHOLDER_IMAGE =
  "https://dummyimage.com/600x600/111827/e11d48.png&text=Cosii";

Page({
  data: {
    caption: "",
    submitting: false,
  },

  onCaptionInput(e) {
    this.setData({ caption: e.detail.value });
  },

  goBack() {
    wx.navigateBack({ fail: function () {
      wx.switchTab({ url: "/pages/publish/publish" });
    }});
  },

  async onSubmit() {
    if (this.data.submitting) {
      return;
    }
    this.setData({ submitting: true });
    var cap = (this.data.caption || "").trim();
    var res = await request({
      path: "/v1/posts",
      method: "POST",
      data: {
        image_url: PLACEHOLDER_IMAGE,
        caption: cap.length ? cap : null,
      },
    });
    this.setData({ submitting: false });
    if (!res.ok) {
      showErrorToast(res.envelope);
      return;
    }
    var postId = res.data && res.data.post_id;
    wx.showToast({ title: "已发布", icon: "success" });
    if (postId) {
      setTimeout(function () {
        wx.showModal({
          title: "发布成功",
          content: "帖子 ID：" + postId + "。可后续在后台或详情页挂转化卡。",
          showCancel: false,
        });
      }, 300);
    }
  },
});
