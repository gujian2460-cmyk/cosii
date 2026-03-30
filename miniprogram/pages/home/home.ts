/**
 * 首页：担保交易 / 认证妆娘 / 内容转化挂载（对齐 CLAUDE.md 模块与 DESIGN 业务语义）
 */
const { request, showErrorToast } = require("../../utils/api");
const routes = require("../../config/routes");

const HEALTH_TTL_MS = 30000;

/** 转化挂载类型：商品同款 vs 约妆档期 */
type ConversionMountType = "product" | "booking";

interface FeedAuthor {
  nickname: string;
  avatarUrl: string;
  verified: boolean;
}

/** 商品转化：可深链到 trade item */
interface ProductConversion {
  type: "product";
  label: string;
  tradeItemId?: string;
}

/** 约妆转化：可深链到妆娘/档期 */
interface BookingConversion {
  type: "booking";
  label: string;
  artistId?: string;
}

type FeedConversion = ProductConversion | BookingConversion;

interface FeedCard {
  id: string;
  title: string;
  coverUrl: string;
  coverColor: string;
  author: FeedAuthor;
  conversion: FeedConversion;
}

/** 供 WXML 绑定（扁平化 data-*） */
interface FeedCardView extends FeedCard {
  authorInitial: string;
  convTradeItemId: string;
  convArtistId: string;
}

interface BannerSlide {
  id: string;
  kicker: string;
  title: string;
  bg: string;
}

function toViewCard(c: FeedCard): FeedCardView {
  const nick = c.author.nickname || "?";
  const convTrade =
    c.conversion.type === "product" ? (c.conversion.tradeItemId || "") : "";
  const convArtist =
    c.conversion.type === "booking" ? (c.conversion.artistId || "") : "";
  return {
    ...c,
    authorInitial: nick.charAt(0),
    convTradeItemId: convTrade,
    convArtistId: convArtist,
  };
}

/** 简单双列瀑布：按序交替（后续可改为按估算高度贪心） */
function splitFeedColumns(items: FeedCardView[]): {
  left: FeedCardView[];
  right: FeedCardView[];
} {
  const left: FeedCardView[] = [];
  const right: FeedCardView[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i % 2 === 0) {
      left.push(items[i]);
    } else {
      right.push(items[i]);
    }
  }
  return { left, right };
}

/** Mock：一条商品流 + 一条约妆流 */
const MOCK_BANNER_SLIDES: BannerSlide[] = [
  {
    id: "b1",
    kicker: "担保购",
    title: "资金托管 · 确认收货再结算",
    bg: "linear-gradient(135deg,#fce4ec 0%,#f8f9fb 100%)",
  },
  {
    id: "b2",
    kicker: "认证妆娘",
    title: "档期占位 · 定金平台托管",
    bg: "linear-gradient(135deg,#f3e5f5 0%,#ffffff 100%)",
  },
];

const MOCK_FEED: FeedCard[] = [
  {
    id: "f1",
    title: "展台返图｜原神林尼 · 全套造型分享",
    coverUrl: "",
    coverColor: "#e8c4d4",
    author: { nickname: "小野", avatarUrl: "", verified: true },
    conversion: {
      type: "product",
      label: "同款C服：¥200",
      tradeItemId: "mock_trade_001",
    },
  },
  {
    id: "f2",
    title: "妆面记录｜明日方舟 W · 漫展现场",
    coverUrl: "",
    coverColor: "#c9c5e8",
    author: { nickname: "妆娘阿紫", avatarUrl: "", verified: true },
    conversion: {
      type: "booking",
      label: "妆娘接单：查档期",
      artistId: "mock_artist_001",
    },
  },
  {
    id: "f3",
    title: "二手道具出清｜法杖几乎全新",
    coverUrl: "",
    coverColor: "#d4e4f0",
    author: { nickname: "出物机", avatarUrl: "", verified: false },
    conversion: {
      type: "product",
      label: "同款道具：¥89",
      tradeItemId: "mock_trade_002",
    },
  },
];

Page({
  data: {
    statusBarHeight: 20,
    headerRowHeightPx: 44,
    headerRightSpacePx: 12,
    navBarHeightPx: 64,
    scrollHeightPx: 500,
    cityName: "台北市",
    bannerSlides: [] as BannerSlide[],
    bannerCurrent: 0,
    feedLeft: [] as FeedCardView[],
    feedRight: [] as FeedCardView[],
    showDevProbe: false,
    healthLabel: "",
    healthTrace: "",
  },

  _lastHealthOkAt: 0 as number,

  onLoad() {
    try {
      const gd = getApp().globalData || {};
      this.setData({ showDevProbe: gd.showDevProbe !== false });
    } catch (_) {
      /* ignore */
    }

    const sys = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    const statusBarHeight = sys.statusBarHeight || 20;
    const navBarHeightPx =
      statusBarHeight + menu.height + (menu.top - statusBarHeight) * 2;
    const headerRowHeightPx = navBarHeightPx - statusBarHeight;
    const headerRightSpacePx = Math.max(
      8,
      sys.windowWidth - menu.left + 8,
    );
    const scrollHeightPx = sys.windowHeight - navBarHeightPx;

    const views = MOCK_FEED.map(toViewCard);
    const { left, right } = splitFeedColumns(views);

    this.setData({
      statusBarHeight,
      headerRowHeightPx,
      headerRightSpacePx,
      navBarHeightPx,
      scrollHeightPx,
      bannerSlides: MOCK_BANNER_SLIDES,
      feedLeft: left,
      feedRight: right,
    });

    this.refreshHealth();
  },

  onBannerChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ bannerCurrent: e.detail.current });
  },

  onSearchTap() {
    wx.switchTab({ url: "/pages/search/search" });
  },

  onLocationTap() {
    wx.showToast({ title: "定位能力即将接入", icon: "none" });
  },

  onKingTap(e: WechatMiniprogram.TouchEvent) {
    const action = (e.currentTarget.dataset as { action?: string }).action || "";
    if (action === "escrow") {
      wx.switchTab({ url: "/pages/buy/buy" });
      return;
    }
    if (action === "artist") {
      wx.navigateTo({ url: routes.BOOKING_ENTRY });
      return;
    }
    if (action === "expo") {
      wx.showToast({ title: "漫展档期即将接入", icon: "none" });
      return;
    }
    if (action === "local") {
      wx.showToast({ title: "同城面交请从订单详情核销入口", icon: "none" });
      return;
    }
  },

  onConversionTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as {
      ctype?: ConversionMountType;
      tradeItemId?: string;
      artistId?: string;
    };
    const ctype = ds.ctype;
    if (ctype === "product") {
      wx.switchTab({ url: "/pages/buy/buy" });
      if (ds.tradeItemId) {
        wx.showToast({
          title: "已跳转购买（mock item）",
          icon: "none",
        });
      }
      return;
    }
    if (ctype === "booking") {
      wx.navigateTo({ url: routes.BOOKING_ENTRY });
      return;
    }
  },

  async refreshHealth() {
    const now = Date.now();
    if (
      this._lastHealthOkAt &&
      now - this._lastHealthOkAt < HEALTH_TTL_MS &&
      this.data.healthLabel
    ) {
      return;
    }
    const res = await request({
      path: "/health",
      method: "GET",
      userId: null,
    });
    if (res.ok) {
      this._lastHealthOkAt = Date.now();
      this.setData({
        healthLabel: res.data.ok ? "API 探活：正常" : "API 探活：异常",
        healthTrace: res.traceId || "",
      });
    } else {
      showErrorToast(res.envelope);
      this.setData({
        healthLabel: "API 未连接（请启动后端并关闭域名校验）",
        healthTrace: (res.envelope && res.envelope.trace_id) || "",
      });
    }
  },
});
