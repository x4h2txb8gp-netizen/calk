// script.js
// ========== КОНСТАНТЫ ==========
const Rv = 461.5;
const MAGNUS_A = 6.112;
const MAGNUS_B = 17.62;
const MAGNUS_C = 243.12;
const mmHg2hPa = 1.33322;
const MIX_FACTOR = 622;

let prec = 5;
let vals = { rh: "60", abs: "0.0138", mix: "10", dew: "10", temp: "25", press: "760" };

// ========== ФОРМУЛЫ ==========
function es(T) { return MAGNUS_A * Math.exp((MAGNUS_B * T) / (MAGNUS_C + T)); }
function absFromRH(RH, T) { let e_hPa = (RH / 100) * es(T); return (e_hPa * 100) / (Rv * (T + 273.15)); }
function RHFromAbs(A, T) { let e_Pa = A * Rv * (T + 273.15); return ((e_Pa / 100) / es(T)) * 100; }
function mixFromRH(RH, T, P) { let e = (RH / 100) * es(T), P_hPa = P * mmHg2hPa; return P_hPa <= e ? Infinity : MIX_FACTOR * e / (P_hPa - e); }
function RHFromMix(mix, T, P) { let P_hPa = P * mmHg2hPa, e = (mix * P_hPa) / (MIX_FACTOR + mix); return (e / es(T)) * 100; }
function dewFromRH(RH, T) { if (RH <= 0) return -Infinity; let e = (RH / 100) * es(T), ln = Math.log(e / MAGNUS_A); return (MAGNUS_C * ln) / (MAGNUS_B - ln); }
function RHFromDew(dew, T) { return (es(dew) / es(T)) * 100; }
function absFromDew(dew, T) { return absFromRH(RHFromDew(dew, T), T); }
function mixFromDew(dew, T, P) { return mixFromRH(RHFromDew(dew, T), T, P); }
function dewFromAbs(A, T) { let e = A * Rv * (T + 273.15) / 100, ln = Math.log(e / MAGNUS_A); return (MAGNUS_C * ln) / (MAGNUS_B - ln); }
function dewFromMix(mix, T, P) { return dewFromRH(RHFromMix(mix, T, P), T); }
function maxAbs(T) { return absFromRH(100, T); }

// ========== ЕДИНИЦЫ ИЗМЕРЕНИЯ ==========
function getUnit(to) {
  const units = { 'RH': '%', 'abs': 'кг/м³', 'mix': 'г/кг', 'dew': '°C' };
  return units[to] || '';
}

function updateResultLabel(to) {
  const labels = { 'RH': 'Относительная влажность', 'abs': 'Абсолютная влажность', 'mix': 'Влагосодержание', 'dew': 'Точка росы' };
  document.getElementById('resLabel').innerHTML = labels[to] || 'Результат';
  document.getElementById('resUnit').innerHTML = getUnit(to);
}

// ========== ИЗМЕНЕНИЕ ТОЧНОСТИ ==========
function changePrec(s) {
  prec += s;
  if (prec < 0) prec = 0;
  if (prec > 10) prec = 10;
  document.getElementById('prec').innerText = prec;
}

// ========== UI ==========
function clearErr() {
  document.querySelectorAll('.input-group input').forEach(i => i.classList.remove('error'));
  document.querySelectorAll('.err-msg').forEach(e => e.remove());
}
function showErr(id, msg) {
  let i = document.getElementById(id);
  if (i) {
    i.classList.add('error');
    let p = i.closest('.input-group'), old = p.querySelector('.err-msg');
    if (old) old.remove();
    let d = document.createElement('div');
    d.className = 'err-msg';
    d.innerText = msg;
    p.appendChild(d);
  }
}
function valNum(id, min, max, name) {
  let i = document.getElementById(id);
  if (!i) return null;
  let v = parseFloat(i.value);
  if (isNaN(v)) { showErr(id, `❌ ${name} - число`); return null; }
  if (v < min || v > max) { showErr(id, `❌ ${name} от ${min} до ${max}`); return null; }
  return v;
}
function valT() { return valNum('temp', -100, 100, 'Температура'); }
function valP() { return valNum('press', 100, 1100, 'Давление'); }
function valRH() { return valNum('rh', 0, 100, 'Влажность'); }
function valAbs() { return valNum('abs', 0, 2, 'Абс.влажность'); }
function valMix() { return valNum('mix', 0, 1000, 'Влагосодержание'); }
function valDew() { return valNum('dew', -100, 100, 'Точка росы'); }

function validateDir() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  let btn = document.getElementById('calcBtn'), warn = document.getElementById('dirWarn');
  if (!from || !to) {
    btn.disabled = true; btn.innerText = '➡️ Выберите направление';
    warn.style.display = 'block'; warn.innerText = '⚠️ Выберите оба параметра';
    return false;
  }
  if (from === to) {
    btn.disabled = true; btn.innerText = '⛔ Нельзя в себя';
    warn.style.display = 'block'; warn.innerText = '❌ Нельзя пересчитывать саму величину';
    return false;
  }
  btn.disabled = false; btn.innerText = '🧮 Рассчитать';
  warn.style.display = 'none';
  return true;
}

function realCheck() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  if (!from || !to) return;
  let t = parseFloat(document.getElementById('temp')?.value), p = parseFloat(document.getElementById('press')?.value);
  if (isNaN(t) || isNaN(p)) return;
  if (from === 'dew') {
    let d = parseFloat(document.getElementById('dew')?.value);
    if (!isNaN(d) && d > t) showErr('dew', `⚠️ Точка росы выше температуры → RH>100%`);
  }
  if (from === 'abs') {
    let a = parseFloat(document.getElementById('abs')?.value);
    if (!isNaN(a)) { let mx = maxAbs(t); if (a > mx) showErr('abs', `❌ Превышен максимум (${mx.toFixed(4)} кг/м³)`); }
  }
  if (from === 'mix') {
    let m = parseFloat(document.getElementById('mix')?.value);
    if (!isNaN(m)) { let mx = mixFromRH(100, t, p); if (m > mx && isFinite(mx)) showErr('mix', `⚠️ Выше ${mx.toFixed(1)} г/кг → RH>100%`); }
  }
  if (t < -40) showErr('temp', `⚠️ Ниже -40°C возможна погрешность`);
  if (from === 'RH' && to === 'dew') {
    let rh = parseFloat(document.getElementById('rh')?.value);
    if (rh === 0) showErr('rh', `❌ При 0% точка росы не определена`);
  }
}

function update() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value, cont = document.getElementById('inputs');
  let inputs = cont.querySelectorAll('input');
  inputs.forEach(i => {
    if (i.id === 'temp') vals.temp = i.value;
    else if (i.id === 'press') vals.press = i.value;
    else if (i.id === 'rh') vals.rh = i.value;
    else if (i.id === 'abs') vals.abs = i.value;
    else if (i.id === 'mix') vals.mix = i.value;
    else if (i.id === 'dew') vals.dew = i.value;
  });
  if (!from) { cont.innerHTML = ''; updateResultLabel(to); validateDir(); return; }
  let html = `<div class="input-group"><label>🌡️ Температура, °C</label><input type="number" id="temp" value="${vals.temp}" step="0.1"></div>
              <div class="input-group"><label>📊 Давление, мм рт.ст.</label><input type="number" id="press" value="${vals.press}" step="0.1"></div>`;
  if (from === 'RH') html += `<div class="input-group"><label>💧 Отн.влажность, %</label><input type="number" id="rh" value="${vals.rh}" step="0.1"></div>`;
  else if (from === 'abs') html += `<div class="input-group"><label>💨 Абс.влажность, кг/м³</label><input type="number" id="abs" value="${vals.abs}" step="0.0001"></div>`;
  else if (from === 'mix') html += `<div class="input-group"><label>💨 Влагосодержание, г/кг</label><input type="number" id="mix" value="${vals.mix}" step="0.01"></div>`;
  else if (from === 'dew') html += `<div class="input-group"><label>❄️ Точка росы, °C</label><input type="number" id="dew" value="${vals.dew}" step="0.1"></div>`;
  cont.innerHTML = html;
  document.querySelectorAll('#inputs input').forEach(i => { i.addEventListener('input', () => { clearErr(); realCheck(); }); });
  realCheck();
  updateResultLabel(to);
  validateDir();
}

function calc() {
  clearErr();
  if (!validateDir()) return;
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  let span = document.getElementById('resVal');
  try {
    let T = valT(); if (T === null) return;
    let P = valP(); if (P === null) return;
    let res;
    if (from === 'RH') {
      let rh = valRH(); if (rh === null) return;
      if (to === 'abs') res = absFromRH(rh, T);
      else if (to === 'mix') { res = mixFromRH(rh, T, P); if (res === Infinity) throw new Error('Давление слишком низкое'); }
      else if (to === 'dew') { if (rh === 0) throw new Error('При RH=0% точка росы не определена'); res = dewFromRH(rh, T); }
    }
    else if (from === 'abs') {
      let A = valAbs(); if (A === null) return;
      let mx = maxAbs(T); if (A > mx) throw new Error(`Превышен максимум (${mx.toFixed(4)} кг/м³)`);
      if (to === 'RH') res = RHFromAbs(A, T);
      else if (to === 'mix') res = mixFromRH(RHFromAbs(A, T), T, P);
      else if (to === 'dew') res = dewFromAbs(A, T);
    }
    else if (from === 'mix') {
      let mix = valMix(); if (mix === null) return;
      let mx = mixFromRH(100, T, P); if (mix > mx && isFinite(mx)) throw new Error(`Превышен максимум (${mx.toFixed(1)} г/кг)`);
      if (to === 'RH') res = RHFromMix(mix, T, P);
      else if (to === 'abs') res = absFromRH(RHFromMix(mix, T, P), T);
      else if (to === 'dew') res = dewFromMix(mix, T, P);
    }
    else if (from === 'dew') {
      let dew = valDew(); if (dew === null) return;
      if (dew > T) throw new Error(`Точка росы (${dew}°C) выше температуры → RH>100%`);
      if (to === 'RH') res = RHFromDew(dew, T);
      else if (to === 'abs') res = absFromDew(dew, T);
      else if (to === 'mix') res = mixFromDew(dew, T, P);
    }
    if (res === undefined) throw new Error('Ошибка');
    if (to === 'RH' && (res < 0 || res > 100)) throw new Error(`RH вне диапазона (${res.toFixed(1)}%)`);
    if (to === 'abs' && res < 0) throw new Error('Абс.влажность не может быть отрицательной');
    if (to === 'dew' && !isFinite(res)) throw new Error('Точка росы не определена');
    span.innerText = res.toFixed(prec);
    document.getElementById('resUnit').innerHTML = getUnit(to);
  } catch (e) { alert('❌ ' + e.message); span.innerText = '—'; document.getElementById('resUnit').innerHTML = ''; }
}

window.onload = () => {
  document.getElementById('from').value = '';
  document.getElementById('to').value = '';
  document.getElementById('from').onchange = update;
  document.getElementById('to').onchange = update;
  update();
  document.getElementById('calcBtn').disabled = true;
};
