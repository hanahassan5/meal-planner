(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PHOTOS = window.MEAL_PHOTOS || {};

  const ALL = [...FOODS, ...FLAVORS];
  const byId = Object.fromEntries(ALL.map((f) => [f.id, f]));
  const MEAL_KCAL = { breakfast: 350, lunch: 600, dinner: 450, snack: 200 };

  const state = {
    selected: new Set(), goal: "balanced", meal: "breakfast", mode: "auto", count: "3", showAll: false,
    plan: null, flavors: [], models: [], tab: "protein",
    assign: {}, groupTpl: {},
  };

  /* ================= أدوات ================= */
  const toAr = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } },
  };
  const ICON = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    carb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3h8l-1 4H9z"/><path d="M9 7c-2 2-3 5-3 8a6 6 0 0 0 12 0c0-3-1-6-3-8"/></svg>',
    protein: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    fat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/></svg>',
  };
  const TPL_EMOJI = {
    bowl: "🥗", wrap: "🌯", shakshuka: "🍳", omelette: "🍳", board: "🍽️", salad: "🥗", pasta: "🍝", stirfry: "🥘",
    traybake: "🫕", stuffed: "🫑", burger: "🍔", pizza: "🍕", soup: "🥣", fatteh: "🍲", koshary: "🍛", foul: "🫘",
    hummus: "🥣", loadedpotato: "🥔", skewers: "🍢", molokhia: "🍵", noodles: "🍜", quesadilla: "🌮", pancake: "🥞",
    overnight: "🫙", energy: "🍪", parfait: "🍨", smoothie: "🥤", nicecream: "🍦", grilledfruit: "🍑", fruitplate: "🍓",
    snack: "🥨", ready: "🍛", dessert: "🍰", chef: "🍽️", full: "🍽️", plain: "🥚",
  };
  const ART_BG = ["#f8efe4", "#eef3ef", "#fbeaea", "#f6f0dc", "#e8f0f7", "#f6e9f3"];
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  /* ================= الحفظ ================= */
  function save() {
    store.set("wimk:state", { s: [...state.selected], g: state.goal, ml: state.meal, m: state.mode, c: state.count, k: $("#kcal").value });
  }
  function load() {
    const d = store.get("wimk:state", null);
    if (!d) return;
    (d.s || []).forEach((id) => byId[id] && state.selected.add(id));
    if (GOALS[d.g]) state.goal = d.g;
    if (MEAL_KCAL[d.ml]) state.meal = d.ml;
    if (["auto", "one", "two", "manual"].includes(d.m)) state.mode = d.m;
    if (["1", "2", "3"].includes(d.c)) state.count = d.c;
    if (d.k) $("#kcal").value = d.k;
  }

  /* ================= السلة ================= */
  function toggle(id, quiet) {
    const f = byId[id];
    if (state.selected.has(id)) { state.selected.delete(id); if (!quiet) toast(`اتشال ${f.name}`); }
    else { state.selected.add(id); if (!quiet) toast(`اتضاف ${f.name}`); }
    renderBasket();
    if ($("#catalog-modal").open) { renderTabs(); renderCatalog(); }
    save();
  }

  function renderBasket() {
    const box = $("#basket");
    box.innerHTML = "";
    if (!state.selected.size) {
      box.innerHTML = `<span class="empty">لسه مفيش مكونات. البحث فوق أو زرار "إضافة مكونات أخرى" بيضيفها هنا.</span>`;
    }
    const order = Object.keys(ROLES);
    [...state.selected].map((id) => byId[id])
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
      .forEach((f) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip-big" + (f.role === "flavor" ? " flavor" : "");
        b.dataset.role = f.role;
        b.setAttribute("aria-label", `شيل ${f.name}`);
        b.innerHTML = `<span class="thumb" aria-hidden="true">${f.emoji}</span>${esc(f.name)}<span class="x" aria-hidden="true">✕</span>`;
        b.onclick = () => toggle(f.id);
        box.appendChild(b);
      });
    const n = [...state.selected].filter((id) => byId[id].role !== "flavor").length;
    $("#cat-count").textContent = `${n} مكون مختار`;
  }

  /* ---------- بحث سريع ---------- */
  let sugIdx = -1;
  function renderSuggest() {
    const q = $("#search").value.trim();
    const ul = $("#suggest");
    if (!q) { ul.hidden = true; return; }
    const list = ALL.filter((f) => f.name.includes(q))
      .sort((a, b) => (a.name.startsWith(q) ? 0 : 1) - (b.name.startsWith(q) ? 0 : 1))
      .slice(0, 8);
    ul.innerHTML = "";
    if (!list.length) {
      ul.innerHTML = `<li aria-disabled="true">مفيش مكون بالاسم ده. كلمة أقصر بتجيب نتايج أكتر.</li>`;
    }
    list.forEach((f, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === sugIdx);
      const on = state.selected.has(f.id);
      if (on) li.classList.add("on");
      li.innerHTML = `<span class="e" aria-hidden="true">${f.emoji}</span>${esc(f.name)}<small>${on ? "في السلة ✓" : f.role === "flavor" ? "نكهة" : esc(f.section || "")}</small>`;
      li.onmousedown = (e) => { e.preventDefault(); toggle(f.id); $("#search").value = ""; ul.hidden = true; };
      ul.appendChild(li);
    });
    ul.hidden = false;
    ul._list = list;
  }

  /* ---------- كل المكونات ---------- */
  function renderTabs() {
    const box = $("#tabs");
    box.innerHTML = "";
    const searching = !!$("#cat-search").value.trim();
    Object.entries(ROLES).forEach(([role, meta]) => {
      const n = [...state.selected].filter((id) => byId[id].role === role).length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", !searching && state.tab === role);
      b.innerHTML = `<span aria-hidden="true">${meta.icon}</span>${meta.label}${n ? `<span class="n">${n}</span>` : ""}`;
      b.onclick = () => { state.tab = role; $("#cat-search").value = ""; renderTabs(); renderCatalog(); };
      box.appendChild(b);
    });
    $("#tab-note").textContent = !searching && state.tab === "flavor" ? "النكهات مش بتدخل في حساب السعرات، والوصفات بتستخدم اللي يتختار منها بس." : "";
  }
  function renderCatalog() {
    const q = $("#cat-search").value.trim();
    const box = $("#catalog");
    box.innerHTML = "";
    const groups = [];
    if (q) {
      Object.keys(ROLES).forEach((role) => {
        const list = ALL.filter((f) => f.role === role && f.name.includes(q));
        if (list.length) groups.push({ title: ROLES[role].label, list });
      });
    } else if (state.tab === "flavor") groups.push({ title: "", list: FLAVORS });
    else FOOD_SECTIONS.filter((s) => s.role === state.tab).forEach((s) => groups.push({ title: s.title, list: FOODS.filter((f) => f.section === s.title && f.role === s.role) }));
    if (!groups.length) { box.innerHTML = `<p class="hint">مفيش مكون بالاسم ده.</p>`; return; }
    groups.forEach((g) => {
      const div = document.createElement("div");
      div.className = "group";
      if (g.title) div.innerHTML = `<h4>${g.title}</h4>`;
      const chips = document.createElement("div");
      chips.className = "chips";
      g.list.forEach((f) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.dataset.role = f.role;
        b.setAttribute("aria-pressed", state.selected.has(f.id));
        b.innerHTML = `<span class="e" aria-hidden="true">${f.emoji}</span>${esc(f.name)}`;
        b.onclick = () => { toggle(f.id, true); };
        chips.appendChild(b);
      });
      div.appendChild(chips);
      box.appendChild(div);
    });
  }

  /* ================= السعرات ================= */
  function setKcal(v) {
    const n = Math.max(100, Math.min(2500, Math.round(+v || 0)));
    $("#kcal").value = n;
    $$("#presets button").forEach((b) => b.classList.toggle("on", +b.dataset.k === n));
  }

  /* ================= الحساب ================= */
  function calculate(scroll) {
    $("#error").textContent = "";
    $("#s3-body").hidden = true;
    $("#s3-empty").hidden = false;
    const foods = [...state.selected].map((id) => byId[id]).filter((f) => f.role !== "flavor");
    if (document.getElementById("variety").value === "all" && state.mode === "manual" && (document.getElementById("diet").value !== "balanced" || +document.getElementById("cook-time").value < 90)) { $("#error").textContent = "مع فلاتر النظام والوقت اختار وضع التنويع أو التقسيم التلقائي."; return false; }
    if (document.getElementById("variety").value === "all" && foods.some(f => !Wellness.allowed(f))) { $("#error").textContent = "في مكونات مش مناسبة للنظام أو الاستبعادات. شيلها أو اختار وضع التنويع."; return false; }
    state.flavors = [...state.selected].map((id) => byId[id]).filter((f) => f.role === "flavor");
    if (!foods.length) {
      $("#error").textContent = "محتاجين مكون أكل واحد على الأقل في الخطوة الأولى (النكهات لوحدها مش كفاية).";
      if (scroll) $("#step1").scrollIntoView({ block: "start" });
      return false;
    }
    const res = planMeal(foods, parseFloat($("#kcal").value), state.goal);
    if (res.error) { $("#error").textContent = res.error; return false; }
    state.plan = res;
    state.showAll = false;
    $("#s3-empty").hidden = true;
    $("#s3-body").hidden = false;
    renderAmounts();
    renderResults();
    save();
    if (scroll) $("#step3").scrollIntoView({ block: "start" });
    return true;
  }

  function renderAmounts() {
    const plan = state.plan;
    const t = totals(plan.items);
    $("#amounts-total").textContent = `${Math.round(t.kcal)} من ${$("#kcal").value} سعرة`;
    const w = $("#warning");
    if (plan.warning && Math.abs(t.kcal - plan.target) > plan.target * 0.08) { w.textContent = plan.warning; w.hidden = false; }
    else w.hidden = true;
    const ul = $("#items");
    ul.innerHTML = "";
    plan.items.forEach((it, i) => {
      const s = itemStats(it.food, it.qty);
      const li = document.createElement("li");
      li.className = "item";
      const note = it.food.cooked ? "وزن بعد الطبخ" : it.food.unit.g === 1 ? "" : `${Math.round(s.grams)} جم`;
      li.innerHTML = `
        <span class="e" aria-hidden="true">${it.food.emoji}</span>
        <div><b>${esc(it.food.name)}</b>${note ? `<small>${note}</small>` : ""}</div>
        <div class="qty">
          <button type="button" class="adj" data-d="1" aria-label="زوّد ${esc(it.food.name)}">+</button>
          <output>${formatQty(it.food, it.qty)}</output>
          <button type="button" class="adj" data-d="-1" aria-label="قلّل ${esc(it.food.name)}">−</button>
        </div>
        <span class="kc">${Math.round(s.kcal)} سعرة</span>`;
      $$(".adj", li).forEach((b) => (b.onclick = () => adjust(i, +b.dataset.d)));
      ul.appendChild(li);
    });
  }
  function adjust(i, dir) {
    const it = state.plan.items[i];
    const q = +(it.qty + dir * it.food.step).toFixed(2);
    if (q < it.food.step - 1e-9) return toast("دي أقل كمية. لو المكون مش محتاجينه، يتشال من السلة.");
    if (q > it.food.max * 2) return toast("الكمية دي كبيرة على وجبة واحدة.");
    it.qty = q;
    renderAmounts();
    renderResults(true);
  }

  /* ================= الكروت ================= */
  function macrosOf(items) {
    return items.reduce((t, it) => { const s = itemStats(it.food, it.qty); t.k += s.kcal; t.p += s.p; t.c += s.c; t.f += s.f; return t; }, { k: 0, p: 0, c: 0, f: 0 });
  }
  const ingrText = (items) => items.map((it) => `${it.food.name} (${formatQty(it.food, it.qty)})`).join(" + ");

  function modelFromSuggestion(sug) {
    const items = sug.meals.flatMap((m) => m.items);
    return {
      title: sug.meals.length === 2 ? `${sug.meals[0].name} + ${sug.meals[1].name}` : sug.meals[0].name,
      sub: sug.meals.length === 2 ? "مقسمة على وجبتين" : "",
      two: sug.meals.length === 2,
      tpl: sug.meals[0].tpl,
      meals: sug.meals.map((m, i) => ({ ...m, label: sug.meals.length === 2 ? (i ? "الوجبة التانية" : "الوجبة الأولى") : "" })),
      items,
      note: sug.fallback ? "المكونات دي مش بتتقسم على وجبتين بشكل منطقي، فدي وجبة واحدة فيها كل حاجة." : "",
    };
  }

  function buildModels() {
    const items = state.plan.items;
    $("#mode").closest(".opt").hidden = document.getElementById("variety").value === "creative";
    if (document.getElementById("variety").value === "creative") {
      const all = Wellness.generate(items.map(i=>i.food), state.flavors, +$("#kcal").value, state.goal, state.meal, state.varietySeed || 1);
      $("#s3-sub").textContent = all.length ? `${all.length} فكرة من مجموعات مختلفة من مكوناتك · الأوقات تقريبية · كل كارت بديل مستقل للوجبة` : "مفيش وصفات مطابقة حاليًا. زوّد مكونات مناسبة أو غيّر وقت التحضير والنظام.";
      $("#amounts").hidden = true;
      $("#warning").hidden = true;
      $("#manual").hidden = true;
      return all.map(x=>({...modelFromSuggestion(x),sub:`حوالي ${x.time} دقيقة · ${Math.round(totals(x.meals[0].items).kcal)} من ${$("#kcal").value} سعرة مستهدفة`}));
    }
    $("#amounts").hidden = false;
    $("#s3-sub").textContent = "كل المكونات بكمياتها في كل اقتراح، مع إمكانية التقسيم.";
    if (state.mode !== "manual") {
      const all = suggestMeals(items, state.flavors.filter(Wellness.allowed), { mode: state.mode, seed: 1, mealType: state.meal }).filter(s=>{
        const t = totals(s.meals.flatMap(m=>m.items)), diet=document.getElementById("diet").value;
        return s.meals.every(m=>Wellness.recipeMinutes(m)<=+document.getElementById("cook-time").value) && (diet!=="keto" || (t.c<=15 && t.c*4<=t.kcal*.12)) && (diet!=="lowcarb" || t.c*4<=t.kcal*.3) && (diet!=="protein" || t.p*4>=t.kcal*.25);
      });
      return all.map(modelFromSuggestion);
    }
    // تحديد يدوي
    const out = [];
    const groups = [["g1", "طبق ١"], ["g2", "طبق ٢"], ["g3", "طبق ٣"]];
    groups.forEach(([gid, label]) => {
      const list = items.filter((it) => state.assign[it.food.id] === gid);
      if (!list.length) return;
      const tpl = state.groupTpl[gid] || "any";
      const meals = mealsForGroup(list, state.flavors, tpl, 1, state.meal);
      meals.slice(0, tpl === "any" ? +state.count : 1).forEach((m, i) => {
        out.push({ title: m.name, sub: meals.length > 1 && tpl === "any" ? `${label}، اقتراح ${toAr(i + 1)}` : label, tpl: m.tpl, meals: [{ ...m, label }], items: list });
      });
    });
    const plain = items.filter((it) => state.assign[it.food.id] === "plain");
    if (plain.length) {
      out.push({
        title: plain.length === 1 ? `${plain[0].food.name} سادة` : "أكل سادة", sub: "سادة", tpl: "plain",
        meals: [{ name: "سادة", label: "سادة", time: "دقايق", steps: plain.map((it) => plainLine(it)), tpl: "plain", items: plain, kcal: macrosOf(plain).k }],
        items: plain,
      });
    }
    return out;
  }

  function mediaEl(model) {
    const div = document.createElement("div");
    div.className = "meal-media";
    const photo = PHOTOS[model.tpl];
    if (photo) {
      div.innerHTML = `<img src="${esc(photo)}" alt="${esc(model.title)}" loading="lazy" />`;
    } else {
      div.style.setProperty("--art", ART_BG[hash(model.tpl || "x") % ART_BG.length]);
      const ings = [...new Set(model.items.map((it) => it.food.emoji))].slice(0, 6);
      div.innerHTML = `<div class="art" aria-hidden="true"><span class="main">${TPL_EMOJI[model.tpl] || "🍽️"}</span>${ings.map((e) => `<span class="ing">${e}</span>`).join("")}</div>`;
    }
    return div;
  }

  function macroRow(m) {
    return `<div class="macros-row">
      <div class="macro"><span class="ic" aria-hidden="true">${ICON.carb}</span><div><span>الكربوهيدرات</span><b>${Math.round(m.c)} جم</b></div></div>
      <div class="macro"><span class="ic" aria-hidden="true">${ICON.protein}</span><div><span>البروتين</span><b>${Math.round(m.p)} جم</b></div></div>
      <div class="macro"><span class="ic" aria-hidden="true">${ICON.fat}</span><div><span>الدهون</span><b>${Math.round(m.f)} جم</b></div></div>
    </div>`;
  }

  function cardEl(model, i, opts = {}) {
    const m = macrosOf(model.items);
    const card = document.createElement("article");
    card.className = "meal-card";
    card.style.setProperty("--i", opts.quiet ? 0 : i);
    if (opts.quiet) card.style.animation = "none";
    const media = mediaEl(model);
    media.insertAdjacentHTML("beforeend", `<span class="kcal-pill">${Math.round(m.k)} كالوري</span>${model.two ? '<span class="tag-two">وجبتين</span>' : ""}`);
    const heart = document.createElement("button");
    heart.type = "button";
    heart.className = "heart-btn";
    heart.innerHTML = ICON.heart;
    const syncHeart = () => {
      const on = isFav(model);
      heart.setAttribute("aria-pressed", on);
      heart.setAttribute("aria-label", on ? "شيلها من المفضلة" : "احفظها في المفضلة");
    };
    syncHeart();
    heart.onclick = () => { toggleFav(model); heart.classList.remove("beat"); void heart.offsetWidth; heart.classList.add("beat"); syncHeart(); };
    media.appendChild(heart);
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "meal-body";
    body.innerHTML = `
      <h3>${esc(model.title)}</h3>
      ${model.sub ? `<span class="sub">${esc(model.sub)}</span>` : ""}
      ${opts.savedAt ? `<span class="saved-at">اتحفظت ${opts.savedAt}</span>` : ""}
      <p class="ingr">المكونات: ${esc(ingrText(model.items))}</p>
      ${macroRow(m)}`;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const det = document.createElement("button");
    det.type = "button";
    det.className = "details-btn";
    det.innerHTML = `عرض التفاصيل <span aria-hidden="true">←</span>`;
    det.onclick = () => openDetails(model, opts);
    actions.appendChild(det);
    if (opts.entry) {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "use-btn";
      use.textContent = "استخدم المكونات";
      use.onclick = () => useSaved(opts.entry);
      actions.appendChild(use);
    }
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderResults(quiet) {
    $("#manual").hidden = state.mode !== "manual" || document.getElementById("variety").value === "creative";
    if (state.mode === "manual") renderManualPanel();
    state.models = buildModels();
    const limit = (state.mode === "manual" && document.getElementById("variety").value === "all") || state.showAll ? state.models.length : +state.count;
    const box = $("#cards");
    box.innerHTML = "";
    const note = state.models[0] && state.models[0].note;
    if (note) box.insertAdjacentHTML("beforeend", `<p class="hint" style="grid-column:1/-1">${note}</p>`);
    state.models.slice(0, limit).forEach((m, i) => box.appendChild(cardEl(m, i, { quiet })));
    const more = (state.mode !== "manual" || document.getElementById("variety").value === "creative") && state.models.length > +state.count;
    const sa = $("#show-all");
    sa.hidden = !more;
    sa.innerHTML = state.showAll ? "عرض أقل" : `عرض الكل (${toAr(state.models.length)}) <span aria-hidden="true">←</span>`;
  }

  /* ---------- تحديد يدوي ---------- */
  const GROUPS = [["g1", "طبق ١"], ["g2", "طبق ٢"], ["g3", "طبق ٣"], ["plain", "سادة"]];
  function renderManualPanel() {
    const items = state.plan.items;
    items.forEach((it) => { if (!state.assign[it.food.id]) state.assign[it.food.id] = "g1"; });
    const ul = $("#assign");
    ul.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="who"><span class="e" aria-hidden="true">${it.food.emoji}</span>${esc(it.food.name)} <small>${formatQty(it.food, it.qty)}</small></span>`;
      const pills = document.createElement("div");
      pills.className = "pills small";
      pills.setAttribute("role", "radiogroup");
      pills.setAttribute("aria-label", `${it.food.name} يتاكل فين`);
      GROUPS.forEach(([gid, label]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", state.assign[it.food.id] === gid);
        b.textContent = label;
        b.onclick = () => { state.assign[it.food.id] = gid; renderResults(true); };
        pills.appendChild(b);
      });
      li.appendChild(pills);
      ul.appendChild(li);
    });
    const gt = $("#group-types");
    gt.innerHTML = "";
    GROUPS.slice(0, 3).forEach(([gid, label]) => {
      const list = items.filter((it) => state.assign[it.food.id] === gid);
      if (!list.length) return;
      const opts = templatesFor(list, state.flavors, 1, state.meal);
      let choice = state.groupTpl[gid] || "any";
      if (choice !== "any" && !opts.some((o) => o.id === choice)) choice = state.groupTpl[gid] = "any";
      const lab = document.createElement("label");
      lab.innerHTML = `نوع ${label}`;
      const sel = document.createElement("select");
      sel.innerHTML = `<option value="any">الموقع يقترح</option>` + opts.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join("");
      sel.value = choice;
      sel.onchange = () => { state.groupTpl[gid] = sel.value; renderResults(true); };
      lab.appendChild(sel);
      gt.appendChild(lab);
    });
  }

  /* ================= التفاصيل ================= */
  function openDetails(model, opts = {}) {
    const m = macrosOf(model.items);
    $("#det-title").textContent = model.title;
    const body = $("#det-body");
    body.innerHTML = "";
    const hero = document.createElement("div");
    hero.className = "det-hero";
    hero.appendChild(mediaEl(model));
    const info = document.createElement("div");
    const time = model.meals.map((x) => x.time).filter(Boolean).join(" + ");
    info.innerHTML = `
      <div class="det-meta"><span class="k">${Math.round(m.k)} كالوري</span>${time ? `<span>⏱ ${esc(time)}</span>` : ""}${model.two ? "<span>وجبتين</span>" : ""}</div>
      ${macroRow(m)}`;
    const actions = document.createElement("div");
    actions.className = "det-actions";
    actions.style.marginTop = "16px";
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "btn-primary small";
    const syncFav = () => (favBtn.textContent = isFav(model) ? "محفوظة في المفضلة ✓" : "احفظ في المفضلة ♡");
    syncFav();
    favBtn.onclick = () => { toggleFav(model); syncFav(); };
    actions.appendChild(favBtn);
    if (opts.entry) {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "btn-outline";
      use.textContent = "استخدم نفس المكونات";
      use.onclick = () => { $("#details-modal").close(); useSaved(opts.entry); };
      actions.appendChild(use);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "link-btn";
    copy.textContent = "نسخ كبرومبت لمساعد ذكاء اصطناعي";
    copy.onclick = () => copyPrompt(model);
    actions.appendChild(copy);
    info.appendChild(actions);
    hero.appendChild(info);
    body.appendChild(hero);

    model.meals.forEach((meal) => {
      const sec = document.createElement("section");
      sec.className = "det-meal";
      sec.innerHTML = `
        ${meal.label ? `<span class="lbl">${esc(meal.label)} · ${Math.round(macrosOf(meal.items).k)} كالوري</span>` : ""}
        ${model.meals.length > 1 || meal.tpl === "plain" ? `<h4>${esc(meal.tpl === "plain" ? "بيتاكل لوحده" : meal.name)}</h4>` : "<h4>المكونات والطريقة</h4>"}
        <ul class="ing-list">${meal.items.map((it) => `<li data-role="${it.food.role}"><span aria-hidden="true">${it.food.emoji}</span>${esc(it.food.name)} (${formatQty(it.food, it.qty)})</li>`).join("")}</ul>
        <ol class="steps-list">${meal.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
        ${meal.tip ? `<p class="det-tip">💡 ${esc(meal.tip)}</p>` : ""}`;
      body.appendChild(sec);
    });
    $("#details-modal").showModal();
  }

  async function copyPrompt(model) {
    const lines = model.items.map((it) => `- ${it.food.name}: ${formatQty(it.food, it.qty)}${it.food.cooked ? " (وزن بعد الطبخ)" : ""}`).join("\n");
    const fl = state.flavors.length ? `\nالنكهات المتاحة: ${state.flavors.map((f) => f.name).join("، ")}` : "";
    const prompt = `عندي المكونات دي بالكميات دي بالظبط:\n${lines}${fl}\n\nاقترح طريقة تحضير لوجبة "${model.title}". الشروط: كل مكون يتستخدم بكميته كاملة، وممنوع أي مكون مش مكتوب (المسموح ملح ومية بس). اكتب الخطوات والوقت.`;
    try { await navigator.clipboard.writeText(prompt); toast("اتنسخ"); } catch (_) { window.prompt("البرومبت جاهز للنسخ:", prompt); }
  }

  /* ================= المفضلة ================= */
  const FAV_KEY = "wimk:favorites";
  let favs = store.get(FAV_KEY, []);
  const sig = (model) => model.title + "|" + model.items.map((it) => it.food.id + ":" + it.qty).sort().join(",");
  const isFav = (model) => favs.some((f) => f.sig === sig(model));

  function toggleFav(model) {
    const s = sig(model);
    const i = favs.findIndex((f) => f.sig === s);
    if (i >= 0) {
      favs.splice(i, 1);
      toast("اتشالت من المفضلة");
    } else {
      favs.unshift({
        sig: s, savedAt: Date.now(), title: model.title, sub: model.sub || "", tpl: model.tpl, two: !!model.two,
        meals: model.meals.map((m) => ({ name: m.name, label: m.label || "", time: m.time, steps: m.steps, tip: m.tip || "", tpl: m.tpl, items: m.items.map((it) => [it.food.id, it.qty]) })),
        basket: [...state.selected], kcal: +$("#kcal").value, goal: state.goal, meal: state.meal,
      });
      toast("اتحفظت في المفضلة ♥");
    }
    if (!store.set(FAV_KEY, favs)) toast("المتصفح ده مش سامح بالحفظ، فالمفضلة هتتمسح لما الصفحة تتقفل.");
    renderFavs();
  }

  function modelFromEntry(e) {
    const meals = e.meals.map((m) => ({ ...m, items: m.items.filter(([id]) => byId[id]).map(([id, qty]) => ({ food: byId[id], qty })) }));
    return { title: e.title, sub: e.sub, tpl: e.tpl, two: e.two, meals, items: meals.flatMap((m) => m.items) };
  }

  function renderFavs() {
    const box = $("#fav-cards");
    box.innerHTML = "";
    $("#fav-empty").hidden = favs.length > 0;
    const c = $("#fav-count");
    c.hidden = !favs.length;
    c.textContent = toAr(favs.length);
    const fmt = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" });
    favs.forEach((e, i) => box.appendChild(cardEl(modelFromEntry(e), i, { entry: e, savedAt: fmt.format(new Date(e.savedAt)), quiet: true })));
    // حدّث قلوب الكروت اللي في الاقتراحات
    $$("#cards .meal-card").forEach((card, i) => {
      const m = state.models[i];
      const h = $(".heart-btn", card);
      if (m && h) h.setAttribute("aria-pressed", isFav(m));
    });
  }

  function useSaved(e) {
    state.selected = new Set(e.basket.filter((id) => byId[id]));
    state.goal = GOALS[e.goal] ? e.goal : "balanced";
    state.meal = MEAL_KCAL[e.meal] ? e.meal : state.meal;
    setKcal(e.kcal);
    syncPills();
    renderBasket();
    calculate(true);
    toast("رجعت المكونات والسعرات زي ما كانت");
  }

  /* ================= روابط عامة ================= */
  function syncPills() {
    [["meal", state.meal], ["goal", state.goal], ["mode", state.mode], ["count", state.count]].forEach(([id, v]) =>
      $$(`#${id} button`).forEach((b) => b.setAttribute("aria-checked", b.dataset.v === v)));
  }
  function bindPills(id, key, after) {
    $$(`#${id} button`).forEach((b) => (b.onclick = () => {
      state[key] = b.dataset.v;
      syncPills();
      if (after) after(b.dataset.v);
      save();
    }));
  }

  function info(title, html) {
    $("#info-title").textContent = title;
    $("#info-body").innerHTML = html;
    $("#info-modal").showModal();
  }

  function bind() {
    // البحث
    const s = $("#search");
    s.addEventListener("input", () => { sugIdx = -1; renderSuggest(); });
    s.addEventListener("blur", () => setTimeout(() => ($("#suggest").hidden = true), 120));
    s.addEventListener("keydown", (e) => {
      const ul = $("#suggest"), list = ul._list || [];
      if (e.key === "ArrowDown") { sugIdx = Math.min(list.length - 1, sugIdx + 1); renderSuggest(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sugIdx = Math.max(0, sugIdx - 1); renderSuggest(); e.preventDefault(); }
      else if (e.key === "Enter") { const f = list[Math.max(0, sugIdx)]; if (f) { toggle(f.id); s.value = ""; ul.hidden = true; } e.preventDefault(); }
      else if (e.key === "Escape") ul.hidden = true;
    });

    // كل المكونات
    $("#open-catalog").onclick = () => { renderTabs(); renderCatalog(); $("#catalog-modal").showModal(); };
    $("#cat-search").addEventListener("input", () => { renderTabs(); renderCatalog(); });

    // السعرات
    $("#kcal-minus").onclick = () => { setKcal(+$("#kcal").value - 50); save(); };
    $("#kcal-plus").onclick = () => { setKcal(+$("#kcal").value + 50); save(); };
    $("#kcal").addEventListener("change", (e) => { setKcal(e.target.value); save(); if (state.plan) calculate(); });
    $("#kcal").addEventListener("keydown", (e) => e.key === "Enter" && calculate(true));
    $$("#presets button").forEach((b) => (b.onclick = () => { setKcal(b.dataset.k); save(); if (state.plan) calculate(); }));
    bindPills("meal", "meal", (v) => { setKcal(MEAL_KCAL[v]); if (state.plan) calculate(); });
    bindPills("goal", "goal", () => state.plan && calculate());
    bindPills("mode", "mode", () => state.plan && renderResults());
    bindPills("count", "count", () => state.plan && renderResults());
    $("#calc").onclick = () => { state.varietySeed = (state.varietySeed || 0) + 1; calculate(true); };
    $("#recalc").onclick = () => calculate();
    $("#show-all").onclick = () => { state.showAll = !state.showAll; renderResults(); };

    // النوافذ
    $$("dialog").forEach((d) => {
      d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
    });
    $("#open-about").onclick = (e) => {
      e.preventDefault();
      info("عن الموقع", `<p>What's in My Kitchen? بيحسب كمية كل مكون من اللي عندك عشان الوجبة توصل للسعرات اللي محتاجها، وبيقترح طرق تحضير تستخدم كل المكونات اللي اخترتها، من غير أي مكون زيادة غير الملح والمية.</p><p>القيم تقريبية لأغراض التخطيط، ومش بديل عن استشارة أخصائي تغذية.</p>`);
    };
    const loginInfo = () => info("الحساب", `<p>الحسابات لسه مش متاحة في النسخة دي.</p><p>المفضلة بتتحفظ دلوقتي على الجهاز والمتصفح ده بس. لما الحسابات تشتغل، المفضلة هتبقى متاحة من أي جهاز.</p>`);
    $("#open-login").onclick = loginInfo;
    $("#open-account").onclick = loginInfo;

    // الوضع
    $("#theme-toggle").onclick = () => {
      const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("wimk:theme", t); } catch (_) {}
    };

    // تمييز رابط القسم الحالي
    if ("IntersectionObserver" in window) {
      const links = { top: $('.main-nav a[href="#top"]'), step3: $('.main-nav a[href="#step3"]'), favorites: $('.main-nav a[href="#favorites"]') };
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => {
          if (en.isIntersecting && links[en.target.id]) {
            $$(".main-nav a").forEach((a) => a.classList.remove("active"));
            links[en.target.id].classList.add("active");
          }
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      ["top", "step3", "favorites"].forEach((id) => io.observe(document.getElementById(id)));
    }
  }

  function initHero() {
    if (PHOTOS.HERO) {
      const b = $("#hero-bowl");
      b.classList.add("photo");
      b.style.backgroundImage = `url("${PHOTOS.HERO}")`;
    }
  }

  ["diet", "cook-time", "variety"].forEach(id => document.getElementById(id).addEventListener("change", () => { if (state.plan) calculate(); }));
  document.querySelectorAll('[name="exclude"]').forEach(el=>el.addEventListener("change",()=>{if(state.plan)calculate();}));
  Wellness.init();
  load();
  initHero();
  bind();
  syncPills();
  setKcal($("#kcal").value);
  renderBasket();
  renderFavs();
})();
