// script.js - адаптирован под уникальные классы humidity-*
// ========== КОНСТАНТЫ ==========
const Rv = 461.5;
const MAGNUS_A = 6.112;
const MAGNUS_B = 17.62;
const MAGNUS_C = 243.12;
const mmHg2hPa = 1.33322;
const MIX_FACTOR = 622;

// Преобразование: кг/м³ → г/м³ (умножаем на 1000)
const KG_TO_G = 1000;

let prec = 1;  // точность по умолчанию - 1 знак после запятой
let vals = { rh: "60", abs: "13.8", mix: "10", dew: "10", temp: "25", press: "760" };

// ========== СОХРАНЕНИЕ ДАННЫХ (24 часа) ==========
const STORAGE_KEY = 'humidity_calculator_data';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 часа

function saveToLocalStorage() {
  const dataToSave = {
    vals: vals,
    from: document.getElementById('from')?.value || '',
    to: document.getElementById('to')?.value || '',
    prec: prec,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  try {
    const data = JSON.parse(saved);
    const age = Date.now() - data.timestamp;
    if (age > STORAGE_EXPIRY) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    if (data.vals) vals = data.vals;
    if (data.prec !== undefined) {
      prec = data.prec;
      document.getElementById('prec').innerText = prec;
    }
    if (data.from) document.getElementById('from').value = data.from;
    if (data.to) document.getElementById('to').value = data.to;
    return true;
  } catch(e) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}

function autoSave() { saveToLocalStorage(); }

// ========== ФОРМУЛЫ (абсолютная влажность в г/м³) ==========
function es(T) { return MAGNUS_A * Math.exp((MAGNUS_B * T) / (MAGNUS_C + T)); }

// Абсолютная влажность из относительной (возвращает г/м³)
function absFromRH(RH, T) { 
  let e_hPa = (RH / 100) * es(T); 
  let kg_m3 = (e_hPa * 100) / (Rv * (T + 273.15));
  return kg_m3 * KG_TO_G; // перевод в г/м³
}

// Относительная влажность из абсолютной (abs в г/м³)
function RHFromAbs(A, T) { 
  let kg_m3 = A / KG_TO_G; // перевод в кг/м³
  let e_Pa = kg_m3 * Rv * (T + 273.15); 
  return ((e_Pa / 100) / es(T)) * 100; 
}

function mixFromRH(RH, T, P) { let e = (RH / 100) * es(T), P_hPa = P * mmHg2hPa; return P_hPa <= e ? Infinity : MIX_FACTOR * e / (P_hPa - e); }
function RHFromMix(mix, T, P) { let P_hPa = P * mmHg2hPa, e = (mix * P_hPa) / (MIX_FACTOR + mix); return (e / es(T)) * 100; }
function dewFromRH(RH, T) { if (RH <= 0) return -Infinity; let e = (RH / 100) * es(T), ln = Math.log(e / MAGNUS_A); return (MAGNUS_C * ln) / (MAGNUS_B - ln); }
function RHFromDew(dew, T) { return (es(dew) / es(T)) * 100; }

// Абсолютная из точки росы (г/м³)
function absFromDew(dew, T) { 
  let RH = RHFromDew(dew, T);
  return absFromRH(RH, T);
}

function mixFromDew(dew, T, P) { return mixFromRH(RHFromDew(dew, T), T, P); }

// Точка росы из абсолютной (abs в г/м³)
function dewFromAbs(A, T) { 
  let kg_m3 = A / KG_TO_G;
  let e = kg_m3 * Rv * (T + 273.15) / 100; 
  let ln = Math.log(e / MAGNUS_A); 
  return (MAGNUS_C * ln) / (MAGNUS_B - ln); 
}

function dewFromMix(mix, T, P) { return dewFromRH(RHFromMix(mix, T, P), T); }
function maxAbs(T) { return absFromRH(100, T); }
function maxMix(T, P) { return mixFromRH(100, T, P); }

// ========== ЕДИНИЦЫ ИЗМЕРЕНИЯ ==========
function getUnit(to) {
  const units = { 'RH': '%', 'abs': 'г/м³', 'mix': 'г/кг', 'dew': '°C' };
  return units[to] || '';
}

function updateResultLabel(to) {
  const labels = { 'RH': 'Относительная влажность', 'abs': 'Абсолютная влажность', 'mix': 'Влагосодержание', 'dew': 'Точка росы' };
  const resLabel = document.getElementById('resLabel');
  const resUnit = document.getElementById('resUnit');
  if (resLabel) resLabel.innerHTML = labels[to] || 'Результат';
  if (resUnit) resUnit.innerHTML = getUnit(to);
}

// ========== ИЗМЕНЕНИЕ ТОЧНОСТИ ==========
function changePrec(s) {
  prec += s;
  if (prec < 0) prec = 0;
  if (prec > 10) prec = 10;
  const precSpan = document.getElementById('prec');
  if (precSpan) precSpan.innerText = prec;
  autoSave();
}

// ========== UI ==========
function clearErr() {
  document.querySelectorAll('.humidity-input-group input').forEach(i => i.classList.remove('humidity-error'));
  document.querySelectorAll('.humidity-err-msg').forEach(e => e.remove());
}

function showErr(id, msg) {
  let i = document.getElementById(id);
  if (i) {
    i.classList.add('humidity-error');
    let p = i.closest('.humidity-input-group');
    let old = p.querySelector('.humidity-err-msg');
    if (old) old.remove();
    let d = document.createElement('div');
    d.className = 'humidity-err-msg';
    d.innerHTML = `<img src="icons/x-circle.svg" width="12" height="12" alt="" class="humidity-icon"> <span>${msg}</span>`;
    p.appendChild(d);
  }
}

function valNum(id, min, max, name) {
  let i = document.getElementById(id);
  if (!i) return null;
  let v = parseFloat(i.value);
  if (isNaN(v)) { showErr(id, `${name} - число`); return null; }
  if (v < min || v > max) { showErr(id, `${name} от ${min} до ${max}`); return null; }
  return v;
}

function valT() { return valNum('temp', -100, 100, 'Температура'); }
function valP() { return valNum('press', 100, 1100, 'Давление'); }
function valRH() { return valNum('rh', 0, 100, 'Влажность'); }
function valAbs() { return valNum('abs', 0, 200, 'Абс.влажность'); }  // г/м³ до 200
function valMix() { return valNum('mix', 0, 1000, 'Влагосодержание'); }
function valDew() { return valNum('dew', -100, 100, 'Точка росы'); }

function validateDir() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  let btn = document.getElementById('calcBtn'), warn = document.getElementById('dirWarn');
  
  updateDirectionHint();

  if (!from || !to) {
    btn.disabled = true;
    btn.innerHTML = `<img src="icons/arrow-right.svg" width="16" height="16" alt="" class="humidity-icon"> <span>Выберите направление</span>`;
    warn.style.display = 'flex';
    warn.innerHTML = `<img src="icons/alert-triangle.svg" width="12" height="12" alt="" class="humidity-icon"> <span>Выберите оба параметра</span>`;
    return false;
  }
  
  if (from === to) {
    btn.disabled = true;
    btn.innerHTML = `<img src="icons/slash.svg" width="16" height="16" alt="" class="humidity-icon"> <span>Нельзя в себя</span>`;
    warn.style.display = 'flex';
    warn.innerHTML = `<img src="icons/alert-triangle.svg" width="12" height="12" alt="" class="humidity-icon"> <span>Нельзя пересчитывать саму величину</span>`;
    return false;
  }
  
  btn.disabled = false;
  btn.innerHTML = `<img src="icons/flag.svg" width="16" height="16" alt="" class="humidity-icon"> <span>Рассчитать</span>`;
  warn.style.display = 'none';
  return true;
}

// Управление уведомлением "Выберите направление расчёта"
function updateDirectionHint() {
  let from = document.getElementById('from').value;
  let to = document.getElementById('to').value;
  let hint = document.getElementById('directionHint');
  
  if (from && to) {
    hint.style.display = 'none';
  } else {
    hint.style.display = 'flex';
  }
}

function realCheck() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  if (!from || !to) return;
  let t = parseFloat(document.getElementById('temp')?.value), p = parseFloat(document.getElementById('press')?.value);
  if (isNaN(t) || isNaN(p)) return;
  if (from === 'dew') {
    let d = parseFloat(document.getElementById('dew')?.value);
    if (!isNaN(d) && d > t) showErr('dew', `Точка росы выше температуры → Относительная влажность>100%`);
  }
  if (from === 'abs') {
    let a = parseFloat(document.getElementById('abs')?.value);
    if (!isNaN(a)) { let mx = maxAbs(t); if (a > mx) showErr('abs', `Превышен максимум (${mx.toFixed(1)} г/м³)`); }
  }
  if (from === 'mix') {
    let m = parseFloat(document.getElementById('mix')?.value);
    if (!isNaN(m)) { let mx = maxMix(t, p); if (m > mx && isFinite(mx)) showErr('mix', `Выше ${mx.toFixed(1)} г/кг → Относительная влажность>100%`); }
  }
  if (t < -40) showErr('temp', `Ниже -40°C возможна погрешность`);
  if (from === 'RH' && to === 'dew') {
    let rh = parseFloat(document.getElementById('rh')?.value);
    if (rh === 0) showErr('rh', `При 0% точка росы не определена`);
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
  let html = `<br><div class="humidity-input-group"><label><img src="icons/thermometer.svg" width="16" height="16" alt="" class="humidity-icon"> Температура, °C</label><input type="number" id="temp" value="${vals.temp}" step="0.1"></div>
              <div class="humidity-input-group"><label><img src="icons/bar-chart-2.svg" width="16" height="16" alt="" class="humidity-icon"> Давление, мм рт.ст.</label><input type="number" id="press" value="${vals.press}" step="0.1"></div>`;
  if (from === 'RH') html += `<div class="humidity-input-group"><label><img src="icons/droplet.svg" width="16" height="16" alt="" class="humidity-icon"> Отн.влажность, %</label><input type="number" id="rh" value="${vals.rh}" step="0.1"></div>`;
  else if (from === 'abs') html += `<div class="humidity-input-group"><label><img src="icons/droplet.svg" width="16" height="16" alt="" class="humidity-icon"> Абс.влажность, г/м³</label><input type="number" id="abs" value="${vals.abs}" step="0.1"></div>`;
  else if (from === 'mix') html += `<div class="humidity-input-group"><label><img src="icons/cloud.svg" width="16" height="16" alt="" class="humidity-icon"> Влагосодержание, г/кг</label><input type="number" id="mix" value="${vals.mix}" step="0.01"></div>`;
  else if (from === 'dew') html += `<div class="humidity-input-group"><label><img src="icons/cloud-rain.svg" width="16" height="16" alt="" class="humidity-icon"> Точка росы, °C</label><input type="number" id="dew" value="${vals.dew}" step="0.1"></div>`;
  cont.innerHTML = html;
  document.querySelectorAll('#inputs input').forEach(i => { i.addEventListener('input', () => { clearErr(); realCheck(); autoSave(); }); });
  realCheck();
  updateResultLabel(to);
  validateDir();
  autoSave();
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
      else if (to === 'dew') { if (rh === 0) throw new Error('При Относительной влажности=0% точка росы не определена'); res = dewFromRH(rh, T); }
    }
    else if (from === 'abs') {
      let A = valAbs(); if (A === null) return;
      let mx = maxAbs(T); if (A > mx) throw new Error(`Превышен максимум (${mx.toFixed(1)} г/м³)`);
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
      if (dew > T) throw new Error(`Точка росы (${dew}°C) выше температуры → Относительная влажность>100%`);
      if (to === 'RH') res = RHFromDew(dew, T);
      else if (to === 'abs') res = absFromDew(dew, T);
      else if (to === 'mix') res = mixFromDew(dew, T, P);
    }
    if (res === undefined) throw new Error('Ошибка');
    if (to === 'RH' && (res < 0 || res > 100)) throw new Error(`Относительная влажность вне диапазона (${res.toFixed(1)}%)`);
    if (to === 'abs' && res < 0) throw new Error('Абс.влажность не может быть отрицательной');
    if (to === 'dew' && !isFinite(res)) throw new Error('Точка росы не определена');
    span.innerText = res.toFixed(prec);
    document.getElementById('resUnit').innerHTML = getUnit(to);
    autoSave();
  } catch (e) { alert(e.message); span.innerText = '—'; document.getElementById('resUnit').innerHTML = ''; }
}

window.onload = () => {
  const hasSavedData = loadFromLocalStorage();
  
  if (hasSavedData) {
    update();
    if (document.getElementById('from').value && document.getElementById('to').value) {
      document.getElementById('calcBtn').disabled = false;
      document.getElementById('calcBtn').innerHTML = `<img src="icons/flag.svg" width="16" height="16" alt="" class="humidity-icon"> <span>Рассчитать</span>`;
      document.getElementById('dirWarn').style.display = 'none';
    }
  } else {
    document.getElementById('from').value = '';
    document.getElementById('to').value = '';
    update();
    document.getElementById('calcBtn').disabled = true;
  }
  
  document.getElementById('from').onchange = update;
  document.getElementById('to').onchange = update;
  updateDirectionHint(); 
};
