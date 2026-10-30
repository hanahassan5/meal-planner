/*
 * خوارزمية تقسيم الكالوريز
 * 1) الخضار تاخد حصة ثابتة (وحدة واحدة أو أقل كمية مسموحة)
 * 2) الباقي يتوزع على الأدوار (بروتين / نشويات / دهون / فاكهة) بنسب حسب الهدف
 * 3) كل دور يتقسم بالتساوي على الأصناف اللي فيه، ويتقرّب لأقرب وحدة منطقية
 * 4) تحسين تدريجي (hill climbing): نزوّد أو نقلل وحدة من أي صنف
 *    لحد ما نقرب من الهدف من غير ما نبوّظ توازن الأدوار
 */

const GOALS = {
  balanced: { label: "متوازن",     shares: { protein: 0.35, carb: 0.38, fat: 0.15, fruit: 0.12 } },
  cut:      { label: "تخسيس",      shares: { protein: 0.45, carb: 0.30, fat: 0.15, fruit: 0.10 } },
  bulk:     { label: "بناء عضل",   shares: { protein: 0.32, carb: 0.45, fat: 0.13, fruit: 0.10 } },
};

const kcalPerUnit = (food) => (food.kcal * food.unit.g) / 100;

function roundToStep(qty, food) {
  const r = Math.round(qty / food.step) * food.step;
  return Math.min(food.max, Math.max(food.min, +r.toFixed(2)));
}

function itemStats(food, qty) {
  const grams = qty * food.unit.g;
  const k = grams / 100;
  return {
    grams,
    kcal: food.kcal * k,
    p: food.p * k,
    c: food.c * k,
    f: food.f * k,
  };
}

function totals(items) {
  return items.reduce(
    (t, it) => {
      const s = itemStats(it.food, it.qty);
      t.kcal += s.kcal; t.p += s.p; t.c += s.c; t.f += s.f;
      return t;
    },
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

function planMeal(selectedFoods, targetKcal, goalKey = "balanced") {
  if (!selectedFoods.length) return { error: "لازم يتختار صنف واحد على الأقل." };
  if (!(targetKcal > 0)) return { error: "محتاجين عدد السعرات المطلوبة للوجبة." };

  const goal = GOALS[goalKey] || GOALS.balanced;
  const byRole = {};
  selectedFoods.forEach((f) => (byRole[f.role] ||= []).push(f));

  // 1) الخضار: كمية ثابتة مبدئية
  const items = [];
  let vegKcal = 0;
  (byRole.veg || []).forEach((food) => {
    const qty = roundToStep(food.unit.g === 1 ? Math.max(food.min, 100) : 1, food);
    items.push({ food, qty });
    vegKcal += itemStats(food, qty).kcal;
  });

  // 2) نسب الأدوار الموجودة فعلًا (نعيد التوزيع لو دور مش موجود)
  const present = Object.keys(goal.shares).filter((r) => byRole[r]);
  const shareSum = present.reduce((s, r) => s + goal.shares[r], 0) || 1;
  const remaining = Math.max(0, targetKcal - vegKcal);
  const roleTargets = {};
  present.forEach((r) => (roleTargets[r] = (remaining * goal.shares[r]) / shareSum));
  if (byRole.veg) roleTargets.veg = vegKcal;

  // 3) توزيع مبدئي داخل كل دور
  present.forEach((role) => {
    const foods = byRole[role];
    const each = roleTargets[role] / foods.length;
    foods.forEach((food) => items.push({ food, qty: roundToStep(each / kcalPerUnit(food), food) }));
  });

  // 4) تحسين تدريجي
  const cost = (its) => {
    const t = totals(its).kcal;
    let roleDev = 0;
    for (const role in roleTargets) {
      const rk = its.filter((i) => i.food.role === role).reduce((s, i) => s + itemStats(i.food, i.qty).kcal, 0);
      roleDev += Math.abs(rk - roleTargets[role]);
    }
    return Math.abs(t - targetKcal) + 0.25 * roleDev;
  };

  let current = cost(items);
  for (let iter = 0; iter < 200; iter++) {
    let best = null;
    items.forEach((it, idx) => {
      [it.food.step, -it.food.step].forEach((d) => {
        const q = +(it.qty + d).toFixed(2);
        if (q < it.food.min - 1e-9 || q > it.food.max + 1e-9) return;
        const old = it.qty;
        it.qty = q;
        const c = cost(items);
        it.qty = old;
        if (c < current - 0.5 && (!best || c < best.c)) best = { idx, q, c };
      });
    });
    if (!best) break;
    items[best.idx].qty = best.q;
    current = best.c;
  }

  const t = totals(items);
  const diff = t.kcal - targetKcal;
  let warning = null;
  if (diff < -targetKcal * 0.08) warning = "الأصناف المختارة مش كفاية توصل للسعرات المطلوبة حتى بأقصى كمية معقولة. الأفضل إضافة صنف كمان.";
  if (diff > targetKcal * 0.08) warning = "أقل كمية منطقية من الأصناف دي أكتر من السعرات المطلوبة. الأفضل شيل صنف أو زيادة السعرات.";

  const order = ["protein", "carb", "veg", "fat", "fruit"];
  items.sort((a, b) => order.indexOf(a.food.role) - order.indexOf(b.food.role));

  return { items, totals: t, target: targetKcal, diff, warning, goal: goalKey };
}

/* ===== تنسيق الكميات ===== */
const FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

function formatQty(food, qty) {
  if (food.unit.g === 1) return `${Math.round(qty)} ${food.unit.name}`;
  const whole = Math.floor(qty + 1e-9);
  const frac = +(qty - whole).toFixed(2);
  const fracStr = FRACTIONS[frac] || (frac ? frac.toString() : "");
  const num = whole && fracStr ? `${whole}${fracStr}` : whole ? `${whole}` : fracStr;
  return `${num} ${food.unit.name}`;
}

if (typeof module !== "undefined") module.exports = { planMeal, formatQty, itemStats, totals, GOALS };
