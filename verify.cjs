const fs=require('fs'),vm=require('vm'),assert=require('assert');
const els={diet:{value:'balanced'},'cook-time':{value:'90'}};
const ctx=vm.createContext({console,document:{getElementById:id=>els[id],querySelectorAll:()=>[]}});
for(const f of ['foods','planner','recipes','wellness'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),ctx);
const run=vm.runInContext(`(diet,time)=>{ document.getElementById('diet').value=diet; document.getElementById('cook-time').value=time; const pool=FOODS.filter(f=>['egg','rice','chicken','tomato','cucumber','oliveoil','greek','oats','banana','cottage','tuna'].includes(f.id)); return Wellness.generate(pool,[],450,'balanced','lunch',3); }`,ctx);
for(const diet of ['balanced','keto','lowcarb','vegetarian','vegan','protein']){
 const r=run(diet,'90'); console.log(diet,r.length, [...new Set(r.map(x=>x.meals[0].tpl))].join(','));
 assert(r.length>0, diet+' should produce recipes');
 for(const x of r){
 const t=vm.runInContext('totals',ctx)(x.meals[0].items);
 if(diet==='keto'){assert(t.c<=15);assert(t.c*4<=t.kcal*.12);}
 if(diet==='lowcarb')assert(t.c*4<=t.kcal*.3);
 if(diet==='protein')assert(t.p*4>=t.kcal*.25);
 assert(x.meals[0].items.every(i=>i.qty>0 && Number.isFinite(i.qty)));
 assert(x.meals[0].steps.length);assert(x.meals[0].items.every(i=>vm.runInContext('Wellness.allowed',ctx)(i.food)));}
}
assert(run('balanced','15').every(x=>x.time<=15));
console.log('Recipe filtering, quantities, steps and time checks passed.');const summarize=vm.runInContext('Wellness.goalSummary',ctx);
const loss=summarize(85,75,2171.4);
assert.equal(loss.baseline,2171); assert.equal(loss.daily,1871); assert.equal(loss.adjustment,-300);
assert.equal(loss.kilos,10); assert(loss.referenceMinWeeks===10 && loss.referenceMaxWeeks===20);
const hold=summarize(75,75,2000); assert.equal(hold.daily,2000);assert.equal(hold.referenceMinWeeks,0);
const gain=summarize(65,70,2000);assert.equal(gain.daily,2300);assert.equal(gain.adjustment,300);
console.log('Calorie breakdown and timeline checks passed.');

const reference=summarize(75,60,2034); assert.equal(reference.referenceMinWeeks,15); assert.equal(reference.referenceMaxWeeks,30); assert(!("weekly" in reference));
