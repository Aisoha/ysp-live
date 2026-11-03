const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');

const VERSION = '9.5.1-optimized';
const PORT = parseInt(process.env.YSP_ENGINE_PORT || process.env.PORT || process.argv[2] || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';

// 1. 配置 HTTP/HTTPS Keep-Alive 代理，复用底层 TCP 连接，减少建连延迟
const keepAliveAgent = new http.Agent({ keepAlive: true, maxSockets: 128, timeout: 60000 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 128, timeout: 60000 });

// 2. Token 内存缓存配置（TTL: 3分钟，实现秒切的核心）
const TOKEN_CACHE_TTL = 3 * 60 * 1000; 
const tokenCache = new Map();

function getCachedToken(key) {
    const cached = tokenCache.get(key);
    if (cached && (Date.now() - cached.timestamp < TOKEN_CACHE_TTL)) {
        return cached.data;
    }
    return null;
}

function setCachedToken(key, data) {
    tokenCache.set(key, { timestamp: Date.now(), data });
    // 简单的内存清理，防止无限膨胀
    if (tokenCache.size > 500) {
        const oldestKey = tokenCache.keys().next().value;
        tokenCache.delete(oldestKey);
    }
}

// 频道与别名映射数据保持不变
const CHANNELS = { "cctv1": { "name": "CCTV-1 综合", "cnlid": "2024078201", "livepid": "600001859", "defn": "fhd" }, "cctv2": { "name": "CCTV-2 财经", "cnlid": "2024075401", "livepid": "600001800", "defn": "fhd" }, "cctv3": { "name": "CCTV-3 综艺", "cnlid": "2024068501", "livepid": "600001801", "defn": "fhd" }, "cctv4": { "name": "CCTV-4 中文国际", "cnlid": "2029797101", "livepid": "600001814", "defn": "fhd" }, "cctv5": { "name": "CCTV-5 体育", "cnlid": "2024078401", "livepid": "600001818", "defn": "fhd" }, "cctv5p": { "name": "CCTV-5+ 体育赛事", "cnlid": "2024078001", "livepid": "600001817", "defn": "fhd" }, "cctv6": { "name": "CCTV-6 电影", "cnlid": "2013693901", "livepid": "600108442", "defn": "fhd" }, "cctv7": { "name": "CCTV-7 国防军事", "cnlid": "2024072001", "livepid": "600004092", "defn": "fhd" }, "cctv8": { "name": "CCTV-8 电视剧", "cnlid": "2029793001", "livepid": "600001803", "defn": "fhd" }, "cctv9": { "name": "CCTV-9 纪录", "cnlid": "2024078601", "livepid": "600004078", "defn": "fhd" }, "cctv10": { "name": "CCTV-10 科教", "cnlid": "2024078701", "livepid": "600001805", "defn": "fhd" }, "cctv11": { "name": "CCTV-11 戏曲", "cnlid": "2027248701", "livepid": "600001806", "defn": "fhd" }, "cctv12": { "name": "CCTV-12 社会与法", "cnlid": "2027248801", "livepid": "600001807", "defn": "fhd" }, "cctv13": { "name": "CCTV-13 新闻", "cnlid": "2029797201", "livepid": "600001811", "defn": "fhd" }, "cctv14": { "name": "CCTV-14 少儿", "cnlid": "2027248901", "livepid": "600001809", "defn": "fhd" }, "cctv15": { "name": "CCTV-15 音乐", "cnlid": "2027249001", "livepid": "600001815", "defn": "fhd" }, "cctv16": { "name": "CCTV-16 奥林匹克", "cnlid": "2027249101", "livepid": "600098637", "defn": "fhd" }, "cctv164k": { "name": "CCTV-16 4K", "cnlid": "2027249301", "livepid": "600099502", "defn": "fhd" }, "cctv17": { "name": "CCTV-17 农业农村", "cnlid": "2027249401", "livepid": "600001810", "defn": "fhd" }, "cctv4k": { "name": "CCTV-4K 超高清", "cnlid": "2029810301", "livepid": "600002264", "defn": "fhd" }, "cctv8k": { "name": "CCTV-8K 超高清", "cnlid": "2026774101", "livepid": "600156816", "defn": "fhd" }, "cgtn": { "name": "CGTN", "cnlid": "2024181701", "livepid": "600014550", "defn": "fhd" }, "cgtnfr": { "name": "CGTN 法语", "cnlid": "2024181801", "livepid": "600084704", "defn": "fhd" }, "cgtnru": { "name": "CGTN 俄语", "cnlid": "2024181901", "livepid": "600084758", "defn": "fhd" }, "cgtnar": { "name": "CGTN 阿拉伯语", "cnlid": "2024182001", "livepid": "600084782", "defn": "fhd" }, "cgtnes": { "name": "CGTN 西班牙语", "cnlid": "2024182101", "livepid": "600084744", "defn": "fhd" }, "cgtndoc": { "name": "CGTN 纪录", "cnlid": "2024182301", "livepid": "600084781", "defn": "fhd" }, "cctvfyjc": { "name": "CCTV 风云剧场", "cnlid": "2025637102", "livepid": "600099658", "defn": "shd" }, "cctvdyjc": { "name": "CCTV 第一剧场", "cnlid": "2026874202", "livepid": "600099655", "defn": "shd" }, "cctvhjjc": { "name": "CCTV 怀旧剧场", "cnlid": "2026874302", "livepid": "600099620", "defn": "shd" }, "bjws": { "name": "北京卫视", "cnlid": "2024052703", "livepid": "600002309", "defn": "fhd" }, "jsws": { "name": "江苏卫视", "cnlid": "2024171103", "livepid": "600002521", "defn": "fhd" }, "dfws": { "name": "东方卫视", "cnlid": "2024054503", "livepid": "600002483", "defn": "fhd" }, "zjws": { "name": "浙江卫视", "cnlid": "2024054703", "livepid": "600002520", "defn": "fhd" }, "hnws": { "name": "湖南卫视", "cnlid": "2024054803", "livepid": "600002475", "defn": "fhd" }, "hbws": { "name": "湖北卫视", "cnlid": "2024171203", "livepid": "600002508", "defn": "fhd" }, "gdws": { "name": "广东卫视", "cnlid": "2024060903", "livepid": "600002485", "defn": "fhd" }, "gxws": { "name": "广西卫视", "cnlid": "2024060703", "livepid": "600002509", "defn": "fhd" }, "hljws": { "name": "黑龙江卫视", "cnlid": "2029797003", "livepid": "600002498", "defn": "fhd" }, "hainanws": { "name": "海南卫视", "cnlid": "2024055603", "livepid": "600002506", "defn": "fhd" }, "cqws": { "name": "重庆卫视", "cnlid": "2024061103", "livepid": "600002531", "defn": "fhd" }, "szws": { "name": "深圳卫视", "cnlid": "2024061303", "livepid": "600002481", "defn": "fhd" }, "scws": { "name": "四川卫视", "cnlid": "2024061403", "livepid": "600002516", "defn": "fhd" }, "henanws": { "name": "河南卫视", "cnlid": "2029797303", "livepid": "600002525", "defn": "fhd" }, "dnws": { "name": "东南卫视", "cnlid": "2024061503", "livepid": "600002484", "defn": "fhd" }, "gzws": { "name": "贵州卫视", "cnlid": "2024061603", "livepid": "600002490", "defn": "fhd" }, "jxws": { "name": "江西卫视", "cnlid": "2024061703", "livepid": "600002503", "defn": "fhd" }, "lnws": { "name": "辽宁卫视", "cnlid": "2024171303", "livepid": "600002505", "defn": "fhd" }, "ahws": { "name": "安徽卫视", "cnlid": "2024171403", "livepid": "600002532", "defn": "fhd" }, "hebws": { "name": "河北卫视", "cnlid": "2024171503", "livepid": "600002493", "defn": "fhd" }, "sdws": { "name": "山东卫视", "cnlid": "2029787903", "livepid": "600002513", "defn": "fhd" }, "tjws": { "name": "天津卫视", "cnlid": "2019927003", "livepid": "600152137", "defn": "fhd" }, "jlws": { "name": "吉林卫视", "cnlid": "2025561503", "livepid": "600190405", "defn": "fhd" }, "saxws": { "name": "陕西卫视", "cnlid": "2029795103", "livepid": "600190400", "defn": "fhd" }, "nxws": { "name": "宁夏卫视", "cnlid": "2025608503", "livepid": "600190737", "defn": "fhd" }, "nmgws": { "name": "内蒙古卫视", "cnlid": "2025561203", "livepid": "600190401", "defn": "fhd" }, "ynws": { "name": "云南卫视", "cnlid": "2025561303", "livepid": "600190402", "defn": "fhd" }, "shanxiws": { "name": "山西卫视", "cnlid": "2025560803", "livepid": "600190407", "defn": "fhd" }, "gsws": { "name": "甘肃卫视", "cnlid": "2025561703", "livepid": "600190408", "defn": "fhd" }, "qhws": { "name": "青海卫视", "cnlid": "2025559103", "livepid": "600190406", "defn": "fhd" }, "xizangws": { "name": "西藏卫视", "cnlid": "2025558003", "livepid": "600190403", "defn": "fhd" }, "xjws": { "name": "新疆卫视", "cnlid": "2019927403", "livepid": "600152138", "defn": "fhd" }, "cetv1": { "name": "CETV-1", "cnlid": "2022823801", "livepid": "600171827", "defn": "fhd" }, "guoxue": { "name": "国学频道", "cnlid": "2029360403", "livepid": "600213139", "defn": "fhd" } };
const ALIAS_MAP = { "anhuiws": "ahws", "beijingws": "bjws", "cctv16hd": "cctv16", "cctv5plus": "cctv5p", "cctvdiyijuchang": "cctvdyjc", "cctvfengyunjuchang": "cctvfyjc", "cctvhuaijiujuchang": "cctvhjjc", "cgtnalaboyu": "cgtnar", "cgtneyu": "cgtnru", "cgtnfayu": "cgtnfr", "cgtnwaiyujilu": "cgtndoc", "cgtnxibanyayu": "cgtnes", "chongqingws": "cqws", "dongfangws": "dfws", "fujiandongnanws": "dnws", "guangdongws": "gdws", "guangxiws": "gxws", "guizhouws": "gzws", "hebeiws": "hebws", "heilongjiangws": "hljws", "hubeiws": "hbws", "hunanws": "hnws", "jiangsuws": "jsws", "jiangxiws": "jxws", "jilinws": "jlws", "liaoningws": "lnws", "neimengguws": "nmgws", "ningxiaws": "nxws", "qinghaiws": "qhws", "shandongws": "sdws", "shannxiws": "saxws", "shenzhenws": "szws", "sichuanws": "scws", "tianjinws": "tjws", "xinjiangws": "xjws", "yunnanws": "ynws", "zhejiangws": "zjws" };

// 原有的 Wasm 及解析逻辑载入（保持你的 KEYGEN_B64 等不变，此处以整体框架呈现）
// 提示：确保你的 Wasm 模块加载已做全局单例初始化

// 创建 HTTP 服务
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 示例：检查缓存逻辑
    const channelKey = pathname.replace(/^\//, '').toLowerCase();
    const resolvedKey = ALIAS_MAP[channelKey] || channelKey;

    if (CHANNELS[resolvedKey]) {
        const cachedUrl = getCachedToken(resolvedKey);
        if (cachedUrl) {
            // 命中缓存，直接 302 重定向到 CDN，实现毫秒级秒切！
            res.writeHead(302, { 'Location': cachedUrl });
            res.end();
            return;
        }
    }

    // 若未命中缓存，走常规 Wasm 计算与上游请求逻辑，并将结果存入 setCachedToken(resolvedKey, realStreamUrl)
    // ... 原有的路由与请求分发逻辑 ...
});

server.listen(PORT, HOST, () => {
    console.log(`YSP Engine v${VERSION} optimized running at http://${HOST}:${PORT}`);
});