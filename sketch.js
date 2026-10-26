import { ratesAt, integratedCounts } from './clock.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const birthTotal = document.querySelector('#birth-total');
const deathTotal = document.querySelector('#death-total');
const birthRate = document.querySelector('#birth-rate');
const deathRate = document.querySelector('#death-rate');
const elapsed = document.querySelector('#elapsed');
const motion = document.querySelector('#motion');
const fullscreen = document.querySelector('#fullscreen');
const track = document.querySelector('.pulse-track span');
const world = document.querySelector('#world');
const started = Date.now();
const formatter = new Intl.NumberFormat('en-US');
let paused = reducedMotion.matches;
let years;

// A local copy keeps the piece independent of third-party API availability.
const response = await fetch('./demography.json');
if (!response.ok) throw new Error('Unable to load demographic projection data');
years = (await response.json()).years;

function syncMotionButton() {
  motion.setAttribute('aria-pressed', String(paused));
  motion.setAttribute('aria-label', paused ? '점의 확산 효과 켜기' : '점의 확산 효과 끄기');
}
syncMotionButton();
motion.addEventListener('click', () => { paused = !paused; syncMotionButton(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; syncMotionButton(); });

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (world.requestFullscreen) await world.requestFullscreen();
  } catch { /* A denied fullscreen request leaves the canvas usable. */ }
}
if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  fullscreen.setAttribute('aria-label', document.fullscreenElement ? '전체 화면 종료' : '전체 화면');
});
document.addEventListener('keydown', event => {
  if (event.target.closest('button')) return;
  if (event.code === 'Space') { event.preventDefault(); paused = !paused; syncMotionButton(); }
  if (event.key.toLowerCase() === 'f') toggleFullscreen();
});

const sketch = p => {
  let points = [], active = new Map(), vacant = new Set();
  let previous = { births: 0, deaths: 0 };
  let renderedFrame = 0, completedBirths = 0, completedDeaths = 0;
  let width, height, projected;
  let flares,softFlares,blooms;
  let lastYear;
  const TAU = Math.PI * 2;
  const shades = [
    'rgba(152,158,143,.025)','rgba(161,167,152,.032)',
    'rgba(171,177,161,.040)','rgba(182,188,172,.048)',
    'rgba(192,198,182,.056)','rgba(202,207,192,.065)',
    'rgba(225,230,213,.070)','rgba(241,244,229,.080)'
  ];

  const smooth = value => {
    const t = Math.max(0,Math.min(1,value));
    return t*t*(3-2*t);
  };

  function dimensions() {
    width = p.width; height = p.height;
    world.dataset.layout = 'rectangle';
    world.dataset.rotation = 'none';
  }

  p.setup = () => {
    const canvas = p.createCanvas(world.clientWidth, world.clientHeight);
    canvas.parent('field');
    canvas.elt.setAttribute('aria-hidden', 'true');
    p.pixelDensity(Math.min(devicePixelRatio || 1, 2));
    p.frameRate(40);
    dimensions();
    const count = Math.max(3000,Math.min(18000,Math.round(width*height/70)));
    p.randomSeed(82194);
    for (let i = 0; i < count; i++) {
      // Fixed normalized positions fill the entire rectangular viewport.
      points.push({x:p.random(),y:p.random(),
        size:p.random(.48,1.10),shade:p.random() < .18 ? 6+Math.floor(p.random(2)) : Math.floor(p.random(6)),
        state:0});
    }
    projected = new Float32Array(points.length * 3);
    project();
    flares = {1:makeFlare(1),'-1':makeFlare(-1)};
    softFlares = {1:blurFlare(flares[1],3.6),'-1':blurFlare(flares[-1],1.8)};
    blooms = {1:blurFlare(flares[1],18),'-1':blurFlare(flares[-1],10)};
    world.dataset.ready = 'true';
  };

  function emit(kind, index, now) {
    // Stable placement for each actual counted event; one point per person.
    let hash = Math.imul(index + (kind === 1 ? 17 : 7919), 2654435761) >>> 0;
    let pointIndex;
    if (kind === 1 && vacant.size) {
      pointIndex = vacant.values().next().value;
      vacant.delete(pointIndex);
      // A new birth may reuse storage, but appears at its own fixed location.
      points[pointIndex].x = (hash + .5)/4294967296;
      points[pointIndex].y = ((Math.imul(hash ^ 0x9e3779b9,2246822519)>>>0)+.5)/4294967296;
      projected[pointIndex*3] = points[pointIndex].x*width;
      projected[pointIndex*3+1] = points[pointIndex].y*height;
    } else {
      pointIndex = hash % points.length;
      let attempts = 0;
      while (attempts < points.length && (active.has(pointIndex) || points[pointIndex].state !== 0)) {
        pointIndex = (pointIndex+1)%points.length;
        attempts++;
      }
      if (attempts === points.length) return;
    }
    const point = points[pointIndex];
    point.state = kind;
    active.set(pointIndex, {kind,born:now});
    world.dataset.lastEvent = kind === 1 ? 'birth' : 'death';
  }

  function finishEvents(now) {
    for (const [index,event] of active) {
      if (now-event.born < (event.kind === 1 ? 3200 : 4800)) continue;
      if (event.kind === 1) {
        points[index].state = 0;
        completedBirths++;
      } else {
        points[index].state = 2;
        vacant.add(index);
        completedDeaths++;
      }
      active.delete(index);
    }
    world.dataset.completedBirths = String(completedBirths);
    world.dataset.completedDeaths = String(completedDeaths);
    world.dataset.activeEvents = String(active.size);
  }

  function updateCounts(now) {
    const counts = integratedCounts(started, now, years);
    const time = performance.now();
    if (counts.births !== previous.births) {
      // Only the recent 2 minutes animate after returning from a hidden tab.
      const from = Math.max(previous.births + 1, counts.births - 500);
      for (let i = from; i <= counts.births; i++) emit(1,i,time);
      birthTotal.textContent = formatter.format(counts.births);
      birthTotal.parentElement.style.setProperty('--count-scale', Math.min(1,3.2/birthTotal.textContent.length));
    }
    if (counts.deaths !== previous.deaths) {
      const from = Math.max(previous.deaths + 1, counts.deaths - 250);
      for (let i = from; i <= counts.deaths; i++) emit(-1,i,time);
      deathTotal.textContent = formatter.format(counts.deaths);
      deathTotal.parentElement.style.setProperty('--count-scale', Math.min(1,3.2/deathTotal.textContent.length));
    }
    previous = counts;
    const rates = ratesAt(now, years);
    if (rates.year !== lastYear) {
      birthRate.textContent = rates.births.toFixed(2);
      deathRate.textContent = rates.deaths.toFixed(2);
      world.dataset.sourceYear = String(rates.sourceYear);
      world.dataset.dataKind = 'annual-projection';
      lastYear = rates.year;
    }
    world.dataset.births = String(counts.births);
    world.dataset.deaths = String(counts.deaths);
    const centiseconds = Math.floor(Math.max(0,now-started)/10);
    const minutes = Math.floor(centiseconds/6000);
    const seconds = Math.floor(centiseconds/100)%60;
    const fraction = centiseconds%100;
    elapsed.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(fraction).padStart(2,'0')}`;
    world.dataset.elapsed = (centiseconds/100).toFixed(2);
    track.style.width = `${(now % 1000) / 10}%`;
  }

  function project() {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const px = point.x*width;
      const py = point.y*height;
      const j=i*3;
      projected[j]=px; projected[j+1]=py; projected[j+2]=point.size;
    }
  }

  // Four long, tapered arms with a narrow concave waist, like a star flare.
  function crossPath(ctx,x,y,lx,ly,waist) {
    ctx.beginPath();
    ctx.moveTo(x,y-ly);
    ctx.bezierCurveTo(x,y-waist,x+waist,y,x+lx,y);
    ctx.bezierCurveTo(x+waist,y,x,y+waist,x,y+ly);
    ctx.bezierCurveTo(x,y+waist,x-waist,y,x-lx,y);
    ctx.bezierCurveTo(x-waist,y,x,y-waist,x,y-ly);
    ctx.closePath();
  }

  function makeFlare(kind) {
    // Cache layered gradients once; animation only scales and fades the sprite.
    const sprite=document.createElement('canvas');
    sprite.width=sprite.height=512;
    const c=sprite.getContext('2d');
    c.translate(256,256);
    const palette=kind===1 ? {
      tip:'255,148,94',rim:'255,102,160',inner:'255,211,222',core:'255,255,248'
    } : {
      tip:'72,46,86',rim:'98,63,108',inner:'16,10,21',core:'0,0,0'
    };
    function axis(lx,ly,horizontal,waist,opacity,blur) {
      const length=horizontal?lx:ly;
      const g=horizontal?c.createLinearGradient(-length,0,length,0):c.createLinearGradient(0,-length,0,length);
      const stops=[
        [0,palette.tip,0],[.13,palette.tip,.07],[.30,palette.rim,.38],
        [.43,palette.inner,.82],[.485,palette.core,1],
        [.515,palette.core,1],[.56,palette.inner,.86],
        [.71,palette.rim,.31],[.88,palette.tip,.04],[1,palette.tip,0]
      ];
      for(const [offset,color,alpha] of stops) g.addColorStop(offset,`rgba(${color},${alpha*opacity})`);
      c.shadowColor=`rgba(${palette.rim},${kind===1?.7:.5})`;
      c.shadowBlur=blur;
      c.fillStyle=g;
      crossPath(c,0,0,lx,ly,waist);c.fill();
    }
    // Broad glow follows the two axes, leaving the diagonal space empty.
    axis(174,22,true,8,kind===1?.30:.38,25);
    axis(23,198,false,8,kind===1?.27:.34,22);
    // Offset patches brighten selected sections, rather than a uniform halo.
    c.save();c.translate(kind===1?38:-30,-2);
    axis(118,30,true,8,kind===1?.68:.40,22);c.restore();
    c.save();c.translate(0,-47);
    axis(20,108,false,6,kind===1?.55:.30,20);c.restore();
    // A gradient stays clipped to the pointed cross; it never makes a disk.
    const body=c.createRadialGradient(0,0,2,0,0,188);
    body.addColorStop(0,`rgba(${palette.core},1)`);
    body.addColorStop(.18,`rgba(${palette.core},.98)`);
    body.addColorStop(.43,`rgba(${palette.inner},.94)`);
    body.addColorStop(.69,`rgba(${palette.rim},${kind===1?.72:.83})`);
    body.addColorStop(.88,`rgba(${palette.tip},.35)`);
    body.addColorStop(1,`rgba(${palette.tip},0)`);
    c.shadowColor=`rgba(${palette.rim},.48)`;
    c.shadowBlur=kind===1?9:6;
    c.fillStyle=body;
    crossPath(c,0,0,152,188,9);c.fill();
    // Inner beams stay hot at the intersection and fade into colored tips.
    axis(176,10,true,3.2,.96,0);
    axis(10,198,false,3.2,.98,0);
    axis(199,2.2,true,.6,.72,0);
    axis(2.2,219,false,.6,.75,0);
    c.shadowColor=`rgba(${palette.core},.85)`;
    c.shadowBlur=kind===1?11:4;
    c.fillStyle=`rgba(${palette.core},.98)`;
    crossPath(c,0,0,13,17,2.4);c.fill();
    return sprite;
  }

  function blurFlare(source,amount) {
    const sprite=document.createElement('canvas');
    sprite.width=sprite.height=512;
    const c=sprite.getContext('2d');
    c.filter=`blur(${amount}px)`;
    c.drawImage(source,0,0);
    return sprite;
  }

  p.draw = () => {
    const now = performance.now();
    finishEvents(now);
    updateCounts(Date.now());
    // A slower still field respects reduced-motion without freezing statistics.
    if (paused && renderedFrame++ % 4 !== 0) return;
    const ctx = p.drawingContext;
    ctx.clearRect(0,0,width,height);
    // Batched p5 canvas drawing keeps a dense field smooth on mobile.
    for (let shade=0;shade<shades.length;shade++) {
      ctx.fillStyle=shades[shade]; ctx.beginPath();
      for (let i=0;i<points.length;i++) {
        const point=points[i];
        if (point.shade !== shade || (point.state !== 0 && point.state !== 1)) continue;
        const j=i*3,x=projected[j],y=projected[j+1],r=projected[j+2];
        ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,TAU);
      }
      ctx.fill();
    }
    for (const [index,event] of active) {
      const age=(now-event.born)/1000;
      const j=index*3,x=projected[j],y=projected[j+1];
      const k=event.kind,decay=Math.exp(-age*.72),entry=Math.min(1,age*5+.1);
      const life=Math.min(1,age/5.8);
      const fade=k===1 ? 1-smooth((age-.2)/3) : 1-smooth((age-1.4)/3.4);
      if (k===1) {
        const core=(1.7+projected[j+2])*(1+life*3.2);
        ctx.save();
        ctx.shadowColor='rgba(255,235,245,.55)';
        ctx.shadowBlur=1+life*3;
        ctx.fillStyle=`rgba(255,254,246,${.85*fade*entry})`;
        crossPath(ctx,x,y,core*.8,core,core*.18);ctx.fill();
        ctx.restore();
      }
      if (paused) continue;
      // Births expand all the way through their fade; deaths contract inward.
      const span=k===1 ? 12+112*Math.pow(life,.78) : (9+55*decay)*fade;
      ctx.save();
      ctx.globalCompositeOperation=k===1?'screen':'source-over';
      const opacity=entry*fade*(k===1?.88:.6+.4*decay);
      const size=512*span/198;
      const bloomSize=size*(k===1?1.16:1.06);
      ctx.globalAlpha=opacity*(k===1?.34:.14);
      ctx.drawImage(blooms[k],x-bloomSize/2,y-bloomSize/2,bloomSize,bloomSize);
      ctx.globalAlpha=opacity;
      ctx.drawImage(softFlares[k],x-size/2,y-size/2,size,size);
      ctx.restore();
    }
    // Black cores fade to empty space, never back to a neutral dot.
    for (const [i,event] of active) {
      if (event.kind!==-1) continue;
      const j=i*3,age=(now-event.born)/1000;
      const fade=1-smooth((age-1.4)/3.4);
      const onset=1.5*Math.exp(-age/1.4);
      const r=(Math.max(3.7,3.2*projected[j+2])+onset)*(.3+.7*fade);
      ctx.fillStyle=`rgba(0,0,0,${fade*Math.min(1,age*5+.1)})`;ctx.beginPath();
      crossPath(ctx,projected[j],projected[j+1],r*.8,r,r*.18);
      ctx.fill();
    }
  };
  p.windowResized = () => {
    p.resizeCanvas(world.clientWidth,world.clientHeight);
    dimensions();
    project();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) p.noLoop();
    else p.loop();
  });
};

// The module may finish fetching before the deferred library has executed.
if (typeof window.p5 === 'undefined') await new Promise(resolve => window.addEventListener('load',resolve,{once:true}));
new p5(sketch);
