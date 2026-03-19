// ==== script.js ====

// Точность
let precision = 5;

// Хранилище значений полей
let fieldValues = {
  rh: '60',
  abs: '0.0138',
  mix: '10',
  dew: '10',
  temp: '25',
  pressure: '760'
};

// Изменение точности
window.changePrecision = function(step) {
  precision += step;
  if (precision < 0) precision = 0;
  if (precision > 10) precision = 10;
  document.getElementById('precisionVal').innerText = precision;
};

// Проверка и блокировка при одинаковых значениях
function validateDirection() {
  const from = document.getElementById('fromSelect').value;
  const to = document.getElementById('toSelect').value;
  const btn = document.getElementById('calculateBtn');
  const warning = document.getElementById('directionWarning');
  
  if (from === to) {
    btn.disabled = true;
    warning.innerText = '❌ Нельзя пересчитывать величину саму в себя. Выберите разные параметры.';
    return false;
  } else {
    btn.disabled = false;
    warning.innerText = '';
    return true;
  }
}

// Обработчик изменения "Из чего"
window.handleFromChange = function() {
  const from = document.getElementById('fromSelect').value;
  const toSelect = document.getElementById('toSelect');
  
  // Перебираем опции "во что" и убираем disabled у всех, потом дисаблим совпадающую
  for (let option of toSelect.options) {
    option.disabled = false;
  }
  for (let option of toSelect.options) {
    if (option.value === from) {
      option.disabled = true;
      // Если текущее to совпадает с from, переключаем на первое доступное
      if (toSelect.value === from) {
        for (let opt of toSelect.options) {
          if (!opt.disabled) {
            toSelect.value = opt.value;
            break;
          }
        }
      }
      break;
    }
  }
  
  updateInputFields();
  validateDirection();
};

// Обработчик изменения "Во что"
window.handleToChange = function() {
  const to = document.getElementById('toSelect').value;
  const fromSelect = document.getElementById('fromSelect');
  
  // Перебираем опции "из чего" и убираем disabled, потом дисаблим совпадающую
  for (let option of fromSelect.options) {
    option.disabled = false;
  }
  for (let option of fromSelect.options) {
    if (option.value === to) {
      option.disabled = true;
      // Если текущее from совпадает с to, переключаем на первое доступное
      if (fromSelect.value === to) {
        for (let opt of fromSelect.options) {
          if (!opt.disabled) {
            fromSelect.value = opt.value;
            break;
          }
        }
      }
      break;
    }
  }
  
  updateInputFields();
  validateDirection();
};

// Обновление полей ввода
window.updateInputFields = function() {
  const from = document.getElementById('fromSelect').value;
  const container = document.getElementById('dynamicInputs');
  
  // Сохраняем текущие значения
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    if (input.id === 'tempInput') fieldValues.temp = input.value;
    else if (input.id === 'pressureInput') fieldValues.pressure = input.value;
    else if (input.id === 'rhInput') fieldValues.rh = input.value;
    else if (input.id === 'absInput') fieldValues.abs = input.value;
    else if (input.id === 'mixInput') fieldValues.mix = input.value;
    else if (input.id === 'dewInput') fieldValues.dew = input.value;
  });

  // Генерация полей
  let html = `
    <div class="input-group">
      <label>Температура, °C</label>
      <input type="number" id="tempInput" value="${fieldValues.temp}">
    </div>
    <div class="input-group">
      <label>Атмосферное давление, мм рт.ст.</label>
      <input type="number" id="pressureInput" value="${fieldValues.pressure}">
    </div>
  `;

  if (from === 'RH') {
    html += `
      <div class="input-group">
        <label>Относительная влажность, %</label>
        <input type="number" id="rhInput" step="0.1" value="${fieldValues.rh}">
      </div>
    `;
  } else if (from === 'abs') {
    html += `
      <div class="input-group">
        <label>Абсолютная влажность, кг/м³</label>
        <input type="number" id="absInput" step="0.0001" value="${fieldValues.abs}">
      </div>
    `;
  } else if (from === 'mix') {
    html += `
      <div class="input-group">
        <label>Влагосодержание, г/кг сух. возд.</label>
        <input type="number" id="mixInput" step="0.01" value="${fieldValues.mix}">
      </div>
    `;
  } else if (from === 'dew') {
    html += `
      <div class="input-group">
        <label>Точка росы, °C</label>
        <input type="number" id="dewInput" step="0.1" value="${fieldValues.dew}">
      </div>
    `;
  }

  container.innerHTML = html;

  // Обновляем подпись результата
  const to = document.getElementById('toSelect').value;
  updateResultLabel(to);
};

function updateResultLabel(to) {
  const labelMap = {
    'RH': 'Относительная влажность, %',
    'abs': 'Абсолютная влажность, кг/м³',
    'mix': 'Влагосодержание, г/кг',
    'dew': 'Точка росы, °C'
  };
  document.getElementById('resultLabel').innerHTML = `${labelMap[to]}: <span id="resultValue">—</span>`;
}

// Вспомогательные функции
function esFromT(T) {
  return 6.112 * Math.exp((17.62 * T) / (243.12 + T));
}

function absFromRH_RH_T(RH, T) {
  const es = esFromT(T);
  const e = (RH / 100) * es;
  const e_Pa = e * 100;
  const Rv = 461.5;
  const Tk = T + 273.15;
  return e_Pa / (Rv * Tk);
}

function RHFromAbs_abs_T(abs, T) {
  const es = esFromT(T);
  const e = abs * (T + 273.15) / 216.7;
  return (e / es) * 100;
}

function mixFromRH_RH_T_P(RH, T, P_mmHg) {
  const es = esFromT(T);
  const e = (RH / 100) * es;
  const P_hPa = P_mmHg * 1.33322;
  return 622 * e / (P_hPa - e);
}

function RHFromMix_mix_T_P(mix, T, P_mmHg) {
  const P_hPa = P_mmHg * 1.33322;
  const e = (mix * P_hPa) / (622 + mix);
  const es = esFromT(T);
  return (e / es) * 100;
}

function dewFromRH_RH_T(RH, T) {
  const es = esFromT(T);
  const e = (RH / 100) * es;
  const ln = Math.log(e / 6.112);
  return (243.12 * ln) / (17.62 - ln);
}

function RHFromDew_dew_T(dew, T) {
  const e = esFromT(dew);
  const es = esFromT(T);
  return (e / es) * 100;
}

function absFromDew_dew_T(dew, T) {
  const RH = RHFromDew_dew_T(dew, T);
  return absFromRH_RH_T(RH, T);
}

function mixFromDew_dew_T_P(dew, T, P_mmHg) {
  const RH = RHFromDew_dew_T(dew, T);
  return mixFromRH_RH_T_P(RH, T, P_mmHg);
}

function dewFromAbs_abs_T(abs, T) {
  const es = esFromT(T);
  const e = abs * (T + 273.15) / 216.7;
  const ln = Math.log(e / 6.112);
  return (243.12 * ln) / (17.62 - ln);
}

function dewFromMix_mix_T_P(mix, T, P_mmHg) {
  const RH = RHFromMix_mix_T_P(mix, T, P_mmHg);
  return dewFromRH_RH_T(RH, T);
}

// ОСНОВНАЯ ФУНКЦИЯ РАСЧЁТА
window.calculate = function() {
  const from = document.getElementById('fromSelect').value;
  const to = document.getElementById('toSelect').value;
  const span = document.getElementById('resultValue');
  
  // Дополнительная проверка
  if (from === to) {
    alert('Ошибка: выберите разные параметры для пересчёта');
    return;
  }
  
  try {
    const T = parseFloat(document.getElementById('tempInput').value);
    const P = parseFloat(document.getElementById('pressureInput').value);
    if (isNaN(T) || isNaN(P)) throw new Error('Заполните температуру и давление');

    let result;

    if (from === 'RH') {
      const RH = parseFloat(document.getElementById('rhInput').value);
      if (isNaN(RH)) throw new Error('Введите относительную влажность');
      if (to === 'abs') result = absFromRH_RH_T(RH, T);
      else if (to === 'mix') result = mixFromRH_RH_T_P(RH, T, P);
      else if (to === 'dew') result = dewFromRH_RH_T(RH, T);
    }
    else if (from === 'abs') {
      const abs = parseFloat(document.getElementById('absInput').value);
      if (isNaN(abs)) throw new Error('Введите абсолютную влажность');
      if (to === 'RH') result = RHFromAbs_abs_T(abs, T);
      else if (to === 'mix') {
        const RH = RHFromAbs_abs_T(abs, T);
        result = mixFromRH_RH_T_P(RH, T, P);
      }
      else if (to === 'dew') result = dewFromAbs_abs_T(abs, T);
    }
    else if (from === 'mix') {
      const mix = parseFloat(document.getElementById('mixInput').value);
      if (isNaN(mix)) throw new Error('Введите влагосодержание');
      if (to === 'RH') result = RHFromMix_mix_T_P(mix, T, P);
      else if (to === 'abs') {
        const RH = RHFromMix_mix_T_P(mix, T, P);
        result = absFromRH_RH_T(RH, T);
      }
      else if (to === 'dew') result = dewFromMix_mix_T_P(mix, T, P);
    }
    else if (from === 'dew') {
      const dew = parseFloat(document.getElementById('dewInput').value);
      if (isNaN(dew)) throw new Error('Введите точку росы');
      if (to === 'RH') result = RHFromDew_dew_T(dew, T);
      else if (to === 'abs') result = absFromDew_dew_T(dew, T);
      else if (to === 'mix') result = mixFromDew_dew_T_P(dew, T, P);
    }

    if (result === undefined) throw new Error('Не удалось вычислить');
    span.innerText = result.toFixed(precision);

  } catch (error) {
    alert(error.message || 'Ошибка ввода');
  }
};

// Инициализация
window.onload = function() {
  document.getElementById('fromSelect').value = 'RH';
  document.getElementById('toSelect').value = 'abs';
  handleFromChange();  // настраивает disabled опции и обновляет поля
};