/* Много Мяса CONTROL v2.0. Только детерминированные демонстрационные данные. */
'use strict';
window.MM = (() => {
  const ASOF = '2026-11-11', FIRST = '2025-01-01', DAY = 86400000;
  const branches = [
    {id:'ural',name:'Уральская, 16',short:'Уральская',color:'#fa7735',factor:1.16},
    {id:'dzh',name:'Джангильдина, 24',short:'Джангильдина',color:'#8062e8',factor:1.04},
    {id:'pob',name:'Победы, 116/8',short:'Победы',color:'#13a797',factor:.88}
  ];
  const sites = [...branches,{id:'factory',name:'27-я линия · фабрика-кухня',short:'27-я линия',color:'#4b89f5'}];
  const categories = [
    ['pork','Свинина','#f47b43'],['lamb','Баранина','#9270e7'],['beef','Говядина','#dc657e'],
    ['veal','Телятина','#c09458'],['seafood','Морепродукты','#4d9bd4'],['drinks','Напитки','#3cbdaf'],
    ['hot','Горячие закуски','#e7ad38'],['poultry','Птица','#94b953'],['sauces','Соусы','#91a1b7'],
    ['salads','Салаты','#49a46a'],['desserts','Десерты','#ca8abc']
  ].map(([id,name,color])=>({id,name,color}));
  const items = [
    ['neck','Свинина шея','pork',399,15,.18,'кг',[22.4,18.7,11.3,56.2]],
    ['tender','Свинина вырезка','pork',469,8,-.29,'кг',[8.6,5.2,0,19.4]],
    ['loin','Свинина корейка','pork',399,6,-.12,'кг',[5.1,6.3,3.8,12.5]],
    ['ribs','Свиные рёбра','pork',449,8,.1,'кг',[9.4,7.2,2.1,24.6]],
    ['rack','Каре ягнёнка','lamb',949,5,-.16,'кг',[4.8,3.4,2.6,16.2]],
    ['lamb-lula','Люля-кебаб из баранины','lamb',399,9,.14,'кг',[7.4,6.8,4.2,22.1]],
    ['napoleon','Наполеон','beef',789,5,.32,'кг',[5.6,4.1,3.2,12.7]],
    ['beef-lula','Люля-кебаб из говядины','beef',449,9,-.09,'кг',[7.7,5.2,3.6,18.3]],
    ['medallions','Медальоны · рулет','beef',749,4,.23,'кг',[3.8,2.6,1.2,9.7]],
    ['veal','Шашлык из телятины','veal',649,7,-.21,'кг',[6.5,4.7,2.8,21.6]],
    ['salmon','Стейк из сёмги','seafood',749,3,-.24,'кг',[3.2,2.1,1.6,0]],
    ['shrimp','Креветки','seafood',649,3,.19,'кг',[2.5,1.8,2.2,0]],
    ['mors','Морс · 0,5 л','drinks',129,20,.08,'шт',[34,28,41,76]],
    ['water','Вода · 0,5 л','drinks',99,14,-.06,'шт',[56,42,36,0]],
    ['adjar','Хачапури по-аджарски','hot',449,9,.21,'шт',[18,14,12,38]],
    ['skewer','Хачапури на вертеле','hot',399,7,-.17,'шт',[22,18,16,45]],
    ['dolma','Долма','hot',499,5,.34,'шт',[64,48,40,160]],
    ['thigh','Куриное бедро','poultry',399,12,.05,'кг',[12.4,9.1,8.2,32.6]],
    ['wings','Куриные крылышки','poultry',499,8,.28,'кг',[8.7,6.4,5.8,23.1]],
    ['adjika','Соус аджика','sauces',79,20,-.07,'кг',[3.2,2.6,1.4,14.8]],
    ['white','Соус белый','sauces',79,22,.04,'кг',[4.1,3.4,2.2,18.6]],
    ['greek','Греческий салат','salads',469,9,-.14,'кг',[4.8,3.2,2.5,0]],
    ['cake','Чизкейк Нью-Йорк','desserts',299,7,.12,'шт',[14,12,9,32]]
  ].map(([id,name,category,price,base,trend,unit,stock])=>({id,name,category,price,base,trend,unit,stock}));
  const channels = [
    {id:'hall',name:'Зал',color:'#8062e8'}, {id:'pickup',name:'Самовывоз',color:'#f47b43'},
    {id:'delivery',name:'Своя доставка',color:'#13b4a1'}, {id:'market',name:'Агрегаторы',color:'#4d91ef'}
  ];
  const parse = s=>new Date(s+'T00:00:00Z');
  const iso = d=>d.toISOString().slice(0,10);
  const add = (s,n)=>iso(new Date(parse(s).getTime()+n*DAY));
  const monthStart = (s,n=0)=>{const d=parse(s);return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)));};
  const monthEnd = s=>add(monthStart(s,1),-1);
  const dates = (a,b)=>{const out=[];for(let d=a;d<=b;d=add(d,1))out.push(d);return out;};
  const shortDate = s=>parse(s).toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).replace(' г.','');
  const fullDate = s=>parse(s).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'});
  const label = r=>r.start===r.end?shortDate(r.start):shortDate(r.start)+' — '+shortDate(r.end);
  function periods(mode,anchor) {
    const date = anchor>ASOF?ASOF:anchor;
    const start = mode==='day'?date:mode==='week'?add(date,-((parse(date).getUTCDay()+6)%7)):monthStart(date);
    const fullEnd = mode==='day'?date:mode==='week'?add(start,6):monthEnd(date);
    const end = fullEnd>ASOF?ASOF:fullEnd, partial=end<fullEnd;
    const current={start,end};
    const refs=Array.from({length:4},(_,i)=>{
      const n=i+1;
      if(mode==='day')return {start:add(start,-7*n),end:add(end,-7*n)};
      if(mode==='week')return {start:add(start,-7*n),end:add(end,-7*n)};
      const a=monthStart(start,-n), e=monthEnd(a);
      return {start:a,end:partial?(add(a,parse(end).getUTCDate()-1)>e?e:add(a,parse(end).getUTCDate()-1)):e};
    });
    return {current,refs,partial,mode};
  }
  const cache = new Map();
  function daily(date,branch) {
    if(date<FIRST||date>ASOF)return null;
    const key=date+'/'+branch.id;if(cache.has(key))return cache.get(key);
    const t=Math.round((parse(date)-parse('2026-11-01'))/DAY), dow=parse(date).getUTCDay();
    const weekday=[1.22,.79,.85,.87,.98,1.2,1.42][dow];
    const bi=branches.indexOf(branch), lines={};let revenue=0,qty=0;
    items.forEach((item,i)=>{
      const noise=1+Math.sin((t+370)*(i+3)*.713+bi*1.17)*.085;
      const trend=Math.max(.4,1+item.trend*Math.max(-1.8,Math.min(1.8,t/28)));
      const q=Math.max(0,Math.round(item.base*branch.factor*weekday*noise*trend));
      const price=item.price-(date<'2026-10-15'&&i%5===0?20:0), r=q*price;
      lines[item.id]={qty:q,revenue:r};revenue+=r;qty+=q;
    });
    const hallFraction=[.33,.4,.29][bi]+Math.sin((t+31)*.19)*.018;
    const hall=Math.round(revenue*hallFraction), pickup=Math.round(revenue*.21), delivery=Math.round(revenue*.27);
    const amounts=[hall,pickup,delivery,revenue-hall-pickup-delivery];
    const channel=channels.map((c,i)=>({id:c.id,revenue:amounts[i],checks:Math.max(1,Math.round(amounts[i]/([1720,2250,2860,3100][i]+bi*75)))}));
    const checks=channel.reduce((s,c)=>s+c.checks,0), result={date,revenue,qty,checks,channel,lines};
    cache.set(key,result);return result;
  }
  function aggregate(range,branchId='all') {
    const bs=branches.filter(b=>branchId==='all'||b.id===branchId), ds=dates(range.start,range.end);
    if(!bs.length||!ds.length)return null;
    const out={revenue:0,qty:0,checks:0,hallRevenue:0,hallChecks:0,lines:Object.fromEntries(items.map(x=>[x.id,{revenue:0,qty:0}])),channel:channels.map(c=>({id:c.id,revenue:0,checks:0}))};
    for(const d of ds)for(const b of bs){
      const v=daily(d,b);if(!v)return null;
      out.revenue+=v.revenue;out.qty+=v.qty;out.checks+=v.checks;
      out.hallRevenue+=v.channel[0].revenue;out.hallChecks+=v.channel[0].checks;
      v.channel.forEach((c,i)=>{out.channel[i].revenue+=c.revenue;out.channel[i].checks+=c.checks;});
      items.forEach(x=>{out.lines[x.id].revenue+=v.lines[x.id].revenue;out.lines[x.id].qty+=v.lines[x.id].qty;});
    }
    out.avg=out.checks?out.revenue/out.checks:null;out.hallAvg=out.hallChecks?out.hallRevenue/out.hallChecks:null;
    return out;
  }
  function mean4(values) {return values.length===4&&values.every(v=>typeof v==='number'&&Number.isFinite(v))?values.reduce((a,b)=>a+b,0)/4:null;}
  function change(value,base) {return value==null||base==null?null:base===0?(value===0?0:Infinity):(value/base-1)*100;}
  function report(mode,anchor,branchId='all') {
    const p=periods(mode,anchor), current=aggregate(p.current,branchId), previous=p.refs.map(r=>aggregate(r,branchId));
    const baseline={};['revenue','qty','checks','hallRevenue','hallChecks'].forEach(k=>baseline[k]=mean4(previous.map(x=>x?.[k]??null)));
    // Weighted checks: total revenue / total receipts, NOT a mean of daily averages.
    baseline.avg=baseline.checks?baseline.revenue/baseline.checks:null;
    baseline.hallAvg=baseline.hallChecks?baseline.hallRevenue/baseline.hallChecks:null;
    const rows=items.map(item=>({ ...item, ...current?.lines[item.id], baseRevenue:mean4(previous.map(x=>x?.lines[item.id].revenue??null)), baseQty:mean4(previous.map(x=>x?.lines[item.id].qty??null)) }));
    return {periods:p,current,previous,baseline,rows};
  }
  function stock(category='all',site='all',query='',lowOnly=false){
    const indices=sites.map((s,i)=>i).filter(i=>site==='all'||sites[i].id===site);
    return items.filter(x=>(category==='all'||x.category===category)&&x.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
      .map(x=>({...x,indices,total:indices.reduce((s,i)=>s+x.stock[i],0),low:indices.some(i=>x.stock[i]<(x.unit==='кг'?3:10))}))
      .filter(x=>!lowOnly||x.low);
  }
  return {ASOF,FIRST,branches,sites,categories,items,channels,parse,iso,add,dates,shortDate,fullDate,label,periods,daily,aggregate,mean4,change,report,stock};
})();
