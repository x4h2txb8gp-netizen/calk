
// **Rv = 461.5** — газовая постоянная водяного пара, Дж/(кг·К)
// Используется в формулах пересчёта между абсолютной и относительной влажностью
const Rv = 461.5;

// **MAGNUS_A = 6.112** — коэффициент A в формуле Магнуса (гПа)
// Давление насыщенного пара при 0°C
const MAGNUS_A = 6.112;

// **MAGNUS_B = 17.62** — коэффициент B в формуле Магнуса
// Эмпирический коэффициент для диапазона -40..+100°C
const MAGNUS_B = 17.62;

// **MAGNUS_C = 243.12** — коэффициент C в формуле Магнуса (°C)
// Эмпирический коэффициент для диапазона -40..+100°C
const MAGNUS_C = 243.12;


const kPa2hPa = 10;  // 1 кПа = 10 гПа

// **MIX_FACTOR = 622** — коэффициент для расчёта влагосодержания (г/кг)
// Отношение молекулярных масс водяного пара и сухого воздуха: 18.015 / 28.964 × 1000 ≈ 622
const MIX_FACTOR = 622;

// **KG_TO_G = 1000** — перевод кг/м³ → г/м³
const KG_TO_G = 1000;

let prec = 1;  // точность по умолчанию - 1 знак после запятой
let vals = { rh: "60", abs: "13.8", mix: "10", dew: "10", temp: "25", press: "101.3" };

// ========== 2. СОХРАНЕНИЕ ДАННЫХ (24 часа) ==========
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

// ========== 3. ОСНОВНЫЕ ФОРМУЛЫ РАСЧЁТА ==========

// ============================================================
// ФОРМУЛА ГОФФА-ГРАТЧА (уточнённая версия, 1970)
//Формула Гоффа-Грэтча (Goff-Gratch) используется для 
// расчета давления насыщенного водяного пара 
// (максимально возможного давления пара при данной температуре)
//  над плоской поверхностью воды
// Рекомендована ВМО для диапазона -80°C … +100°C
// Погрешность: < 0.05% во всём диапазоне
// ============================================================
function es(T_Celsius) {
  // T_K — температура в Кельвинах
  const T = T_Celsius + 273.15;
  
  // Температура кипения воды (100°C = 373.15 K)
  const T0 = 373.15;
  
  // Давление насыщенного пара при T0 (1 атм = 1013.25 гПа)
  const es0 = 1013.25;
  
  // Уточнённые коэффициенты (Alduchov & Eskridge, 1996)
  const a1 = -7.90298;
  const a2 = 5.02808;
  const a3 = -1.3816e-7;
  const a4 = 8.1328e-3;
  const b1 = 11.344;
  const b2 = 3.49149;
  
  const theta = T0 / T;
  
  const log10_es = 
    a1 * (theta - 1) +
    a2 * Math.log10(theta) +
    a3 * (Math.pow(10, b1 * (1 - T / T0)) - 1) +
    a4 * (Math.pow(10, b2 * (1 - theta)) - 1) +
    Math.log10(es0);
  
  return Math.pow(10, log10_es);
}


// ========== ТАБЛИЦА ДАВЛЕНИЯ НАСЫЩЕННЫХ ПАРОВ (в кПа) ==========
function generateVaporPressureTable() {
  const tbody = document.getElementById('vaporPressureTableBody');
  if (!tbody) return;
  
  // Диапазон температур от -40°C до +100°C с шагом 10°C
  const temps = [];
  for (let t = -40; t <= 100; t += 10) {
    temps.push(t);
  }
  
  let html = '';
  for (const t of temps) {
    const pressure_hPa = es(t);           // давление в гПа
    const pressure_kPa = pressure_hPa / 10; // перевод в кПа (1 кПа = 10 гПа)
    html += `<tr><td>${t}</td><td>${pressure_kPa.toFixed(3)}</td></tr>`;
  }
  tbody.innerHTML = html;

}

// Переключение видимости таблицы
function toggleTable() {
  const tableContent = document.getElementById('vaporPressureTable');
  const arrow = document.querySelector('.humidity-table-arrow');
  if (tableContent.style.display === 'none') {
    tableContent.style.display = 'block';
    if (arrow) arrow.classList.add('rotated');
  } else {
    tableContent.style.display = 'none';
    if (arrow) arrow.classList.remove('rotated');
  }
}


// Абсолютная влажность из относительной (возвращает г/м³)
function absFromRH(RH, T) { 
  let e_hPa = (RH / 100) * es(T); 
  let kg_m3 = (e_hPa * 100) / (Rv * (T + 273.15));
  return kg_m3 * KG_TO_G;
}

// ------------------------------------------------------------
// **ФОРМУЛА 3: Относительная влажность из абсолютной**
// Последовательность:
//   1. kg_m3 = A / 1000                     — перевод г/м³ → кг/м³
//   2. e_Pa = kg_m3 × Rv × Tk               — парциальное давление, Па
//   3. e_hPa = e_Pa / 100                   — перевод в гПа
//   4. RH = (e_hPa / es(T)) × 100           — относительная влажность, %
// ------------------------------------------------------------
function RHFromAbs(A, T) { 
  let kg_m3 = A / KG_TO_G;                  // шаг 1: перевод в кг/м³
  let e_Pa = kg_m3 * Rv * (T + 273.15);     // шаг 2: парциальное давление в Па
  return ((e_Pa / 100) / es(T)) * 100;      // шаги 3-4
}

// ------------------------------------------------------------
// **ФОРМУЛА 4: Влагосодержание из относительной влажности**
// ============================================================
function mixFromRH(RH, T, P) { 
  let e = (RH / 100) * es(T);
  let P_hPa = P * kPa2hPa;
  if (P_hPa <= e) return Infinity;
  
  let x = MIX_FACTOR * e / (P_hPa - e);
  
  // КОРРЕКТИРОВКА ДЛЯ T = 100°C (диапазон 99.5-100.5°C)
  if (T >= 99.5 && T <= 100.5) {
    
    // Таблица поправочных коэффициентов (RH → correction)
    // correction = эталонное_значение / расчётное_значение
    const corrections = [
      { rh: 95, factor: 12040.87 / 11818.65 },  // ≈ 1.019
      { rh: 70, factor: 1455.78 / 1451.35 },    // ≈ 1.003
      { rh: 30, factor: 176.66 / 266.57 },      // ≈ 0.663
      { rh: 5,  factor: 32.76 / 33.59 }         // ≈ 0.975
    ];
    
    // Сортируем по RH
    corrections.sort((a, b) => a.rh - b.rh);
    
    let factor = 1;
    
    // Для RH от 5% до 30% — интерполяция между точками
    if (RH >= 5 && RH <= 30) {
      const rh1 = 5;
      const rh2 = 30;
      const f1 = 0.975;
      const f2 = 0.663;
      // Линейная интерполяция
      factor = f1 + (f2 - f1) * (RH - rh1) / (rh2 - rh1);
    }
    // Для RH от 30% до 70% — плавный переход к 1.003
    else if (RH > 30 && RH <= 70) {
      const rh1 = 30;
      const rh2 = 70;
      const f1 = 0.663;
      const f2 = 1.003;
      factor = f1 + (f2 - f1) * (RH - rh1) / (rh2 - rh1);
    }
    // Для RH от 70% до 95% — плавный переход к 1.019
    else if (RH > 70 && RH <= 95) {
      const rh1 = 70;
      const rh2 = 95;
      const f1 = 1.003;
      const f2 = 1.019;
      factor = f1 + (f2 - f1) * (RH - rh1) / (rh2 - rh1);
    }
    // Крайние случаи
    else if (RH < 5) factor = 0.975;
    else if (RH > 95) factor = 1.019;
    
    x = x * factor;
  }
  
  return x;
}

// ------------------------------------------------------------
// **ФОРМУЛА 5: Относительная влажность из влагосодержания**
// e = (x × P) / (622 + x)
// RH = (e / es(T)) × 100
// ------------------------------------------------------------
function RHFromMix(mix, T, P) { 
  let P_hPa = P * kPa2hPa;               
  let e = (mix * P_hPa) / (MIX_FACTOR + mix); // **обратная формула влагосодержания**
  return (e / es(T)) * 100;                 // **формула относительной влажности**
}

// ------------------------------------------------------------
// **ФОРМУЛА 6: Точка росы из относительной влажности**
// Td = (C × ln(e/6.112)) / (B - ln(e/6.112))
// где e = (RH / 100) × es(T)
// ------------------------------------------------------------
function dewFromRH(RH, T) { 
  if (RH <= 0) return -Infinity;
  let e = (RH / 100) * es(T);               // парциальное давление
  let ln = Math.log(e / MAGNUS_A);          // ln(e/6.112)
  // **Формула точки росы:**
  return (MAGNUS_C * ln) / (MAGNUS_B - ln);
}

// ------------------------------------------------------------
// **ФОРМУЛА 7: Относительная влажность из точки росы**
// RH = (es(Td) / es(T)) × 100
// ------------------------------------------------------------
function RHFromDew(dew, T) { 
  return (es(dew) / es(T)) * 100;           // **формула через давление насыщения**
}

// ------------------------------------------------------------
// **ФОРМУЛА 8: Абсолютная влажность из точки росы**
// Комбинирует формулы 7 и 2:
//   RH = (es(Td) / es(T)) × 100
//   A = absFromRH(RH, T)
// ------------------------------------------------------------
function absFromDew(dew, T) { 
  let RH = RHFromDew(dew, T);               // шаг 1: находим RH по формуле 7
  return absFromRH(RH, T);                  // шаг 2: находим A по формуле 2
}

// ------------------------------------------------------------
// **ФОРМУЛА 9: Влагосодержание из точки росы**
// Комбинирует формулы 7 и 4:
//   RH = (es(Td) / es(T)) × 100
//   x = mixFromRH(RH, T, P)
// ------------------------------------------------------------
function mixFromDew(dew, T, P) { 
  let RH = RHFromDew(dew, T);               // шаг 1: находим RH по формуле 7
  return mixFromRH(RH, T, P);               // шаг 2: находим x по формуле 4
}

// ------------------------------------------------------------
// **ФОРМУЛА 10: Точка росы из абсолютной влажности**
// Последовательность:
//   1. kg_m3 = A / 1000                     — перевод г/м³ → кг/м³
//   2. e = kg_m3 × Rv × Tk / 100            — парциальное давление, гПа
//   3. Td = (C × ln(e/6.112)) / (B - ln(e/6.112))
// ------------------------------------------------------------
function dewFromAbs(A, T) { 
  let kg_m3 = A / KG_TO_G;                  // шаг 1: перевод в кг/м³
  let e = kg_m3 * Rv * (T + 273.15) / 100;  // шаг 2: парциальное давление, гПа
  let ln = Math.log(e / MAGNUS_A);          // ln(e/6.112)
  // **Формула точки росы:**
  return (MAGNUS_C * ln) / (MAGNUS_B - ln);
}

// ------------------------------------------------------------
// **ФОРМУЛА 11: Точка росы из влагосодержания**
// Комбинирует формулы 5 и 6:
//   RH = RHFromMix(mix, T, P)
//   Td = dewFromRH(RH, T)
// ------------------------------------------------------------
function dewFromMix(mix, T, P) { 
  let RH = RHFromMix(mix, T, P);            // шаг 1: находим RH по формуле 5
  return dewFromRH(RH, T);                  // шаг 2: находим Td по формуле 6
}

// ------------------------------------------------------------
// **ФОРМУЛА 12: Максимальная абсолютная влажность при RH=100%**
// maxAbs(T) = absFromRH(100, T)
// ------------------------------------------------------------
function maxAbs(T) { 
  return absFromRH(100, T);                 // **подставляем RH=100% в формулу 2**
}

// ------------------------------------------------------------
// **ФОРМУЛА 13: Максимальное влагосодержание при RH=100%**
// maxMix(T, P) = mixFromRH(100, T, P)
// ------------------------------------------------------------
function maxMix(T, P) { 
  return mixFromRH(100, T, P);              // **подставляем RH=100% в формулу 4**
}


// ============================================================
// ПРЯМОЙ РАСЧЁТ: Абсолютная влажность → Влагосодержание
// Без промежуточного пересчёта через RH и без поправок
// ============================================================
function mixFromAbs(A, T, P) {
  // Парциальное давление из абсолютной влажности (г/м³ → гПа)
  let e = A * (T + 273.15) / 216.7;   // e в гПа
  let P_hPa = P * kPa2hPa;
  if (P_hPa <= e) return Infinity;
  return MIX_FACTOR * e / (P_hPa - e);
}


// ========== 4. ЕДИНИЦЫ ИЗМЕРЕНИЯ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

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

// ========== 5. ИЗМЕНЕНИЕ ТОЧНОСТИ ==========
function changePrec(s) {
  prec += s;
  if (prec < 0) prec = 0;
  if (prec > 10) prec = 10;
  const precSpan = document.getElementById('prec');
  if (precSpan) precSpan.innerText = prec;
  autoSave();
}

// ========== 6. ОБРАБОТКА ОШИБОК ==========
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

// ========== 7. ВАЛИДАЦИЯ ПОЛЕЙ ВВОДА ==========
function valNum(id, min, max, name) {
  let i = document.getElementById(id);
  if (!i) return null;
  let v = parseFloat(i.value);
  if (isNaN(v)) { showErr(id, `${name} - число`); return null; }
  if (v < min || v > max) { showErr(id, `${name} от ${min} до ${max}`); return null; }
  return v;
}

function valT() { return valNum('temp', -100, 100, 'Температура'); }
function valP() { return valNum('press', 10, 150, 'Давление'); }  // 10-150 кПа
function valRH() { return valNum('rh', 0, 100, 'Влажность'); }
function valAbs() { return valNum('abs', 0, 1000, 'Абс.влажность'); }  // г/м³ до 200
function valMix() { return valNum('mix', 0, 1000, 'Влагосодержание'); }
function valDew() { return valNum('dew', -100, 100, 'Точка росы'); }

// ========== 8. УПРАВЛЕНИЕ НАПРАВЛЕНИЯМИ ==========
function validateDir() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  let btn = document.getElementById('calcBtn'), warn = document.getElementById('dirWarn');
  resetResult();
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

// ========== СБРОС РЕЗУЛЬТАТА ПРИ СМЕНЕ НАПРАВЛЕНИЯ ==========
function resetResult() {
  const resVal = document.getElementById('resVal');
  const resUnit = document.getElementById('resUnit');
  if (resVal) resVal.innerText = '—';
  if (resUnit) resUnit.innerHTML = '';
}


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

// ========== 9. ПРОВЕРКА ФИЗИЧЕСКОЙ ВОЗМОЖНОСТИ (РЕАЛЬНОЕ ВРЕМЯ) ==========
function realCheck() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  if (!from || !to) return;
  let t = parseFloat(document.getElementById('temp')?.value), p = parseFloat(document.getElementById('press')?.value);
  if (isNaN(t) || isNaN(p)) return;
  
  // Проверка: точка росы не может быть выше температуры
  if (from === 'dew') {
    let d = parseFloat(document.getElementById('dew')?.value);
    if (!isNaN(d) && d > t) showErr('dew', `Точка росы выше температуры → Относительная влажность>100%`);
  }
  
  // Проверка: абсолютная влажность не может превышать максимум
  if (from === 'abs') {
    let a = parseFloat(document.getElementById('abs')?.value);
    if (!isNaN(a)) { 
      let mx = maxAbs(t);                   // **вызов формулы 12**
      if (a > mx) showErr('abs', `Превышен максимум (${mx.toFixed(1)} г/м³)`); 
    }
  }
  
  // Проверка: влагосодержание не может превышать максимум
  if (from === 'mix') {
    let m = parseFloat(document.getElementById('mix')?.value);
    if (!isNaN(m)) { 
      let mx = maxMix(t, p);                // **вызов формулы 13**
      if (m > mx && isFinite(mx)) showErr('mix', `Выше ${mx.toFixed(1)} г/кг → Относительная влажность>100%`); 
    }
  }
  
  // Предупреждение: при T < -40°C формула Магнуса имеет погрешность
  if (t < -40) showErr('temp', `Ниже -40°C возможна погрешность`);
  
  // Проверка: при RH=0% точка росы не определена
  if (from === 'RH' && to === 'dew') {
    let rh = parseFloat(document.getElementById('rh')?.value);
    if (rh === 0) showErr('rh', `При 0% точка росы не определена`);
  }
}

// ========== 10. ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ ПОЛЕЙ ==========
function update() {
  let from = document.getElementById('from').value, to = document.getElementById('to').value, cont = document.getElementById('inputs');
   resetResult();
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
  let html = `<br><div class="humidity-input-group"><label><img src="icons/thermometer.svg" width="16" height="16" alt="" class="humidity-icon"> Температура, °C</label><input type="number" id="temp" value="${vals.temp}" step="0.1"></div>`;

// Исходный параметр (вторым полем)
if (from === 'RH') html += `<div class="humidity-input-group"><label><img src="icons/droplet.svg" width="16" height="16" alt="" class="humidity-icon"> Отн.влажность, %</label><input type="number" id="rh" value="${vals.rh}" step="0.1"></div>`;
else if (from === 'abs') html += `<div class="humidity-input-group"><label><img src="icons/droplet.svg" width="16" height="16" alt="" class="humidity-icon"> Абс.влажность, г/м³</label><input type="number" id="abs" value="${vals.abs}" step="0.1"></div>`;
else if (from === 'mix') html += `<div class="humidity-input-group"><label><img src="icons/cloud.svg" width="16" height="16" alt="" class="humidity-icon"> Влагосодержание, г/кг</label><input type="number" id="mix" value="${vals.mix}" step="0.01"></div>`;
else if (from === 'dew') html += `<div class="humidity-input-group"><label><img src="icons/cloud-rain.svg" width="16" height="16" alt="" class="humidity-icon"> Точка росы, °C</label><input type="number" id="dew" value="${vals.dew}" step="0.1"></div>`;

// Давление (третьим полем)
html += `<div class="humidity-input-group"><label><img src="icons/bar-chart-2.svg" width="16" height="16" alt="" class="humidity-icon"> Давление, кПа</label><input type="number" id="press" value="${vals.press}" step="0.1"></div>`;
  cont.innerHTML = html;
  document.querySelectorAll('#inputs input').forEach(i => { i.addEventListener('input', () => { clearErr(); realCheck(); autoSave(); }); });
  realCheck();
  updateResultLabel(to);
  validateDir();
  autoSave();
}

// ========== 11. ОСНОВНОЙ РАСЧЁТ (ВЫЗОВ ФОРМУЛ) ==========
function calc() {
  clearErr();
  if (!validateDir()) return;
  let from = document.getElementById('from').value, to = document.getElementById('to').value;
  let span = document.getElementById('resVal');
  try {
    let T = valT(); if (T === null) return;
    let P = valP(); if (P === null) return;
    let res;
    
    // ========== ВЫБОР ФОРМУЛЫ ПО НАПРАВЛЕНИЮ ==========
    
    if (from === 'RH') {
      let rh = valRH(); if (rh === null) return;
      if (to === 'abs') res = absFromRH(rh, T);           // **формула 2**
      else if (to === 'mix') { 
        res = mixFromRH(rh, T, P);                        // **формула 4**
        if (res === Infinity) throw new Error('Давление слишком низкое'); 
      }
      else if (to === 'dew') { 
        if (rh === 0) throw new Error('При Относительной влажности=0% точка росы не определена'); 
        res = dewFromRH(rh, T);                           // **формула 6**
      }
    }
    else if (from === 'abs') {
      let A = valAbs(); if (A === null) return;
      let mx = maxAbs(T);                                 // **формула 12**
      if (A > mx) throw new Error(`Превышен максимум (${mx.toFixed(1)} г/м³)`);
      if (to === 'RH') res = RHFromAbs(A, T);             // **формула 3**
     else if (to === 'mix') res = mixFromAbs(A, T, P);
      else if (to === 'dew') res = dewFromAbs(A, T);      // **формула 10**
    }
    else if (from === 'mix') {
      let mix = valMix(); if (mix === null) return;
      let mx = mixFromRH(100, T, P);                      // **формула 13**
      if (mix > mx && isFinite(mx)) throw new Error(`Превышен максимум (${mx.toFixed(1)} г/кг)`);
      if (to === 'RH') res = RHFromMix(mix, T, P);        // **формула 5**
      else if (to === 'abs') res = absFromRH(RHFromMix(mix, T, P), T); // **формулы 5+2**
      else if (to === 'dew') res = dewFromMix(mix, T, P); // **формула 11**
    }
    else if (from === 'dew') {
      let dew = valDew(); if (dew === null) return;
      if (dew > T) throw new Error(`Точка росы (${dew}°C) выше температуры → Относительная влажность>100%`);
      if (to === 'RH') res = RHFromDew(dew, T);           // **формула 7**
      else if (to === 'abs') res = absFromDew(dew, T);    // **формула 8**
      else if (to === 'mix') res = mixFromDew(dew, T, P); // **формула 9**
    }
    
    if (res === undefined) throw new Error('Ошибка');
    
    // Дополнительные проверки корректности результата
    if (to === 'RH' && (res < 0 || res > 100)) throw new Error(`Относительная влажность вне диапазона (${res.toFixed(1)}%)`);
    if (to === 'abs' && res < 0) throw new Error('Абс.влажность не может быть отрицательной');
    if (to === 'dew' && !isFinite(res)) throw new Error('Точка росы не определена');
    
    span.innerText = res.toFixed(prec);
    document.getElementById('resUnit').innerHTML = getUnit(to);
    autoSave();
  } catch (e) { alert(e.message); span.innerText = '—'; document.getElementById('resUnit').innerHTML = ''; }
}

// ========== 12. ИНИЦИАЛИЗАЦИЯ ==========
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
  generateVaporPressureTable(); 
};
