const STORAGE_KEY = "purchaseOpportunityCost.v1";
const DEFAULTS = { purchaseName:"Phone", price:1000, annualReturn:7, years:10, autoSave:true };
const LIMITS = { price:[0,100000], annualReturn:[-20,30], years:[0,50] };
const state = loadState();
const usd = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });
const compactUsd = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", notation:"compact", maximumFractionDigits:1 });
const canvas = document.querySelector("#projectionChart"), ctx = canvas.getContext("2d");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return { ...DEFAULTS };
    return {
      purchaseName:typeof saved.purchaseName === "string" ? saved.purchaseName.slice(0,48) : DEFAULTS.purchaseName,
      price:clamp(saved.price, ...LIMITS.price, DEFAULTS.price),
      annualReturn:clamp(saved.annualReturn, ...LIMITS.annualReturn, DEFAULTS.annualReturn),
      years:Math.round(clamp(saved.years, ...LIMITS.years, DEFAULTS.years)),
      autoSave:typeof saved.autoSave === "boolean" ? saved.autoSave : DEFAULTS.autoSave
    };
  } catch { return { ...DEFAULTS }; }
}
function clamp(value, min, max, fallback=min) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function money(value) { return usd.format(Number.isFinite(value) ? value : 0); }
function signedMoney(value) { return `${value < 0 ? "−" : "+"}${money(Math.abs(value))}`; }
function projectValue(year) { return state.price * Math.pow(1 + state.annualReturn / 100, year); }
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStatus("Saved on this device."); } catch { setStatus("Could not save in this browser."); } }
function setStatus(message) { document.querySelector("#saveStatus").textContent = message; }
function updateControls() {
  document.querySelector("#purchaseName").value = state.purchaseName;
  document.querySelector("#price").value = state.price;
  document.querySelector("#priceRange").value = state.price;
  document.querySelector("#annualReturn").value = state.annualReturn;
  document.querySelector("#returnRange").value = state.annualReturn;
  document.querySelector("#years").value = state.years;
  document.querySelector("#yearsRange").value = state.years;
  document.querySelector("#autoSave").checked = state.autoSave;
}
function render() {
  const future = projectValue(state.years), difference = future - state.price, label = state.purchaseName.trim() || "Purchase";
  document.querySelector("#futureValue").textContent = money(future);
  document.querySelector("#futureValueNote").textContent = state.years === 1 ? "After 1 year" : `After ${state.years} years`;
  document.querySelector("#differenceLabel").textContent = difference < -0.5 ? "Potential investment loss" : "Potential market growth";
  document.querySelector("#differenceValue").textContent = signedMoney(difference);
  document.querySelector("#priceMetric").textContent = money(state.price);
  document.querySelector("#purchaseMetricNote").textContent = `${label} today`;
  document.querySelector("#chartTitle").textContent = `If you invested ${money(state.price)}`;
  document.querySelector("#investmentLegend").textContent = `${label} price invested`;
  document.querySelector("#chartCaption").textContent = `${label} price invested today, growing at an assumed ${state.annualReturn}% each year for ${state.years} ${state.years === 1 ? "year" : "years"}. The teal line marks the original ${money(state.price)}.`;
  document.querySelector("#assumptionCopy").textContent = `This illustration applies the same ${state.annualReturn}% assumed annual return every year. Actual market returns vary and are not guaranteed.`;
  const insight = difference > 0.5
    ? `At this assumed return, investing ${money(state.price)} instead of buying the ${label.toLowerCase()} could leave ${money(future)} after ${state.years} years, including ${money(difference)} in growth.`
    : difference < -0.5
      ? `At this assumed return, ${money(state.price)} invested for ${state.years} years would end at ${money(future)}, below its starting value by ${money(-difference)}.`
      : state.price === 0
        ? "Enter a purchase price above $0 to explore its investment projection."
        : `At this assumed return, the investment ends around its starting value of ${money(state.price)} after ${state.years} years.`;
  document.querySelector("#insightText").textContent = insight;
  drawChart();
  if (state.autoSave) saveQuietly();
}
function saveQuietly() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { setStatus("Could not save in this browser."); } }
function drawChart() {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!rect.width || !rect.height) return;
  const width = Math.floor(rect.width), height = Math.floor(rect.height);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height); ctx.fillStyle = "#0c1110"; ctx.fillRect(0,0,width,height);
  const pad = { top:22, right:22, bottom:43, left:78 }, plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  if (plotW <= 0 || plotH <= 0) return;
  const last = projectValue(state.years), maxValue = Math.max(state.price,last,1), yMax = maxValue * 1.16;
  const x = year => pad.left + (state.years ? plotW * year / state.years : plotW / 2);
  const y = value => pad.top + plotH * (1 - value / yMax);
  ctx.font = "700 11px Inter, system-ui"; ctx.textBaseline = "middle"; ctx.textAlign = "right"; ctx.lineWidth = 1;
  for (let i=0;i<=4;i++) {
    const value = yMax * (1 - i / 4), yy = pad.top + plotH * i / 4;
    ctx.strokeStyle = "rgba(231,215,168,.14)"; ctx.beginPath(); ctx.moveTo(pad.left,yy); ctx.lineTo(width-pad.right,yy); ctx.stroke();
    ctx.fillStyle = "#b8b2a2"; ctx.fillText(axisMoney(value),pad.left-10,yy);
  }
  const costY = y(state.price);
  ctx.strokeStyle = "rgba(45,212,191,.9)"; ctx.setLineDash([7,6]); ctx.beginPath(); ctx.moveTo(pad.left,costY); ctx.lineTo(width-pad.right,costY); ctx.stroke(); ctx.setLineDash([]);
  const points = Array.from({length:state.years+1},(_,year)=>({x:x(year),y:y(projectValue(year))}));
  const gradient = ctx.createLinearGradient(0,pad.top,0,height-pad.bottom); gradient.addColorStop(0,"rgba(216,180,95,.3)"); gradient.addColorStop(1,"rgba(216,180,95,.015)");
  ctx.beginPath(); points.forEach((point,index)=>index ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y)); ctx.lineTo(points.at(-1).x,height-pad.bottom); ctx.lineTo(points[0].x,height-pad.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); points.forEach((point,index)=>index ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y)); ctx.strokeStyle = "#d8b45f"; ctx.lineWidth = 2.7; ctx.stroke();
  ctx.fillStyle = "#b8b2a2"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const tickCount = Math.min(5,state.years), ticks = state.years === 0 ? [0] : Array.from({length:tickCount+1},(_,i)=>Math.round(state.years*i/tickCount));
  [...new Set(ticks)].forEach(year=>ctx.fillText(`${year}y`,x(year),height-pad.bottom+13));
  canvas.setAttribute("aria-label",`Investment projection chart for ${state.purchaseName || "purchase"}: ${money(state.price)} grows to ${money(last)} over ${state.years} years at an assumed ${state.annualReturn}% annual return; dashed teal line shows original cost.`);
}
function axisMoney(value) { return Math.abs(value) >= 1000000 ? compactUsd.format(value) : money(value); }
function updateField(key,value) {
  if (key === "purchaseName") state.purchaseName = value.slice(0,48);
  else if (LIMITS[key]) {
    const input = document.querySelector(`#${key}`), fallback = state[key], bounded = clamp(value,...LIMITS[key],fallback);
    state[key] = key === "years" ? Math.round(bounded) : Number(bounded.toFixed(2));
    if (input.value === "" && value === "") input.value = state[key];
  }
  if (key === "price") document.querySelector("#priceRange").value = state.price;
  if (key === "annualReturn") document.querySelector("#returnRange").value = state.annualReturn;
  if (key === "years") document.querySelector("#yearsRange").value = state.years;
  render();
}

document.addEventListener("input",event=>{
  const id = event.target.id;
  if (id === "purchaseName") updateField("purchaseName",event.target.value);
  else if (id === "price" || id === "priceRange") updateField("price",event.target.value);
  else if (id === "annualReturn" || id === "returnRange") updateField("annualReturn",event.target.value);
  else if (id === "years" || id === "yearsRange") updateField("years",event.target.value);
});
document.querySelector("#autoSave").addEventListener("change",event=>{state.autoSave=event.target.checked;if(state.autoSave)saveState();else setStatus("Automatic saving is off.");});
document.querySelector("#saveButton").addEventListener("click",saveState);
document.querySelector("#resetButton").addEventListener("click",()=>{try{localStorage.removeItem(STORAGE_KEY);}catch{}Object.assign(state,DEFAULTS);updateControls();setStatus("Assumptions reset.");render();});
window.addEventListener("resize",drawChart);
updateControls(); render();
