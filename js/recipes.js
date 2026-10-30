/*
 * محرك الوصفات
 * ─────────────────────────────────────────────────────────────
 * قاعدتين ما ينفعش يتكسروا:
 *  1) الوصفة ما تذكرش أي مكون مش في السلة (المسموح زيادة: ملح ومية).
 *  2) كل صنف في السلة بيدخل بكميته كاملة: يا في وجبة واحدة،
 *     يا الأصناف تتقسم على وجبتين. مفيش صنف يتساب أو يتحط "جنب الطبق".
 *
 * كل قالب ليه:
 *  - accept(item): يقدر يستوعب الصنف ده جوه الطبق ولا لأ
 *  - core(ctx):    الحد الأدنى اللي لازم يكون موجود عشان الطبق يتعمل
 *  - build(ctx,B): بيكتب الخطوات. بعد البناء، لو فيه صنف ما اتذكرش ← القالب مرفوض
 *
 * المحرك بيجرب كل القوالب على السلة كلها (وجبة واحدة)،
 * وعلى كل تقسيمة ممكنة للسلة لمجموعتين (وجبتين).
 */

/* ================= أدوات ================= */
function joinAr(arr) {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a.join("");
  return a.slice(0, -1).join("، ") + " و" + a[a.length - 1];
}
function short(name) {
  return name.split(" (")[0].replace(" مصفّاة", "").replace(" بالزيت", "").replace(" مسلوقة", "").replace(" مسلوق", "").trim();
}
function bi(name) {
  const n = short(name);
  if (n.includes(" ")) return "ب" + n;
  return n.startsWith("ال") ? "ب" + n : "بال" + n;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================= مجموعات الأنواع ================= */
const G = {
  pCook: ["poultry", "meat", "liver", "seafood", "fish", "tofu", "kofta", "sausage", "mince"],
  pReady: ["tuna", "fish_ready", "deli", "egg", "foul", "beans", "lentil", "chickpea", "falafel", "lupini", "dip", "pane", "shawarma"],
  cheese: ["cheese_soft", "cheese_hard", "cheese_melt"],
  carb: ["rice", "grain", "pasta", "potato", "sweetpotato", "root", "corn", "fries", "noodles"],
  bread: ["bread_flat", "bread_loaf", "toast", "wrap", "cracker", "pastry"],
  savFat: ["oil", "butter", "tahini", "nuts", "seeds", "olives", "avocado", "mayo", "cream"],
  sauceFat: ["tahini", "mayo", "dip"],
  sweet: ["fruit", "dried", "sweet", "choc", "halawa", "icecream"],
  sweetFat: ["nuts", "seeds", "nutbutter", "coconut", "butter"],
};
const isK = (it, ...groups) => groups.some((g) => (G[g] || [g]).includes(it.food.kind));
const SALAD_FRUIT = ["apple", "orange", "mandarin", "pomegranate", "grapes", "strawberry", "mango", "pear", "figs", "kiwi", "pineapple", "raisins", "dates", "blueberry"];
const GRILL_FRUIT = ["apple", "banana", "peach", "pear", "pineapple", "figs", "mango", "apricot"];

/* ================= السياق ================= */
function buildCtx(items, flavors, rng) {
  return {
    items, rng,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    of: (...kinds) => items.filter((i) => kinds.some((k) => (G[k] || [k]).includes(i.food.kind))),
    ids: (...ids) => items.filter((i) => ids.includes(i.food.id)),
    veg: () => items.filter((i) => i.food.role === "veg"),
    vegRaw: () => items.filter((i) => i.food.role === "veg" && i.food.raw),
    vegCook: () => items.filter((i) => i.food.role === "veg" && !i.food.rawOnly),
    F: (t) => flavors.filter((f) => f.t === t).map((f) => f.name),
    spices: (ex = ["bayleaf"]) => flavors.filter((f) => f.t === "spice" && !ex.includes(f.id)).map((f) => f.name),
    flavor: (id) => flavors.find((f) => f.id === id),
  };
}

/* ================= البنّاء ================= */
function makeBuilder(ctx) {
  const used = new Set();
  const B = {
    used,
    fatUsed: false,
    free: (list) => list.filter((it) => !used.has(it.food.id)),
    q(it) { used.add(it.food.id); return `${it.food.name} (${formatQty(it.food, it.qty)})`; },
    L(list) { return joinAr(list.map((it) => B.q(it))); },

    season() { return joinAr(["ملح", ...ctx.F("garlic"), ...ctx.spices()]); },
    dressSpices() { return ctx.spices(["bayleaf", "rosemary", "turmeric", "ginger", "mixedspice"]); },
    sweetSpice() { return joinAr(ctx.F("sweet")); },
    herbs() { return joinAr(ctx.F("herb")); },
    acid() {
      const o = [];
      if (ctx.flavor("lemon")) o.push("عصرة ليمون");
      if (ctx.flavor("vinegar")) o.push("رشة خل");
      if (ctx.flavor("pommolasses")) o.push("رشة دبس رمان");
      return joinAr(o);
    },

    cookIn() {
      if (B.fatUsed) return "في نفس الطاسة";
      B.fatUsed = true;
      const fats = B.free(ctx.of("oil", "butter"));
      if (fats.length) return `في ${B.L(fats)}`;
      return "في طاسة تيفال من غير زيت (ولو لزقت، رشة مية)";
    },
    ovenLine() {
      const fats = B.free(ctx.of("oil", "butter"));
      if (!B.fatUsed && fats.length) { B.fatUsed = true; return `بعد ما يتقلب في ${B.L(fats)}`; }
      return "على ورق زبدة من غير زيت";
    },

    /* صوص بيستوعب كل الطحينة/الزبادي/المايونيز/الدِب المتاحين */
    sauce() {
      const tah = B.free(ctx.of("tahini")), yog = B.free(ctx.of("yogurt")), may = B.free(ctx.of("mayo")), dip = B.free(ctx.of("dip"));
      const parts = [];
      const acid = B.acid(), garlic = joinAr(ctx.F("garlic")), herbs = B.herbs();
      if (tah.length && yog.length) parts.push(`صوص طحينة بالزبادي: ${B.L(tah)} مع ${B.L(yog)}${acid ? " و" + acid : ""} وملح، ويتخفف بمية لحد ما يبقى ناعم`);
      else if (tah.length) parts.push(`صوص طحينة: ${B.L(tah)} مع مية بالراحة${acid ? " و" + acid : ""} وملح لحد ما يبقى زي الكريمة`);
      else if (yog.length) parts.push(`صوص زبادي: ${B.L(yog)} مع ملح${garlic ? " و" + garlic + " مهروس" : ""}${herbs ? " و" + herbs + " مفروم" : ""}`);
      if (may.length) parts.push(`صوص مايونيز: ${B.L(may)}${ctx.F("sauce").length ? " متقلب مع " + joinAr(ctx.F("sauce")) : ""}`);
      if (dip.length) parts.push(`${B.L(dip)} كصوص للتغميس`);
      return parts.join("، و");
    },

    /* إضافات على الوش: زيت، مكسرات، بذور، زيتون، أفوكادو */
    topping() {
      const t = B.free(ctx.of("oil", "nuts", "seeds", "olives", "avocado"));
      if (!t.length) return "";
      const nuts = t.filter((i) => isK(i, "nuts", "seeds"));
      return `على الوش في الآخر: ${B.L(t)}${nuts.length ? " (المكسرات والبذور أحلى لو اتحمصت دقيقتين في طاسة ناشفة)" : ""}`;
    },

    cookProtein(it, mode) {
      const k = it.food.kind, s = B.season();
      if (mode === "strips" && k === "poultry") return `تقطيع ${B.q(it)} شرايط رفيعة وتتبيلها بـ${s}، وتشويحها على نار عالية ${B.cookIn()} 6–7 دقايق`;
      switch (k) {
        case "poultry": return `تتبيل ${B.q(it)} بـ${s}، وشيّه ${B.cookIn()} أو في الفرن 20–25 دقيقة لحد ما يستوي من جوه ويحمر من برا`;
        case "meat": return `تقطيع ${B.q(it)} شرايح رفيعة وتتبيلها بـ${s}، وتشويحها على نار عالية ${B.cookIn()} 5–7 دقايق`;
        case "liver": return `تقطيع ${B.q(it)} شرايط رفيعة وتشويحها على نار عالية ${B.cookIn()} 4–5 دقايق بس عشان تفضل طرية`;
        case "mince": return `تشويح ${B.q(it)} ${B.cookIn()} مع ${s} وتفريطها بالمعلقة لحد ما تحمر`;
        case "kofta": return `شوي ${B.q(it)} على جريل أو في الفرن 15 دقيقة مع التقليب`;
        case "sausage": return `تقطيع ${B.q(it)} حلقات وتحميرها ${B.cookIn()}`;
        case "fish": return `تتبيل ${B.q(it)} بـ${s} وشيّه في الفرن ${B.ovenLine()} 15–20 دقيقة`;
        case "seafood": return `تتبيل ${B.q(it)} بـ${s} وتشويحه ${B.cookIn()} 3–4 دقايق بس لحد ما يحمر`;
        case "tofu": return `تقطيع ${B.q(it)} مكعبات وتنشيفه بفوطة، وتحميره ${B.cookIn()} لحد ما يقرمش`;
        case "egg": return `سلق ${B.q(it)} 8 دقايق وتقطيعه أنصاص`;
        case "tuna": return `تصفية ${B.q(it)} وتفريطها بالشوكة`;
        case "fish_ready": return `تقطيع ${B.q(it)} قطع صغيرة`;
        case "deli": return `تقطيع ${B.q(it)} شرايط وتحميرها ثواني في طاسة سخنة عشان تقرمش`;
        case "cheese_melt": return `شوي ${B.q(it)} في طاسة سخنة لحد ما تحمر من الوشين`;
        case "cheese_soft": case "cheese_hard": return `تقطيع ${B.q(it)} مكعبات صغيرة`;
        case "foul": case "beans": return `تسخين ${B.q(it)} مع ${s}`;
        case "lentil": return `سلق ${B.q(it)} في مية وملح لحد ما يستوي ويفضل حباية`;
        case "chickpea": return `تنشيف ${B.q(it)} وتحميصه في الفرن ${B.ovenLine()} 20 دقيقة لحد ما يقرمش`;
        case "falafel": return `تسخين ${B.q(it)} في الفرن أو الإير فراير`;
        case "lupini": return `تقشير ${B.q(it)}`;
        case "dip": return `فرد ${B.q(it)} في قاع الطبق`;
        case "pane": return `تسخين ${B.q(it)} في الفرن أو الإير فراير لحد ما يقرمش، وتقطيعه شرايط`;
        case "shawarma": return `تحمير ${B.q(it)} في طاسة سخنة ${B.fatUsed ? "" : "من غير زيت "}لحد ما الأطراف تقرمش`;
        default: return `تجهيز ${B.q(it)}`;
      }
    },

    carbPrep(it) {
      const k = it.food.kind;
      const raw = (f) => Math.max(10, Math.round((it.qty * f) / 5) * 5);
      if (k === "rice" || k === "grain") return `طبخ ${B.q(it)} عادي بالمية والملح (يعني حوالي ${raw(0.4)} جم ني)`;
      if (k === "pasta") return `سلق ${B.q(it)} في مية وملح (يعني حوالي ${raw(0.45)} جم ني)`;
      if (k === "potato" || k === "sweetpotato" || k === "root") return `تقطيع ${B.q(it)} مكعبات وتسويتها في الفرن ${B.ovenLine()} لحد ما تحمر`;
      if (k === "fries") return `تسخين ${B.q(it)} في الفرن أو الإير فراير لحد ما تقرمش`;
      if (k === "corn") return `سلق ${B.q(it)} وفرط الحبوب`;
      if (k === "noodles") return `سلق ${B.q(it)} دقيقتين بس`;
      return `تجهيز ${B.q(it)}`;
    },

    /* الخضار: الني يتقطع، والباقي يتشوح */
    vegSteps(list, preferRaw = true) {
      const out = [];
      const raw = list.filter((v) => preferRaw && v.food.raw);
      const cook = list.filter((v) => !raw.includes(v));
      if (cook.length) out.push(`تشويح ${B.L(cook)} مقطعين ${B.cookIn()} لحد ما يحمروا من الأطراف`);
      if (raw.length) out.push(`تقطيع ${B.L(raw)} شرايح رفيعة أو مكعبات صغيرة`);
      return out;
    },
  };
  return B;
}

/* ================= القوالب ================= */
const TEMPLATES = [];
const T = (def) => TEMPLATES.push(def);
const breadName = (b) => short(b.food.name);

/* ---------- حادق ---------- */

T({ id: "bowl", taste: "savory",
  accept: (i) => isK(i, "pCook", "pReady", "cheese", "carb", "savFat", "yogurt") || (i.food.role === "veg" && i.food.kind === "veg"),
  core: (c) => c.of("pCook", "pReady", "cheese").length && c.of("carb").length,
  build: (c, B) => {
    const prot = c.of("pCook", "pReady", "cheese"), carb = c.of("carb");
    const steps = [];
    carb.forEach((x) => steps.push(B.carbPrep(x)));
    prot.forEach((p) => steps.push(B.cookProtein(p)));
    steps.push(...B.vegSteps(c.veg()));
    steps.push(`التجميع في بولة: ${joinAr(carb.map((x) => short(x.food.name)))} تحت، و${joinAr(prot.map((p) => short(p.food.name)))} في النص، والخضار حواليهم في أقسام`);
    const s = B.sauce(); if (s) steps.push(s + "، ويتصب على الوش");
    const t = B.topping(); if (t) steps.push(t);
    if (c.flavor("soy")) steps.push("رشة صوص صويا على الوش");
    if (B.herbs()) steps.push(`تزيين بـ${B.herbs()}`);
    return { name: `بول ${short(prot[0].food.name)} ${c.flavor("soy") ? "على طريقة البوكي" : c.pick(["المتكامل", "بالخضار"])}`, time: "25 دقيقة", steps, tip: "كل مكوّن في قسم لوحده، عشان الطبق يبان مرتب وكل طعم يفضل واضح." };
  },
});

T({ id: "wrap", taste: "savory",
  accept: (i) => isK(i, "pCook", "pReady", "cheese", "bread", "savFat", "yogurt", "fries", "potato") || i.food.kind === "veg",
  core: (c) => c.of("bread_flat", "wrap", "toast", "bread_loaf").length && c.of("pCook", "pReady", "cheese").length,
  build: (c, B) => {
    const bread = c.of("bread_flat", "wrap", "toast", "bread_loaf", "cracker", "pastry");
    const prot = c.of("pCook", "pReady", "cheese"), pot = c.of("fries", "potato");
    const roll = ["bread_flat", "wrap"].includes(bread[0].food.kind);
    const steps = [];
    prot.forEach((p) => steps.push(B.cookProtein(p)));
    pot.forEach((p) => steps.push(B.carbPrep(p)));
    const raw = c.veg().filter((v) => v.food.raw), cook = c.veg().filter((v) => !v.food.raw);
    if (cook.length) steps.push(`تشويح ${B.L(cook)} شرايط ${B.cookIn()}`);
    if (raw.length) steps.push(`تقطيع ${B.L(raw)} شرايح رفيعة`);
    const s = B.sauce(); if (s) steps.push(s);
    const fillers = [...prot, ...pot].map((x) => short(x.food.name));
    if (roll) {
      steps.push(`فرد ${B.L(bread)}، ورص ${joinAr(fillers)} والخضار${s ? " والصوص" : ""} في خط في النص`);
      const t = B.topping(); if (t) steps.push(t.replace("على الوش في الآخر", "جوه الرول قبل اللف"));
      steps.push(`لفه رول محكم، وتحميره في طاسة سخنة دقيقة على كل جنب عشان يقفل ويقرمش`);
    } else {
      steps.push(`تحميص ${B.L(bread)}، وحشوه بـ${joinAr(fillers)} والخضار${s ? " والصوص" : ""}`);
      const t = B.topping(); if (t) steps.push(t.replace("على الوش في الآخر", "جوه الساندوتش"));
      steps.push(`كبسه في الطاسة بغطا تقيل دقيقة على كل وش زي البانيني`);
    }
    return { name: roll ? `رول ${short(prot[0].food.name)} المقرمش` : `ساندوتش ${short(prot[0].food.name)} بانيني`, time: "15 دقيقة", steps, tip: "اللف في ورق زبدة بيمسك الساندوتش وبيخلي أكله أسهل." };
  },
});

T({ id: "shakshuka", taste: "savory",
  accept: (i) => isK(i, "egg", "cheese", "deli", "sausage", "mince", "foul", "bread", "oil", "butter", "olives") || i.food.kind === "veg",
  core: (c) => c.of("egg").length && c.ids("tomato", "cherrytomato").length,
  build: (c, B) => {
    const egg = c.of("egg"), tom = c.ids("tomato", "cherrytomato");
    const other = c.vegCook().filter((v) => !tom.includes(v));
    const fresh = c.veg().filter((v) => v.food.rawOnly);
    const meat = c.of("deli", "sausage", "mince"), foul = c.of("foul"), cheese = c.of("cheese");
    const steps = [];
    meat.forEach((m) => steps.push(B.cookProtein(m)));
    steps.push(other.length ? `تقطيع ${B.L(other)} صغير وتشويحهم ${B.cookIn()} لحد ما يدبلوا` : `تسخين ${B.cookIn().replace(/^في /, "")}`);
    steps.push(`بشر ${B.L(tom)} وإضافتها مع ${B.season()}${c.flavor("tomatopaste") ? " ومعلقة صلصة طماطم" : ""}، وتسبيكها 5 دقايق`);
    if (foul.length) steps.push(`إضافة ${B.L(foul)} للصلصة وتقليبه دقيقة`);
    steps.push(`عمل حفر صغيرة في الصلصة، وكسر ${B.L(egg)} فيها، وتغطية الطاسة على نار هادية 4–6 دقايق`);
    if (cheese.length) steps.push(`تفتيت ${B.L(cheese)} فوق البيض آخر دقيقتين`);
    const ol = B.free(c.of("olives")); if (ol.length) steps.push(`${B.L(ol)} مقطع حلقات على الوش`);
    if (B.herbs()) steps.push(`تزيين بـ${B.herbs()}`);
    if (fresh.length) steps.push(`سلطة صغيرة على نفس الصينية: ${B.L(fresh)} مقطع شرايح`);
    const bread = c.of("bread"); if (bread.length) steps.push(`تحميص ${B.L(bread)} للتغميس من الطاسة مباشرة`);
    const name = foul.length ? "شكشوكة بالفول" : meat.length ? `شكشوكة ${bi(meat[0].food.name)}` : cheese.length ? "شكشوكة بالجبنة" : "شكشوكة";
    return { name, time: "15 دقيقة", steps, tip: "الطاسة تتقدم زي ما هي على السفرة." };
  },
});

T({ id: "omelette", taste: "savory",
  accept: (i) => isK(i, "egg", "cheese", "deli", "sausage", "mince", "poultry", "tuna", "potato", "oil", "butter", "milk", "bread", "olives") || i.food.kind === "veg",
  core: (c) => c.of("egg").length,
  build: (c, B) => {
    const egg = c.of("egg"), milk = c.of("milk");
    const cooked = c.of("mince", "poultry", "sausage", "deli");
    const pot = c.of("potato"), veg = c.vegCook().filter((v) => !v.food.raw || ["onion", "pepper", "mushroom", "spinach", "tomato", "greenonion"].includes(v.food.id)), fill = c.of("cheese", "tuna", "olives");
    const fresh = c.veg().filter((v) => !veg.includes(v));
    const bread = c.of("bread");
    const steps = [];
    cooked.forEach((x) => steps.push(B.cookProtein(x)));
    pot.forEach((p) => steps.push(`تقطيع ${B.q(p)} مكعبات صغيرة وتحميرها ${B.cookIn()}`));
    if (veg.length) steps.push(`تقطيع ${B.L(veg)} صغير وتشويحهم ${B.cookIn()} دقيقتين`);
    steps.push(`خفق ${B.L(egg)}${milk.length ? ` مع ${B.L(milk)}` : ""} و${B.season()}`);
    steps.push(`صبه ${B.cookIn()} على نار متوسطة، وتحريك الطاسة لحد ما يبقى طبقة رفيعة`);
    const inside = [...cooked, ...pot, ...veg].map((x) => short(x.food.name));
    const fillTxt = fill.length ? B.L(fill) : "";
    steps.push(`أول ما الوش يقرب يمسك: توزيع ${joinAr([...inside, fillTxt])} على نصه، وقفله زي الكتاب`);
    if (B.herbs()) steps.push(`رشة ${B.herbs()} على الوش`);
    if (fresh.length) steps.push(`جنبه على نفس الطبق: ${B.L(fresh)} مقطع شرايح`);
    if (bread.length) steps.push(`لفه في ${B.L(bread)} سخن، أو تقطيعه وتقديمه عليه`);
    if (!inside.length && !fill.length) return null;
    return { name: bread.length ? "أومليت ملفوف في العيش" : c.pick(["أومليت محشي", "أومليت فرنساوي متحشي"]), time: "10 دقايق", steps };
  },
});

T({ id: "board", taste: "savory",
  accept: (i) => isK(i, "cheese", "egg", "foul", "falafel", "deli", "dip", "lupini", "fish_ready", "tuna", "bread", "oil", "tahini", "olives", "yogurt", "milk", "juice", "sweet", "halawa", "fruit", "dried", "nuts", "avocado", "pane") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("cheese", "egg", "foul", "falafel", "deli", "dip").length >= 1 && c.items.length >= 3,
  build: (c, B) => {
    const steps = [];
    const hot = c.of("egg", "foul", "falafel", "deli", "pane");
    hot.forEach((h) => steps.push(B.cookProtein(h)));
    const cheese = c.of("cheese"), cold = c.of("tuna", "fish_ready", "lupini", "dip");
    if (cheese.length) steps.push(`رص ${B.L(cheese)} في طبق صغير${c.flavor("thyme") || c.flavor("mint") ? ` ورشة ${joinAr([c.flavor("thyme") ? "زعتر" : "", c.flavor("mint") ? "نعناع" : ""])}` : ""}${B.free(c.of("oil")).length ? ` وفوقها ${B.L(B.free(c.of("oil")))}` : ""}`);
    cold.forEach((x) => steps.push(B.cookProtein(x)));
    const raw = c.vegRaw(); if (raw.length) steps.push(`تقطيع ${B.L(raw)} شرايح ورصهم في طبق جنب الجبنة`);
    const extras = c.of("olives", "tahini", "yogurt", "avocado", "nuts");
    if (extras.length) steps.push(`أطباق صغيرة فيها ${B.L(extras)}`);
    const sweet = c.of("sweet", "halawa", "fruit", "dried");
    if (sweet.length) steps.push(`ركن حلو في الصينية: ${B.L(sweet)}`);
    const milk = c.of("milk", "juice"); if (milk.length) steps.push(`والمشروب: ${B.L(milk)}`);
    const bread = c.of("bread");
    steps.push(bread.length ? `تحميص ${B.L(bread)} وتقديم الصينية كلها مرة واحدة` : "تقديم الصينية كلها مرة واحدة");
    return { name: c.pick(["صينية فطار مصري", "فطار الجمعة", "طبق فطار متكامل"]), time: "15 دقيقة", steps, tip: "التقسيم على أطباق صغيرة كتير بيخلي الصينية شكلها أغنى." };
  },
});

T({ id: "salad", taste: "savory",
  accept: (i) => isK(i, "pReady", "pCook", "cheese", "grain", "pasta", "potato", "corn", "bread_flat", "toast", "cracker", "savFat", "yogurt") && !isK(i, "dip", "falafel", "foul") || (i.food.kind === "veg" && i.food.raw) || SALAD_FRUIT.includes(i.food.id) || i.food.id === "honey",
  core: (c) => c.vegRaw().length >= 1 && c.items.length >= 2,
  build: (c, B) => {
    const steps = [];
    const prot = c.of("pReady", "pCook", "cheese"), carbs = c.of("grain", "pasta", "potato", "corn");
    const bread = c.of("bread_flat", "toast", "cracker"), fruit = c.items.filter((i) => SALAD_FRUIT.includes(i.food.id));
    prot.forEach((p) => steps.push(B.cookProtein(p)));
    carbs.forEach((x) => steps.push(B.carbPrep(x) + "، وتسيبه يبرد"));
    steps.push(`تقطيع ${B.L(c.vegRaw())} مكعبات بنفس الحجم`);
    if (fruit.length) steps.push(`تقطيع ${B.L(fruit)} صغير للمسة حلوة`);
    if (bread.length) steps.push(`تقطيع ${B.L(bread)} مربعات وتحميصها في الفرن لحد ما تقرمش`);
    const dress = [];
    const oil = B.free(c.of("oil")); if (oil.length) dress.push(B.L(oil));
    if (B.acid()) dress.push(B.acid());
    if (c.flavor("mustard")) dress.push("مسطردة");
    const honey = B.free(c.ids("honey")); if (honey.length) dress.push(B.L(honey));
    if (dress.length) steps.push(`دريسنج: ${joinAr(dress)} وملح${B.dressSpices().length ? " و" + joinAr(B.dressSpices()) : ""}، يترج في برطمان مقفول`);
    const s = B.sauce(); if (s) steps.push(s);
    const t = B.topping(); if (t) steps.push(t);
    steps.push(`تقليب الكل قبل الأكل على طول${bread.length ? "، والعيش آخر حاجة عشان يفضل مقرمش" : ""}${B.herbs() ? `، وفوقهم ${B.herbs()}` : ""}`);
    if (!dress.length && !s) steps.splice(steps.length - 1, 0, `تتبيل بملح${B.dressSpices().length ? " و" + joinAr(B.dressSpices()) : ""}`);
    const base = prot[0] || carbs[0];
    const name = bread.length ? `فتوش ${base ? bi(base.food.name) : "بالخضار"}` : base ? `سلطة ${short(base.food.name)} ${c.pick(["المقرمشة", "الصيفي"])}` : "سلطة الموسم";
    return { name, time: "15 دقيقة", steps };
  },
});

T({ id: "pasta", taste: "savory",
  accept: (i) => isK(i, "pasta", "pCook", "tuna", "deli", "cheese", "cream", "milk", "oil", "butter", "olives") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("pasta").length && c.items.length >= 2,
  build: (c, B) => {
    const pasta = c.of("pasta"), prot = c.of("pCook", "tuna", "deli");
    const tom = c.ids("tomato", "cherrytomato"), veg = c.vegCook().filter((v) => !tom.includes(v));
    const cream = c.of("cream", "milk"), cheese = c.of("cheese");
    const style = cream.length ? "وايت صوص" : tom.length || c.flavor("tomatopaste") ? "بصوص الطماطم" : cheese.length && !prot.length ? "بالجبنة" : "سوتيه";
    const steps = [];
    pasta.forEach((p) => steps.push(B.carbPrep(p) + "، مع الاحتفاظ بنص كوباية من مية السلق"));
    prot.forEach((p) => steps.push(B.cookProtein(p)));
    if (veg.length) steps.push(`تشويح ${B.L(veg)} مقطعين صغير ${B.cookIn()}`);
    if (cream.length) steps.push(`إضافة ${B.L(cream)} على نار هادية وتقليبه لحد ما يتقل`);
    if (tom.length || (style === "بصوص الطماطم")) steps.push(`إضافة ${joinAr([tom.length ? B.L(tom) + " مبشورة" : "", c.flavor("tomatopaste") ? "معلقة صلصة طماطم" : ""])} مع ${B.season()}، وتسبيكها 7 دقايق`);
    steps.push(`تقليب ${joinAr(pasta.map((p) => short(p.food.name)))} في الطاسة مع رشة من مية السلق${cheese.length ? `، و${B.L(cheese)} على الوش` : ""}`);
    const ol = B.free(c.of("olives", "oil")); if (ol.length) steps.push(`على الوش: ${B.L(ol)}`);
    const pn = short(pasta[0].food.name);
    const name = prot.length ? `${pn} ${style} ${bi(prot[0].food.name)}` : `${pn} ${style}`;
    return { name, time: "25 دقيقة", steps, tip: "مية السلق فيها نشا بيخلي الصوص يمسك ويلمع." };
  },
});

T({ id: "stirfry", taste: "savory",
  accept: (i) => isK(i, "poultry", "meat", "liver", "seafood", "tofu", "sausage", "egg", "rice", "noodles", "grain", "pasta", "oil", "butter", "nuts", "seeds") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("poultry", "meat", "liver", "seafood", "tofu", "sausage").length && c.vegCook().length,
  build: (c, B) => {
    const prot = c.of("poultry", "meat", "liver", "seafood", "tofu", "sausage"), egg = c.of("egg");
    const base = c.of("rice", "noodles", "grain", "pasta"), crunch = c.of("nuts", "seeds");
    const asian = c.flavor("soy") || c.flavor("ginger");
    const steps = [];
    base.forEach((b) => steps.push(B.carbPrep(b)));
    steps.push(`تقطيع ${B.L(c.vegCook())} شرايط طويلة`);
    prot.forEach((p) => steps.push(B.cookProtein(p, "strips") + "، وتطليعه على طبق"));
    steps.push(`في نفس الطاسة على أعلى نار: الخضار دقيقتين بس عشان يفضل مقرمش`);
    if (egg.length) steps.push(`تزقيق الخضار على جنب، وخفق ${B.L(egg)} في المكان الفاضي لحد ما يستوي`);
    steps.push(`رجوع ${joinAr(prot.map((p) => short(p.food.name)))} وتقليب الكل${asian ? ` مع ${joinAr([c.flavor("soy") ? "صوص الصويا" : "", c.flavor("ginger") ? "الجنزبيل" : ""])}` : ""}${base.length ? ` و${joinAr(base.map((b) => short(b.food.name)))}` : ""}`);
    if (crunch.length) steps.push(`على الوش: ${B.L(crunch)} محمصين`);
    return { name: `سوتيه ${short(prot[0].food.name)} ${asian ? "على الطريقة الآسيوي" : "بالخضار"}`, time: "20 دقيقة", steps, tip: "النار العالية والطاسة الواسعة هما سر السوتيه." };
  },
});

T({ id: "traybake", taste: "savory",
  accept: (i) => isK(i, "poultry", "fish", "meat", "kofta", "sausage", "potato", "sweetpotato", "root", "oil", "butter", "cheese_melt", "yogurt", "tahini") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("poultry", "fish", "meat", "kofta", "sausage").length && (c.of("potato", "sweetpotato", "root").length || c.vegCook().length),
  build: (c, B) => {
    const prot = c.of("poultry", "fish", "meat", "kofta", "sausage");
    const side = [...c.of("potato", "sweetpotato", "root"), ...c.vegCook()];
    const tom = c.ids("tomato");
    const cut = side.filter((x) => !tom.includes(x));
    if (!cut.length) return null;
    const steps = [];
    steps.push(`تقطيع ${B.L(cut)} قطع متوسطة متساوية`);
    steps.push(`تتبيل ${B.L(prot)} والخضار بـ${B.season()}`);
    steps.push(`رصهم في صينية ${B.ovenLine()}${tom.length || c.flavor("tomatopaste") ? ` مع صوص من ${joinAr([tom.length ? B.L(tom) + " مبشورة" : "", c.flavor("tomatopaste") ? "صلصة طماطم" : ""])} ونص كوباية مية` : ""}`);
    const ch = c.of("cheese_melt");
    steps.push(`فرن 200° لمدة 35–40 دقيقة${ch.length ? `، وآخر 5 دقايق ${B.L(ch)} على الوش لحد ما تسيح` : "، وآخر 5 دقايق الشواية من فوق"}`);
    const s = B.sauce(); if (s) steps.push(s + " للتقديم");
    return { name: `صينية ${short(prot[0].food.name)} بالخضار في الفرن`, time: "45 دقيقة", steps, tip: "صينية واحدة يعني غسيل مواعين أقل." };
  },
});

T({ id: "stuffed", taste: "savory",
  accept: (i) => isK(i, "rice", "grain", "mince", "oil", "butter", "yogurt") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("rice", "grain").length && c.veg().some((v) => v.food.stuff),
  build: (c, B) => {
    const rice = c.of("rice", "grain"), shells = c.veg().filter((v) => v.food.stuff);
    const mince = c.of("mince"), fill = c.vegCook().filter((v) => !shells.includes(v));
    const steps = [];
    rice.forEach((r) => steps.push(B.carbPrep(r)));
    mince.forEach((m) => steps.push(B.cookProtein(m)));
    steps.push(`خلط ${joinAr(rice.map((r) => short(r.food.name)))}${mince.length ? " مع اللحمة" : ""}${fill.length ? ` و${B.L(fill)} مفرومين` : ""} مع ${B.season()}${B.herbs() ? ` و${B.herbs()}` : ""}`);
    shells.forEach((s) => steps.push(["vineleaves", "cabbage"].includes(s.food.id) ? `سلق ${B.q(s)} دقيقة عشان يطرى، ولف الحشو فيه صوابع صغيرة` : `تفريغ ${B.q(s)} من جوه وحشوه بالخليط`));
    steps.push(`رصهم في صينية ${B.ovenLine()} مع ربع كوباية مية${c.flavor("tomatopaste") ? " ومعلقة صلصة طماطم" : ""}، ومغطيين بفويل 25 دقيقة على 190°، وبعدين 10 دقايق من غير فويل`);
    const s = B.sauce(); if (s) steps.push(s + " على الجنب للتغميس");
    return { name: `${short(shells[0].food.name)} محشي بالفرن${mince.length ? " باللحمة" : ""}`, time: "45 دقيقة", steps, tip: "الرز المطبوخ بيقصّر وقت المحشي للنص." };
  },
});

T({ id: "burger", taste: "savory",
  accept: (i) => isK(i, "mince", "bread_loaf", "toast", "bread_flat", "cheese_melt", "cheese_hard", "fries", "potato", "mayo", "oil", "butter") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("mince").length,
  build: (c, B) => {
    const mince = c.of("mince")[0], onion = c.ids("onion"), bread = c.of("bread_loaf", "toast", "bread_flat");
    const steps = [];
    steps.push(`عجن لحمة مفرومة ني حوالي ${Math.round((mince.qty * 1.35) / 5) * 5} جم (بتطلع ${B.q(mince)} بعد الشوي)${onion.length ? ` مع ${B.L(onion)} مبشور ومعصور` : ""} و${B.season()}${B.herbs() ? ` و${B.herbs()}` : ""}`);
    steps.push(bread.length ? "تشكيلها أقراص رفيعة بعرض العيش" : "تشكيلها صوابع بالإيد أو على أسياخ");
    steps.push(`شيّها ${B.cookIn()} أو على جريل 4 دقايق على كل وش`);
    const ch = c.of("cheese_melt", "cheese_hard"); if (ch.length) steps.push(`آخر دقيقة: ${B.L(ch)} فوق اللحمة ويتغطى عشان يسيح`);
    c.of("fries", "potato").forEach((p) => steps.push(B.carbPrep(p)));
    const raw = B.free(c.vegRaw()); if (raw.length) steps.push(`تقطيع ${B.L(raw)} شرايح`);
    const s = B.sauce(); if (s) steps.push(s);
    if (bread.length) steps.push(`تحميص ${B.L(bread)} والتجميع طبقات`);
    else if (raw.length || s) steps.push("التقديم في طبق واحد مع الخضار والصوص");
    return { name: bread.length ? "برجر بيتي" : "صوابع لحمة مشوية", time: "20 دقيقة", steps };
  },
});

T({ id: "pizza", taste: "savory",
  accept: (i) => isK(i, "bread_flat", "wrap", "toast", "cheese", "deli", "tuna", "poultry", "sausage", "mince", "egg", "olives", "oil") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("bread_flat", "wrap", "toast").length && c.of("cheese").length,
  build: (c, B) => {
    const bread = c.of("bread_flat", "wrap", "toast"), cheese = c.of("cheese");
    const tom = c.ids("tomato", "cherrytomato");
    const cookFirst = c.of("poultry", "sausage", "mince"); const egg = c.of("egg");
    const tops = [...c.vegCook().filter((v) => !tom.includes(v)), ...c.of("olives", "deli", "tuna")];
    const steps = [];
    cookFirst.forEach((x) => steps.push(B.cookProtein(x)));
    const hasSauce = tom.length || c.flavor("tomatopaste");
    if (hasSauce) steps.push(`صوص: ${joinAr([tom.length ? `بشر ${B.L(tom)}` : "", c.flavor("tomatopaste") ? "معلقة صلصة طماطم" : ""])} مع ${B.season()}، ويتسبك دقيقتين`);
    steps.push(`فرد ${B.L(bread)} على صينية${hasSauce ? " ودهنه بالصوص" : ""}`);
    const topNames = [...cookFirst.map((x) => short(x.food.name))];
    if (tops.length || topNames.length) steps.push(`توزيع ${joinAr([...topNames, tops.length ? B.L(tops) : ""])} مقطعين صغير`);
    steps.push(`${B.L(cheese)} على الوش${egg.length ? `، و${B.L(egg)} يتكسر في النص` : ""}`);
    const oil = B.free(c.of("oil")); if (oil.length) steps.push(`رشة ${B.L(oil)} على الأطراف`);
    steps.push("فرن 200° لمدة 8–10 دقايق لحد ما الأطراف تقرمش والجبنة تسيح");
    return { name: `بيتزا ${breadName(bread[0])}${egg.length ? " بالبيض" : ""}`, time: "15 دقيقة", steps, tip: "العيش البلدي لو اتفتح نصين بيطلع بيتزا رقيقة مقرمشة." };
  },
});

T({ id: "soup", taste: "savory",
  accept: (i) => isK(i, "lentil", "beans", "poultry", "milk", "cream", "oil", "butter", "bread", "pasta", "rice", "potato", "yogurt") || (i.food.role === "veg" && !i.food.rawOnly),
  core: (c) => c.of("lentil").length || c.vegCook().length >= 2,
  build: (c, B) => {
    const lentil = c.of("lentil"), beans = c.of("beans"), chicken = c.of("poultry");
    const veg = c.vegCook(), creamy = c.of("milk", "cream");
    const starch = c.of("pasta", "rice", "potato");
    const steps = [];
    if (veg.length) steps.push(`تشويح ${B.L(veg)} مقطعين ${B.cookIn()} 3 دقايق`);
    const main = [...lentil.map((l) => `عدس ني حوالي ${Math.round(l.qty / 2.5 / 5) * 5} جم (بيطلع ${B.q(l)} بعد الطبخ)`), ...beans.map((b) => B.q(b)), ...starch.filter((s) => s.food.kind === "potato").map((p) => B.q(p) + " مكعبات")];
    steps.push(`إضافة ${main.length ? joinAr(main) : "مية"} مع مية تغطي بإصبعين${c.flavor("stock") ? " ومكعب المرقة" : ""} و${B.season()}${c.flavor("bayleaf") ? " وورقة لورا" : ""}، وتسويتها على نار هادية 20 دقيقة`);
    chicken.forEach((ch) => steps.push(`سلق ${B.q(ch)} في نفس الشوربة وتقطيعه قطع صغيرة`));
    steps.push(`ضرب الشوربة في الخلاط${creamy.length ? ` مع ${B.L(creamy)}` : ""} لحد ما تبقى ناعمة`);
    const rp = starch.filter((s) => s.food.kind !== "potato"); rp.forEach((x) => steps.push(B.carbPrep(x) + " وإضافته للشوربة بعد الضرب"));
    if (chicken.length) steps.push("رجوع الفراخ للشوربة");
    const yog = c.of("yogurt"); if (yog.length) steps.push(`معلقة من ${B.L(yog)} في نص الطبق`);
    if (B.acid() || B.herbs()) steps.push(`التقديم مع ${joinAr([B.acid(), B.herbs() ? B.herbs() + " مفروم" : ""])}`);
    const bread = c.of("bread"); if (bread.length) steps.push(`${B.L(bread)} مقطع مكعبات ومحمص كخبز مقرمش على الوش`);
    return { name: lentil.length ? "شوربة عدس كريمي" : `شوربة ${short(veg[0].food.name)} ${creamy.length ? "بالكريمة" : "الدافية"}`, time: "30 دقيقة", steps };
  },
});

T({ id: "fatteh", taste: "savory",
  accept: (i) => isK(i, "bread_flat", "rice", "meat", "poultry", "yogurt", "nuts", "oil", "butter") || ["tomato", "onion"].includes(i.food.id),
  core: (c) => c.of("bread_flat").length && c.of("rice").length && c.of("meat", "poultry").length,
  build: (c, B) => {
    const steps = [];
    c.of("meat", "poultry").forEach((p) => steps.push(B.cookProtein(p)));
    c.of("rice").forEach((r) => steps.push(B.carbPrep(r)));
    steps.push(`تقطيع ${B.L(c.of("bread_flat"))} مربعات وتحميصها في الفرن`);
    const tom = c.ids("tomato"), on = c.ids("onion");
    if (tom.length || on.length || c.F("garlic").length || c.flavor("vinegar")) steps.push(`صلصة: ${joinAr([on.length ? B.L(on) + " مفروم" : "", c.F("garlic").length ? joinAr(c.F("garlic")) : "", tom.length ? B.L(tom) + " مبشورة" : ""])} ${B.cookIn()}${c.flavor("vinegar") ? " ورشة خل" : ""}، ونص كوباية مية`);
    steps.push("في طبق عميق: العيش تحت، وفوقه الرز، وبعدين الصلصة، واللحمة على الوش");
    const yog = c.of("yogurt"); if (yog.length) steps.push(`${B.L(yog)} على الوش زي الفتة الشامي`);
    const nuts = c.of("nuts"); if (nuts.length) steps.push(`${B.L(nuts)} محمصين على الوش`);
    return { name: `فتة ${short(c.of("meat", "poultry")[0].food.name)}`, time: "30 دقيقة", steps };
  },
});

T({ id: "koshary", taste: "savory",
  accept: (i) => isK(i, "rice", "lentil", "pasta", "chickpea", "oil") || ["onion", "tomato"].includes(i.food.id),
  core: (c) => c.of("rice").length && c.of("lentil").length,
  build: (c, B) => {
    const steps = [];
    c.of("lentil").forEach((l) => steps.push(B.cookProtein(l)));
    c.of("rice", "pasta").forEach((r) => steps.push(B.carbPrep(r)));
    const ch = c.of("chickpea"); if (ch.length) steps.push(`تسخين ${B.L(ch)}`);
    const on = c.ids("onion"); if (on.length) steps.push(`تقطيع ${B.L(on)} شرايح رفيعة جدًا وتحميرها ${B.cookIn()} على نار هادية لحد ما تبقى دهبي غامق`);
    const tom = c.ids("tomato");
    if (tom.length || c.flavor("tomatopaste")) steps.push(`صلصة: ${joinAr([tom.length ? B.L(tom) + " مبشورة" : "", c.flavor("tomatopaste") ? "صلصة طماطم" : ""])} مع ${B.season()}${c.flavor("vinegar") ? " ورشة خل" : ""}، وتتسبك 10 دقايق`);
    steps.push("التجميع طبقات: الرز والعدس، وبعدين المكرونة، والصلصة والتقلية على الوش");
    const oil = B.free(c.of("oil")); if (oil.length) steps.push(`${B.L(oil)} على الوش`);
    return { name: "كشري بيتي", time: "30 دقيقة", steps, tip: "التقلية بالزيت المحسوب على نار هادية وبصبر بتطلع زي المحلات." };
  },
});

T({ id: "foul", taste: "savory",
  accept: (i) => isK(i, "foul", "egg", "falafel", "cheese", "bread", "oil", "butter", "tahini", "olives") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("foul").length,
  build: (c, B) => {
    const foul = c.of("foul"), egg = c.of("egg");
    const steps = [];
    let name = "فول مدمس";
    if (egg.length) {
      name = "فول بالبيض في الطاسة";
      steps.push(`تسخين ${B.L(foul)} ${B.cookIn()} مع ${B.season()}`);
      steps.push(`كسر ${B.L(egg)} فوق الفول وتقليبه بالراحة لحد ما يستوي`);
    } else {
      steps.push(`تسخين ${B.L(foul)} وهرسه هرس خفيف مع ${B.season()}${B.acid() ? " و" + B.acid() : ""}`);
      if (c.vegRaw().length >= 2) name = "فول إسكندراني";
    }
    const raw = c.vegRaw(); if (raw.length) steps.push(`تقطيع ${B.L(raw)} صغير جدًا وتوزيعه على الوش`);
    const top = c.of("oil", "butter", "tahini"); if (top.length) steps.push(`${B.L(top)} على الوش`);
    const ch = c.of("cheese"); if (ch.length) steps.push(`${B.L(ch)} مفتفتة فوق الفول`);
    const ol = c.of("olives"); if (ol.length) steps.push(`${B.L(ol)} جنب الفول في نفس الطبق`);
    c.of("falafel").forEach((f) => steps.push(B.cookProtein(f)));
    const bread = c.of("bread"); if (bread.length) steps.push(`مع ${B.L(bread)} سخن`);
    if (c.of("tahini").length && !egg.length) name = "فول بالطحينة";
    return { name, time: "10 دقايق", steps };
  },
});

T({ id: "hummus", taste: "savory",
  accept: (i) => isK(i, "chickpea", "tahini", "bread", "oil", "olives", "mince") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("chickpea").length && c.of("tahini").length,
  build: (c, B) => {
    const steps = [];
    steps.push(`ضرب ${B.L(c.of("chickpea"))} مع ${B.L(c.of("tahini"))} ومية ساقعة بالتدريج${c.F("garlic").length ? " و" + joinAr(c.F("garlic")) : ""}${B.acid() ? " و" + B.acid() : ""} وملح لحد ما يبقى ناعم جدًا`);
    steps.push(`فرده في طبق بضهر المعلقة${c.flavor("paprika") ? "، ورشة بابريكا" : ""}`);
    c.of("mince").forEach((m) => steps.push(B.cookProtein(m) + "، وتتحط في نص الحمص"));
    const oil = c.of("oil", "olives"); if (oil.length) steps.push(`${B.L(oil)} على الوش`);
    const raw = c.vegRaw(); if (raw.length) steps.push(`للتغميس: ${B.L(raw)} أصابع`);
    const bread = c.of("bread"); if (bread.length) steps.push(`و${B.L(bread)} محمص`);
    return { name: c.of("mince").length ? "حمص باللحمة" : "حمص بالطحينة", time: "10 دقايق", steps };
  },
});

T({ id: "loadedpotato", taste: "savory",
  accept: (i) => isK(i, "potato", "sweetpotato", "cheese", "egg", "tuna", "mince", "yogurt", "beans", "deli", "butter", "oil") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("potato", "sweetpotato").length && c.of("cheese", "egg", "tuna", "mince", "yogurt", "beans", "deli").length,
  build: (c, B) => {
    const pot = c.of("potato", "sweetpotato");
    const steps = [`تسوية ${B.L(pot)} كاملة في الفرن ملفوفة فويل 40 دقيقة`];
    c.of("mince", "deli").forEach((m) => steps.push(B.cookProtein(m)));
    c.of("egg").forEach((e) => steps.push(`خفق ${B.q(e)} وتقليبه في طاسة لحد ما يبقى سكرامبل`));
    const veg = c.vegCook(); if (veg.length) steps.push(`تشويح ${B.L(veg)} صغير ${B.cookIn()}`);
    const fat = B.free(c.of("butter", "oil"));
    steps.push(`فتح ${joinAr(pot.map((x) => short(x.food.name)))} بالطول وهرس الجوه بالشوكة مع ${B.season()}${fat.length ? ` و${B.L(fat)}` : ""}`);
    const rest = c.of("cheese", "tuna", "beans", "yogurt");
    steps.push(`الحشو باللي اتطبخ${rest.length ? ` و${B.L(rest)}` : ""}، ورجوعها الفرن 5 دقايق`);
    if (B.herbs()) steps.push(`${B.herbs()} على الوش`);
    return { name: `${short(pot[0].food.name)} محشية بالفرن`, time: "45 دقيقة", steps };
  },
});

T({ id: "skewers", taste: "savory",
  accept: (i) => isK(i, "poultry", "meat", "seafood", "kofta", "tofu", "cheese_melt", "oil", "yogurt", "tahini", "wrap", "bread_flat", "rice") || ["pepper", "onion", "tomato", "cherrytomato", "mushroom", "zucchini", "eggplant"].includes(i.food.id),
  core: (c) => c.of("poultry", "meat", "seafood", "kofta", "tofu", "cheese_melt").length && c.veg().length,
  build: (c, B) => {
    const prot = c.of("poultry", "meat", "seafood", "kofta", "tofu", "cheese_melt");
    const steps = [`تقطيع ${B.L(prot)} و${B.L(c.veg())} مكعبات بنفس الحجم`];
    const oil = B.free(c.of("oil")); if (oil.length) B.fatUsed = true;
    steps.push(`تتبيلهم بـ${B.season()}${oil.length ? ` و${B.L(oil)}` : ""}${B.acid() ? ` و${B.acid()}` : ""}، وتركهم 15 دقيقة`);
    steps.push("شكّهم على أسياخ بالتبادل، بروتين وبعده خضار");
    steps.push(`شيّهم على جريل أو تحت شواية الفرن ${prot[0].food.kind === "seafood" ? "6–8" : "12–15"} دقيقة مع التقليب`);
    c.of("rice").forEach((r) => steps.push(B.carbPrep(r) + " والأسياخ تتقدم فوقه"));
    const bread = c.of("wrap", "bread_flat"); if (bread.length) steps.push(`أو تتسحب على ${B.L(bread)} سخن`);
    const s = B.sauce(); if (s) steps.push(s);
    return { name: `أسياخ ${short(prot[0].food.name)} مشوية`, time: "30 دقيقة", steps, tip: "الأسياخ الخشب تتنقع في مية نص ساعة قبلها عشان ما تتحرقش." };
  },
});

T({ id: "molokhia", taste: "savory",
  accept: (i) => isK(i, "molokhia", "poultry", "meat", "rice", "bread_flat", "oil", "butter"),
  core: (c) => c.of("molokhia").length,
  build: (c, B) => {
    const steps = [];
    c.of("poultry", "meat").forEach((p) => steps.push(B.cookProtein(p)));
    steps.push(`غلي كوباية مية${c.flavor("stock") ? " بمكعب المرقة" : ""} وملح، وإضافة ${B.L(c.of("molokhia"))} مع التقليب، 3 دقايق من غير غطا`);
    const g = [...c.F("garlic"), ...(c.flavor("coriander") ? ["كزبرة ناشفة"] : [])];
    const fat = c.of("oil", "butter");
    if (g.length || fat.length) steps.push(`الطشة: ${g.length ? joinAr(g) : "التسبيكة"} ${fat.length ? "في " + B.L(fat) : "في طاسة ناشفة"} لحد ما تدهب، وتتصب على الملوخية`);
    c.of("rice").forEach((r) => steps.push(B.carbPrep(r)));
    const bread = c.of("bread_flat"); if (bread.length) steps.push(`مع ${B.L(bread)}`);
    return { name: `ملوخية${c.of("poultry", "meat").length ? " " + bi(c.of("poultry", "meat")[0].food.name) : ""}`, time: "20 دقيقة", steps };
  },
});

T({ id: "noodles", taste: "savory",
  accept: (i) => isK(i, "noodles", "egg", "poultry", "deli", "sausage", "seafood", "oil", "seeds") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("noodles").length && c.items.length >= 2,
  build: (c, B) => {
    const steps = [B.carbPrep(c.of("noodles")[0])];
    c.of("poultry", "deli", "sausage", "seafood").forEach((p) => steps.push(B.cookProtein(p, "strips")));
    const veg = c.vegCook(); if (veg.length) steps.push(`تشويح ${B.L(veg)} صغير ${B.cookIn()}`);
    steps.push(`إضافة النودلز المصفاة للطاسة${c.flavor("soy") ? " مع صوص الصويا" : ""}${c.flavor("hotsauce") || c.flavor("chili") ? " ورشة حار" : ""}`);
    const egg = c.of("egg"); if (egg.length) steps.push(`عمل مكان في النص وكسر ${B.L(egg)} فيه، وتقليبه لحد ما يستوي`);
    const seeds = c.of("seeds"); if (seeds.length) steps.push(`${B.L(seeds)} على الوش`);
    return { name: "إندومي ستريت فود", time: "10 دقايق", steps, tip: "نص كيس التتبيلة كفاية عشان الملح." };
  },
});

T({ id: "quesadilla", taste: "savory",
  accept: (i) => isK(i, "wrap", "bread_flat", "cheese_melt", "cheese_hard", "poultry", "mince", "beans", "tuna", "deli", "avocado", "yogurt") || (i.food.kind === "veg" && !i.food.rawOnly),
  core: (c) => c.of("wrap", "bread_flat").length && c.of("cheese_melt", "cheese_hard").length,
  build: (c, B) => {
    const steps = [];
    c.of("poultry", "mince").forEach((p) => steps.push(B.cookProtein(p)));
    const veg = c.vegCook(); if (veg.length) steps.push(`تشويح ${B.L(veg)} شرايط ${B.cookIn()}`);
    const fill = c.of("beans", "tuna", "deli");
    steps.push(`على نص ${B.L(c.of("wrap", "bread_flat"))}: ${B.L(c.of("cheese_melt", "cheese_hard"))}${fill.length ? ` و${B.L(fill)}` : ""} وكل الحشو`);
    steps.push("قفله نصين وتحميره في طاسة سخنة من غير زيت دقيقتين على كل جنب، وتقطيعه مثلثات");
    const av = c.of("avocado"); if (av.length) steps.push(`${B.L(av)} مهروس بملح للتغميس`);
    const s = B.sauce(); if (s) steps.push(s);
    return { name: "كيساديا بالجبنة", time: "12 دقيقة", steps };
  },
});

/* ---------- حلو ---------- */

T({ id: "pancake", taste: "sweet",
  accept: (i) => isK(i, "oats", "egg", "milk", "yogurt", "fruit", "dried", "sweet", "choc", "nutbutter", "nuts", "seeds", "coconut", "butter", "oil", "cheese_soft"),
  core: (c) => c.of("oats").length && c.of("egg").length,
  build: (c, B) => {
    const banana = c.ids("banana"), liquid = c.of("milk");
    const steps = [`طحن ${B.L(c.of("oats"))} في الخلاط لحد ما يبقى دقيق ناعم`];
    steps.push(`إضافة ${B.L(c.of("egg"))}${banana.length ? ` و${B.L(banana)} مهروس` : ""}${liquid.length ? ` و${B.L(liquid)}` : " وشوية مية"}${B.sweetSpice() ? ` و${B.sweetSpice()}` : ""} ورشة ملح، والخلط لحد ما يبقى عجين سايل`);
    steps.push(`صب دواير صغيرة ${B.cookIn()} على نار هادية، وقلبها أول ما الفقاعات تظهر`);
    const top = B.free(c.items);
    if (top.length) steps.push(`رص البان كيك فوق بعض، وعلى الوش: ${B.L(top)}`);
    return { name: banana.length ? "بان كيك شوفان وموز" : "بان كيك شوفان", time: "15 دقيقة", steps, tip: "النار الهادية سر البان كيك، العالية بتحرق الوش قبل ما يستوي من جوه." };
  },
});

T({ id: "overnight", taste: "sweet",
  accept: (i) => isK(i, "oats", "cereal", "milk", "yogurt", "fruit", "dried", "sweet", "choc", "nutbutter", "nuts", "seeds", "coconut"),
  core: (c) => c.of("oats").length && c.of("milk", "yogurt").length,
  build: (c, B) => {
    const mix = [...c.of("oats"), ...c.of("milk", "yogurt"), ...c.of("seeds").filter((s) => ["chia", "flax"].includes(s.food.id)), ...c.of("choc")];
    const steps = [`في برطمان: ${B.L(mix)}${B.sweetSpice() ? ` و${B.sweetSpice()}` : ""}، وتقليبهم كويس`];
    steps.push("قفل البرطمان ودخوله التلاجة من بالليل (4 ساعات على الأقل)");
    const top = B.free(c.items); if (top.length) steps.push(`الصبح، على الوش في طبقات: ${B.L(top)}`);
    return { name: "شوفان البرطمان", time: "5 دقايق + ليلة في التلاجة", steps, tip: "البرطمان الإزاز بيبيّن الطبقات وشكله حلو." };
  },
});

T({ id: "energy", taste: "sweet",
  accept: (i) => isK(i, "oats", "cereal", "nutbutter", "dried", "sweet", "nuts", "seeds", "choc", "coconut"),
  core: (c) => c.of("oats", "cereal").length && c.of("nutbutter", "dried", "sweet").length,
  build: (c, B) => {
    const bind = c.of("nutbutter", "dried", "sweet"), extra = c.of("nuts", "seeds", "choc", "coconut");
    const steps = [`فرم ${B.L(bind)}${extra.length ? ` و${B.L(extra)}` : ""} في الكبة أو تقطيعهم صغير جدًا`];
    steps.push(`خلطهم مع ${B.L(c.of("oats", "cereal"))}${B.sweetSpice() ? ` و${B.sweetSpice()}` : ""} بالإيد لحد ما يتماسكوا (لو ناشف: نقط مية)`);
    steps.push("تكويرهم كور صغيرة ودخولهم التلاجة 30 دقيقة");
    return { name: "كرات طاقة من غير فرن", time: "10 دقايق + 30 تلاجة", steps };
  },
});

T({ id: "parfait", taste: "sweet",
  accept: (i) => isK(i, "yogurt", "fruit", "dried", "sweet", "nuts", "seeds", "choc", "cereal", "oats", "coconut", "nutbutter", "halawa", "cheese_soft"),
  core: (c) => c.of("yogurt").length && c.items.length >= 2,
  build: (c, B) => {
    const base = [...c.of("yogurt"), ...c.ids("cottage", "labneh")];
    const steps = [`في كوباية شفافة: طبقة من ${B.L(base)}${B.sweetSpice() ? ` متقلب مع ${B.sweetSpice()}` : ""}`];
    const soft = B.free(c.items).filter((i) => !isK(i, "cereal", "nuts", "seeds", "oats"));
    const crunch = B.free(c.items).filter((i) => isK(i, "cereal", "nuts", "seeds", "oats"));
    if (soft.length) steps.push(`بعدها طبقة من ${B.L(soft)}، وتكرار الطبقات`);
    if (crunch.length) steps.push(`آخر طبقة: ${B.L(crunch)} عشان تفضل مقرمشة`);
    if (B.free(c.items).length) return null;
    return { name: "بارفيه زبادي بالطبقات", time: "5 دقايق", steps };
  },
});

T({ id: "smoothie", taste: "sweet",
  accept: (i) => isK(i, "milk", "yogurt", "juice", "fruit", "dried", "oats", "nutbutter", "seeds", "choc", "sweet", "avocado", "nuts", "coconut", "icecream"),
  core: (c) => c.of("milk", "yogurt", "juice").length && c.of("fruit").length,
  build: (c, B) => {
    const fruit = c.of("fruit");
    const steps = [`تقطيع ${B.L(fruit)} (ولو متجمد من قبلها يبقى أتقل)`];
    const rest = B.free(c.items);
    steps.push(`في الخلاط: الفاكهة مع ${B.L(rest)}${B.sweetSpice() ? ` و${B.sweetSpice()}` : ""}، ومكعبات تلج (اختياري)`);
    steps.push("ضرب دقيقة كاملة لحد ما يبقى ناعم، ويتشرب على طول");
    return { name: c.of("icecream").length ? `ميلك شيك ${short(fruit[0].food.name)}` : `سموزي ${short(fruit[0].food.name)}`, time: "5 دقايق", steps };
  },
});

T({ id: "nicecream", taste: "sweet",
  accept: (i) => isK(i, "fruit", "choc", "nutbutter", "milk", "nuts", "seeds", "sweet", "coconut"),
  core: (c) => c.ids("banana").length,
  build: (c, B) => {
    const fruit = c.of("fruit");
    const steps = [`تقطيع ${B.L(fruit)} حلقات وتجميدهم 3 ساعات على الأقل`];
    const blend = c.of("choc", "nutbutter", "milk", "sweet");
    steps.push(`ضربهم في الكبة${blend.length ? ` مع ${B.L(blend)}` : ""}${B.sweetSpice() ? ` و${B.sweetSpice()}` : ""} لحد ما القوام يبقى كريمي وتقيل`);
    const top = c.of("nuts", "seeds", "coconut"); if (top.length) steps.push(`على الوش: ${B.L(top)}`);
    return { name: "نايس كريم الموز", time: "5 دقايق + تجميد", steps, tip: "الموز المستوي جدًا (اللي عليه نقط بني) بيدّي أحلى طعم." };
  },
});

T({ id: "grilledfruit", taste: "sweet",
  accept: (i) => isK(i, "fruit", "sweet", "nuts", "yogurt", "icecream", "halawa", "choc", "butter"),
  core: (c) => c.items.some((i) => GRILL_FRUIT.includes(i.food.id)) && c.of("sweet", "nuts", "yogurt", "icecream", "halawa", "choc").length,
  build: (c, B) => {
    const grill = c.items.filter((i) => GRILL_FRUIT.includes(i.food.id)), other = c.of("fruit").filter((f) => !grill.includes(f));
    const steps = [`تقطيع ${B.L(grill)} شرايح سميكة`];
    steps.push(`تحميرها ${B.free(c.of("butter")).length ? "في " + B.L(c.of("butter")) : "في طاسة سخنة"} دقيقتين على كل وش لحد ما تتكرمل${B.sweetSpice() ? ` مع رشة ${B.sweetSpice()}` : ""}`);
    if (other.length) steps.push(`${B.L(other)} مقطع صغير جنبها في نفس الطبق`);
    steps.push(`التقديم سخنة وفوقها ${B.L(B.free(c.items))}`);
    return { name: `${short(grill[0].food.name)} مشوي متكرمل`, time: "10 دقايق", steps };
  },
});

T({ id: "fruitplate", taste: "sweet",
  accept: (i) => isK(i, "fruit", "dried", "yogurt", "sweet", "nuts", "choc", "halawa", "icecream", "coconut", "seeds", "cheese_soft", "nutbutter"),
  core: (c) => c.of("fruit", "dried").length,
  build: (c, B) => {
    const fruit = c.of("fruit", "dried");
    const steps = [`تقطيع ${B.L(fruit)} بأشكال مختلفة ورصهم في طبق واسع`];
    const top = B.free(c.items);
    if (top.length) steps.push(`فوقهم أو في وعاء صغير في النص: ${B.L(top)}${B.sweetSpice() ? ` ورشة ${B.sweetSpice()}` : ""}`);
    return { name: top.length ? "طبق فاكهة بالإضافات" : "طبق فاكهة", time: "5 دقايق", steps };
  },
});

T({ id: "snack", taste: "any",
  accept: (i) => isK(i, "lupini", "popcorn", "nuts", "seeds", "cracker", "cheese", "olives", "dip", "dried", "choc", "fruit", "snack_ready", "bar", "juice", "milk", "yogurt") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("lupini", "popcorn", "nuts", "cracker", "snack_ready", "bar").length && (c.items.length >= 2 || c.of("snack_ready", "bar").length),
  build: (c, B) => {
    const steps = [];
    c.of("popcorn").forEach((p) => steps.push(`تحميص ${B.q(p)} في حلة مقفولة على نار متوسطة`));
    c.of("lupini").forEach((l) => steps.push(B.cookProtein(l)));
    const veg = c.vegRaw(); if (veg.length) steps.push(`تقطيع ${B.L(veg)} أصابع`);
    const drink = c.of("juice", "milk"); 
    const rest = B.free(c.items).filter((i) => !drink.includes(i)); if (rest.length) steps.push(`رص ${B.L(rest)} في أطباق صغيرة جنب بعض`);
    if (drink.length) steps.push(`والمشروب: ${B.L(drink)}`);
    return { name: "طبق تسالي", time: "10 دقايق", steps };
  },
});

T({ id: "ready", taste: "savory",
  accept: (i) => isK(i, "ready", "bread", "yogurt", "dip", "tahini", "oil", "olives", "juice", "milk") || (i.food.kind === "veg" && i.food.raw),
  core: (c) => c.of("ready").length,
  build: (c, B) => {
    const ready = c.of("ready");
    const steps = [`تسخين ${B.L(ready)} في الفرن أو الميكرويف لحد ما يسخن كويس من جوه`];
    const raw = c.vegRaw(); if (raw.length) steps.push(`سلطة جنبه في نفس الطبق: ${B.L(raw)} مقطعين صغير${B.acid() ? " مع " + B.acid() : ""}`);
    const s = B.sauce(); if (s) steps.push(s);
    const t = B.topping(); if (t) steps.push(t.replace("على الوش في الآخر", "على السلطة"));
    const bread = c.of("bread"); if (bread.length) steps.push(`مع ${B.L(bread)} سخن`);
    const drink = c.of("juice", "milk"); if (drink.length) steps.push(`والمشروب: ${B.L(drink)}`);
    return { name: `طبق ${short(ready[0].food.name).replace(" جاهز", "").replace(" جاهزة", "")}${raw.length ? " بالسلطة" : ""}`, time: "10 دقايق", steps, tip: "الأكل الجاهز وزنه محسوب، فالأحسن يتوزن قبل التسخين." };
  },
});

T({ id: "dessert", taste: "sweet",
  accept: (i) => isK(i, "dessert_ready", "fruit", "dried", "nuts", "icecream", "sweet", "choc", "coconut", "juice", "milk", "cream"),
  core: (c) => c.of("dessert_ready").length,
  build: (c, B) => {
    const d = c.of("dessert_ready");
    const steps = [`تقديم ${B.L(d)} في طبق تقديم${d.some((x) => ["konafa", "omali", "basbousa", "qatayef"].includes(x.food.id)) ? " (سخن أحلى)" : " (ساقع أحلى)"}`];
    const top = c.of("fruit", "dried", "nuts", "icecream", "sweet", "choc", "coconut", "cream");
    if (top.length) steps.push(`على الوش أو جنبه: ${B.L(top)}${B.sweetSpice() ? ` ورشة ${B.sweetSpice()}` : ""}`);
    const drink = c.of("juice", "milk"); if (drink.length) steps.push(`والمشروب: ${B.L(drink)}`);
    return { name: `${short(d[0].food.name)}${top.length ? " بالإضافات" : ""}`, time: "5 دقايق", steps };
  },
});

/* ---------- قوالب عامة (احتياطي) ---------- */
const GENERIC_SAVORY = { id: "chef", taste: "savory", generic: true,
  accept: (i) => !["fruit", "dried", "sweet", "choc", "halawa", "icecream", "oats", "cereal", "popcorn", "nutbutter", "coconut", "dessert_ready", "juice", "bar", "snack_ready"].includes(i.food.kind),
  core: (c) => c.items.length >= 1,
  build: (c, B) => {
    const steps = [];
    c.items.filter((i) => i.food.role === "protein" && !isK(i, "milk", "yogurt")).forEach((p) => steps.push(B.cookProtein(p)));
    c.of("carb").forEach((x) => steps.push(B.carbPrep(x)));
    steps.push(...B.vegSteps(c.veg()));
    const s = B.sauce(); if (s) steps.push(s);
    const milk = c.of("milk"); if (milk.length) steps.push(`كوباية ${B.L(milk)} مع الوجبة`);
    const bread = c.of("bread"); if (bread.length) steps.push(`تسخين ${B.L(bread)}`);
    const rest = B.free(c.items);
    if (rest.length) steps.push(`على الوش: ${B.L(rest)}`);
    steps.push("التقديم في طبق واحد كبير، كل مكوّن في جزء");
    return { name: "طبق الشيف", time: "حسب الأصناف", steps };
  },
};
const GENERIC_SWEET = { id: "dessert", taste: "sweet", generic: true,
  accept: (i) => ["fruit", "dried", "sweet", "choc", "halawa", "icecream", "oats", "cereal", "popcorn", "nutbutter", "coconut", "nuts", "seeds", "yogurt", "milk", "dessert_ready", "juice", "bar", "snack_ready"].includes(i.food.kind),
  core: (c) => c.items.length >= 1,
  build: (c, B) => {
    const steps = [];
    const oats = c.of("oats"); if (oats.length) steps.push(`طبخ ${B.L(oats)} مع ${c.of("milk").length ? B.L(c.of("milk")) : "مية"} 3 دقايق`);
    const fruit = c.of("fruit", "dried"); if (fruit.length) steps.push(`تقطيع ${B.L(fruit)}`);
    const rest = B.free(c.items);
    if (rest.length) steps.push(`التجميع في بولة مع ${B.L(rest)}`);
    return { name: "بولة حلوة", time: "10 دقايق", steps };
  },
};
/* طبق كامل بيستوعب أي حاجة: آخر حل لوضع "وجبة واحدة" */
const GENERIC_ALL = { id: "full", taste: "any", generic: true,
  accept: () => true,
  core: (c) => c.items.length >= 1,
  build: (c, B) => {
    const savory = c.items.filter((i) => GENERIC_SAVORY.accept(i)), sweet = c.items.filter((i) => !GENERIC_SAVORY.accept(i));
    const r1 = GENERIC_SAVORY.build({ ...c, items: savory, of: (...k) => c.of(...k).filter((i) => savory.includes(i)), veg: () => c.veg(), vegRaw: () => c.vegRaw(), vegCook: () => c.vegCook() }, B);
    const steps = r1.steps.filter((s) => !s.startsWith("التقديم"));
    if (sweet.length) steps.push(`والتحلية في نفس الوجبة: ${B.L(B.free(sweet))}`);
    steps.push("التقديم مع بعض في صينية واحدة");
    return { name: "صينية الوجبة الكاملة", time: "حسب الأصناف", steps };
  },
};

/* ================= نوع الوجبة ================= */
const TEMPLATE_MEALS = {
  breakfast: ["shakshuka", "omelette", "board", "foul", "pancake", "overnight", "parfait", "smoothie", "wrap", "hummus", "quesadilla", "energy", "fruitplate"],
  lunch: ["bowl", "pasta", "stirfry", "traybake", "stuffed", "burger", "soup", "fatteh", "koshary", "molokhia", "skewers", "loadedpotato", "ready", "pizza", "noodles", "salad"],
  dinner: ["salad", "soup", "wrap", "omelette", "pizza", "quesadilla", "noodles", "hummus", "foul", "board", "bowl", "ready", "skewers", "shakshuka", "parfait"],
  snack: ["snack", "energy", "parfait", "smoothie", "nicecream", "grilledfruit", "fruitplate", "dessert", "hummus"],
};
const fits = (tplId, mealType) => !!(mealType && (TEMPLATE_MEALS[mealType] || []).includes(tplId));

/* ================= المحرك ================= */
/* المشروبات (لبن، عصير، قهوة) بتتقدم مع أي طبق حتى لو القالب نفسه ما بيستخدمهاش */
const DRINK_KINDS = ["milk", "juice"];
function tryTemplate(tpl, items, flavors, rng) {
  const drinks = items.filter((i) => DRINK_KINDS.includes(i.food.kind) && !tpl.accept(i));
  if (drinks.length && drinks.length < items.length) {
    const rest = items.filter((i) => !drinks.includes(i));
    const r = tryTemplate(tpl, rest, flavors, rng);
    if (!r) return null;
    r.steps.push(`والمشروب مع الوجبة: ${drinks.map((d) => `${d.food.name} (${formatQty(d.food, d.qty)})`).join(" و")}.`);
    return r;
  }
  if (!items.every((i) => tpl.accept(i))) return null;
  const ctx = buildCtx(items, flavors, rng);
  if (!tpl.core(ctx)) return null;
  const B = makeBuilder(ctx);
  let r = null;
  try { r = tpl.build(ctx, B); } catch (e) { return null; }
  if (!r) return null;
  if (B.free(items).length) return null; // لازم كل صنف يتذكر
  r.steps = r.steps.filter(Boolean).map((s) => s.trim().replace(/[.،]$/, "") + ".");
  return { ...r, tpl: tpl.id, taste: tpl.taste, generic: !!tpl.generic };
}

const kcalOf = (items) => items.reduce((s, it) => s + itemStats(it.food, it.qty).kcal, 0);

function optionsFor(items, flavors, rng, withGeneric) {
  const out = [];
  TEMPLATES.forEach((t) => { const r = tryTemplate(t, items, flavors, rng); if (r) out.push(r); });
  if (withGeneric && !out.length) {
    [GENERIC_SAVORY, GENERIC_SWEET].forEach((t) => { const r = tryTemplate(t, items, flavors, rng); if (r) out.push(r); });
  }
  return out;
}

/*
 * mode: "auto" | "one" | "two"
 * بيرجّع قايمة اقتراحات. كل اقتراح فيه وجبة أو اتنين، وكل صنف في وجبة واحدة بالظبط.
 */
function suggestMeals(items, flavors, { mode = "auto", seed = 1, mealType = null } = {}) {
  const rng = mulberry32(seed * 7919 + items.length);
  const n = items.length;
  const results = [];
  const meal = (r, list) => ({ ...r, items: list, kcal: kcalOf(list) });

  // وجبة واحدة
  if (mode !== "two") {
    optionsFor(items, flavors, rng, false).forEach((r) => results.push({ meals: [meal(r, items)], score: 100 + rng() * 6 + (fits(r.tpl, mealType) ? 14 : 0) }));
  }

  // وجبتين
  if (mode !== "one" && n >= 2) {
    const total = kcalOf(items) || 1;
    const masks = new Set();
    if (n <= 11) {
      for (let m = 1; m < (1 << n) - 1; m++) if (m & 1) masks.add(m);
    } else {
      // سلة كبيرة: تقسيمات منطقية + عينات عشوائية
      let sweet = 0; items.forEach((it, i) => { if (!GENERIC_SAVORY.accept(it)) sweet |= 1 << i; });
      if (sweet && sweet !== (1 << n) - 1) masks.add(sweet & 1 ? sweet : ((1 << n) - 1) ^ sweet);
      for (let k = 0; k < 1500; k++) { const m = (Math.floor(rng() * (1 << n)) | 1) & ((1 << n) - 1); if (m !== (1 << n) - 1) masks.add(m); }
    }
    const cache = new Map();
    const opts = (m) => {
      if (!cache.has(m)) {
        const sub = items.filter((_, i) => m & (1 << i));
        cache.set(m, { sub, list: optionsFor(sub, flavors, rng, false) });
      }
      return cache.get(m);
    };
    masks.forEach((m) => {
      const A = opts(m); if (!A.list.length) return;
      const Bm = ((1 << n) - 1) ^ m;
      const Bo = opts(Bm); if (!Bo.list.length) return;
      const kA = kcalOf(A.sub), kB = kcalOf(Bo.sub);
      const balance = Math.min(kA, kB) / Math.max(kA, kB);
      A.list.slice(0, 3).forEach((ra) => Bo.list.slice(0, 3).forEach((rb) => {
        if (ra.tpl === rb.tpl) return;
        const natural = ra.taste !== rb.taste && ra.taste !== "any" && rb.taste !== "any" ? 10 : 0;
        const score = 55 + balance * (mode === "two" ? 30 : 12) + natural + rng() * 6 - (Math.min(kA, kB) / total < 0.12 ? 15 : 0)
          + (fits(ra.tpl, mealType) ? 7 : 0) + (fits(rb.tpl, mealType) ? 7 : 0) - (mealType === "snack" && mode === "auto" ? 20 : 0);
        const ordered = ra.taste === "sweet" && rb.taste !== "sweet" ? [meal(rb, Bo.sub), meal(ra, A.sub)] : [meal(ra, A.sub), meal(rb, Bo.sub)];
        results.push({ meals: ordered, score });
      }));
    });
  }

  // احتياطي
  if (!results.length) {
    if (mode === "two" && n >= 2) {
      const sav = items.filter((i) => GENERIC_SAVORY.accept(i)), sw = items.filter((i) => !GENERIC_SAVORY.accept(i));
      if (sav.length && sw.length) {
        const a = tryTemplate(GENERIC_SAVORY, sav, flavors, rng), b = tryTemplate(GENERIC_SWEET, sw, flavors, rng);
        if (a && b) results.push({ meals: [meal(a, sav), meal(b, sw)], score: 1 });
      }
    }
    if (!results.length) {
      const r = tryTemplate(GENERIC_ALL, items, flavors, rng);
      if (r) results.push({ meals: [meal(r, items)], score: 0, fallback: mode === "two" });
    }
  }

  // ترتيب وإزالة التكرار
  results.sort((a, b) => b.score - a.score);
  const seen = new Set(), unique = [];
  results.forEach((r) => {
    const key = r.meals.map((m) => m.tpl).sort().join("+") + "|" + r.meals.map((m) => m.items.map((i) => i.food.id).sort().join(",")).sort().join("/");
    const tplKey = r.meals.map((m) => m.tpl).sort().join("+");
    if (seen.has(key)) return;
    // ما نكررش نفس تركيبة القوالب أكتر من مرتين
    const same = unique.filter((u) => u.meals.map((m) => m.tpl).sort().join("+") === tplKey).length;
    if (same >= 1) return;
    seen.add(key);
    unique.push(r);
  });
  return unique;
}


/* ================= التقسيم اليدوي ================= */
const TEMPLATE_LABELS = {
  bowl: "بول", wrap: "ساندوتش / رول", shakshuka: "شكشوكة", omelette: "أومليت", board: "طبق فطار",
  salad: "سلطة", pasta: "مكرونة", stirfry: "سوتيه", traybake: "صينية فرن", stuffed: "محشي",
  burger: "برجر / صوابع لحمة", pizza: "بيتزا", soup: "شوربة", fatteh: "فتة", koshary: "كشري",
  foul: "فول", hummus: "حمص", loadedpotato: "بطاطس محشية", skewers: "أسياخ", molokhia: "ملوخية",
  noodles: "إندومي", quesadilla: "كيساديا", pancake: "بان كيك", overnight: "شوفان بالليل",
  energy: "كرات طاقة", parfait: "بارفيه زبادي", smoothie: "سموزي", nicecream: "آيس كريم موز",
  grilledfruit: "فاكهة مشوية", fruitplate: "طبق فاكهة", snack: "طبق تسالي", ready: "أكلة جاهزة بسلطة", dessert: "طبق حلو",
};

/* أنواع الأطباق اللي تنفع للمجموعة دي (كل الأصناف تدخل فيها) */
function templatesFor(items, flavors, seed = 1, mealType = null) {
  const rng = mulberry32(seed * 104729 + items.length);
  const out = [];
  TEMPLATES.forEach((t) => {
    const r = tryTemplate(t, items, flavors, rng);
    if (r) out.push({ id: t.id, label: TEMPLATE_LABELS[t.id] || r.name, recipe: { ...r, items, kcal: kcalOf(items) } });
  });
  if (mealType) out.sort((a, b) => fits(b.id, mealType) - fits(a.id, mealType));
  return out;
}

/* وصفة لمجموعة يحددها المستخدم: نوع معيّن أو "أي حاجة" */
function mealsForGroup(items, flavors, tplId = "any", seed = 1, mealType = null) {
  if (!items.length) return [];
  const opts = templatesFor(items, flavors, seed, mealType);
  if (tplId !== "any") {
    const hit = opts.find((o) => o.id === tplId);
    return hit ? [hit.recipe] : [];
  }
  if (opts.length) return opts.map((o) => o.recipe);
  const rng = mulberry32(seed);
  const r = tryTemplate(GENERIC_ALL, items, flavors, rng);
  return r ? [{ ...r, items, kcal: kcalOf(items) }] : [];
}

/* صنف يتاكل سادة: سطر تحضير بسيط */
function plainLine(it) {
  const q = `${it.food.name} (${formatQty(it.food, it.qty)})`;
  const k = it.food.kind;
  const map = {
    egg: `${q}: مسلوق 8 دقايق، أو عيون في طاسة تيفال`,
    poultry: `${q}: متتبل بملح ومشوي في الفرن`, meat: `${q}: مشوي بملح`, fish: `${q}: مشوي في الفرن بملح`,
    seafood: `${q}: متشوح دقايق بملح`, liver: `${q}: متشوحة على نار عالية`, mince: `${q}: متشوحة بملح`,
    kofta: `${q}: مشوية`, sausage: `${q}: متحمر`, tofu: `${q}: متحمر لحد ما يقرمش`,
    foul: `${q}: سخن بملح`, beans: `${q}: سخن بملح`, lentil: `${q}: مسلوق بملح`, chickpea: `${q}: سخن أو محمص`,
    falafel: `${q}: متسخنة في الفرن`, lupini: `${q}: متقشر`,
    rice: `${q}: مطبوخ بالمية والملح`, grain: `${q}: مطبوخ بالمية والملح`, pasta: `${q}: مسلوقة بملح`,
    potato: `${q}: مسلوقة أو في الفرن`, sweetpotato: `${q}: في الفرن`, root: `${q}: مسلوق`, corn: `${q}: مسلوق`,
    noodles: `${q}: مسلوقة`, oats: `${q}: مطبوخ بمية 3 دقايق`, popcorn: `${q}: متحمص في حلة مقفولة`,
    milk: `${q}: كوباية سخنة أو ساقعة`, veg: `${q}: ${it.food.rawOnly || it.food.raw ? "مقطع شرايح" : "مسلوق أو متشوح"}`,
    molokhia: `${q}: مطبوخة بمية وملح`,
    ready: `${q}: متسخن`, juice: `${q}`, dessert_ready: `${q}: زي ما هي`, bar: `${q}: زي ما هو`, snack_ready: `${q}: زي ما هو`,
    pane: `${q}: متسخن في الفرن`, shawarma: `${q}: متحمرة في طاسة`,
  };
  if (map[k]) return map[k];
  if (it.food.role === "fruit") return `${q}: زي ما هو`;
  if (it.food.role === "carb") return `${q}: سخن`;
  return `${q}: زي ما هو`;
}

if (typeof module !== "undefined") module.exports = { suggestMeals, templatesFor, mealsForGroup, plainLine, TEMPLATE_LABELS, TEMPLATES, joinAr };
