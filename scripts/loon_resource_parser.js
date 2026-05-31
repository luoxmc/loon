/**
 * Loon Resource Parser
 *
 * Author: mc2u
 * Repository: https://github.com/mc2u/Loon
 *
 * 用于 Loon 节点订阅的资源解析脚本，主要用于节点名称修改和排序；也可通过 `Shadowrocket/3082` User-Agent 重新拉取订阅，以解决部分订阅未向 Loon 下发新协议节点或下发不及时的情况。
 *
 * 功能：
 * - 添加节点名前缀
 * - 添加节点名后缀
 * - 去除节点名中的 emoji
 * - 普通文本替换
 * - 按关键词自定义节点排序
 * - 使用 Shadowrocket User-Agent 重新拉取订阅
 * - 按订阅 URL 保存独立配置
 * - 重置当前订阅配置
 *
 * 支持参数：
 * - pre=      给节点名添加前缀，例如 pre=🍑
 * - suf=      给节点名添加后缀，例如 suf=🍓
 * - emoji     去除节点名中的 emoji
 * - rename=   普通文本替换，例如 rename=香港:HK,日本:JP
 * - sort=     按关键词顺序排序节点，例如 sort=香港,日本,新加坡,美国
 * - ua        使用 Shadowrocket User-Agent 重新拉取订阅
 * - debug     输出详细解析日志，用于定位订阅格式问题
 * - reset     清空当前订阅已保存的配置
 *
 * 参数说明：
 * - pre=🍑
 *   给所有节点名称前面添加 🍑
 * - suf=🍓
 *   给所有节点名称后面添加 🍓
 * - emoji
 *   去除节点名称中的 emoji
 * - rename=香港:HK,日本:JP,新加坡:SG
 *   将香港、日本、新加坡分别替换为 HK、JP、SG
 * - rename=0.1倍:
 *   删除节点名中的 0.1倍
 * - sort=香港,日本,新加坡,美国
 *   按关键词顺序排序节点
 * - ua
 *   使用 Shadowrocket User-Agent 重新拉取当前订阅
 * - debug
 *   输出详细解析日志，定位节点名称未修改、协议识别失败等问题
 * - reset
 *   清空当前订阅已保存的参数配置
 *
 * 组合示例：
 * - ua&pre=🍑
 *   使用 Shadowrocket UA 并添加前缀
 * - ua&emoji
 *   使用 Shadowrocket UA 并去除 emoji
 * - ua&emoji&rename=0.1倍:&pre=🍑
 *   使用 Shadowrocket UA，去 emoji，删除倍率并添加前缀
 * - emoji&pre=🍑
 *   去除 emoji 后添加前缀
 * - rename=0.1倍:&pre=🍑
 *   删除倍率后添加前缀
 * - emoji&pre=🍑&suf=🍓
 *   同时添加前缀、后缀并去除 emoji
 * - sort=香港,日本,新加坡,美国
 *   按香港、日本、新加坡、美国的顺序排列节点
 *
 * 建议配置顺序：
 * - ua -> emoji -> rename -> pre -> suf -> sort
 *
 * 配置说明：
 * - 参数按订阅 URL 单独保存
 * - 不同订阅互不影响
 * - 不重新填写参数时，会优先使用已保存配置
 * - 如果订阅编辑界面的参数输入框内出现 xxx = https...，直接点 x 删除掉后重新填写参数即可
 * - 修改参数后需要手动更新订阅才会生效
 * - 如果仍不生效，请前往“设置 -> 外部资源 -> 资源解析器”更新一次
 */

var type = $resourceType;
var result = "";

var pre = "";
var suf = "";
var emoji = false;
var rename = "";
var sort = "";
var ua = false;
var debug = false;
var HAS_SUPPORTED_PARAM = false;
var DEBUG_VM_SAMPLE_LIMIT = 5;

function getStorageKey() {
    var url = "default";
    if (typeof $resourceUrl !== 'undefined' && $resourceUrl) url = String($resourceUrl);
    return "loon_parser_config_" + encodeURIComponent(url);
}

function isSupportedParamKey(key) {
    return key === 'pre' || key === 'suf' || key === 'emoji' || key === 'rename' || key === 'sort' || key === 'ua' || key === 'debug' || key === 'reset';
}

function parserLog(message) {
    console.log('[解析器] ' + message);
}

function debugLog(message) {
    if (debug) parserLog('[debug] ' + message);
}

function previewText(text, maxLen) {
    var s = String(text || '');
    maxLen = maxLen || 80;
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '...';
}

function cleanEmoji(text) {
    return String(text || '').replace(/[\u{1F1E0}-\u{1F1FF}]|[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1FA00}-\u{1FAFF}]|[\u{1FB00}-\u{1FBFF}]|[\u{1F900}-\u{1F9FF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function normalizeText(s) {
    s = String(s || '');
    if (s && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseRename(raw) {
    var pairs = [];
    if (!raw) return pairs;
    var items = String(raw).split(',');
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        var idx = item.indexOf(':');
        if (idx === -1) continue;
        var from = item.slice(0, idx).trim();
        var to = item.slice(idx + 1).trim();
        if (from === '') continue;
        pairs.push([from, to]);
    }
    return pairs;
}

function applyRename(name) {
    var n = String(name || '');
    var pairs = parseRename(rename);
    for (var i = 0; i < pairs.length; i++) {
        n = n.split(pairs[i][0]).join(pairs[i][1]);
    }
    return n;
}

function getSortIndex(name) {
    if (!sort) return -1;
    var rules = String(sort).split(',');
    var n = String(name || '');
    for (var i = 0; i < rules.length; i++) {
        var rule = rules[i].trim();
        if (rule && n.indexOf(rule) !== -1) return i;
    }
    return rules.length;
}

function sortItemsByName(items) {
    if (!sort || !items.length) return items;
    items.sort(function(a, b) {
        var ai = getSortIndex(a.name);
        var bi = getSortIndex(b.name);
        if (ai !== bi) return ai - bi;
        return a.index - b.index;
    });
    return items;
}

function modifyName(name) {
    var n = String(name || '');
    if (emoji) n = cleanEmoji(n);
    if (rename) n = applyRename(n);
    if (pre) n = pre + n;
    if (suf) n = n + suf;
    return n;
}

function base64DecodeUnicode(str) {
    try {
        str = normalizeBase64(str);
        if (typeof atob !== 'undefined') {
            var binary = atob(str);
            var bytes = [];
            for (var i = 0; i < binary.length; i++) bytes.push('%' + ('00' + binary.charCodeAt(i).toString(16)).slice(-2));
            return decodeURIComponent(bytes.join(''));
        }
    } catch (e) {}
    return null;
}

function base64EncodeUnicode(str) {
    try {
        if (typeof btoa !== 'undefined') {
            var enc = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
                return String.fromCharCode('0x' + p1);
            });
            return btoa(enc);
        }
    } catch (e) {}
    return null;
}

function normalizeBase64(str) {
    var s = String(str || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    var mod = s.length % 4;
    if (mod) s += new Array(5 - mod).join('=');
    return s;
}

function looksLikeBase64(text) {
    var s = normalizeBase64(String(text || '').replace(/\s+/g, ''));
    if (!s || s.length < 16) return false;
    if (s.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/=]+$/.test(s);
}

function getUriProtocol(line) {
    var match = String(line || '').match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
    return match ? match[1].toLowerCase() : 'unknown';
}

function decodeVmessPayload(payload) {
    var body = String(payload || '').trim();
    if (!body) return null;
    if (body.charAt(0) === '{') return body;
    return base64DecodeUnicode(body);
}

function decodeQueryValue(value) {
    try { return decodeURIComponent(String(value || '').replace(/\+/g, '%20')); }
    catch (e) { return String(value || ''); }
}

function splitUriParts(line) {
    var raw = String(line || '');
    var hashPos = raw.indexOf('#');
    var beforeHash = hashPos > -1 ? raw.slice(0, hashPos) : raw;
    var hash = hashPos > -1 ? raw.slice(hashPos) : '';
    var queryPos = beforeHash.indexOf('?');
    return {
        base: queryPos > -1 ? beforeHash.slice(0, queryPos) : beforeHash,
        query: queryPos > -1 ? beforeHash.slice(queryPos + 1) : '',
        hash: hash
    };
}

function findQueryParam(query, keys) {
    var parts = String(query || '').split('&');
    for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        var eqPos = parts[i].indexOf('=');
        var rawKey = eqPos > -1 ? parts[i].slice(0, eqPos) : parts[i];
        var key = decodeQueryValue(rawKey).toLowerCase();
        for (var j = 0; j < keys.length; j++) {
            if (key === keys[j]) {
                return {
                    index: i,
                    rawKey: rawKey,
                    value: eqPos > -1 ? parts[i].slice(eqPos + 1) : ''
                };
            }
        }
    }
    return null;
}

function replaceQueryParam(query, targetIndex, rawKey, value) {
    var parts = String(query || '').split('&');
    parts[targetIndex] = rawKey + '=' + encodeURIComponent(value);
    return parts.join('&');
}

function parseVmessQueryUri(line, lineNumber) {
    var parts = splitUriParts(line);
    if (!parts.query) return null;

    var nameParam = findQueryParam(parts.query, ['remarks', 'remark', 'ps', 'tag', 'name']);
    if (!nameParam) {
        debugLog('第 ' + lineNumber + ' 行 VMess query 未找到 remarks/ps/tag/name: ' + previewText(parts.query));
        return null;
    }

    var oldName = decodeQueryValue(nameParam.value);
    if (!oldName) {
        debugLog('第 ' + lineNumber + ' 行 VMess query 名称为空: ' + previewText(parts.query));
        return null;
    }

    var newName = modifyName(oldName);
    var newQuery = replaceQueryParam(parts.query, nameParam.index, nameParam.rawKey, newName);
    debugLog('第 ' + lineNumber + ' 行 VMess query: ' + previewText(oldName, 40) + ' => ' + previewText(newName, 40));
    return {
        index: lineNumber - 1,
        name: newName,
        raw: parts.base + '?' + newQuery + parts.hash,
        jsonVmess: true
    };
}

function parseVmessUri(line, lineNumber) {
    if (String(line || '').indexOf('vmess://') !== 0) return null;

    var queryItem = parseVmessQueryUri(line, lineNumber);
    if (queryItem) return queryItem;

    var rest = String(line).slice(8);
    var hashPos = rest.lastIndexOf('#');
    var hasFragment = hashPos > -1;
    var payload = hashPos > -1 ? rest.slice(0, hashPos) : rest;
    var fragment = hashPos > -1 ? rest.slice(hashPos + 1) : '';
    var decoded = decodeVmessPayload(payload);

    if (!decoded) {
        debugLog('第 ' + lineNumber + ' 行 VMess payload base64 解码失败: ' + previewText(payload));
        return null;
    }

    try {
        var json = JSON.parse(decoded);
        var oldName = json.ps || '';
        if (!oldName && fragment) {
            try { oldName = decodeURIComponent(fragment); }
            catch (e) { oldName = fragment; }
        }
        if (!oldName) {
            debugLog('第 ' + lineNumber + ' 行 VMess 未找到 ps 或 fragment 名称: ' + previewText(decoded));
            return null;
        }
        var newName = modifyName(oldName);
        json.ps = newName;
        var encoded = base64EncodeUnicode(JSON.stringify(json));
        if (!encoded) {
            debugLog('第 ' + lineNumber + ' 行 VMess JSON 重新编码失败: ' + previewText(decoded));
            return null;
        }
        debugLog('第 ' + lineNumber + ' 行 VMess: ' + previewText(oldName, 40) + ' => ' + previewText(newName, 40));
        return {
            index: lineNumber - 1,
            name: newName,
            raw: 'vmess://' + encoded + (hasFragment ? '#' + encodeURIComponent(newName) : ''),
            jsonVmess: true
        };
    } catch (e) {
        debugLog('第 ' + lineNumber + ' 行 VMess JSON解析失败: ' + e + '，内容: ' + previewText(decoded));
        return null;
    }
}

function renameLoonStyleText(text) {
    var raw = normalizeText(text).trim();
    if (!raw) return "";

    var lines = raw.split('\n');
    var output = [];
    var count = 0;
    var items = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.charAt(0) === '#') {
            output.push(line);
            continue;
        }

        var eqPos = line.indexOf('=');
        if (eqPos > 0) {
            var name = line.substring(0, eqPos).trim();
            var value = line.substring(eqPos + 1).trim();
            items.push({ index: items.length, name: modifyName(name), value: value });
            count++;
            continue;
        }

        output.push(line);
    }

    items = sortItemsByName(items);
    for (var j = 0; j < items.length; j++) {
        output.push(items[j].name + '=' + items[j].value);
    }

    parserLog('已修改节点数: ' + count);
    return output.join('\n');
}

function renameBase64UriList(text) {
    var compact = String(text || '').replace(/\s+/g, '');
    var decoded = base64DecodeUnicode(compact);
    if (!decoded) return null;

    var lines = normalizeText(decoded).split('\n');
    var changed = 0;
    var items = [];
    var protocolStats = {};
    var vmessDecoded = 0;
    var vmessFailed = 0;
    var noHashCount = 0;
    var vmessRawSamples = 0;
    var vmessFailSamples = 0;

    debugLog('base64 订阅解码成功，行数: ' + lines.length + '，内容预览: ' + previewText(decoded.replace(/\n/g, '\\n'), 160));

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var protocol = getUriProtocol(line);
        protocolStats[protocol] = (protocolStats[protocol] || 0) + 1;

        if (protocol === 'vmess') {
            if (debug && vmessRawSamples < DEBUG_VM_SAMPLE_LIMIT) {
                vmessRawSamples++;
                debugLog('VMess原始样本#' + vmessRawSamples + ' 第 ' + (i + 1) + ' 行: ' + previewText(line, 500));
            }
            var vmessItem = parseVmessUri(line, i + 1);
            if (vmessItem) {
                vmessItem.index = items.length;
                items.push(vmessItem);
                vmessDecoded++;
                changed++;
                continue;
            }
            vmessFailed++;
            if (debug && vmessFailSamples < DEBUG_VM_SAMPLE_LIMIT) {
                vmessFailSamples++;
                debugLog('VMess失败样本#' + vmessFailSamples + ' 第 ' + (i + 1) + ' 行: ' + previewText(line, 500));
            }
        }

        var hashPos = line.lastIndexOf('#');
        if (hashPos > -1 && hashPos < line.length - 1) {
            var left = line.slice(0, hashPos + 1);
            var frag = line.slice(hashPos + 1);
            var oldName = '';
            try { oldName = decodeURIComponent(frag); }
            catch (e) { oldName = frag; }
            var newName = modifyName(oldName);
            debugLog('第 ' + (i + 1) + ' 行 ' + protocol + '#: ' + previewText(oldName, 40) + ' => ' + previewText(newName, 40));
            items.push({ index: items.length, name: newName, left: left });
            changed++;
        } else {
            items.push({ index: items.length, name: '', raw: line, noHash: true });
            noHashCount++;
            debugLog('第 ' + (i + 1) + ' 行 ' + protocol + ' 未找到可修改节点名: ' + previewText(line));
        }
    }

    var sortable = [];
    var passthrough = [];
    for (var j = 0; j < items.length; j++) {
        if (items[j].noHash) {
            passthrough.push(items[j]);
        } else {
            sortable.push(items[j]);
        }
    }

    sortable = sortItemsByName(sortable);
    var merged = sortable.concat(passthrough);
    var output = [];
    for (var k = 0; k < merged.length; k++) {

        if (merged[k].jsonVmess) {
            output.push(merged[k].raw);
        }
        else if (merged[k].noHash) {
            output.push(merged[k].raw);
        }
        else {
            output.push(
                merged[k].left +
                encodeURIComponent(merged[k].name)
            );
        }
    }

    var encoded = base64EncodeUnicode(output.join('\n'));
    if (!encoded) return null;

    var statParts = [];
    for (var p in protocolStats) {
        if (protocolStats.hasOwnProperty(p)) statParts.push(p + '=' + protocolStats[p]);
    }
    parserLog('base64 URI列表统计: ' + (statParts.length ? statParts.join(', ') : '无'));
    parserLog('VMess解析: 成功=' + vmessDecoded + ', 失败=' + vmessFailed + ', 无可改名=' + noHashCount);
    parserLog('已修改节点数: ' + changed);
    return encoded;
}

function processResourceContent(content) {
    var raw = normalizeText(content);
    var configParts = [];
    if (ua) configParts.push('ua');
    if (debug) configParts.push('debug');
    if (emoji) configParts.push('emoji');
    if (rename) configParts.push('rename=' + rename);
    if (pre) configParts.push('pre=' + pre);
    if (suf) configParts.push('suf=' + suf);
    if (sort) configParts.push('sort=' + sort);
    parserLog('当前配置: ' + (configParts.length ? configParts.join(', ') : '无'));
    parserLog('订阅内容长度: ' + raw.length);
    debugLog('订阅原始预览: ' + previewText(raw.replace(/\n/g, '\\n'), 180));

    var trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }

    var base64Result = null;
    if (looksLikeBase64(trimmed)) {
        base64Result = renameBase64UriList(trimmed);
        if (base64Result !== null) return base64Result;
    }

    return renameLoonStyleText(trimmed);
}

function finishWithContent(content) {
    if (type == 1) result = processResourceContent(content);
    else result = String(content || "");
    console.log('[解析器] 处理完成');
    $done(result);
}

var STORAGE_KEY = getStorageKey();

var savedConfig = $persistentStore.read(STORAGE_KEY);
if (savedConfig) {
    try {
        var c = JSON.parse(savedConfig);
        pre = c.pre || "";
        suf = c.suf || "";
        emoji = c.emoji || false;
        rename = c.rename || "";
        sort = c.sort || "";
        ua = c.ua === true;
        debug = c.debug === true;
        parserLog('已读取本地配置');
    } catch (e) {
        parserLog('本地配置解析失败');
    }
} else {
    parserLog('未找到本地配置，使用默认值');
}

var argStr = "";
if (typeof $argument !== 'undefined' && $argument) {
    argStr = $argument.toString();
} else if (typeof $args !== 'undefined' && $args) {
    argStr = $args.toString();
} else if (typeof $parameter !== 'undefined' && $parameter) {
    argStr = $parameter.toString();
}

var params = [];
var canUpdateConfig = false;
var doReset = false;
if (argStr) {
    params = argStr.split('&');
    for (var i = 0; i < params.length; i++) {
        var kv0 = params[i].split('=');
        var key0 = (kv0[0] || "").trim().toLowerCase();
        var value0 = kv0.length > 1 ? decodeURIComponent(kv0.slice(1).join('=').trim()) : '';
        if (isSupportedParamKey(key0)) HAS_SUPPORTED_PARAM = true;
        if (key0 === 'reset' && value0 === '') doReset = true;
    }
}

if (argStr && !argStr.match(/^https?:\/\//) && HAS_SUPPORTED_PARAM) {
    canUpdateConfig = true;
}

if (canUpdateConfig) {
    if (doReset) {
        pre = "";
        suf = "";
        emoji = false;
        rename = "";
        sort = "";
        ua = false;
        debug = false;
    }
    for (var j = 0; j < params.length; j++) {
        var kv = params[j].split('=');
        var key = (kv[0] || "").trim().toLowerCase();
        var value = kv.length > 1 ? decodeURIComponent(kv.slice(1).join('=').trim()) : '';

        if (key === 'pre') pre = value;
        else if (key === 'suf') suf = value;
        else if (key === 'emoji') emoji = value === '';
        else if (key === 'rename') rename = value;
        else if (key === 'sort') sort = value;
        else if (key === 'ua') ua = value === '';
        else if (key === 'debug') debug = value === '' || value === '1' || value.toLowerCase() === 'true';
        else if (key === 'reset') {}
    }

    var config = { pre: pre, suf: suf, emoji: emoji, rename: rename, sort: sort, ua: ua, debug: debug };
    $persistentStore.write(JSON.stringify(config), STORAGE_KEY);
    parserLog('已更新本地配置');
} else {
    parserLog('未更新本地配置');
}

function refetchWithShadowrocketUA() {
    if (typeof $httpClient === 'undefined' || !$httpClient) {
        console.log('[解析器] 当前环境不支持自定义 UA 拉取，已回退默认内容');
        finishWithContent($resource || "");
        return;
    }
    if (typeof $resourceUrl === 'undefined' || !$resourceUrl) {
        console.log('[解析器] 缺少资源地址，已回退默认内容');
        finishWithContent($resource || "");
        return;
    }

    var req = {
        url: String($resourceUrl),
        headers: {
            'User-Agent': 'Shadowrocket/3082'
        }
    };

    console.log('[解析器] 已启用 Shadowrocket UA');

    $httpClient.get(req, function(error, response, data) {
        if (error || !data) {
            console.log('[解析器] Shadowrocket UA 拉取失败，已回退默认内容');
            finishWithContent($resource || "");
            return;
        }
        console.log('[解析器] Shadowrocket UA 拉取成功');
        finishWithContent(data);
    });
}

if (ua && type == 1) refetchWithShadowrocketUA();
else finishWithContent($resource || "");
