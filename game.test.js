// ทดสอบกติกาเกม: npm test
// แต่ละเทสต์เริ่มจากเกมใหม่ (M.init) และตรวจด้วยชื่อข้อ เพื่อให้รู้ทันทีว่าข้อไหนไม่ผ่าน
const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/game.js');

function t(name, cond) { assert.ok(cond, 'ไม่ผ่าน: ' + name); }
function fresh() { M.init(); M.startGame(); return M.S; }
function resetGroups(S) { S.groups.forEach(function (g) { g.money = 1000; g.env = 100; g.inv = {}; g.tickets = []; }); }

test('ค่าเริ่มต้นและการซื้อสินค้า', () => {
  M.init(); let S = M.S;
  t('ทุกกลุ่มเริ่ม 1,000 บาท / Environment 100', S.groups.length === 5 && S.groups.every(g => g.money === 1000 && g.env === 100));
  t('ซื้อก่อนเริ่มเกมไม่ได้', !M.buyProduct(0, 'umbrella').ok);
  M.startGame(); S = M.S;
  t('ซื้อร่มหักเงินและเข้า Inventory', M.buyProduct(0, 'umbrella').ok && S.groups[0].money === 900 && S.groups[0].inv.umbrella === 1);
  t('ซื้อน้ำขวดหักเงินและลด Environment', M.buyProduct(1, 'bottle').ok && S.groups[1].money === 980 && S.groups[1].env === 95);
  S.groups[2].money = 50;
  t('เงินไม่พอซื้อไม่ได้ และเงินไม่เปลี่ยน', !M.buyProduct(2, 'umbrella').ok && S.groups[2].money === 50);
  t('สินค้าที่ไม่มีอยู่ซื้อไม่ได้', !M.buyProduct(0, 'nothing').ok);
});

test('หวยเลข 0-9', () => {
  const S = fresh();
  t('ซื้อเลข 7 ได้', M.buyProduct(3, 'lottery', { number: 7 }).ok && S.groups[3].tickets[0] === 7 && S.groups[3].money === 980);
  t('ซื้อเลขซ้ำไม่ได้', !M.buyProduct(3, 'lottery', { number: 7 }).ok);
  t('เลขนอกช่วง 0-9 ซื้อไม่ได้', !M.buyProduct(3, 'lottery', { number: 10 }).ok && !M.buyProduct(3, 'lottery', { number: -1 }).ok);
  resetGroups(S);
  M.buyProduct(0, 'lottery', { number: 2 }); M.buyProduct(1, 'lottery', { number: 2 }); M.buyProduct(1, 'lottery', { number: 3 });
  M.drawEvent('lottery');
  t('สุ่มเลขก่อนทุกกลุ่มยืนยันไม่ได้', !M.drawWinning().ok && S.pending.win == null);
  t('ยืนยันผลก่อนสุ่มเลขไม่ได้', !M.confirmEvent().ok);
  [0, 1, 2, 3].forEach(i => M.lockTickets(i));
  t('ยืนยันแค่ 4 จาก 5 กลุ่มยังสุ่มไม่ได้', !M.drawWinning().ok);
  M.lockTickets(4);
  t('ครบทุกกลุ่มแล้วสุ่มเลขได้', M.drawWinning().ok);
  const w = S.pending.win;
  t('เลขรางวัลอยู่ในช่วง 0-9', Number.isInteger(w) && w >= 0 && w <= 9);
  t('สุ่มซ้ำไม่ได้', !M.drawWinning().ok && S.pending.win === w);
  t('ยกเลิกหลังสุ่มเลขแล้วไม่ได้', !M.cancelPending().ok);
  S.pending.win = 2;
  const pv = M.computePreview();
  t('กลุ่มที่เลขตรงได้รางวัล กลุ่มอื่นไม่ได้', pv[0].dM === 200 && pv[1].dM === 200 && pv[2].dM === 0);
  const before = JSON.stringify(S.groups);
  M.confirmEvent();
  t('สลากหมดอายุหลังจบเหตุการณ์', S.groups.every(g => g.tickets.length === 0));
  t('Undo คืนสลากและเงิน', M.undoEvent().ok && JSON.stringify(S.groups) === before);
});

test('ยืนยันเหตุการณ์ ป้องกันกดซ้ำ และ Undo', () => {
  const S = fresh();
  M.buyProduct(0, 'umbrella'); M.buyProduct(1, 'bottle');
  M.drawEvent('rain');
  t('ซื้อสินค้าไม่ได้ระหว่างมีเหตุการณ์รอยืนยัน', !M.buyProduct(0, 'cup').ok);
  const pv = M.computePreview();
  t('ฝนตก: มีร่มไม่เสีย ไม่มีร่มเสีย 200', pv[0].dM === 0 && pv[1].dM === -200 && pv[1].newMoney === 780);
  const snap = JSON.stringify(S.groups);
  t('ยืนยันผลได้', M.confirmEvent().ok && S.groups[1].money === 780);
  t('ยืนยันซ้ำไม่ได้ เงินไม่ถูกหักซ้ำ', !M.confirmEvent().ok && S.groups[1].money === 780);
  t('Undo คืนค่าทุกกลุ่มและรอบเกม', M.undoEvent().ok && JSON.stringify(S.groups) === snap && S.round === 1);
  t('Undo ซ้ำไม่ได้', !M.undoEvent().ok);
  M.drawEvent('storm'); M.confirmEvent(); M.buyProduct(0, 'cup');
  t('Undo ไม่ได้หลังมีรายการซื้อใหม่', !M.canUndo());
});

test('ผลของเหตุการณ์ตามสินค้าและตัวเลือก', () => {
  const S = fresh();
  M.drawEvent('storm'); let pv = M.computePreview();
  t('พายุ: ทุกกลุ่ม Environment -10', pv.every(r => r.dE === -10)); M.confirmEvent();
  S.groups[0].inv.cleaner = 1;
  M.drawEvent('storm'); pv = M.computePreview();
  t('พายุ: มีอุปกรณ์ทำความสะอาดได้รับการยกเว้น', pv[0].dE === 0 && pv[1].dE === -10); M.confirmEvent();

  S.groups.forEach(g => { g.env = 95; });
  M.drawEvent('cleanup'); M.setChoice(0, 'yes'); pv = M.computePreview();
  t('เก็บขยะ: Environment ไม่เกิน 100 และหักเงิน 50', pv[0].newEnv === 100 && pv[0].newMoney === S.groups[0].money - 50 && pv[1].dM === 0); M.confirmEvent();

  S.groups[0].inv.cleaner = 1; S.groups[0].env = 50;
  const before = JSON.stringify(S.groups);
  M.drawEvent('beach');
  t('ล้างชายหาด: กลุ่มที่ไม่มีอุปกรณ์เลือกเข้าร่วมไม่ได้', !M.setChoice(1, 'yes').ok);
  M.setChoice(0, 'yes'); pv = M.computePreview();
  t('ล้างชายหาด: ใช้อุปกรณ์ 1 ชิ้นและได้ Environment +20', pv[0].use.cleaner === 1 && pv[0].newEnv === 70); M.confirmEvent();
  t('ล้างชายหาด: อุปกรณ์ถูกใช้หมด', S.groups[0].inv.cleaner === 0);
  t('ล้างชายหาด: Undo คืนอุปกรณ์', M.undoEvent().ok && JSON.stringify(S.groups) === before);
});

test('เงินไม่พอจ่าย ใช้กติกาสำรอง', () => {
  const S = fresh();
  S.groups[4].money = 60;
  M.drawEvent('rain'); let pv = M.computePreview();
  t('กติกา zero_env: เงินเหลือ 0 และหัก Environment เพิ่ม 5', pv[4].newMoney === 0 && pv[4].short === 140 && pv[4].newEnv === 95);
  M.confirmEvent();
  S.settings.fallback = 'zero'; S.groups[4].money = 60; S.groups[4].env = 100;
  M.drawEvent('rain'); pv = M.computePreview();
  t('กติกา zero: เงินเหลือ 0 ไม่หัก Environment', pv[4].newMoney === 0 && pv[4].newEnv === 100); M.confirmEvent();
  t('เงินไม่ติดลบ', S.groups.every(g => g.money >= 0));
});

test('คลังเหตุการณ์', () => {
  const S = fresh();
  const n = M.EVENTS.length;
  t('มีเหตุการณ์อย่างน้อย 21 แบบ', n >= 21);
  const seen = new Set(); S.deck = []; S.pending = null;
  for (let i = 0; i < n; i++) { M.drawEvent(); seen.add(S.pending.eventId); S.pending = null; }
  t('สุ่มครบกองโดยไม่ซ้ำ', seen.size === n);
  S.deck = []; M.drawEvent();
  const id = S.pending.eventId, len = S.deck.length;
  M.cancelPending();
  t('ยกเลิกแล้วเหตุการณ์กลับเข้ากอง', S.deck.length === len + 1 && S.deck.includes(id));
  let bad = 0;
  for (const ev of M.EVENTS) {
    S.pending = null; M.drawEvent(ev.id); if (ev.lottery) S.pending.win = 5;
    M.computePreview().forEach(r => { if (r.newMoney < 0 || r.newEnv < 0 || r.newEnv > 100 || !Number.isInteger(r.newMoney)) bad++; });
  }
  S.pending = null;
  t('ทุกเหตุการณ์ให้ผลที่เงินไม่ติดลบและ Environment อยู่ใน 0-100', bad === 0);
  M.init(); M.startGame();
  t('ปรับเงินให้ติดลบไม่ได้', !M.adjustValue(0, 'money', -99999).ok);
  M.adjustValue(0, 'env', 50);
  t('ปรับ Environment แล้วไม่เกิน 100', M.S.groups[0].env <= 100);
});

test('คะแนนท้ายเกม', () => {
  const S = fresh(); const g = S.groups;
  t('เกณฑ์เงินเริ่มต้น 600', M.moneyCap() === 600);
  g[0].money = 800; g[0].env = 60;   // 50 + 30 = 80
  g[1].money = 300; g[1].env = 80;   // 25 + 40 = 65
  g[2].money = 1500; g[2].env = 60;  // 50 + 30 = 80 เสมอกับกลุ่ม 1
  g[3].money = 300; g[3].env = 70;   // 25 + 35 = 60
  g[4].money = 450; g[4].env = 50;   // 37.5 + 25 = 62.5
  let sb = M.scoreboard();
  t('คะแนนกลุ่ม 1 = 80', sb.find(r => r.g.id === 0).total === 80);
  t('เงินเกินเกณฑ์ไม่ได้คะแนนเพิ่ม', sb.find(r => r.g.id === 2).mScore === 50);
  t('คะแนนและ Environment เท่ากันถือว่าเสมอ', sb.find(r => r.g.id === 0).rank === 1 && sb.find(r => r.g.id === 2).rank === 1 && sb.find(r => r.g.id === 0).tied);
  t('คะแนนกลุ่ม 5 = 62.5', sb.find(r => r.g.id === 4).total === 62.5);
  g[2].env = 61; sb = M.scoreboard();
  t('คะแนนเท่ากัน Environment สูงกว่าชนะ', sb[0].g.id === 2 && sb[0].rank === 1 && sb.find(r => r.g.id === 0).rank === 2);
  S.settings.moneyCap = 1000; sb = M.scoreboard();
  t('เปลี่ยนเกณฑ์เงินในตั้งค่าแล้วคะแนนเปลี่ยนตาม', sb.find(r => r.g.id === 0).mScore === 40);
  S.settings.moneyCap = 600;
  t('มีข้อความสรุปเหตุผล', M.reasonText(sb[0]).length > 10);
});

test('บันทึกข้อมูลทุกกลุ่ม', () => {
  const S = fresh();
  const data = S.groups.map(x => ({ gid: x.id, money: x.money, env: x.env, inv: {}, tickets: [] }));
  t('ไม่มีการเปลี่ยนแปลงจะไม่บันทึก', !M.applyEntry(data).ok);
  data[0].money = 730; data[0].inv = { umbrella: 2, cup: 1 }; data[0].tickets = [1, 9]; data[1].env = 85;
  t('สรุปการเปลี่ยนแปลง 2 กลุ่ม', M.entryDiff(data).length === 2);
  t('บันทึกแล้วค่าตรงกับที่กรอก', M.applyEntry(data).ok && S.groups[0].money === 730 && S.groups[0].inv.umbrella === 2 && S.groups[0].tickets.join() === '1,9' && S.groups[1].env === 85);
  t('ลงประวัติกลุ่มละ 1 รายการ', S.history.filter(h => h.type === 'manual').length === 2);
  data[0].inv = { umbrella: 0, cup: 1 };
  t('ลดจำนวนสินค้าเป็น 0 แล้วลบออกจาก Inventory', M.applyEntry(data).ok && S.groups[0].inv.umbrella === undefined);

  M.drawEvent('rain'); data[2].money = 50;
  t('บันทึกข้อมูลระหว่างมีเหตุการณ์รอยืนยันได้', M.applyEntry(data).ok);
  const pv = M.computePreview();
  t('ตัวอย่างผลคำนวณใหม่ตามค่าที่กรอก', pv[2].short === 150 && pv[2].newMoney === 0);
  M.cancelPending();

  M.drawEvent('lottery'); [0, 1, 2, 3, 4].forEach(i => M.lockTickets(i));
  data[3].tickets = [4]; M.applyEntry(data);
  t('เปลี่ยนเลขหวยแล้วกลุ่มนั้นต้องยืนยันเลขใหม่', !S.pending.locked[3] && S.pending.locked[0]);
  M.lockTickets(3); M.drawWinning(); data[3].tickets = [5];
  t('หลังสุ่มเลขรางวัลแล้วแก้เลขหวยไม่ได้', !M.applyEntry(data).ok && S.groups[3].tickets.join() === '4');
});

test('จบเกมและรีเซ็ต', () => {
  const S = fresh();
  M.drawEvent('rain');
  t('จบเกมไม่ได้ถ้ายังมีเหตุการณ์ค้าง', !M.endGame().ok);
  M.cancelPending();
  t('จบเกมได้', M.endGame().ok);
  t('ซื้อสินค้าหลังจบเกมไม่ได้', !M.buyProduct(0, 'umbrella').ok);
  M.resetGame(false);
  t('รีเซ็ตแล้วกลับค่าเริ่มต้น', M.S.groups.every(g => g.money === 1000 && g.env === 100) && M.S.history.length === 0 && !M.S.started);
});
