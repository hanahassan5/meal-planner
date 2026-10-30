/* Profile and pantry variety. No network or account required. */
const Wellness = (() => {
  const $ = id => document.getElementById(id);
  const fields = ['weight','height','age','sex','target-weight','activity','diet','fasting','eating-start','daily-meals','variety','cook-time'];
  const dairy = ['milk','yogurt','cheese_soft','cheese_hard','cheese_melt','cream','butter','icecream'];
  const animal = ['poultry','meat','liver','seafood','fish','tuna','fish_ready','deli','kofta','sausage','mince','pane','shawarma','gelatin'];
  const gluten = ['bread_flat','bread_loaf','toast','wrap','cracker','pastry','pasta','noodles'];
  function exclusions() { return [...document.querySelectorAll('[name="exclude"]:checked')].map(x=>x.value); }
  function allowed(f) {
    const diet=$('diet').value, ex=exclusions(), k=f.kind;
    if (['vegetarian','vegan'].includes(diet) && (animal.includes(k) || ['ready','dessert_ready','snack_ready','bar'].includes(k))) return false;
    if (diet==='vegan' && ([...dairy,'egg','honey','halawa'].includes(k) || /عسل|لبن|جبن|زبادي|شوكولاتة|بسكويت|كيك|مايونيز/.test(f.name))) return false;
    if (ex.includes('dairy') && (dairy.includes(k) || /لبن|جبن|زبادي|زبدة|قشطة|شوكولاتة|كيك/.test(f.name))) return false;
    if (ex.includes('gluten') && (gluten.includes(k) || /قمح|برغل|فريك|شعير|سميد|شوفان|كشري|بانيه/.test(f.name))) return false;
    if (ex.includes('nuts') && (['nuts','nutbutter'].includes(k) || /مكسرات|لوز|فستق|سوداني|بندق|كاجو|جوز/.test(f.name))) return false;
    if (ex.includes('egg') && (k==='egg' || /مايونيز|كيك|بان كيك/.test(f.name))) return false;
    if (ex.includes('fish') && ['seafood','fish','tuna','fish_ready'].includes(k)) return false;
    if (diet==='keto' && (f.c>10 || ['carb','fruit'].includes(f.role))) return false;
    if (diet==='lowcarb' && f.c>25) return false;
    return true;
  }
  const minutes = id => ({overnight:480, traybake:45, stuffed:60, soup:35, molokhia:35, skewers:30, bowl:25, pasta:25, pizza:30, loadedpotato:45, koshary:60, stirfry:25, burger:25, wrap:20, shakshuka:20, omelette:15, board:10, salad:15, parfait:5, smoothie:5, snack:5, fruitplate:5, energy:15, nicecream:10}[id] || 30);
  function recipeMinutes(r) {
    if (r.tpl === 'overnight') return 480;
    const nums=String(r.time||'').match(/\d+/g);
    return nums ? Math.max(...nums.map(Number)) * (/ساعة|ساعات/.test(r.time)?60:1) : minutes(r.tpl);
  }
  function generate(foods, flavors, target, goal, meal, seed) {
    const pool=foods.filter(allowed), out=[], seen=new Set(), rng=mulberry32(seed);
    const diet=$('diet').value;
    for(let n=0;n<85;n++) {
      const shuffled=[...pool];
      for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
      const subset=n===0 ? pool : shuffled.slice(0, Math.min(pool.length, 2+n%4));
      if (!subset.length) continue;
      const p=planMeal(subset,target,goal);
      if(p.error) continue;
      for(const option of templatesFor(p.items,flavors.filter(allowed),seed+n,meal)) {
        const r=option.recipe, t=totals(p.items), time=recipeMinutes(r);
        if(time>+$('cook-time').value) continue;
        if(diet==='keto' && (t.c>15 || t.c*4>t.kcal*.12)) continue;
        if(diet==='lowcarb' && t.c*4>t.kcal*.30) continue;
        if(diet==='protein' && t.p*4<t.kcal*.25) continue;
        const key=r.tpl+'|'+subset.map(f=>f.id).sort().join(',');
        if(seen.has(key)) continue; seen.add(key);
        out.push({meals:[r],score:Math.abs(t.kcal-target)/target,time});
      }
    }
    out.sort((a,b)=>a.score-b.score);
    // Interleave templates so the first page offers different ways to cook.
    const diversified=[], used=new Set();
    for(const x of out) if(!used.has(x.meals[0].tpl)){used.add(x.meals[0].tpl);diversified.push(x);}
    return [...diversified,...out.filter(x=>!diversified.includes(x))].slice(0,36);
  }
  function persist(){try{localStorage.setItem('wimk:profile',JSON.stringify({values:Object.fromEntries(fields.map(id=>[id,$(id).value])),exclude:exclusions()}));}catch{}}
  function goalSummary(weight, target, maintenance) {
    const direction = Math.sign(target-weight);
    const baseline = Math.round(maintenance);
    const adjustment = direction * 300;
    const daily = baseline + adjustment;
    const kilos = Math.abs(weight-target);
    // Reference scenario from NHS guidance, not a prediction from the calorie deficit.
    return {direction, baseline, adjustment, daily, kilos,
      referenceMinWeeks: direction < 0 ? Math.ceil(kilos/1) : 0,
      referenceMaxWeeks: direction < 0 ? Math.ceil(kilos/0.5) : 0};
  }
  function compute(e) {
    if(e)e.preventDefault();
    const w=+$('weight').value,h=+$('height').value,a=+$('age').value,tw=+$('target-weight').value;
    $('profile-result').hidden=true; $('profile-error').textContent='';
    if(![w,h,a,tw].every(Number.isFinite)||w<35||w>300||h<130||h>230||a<18||a>85||tw<35||tw>300){$('profile-error').textContent='راجع الوزن والطول والسن؛ الحاسبة مخصصة للبالغين من 18 إلى 85 سنة.';return;}
    if(tw/((h/100)**2)<18.5){$('profile-error').textContent='الوزن المستهدف أقل من النطاق المرجعي للبالغين. اختار هدف مناسب مع مختص.';return;}
    const maintenance=(10*w+6.25*h-5*a+($('sex').value==='male'?5:-161))*+$('activity').value;
    const summary=goalSummary(w,tw,maintenance);
    const {daily, baseline, adjustment, kilos, referenceMinWeeks, referenceMaxWeeks}=summary;
    if(daily<1200){$('profile-error').textContent='التقدير منخفض؛ الأفضل تحديد السعرات مع مختص بدل تطبيق عجز تلقائي.';return;}
    const meal=Math.min(2500,Math.max(100,Math.round(daily/+$('daily-meals').value/10)*10));
    document.querySelector(`#goal [data-v="${tw<w?'cut':tw>w?'bulk':'balanced'}"]`).click();
    $('kcal').value=meal; $('kcal').dispatchEvent(new Event('change',{bubbles:true}));
    const start=$('eating-start').value || '12:00', fast=+$('fasting').value;
    const [hh,mm]=start.split(':').map(Number), end=((hh*60+mm+(24-fast)*60)%1440);
    const endText=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
    const action=tw<w?'التخسيس':tw>w?'زيادة الوزن':'تثبيت الوزن';
    const timeline=tw<w ? `<div class="goal-timeline"><h3>إيه المدة المعقولة لهدفك؟</h3><p>هدفك نزول <strong>${kilos.toFixed(1)} كجم</strong>، من ${w} إلى ${tw} كجم.</p><p>كمرجع عام، NHS بتقترح استهداف نزول تدريجي حوالي <strong>0.5–1 كجم أسبوعيًا</strong>. لو تحقق المعدل ده، هدفك يساوي حسابيًا <strong>${referenceMinWeeks}–${referenceMaxWeeks} أسبوع</strong> (حوالي ${Math.max(1,Math.round(referenceMinWeeks/4.35))}–${Math.max(1,Math.round(referenceMaxWeeks/4.35))} شهر).</p><p><strong>دي مقارنة مرجعية، مش توقع لمدة نزولك على السعرات المعروضة.</strong> عجز 300 سعرة الموجود هنا اختيار مبدئي محافظ، ومش معناه إنك هتنزل بالمعدل المرجعي.</p><p>الحاسبة الحالية بتقدّر احتياج السعرات، لكنها مش نموذج طبي لتوقع تغير الوزن مع الوقت. علشان كده مش هنحوّل العجز الثابت لموعد وصول شخصي. الاحتياج بيتغير مع النزول، والنتيجة بتتأثر بالالتزام والنشاط والحالة الصحية.</p><small>راجع متوسط وزنك كل 2–4 أسابيع وحدّث بياناتك. لتخطيط المدة والسعرات مع تغير الوزن، استخدم نموذج NIDDK أو راجع مختص.</small><p><a href="https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/tips-to-help-you-lose-weight/" target="_blank" rel="noopener">مصدر المعدل المرجعي · NHS</a> · <a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noopener">مخطط الوزن والمدة · NIDDK</a></p></div>` : tw>w ? `<div class="goal-timeline"><h3>هدف الزيادة: ${kilos.toFixed(1)} كجم</h3><p>الزيادة المقترحة 300 سعرة يوميًا فوق سعرات التثبيت. مدة الزيادة بتختلف حسب التمرين وتكوين الجسم؛ تابع وزنك وأعد الحساب كل 2–4 أسابيع.</p></div>` : `<div class="goal-timeline"><h3>أنت اخترت تثبيت وزنك</h3><p>مفيش عجز أو زيادة مضافة، ومفيش مدة نزول لأن الوزن المستهدف هو وزنك الحالي.</p></div>`;
    $('profile-result').innerHTML=`<h3 class="result-title">خطة ${action} اليومية</h3><div class="plan-stats calorie-breakdown"><div><span>١ · سعرات تثبيت وزنك الحالي</span><b>${baseline}</b><span>سعرة في اليوم قبل أي عجز أو زيادة</span></div><div><span>٢ · ${adjustment<0?'العجز اليومي':adjustment>0?'الزيادة اليومية':'التعديل اليومي'}</span><b>${Math.abs(adjustment)}</b><span>${adjustment<0?'سعرة بنخصمها من سعرات التثبيت':adjustment>0?'سعرة بنضيفها لسعرات التثبيت':'سعرة · هدفك تثبيت الوزن'}</span></div><div class="daily-target"><span>٣ · كُل حوالي الرقم ده يوميًا</span><b>${daily}</b><span>سعرة لهدف ${action} · ${adjustment<0?'بعد خصم العجز بالفعل':adjustment>0?'بعد إضافة الزيادة بالفعل':'بدون عجز أو زيادة'}</span></div></div><p class="calorie-equation"><strong dir="ltr" class="equation-numbers">${baseline} ${adjustment<0?'−': '+'} ${Math.abs(adjustment)} = ${daily} سعرة يوميًا</strong><br>${adjustment<0?'الـ '+daily+' هي إجمالي أكلك وشربك طول اليوم علشان تخس. ما تخصمش منها 300 تاني.':'الـ '+daily+' هي إجمالي السعرات المقترحة لكل اليوم.'}</p>${timeline}<div class="meal-budget"><strong>تقسيم اليوم: حوالي ${meal} سعرة لكل وجبة</strong><p>على ${$('daily-meals').value} وجبات بالتساوي، من إجمالي ${daily} سعرة في اليوم. رقم الوجبة متقرب؛ خلي مجموع وجباتك وسناكاتك ومشروباتك قريب من إجمالي اليوم.</p></div><p>${fast?`نافذة الأكل من <b dir="ltr">${start}</b> إلى <b dir="ltr">${endText}</b> · الصيام ${fast} ساعة.`:'وجباتك على مواعيدك، من غير نافذة صيام.'} تم نقل سعرات الوجبة للخطوة التالية. غيّرها براحتك.</p>`;
    $('profile-result').hidden=false; persist();
  }
  function init(){
    try{const d=JSON.parse(localStorage.getItem('wimk:profile'));if(d){fields.forEach(id=>{if(d.values?.[id]!==undefined)$(id).value=d.values[id];});document.querySelectorAll('[name="exclude"]').forEach(x=>x.checked=(d.exclude||[]).includes(x.value));}}catch{}
    $('profile-form').addEventListener('submit',compute);
    fields.forEach(id=>$(id).addEventListener('change',()=>{persist();$('profile-result').hidden=true;}));
    document.querySelectorAll('[name="exclude"]').forEach(x=>x.addEventListener('change',persist));
  }
  return {allowed,generate,init,minutes,recipeMinutes,goalSummary};
})();
