const args = {};
$argument.split("&").forEach(p => {
    const index = p.indexOf("=");
    const key = p.substring(0, index);
    const value = p.substring(index + 1);
    args[key] = decodeURIComponent(value);
});

function getResetInfo(resetDay) {
    if (!resetDay) return "";
    const today = new Date();
    const nowDay = today.getDate();
    const nowMonth = today.getMonth();
    const nowYear = today.getFullYear();

    let resetDate;
    if (nowDay < resetDay) {
        resetDate = new Date(nowYear, nowMonth, resetDay);
    } else {
        resetDate = new Date(nowYear, nowMonth + 1, resetDay);
    }

    const diff = Math.ceil((resetDate - today) / (1000 * 60 * 60 * 24));
    return `重置：${diff}天`;
}

function fetchInfo(url, resetDay) {
    return new Promise(resolve => {
        // 定义UA重试策略
        const uaAttempts = [
            { headers: { "User-Agent": "Loon/962 CFNetwork/3860.600.12 Darwin/25.5.0" } },
            { headers: { "User-Agent": "Shadowrocket/3308 CFNetwork/3886.100.1 Darwin/27.0.0 iPhone18,3" } },
            {} // 不使用自定义UA，使用系统默认
        ];

        let attemptIndex = 0;

        function tryRequest() {
            if (attemptIndex >= uaAttempts.length) {
                resolve({
                    content: `请求失败：无法获取订阅信息`,
                    percent: "0.0",
                    error: true
                });
                return;
            }

            const options = { url, ...uaAttempts[attemptIndex] };

            $httpClient.get(options, (err, resp) => {
                if (err || !resp || resp.status !== 200) {
                    // 如果当前UA尝试失败，尝试下一个UA
                    attemptIndex++;
                    tryRequest();
                    return;
                }

                // 检查是否有subscription-userinfo头
                const headerKey = Object.keys(resp.headers).find(k => k.toLowerCase() === "subscription-userinfo");
                if (!headerKey || !resp.headers[headerKey]) {
                    // 没有获取到关键信息，尝试下一个UA
                    attemptIndex++;
                    tryRequest();
                    return;
                }

                // 成功获取到数据，解析并返回
                const data = {};
                resp.headers[headerKey].split(";").forEach(p => {
                    const [k, v] = p.trim().split("=");
                    if (k && v) data[k] = parseInt(v);
                });

                const used = (data.upload || 0) + (data.download || 0);
                const total = data.total || 0;
                const percent = total > 0 ? ((used / total) * 100).toFixed(1) : 0;

                const lines = [
                    `已用：${percent}%`,
                    `流量：${(used / 1024 / 1024 / 1024).toFixed(2)} GB｜${(total / 1024 / 1024 / 1024).toFixed(2)} GB`
                ];

                if (data.expire) {
                    const d = new Date(data.expire * 1000);
                    lines.push(`到期：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`);
                }

                if (resetDay) {
                    lines.push(getResetInfo(resetDay));
                }

                resolve({
                    content: lines.join("\n"),
                    percent: percent,
                    error: null
                });
            });
        }

        // 开始第一次请求
        tryRequest();
    });
}

// 检查是否是有效的订阅地址
function isValidUrl(url) {
    if (!url || url.trim() === "") return false;
    if (url === "#") return false;
    // 跳过所有包含"订阅"关键字的默认占位符
    if (url.includes("订阅")) return false;
    // 跳过包含"地址"关键字的默认占位符
    if (url.includes("地址")) return false;
    // 跳过"重置日"文本
    if (url.includes("重置")) return false;
    // 必须是 http 或 https 开头
    if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
    return true;
}

(async () => {
    const panels = [];
    const validSubscriptions = [];

    // 收集所有有效的订阅
    for (let i = 1; i <= 10; i++) {
        const urlKey = `url${i}`;
        const titleKey = `title${i}`;
        const resetKey = `resetDay${i}`;

        // 跳过无效的订阅地址
        if (!isValidUrl(args[urlKey])) {
            continue;
        }

        validSubscriptions.push({
            index: i,
            url: args[urlKey],
            title: args[titleKey],
            resetDay: args[resetKey] ? parseInt(args[resetKey]) : null
        });
    }

    // 如果没有有效订阅，直接返回
    if (validSubscriptions.length === 0) {
        $done({
            title: "订阅流量",
            content: "未配置有效的订阅地址",
            icon: "antenna.radiowaves.left.and.right.circle.fill",
            "icon-color": "#00E28F"
        });
        return;
    }

    // 并发请求所有订阅
    const promises = validSubscriptions.map(async (sub) => {
        const result = await fetchInfo(sub.url, sub.resetDay);
        
        if (result.error) {
            // 错误情况：显示标题和错误信息
            return {
                index: sub.index,
                panel: sub.title ? `${sub.title}(已用：${result.percent}%)\n${result.content}` : result.content
            };
        }
        
        // 正常情况：解析content中的已用行，将其合并到标题行
        const lines = result.content.split('\n');
        const usedLine = lines.find(line => line.startsWith('已用：'));
        const otherLines = lines.filter(line => !line.startsWith('已用：'));
        
        const titleLine = sub.title ? `${sub.title}(已用：${result.percent}%)` : '';
        const displayContent = [titleLine, ...otherLines].filter(line => line).join('\n');
        
        return {
            index: sub.index,
            panel: displayContent
        };
    });

    // 等待所有请求完成
    const results = await Promise.all(promises);

    // 按原始顺序排序并添加到panels
    results.sort((a, b) => a.index - b.index);
    results.forEach(result => panels.push(result.panel));

    $done({
        title: "订阅流量",
        content: panels.join("\n\n"),
        icon: "antenna.radiowaves.left.and.right.circle.fill",
        "icon-color": "#00E28F"
    });
})();