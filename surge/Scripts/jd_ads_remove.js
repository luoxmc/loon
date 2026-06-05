/*
脚本引用https://raw.githubusercontent.com/RuCu6/QuanX/main/Scripts/jingdong.js
*/
// 2024-01-23 09:50

const url = $request.url;
const requestBody = $request.body;
const body = $response.body;

const handlerRules = [
    {
        patterns: ["functionId=basicConfig"],
        handler: cleanBasicConfig
    },
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
        patterns: ["functionId=strategy"],
        handler: cleanStrategyConfig
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
    // 判断url中是不是有functionId参数，没有的话就取requestBody作为参数传进下面两个方法
    const functionId = getFunctionId(url, requestBody);
    const matchedRule = findHandlerRule(functionId);

    log(`url=${url}`);
    log(`requestBody=${requestBody || 'empty'}`);
    log(`functionId=${functionId || "unknown"}`);

    if (matchedRule) {
        log(`matched patterns=${matchedRule.patterns.join("|")}`);
        matchedRule.handler(obj);
    } else {
        log("no matched handler, response body kept unchanged");
    }

    log("script finished");
    $done({ body: JSON.stringify(obj) });
} else {
    log("empty response body, skipped");
    $done({});
}

function getFunctionId(requestUrl, requestBody) {
    // 首先尝试从 URL 中获取 functionId
    const urlParam = requestUrl.match(/[?&]functionId=([^&]+)/)?.[1];
    if (urlParam) {
        return urlParam;
    }
    
    // 如果 URL 中没有，则从 requestBody 中获取
    // 注意：需要在 Surge 配置中添加 requires-body = true 才能获取到 requestBody
    if (requestBody) {
        try {
            // requestBody 可能是 JSON 字符串或表单格式
            const params = JSON.parse(requestBody);
            return params.functionId;
        } catch (e) {
            // 如果不是 JSON，尝试解析为表单格式 (functionId=xxx&other=yyy)
            const formParam = requestBody.match(/functionId=([^&]+)/)?.[1];
            if (formParam) {
                return formParam;
            }
            log(`failed to parse requestBody for functionId: ${e.message}`);
        }
    }
    
    return undefined;
}

function findHandlerRule(functionId) {
    if (!functionId) {
        return null;
    }
    return handlerRules.find((rule) => rule.patterns.some((pattern) => pattern.includes(functionId)));
}

function cleanBasicConfig(obj) {
    log("cleanBasicConfig start");

    setExistingProperty(obj?.data?.JDHttpToolKit?.httpdns, "httpdns", 0, "data.JDHttpToolKit.httpdns.httpdns");
    setExistingProperty(
        obj?.data?.JDMessage?.socketmonitor,
        "isSocketEstablishedAhead",
        0,
        "data.JDMessage.socketmonitor.isSocketEstablishedAhead"
    );
    setExistingProperty(obj?.data?.JDMessage?.socketmonitor, "isSocketReport", 0, "data.JDMessage.socketmonitor.isSocketReport");
}

function cleanDeliveryPage(obj) {
    log("cleanDeliveryPage start");
    // 物流页面：收货时寄快递享八折、运费八折。
    deleteProperty(obj, "bannerInfo");

    if (obj?.floors?.length > 0) {
        const beforeCount = obj.floors.length;
        obj.floors = obj.floors.filter((floor) => !deliveryBlockedFloorIds.includes(floor?.mId));
        log(`delivery floors ${beforeCount} -> ${obj.floors.length}`);
    }
}

function cleanNewProductPage(obj) {
    log("cleanNewProductPage start");
    // 新品页：悬浮动图、下拉二楼。
    deleteProperty(obj?.result, "iconInfo");
    deleteProperty(obj?.result, "roofTop");
}

function cleanOrderPage(obj) {
    log("cleanOrderPage start");

    if (!(obj?.floors?.length > 0)) {
        log("order floors empty, skipped");
        return;
    }

    const beforeCount = obj.floors.length;
    obj.floors = obj.floors.filter((floor) => {
        // 订单页面：满意度评分、专属权益、开通会员。
        if (orderBlockedFloorIds.includes(floor?.mId)) {
            return false;
        }

        cleanOrderFloor(floor);
        return true;
    });
    log(`order floors ${beforeCount} -> ${obj.floors.length}`);
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
                const beforeCount = item.serviceList.length;
                item.serviceList = item.serviceList.filter((card) => card?.serviceTitle !== "精选特惠");
                log(`virtual service cards ${beforeCount} -> ${item.serviceList.length}`);
            }
        });
    }
}

function cleanCustomerServiceFloor(floor) {
    if (!floor?.data?.moreText) {
        return;
    }

    log("cleanCustomerServiceFloor apply");
    // 客户服务：点此获得更多服务。
    delete floor.data.moreIcon;
    delete floor.data.moreIcon_dark;
    floor.data.moreText = " ";
}

function cleanProfilePage(obj) {
    log("cleanProfilePage start");

    if (!(obj?.floors?.length > 0)) {
        log("profile floors empty, skipped");
        return;
    }

    const beforeCount = obj.floors.length;
    obj.floors = obj.floors.filter((floor) => {
        if (profileBlockedFloorIds.includes(floor?.mId)) {
            return false;
        }

        cleanProfileFloor(floor);
        return true;
    });
    log(`profile floors ${beforeCount} -> ${obj.floors.length}`);
}

function cleanProfileFloor(floor) {
    const cleaner = profileFloorCleaners[floor?.mId];

    if (cleaner) {
        cleaner(floor);
    }
}

function cleanProfileBaseFloor(floor) {
    const data = floor?.data;

    log("cleanProfileBaseFloor apply");
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
        log("icon tool nodes empty, skipped");
        return;
    }

    [0, 1].forEach((index) => {
        if (nodes[index]?.length > 0) {
            const beforeCount = nodes[index].length;
            nodes[index] = sortIconToolNodes(nodes[index]);
            log(`icon tool nodes[${index}] ${beforeCount} -> ${nodes[index].length}`);
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
        log("cleanOrderIdFloor apply");
        // 发布评价的提醒。
        floor.data.commentRemindInfo.infos = [];
    }
}

function cleanUserInfoFloor(floor) {
    log("cleanUserInfoFloor apply");
    // 个人页顶部背景图保留；开通 plus 会员卡片移除。
    deleteProperty(floor?.data, "newPlusBlackCard");
}

function cleanSplashAd(obj) {
    log("cleanSplashAd start");

    if (obj?.images?.length > 0) {
        log(`splash images ${obj.images.length} -> 0`);
        obj.images = [];
    }

    if (obj?.showTimesDaily) {
        log(`showTimesDaily ${obj.showTimesDaily} -> 0`);
        obj.showTimesDaily = 0;
    }
}

function cleanStrategyConfig(obj) {
    log("cleanStrategyConfig start");

    setProperty(obj?.data?.startupConfig, "enable", 0, "data.startupConfig.enable");
    setProperty(obj?.data?.startupConfig, "frequency", 9999, "data.startupConfig.frequency");
}

function cleanHomeConfig(obj) {
    log("cleanHomeConfig start");

    if (obj?.floorList?.length > 0) {
        const beforeCount = obj.floorList.length;
        obj.floorList = obj.floorList.filter((floor) => !homeBlockedTypes.includes(floor?.type));
        log(`home floorList ${beforeCount} -> ${obj.floorList.length}`);
    }

    // 首页顶部背景图保留；下拉二楼移除。
    if (obj?.webViewFloorList?.length > 0) {
        log(`webViewFloorList ${obj.webViewFloorList.length} -> 0`);
        obj.webViewFloorList = [];
    }
}

function deleteProperty(target, key) {
    if (target && typeof target === "object") {
        delete target[key];
    }
}

function setExistingProperty(target, key, value, label) {
    if (target && typeof target === "object" && Object.prototype.hasOwnProperty.call(target, key)) {
        log(`${label} -> ${value}`);
        target[key] = value;
    } else {
        log(`${label} not found, skipped`);
    }
}

function setProperty(target, key, value, label) {
    if (target && typeof target === "object") {
        log(`${label} -> ${value}`);
        target[key] = value;
    } else {
        log(`${label} parent not found, skipped`);
    }
}

function log(message) {
    console.log(`[JD_remove_ads] ${message}`);
}
