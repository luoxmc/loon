/*
脚本引用https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/jingdong.js
*/
// 2024-01-23 09:50

const url = $request.url;
const body = $response.body;

const handlerRules = [
    {
        patterns: ["functionId=deliverLayer", "functionId=orderTrackBusiness"],
        handler: cleanDeliveryPage
    },
    {
        patterns: ["functionId=getTabHomeInfo"],
        handler: cleanNewProductPage
    },
    {
        patterns: ["functionId=myOrderInfo"],
        handler: cleanOrderPage
    },
    {
        patterns: ["functionId=personinfoBusiness"],
        handler: cleanProfilePage
    },
    {
        patterns: ["functionId=start"],
        handler: cleanSplashAd
    },
    {
        patterns: ["functionId=welcomeHome"],
        handler: cleanHomeConfig
    }
];

const deliveryBlockedFloorIds = ["banner", "jdDeliveryBanner"];
const orderBlockedFloorIds = ["bannerFloor", "bpDynamicFloor", "plusFloor"];
const profileBlockedFloorIds = [
    "bigSaleFloor", // 双十一
    "buyOften", // 常买常逛
    // "iconToolFloor", // 底部工具栏
    // "keyToolsFloor", // 浏览记录
    "newAttentionCard", // 关注的频道
    "newBigSaleFloor", // 双十一
    "newStyleAttentionCard", // 新版关注的频道
    // "newWalletIdFloor", // 我的钱包
    "newsFloor", // 京东快讯
    "noticeFloor", // 顶部横幅
    // "orderIdFloor", // 我的订单
    "recommendfloor" // 我的推荐
];
const profileFloorCleaners = {
    basefloorinfo: cleanProfileBaseFloor,
    iconToolFloor: cleanIconToolFloor,
    orderIdFloor: cleanOrderIdFloor,
    userinfo: cleanUserInfoFloor
};
const iconToolSortedFunctionIds = [
    "applezhushou", // apple助手 1-1-1
    "lingjindouxin", // 签到领豆 1-1-2
    "dongdongnongchangxin", // 京东农场 1-1-3
    "chongwangwang", // 宠汪汪 1-1-4
    "kehufuwu", // 客户服务 1-2-1
    "xianzhiguanjia", // 闲置换钱 1-2-2
    "wenyisheng", // 问医生 1-2-3
    "jijianfuwu", // 寄件服务 1-2-5
    "zhuanzuanhongbao", // 天天赚红包 2-2-1
    "huanletaojin" // 欢乐淘金 2-2-2
];
const homeBlockedTypes = [
    "bottomXview", // 底部悬浮通栏推广
    "float", // 悬浮推广小圆图
    "photoCeiling", // 顶部通栏动图推广
    // "recommend", // 为你推荐
    "ruleFloat", // 资质与规则
    "searchIcon", // 右上角消费券
    "topRotate", // 左上角logo
    "tabBarAtmosphere" // 底部悬浮通栏推广
];

if (body) {
    const obj = JSON.parse(body);
    const handler = findHandler(url);

    if (handler) {
        handler(obj);
    }

    $done({ body: JSON.stringify(obj) });
} else {
    $done({});
}

function findHandler(requestUrl) {
    return handlerRules.find((rule) => rule.patterns.some((pattern) => requestUrl.includes(pattern)))?.handler;
}

function cleanDeliveryPage(obj) {
    // 物流页面：收货时寄快递享八折、运费八折。
    deleteProperty(obj, "bannerInfo");

    if (obj?.floors?.length > 0) {
        obj.floors = obj.floors.filter((floor) => !deliveryBlockedFloorIds.includes(floor?.mId));
    }
}

function cleanNewProductPage(obj) {
    // 新品页：悬浮动图、下拉二楼。
    deleteProperty(obj?.result, "iconInfo");
    deleteProperty(obj?.result, "roofTop");
}

function cleanOrderPage(obj) {
    if (!(obj?.floors?.length > 0)) {
        return;
    }

    obj.floors = obj.floors.filter((floor) => {
        // 订单页面：满意度评分、专属权益、开通会员。
        if (orderBlockedFloorIds.includes(floor?.mId)) {
            return false;
        }

        cleanOrderFloor(floor);
        return true;
    });
}

function cleanOrderFloor(floor) {
    if (floor?.mId === "virtualServiceCenter") {
        cleanVirtualServiceCenter(floor);
        return;
    }

    if (floor?.mId === "customerServiceFloor") {
        cleanCustomerServiceFloor(floor);
    }
}

function cleanVirtualServiceCenter(floor) {
    const centers = floor?.data?.virtualServiceCenters;

    if (centers?.length > 0) {
        centers.forEach((item) => {
            if (item?.serviceList?.length > 0) {
                item.serviceList = item.serviceList.filter((card) => card?.serviceTitle !== "精选特惠");
            }
        });
    }
}

function cleanCustomerServiceFloor(floor) {
    if (!floor?.data?.moreText) {
        return;
    }

    // 客户服务：点此获得更多服务。
    delete floor.data.moreIcon;
    delete floor.data.moreIcon_dark;
    floor.data.moreText = " ";
}

function cleanProfilePage(obj) {
    if (!(obj?.floors?.length > 0)) {
        return;
    }

    obj.floors = obj.floors.filter((floor) => {
        if (profileBlockedFloorIds.includes(floor?.mId)) {
            return false;
        }

        cleanProfileFloor(floor);
        return true;
    });
}

function cleanProfileFloor(floor) {
    const cleaner = profileFloorCleaners[floor?.mId];

    if (cleaner) {
        cleaner(floor);
    }
}

function cleanProfileBaseFloor(floor) {
    const data = floor?.data;

    // 个人页：弹窗、会员续费横幅、右下角动图。
    deleteProperty(data, "commonPopup");
    deleteProperty(data, "commonPopup_dynamic");
    deleteProperty(data, "floatLayer");

    if (data?.commonTips?.length > 0) {
        data.commonTips = [];
    }

    if (data?.commonWindows?.length > 0) {
        data.commonWindows = [];
    }
}

function cleanIconToolFloor(floor) {
    const nodes = floor?.data?.nodes;

    if (!(nodes?.length > 0)) {
        return;
    }

    [0, 1].forEach((index) => {
        if (nodes[index]?.length > 0) {
            nodes[index] = sortIconToolNodes(nodes[index]);
        }
    });
}

function sortIconToolNodes(nodes) {
    return nodes
        .filter((node) => iconToolSortedFunctionIds.includes(node?.functionId))
        .sort((a, b) => iconToolSortedFunctionIds.indexOf(a?.functionId) - iconToolSortedFunctionIds.indexOf(b?.functionId));
}

function cleanOrderIdFloor(floor) {
    if (floor?.data?.commentRemindInfo?.infos?.length > 0) {
        // 发布评价的提醒。
        floor.data.commentRemindInfo.infos = [];
    }
}

function cleanUserInfoFloor(floor) {
    // 个人页顶部背景图保留；开通 plus 会员卡片移除。
    deleteProperty(floor?.data, "newPlusBlackCard");
}

function cleanSplashAd(obj) {
    if (obj?.images?.length > 0) {
        obj.images = [];
    }

    if (obj?.showTimesDaily) {
        obj.showTimesDaily = 0;
    }
}

function cleanHomeConfig(obj) {
    if (obj?.floorList?.length > 0) {
        obj.floorList = obj.floorList.filter((floor) => !homeBlockedTypes.includes(floor?.type));
    }

    // 首页顶部背景图保留；下拉二楼移除。
    if (obj?.webViewFloorList?.length > 0) {
        obj.webViewFloorList = [];
    }
}

function deleteProperty(target, key) {
    if (target && typeof target === "object") {
        delete target[key];
    }
}
