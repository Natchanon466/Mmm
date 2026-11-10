/* Microplastic City: ตรรกะเกมและหน้าจอทั้งหมด (ไม่มี dependency)
 * ส่วนที่ทดสอบได้ใน Node ถูก export ผ่าน module.exports ท้ายไฟล์ */
(function () {
'use strict';
var G = typeof window !== 'undefined' ? window : globalThis;

/* ================= DATA ================= */
var LS_KEY = 'microplastic-city-v1';
var START_MONEY = 1000, START_ENV = 100;

var DEFAULT_PRODUCTS = [
  { id: 'umbrella', name: 'ร่ม', price: 100, env: 0, type: 'reusable', desc: 'ป้องกันค่าใช้จ่ายจากเหตุการณ์ฝนตกหนัก', active: true, builtin: true },
  { id: 'cup', name: 'แก้วน้ำใช้ซ้ำ', price: 100, env: 0, type: 'reusable', desc: 'ป้องกันผลกระทบจากเหตุการณ์เครื่องดื่มบรรจุขวด และรับเงินสนับสนุนจากร้านค้า', active: true, builtin: true },
  { id: 'box', name: 'กล่องอาหารใช้ซ้ำ', price: 150, env: 0, type: 'reusable', desc: 'ป้องกันผลกระทบจากบรรจุภัณฑ์ใช้ครั้งเดียว เช่น อาหารเดลิเวอรี่ และได้ส่วนลดจากร้านอาหาร', active: true, builtin: true },
  { id: 'cleaner', name: 'อุปกรณ์ทำความสะอาด', price: 100, env: 0, type: 'reusable', desc: 'ลดความเสียหายจากเหตุการณ์ขยะกระจาย เช่น พายุและน้ำท่วม', active: true, builtin: true },
  { id: 'bag', name: 'ถุงผ้า', price: 60, env: 0, type: 'reusable', desc: 'ไม่ต้องจ่ายค่าถุงในวันงดแจกถุงพลาสติกและตลาดนัด', active: true, builtin: true },
  { id: 'bin', name: 'ถังคัดแยกขยะ', price: 120, env: 0, type: 'reusable', desc: 'ขายขยะรีไซเคิลได้ และลดความเสียหายจากน้ำท่วมและท่อตัน', active: true, builtin: true },
  { id: 'lottery', name: 'สลากหวย', price: 20, env: 0, type: 'lottery', desc: 'เลือกเลข 0–9 เพื่อเข้าร่วมเหตุการณ์หวยประจำวัน (เลขละ 1 ใบต่อกลุ่ม)', active: true, builtin: true },
  { id: 'bottle', name: 'น้ำดื่มขวดพลาสติก', price: 20, env: -5, type: 'single', desc: 'ถูกและสะดวก แต่ใช้ครั้งเดียวแล้วทิ้ง', active: true, builtin: true },
  { id: 'foam', name: 'อาหารกล่องโฟม', price: 40, env: -5, type: 'single', desc: 'หาซื้อง่าย แต่เป็นขยะที่ย่อยสลายยาก', active: true, builtin: true }
];

var TYPE_LABEL = { reusable: 'ใช้ซ้ำได้', single: 'ใช้ครั้งเดียว', lottery: 'สลาก' };
var CAT_LABEL = { cost: 'เสียเงิน', reward: 'ได้เงิน/รางวัล', item: 'ขึ้นกับสินค้า', all: 'กระทบทุกกลุ่ม', choice: 'เลือกเอง' };
var FALLBACK_TEXT = {
  zero_env: 'จ่ายเท่าที่มี (เงินเหลือ 0) และหัก Environment เพิ่ม 5 คะแนน',
  zero: 'จ่ายเท่าที่มี (เงินเหลือ 0) ไม่มีโทษเพิ่ม'
};

/* ================= STATE ================= */
var S, UI = { entryDraft: null, view: 'dash', marketGroup: 0, hist: 'all', modal: null, storeFail: false, resetScroll: false };

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function pad(n) { return String(n); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function n0(n) { return Number(n).toLocaleString('en-US'); }
function sgn(n) { return n > 0 ? '+' + n0(n) : n < 0 ? '−' + n0(Math.abs(n)) : '0'; }
function randInt(max) {
  try {
    var a = new Uint32Array(1), lim = 4294967296 - (4294967296 % max);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % max;
  } catch (e) { return Math.floor(Math.random() * max); }
}
function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = randInt(i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

function freshGroups(names) {
  var out = [];
  for (var i = 0; i < 5; i++) out.push({ id: i, name: (names && names[i]) || ('กลุ่ม ' + (i + 1)), money: START_MONEY, env: START_ENV, inv: {}, tickets: [] });
  return out;
}
function initialState(keep) {
  return {
    v: 1, started: false, ended: false, round: 1,
    groups: freshGroups(keep && keep.names),
    products: keep ? keep.products : clone(DEFAULT_PRODUCTS),
    settings: keep ? keep.settings : { fallback: 'zero_env', lotteryPrize: 200, moneyCap: 600 },
    eventsOff: keep ? keep.eventsOff : [],
    deck: [], pending: null, lastView: null, lastEvent: null, history: [], nextId: 1
  };
}
function load() {
  try {
    var raw = G.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    var s = JSON.parse(raw);
    return validState(s) ? s : null;
  } catch (e) { return null; }
}
function validState(s) {
  return s && Array.isArray(s.groups) && s.groups.length === 5 && Array.isArray(s.products) && Array.isArray(s.history) && s.settings;
}
function save() {
  try { G.localStorage.setItem(LS_KEY, JSON.stringify(S)); UI.storeFail = false; }
  catch (e) { UI.storeFail = true; }
}
function log(o) { var e = Object.assign({ id: S.nextId++, ts: Date.now(), round: S.round }, o); S.history.push(e); return e; }
function ok(msg) { return { ok: true, msg: msg }; }
function fail(msg) { return { ok: false, msg: msg }; }
function prod(id) { return S.products.find(function (p) { return p.id === id; }); }
function has(g, id) { return (g.inv[id] || 0) > 0; }
function singleCount(g) { return S.products.filter(function (p) { return p.type === 'single'; }).reduce(function (s, p) { return s + (g.inv[p.id] || 0); }, 0); }

/* ================= EVENTS ================= */
function R(m, e, note, tone, extra) {
  m = m || 0; e = e || 0;
  return Object.assign({ m: m, e: e, note: note || '', tone: tone || ((m < 0 || e < 0) ? 'bad' : (m > 0 || e > 0) ? 'good' : 'neutral') }, extra || {});
}
var EVENTS = [
  { id: 'rain', title: 'ฝนตกหนัก', cats: ['cost', 'item'],
    desc: 'ฝนตกหนักทั่วเมือง น้ำท่วมขังตามถนน ใครเตรียมร่มไว้จะเดินทางได้สบาย',
    rule: 'มีร่ม ไม่เสียเงิน · ไม่มีร่ม เสีย 200 บาท',
    learn: 'ของใช้ซ้ำที่เตรียมไว้ช่วยประหยัดเงินเมื่อเกิดเหตุไม่คาดคิด',
    calc: function (g) { return has(g, 'umbrella') ? R(0, 0, 'มีร่ม ไม่เสียเงิน', 'good') : R(-200, 0, 'ไม่มีร่ม ต้องจ่ายค่าเสียหาย'); } },
  { id: 'river', title: 'พบการทิ้งขยะลงแม่น้ำ', cats: ['cost', 'all'],
    desc: 'เจ้าหน้าที่พบการทิ้งขยะลงแม่น้ำกลางเมือง เมืองปรับทุกกลุ่มเท่ากัน',
    rule: 'ทุกกลุ่มเสียค่าปรับ 100 บาท และ Environment −10',
    learn: 'ขยะที่ทิ้งผิดที่กลายเป็นต้นทุนของทุกคนในเมือง',
    calc: function () { return R(-100, -10, 'ถูกปรับตามกติกาของเมือง'); } },
  { id: 'lottery', title: 'หวยประจำวัน', cats: ['reward'], lottery: true,
    desc: 'เมืองจัดหวยประจำวัน ทุกกลุ่มต้องยืนยันเลขก่อน ผู้จัดจึงจะสุ่มเลขรางวัลได้',
    get rule() { return 'เลขตรงรางวัลได้ ' + n0(lotPrize()) + ' บาท · เลขไม่ตรงไม่ได้อะไร · สลากทุกใบหมดอายุหลังจบเหตุการณ์นี้'; },
    learn: 'การเสี่ยงโชคไม่ใช่แผนการเงิน ซื้อเยอะไม่ได้แปลว่าจะได้เยอะ',
    calc: function (g, c) {
      if (c.win == null) return R(0, 0, 'รอสุ่มเลขรางวัล', 'neutral');
      if (g.tickets.indexOf(c.win) >= 0) return R(lotPrize(), 0, 'ถูกรางวัลเลข ' + pad(c.win), 'good');
      return R(0, 0, g.tickets.length ? 'ไม่ถูกรางวัล' : 'ไม่ได้ซื้อสลาก', 'neutral');
    } },
  { id: 'cleanup', title: 'เมืองจัดกิจกรรมเก็บขยะ', cats: ['choice'],
    desc: 'เมืองชวนทุกกลุ่มมาเก็บขยะ ใครอยากร่วมต้องจ่ายค่าอุปกรณ์',
    rule: 'เข้าร่วม: จ่าย 50 บาท ได้ Environment +10 (ไม่เกิน 100) · ไม่เข้าร่วม: ไม่เปลี่ยนแปลง',
    learn: 'ลงมือดูแลสิ่งแวดล้อมต้องใช้เงิน แต่ผลที่ได้อยู่กับทุกคน',
    choice: { yes: 'เข้าร่วม (−50 บาท)', no: 'ไม่เข้าร่วม', can: function (g) { return g.money >= 50 ? { ok: true } : { ok: false, why: 'เงินไม่พอ' }; } },
    calc: function (g, c) { return c.choice === 'yes' ? R(-50, 10, 'เข้าร่วมกิจกรรมเก็บขยะ') : R(0, 0, 'ไม่เข้าร่วม', 'neutral'); } },
  { id: 'storm', title: 'พายุพัดขยะกระจาย', cats: ['all', 'item'],
    desc: 'พายุพัดถังขยะล้ม ขยะกระจายไปทั่วเมือง',
    rule: 'ทุกกลุ่ม Environment −10 · มีอุปกรณ์ทำความสะอาด ได้รับการยกเว้น',
    learn: 'อุปกรณ์ที่พร้อมใช้ช่วยลดความเสียหายก่อนที่ปัญหาจะบานปลาย',
    calc: function (g) { return has(g, 'cleaner') ? R(0, 0, 'มีอุปกรณ์ทำความสะอาด จึงได้รับการยกเว้น', 'good') : R(0, -10, 'ไม่มีอุปกรณ์ทำความสะอาด'); } },
  { id: 'reuseshop', title: 'ร้านค้าส่งเสริมการใช้ซ้ำ', cats: ['reward', 'item'],
    desc: 'ร้านค้าในเมืองมอบเงินสนับสนุนให้คนที่พกแก้วน้ำมาเอง',
    rule: 'มีแก้วน้ำใช้ซ้ำ ได้รับเงินสนับสนุน 50 บาท',
    learn: 'การใช้ซ้ำช่วยลดขยะ และบางครั้งช่วยประหยัดเงินด้วย',
    calc: function (g) { return has(g, 'cup') ? R(50, 0, 'มีแก้วน้ำใช้ซ้ำ', 'good') : R(0, 0, 'ไม่มีแก้วน้ำใช้ซ้ำ', 'neutral'); } },
  { id: 'bottlefest', title: 'เทศกาลน้ำดื่มบรรจุขวด', cats: ['cost', 'item', 'all'],
    desc: 'ร้านค้าลดราคาเครื่องดื่มบรรจุขวด ขวดพลาสติกกองเต็มถังขยะทั่วเมือง',
    rule: 'มีแก้วน้ำใช้ซ้ำ ยกเว้น · ไม่มี เสีย 30 บาท และ Environment −8',
    learn: 'ของถูกที่ใช้ครั้งเดียวมีต้นทุนต่อสิ่งแวดล้อมที่มองไม่เห็นในราคา',
    calc: function (g) { return has(g, 'cup') ? R(0, 0, 'ใช้แก้วน้ำของตัวเอง', 'good') : R(-30, -8, 'ต้องซื้อน้ำขวดพลาสติก'); } },
  { id: 'delivery', title: 'วันสั่งอาหารเดลิเวอรี่', cats: ['cost', 'item', 'all'],
    desc: 'ทั้งเมืองสั่งอาหารมากินที่บ้าน ภาชนะใช้ครั้งเดียวล้นถังขยะ',
    rule: 'มีกล่องอาหารใช้ซ้ำ ยกเว้น · ไม่มี เสีย 40 บาท และ Environment −8',
    learn: 'ความสะดวกครั้งเดียวจบ แต่ขยะอยู่ได้นานหลายปี',
    calc: function (g) { return has(g, 'box') ? R(0, 0, 'ใช้กล่องอาหารของตัวเอง', 'good') : R(-40, -8, 'ต้องใช้ภาชนะใช้ครั้งเดียว'); } },
  { id: 'fish', title: 'พบไมโครพลาสติกในปลาทะเล', cats: ['all', 'item'],
    desc: 'ผลตรวจพบเศษพลาสติกชิ้นเล็กในปลาที่ขายในตลาด ผลกระทบขึ้นกับจำนวนของใช้ครั้งเดียวที่กลุ่มซื้อไว้',
    rule: 'ไม่เคยซื้อของใช้ครั้งเดียว ยกเว้น · ซื้อ 1–2 ชิ้น Environment −5 · ซื้อ 3 ชิ้นขึ้นไป Environment −10',
    learn: 'พลาสติกที่เราทิ้งอาจกลับมาอยู่ในอาหารของเราเอง',
    calc: function (g) {
      var n = singleCount(g);
      if (n === 0) return R(0, 0, 'ยังไม่ซื้อของใช้ครั้งเดียว จึงได้รับการยกเว้น', 'good');
      return n >= 3 ? R(0, -10, 'ซื้อของใช้ครั้งเดียวไป ' + n + ' ชิ้น') : R(0, -5, 'ซื้อของใช้ครั้งเดียวไป ' + n + ' ชิ้น');
    } },
  { id: 'plasticfee', title: 'ค่าธรรมเนียมบรรจุภัณฑ์พลาสติก', cats: ['cost', 'item'],
    desc: 'เมืองเริ่มเก็บค่าธรรมเนียมจากของใช้ครั้งเดียวที่ซื้อไว้',
    rule: 'ชิ้นละ 10 บาท (สูงสุด 80 บาท) · ไม่เคยซื้อของใช้ครั้งเดียว ไม่เสีย',
    learn: 'ราคาที่แท้จริงของของใช้ครั้งเดียวสูงกว่าราคาหน้าร้าน',
    calc: function (g) { var n = singleCount(g); return n === 0 ? R(0, 0, 'ไม่มีของใช้ครั้งเดียว ไม่เสียค่าธรรมเนียม', 'good') : R(-10 * Math.min(n, 8), 0, 'ของใช้ครั้งเดียว ' + n + ' ชิ้น'); } },
  { id: 'recyclebank', title: 'ธนาคารขยะรับซื้อวัสดุรีไซเคิล', cats: ['reward', 'item'],
    desc: 'ธนาคารขยะเปิดรับซื้อขวดและกระดาษที่คัดแยกแล้ว',
    rule: 'มีถังคัดแยกขยะ ได้ 100 บาท และ Environment +5',
    learn: 'ขยะที่คัดแยกดีสร้างรายได้ได้',
    calc: function (g) { return has(g, 'bin') ? R(100, 5, 'ขายวัสดุรีไซเคิลที่คัดแยกไว้', 'good') : R(0, 0, 'ไม่มีถังคัดแยกขยะ', 'neutral'); } },
  { id: 'bagfree', title: 'วันงดแจกถุงพลาสติก', cats: ['cost', 'item'],
    desc: 'ห้างและตลาดงดแจกถุงพลาสติก ลูกค้าต้องซื้อถุงหรือเตรียมมาเอง',
    rule: 'มีถุงผ้า ยกเว้น · ไม่มี เสีย 30 บาท และ Environment −3',
    learn: 'ถุงผ้าใบเดียวใช้ได้หลายร้อยครั้ง',
    calc: function (g) { return has(g, 'bag') ? R(0, 0, 'พกถุงผ้ามาเอง', 'good') : R(-30, -3, 'ต้องซื้อถุงและใช้ถุงใหม่'); } },
  { id: 'sponsor', title: 'ผู้สนับสนุนใจดี', cats: ['reward', 'all'],
    desc: 'บริษัทในเมืองมอบทุนสนับสนุนให้ทุกกลุ่มเท่ากัน',
    rule: 'ทุกกลุ่มได้รับเงิน 100 บาท',
    learn: 'เงินก้อนที่ไม่คาดคิดควรเก็บไว้เป็นเงินสำรอง',
    calc: function () { return R(100, 0, 'ได้รับทุนสนับสนุน'); } },
  { id: 'cleancity', title: 'รางวัลเมืองสะอาด', cats: ['reward'],
    desc: 'เมืองมอบรางวัลให้กลุ่มที่ดูแลสิ่งแวดล้อมได้ดีที่สุด',
    rule: 'กลุ่มที่ Environment สูงสุดได้ 100 บาท (ถ้าเท่ากัน ได้ทุกกลุ่มที่สูงสุด)',
    learn: 'การดูแลสิ่งแวดล้อมให้ผลตอบแทนระยะยาว',
    calc: function (g, c) {
      var mx = Math.max.apply(null, c.groups.map(function (x) { return x.env; }));
      return g.env === mx ? R(100, 0, 'Environment สูงสุดของเมือง (' + g.env + ')', 'good') : R(0, 0, 'Environment ไม่ใช่อันดับสูงสุด', 'neutral');
    } },
  { id: 'fund', title: 'กองทุนช่วยเหลือชุมชน', cats: ['reward'],
    desc: 'กองทุนของเมืองช่วยกลุ่มที่เงินเหลือน้อยที่สุดตอนนี้',
    rule: 'กลุ่มที่มีเงินน้อยที่สุดได้ 100 บาท (ถ้าเท่ากัน ได้ทุกกลุ่มที่น้อยที่สุด)',
    learn: 'ชุมชนที่ช่วยเหลือกันทำให้ทุกคนผ่านวิกฤตได้',
    calc: function (g, c) {
      var mn = Math.min.apply(null, c.groups.map(function (x) { return x.money; }));
      return g.money === mn ? R(100, 0, 'มีเงินน้อยที่สุด (' + n0(g.money) + ' บาท)', 'good') : R(0, 0, 'มีเงินมากกว่ากลุ่มที่น้อยที่สุด', 'neutral');
    } },
  { id: 'flood', title: 'น้ำท่วมขยะลอยเต็มถนน', cats: ['all', 'item'],
    desc: 'น้ำท่วมพัดขยะลอยเต็มถนน ความเสียหายลดลงถ้าเตรียมอุปกรณ์และคัดแยกขยะไว้',
    rule: 'ทุกกลุ่ม Environment −15 · มีอุปกรณ์ทำความสะอาด ลดโทษ 7 · มีถังคัดแยกขยะ ลดโทษ 7',
    learn: 'การเตรียมหลายอย่างพร้อมกันลดความเสียหายได้มาก',
    calc: function (g) {
      var e = -15, parts = [];
      if (has(g, 'cleaner')) { e += 7; parts.push('มีอุปกรณ์ทำความสะอาด'); }
      if (has(g, 'bin')) { e += 7; parts.push('มีถังคัดแยกขยะ'); }
      return R(0, e, parts.length ? parts.join(' + ') + ' ช่วยลดความเสียหาย' : 'ไม่ได้เตรียมอะไรไว้');
    } },
  { id: 'beach', title: 'อาสาสมัครล้างชายหาด', cats: ['choice', 'item'],
    desc: 'เมืองชวนกลุ่มที่มีอุปกรณ์ทำความสะอาดไปล้างชายหาด อุปกรณ์จะสึกหรอจนใช้ต่อไม่ได้หลังงาน',
    rule: 'เข้าร่วม: ใช้อุปกรณ์ทำความสะอาด 1 ชิ้นจนหมดสภาพ ได้ Environment +20 · ต้องมีอุปกรณ์จึงเข้าร่วมได้',
    learn: 'บางครั้งต้องยอมเสียของที่มี เพื่อสร้างประโยชน์ให้ส่วนรวม',
    choice: { yes: 'เข้าร่วม (ใช้อุปกรณ์ 1 ชิ้น)', no: 'ไม่เข้าร่วม', can: function (g) { return has(g, 'cleaner') ? { ok: true } : { ok: false, why: 'ไม่มีอุปกรณ์' }; } },
    calc: function (g, c) { return c.choice === 'yes' ? R(0, 20, 'ใช้อุปกรณ์ทำความสะอาดจนหมดสภาพ 1 ชิ้น', 'good', { use: { cleaner: 1 } }) : R(0, 0, has(g, 'cleaner') ? 'ไม่เข้าร่วม' : 'ไม่มีอุปกรณ์ทำความสะอาด', 'neutral'); } },
  { id: 'donate', title: 'บริจาคเพื่อทะเลสะอาด', cats: ['choice'],
    desc: 'มูลนิธิรับบริจาคเพื่อติดตั้งตาข่ายดักขยะที่ปากแม่น้ำ',
    rule: 'บริจาค: จ่าย 100 บาท ได้ Environment +15 (ไม่เกิน 100) · ไม่บริจาค: ไม่เปลี่ยนแปลง',
    learn: 'ต้องชั่งใจระหว่างเงินที่มีกับผลดีต่อสิ่งแวดล้อม',
    choice: { yes: 'บริจาค (−100 บาท)', no: 'ไม่บริจาค', can: function (g) { return g.money >= 100 ? { ok: true } : { ok: false, why: 'เงินไม่พอ' }; } },
    calc: function (g, c) { return c.choice === 'yes' ? R(-100, 15, 'บริจาคให้มูลนิธิ') : R(0, 0, 'ไม่บริจาค', 'neutral'); } },
  { id: 'market', title: 'ตลาดนัดริมคลอง', cats: ['choice', 'item'],
    desc: 'ซื้อของที่ตลาดนัด ต้องเลือกว่าจะใส่ของในถุงพลาสติกฟรี หรือใช้ถุงที่ไม่ทำร้ายคลอง',
    rule: 'ถุงพลาสติก: ฟรี แต่ Environment −8 · ถุงผ้า/กระดาษ: จ่าย 40 บาท ไม่เสีย Environment (มีถุงผ้าแล้วใช้ฟรี)',
    learn: 'ตัวเลือกที่ถูกที่สุดตอนนี้ อาจแพงที่สุดในระยะยาว',
    choice: { yes: 'ใช้ถุงผ้า/กระดาษ', no: 'ใช้ถุงพลาสติก (ฟรี)', can: function (g) { return (has(g, 'bag') || g.money >= 40) ? { ok: true } : { ok: false, why: 'เงินไม่พอ' }; } },
    calc: function (g, c) {
      if (c.choice === 'yes') return has(g, 'bag') ? R(0, 0, 'ใช้ถุงผ้าที่มีอยู่ ไม่เสียเงิน', 'good') : R(-40, 0, 'ซื้อถุงกระดาษ');
      return R(0, -8, 'ใช้ถุงพลาสติก');
    } },
  { id: 'foodbox', title: 'ร้านอาหารลดราคาให้คนนำภาชนะมาเอง', cats: ['reward', 'item'],
    desc: 'ร้านอาหารในเมืองให้ส่วนลดกับลูกค้าที่นำกล่องหรือแก้วมาเอง',
    rule: 'มีกล่องอาหารใช้ซ้ำ ได้ 60 บาท · มีแก้วน้ำใช้ซ้ำ ได้ 20 บาท (ได้ทั้งสองถ้ามีทั้งคู่)',
    learn: 'สินค้าใช้ซ้ำคุ้มค่าขึ้นเรื่อย ๆ ยิ่งใช้บ่อย',
    calc: function (g) {
      var m = 0, p = [];
      if (has(g, 'box')) { m += 60; p.push('กล่องอาหาร +60'); }
      if (has(g, 'cup')) { m += 20; p.push('แก้วน้ำ +20'); }
      return m ? R(m, 0, p.join(' · '), 'good') : R(0, 0, 'ไม่ได้นำภาชนะมาเอง', 'neutral');
    } },
  { id: 'drain', title: 'ท่อระบายน้ำอุดตัน', cats: ['cost', 'item', 'all'],
    desc: 'ท่อระบายน้ำอุดตันเพราะขยะพลาสติก ทุกกลุ่มต้องร่วมจ่ายค่าซ่อม',
    rule: 'ทุกกลุ่มจ่าย 60 บาท · มีถังคัดแยกขยะ จ่ายครึ่งเดียว (30 บาท)',
    learn: 'การคัดแยกขยะตั้งแต่ต้นทางช่วยลดต้นทุนของเมือง',
    calc: function (g) { return has(g, 'bin') ? R(-30, 0, 'มีถังคัดแยกขยะ จ่ายครึ่งเดียว') : R(-60, 0, 'ร่วมจ่ายค่าซ่อมเต็มจำนวน'); } }
];
function moneyCap() { var c = S && S.settings && S.settings.moneyCap; return Number.isInteger(c) && c >= 100 ? c : 600; }
function lotPrize() { return S && S.settings && Number.isInteger(S.settings.lotteryPrize) ? S.settings.lotteryPrize : 200; }
var EV = {}; EVENTS.forEach(function (e) { EV[e.id] = e; });

/* ================= GAME LOGIC ================= */
function buyProduct(gid, pid, opts) {
  opts = opts || {};
  if (!S.started) return fail('ยังไม่ได้เริ่มเกม');
  if (S.ended) return fail('จบเกมแล้ว ซื้อสินค้าไม่ได้');
  if (S.pending) return fail('มีเหตุการณ์รอยืนยันอยู่ ยังซื้อสินค้าไม่ได้');
  var g = S.groups[gid], p = prod(pid);
  if (!g || !p || !p.active) return fail('ไม่พบสินค้านี้');
  var num = null;
  if (p.type === 'lottery') {
    num = opts.number;
    if (!Number.isInteger(num) || num < 0 || num > 9) return fail('เลขต้องอยู่ระหว่าง 0–9');
    if (g.tickets.indexOf(num) >= 0) return fail('กลุ่มนี้ซื้อเลข ' + pad(num) + ' ไปแล้ว');
  }
  if (g.money < p.price) return fail(g.name + ' มีเงินไม่พอ (ขาด ' + n0(p.price - g.money) + ' บาท)');
  g.money -= p.price;
  g.env = clamp(g.env + p.env, 0, 100);
  if (p.type === 'lottery') { g.tickets.push(num); g.tickets.sort(function (a, b) { return a - b; }); }
  else g.inv[p.id] = (g.inv[p.id] || 0) + 1;
  log({ type: 'buy', gid: gid, text: g.name + ' ซื้อ ' + p.name + (num != null ? ' เลข ' + pad(num) : ''), m: -p.price, e: p.env });
  return ok(g.name + ' ซื้อ ' + p.name + (num != null ? ' เลข ' + pad(num) : '') + ' แล้ว');
}

function adjustValue(gid, kind, delta, reason) {
  var g = S.groups[gid];
  if (!g || (kind !== 'money' && kind !== 'env')) return fail('ข้อมูลไม่ถูกต้อง');
  if (!Number.isInteger(delta) || delta === 0) return fail('ใส่จำนวนเต็มที่ไม่ใช่ 0');
  if (kind === 'money') {
    if (g.money + delta < 0) return fail('เงินจะติดลบไม่ได้ (กลุ่มนี้มี ' + n0(g.money) + ' บาท)');
    g.money += delta;
  } else {
    g.env = clamp(g.env + delta, 0, 100);
  }
  log({ type: 'manual', gid: gid, text: 'ผู้จัดปรับ' + (kind === 'money' ? 'เงิน' : ' Environment') + ' ' + g.name + ' ' + sgn(delta) + (reason ? ' (' + reason + ')' : ''), m: kind === 'money' ? delta : 0, e: kind === 'env' ? delta : 0 });
  return ok('ปรับค่าเรียบร้อย');
}

function drawEvent(forceId) {
  if (!S.started) return fail('ยังไม่ได้เริ่มเกม');
  if (S.ended) return fail('จบเกมแล้ว');
  if (S.pending) return fail('มีเหตุการณ์รอยืนยันอยู่');
  var id;
  if (forceId) {
    if (!EV[forceId]) return fail('ไม่พบเหตุการณ์');
    id = forceId;
  } else {
    var enabled = EVENTS.filter(function (e) { return S.eventsOff.indexOf(e.id) < 0; }).map(function (e) { return e.id; });
    if (!enabled.length) return fail('ปิดเหตุการณ์ครบทุกอัน เปิดอย่างน้อย 1 อันในหน้าตั้งค่า');
    S.deck = S.deck.filter(function (x) { return enabled.indexOf(x) >= 0; });
    if (!S.deck.length) S.deck = shuffle(enabled.slice());
    id = S.deck.pop();
  }
  S.pending = { eventId: id, choices: {}, locked: {}, win: null, manual: !!forceId };
  return ok('สุ่มได้: ' + EV[id].title);
}

function cancelPending() {
  var p = S.pending;
  if (!p) return fail('ไม่มีเหตุการณ์ค้างอยู่');
  if (p.win != null) return fail('สุ่มเลขรางวัลแล้ว ยกเลิกไม่ได้ ให้ยืนยันผลแทน (ใช้ Undo ได้หากผิดพลาด)');
  if (!p.manual) S.deck.splice(randInt(S.deck.length + 1), 0, p.eventId);
  S.pending = null;
  return ok('ยกเลิกเหตุการณ์แล้ว ยังไม่มีการเปลี่ยนค่าใด ๆ');
}

function setChoice(gid, val) {
  var p = S.pending; if (!p || !EV[p.eventId].choice) return fail('เหตุการณ์นี้ไม่มีตัวเลือก');
  var g = S.groups[gid]; if (!g) return fail('ไม่พบกลุ่ม');
  if (val === 'yes') { var c = EV[p.eventId].choice.can(g); if (!c.ok) return fail(g.name + ' เลือกไม่ได้: ' + c.why); }
  p.choices[gid] = val === 'yes' ? 'yes' : 'no';
  return ok('');
}
function lockTickets(gid) {
  var p = S.pending; if (!p || !EV[p.eventId].lottery) return fail('ไม่ใช่เหตุการณ์หวย');
  if (p.win != null) return fail('สุ่มเลขแล้ว');
  p.locked[gid] = true; return ok('');
}
function drawWinning() {
  var p = S.pending; if (!p || !EV[p.eventId].lottery) return fail('ไม่ใช่เหตุการณ์หวย');
  if (p.win != null) return fail('สุ่มเลขรางวัลไปแล้ว');
  var notLocked = S.groups.filter(function (g) { return !p.locked[g.id]; });
  if (notLocked.length) return fail('ต้องให้ทุกกลุ่มยืนยันเลขก่อน (ยังขาด ' + notLocked.map(function (g) { return g.name; }).join(', ') + ')');
  p.win = randInt(10);
  return ok('เลขรางวัลคือ ' + pad(p.win));
}

function computePreview() {
  var p = S.pending; if (!p) return [];
  var ev = EV[p.eventId];
  return S.groups.map(function (g) {
    var choice = p.choices[g.id] || 'no';
    if (ev.choice && !ev.choice.can(g).ok) choice = 'no';
    var r = ev.calc(g, { choice: choice, win: p.win, groups: S.groups });
    var use = {};
    if (r.use) for (var k in r.use) { var n = Math.min(r.use[k], g.inv[k] || 0); if (n > 0) use[k] = n; }
    var nm = g.money + r.m, short = 0, extraE = 0;
    if (nm < 0) { short = -nm; nm = 0; if (S.settings.fallback === 'zero_env') extraE = -5; }
    var rawE = g.env + r.e + extraE, ne = clamp(rawE, 0, 100);
    return { gid: g.id, name: g.name, choice: choice, note: r.note, tone: r.tone, m: r.m, e: r.e, short: short, extraE: extraE, use: use,
      oldMoney: g.money, oldEnv: g.env, newMoney: nm, newEnv: ne, dM: nm - g.money, dE: ne - g.env, capped: rawE > 100, tickets: g.tickets.slice() };
  });
}

function canConfirm() { var p = S.pending; if (!p) return false; var ev = EV[p.eventId]; return !(ev.lottery && p.win == null); }

function confirmEvent() {
  var p = S.pending;
  if (!p) return fail('ไม่มีเหตุการณ์ค้างอยู่ (อาจยืนยันไปแล้ว)');
  if (!canConfirm()) return fail('ต้องสุ่มเลขรางวัลก่อน');
  var ev = EV[p.eventId], rows = computePreview();
  var snapshot = { groups: clone(S.groups), deck: clone(S.deck), round: S.round, lastView: clone(S.lastView) };
  rows.forEach(function (r) {
    var g = S.groups[r.gid];
    g.money = r.newMoney; g.env = r.newEnv;
    for (var k in r.use) g.inv[k] = Math.max(0, (g.inv[k] || 0) - r.use[k]);
    if (ev.lottery) g.tickets = [];
  });
  var results = rows.map(function (r) { return { gid: r.gid, name: r.name, dM: r.dM, dE: r.dE, note: r.note + (r.short ? ' · เงินไม่พอ ขาด ' + n0(r.short) + ' บาท' + (r.extraE ? ' (หัก Environment เพิ่ม ' + Math.abs(r.extraE) + ')' : '') : ''), tone: r.tone, short: r.short }; });
  var entry = log({ type: 'event', eventId: ev.id, title: ev.title, win: p.win, results: results });
  S.lastView = { title: ev.title, desc: ev.desc, rule: ev.rule, learn: ev.learn, round: S.round, win: p.win, results: results, cats: ev.cats };
  S.lastEvent = { entryId: entry.id, snapshot: snapshot };
  S.round++; S.pending = null;
  return ok('ยืนยันผล "' + ev.title + '" แล้ว');
}

function canUndo() {
  if (!S.lastEvent || S.pending || S.ended) return false;
  var h = S.history; return h.length > 0 && h[h.length - 1].id === S.lastEvent.entryId;
}
function undoEvent() {
  if (!canUndo()) return fail('ย้อนกลับไม่ได้ เพราะมีรายการอื่นเกิดขึ้นหลังเหตุการณ์ล่าสุดแล้ว');
  var snap = S.lastEvent.snapshot, ent = S.history.filter(function (h) { return h.id === S.lastEvent.entryId; })[0];
  S.groups = clone(snap.groups); S.deck = clone(snap.deck); S.round = snap.round; S.lastView = snap.lastView;
  ent.undone = true; S.lastEvent = null;
  log({ type: 'system', text: 'ย้อนกลับผลเหตุการณ์ "' + ent.title + '" คืนค่าเงิน Environment และสินค้าของทุกกลุ่ม' });
  return ok('ย้อนกลับเรียบร้อย');
}

function entryDiff(data) {
  var rows = [];
  data.forEach(function (d) {
    var g = S.groups[d.gid]; if (!g) return;
    var c = { gid: d.gid, name: g.name, money: [g.money, d.money], env: [g.env, d.env], inv: [], addT: [], remT: [] };
    S.products.forEach(function (p) {
      if (p.type === 'lottery') return;
      var o = g.inv[p.id] || 0, n = d.inv[p.id] || 0;
      if (o !== n) c.inv.push({ id: p.id, name: p.name, o: o, n: n });
    });
    d.tickets.forEach(function (t) { if (g.tickets.indexOf(t) < 0) c.addT.push(t); });
    g.tickets.forEach(function (t) { if (d.tickets.indexOf(t) < 0) c.remT.push(t); });
    if (g.money !== d.money || g.env !== d.env || c.inv.length || c.addT.length || c.remT.length) rows.push(c);
  });
  return rows;
}
function applyEntry(data) {
  var rows = entryDiff(data);
  if (!rows.length) return fail('ไม่มีการเปลี่ยนแปลง');
  for (var i = 0; i < data.length; i++) {
    var d0 = data[i];
    if (!Number.isInteger(d0.money) || d0.money < 0 || !Number.isInteger(d0.env) || d0.env < 0 || d0.env > 100) return fail('ค่าไม่ถูกต้อง');
  }
  var p = S.pending, isLot = p && EV[p.eventId].lottery;
  if (isLot && p.win != null && rows.some(function (c) { return c.addT.length || c.remT.length; })) return fail('สุ่มเลขรางวัลแล้ว แก้เลขหวยไม่ได้');
  rows.forEach(function (c) {
    var g = S.groups[c.gid], d = data.filter(function (x) { return x.gid === c.gid; })[0], bits = [];
    if (c.money[0] !== c.money[1]) bits.push('เงิน ' + n0(c.money[0]) + ' → ' + n0(c.money[1]));
    if (c.env[0] !== c.env[1]) bits.push('Environment ' + c.env[0] + ' → ' + c.env[1]);
    g.money = d.money; g.env = d.env;
    c.inv.forEach(function (x) { bits.push(x.name + ' ' + x.o + ' → ' + x.n); if (x.n > 0) g.inv[x.id] = x.n; else delete g.inv[x.id]; });
    if (c.addT.length || c.remT.length) {
      g.tickets = d.tickets.slice().sort(function (a, b) { return a - b; });
      bits.push('เลขหวย ' + (g.tickets.length ? g.tickets.join(',') : 'ไม่มี'));
      if (isLot) delete p.locked[c.gid];
    }
    log({ type: 'manual', gid: c.gid, text: 'ผู้จัดบันทึกข้อมูล ' + g.name + ': ' + bits.join(' · '), m: c.money[1] - c.money[0], e: c.env[1] - c.env[0] });
  });
  return ok('บันทึกข้อมูล ' + rows.length + ' กลุ่มแล้ว');
}
function readEntry() {
  var data = [];
  for (var i = 0; i < S.groups.length; i++) {
    var g = S.groups[i], mEl = document.getElementById('en-m-' + i), eEl = document.getElementById('en-e-' + i);
    if (!mEl || !eEl) return { ok: false, msg: 'ไม่พบช่องกรอก ลองเปิดหน้านี้ใหม่' };
    var mv = mEl.value.trim(), ev = eEl.value.trim(), m = Number(mv), e = Number(ev);
    if (mv === '' || !Number.isInteger(m) || m < 0 || m > 100000) return { ok: false, msg: g.name + ': เงินต้องเป็นจำนวนเต็ม 0–100,000' };
    if (ev === '' || !Number.isInteger(e) || e < 0 || e > 100) return { ok: false, msg: g.name + ': Environment ต้องเป็นจำนวนเต็ม 0–100' };
    var inv = {};
    for (var j = 0; j < S.products.length; j++) {
      var pr = S.products[j]; if (pr.type === 'lottery') continue;
      var el = document.getElementById('en-p-' + i + '-' + pr.id); if (!el) continue;
      var cv = el.value.trim(), c = cv === '' ? 0 : Number(cv);
      if (!Number.isInteger(c) || c < 0 || c > 99) return { ok: false, msg: g.name + ': จำนวน' + pr.name + 'ต้องเป็นจำนวนเต็ม 0–99' };
      if (c > 0) inv[pr.id] = c;
    }
    var tk = [];
    for (var n = 0; n < 10; n++) { var t = document.getElementById('en-t-' + i + '-' + n); if (t && t.checked) tk.push(n); }
    data.push({ gid: i, money: m, env: e, inv: inv, tickets: tk });
  }
  return { ok: true, data: data };
}

function startGame() {
  if (S.started) return fail('เริ่มเกมไปแล้ว');
  S.started = true; log({ type: 'system', text: 'เริ่มเกม' });
  return ok('เริ่มเกมแล้ว');
}
function endGame() {
  if (!S.started || S.ended) return fail('ยังจบเกมไม่ได้');
  if (S.pending) return fail('มีเหตุการณ์ค้างอยู่ ให้ยืนยันหรือยกเลิกก่อนจบเกม');
  S.ended = true; log({ type: 'system', text: 'จบเกมและคำนวณคะแนน' });
  return ok('จบเกมแล้ว');
}
function resumeGame() { if (!S.ended) return fail('เกมยังไม่จบ'); S.ended = false; log({ type: 'system', text: 'เปิดเกมต่อหลังจบเกม' }); return ok('เปิดเกมต่อแล้ว'); }
function resetGame(full) {
  var keep = full ? null : { names: S.groups.map(function (g) { return g.name; }), products: S.products, settings: S.settings, eventsOff: S.eventsOff };
  S = initialState(keep);
  return ok('รีเซ็ตเกมแล้ว');
}

function scoreboard() {
  var rows = S.groups.map(function (g) {
    var cap = moneyCap(), capped = Math.min(g.money, cap);
    return { g: g, key: 100 * capped + cap * g.env, mScore: capped * 50 / cap, eScore: g.env / 2, total: capped * 50 / cap + g.env / 2 };
  });
  function better(a, b) { return a.key > b.key || (a.key === b.key && a.g.env > b.g.env); }
  rows.forEach(function (r) { r.rank = 1 + rows.filter(function (o) { return better(o, r); }).length; });
  rows.sort(function (a, b) { return a.rank - b.rank || a.g.id - b.g.id; });
  rows.forEach(function (r) { r.tied = rows.some(function (o) { return o !== r && o.rank === r.rank; }); });
  return rows;
}
function fmtScore(x) { return (Math.round(x * 100) / 100).toString(); }
function reasonText(r) {
  var g = r.g, bits = [];
  var cap = moneyCap();
  if (g.money >= cap) bits.push('เหลือเงิน ' + n0(g.money) + ' บาท ถึงเกณฑ์คะแนนเงินเต็ม');
  else if (g.money >= cap * 0.7) bits.push('เหลือเงิน ' + n0(g.money) + ' บาท ใกล้เกณฑ์คะแนนเงินเต็ม');
  else if (g.money >= cap * 0.4) bits.push('ใช้จ่ายค่อนข้างมาก เหลือเงิน ' + n0(g.money) + ' บาท');
  else bits.push('ใช้จ่ายมากจนเงินเหลือน้อย ' + n0(g.money) + ' บาท');
  if (g.env >= 90) bits.push('ดูแลสิ่งแวดล้อมได้ดีเยี่ยม (' + g.env + ')');
  else if (g.env >= 70) bits.push('ดูแลสิ่งแวดล้อมได้ดี (' + g.env + ')');
  else if (g.env >= 40) bits.push('Environment อยู่ระดับกลาง (' + g.env + ')');
  else bits.push('Environment ต่ำ (' + g.env + ') ควรลดของใช้ครั้งเดียว');
  var reuse = S.products.filter(function (p) { return p.type === 'reusable'; }).reduce(function (s, p) { return s + (g.inv[p.id] || 0); }, 0);
  var single = singleCount(g);
  bits.push('มีของใช้ซ้ำ ' + reuse + ' ชิ้น ซื้อของใช้ครั้งเดียว ' + single + ' ชิ้น');
  var t = bits.join(' · ');
  if (r.tied) t += ' · คะแนนเท่ากับกลุ่มอื่น' + (r.rank === 1 ? ' และ Environment เท่ากัน จึงเสมอ' : '');
  return t;
}

/* ================= UI HELPERS ================= */
var lastKey = '', lastAt = 0;
function guard(key) { var t = Date.now(); if (key === lastKey && t - lastAt < 800) return false; lastKey = key; lastAt = t; return true; }
function toast(msg, kind) {
  if (!msg) return;
  try {
    var box = document.getElementById('toasts'), d = document.createElement('div');
    d.className = 'toast' + (kind === 'err' ? ' err' : ''); d.textContent = msg; box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, kind === 'err' ? 5000 : 3200);
  } catch (e) {}
}
function result(r) { if (r && r.msg) toast(r.msg, r.ok ? 'ok' : 'err'); return r; }

function shape(i) { return '<span class="shape s' + i + '" aria-hidden="true"><b>' + (i + 1) + '</b></span>'; }
function envCls(e) { return e >= 60 ? '' : e >= 30 ? 'mid' : 'low'; }
function bar(e) { return '<div class="bar ' + envCls(e) + '" role="img" aria-label="Environment ' + e + ' จาก 100"><i style="width:' + e + '%"></i></div>'; }
function ring(e) {
  var c = 2 * Math.PI * 42, off = c * (1 - e / 100);
  return '<div class="ring ' + envCls(e) + '" role="img" aria-label="Environment ' + e + ' จาก 100"><svg viewBox="0 0 100 100"><circle class="tr" cx="50" cy="50" r="42" fill="none" stroke-width="11"/><circle class="fg" cx="50" cy="50" r="42" fill="none" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><div class="ct"><div><b>' + e + '</b><small>Environment</small></div></div></div>';
}
function invChips(g) {
  var out = [];
  S.products.forEach(function (p) {
    var c = g.inv[p.id]; if (c > 0) out.push('<span class="chip ' + (p.type === 'single' ? 'chip-single' : 'chip-item') + '">' + esc(p.name) + (c > 1 ? ' ×' + c : '') + '</span>');
  });
  g.tickets.forEach(function (n) { out.push('<span class="chip chip-tk">สลาก ' + pad(n) + '</span>'); });
  return out.length ? out.join('') : '<span class="muted">ยังไม่มีสินค้า</span>';
}
function dchip(v, kind) { return v === 0 ? '' : '<span class="dl ' + (v > 0 ? 'up ' + kind : 'dn') + '">' + sgn(v) + '</span>'; }
function catChips(ev) { return ev.cats.map(function (c) { return '<span class="cat">' + CAT_LABEL[c] + '</span>'; }).join(' '); }
function fbText() { return FALLBACK_TEXT[S.settings.fallback] || FALLBACK_TEXT.zero_env; }
function timeStr(ts) { try { return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

/* ================= VIEWS ================= */
function header() {
  var status = !S.started ? 'ยังไม่เริ่มเกม' : S.ended ? 'จบเกมแล้ว' : 'กำลังเล่น';
  var tabs = [['dash', 'ผู้จัด'], ['entry', 'บันทึกข้อมูล'], ['market', 'ตลาด'], ['player', 'จอผู้เล่น'], ['history', 'ประวัติ'], ['settings', 'สินค้าและตั้งค่า']];
  if (S.ended) tabs.push(['results', 'สรุปผล']);
  var specks = '';
  [[6, 30, 0, 5], [14, 70, 3, 3], [22, 20, 6, 4], [33, 62, 2, 6], [47, 28, 8, 3], [58, 72, 5, 4], [66, 18, 1, 5], [75, 55, 9, 3], [84, 30, 4, 6], [92, 68, 7, 4]].forEach(function (s) {
    specks += '<span style="--x:' + s[0] + '%;--y:' + s[1] + '%;--d:-' + s[2] + 's;--s:' + s[3] + 'px"></span>';
  });
  var sky = '<svg class="sky" viewBox="0 0 640 120" preserveAspectRatio="xMaxYMax meet" aria-hidden="true"><g fill="currentColor"><rect x="0" y="70" width="48" height="50"/><rect x="54" y="38" width="40" height="82"/><rect x="100" y="60" width="34" height="60"/><rect x="140" y="20" width="46" height="100"/><rect x="192" y="52" width="30" height="68"/><rect x="228" y="76" width="52" height="44"/><rect x="286" y="30" width="38" height="90"/><rect x="330" y="58" width="44" height="62"/><rect x="380" y="12" width="36" height="108"/><rect x="422" y="64" width="40" height="56"/><rect x="468" y="40" width="50" height="80"/><rect x="524" y="72" width="34" height="48"/><rect x="564" y="28" width="42" height="92"/><rect x="612" y="56" width="28" height="64"/></g></svg>';
  return '<header class="hdr"><div class="mps" aria-hidden="true">' + specks + '</div>' + sky +
    '<div class="hdr-in"><div class="brand"><h1>Microplastic City</h1><p>เกมบริหารเงินพิชิตเมืองไมโครพลาสติก</p></div>' +
    '<div class="hstat"><span class="pill">รอบที่ ' + S.round + '</span><span class="pill' + (S.started && !S.ended ? ' st-play' : '') + '">' + status + '</span></div></div>' +
    '<nav class="tabs" aria-label="เมนูหลัก">' + tabs.map(function (t) { return '<button class="tab" data-act="nav" data-v="' + t[0] + '"' + (UI.view === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</button>'; }).join('') + '</nav></header>';
}

function groupAdminCard(g) {
  var dis = (!S.started || S.ended) ? ' disabled' : '';
  return '<article class="gc"><header>' + shape(g.id) + '<input class="gname" id="gname' + g.id + '" value="' + esc(g.name) + '" maxlength="24" data-chg="gname" data-gid="' + g.id + '" aria-label="ชื่อกลุ่ม ' + (g.id + 1) + '"></header>' +
    '<div><div class="lbl">เงินคงเหลือ</div><div class="moneyv"><span class="coin"></span>' + n0(g.money) + '<small>บาท</small></div></div>' +
    '<div><div class="row sp"><span class="lbl">Environment</span><span class="envv">' + g.env + '<small class="muted"> / 100</small></span></div>' + bar(g.env) + '</div>' +
    '<div class="inv">' + invChips(g) + '</div>' +
    '<button class="btn btn-s btn-sm" data-act="adjust" data-gid="' + g.id + '"' + dis + '>ปรับค่าเอง</button></article>';
}

function startPanel() {
  return '<section class="card stack"><h2>เริ่มกิจกรรม</h2>' +
    '<p>5 กลุ่ม แต่ละกลุ่มเริ่มด้วยเงิน 1,000 บาทและ Environment 100 คะแนน ตั้งชื่อกลุ่มได้ที่นี่หรือในการ์ดด้านล่าง</p>' +
    '<ol style="margin:0;padding-left:22px"><li>ผู้เล่นเลือกซื้อสินค้าที่แท็บ "ตลาด"</li><li>เมื่อจบรอบซื้อ กด "สุ่มเหตุการณ์" ที่หน้านี้</li><li>ตรวจผลกระทบของแต่ละกลุ่มก่อนกดยืนยัน แล้วฉายผลที่แท็บ "จอผู้เล่น"</li></ol>' +
    '<div><button class="btn btn-p btn-xl" data-act="start">เริ่มเกม</button></div></section>';
}

function eventControl() {
  var dis = (!S.started || S.ended || S.pending) ? ' disabled' : '';
  var opts = EVENTS.map(function (e) { return '<option value="' + e.id + '">' + esc(e.title) + '</option>'; }).join('');
  var enabled = EVENTS.filter(function (e) { return S.eventsOff.indexOf(e.id) < 0; }).length;
  var html = '<section class="card stack"><div class="sec-h"><h2>เหตุการณ์</h2><span class="muted">กองสุ่มเหลือ ' + S.deck.length + ' จาก ' + enabled + ' เหตุการณ์ (สุ่มโดยไม่ซ้ำจนครบกอง)</span></div>';
  if (S.pending) html += pendingPanel();
  else {
    html += '<div class="row"><button class="btn btn-p btn-xl" data-act="draw"' + dis + '>สุ่มเหตุการณ์</button>' +
      '<div class="row"><select class="in" id="pickEvent" aria-label="เลือกเหตุการณ์เอง" style="width:auto;min-width:220px"' + dis + '><option value="">เลือกเหตุการณ์เอง...</option>' + opts + '</select>' +
      '<button class="btn btn-s" data-act="pick"' + dis + '>ใช้เหตุการณ์นี้</button></div>' +
      '<button class="btn btn-s" data-act="undo"' + (canUndo() ? '' : ' disabled') + '>Undo เหตุการณ์ล่าสุด</button></div>';
    if (!S.started) html += '<p class="muted">กดเริ่มเกมก่อนจึงจะสุ่มเหตุการณ์ได้</p>';
    else if (S.lastView) html += lastResultBox(S.lastView, true);
    if (S.lastEvent && !canUndo() && !S.ended) html += '<p class="muted">Undo ใช้ได้เฉพาะก่อนมีรายการใหม่ (ซื้อสินค้า ปรับค่า หรือสุ่มเหตุการณ์ถัดไป)</p>';
  }
  return html + '</section>';
}

function lastResultBox(v, small) {
  return '<div class="stack"><div class="sec-h"><h3>ผลเหตุการณ์ล่าสุด: ' + esc(v.title) + '</h3><span class="muted">รอบที่ ' + v.round + '</span></div>' +
    (v.win != null ? '<div class="row"><span class="muted">เลขรางวัล</span><span class="win" style="font-size:2.2rem;padding:6px 18px">' + pad(v.win) + '</span></div>' : '') +
    '<div class="scroll"><table class="tbl"><thead><tr><th>กลุ่ม</th><th>เงิน</th><th>Environment</th><th>หมายเหตุ</th></tr></thead><tbody>' +
    v.results.map(function (r) { return '<tr><td><div class="nm">' + shape(r.gid) + esc(S.groups[r.gid].name) + '</div></td><td>' + (r.dM ? dchip(r.dM, 'm') : '<span class="muted">0</span>') + '</td><td>' + (r.dE ? dchip(r.dE, 'e') : '<span class="muted">0</span>') + '</td><td class="' + r.tone + '">' + esc(r.note) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' + (v.learn && !small ? '<p class="note">ข้อคิด: ' + esc(v.learn) + '</p>' : '') + '</div>';
}

function pendingPanel() {
  var p = S.pending, ev = EV[p.eventId], rows = computePreview(), h = '';
  h += '<div class="evbox"><div class="row sp"><div class="stack" style="gap:8px"><div>' + catChips(ev) + '</div><h2>' + esc(ev.title) + '</h2></div><span class="pill" style="background:var(--surface2);color:var(--ink)">รอยืนยันผล</span></div>';
  h += '<p>' + esc(ev.desc) + '</p><p class="rule">' + esc(ev.rule) + '</p>';

  if (ev.lottery) {
    var pending = S.groups.filter(function (g) { return !p.locked[g.id]; });
    h += '<div class="stack"><h3>ขั้นตอนหวย</h3><p class="muted">ให้แต่ละกลุ่มตรวจเลขที่ซื้อไว้ แล้วกดยืนยันเลข เมื่อครบทุกกลุ่มจึงสุ่มเลขรางวัลได้</p>';
    h += '<div class="scroll"><table class="tbl"><thead><tr><th>กลุ่ม</th><th>เลขที่ซื้อ</th><th>สถานะ</th></tr></thead><tbody>' +
      S.groups.map(function (g) {
        var locked = !!p.locked[g.id];
        return '<tr><td><div class="nm">' + shape(g.id) + esc(g.name) + '</div></td><td>' + (g.tickets.length ? g.tickets.map(function (n) { return '<span class="chip chip-tk">' + pad(n) + '</span>'; }).join(' ') : '<span class="muted">ไม่ได้ซื้อ</span>') + '</td><td>' +
          (locked ? '<span class="good" style="font-weight:700">ยืนยันเลขแล้ว</span>' : '<button class="btn btn-s btn-sm" data-act="lock" data-gid="' + g.id + '">' + (g.tickets.length ? 'ยืนยันเลข' : 'ยืนยัน (ไม่ซื้อ)') + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (p.win == null) {
      h += '<div class="row"><button class="btn btn-p btn-xl" data-act="drawwin"' + (pending.length ? ' disabled' : '') + '>สุ่มเลขรางวัล</button>' + (pending.length ? '<span class="muted">รอ: ' + pending.map(function (g) { return esc(g.name); }).join(', ') + '</span>' : '') + '</div>';
    } else {
      h += '<div class="row"><span class="muted">เลขรางวัลคือ</span><span class="win">' + pad(p.win) + '</span></div>';
    }
    h += '</div>';
  }

  if (!ev.lottery || p.win != null) {
    var warn = rows.filter(function (r) { return r.short > 0; });
    h += '<div class="stack"><h3>ผลกระทบที่จะเกิดกับแต่ละกลุ่ม</h3><div class="scroll"><table class="tbl"><thead><tr><th>กลุ่ม</th>' + (ev.choice ? '<th>ตัวเลือก</th>' : '') + '<th>เงิน (ก่อน → หลัง)</th><th>Environment (ก่อน → หลัง)</th><th>หมายเหตุ</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var g = S.groups[r.gid], cell = '';
        if (ev.choice) {
          var can = ev.choice.can(g);
          cell = '<td><div class="seg" role="group" aria-label="ตัวเลือกของ ' + esc(g.name) + '"><button data-act="choice" data-gid="' + g.id + '" data-val="no" aria-pressed="' + (r.choice === 'no') + '">' + esc(ev.choice.no) + '</button><button data-act="choice" data-gid="' + g.id + '" data-val="yes" aria-pressed="' + (r.choice === 'yes') + '"' + (can.ok ? '' : ' disabled') + '>' + esc(ev.choice.yes) + '</button></div>' + (can.ok ? '' : '<div class="bad" style="font-size:.85rem">' + esc(can.why) + '</div>') + '</td>';
        }
        return '<tr><td><div class="nm">' + shape(g.id) + esc(g.name) + '</div></td>' + cell +
          '<td class="tn"><span class="mv">' + n0(r.oldMoney) + '</span><span class="arrow">→</span><span class="mv">' + n0(r.newMoney) + '</span>' + dchip(r.dM, 'm') + '</td>' +
          '<td class="tn"><span class="ev">' + r.oldEnv + '</span><span class="arrow">→</span><span class="ev">' + r.newEnv + '</span>' + dchip(r.dE, 'e') + (r.capped ? '<div class="muted" style="font-size:.8rem">เกินเพดาน ปัดเป็น 100</div>' : '') + '</td>' +
          '<td class="' + r.tone + '">' + esc(r.note) + (Object.keys(r.use).length ? '<div class="bad" style="font-size:.85rem">สินค้าที่ถูกใช้หมด: ' + Object.keys(r.use).map(function (k) { return esc((prod(k) || { name: k }).name) + ' ×' + r.use[k]; }).join(', ') + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (warn.length) h += '<div class="alert"><b>เงินไม่พอจ่าย:</b> ' + warn.map(function (r) { return esc(r.name) + ' (ขาด ' + n0(r.short) + ' บาท)'; }).join(', ') + '<br>กติกาสำรองที่ใช้: ' + esc(fbText()) + ' (เปลี่ยนได้ในหน้าตั้งค่า)</div>';
    h += '</div>';
  }

  h += '<div class="row"><button class="btn btn-p btn-xl" data-act="confirmev"' + (canConfirm() ? '' : ' disabled') + '>ยืนยันผลเหตุการณ์</button><button class="btn btn-s" data-act="cancelev"' + (p.win != null ? ' disabled' : '') + '>ยกเลิกเหตุการณ์นี้</button></div></div>';
  return h;
}

function viewDash() {
  var h = '';
  if (!S.started) h += startPanel();
  h += '<section class="stack"><div class="sec-h"><h2>สถานะทุกกลุ่ม</h2><button class="btn btn-s" data-act="nav" data-v="entry">บันทึกข้อมูลทุกกลุ่มพร้อมกัน</button></div><div class="ggrid">' + S.groups.map(groupAdminCard).join('') + '</div></section>';
  h += eventControl();
  h += '<section class="card row sp"><div><h3>จัดการเกม</h3><p class="muted">ข้อมูลถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้ ปิดหรือรีเฟรชหน้าแล้วข้อมูลยังอยู่</p></div><div class="row">' +
    (S.ended ? '<button class="btn btn-s" data-act="resume">เปิดเกมต่อ</button>' : '<button class="btn btn-p" data-act="end"' + (S.started ? '' : ' disabled') + '>จบเกม</button>') +
    '<button class="btn btn-s" data-act="backup">สำรอง/กู้คืนข้อมูล</button><button class="btn btn-d" data-act="reset">รีเซ็ตเกม</button></div></section>';
  return h;
}

function viewEntry() {
  var dr = UI.entryDraft, prods = S.products.filter(function (p) { return p.type !== 'lottery'; });
  function dg(gid) { return dr ? dr.filter(function (x) { return x.gid === gid; })[0] : null; }
  function cells(fn) { return S.groups.map(function (g) { return '<td>' + fn(g, dg(g.id)) + '</td>'; }).join(''); }
  var h = '<section class="card stack"><div class="sec-h"><h2>บันทึกข้อมูลทุกกลุ่ม</h2><button class="btn btn-s btn-sm" data-act="entryreset">คืนค่าในช่องให้ตรงกับข้อมูลปัจจุบัน</button></div>' +
    '<p class="muted">ตรวจเงิน Environment และสินค้าของแต่ละกลุ่มจากของจริง แล้วกรอก "ค่าที่ถูกต้องตอนนี้" ลงในช่อง ไม่ใช่จำนวนที่เพิ่ม เมื่อกดบันทึก ระบบจะสรุปสิ่งที่เปลี่ยนให้ตรวจก่อนยืนยันอีกครั้ง ใช้ได้ทุกเวลา รวมถึงตอนที่มีเหตุการณ์รอยืนยันอยู่</p>' +
    '<div class="scroll"><table class="tbl entry" style="min-width:780px"><thead><tr><th>รายการ</th>' + S.groups.map(function (g) { return '<th><div class="nm">' + shape(g.id) + esc(g.name) + '</div></th>'; }).join('') + '</tr></thead><tbody>';
  h += '<tr><td class="lb">เงิน (บาท)</td>' + cells(function (g, d) { return '<input class="in" id="en-m-' + g.id + '" type="number" inputmode="numeric" min="0" step="10" value="' + (d ? d.money : g.money) + '">'; }) + '</tr>';
  h += '<tr><td class="lb">Environment (0–100)</td>' + cells(function (g, d) { return '<input class="in" id="en-e-' + g.id + '" type="number" inputmode="numeric" min="0" max="100" step="1" value="' + (d ? d.env : g.env) + '">'; }) + '</tr>';
  h += '<tr><td class="sub" colspan="' + (S.groups.length + 1) + '">สินค้าใน Inventory (จำนวนชิ้น)</td></tr>';
  prods.forEach(function (p) {
    h += '<tr><td class="lb">' + esc(p.name) + (p.active ? '' : ' <span class="muted">(ปิดขาย)</span>') + '</td>' + cells(function (g, d) { return '<input class="in" id="en-p-' + g.id + '-' + p.id + '" type="number" inputmode="numeric" min="0" max="99" step="1" value="' + (d ? (d.inv[p.id] || 0) : (g.inv[p.id] || 0)) + '">'; }) + '</tr>';
  });
  h += '<tr><td class="sub" colspan="' + (S.groups.length + 1) + '">สลากหวย (ติ๊กเลขที่กลุ่มนั้นซื้อไว้)</td></tr>';
  h += '<tr><td class="lb">เลขหวย 0–9</td>' + cells(function (g, d) {
    var cur = d ? d.tickets : g.tickets, o = '<div class="tkg">';
    for (var n = 0; n < 10; n++) o += '<label class="tk"><input type="checkbox" id="en-t-' + g.id + '-' + n + '"' + (cur.indexOf(n) >= 0 ? ' checked' : '') + '>' + n + '</label>';
    return o + '</div>';
  }) + '</tr></tbody></table></div>' +
    '<div class="row"><button class="btn btn-p btn-xl" data-act="entrysave">ตรวจสอบและบันทึก</button></div></section>';
  return h;
}

function viewMarket() {
  var g = S.groups[UI.marketGroup], h = '', blocked = !S.started || S.ended || S.pending;
  if (!S.started) h += '<div class="banner">ยังไม่ได้เริ่มเกม กลับไปที่แท็บ "ผู้จัด" แล้วกดเริ่มเกมก่อนจึงจะซื้อสินค้าได้</div>';
  else if (S.ended) h += '<div class="banner">จบเกมแล้ว ซื้อสินค้าไม่ได้</div>';
  else if (S.pending) h += '<div class="banner">มีเหตุการณ์รอยืนยันอยู่ ผู้จัดต้องยืนยันหรือยกเลิกเหตุการณ์ก่อน จึงจะซื้อสินค้าต่อได้</div>';
  h += '<section class="stack"><h2>ตลาดกลางเมือง · เลือกกลุ่มที่จะซื้อ</h2><div class="gsel">' + S.groups.map(function (x) {
    return '<button class="gbtn" data-act="mgroup" data-gid="' + x.id + '" aria-pressed="' + (x.id === UI.marketGroup) + '">' + shape(x.id) + '<span class="t"><strong>' + esc(x.name) + '</strong><span class="mv tn">' + n0(x.money) + ' บาท</span></span></button>';
  }).join('') + '</div></section>';
  h += '<section class="card ggrid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))"><div><div class="lbl">กลุ่มที่กำลังซื้อ</div><div class="row" style="gap:10px">' + shape(g.id) + '<h3>' + esc(g.name) + '</h3></div></div>' +
    '<div><div class="lbl">เงินคงเหลือ</div><div class="moneyv"><span class="coin"></span>' + n0(g.money) + '<small>บาท</small></div></div>' +
    '<div><div class="row sp"><span class="lbl">Environment</span><span class="envv">' + g.env + '</span></div>' + bar(g.env) + '</div>' +
    '<div><div class="lbl">Inventory</div><div class="inv">' + invChips(g) + '</div></div></section>';
  h += '<section class="pgrid">';
  S.products.filter(function (p) { return p.active; }).forEach(function (p) {
    var afford = g.money >= p.price;
    if (p.type === 'lottery') {
      h += '<article class="pc lotwide"><div class="row sp"><div class="stack" style="gap:4px"><h3>' + esc(p.name) + ' <span class="cat">' + TYPE_LABEL.lottery + '</span></h3><p class="muted">' + esc(p.desc) + '</p></div><span class="price">' + n0(p.price) + ' บาท / ใบ</span></div>' +
        '<p class="lbl">กดเลขที่ต้องการ (เลขที่กลุ่มนี้ซื้อแล้วจะเป็นสีเหลือง) ' + (g.tickets.length ? '· ซื้อแล้ว ' + g.tickets.length + ' ใบ' : '') + '</p><div class="numgrid">';
      for (var i = 0; i < 10; i++) {
        var own = g.tickets.indexOf(i) >= 0;
        h += '<button class="nb' + (own ? ' own' : '') + '" data-act="pick-num" data-n="' + i + '"' + ((own || blocked || !afford) ? ' disabled' : '') + ' aria-label="เลข ' + pad(i) + (own ? ' ซื้อแล้ว' : '') + '">' + pad(i) + '</button>';
      }
      h += '</div>' + (!afford && !blocked ? '<p class="bad">เงินไม่พอซื้อสลาก</p>' : '') + '</article>';
    } else {
      h += '<article class="pc"><div class="row sp"><h3>' + esc(p.name) + '</h3><span class="cat">' + TYPE_LABEL[p.type] + '</span></div><div class="price">' + n0(p.price) + ' บาท</div>' +
        '<p>' + esc(p.desc) + '</p><div class="row" style="gap:6px"><span class="lbl">ผลต่อ Environment</span>' + (p.env === 0 ? '<span class="chip">ไม่เปลี่ยน</span>' : '<span class="dl ' + (p.env > 0 ? 'up e' : 'dn') + '" style="margin:0">' + sgn(p.env) + '</span>') + '</div>' +
        '<button class="btn btn-p" data-act="buy" data-pid="' + esc(p.id) + '"' + ((blocked || !afford) ? ' disabled' : '') + '>' + (afford ? 'ซื้อให้ ' + esc(g.name) : 'เงินไม่พอ') + '</button></article>';
    }
  });
  return h + '</section>';
}

function viewPlayer() {
  var h = '<div class="pv stack">', sb = scoreboard();
  h += '<div class="row sp"><h2 style="font-size:clamp(1.4rem,2.6vw,2rem)">รอบที่ ' + S.round + (S.ended ? ' · จบเกมแล้ว' : '') + '</h2><button class="btn btn-s btn-sm" data-act="fs">เต็มจอ</button></div>';
  h += '<div class="pvg">' + S.groups.map(function (g) {
    return '<article class="pvc"><header>' + shape(g.id) + '<strong>' + esc(g.name) + '</strong></header>' +
      '<div><div class="lbl">เงินคงเหลือ</div><div class="moneyv"><span class="coin"></span>' + n0(g.money) + '<small>บาท</small></div></div>' + ring(g.env) +
      '<div><div class="lbl" style="margin-bottom:6px">Inventory</div><div class="inv">' + invChips(g) + '</div></div></article>';
  }).join('') + '</div>';
  h += '<div class="pvb"><section class="card stack">';
  if (S.pending) {
    var ev = EV[S.pending.eventId];
    h += '<span class="pill" style="background:var(--money-soft);color:var(--money-ink);align-self:flex-start">กำลังเกิดเหตุการณ์</span><h2 style="font-size:2rem">' + esc(ev.title) + '</h2><p style="font-size:1.15rem">' + esc(ev.desc) + '</p><p class="rule">' + esc(ev.rule) + '</p>';
    if (ev.lottery && S.pending.win != null) h += '<div class="row"><span class="muted">เลขรางวัล</span><span class="win">' + pad(S.pending.win) + '</span></div>';
    h += '<p class="muted">รอผู้จัดยืนยันผล</p>';
  } else if (S.lastView) h += '<h2>เหตุการณ์ล่าสุด</h2>' + lastResultBox(S.lastView, false);
  else h += '<h2>เหตุการณ์ล่าสุด</h2><p class="empty">ยังไม่มีเหตุการณ์เกิดขึ้น</p>';
  h += '</section><section class="card stack"><h2>เปรียบเทียบทั้ง 5 กลุ่ม</h2><div class="scroll"><table class="tbl" style="min-width:480px"><thead><tr><th>อันดับ</th><th>กลุ่ม</th><th class="r">เงิน</th><th class="r">Environment</th><th class="r">คะแนน</th></tr></thead><tbody>' +
    sb.map(function (r) { return '<tr><td class="rk">' + r.rank + '</td><td><div class="nm">' + shape(r.g.id) + esc(r.g.name) + '</div></td><td class="r tn mv">' + n0(r.g.money) + '</td><td class="r tn ev">' + r.g.env + '</td><td class="r tn"><b>' + fmtScore(r.total) + '</b></td></tr>'; }).join('') +
    '</tbody></table></div><p class="muted">คะแนนระหว่างเกมคำนวณจากเงินและ Environment ณ ตอนนี้ คะแนนสุดท้ายตัดสินเมื่อผู้จัดกดจบเกม</p></section></div></div>';
  return h;
}

function viewHistory() {
  var f = UI.hist, list = S.history.slice().reverse().filter(function (e) { return f === 'all' || e.type === f; });
  var chips = [['all', 'ทั้งหมด'], ['buy', 'ซื้อสินค้า'], ['event', 'เหตุการณ์'], ['manual', 'ผู้จัดปรับค่า'], ['system', 'ระบบ']];
  var h = '<section class="card stack"><div class="sec-h"><h2>ประวัติการเล่น</h2><span class="muted">' + S.history.length + ' รายการ</span></div><div class="fchips">' +
    chips.map(function (c) { return '<button class="fc" data-act="hfilter" data-f="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
  if (!list.length) return h + '<p class="empty">ยังไม่มีรายการ</p></section>';
  h += '<ul class="hl">' + list.map(function (e) {
    var body;
    if (e.type === 'event') {
      body = '<b>เหตุการณ์: ' + esc(e.title) + '</b>' + (e.undone ? ' <span class="cat">ถูก Undo</span>' : '') + (e.win != null ? ' · เลขรางวัล ' + pad(e.win) : '') +
        '<div class="muted" style="font-size:.9rem">' + e.results.map(function (r) { return esc(r.name) + ' (เงิน ' + sgn(r.dM) + ', Env ' + sgn(r.dE) + ')'; }).join(' · ') + '</div>';
    } else {
      body = esc(e.text) + (e.type === 'buy' ? '' : '');
      if (e.type === 'buy' || e.type === 'manual') body += '<div class="muted" style="font-size:.9rem">เงิน ' + sgn(e.m || 0) + ' · Environment ' + sgn(e.e || 0) + '</div>';
    }
    return '<li class="hr' + (e.undone ? ' undone' : '') + '"><div class="tm">' + timeStr(e.ts) + '<br>รอบ ' + e.round + '</div><div class="tx">' + body + '</div></li>';
  }).join('') + '</ul></section>';
  return h;
}

function viewSettings() {
  var h = '<section class="card stack"><h2>กติกาเมื่อเงินไม่พอจ่าย</h2><p class="muted">ใช้กับเหตุการณ์ที่ทำให้เสียเงิน ระบบจะแจ้งเตือนในหน้าตัวอย่างผลก่อนยืนยันเสมอ ส่วนการซื้อสินค้าจะไม่อนุญาตเมื่อเงินไม่พอ</p>' +
    '<div class="fld" style="max-width:520px"><label for="fallback">กติกาสำรอง</label><select class="in" id="fallback" data-chg="fallback">' +
    Object.keys(FALLBACK_TEXT).map(function (k) { return '<option value="' + k + '"' + (S.settings.fallback === k ? ' selected' : '') + '>' + FALLBACK_TEXT[k] + '</option>'; }).join('') + '</select></div></section>';

  h += '<section class="card stack"><h2>สูตรคะแนนท้ายเกม</h2><p class="muted">คะแนนเงินเต็ม 50 เมื่อเงินคงเหลือถึงเกณฑ์นี้ เงินที่เกินเกณฑ์ไม่ได้คะแนนเพิ่ม ส่วนคะแนน Environment = Environment ÷ 100 × 50 ตั้งเกณฑ์ต่ำลงจะสนับสนุนให้ลงทุนกับของใช้ซ้ำมากขึ้น ตั้งสูงขึ้นจะสนับสนุนให้เก็บเงิน</p><div class="fld" style="max-width:360px"><label for="mcap">เกณฑ์เงินที่ได้คะแนนเต็ม (บาท)</label><input class="in" id="mcap" type="number" min="100" max="1000" step="50" value="' + moneyCap() + '" data-chg="cap"></div></section>';
  var lp = prod('lottery'), lpp = lp ? lp.price : 20;
  h += '<section class="card stack"><h2>หวย (เลข 0–9)</h2><p class="muted">ซื้อได้เลขละ 1 ใบต่อกลุ่ม ถ้าซื้อครบทั้ง 10 เลขจะจ่าย ' + n0(lpp * 10) + ' บาท และถูกรางวัลแน่นอน 1 ครั้ง จึงควรตั้งเงินรางวัลให้ไม่เกินราคาซื้อครบชุด</p><div class="fld" style="max-width:360px"><label for="prize">เงินรางวัล (บาท)</label><input class="in" id="prize" type="number" min="0" max="5000" step="10" value="' + lotPrize() + '" data-chg="prize"></div></section>';
  h += '<section class="card stack"><h2>สินค้าในตลาด</h2><p class="muted">แก้ชื่อ ราคา ผลต่อ Environment และคำอธิบายได้ ราคาใหม่มีผลกับการซื้อครั้งต่อไป สินค้าที่มากับเกมถูกผูกกับกติกาของเหตุการณ์ สินค้าที่เพิ่มเองใช้ขายได้ตามปกติ</p><div class="scroll"><table class="tbl" style="min-width:820px"><thead><tr><th>ชื่อสินค้า</th><th>ประเภท</th><th>ราคา (บาท)</th><th>ผลต่อ Environment</th><th>คุณสมบัติ</th><th>เปิดขาย</th></tr></thead><tbody>' +
    S.products.map(function (p) {
      var id = esc(p.id);
      return '<tr><td><input class="in" id="pn-' + id + '" value="' + esc(p.name) + '" maxlength="40" data-chg="pf" data-f="name" data-pid="' + id + '" aria-label="ชื่อสินค้า"></td><td>' + TYPE_LABEL[p.type] + '</td>' +
        '<td><input class="in" id="pp-' + id + '" type="number" min="0" max="10000" step="1" value="' + p.price + '" data-chg="pf" data-f="price" data-pid="' + id + '" aria-label="ราคา" style="width:110px"></td>' +
        '<td><input class="in" id="pe-' + id + '" type="number" min="-50" max="50" step="1" value="' + p.env + '" data-chg="pf" data-f="env" data-pid="' + id + '" aria-label="ผลต่อ Environment" style="width:110px"></td>' +
        '<td><input class="in" id="pd-' + id + '" value="' + esc(p.desc) + '" maxlength="140" data-chg="pf" data-f="desc" data-pid="' + id + '" aria-label="คุณสมบัติ"></td>' +
        '<td><input type="checkbox" id="pa-' + id + '" ' + (p.active ? 'checked' : '') + ' data-chg="pf" data-f="active" data-pid="' + id + '" aria-label="เปิดขาย" style="width:22px;height:22px"></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<h3>เพิ่มสินค้าใหม่</h3><div class="fgrid"><div class="fld"><label for="newName">ชื่อสินค้า</label><input class="in" id="newName" maxlength="40"></div><div class="fld"><label for="newPrice">ราคา (บาท)</label><input class="in" id="newPrice" type="number" min="0" step="1" value="50"></div><div class="fld"><label for="newEnv">ผลต่อ Environment</label><input class="in" id="newEnv" type="number" step="1" value="0"></div><div class="fld"><label for="newType">ประเภท</label><select class="in" id="newType"><option value="reusable">ใช้ซ้ำได้ (เก็บใน Inventory)</option><option value="single">ใช้ครั้งเดียว</option></select></div></div>' +
    '<div class="fld"><label for="newDesc">คุณสมบัติ</label><input class="in" id="newDesc" maxlength="140"></div><div><button class="btn btn-p" data-act="addprod">เพิ่มสินค้า</button></div></section>';

  h += '<section class="card stack"><h2>คลังเหตุการณ์ (' + EVENTS.length + ' เหตุการณ์)</h2><p class="muted">ติ๊กออกเพื่อไม่ให้เหตุการณ์นั้นถูกสุ่ม ผู้จัดยังเลือกเหตุการณ์เองได้เสมอ</p><div class="scroll"><table class="tbl" style="min-width:680px"><thead><tr><th>ใช้สุ่ม</th><th>เหตุการณ์</th><th>ประเภท</th><th>กติกา</th></tr></thead><tbody>' +
    EVENTS.map(function (e) { return '<tr><td><input type="checkbox" id="ev-' + e.id + '" data-chg="evt" data-eid="' + e.id + '" ' + (S.eventsOff.indexOf(e.id) < 0 ? 'checked' : '') + ' aria-label="ใช้สุ่ม ' + esc(e.title) + '" style="width:22px;height:22px"></td><td><b>' + esc(e.title) + '</b></td><td>' + catChips(e) + '</td><td>' + esc(e.rule) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  return h;
}

function viewResults() {
  var sb = scoreboard();
  var h = '<section class="stack"><h2 style="font-size:clamp(1.6rem,3vw,2.4rem)">สรุปผลการแข่งขัน</h2><div class="podium">' +
    sb.slice(0, 3).map(function (r) {
      return '<article class="pod' + (r.rank === 1 ? ' first' : '') + '"><div class="row"><span class="big">' + (r.tied ? 'เสมอ ' : '') + 'อันดับ ' + r.rank + '</span></div><div class="row" style="gap:10px">' + shape(r.g.id) + '<h3>' + esc(r.g.name) + '</h3></div><div class="tot">' + fmtScore(r.total) + ' <small class="muted" style="font-family:var(--body);font-size:1rem">/ 100 คะแนน</small></div><p>' + esc(reasonText(r)) + '</p></article>';
    }).join('') + '</div></section>';
  h += '<section class="card stack"><h2>ตารางคะแนนทั้ง 5 กลุ่ม</h2><div class="scroll"><table class="tbl" style="min-width:760px"><thead><tr><th>อันดับ</th><th>กลุ่ม</th><th class="r">เงินคงเหลือ</th><th class="r">Environment</th><th class="r">คะแนนเงิน (50)</th><th class="r">คะแนน Env (50)</th><th class="r">รวม (100)</th></tr></thead><tbody>' +
    sb.map(function (r) { return '<tr><td class="rk">' + (r.tied ? 'เสมอ ' : '') + r.rank + '</td><td><div class="nm">' + shape(r.g.id) + esc(r.g.name) + '</div></td><td class="r tn mv">' + n0(r.g.money) + '</td><td class="r tn ev">' + r.g.env + '</td><td class="r tn">' + fmtScore(r.mScore) + '</td><td class="r tn">' + fmtScore(r.eScore) + '</td><td class="r tn"><b>' + fmtScore(r.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div></section>';
  h += '<section class="card stack"><h2>เหตุผลของแต่ละกลุ่ม</h2>' + sb.map(function (r) { return '<p><b>' + (r.tied ? 'เสมอ ' : '') + 'อันดับ ' + r.rank + ' · ' + esc(r.g.name) + ':</b> ' + esc(reasonText(r)) + '</p>'; }).join('') +
    '<p class="muted">คะแนนเงิน = เงินคงเหลือ ÷ ' + n0(moneyCap()) + ' × 50 (สูงสุด 50 เงินที่เกิน ' + n0(moneyCap()) + ' บาทไม่ได้คะแนนเพิ่ม) · คะแนน Environment = Environment ÷ 100 × 50 · ถ้าคะแนนรวมเท่ากัน กลุ่มที่มี Environment สูงกว่าชนะ และถ้ายังเท่ากันถือว่าเสมอ</p><p class="note">ที่ใช้สูตรนี้: เงินเก็บไว้เกินที่จำเป็นไม่ได้คะแนนเพิ่ม จึงควรลงทุนในของใช้ซ้ำที่ช่วยรับมือเหตุการณ์ แต่ถ้าซื้อมากเกินจนเงินต่ำกว่า ' + n0(moneyCap()) + ' บาท คะแนนเงินจะลดลง และ Environment ได้สูงสุดแค่ 100 การซื้อของรักษ์โลกเพิ่มจึงไม่ช่วยถ้า Environment เต็มอยู่แล้ว</p></section>';
  return h;
}

/* ================= MODALS ================= */
function modalHtml() {
  var m = UI.modal; if (!m) return '';
  var body = '';
  if (m.type === 'buy') {
    var g = S.groups[m.gid], p = prod(m.pid), dup = p.type === 'reusable' && has(g, p.id);
    body = '<h3>ยืนยันการซื้อ</h3><dl class="sum"><div><dt>กลุ่ม</dt><dd>' + esc(g.name) + '</dd></div><div><dt>สินค้า</dt><dd>' + esc(p.name) + (m.number != null ? ' เลข ' + pad(m.number) : '') + '</dd></div><div><dt>ราคา</dt><dd class="mv">' + n0(p.price) + ' บาท</dd></div><div><dt>เงินคงเหลือหลังซื้อ</dt><dd class="mv">' + n0(g.money) + ' → ' + n0(g.money - p.price) + ' บาท</dd></div>' +
      (p.env ? '<div><dt>Environment</dt><dd class="bad">' + g.env + ' → ' + clamp(g.env + p.env, 0, 100) + ' (' + sgn(p.env) + ')</dd></div>' : '') + '</dl>' +
      (dup ? '<p class="note">กลุ่มนี้มี' + esc(p.name) + 'อยู่แล้ว ซื้อซ้ำจะได้เพิ่มอีก 1 ชิ้น</p>' : '') +
      '<div class="macts"><button class="btn btn-s" data-act="closemodal">ยกเลิก</button><button class="btn btn-p" data-act="dobuy" data-autofocus>ยืนยันซื้อ</button></div>';
  } else if (m.type === 'adjust') {
    var g2 = S.groups[m.gid];
    body = '<h3>ปรับค่าของ ' + esc(g2.name) + '</h3><p class="muted">ตอนนี้มีเงิน ' + n0(g2.money) + ' บาท · Environment ' + g2.env + '</p>' +
      '<div class="fgrid"><div class="fld"><label for="adjKind">ค่าที่จะปรับ</label><select class="in" id="adjKind" data-adj><option value="money">เงิน (บาท)</option><option value="env">Environment (คะแนน)</option></select></div>' +
      '<div class="fld"><label for="adjSign">เพิ่มหรือลด</label><select class="in" id="adjSign" data-adj><option value="1">เพิ่ม (+)</option><option value="-1">ลด (−)</option></select></div>' +
      '<div class="fld"><label for="adjAmt">จำนวน</label><input class="in" id="adjAmt" type="number" min="1" step="1" value="50" data-adj></div></div>' +
      '<div class="row" style="gap:8px">' + [5, 10, 50, 100].map(function (v) { return '<button class="btn btn-s btn-sm" data-act="amt" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div>' +
      '<div class="fld"><label for="adjReason">เหตุผล (ไม่บังคับ)</label><input class="in" id="adjReason" maxlength="60"></div>' +
      '<p class="note" id="adjPrev" data-gid="' + g2.id + '"></p>' +
      '<div class="macts"><button class="btn btn-s" data-act="closemodal">ยกเลิก</button><button class="btn btn-p" data-act="doadjust">ยืนยันการปรับ</button></div>';
  } else if (m.type === 'confirmev') {
    var ev = EV[S.pending.eventId], rows = computePreview(), short = rows.filter(function (r) { return r.short > 0; });
    body = '<h3>ยืนยันผลเหตุการณ์?</h3><p>ค่าเงิน Environment และสินค้าของทั้ง 5 กลุ่มจะเปลี่ยนตามตารางตัวอย่างผลของ <b>' + esc(ev.title) + '</b></p>' +
      (short.length ? '<p class="alert">มี ' + short.length + ' กลุ่มเงินไม่พอจ่าย ระบบจะใช้กติกาสำรอง: ' + esc(fbText()) + '</p>' : '') +
      '<p class="muted">ถ้าผิดพลาด กด Undo ได้ก่อนที่จะมีรายการใหม่</p><div class="macts"><button class="btn btn-s" data-act="closemodal">กลับไปตรวจอีกครั้ง</button><button class="btn btn-p" data-act="doconfirmev" data-autofocus>ยืนยันผล</button></div>';
  } else if (m.type === 'undo') {
    body = '<h3>Undo เหตุการณ์ล่าสุด?</h3><p>ระบบจะคืนเงิน Environment และสินค้าของทุกกลุ่มให้เท่ากับก่อนเกิดเหตุการณ์ "' + esc(S.lastView ? S.lastView.title : '') + '" และคืนเหตุการณ์กลับเข้ากองสุ่ม</p><div class="macts"><button class="btn btn-s" data-act="closemodal">ยกเลิก</button><button class="btn btn-p" data-act="doundo" data-autofocus>ยืนยัน Undo</button></div>';
  } else if (m.type === 'end') {
    body = '<h3>จบเกมและคำนวณคะแนน?</h3><p>เมื่อจบเกมจะซื้อสินค้าและสุ่มเหตุการณ์ต่อไม่ได้ (เปิดเกมต่อได้ภายหลังหากกดผิด)</p><div class="macts"><button class="btn btn-s" data-act="closemodal">ยกเลิก</button><button class="btn btn-p" data-act="doend" data-autofocus>จบเกม</button></div>';
  } else if (m.type === 'reset') {
    body = '<h3>รีเซ็ตเกมกลับค่าเริ่มต้น?</h3><p>เงินและ Environment ของทุกกลุ่ม สินค้า สลาก ประวัติ และกองเหตุการณ์จะถูกล้าง การกระทำนี้ย้อนกลับไม่ได้</p>' +
      '<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="resetFull" style="width:22px;height:22px"> รีเซ็ตสินค้า ชื่อกลุ่ม และตั้งค่าเป็นค่าเริ่มต้นด้วย</label><div class="macts"><button class="btn btn-s" data-act="closemodal" data-autofocus>ยกเลิก</button><button class="btn btn-d" data-act="doreset">รีเซ็ตเกม</button></div>';
  } else if (m.type === 'entryconfirm') {
    var erows = entryDiff(m.data), ps = S.pending, lotp = ps && EV[ps.eventId].lottery, tchg = erows.some(function (c) { return c.addT.length || c.remT.length; });
    body = '<h3>ยืนยันบันทึกข้อมูล ' + erows.length + ' กลุ่ม</h3><p class="muted">ค่าต่อไปนี้จะถูกบันทึกทับข้อมูลปัจจุบัน และเก็บไว้ในประวัติ</p>' + erows.map(function (c) {
      var li = [];
      if (c.money[0] !== c.money[1]) li.push('เงิน ' + n0(c.money[0]) + ' → <b>' + n0(c.money[1]) + '</b> บาท');
      if (c.env[0] !== c.env[1]) li.push('Environment ' + c.env[0] + ' → <b>' + c.env[1] + '</b>');
      c.inv.forEach(function (x) { li.push(esc(x.name) + ' ' + x.o + ' → <b>' + x.n + '</b>'); });
      if (c.addT.length) li.push('เพิ่มเลขหวย ' + c.addT.join(', '));
      if (c.remT.length) li.push('ลบเลขหวย ' + c.remT.join(', '));
      return '<div><b>' + esc(c.name) + '</b><ul style="margin:4px 0 0;padding-left:20px">' + li.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
    }).join('') + (lotp && tchg ? (ps.win != null ? '<p class="alert">สุ่มเลขรางวัลไปแล้ว แก้เลขหวยไม่ได้ ระบบจะไม่บันทึกถ้ามีการเปลี่ยนเลขหวย</p>' : '<p class="note">กลุ่มที่เปลี่ยนเลขหวยต้องกดยืนยันเลขใหม่อีกครั้ง</p>') : '') +
      '<div class="macts"><button class="btn btn-s" data-act="closemodal">กลับไปแก้</button><button class="btn btn-p" data-act="doentry" data-autofocus>ยืนยันบันทึก</button></div>';
  } else if (m.type === 'backup') {
    body = '<h3>สำรอง/กู้คืนข้อมูล</h3><p class="muted">คัดลอกข้อความนี้เก็บไว้ หากเปลี่ยนเครื่องหรือข้อมูลหาย นำมาวางแล้วกด "กู้คืน" ได้</p><textarea class="in" id="backupText" spellcheck="false">' + esc(JSON.stringify(S)) + '</textarea><div class="macts"><button class="btn btn-s" data-act="closemodal">ปิด</button><button class="btn btn-s" data-act="copybackup">คัดลอก</button><button class="btn btn-d" data-act="dorestore">กู้คืนจากข้อความนี้</button></div>';
  }
  return '<div class="mb" data-act="closemodal-bg"><div class="modal" role="dialog" aria-modal="true">' + body + '</div></div>';
}

/* ================= RENDER ================= */
function render() {
  var root = document.getElementById('app'); if (!root) return;
  var y = window.scrollY, v = UI.view;
  if (v === 'results' && !S.ended) v = UI.view = 'dash';
  var map = { dash: viewDash, entry: viewEntry, market: viewMarket, player: viewPlayer, history: viewHistory, settings: viewSettings, results: viewResults };
  var banner = UI.storeFail ? '<div class="banner">เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกอัตโนมัติ ข้อมูลจะหายเมื่อปิดหรือรีเฟรชหน้า ใช้ปุ่ม "สำรอง/กู้คืนข้อมูล" เก็บข้อมูลไว้เป็นระยะ</div>' : '';
  root.innerHTML = header() + '<main class="wrap">' + banner + (map[v] || viewDash)() + '</main>' + modalHtml();
  if (UI.resetScroll) { window.scrollTo(0, 0); UI.resetScroll = false; } else window.scrollTo(0, y);
  if (UI.modal) {
    var f = root.querySelector('[data-autofocus]') || root.querySelector('.modal input,.modal select,.modal button');
    if (f && f.focus) f.focus({ preventScroll: true });
    if (UI.modal.type === 'adjust') updAdj();
  }
}

function readAdj() {
  var kind = document.getElementById('adjKind').value, sign = parseInt(document.getElementById('adjSign').value, 10);
  var amt = Number(document.getElementById('adjAmt').value);
  return { kind: kind, delta: Number.isInteger(amt) ? sign * amt : NaN, amt: amt };
}
function updAdj() {
  var el = document.getElementById('adjPrev'); if (!el) return;
  var g = S.groups[+el.dataset.gid], a = readAdj();
  if (!Number.isInteger(a.delta) || a.delta === 0) { el.textContent = 'ใส่จำนวนเต็มมากกว่า 0'; return; }
  if (a.kind === 'money') el.textContent = a.delta + g.money < 0 ? 'เงินจะติดลบ ปรับไม่ได้' : 'เงิน ' + n0(g.money) + ' → ' + n0(g.money + a.delta) + ' บาท';
  else el.textContent = 'Environment ' + g.env + ' → ' + clamp(g.env + a.delta, 0, 100) + ' (ไม่เกิน 0–100)';
}

/* ================= ACTIONS ================= */
var ACT = {
  nav: function (d) { if (d.v !== 'entry') UI.entryDraft = null; UI.view = d.v; UI.resetScroll = true; },
  start: function () { if (guard('start')) result(startGame()); },
  draw: function () { if (guard('draw')) result(drawEvent()); },
  pick: function () { var v = document.getElementById('pickEvent').value; if (!v) { toast('เลือกเหตุการณ์จากรายการก่อน', 'err'); return false; } if (guard('pick')) result(drawEvent(v)); },
  choice: function (d) { setChoice(+d.gid, d.val); },
  lock: function (d) { result(lockTickets(+d.gid)); },
  drawwin: function () { if (guard('drawwin')) result(drawWinning()); },
  cancelev: function () { result(cancelPending()); },
  confirmev: function () { if (canConfirm()) UI.modal = { type: 'confirmev' }; },
  doconfirmev: function () { UI.modal = null; if (guard('confirmev')) result(confirmEvent()); else toast('กดซ้ำเร็วเกินไป ระบบรับคำสั่งเดียว', 'err'); },
  undo: function () { if (canUndo()) UI.modal = { type: 'undo' }; },
  doundo: function () { UI.modal = null; if (guard('undo')) result(undoEvent()); },
  adjust: function (d) { UI.modal = { type: 'adjust', gid: +d.gid }; },
  amt: function (d) { document.getElementById('adjAmt').value = d.v; updAdj(); return false; },
  doadjust: function () {
    var m = UI.modal, a = readAdj(), reason = document.getElementById('adjReason').value.trim();
    var r = adjustValue(m.gid, a.kind, a.delta, reason);
    if (!r.ok) { toast(r.msg, 'err'); return false; }
    UI.modal = null; toast(r.msg);
  },
  end: function () { UI.modal = { type: 'end' }; },
  doend: function () { UI.modal = null; var r = endGame(); result(r); if (r.ok) { UI.view = 'results'; UI.resetScroll = true; } },
  resume: function () { result(resumeGame()); },
  reset: function () { UI.modal = { type: 'reset' }; },
  doreset: function () { var full = document.getElementById('resetFull').checked; UI.modal = null; result(resetGame(full)); UI.entryDraft = null; UI.view = 'dash'; UI.marketGroup = 0; UI.resetScroll = true; },
  backup: function () { UI.modal = { type: 'backup' }; },
  copybackup: function () {
    var t = document.getElementById('backupText');
    try { navigator.clipboard.writeText(t.value).then(function () { toast('คัดลอกแล้ว'); }, function () { t.select(); toast('เลือกข้อความให้แล้ว กด Ctrl+C เพื่อคัดลอก', 'err'); }); }
    catch (e) { t.select(); toast('เลือกข้อความให้แล้ว กด Ctrl+C เพื่อคัดลอก', 'err'); }
    return false;
  },
  dorestore: function () {
    try {
      var s = JSON.parse(document.getElementById('backupText').value);
      if (!validState(s)) throw new Error('bad');
      S = s; migrate(); UI.entryDraft = null; UI.modal = null; toast('กู้คืนข้อมูลแล้ว');
    } catch (e) { toast('ข้อความไม่ถูกต้อง กู้คืนไม่ได้', 'err'); return false; }
  },
  closemodal: function () { UI.modal = null; },
  entrysave: function () {
    var r = readEntry(); if (!r.ok) { toast(r.msg, 'err'); return false; }
    UI.entryDraft = r.data;
    if (!entryDiff(r.data).length) { toast('ไม่มีการเปลี่ยนแปลง'); UI.entryDraft = null; return false; }
    UI.modal = { type: 'entryconfirm', data: r.data };
  },
  entryreset: function () { UI.entryDraft = null; },
  doentry: function () {
    var data = UI.modal && UI.modal.data; UI.modal = null; if (!data) return;
    if (!guard('entry')) { toast('กดซ้ำเร็วเกินไป ระบบรับคำสั่งเดียว', 'err'); return; }
    var r = applyEntry(data); result(r); if (r.ok) UI.entryDraft = null;
  },
  mgroup: function (d) { UI.marketGroup = +d.gid; },
  buy: function (d) { UI.modal = { type: 'buy', gid: UI.marketGroup, pid: d.pid }; },
  'pick-num': function (d) { UI.modal = { type: 'buy', gid: UI.marketGroup, pid: 'lottery', number: +d.n }; },
  dobuy: function () {
    var m = UI.modal; UI.modal = null; if (!m) return;
    if (!guard('buy:' + m.gid + ':' + m.pid + ':' + m.number)) { toast('กดซ้ำเร็วเกินไป ระบบรับคำสั่งเดียว', 'err'); return; }
    result(buyProduct(m.gid, m.pid, { number: m.number }));
  },
  hfilter: function (d) { UI.hist = d.f; },
  addprod: function () {
    var name = document.getElementById('newName').value.trim(), price = Number(document.getElementById('newPrice').value), env = Number(document.getElementById('newEnv').value);
    var type = document.getElementById('newType').value, desc = document.getElementById('newDesc').value.trim();
    if (!name) { toast('ใส่ชื่อสินค้า', 'err'); return false; }
    if (!Number.isInteger(price) || price < 0 || price > 10000) { toast('ราคาต้องเป็นจำนวนเต็ม 0–10,000', 'err'); return false; }
    if (!Number.isInteger(env) || env < -50 || env > 50) { toast('ผลต่อ Environment ต้องเป็นจำนวนเต็ม −50 ถึง 50', 'err'); return false; }
    if (!guard('addprod:' + name)) return false;
    S.products.push({ id: 'c' + Date.now().toString(36) + randInt(1000), name: name, price: price, env: env, type: type === 'single' ? 'single' : 'reusable', desc: desc || '-', active: true, builtin: false });
    toast('เพิ่มสินค้า ' + name + ' แล้ว');
  },
  fs: function () { try { var p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(function () { toast('เบราว์เซอร์ไม่อนุญาตให้เต็มจอ', 'err'); }); } catch (e) { toast('เบราว์เซอร์ไม่อนุญาตให้เต็มจอ', 'err'); } return false; }
};

function onChange(el) {
  var k = el.dataset.chg;
  if (k === 'gname') { var v = el.value.trim().slice(0, 24); S.groups[+el.dataset.gid].name = v || ('กลุ่ม ' + (+el.dataset.gid + 1)); }
  else if (k === 'cap') { var cp = Number(el.value); if (Number.isInteger(cp) && cp >= 100 && cp <= 1000) S.settings.moneyCap = cp; else toast('เกณฑ์เงินต้องเป็นจำนวนเต็ม 100–1,000', 'err'); }
  else if (k === 'prize') { var pr = Number(el.value); if (Number.isInteger(pr) && pr >= 0 && pr <= 5000) S.settings.lotteryPrize = pr; else toast('เงินรางวัลต้องเป็นจำนวนเต็ม 0–5,000', 'err'); }
  else if (k === 'fallback') S.settings.fallback = el.value === 'zero' ? 'zero' : 'zero_env';
  else if (k === 'evt') {
    var id = el.dataset.eid, i = S.eventsOff.indexOf(id);
    if (el.checked && i >= 0) S.eventsOff.splice(i, 1);
    if (!el.checked && i < 0) S.eventsOff.push(id);
  } else if (k === 'pf') {
    var p = prod(el.dataset.pid), f = el.dataset.f; if (!p) return;
    if (f === 'name') p.name = el.value.trim().slice(0, 40) || p.name;
    else if (f === 'desc') p.desc = el.value.trim().slice(0, 140) || p.desc;
    else if (f === 'active') p.active = el.checked;
    else if (f === 'price') { var n = Number(el.value); if (Number.isInteger(n) && n >= 0 && n <= 10000) p.price = n; else toast('ราคาต้องเป็นจำนวนเต็ม 0–10,000', 'err'); }
    else if (f === 'env') { var e = Number(el.value); if (Number.isInteger(e) && e >= -50 && e <= 50) p.env = e; else toast('ผลต่อ Environment ต้องเป็นจำนวนเต็ม −50 ถึง 50', 'err'); }
  }
}

function migrate() {
  S.settings = S.settings || {};
  if (!Number.isInteger(S.settings.lotteryPrize)) S.settings.lotteryPrize = 200;
  if (!Number.isInteger(S.settings.moneyCap)) S.settings.moneyCap = 600;
  S.groups.forEach(function (g) { g.tickets = (g.tickets || []).filter(function (n) { return Number.isInteger(n) && n >= 0 && n <= 9; }); });
  S.products.forEach(function (p) { if (p.id === 'lottery' && /00–99/.test(p.desc)) p.desc = 'เลือกเลข 0–9 เพื่อเข้าร่วมเหตุการณ์หวยประจำวัน (เลขละ 1 ใบต่อกลุ่ม)'; });
  if (S.pending && S.pending.win != null && S.pending.win > 9) S.pending.win = null;
}

function boot() {
  S = load() || initialState();
  migrate();
  if (S.pending && !EV[S.pending.eventId]) S.pending = null;
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var act = el.dataset.act;
    if (act === 'closemodal-bg') { if (e.target !== el) return; act = 'closemodal'; }
    var fn = ACT[act]; if (!fn) return;
    var r = fn(el.dataset, el, e);
    if (r === false) return;
    save(); render();
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-chg]');
    if (el) { onChange(el); save(); render(); return; }
    if (e.target.closest('[data-adj]')) updAdj();
  });
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('[data-adj]')) updAdj(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.modal) { UI.modal = null; render(); } });
  render();
}

G.__MC = {
  get S() { return S; }, set S(v) { S = v; }, EVENTS: EVENTS, init: function () { S = initialState(); },
  buyProduct: buyProduct, adjustValue: adjustValue, drawEvent: drawEvent, cancelPending: cancelPending, setChoice: setChoice, lockTickets: lockTickets,
  drawWinning: drawWinning, computePreview: computePreview, confirmEvent: confirmEvent, undoEvent: undoEvent, canUndo: canUndo, startGame: startGame,
  endGame: endGame, resetGame: resetGame, scoreboard: scoreboard, applyEntry: applyEntry, entryDiff: entryDiff, moneyCap: moneyCap, migrate: migrate, reasonText: reasonText, singleCount: singleCount
};

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('app')) boot();

if (typeof module !== 'undefined' && module.exports) module.exports = G.__MC;
})();
