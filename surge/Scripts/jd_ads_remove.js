const body = $response.body;

// 广告清理规则配置
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
    
    // 对所有响应统一执行广告清理，不依赖 functionId
    // 每个清理函数内部会检查对应的 key 是否存在，不存在则跳过
    cleanBasicConfig(obj);
    cleanDeliveryPage(obj);
    cleanNewProductPage(obj);
    cleanOrderPage(obj);
    cleanProfilePage(obj);
    cleanSplashAd(obj);
    cleanStrategyConfig(obj);
    cleanHomeConfig(obj);

    $done({ body: JSON.stringify(obj) });
} else {
    log("⚪ empty response body, skipped");
    $done({});
}



function cleanBasicConfig(obj) {
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
    // 物流页面：收货时寄快递享八折、运费八折。
    if (obj?.bannerInfo) {
        delete obj.bannerInfo;
        log("✅ deleted bannerInfo");
    }

    if (obj?.floors?.length > 0) {
        const beforeCount = obj.floors.length;
        obj.floors = obj.floors.filter((floor) => !deliveryBlockedFloorIds.includes(floor?.mId));
        if (obj.floors.length < beforeCount) {
            log(`✅ delivery floors filtered ${beforeCount} -> ${obj.floors.length}`);
        } else {
            log("⚪ delivery floors unchanged");
        }
    }
}

function cleanNewProductPage(obj) {
    // 新品页：悬浮动图、下拉二楼。
    let modified = false;
    if (obj?.result?.iconInfo) {
        delete obj.result.iconInfo;
        modified = true;
    }
    if (obj?.result?.roofTop) {
        delete obj.result.roofTop;
        modified = true;
    }
    if (modified) {
        log("✅ cleaned new product page");
    }
}

function cleanOrderPage(obj) {
    if (!(obj?.floors?.length > 0)) {
        log("⚪ order floors empty, skipped");
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
    if (obj.floors.length < beforeCount) {
        log(`✅ order floors filtered ${beforeCount} -> ${obj.floors.length}`);
    } else {
        log("⚪ order floors unchanged");
    }
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
                if (item.serviceList.length < beforeCount) {
                    log(`✅ virtual service cards filtered ${beforeCount} -> ${item.serviceList.length}`);
                }
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
    log("✅ cleaned customer service floor");
}

function cleanProfilePage(obj) {
    if (!(obj?.floors?.length > 0)) {
        log("⚪ profile floors empty, skipped");
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
    if (obj.floors.length < beforeCount) {
        log(`✅ profile floors filtered ${beforeCount} -> ${obj.floors.length}`);
    } else {
        log("⚪ profile floors unchanged");
    }
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
    let modified = false;
    if (data?.commonPopup) {
        delete data.commonPopup;
        modified = true;
    }
    if (data?.commonPopup_dynamic) {
        delete data.commonPopup_dynamic;
        modified = true;
    }
    if (data?.floatLayer) {
        delete data.floatLayer;
        modified = true;
    }

    if (data?.commonTips?.length > 0) {
        data.commonTips = [];
        modified = true;
    }

    if (data?.commonWindows?.length > 0) {
        data.commonWindows = [];
        modified = true;
    }
    
    if (modified) {
        log("✅ cleaned profile base floor");
    }
}

function cleanIconToolFloor(floor) {
    const nodes = floor?.data?.nodes;

    if (!(nodes?.length > 0)) {
        log("⚪ icon tool nodes empty, skipped");
        return;
    }

    let hasModification = false;
    [0, 1].forEach((index) => {
        if (nodes[index]?.length > 0) {
            const beforeCount = nodes[index].length;
            nodes[index] = sortIconToolNodes(nodes[index]);
            if (nodes[index].length < beforeCount) {
                log(`✅ icon tool nodes[${index}] filtered ${beforeCount} -> ${nodes[index].length}`);
                hasModification = true;
            }
        }
    });
    
    if (!hasModification) {
        log("⚪ icon tool nodes unchanged");
    }
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
        log("✅ cleared comment remind infos");
    }
}

function cleanUserInfoFloor(floor) {
    // 个人页顶部背景图保留；开通 plus 会员卡片移除。
    if (floor?.data?.newPlusBlackCard) {
        delete floor.data.newPlusBlackCard;
        log("✅ removed newPlusBlackCard");
    }
}

function cleanSplashAd(obj) {
    let modified = false;

    if (obj?.images?.length > 0) {
        obj.images = [];
        log("✅ cleared splash images");
        modified = true;
    }

    if (obj?.showTimesDaily) {
        obj.showTimesDaily = 0;
        log("✅ reset showTimesDaily to 0");
        modified = true;
    }
    
    if (!modified) {
        log("⚪ splash ad unchanged");
    }
}

function cleanStrategyConfig(obj) {
    let modified = false;
    
    if (obj?.data?.startupConfig) {
        if (Object.prototype.hasOwnProperty.call(obj.data.startupConfig, "enable")) {
            obj.data.startupConfig.enable = 0;
            modified = true;
        }
        if (Object.prototype.hasOwnProperty.call(obj.data.startupConfig, "frequency")) {
            obj.data.startupConfig.frequency = 9999;
            modified = true;
        }
    }
    
    if (modified) {
        log("✅ updated strategy config");
    } else {
        log("⚪ strategy config unchanged");
    }
}

function cleanHomeConfig(obj) {
    let modified = false;

    if (obj?.floorList?.length > 0) {
        const beforeCount = obj.floorList.length;
        obj.floorList = obj.floorList.filter((floor) => !homeBlockedTypes.includes(floor?.type));
        if (obj.floorList.length < beforeCount) {
            log(`✅ home floorList filtered ${beforeCount} -> ${obj.floorList.length}`);
            modified = true;
        }
    }

    // 首页顶部背景图保留；下拉二楼移除。
    if (obj?.webViewFloorList?.length > 0) {
        obj.webViewFloorList = [];
        log("✅ cleared webViewFloorList");
        modified = true;
    }
    
    if (!modified) {
        log("⚪ home config unchanged");
    }
}

function deleteProperty(target, key) {
    if (target && typeof target === "object") {
        delete target[key];
    }
}

function setExistingProperty(target, key, value, label) {
    if (target && typeof target === "object" && Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = value;
        log(`✅ ${label} -> ${value}`);
    }
}

function setProperty(target, key, value, label) {
    if (target && typeof target === "object") {
        target[key] = value;
        log(`✅ ${label} -> ${value}`);
    }
}

function log(message) {
    console.log(`[JD_remove_ads] ${message}`);
}
