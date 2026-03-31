/**
 * 首页：担保交易 / 认证妆娘 / 内容转化挂载（对齐 CLAUDE.md 模块与 DESIGN 业务语义）
 */
const { request, showErrorToast } = require("../../utils/api");
const routes = require("../../config/routes");

const HEALTH_TTL_MS = 30000;

function setBuySearchPreset(p: { category?: string; keyword?: string }) {
  try {
    (getApp().globalData as { buySearchPreset?: unknown }).buySearchPreset = p;
  } catch {
    /* ignore */
  }
}

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

interface CharacterChip {
  id: string;
  name: string;
  workTitle: string;
  coverColor: string;
}

interface FeaturedPhoto {
  id: string;
  title: string;
  characterName: string;
  author: string;
  likeCount: number;
  coverColor: string;
  authorInitial: string;
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

const MOCK_CHARACTERS: CharacterChip[] = [
  { id: "c1", name: "林尼", workTitle: "原神", coverColor: "#e8c4d4" },
  { id: "c2", name: "W", workTitle: "明日方舟", coverColor: "#c9c5e8" },
  { id: "c3", name: "初音", workTitle: "VOCALOID", coverColor: "#b8d4e8" },
  { id: "c4", name: "芙莉莲", workTitle: "葬送", coverColor: "#c8e6c9" },
];

function toFeaturedView(p: {
  id: string;
  title: string;
  characterName: string;
  author: string;
  likeCount: number;
  coverColor: string;
}): FeaturedPhoto {
  const author = p.author || "?";
  return {
    ...p,
    authorInitial: author.charAt(0),
  };
}

const MOCK_FEATURED: FeaturedPhoto[] = [
  {
    id: "p1",
    title: "展台灯光",
    characterName: "林尼",
    author: "小野",
    likeCount: 128,
    coverColor: "#d4a5b8",
  },
  {
    id: "p2",
    title: "场照速报",
    characterName: "W",
    author: "阿紫",
    likeCount: 96,
    coverColor: "#a8a4d4",
  },
  {
    id: "p3",
    title: "假发修剪",
    characterName: "初音",
    author: "次元工房",
    likeCount: 210,
    coverColor: "#9ec5e8",
  },
  {
    id: "p4",
    title: "妆面记录",
    characterName: "芙莉莲",
    author: "白茶",
    likeCount: 54,
    coverColor: "#aed581",
  },
].map(toFeaturedView);

function splitFeaturedColumns(items: FeaturedPhoto[]): {
  left: FeaturedPhoto[];
  right: FeaturedPhoto[];
} {
  const left: FeaturedPhoto[] = [];
  const right: FeaturedPhoto[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i % 2 === 0) {
      left.push(items[i]);
    } else {
      right.push(items[i]);
    }
  }
  return { left, right };
}

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
    characters: [] as CharacterChip[],
    featLeft: [] as FeaturedPhoto[],
    featRight: [] as FeaturedPhoto[],
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
    const fc = splitFeaturedColumns(MOCK_FEATURED);

    this.setData({
      statusBarHeight,
      headerRowHeightPx,
      headerRightSpacePx,
      navBarHeightPx,
      scrollHeightPx,
      bannerSlides: MOCK_BANNER_SLIDES,
      characters: MOCK_CHARACTERS,
      featLeft: fc.left,
      featRight: fc.right,
      feedLeft: left,
      feedRight: right,
    });

    this.refreshHealth();
  },

  onBannerChange(e: WechatMiniprogram.SwiperChange) {
    this.setData({ bannerCurrent: e.detail.current });
  },

  onSearchTap() {
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onRecentExpoTap() {
    wx.navigateTo({ url: "/pages/recent-expo/recent-expo" });
  },

  onKingTap(e: WechatMiniprogram.TouchEvent) {
    const action = (e.currentTarget.dataset as { action?: string }).action || "";
    if (action === "yi") {
      setBuySearchPreset({ category: "costume" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "fa") {
      setBuySearchPreset({ category: "wig" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhuang") {
      setBuySearchPreset({ category: "all", keyword: "妆造" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhou") {
      setBuySearchPreset({ category: "props" });
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
      return;
    }
    if (action === "zhan") {
      wx.navigateTo({ url: "/pages/expo/expo" });
      return;
    }
  },

  onCharacterTap(e: WechatMiniprogram.TouchEvent) {
    const name =
      (e.currentTarget.dataset as { name?: string }).name || "";
    setBuySearchPreset({ keyword: name });
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onFeaturedTap(e: WechatMiniprogram.TouchEvent) {
    const kw =
      (e.currentTarget.dataset as { keyword?: string }).keyword || "";
    setBuySearchPreset({ keyword: kw });
    wx.switchTab({ url: "/pages/buy-search/buy-search" });
  },

  onConversionTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as {
      ctype?: ConversionMountType;
      tradeItemId?: string;
      artistId?: string;
    };
    const ctype = ds.ctype;
    if (ctype === "product") {
      wx.switchTab({ url: "/pages/buy-search/buy-search" });
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
