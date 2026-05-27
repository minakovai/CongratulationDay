const friendNameInput = document.getElementById('friendName');
const countryCodeInput = document.getElementById('countryCode');
const apiKeyInput = document.getElementById('apiKey');
const generateBtn = document.getElementById('generateBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const resultSection = document.getElementById('result');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');

const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));

let selectedMode = 'neutral';
let lastContext = null;

modeButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    selectedMode = button.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle('active', b === button));
  });
});

function getTodayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    pretty: now.toLocaleDateString('ru-RU', { dateStyle: 'long' }),
  };
}

async function fetchHoliday(countryCode, year, month, day) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Сервис праздников временно недоступен');
  }

  const holidays = await response.json();
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const todayHoliday = holidays.find((h) => h.date === iso);

  if (todayHoliday) {
    return {
      name: todayHoliday.localName || todayHoliday.name,
      source: 'online',
    };
  }

  const fallbackByMonthDay = {
    '1-1': 'Новый год',
    '2-14': 'День всех влюблённых',
    '3-8': 'Международный женский день',
    '5-1': 'Праздник весны и труда',
    '12-31': 'Канун Нового года',
  };

  const fallback = fallbackByMonthDay[`${month}-${day}`] || 'День новых возможностей';
  return { name: fallback, source: 'fallback' };
}

function templateGreeting({ friendName, holidayName, mode, dateText }) {
  const intros = {
    neutral: [
      `Привет, ${friendName}!`,
      `Сегодня ${dateText}, и это отличный повод для теплых слов.`,
    ],
    formal: [
      `${friendName}, примите поздравления.`,
      `В дату ${dateText} отмечается ${holidayName}.`,
    ],
    funny: [
      `${friendName}, срочное праздничное уведомление!`,
      `Календарь официально подтвердил: сегодня ${holidayName}.`,
    ],
  };

  const body = {
    neutral:
      `Поздравляю тебя с праздником «${holidayName}»! Пусть день будет наполнен хорошими новостями, энергией и приятными людьми рядом. Желаю уверенно идти к своим целям и получать удовольствие от каждого шага.`,
    formal:
      `Поздравляю с профессионально значимым событием — «${holidayName}». Желаю устойчивых результатов, точных решений и достойного признания ваших усилий. Пусть каждый новый проект приносит развитие и уверенность в завтрашнем дне.`,
    funny:
      `Поздравляю с «${holidayName}»! Сегодня официально разрешено: работать на максимум, улыбаться без лимита и принимать комплименты в промышленных масштабах. Пусть настроение будет как премия — приятным и своевременным!`,
  };

  const endings = {
    neutral: 'С праздником! 🎉',
    formal: 'С уважением и наилучшими пожеланиями.',
    funny: 'Подпись: твой персональный генератор поздравлений 😄',
  };

  return `${intros[mode].join('\n')}\n\n${body[mode]}\n\n${endings[mode]}`;
}

async function generateWithGeminiViaKie(context, apiKey) {
  const prompt = `Сгенерируй поздравление на русском языке в HTML (только содержимое внутри <div>).\nПараметры:\nИмя: ${context.friendName}\nДата: ${context.dateText}\nПраздник: ${context.holidayName}\nСтиль: ${context.modeLabel}\nТребования: 2-3 абзаца, персонально, без банальностей, тёплый тон.`;

  const response = await fetch('https://api.kie.ai/gemini-3.1-pro/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-3.1-pro',
      messages: [
        { role: 'system', content: 'Ты помощник, который пишет красивые поздравления на русском языке в HTML.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка Gemini/Kie-генерации: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function createGreeting(forceRegenerate = false) {
  const friendName = friendNameInput.value.trim();
  if (!friendName) {
    alert('Пожалуйста, введите имя.');
    return;
  }

  generateBtn.disabled = true;
  regenerateBtn.disabled = true;
  resultSection.classList.remove('hidden');
  resultTitle.textContent = 'Готовлю поздравление...';
  resultText.textContent = 'Пожалуйста, подождите.';

  try {
    const { year, month, day, pretty } = getTodayParts();
    const countryCode = countryCodeInput.value;
    const holiday = await fetchHoliday(countryCode, year, month, day);

    const modeLabelMap = {
      neutral: 'обычный',
      formal: 'строгий деловой',
      funny: 'с юмором',
    };

    const context = {
      friendName,
      holidayName: holiday.name,
      dateText: pretty,
      mode: selectedMode,
      modeLabel: modeLabelMap[selectedMode],
      source: holiday.source,
    };

    if (!forceRegenerate || !lastContext) {
      lastContext = context;
    } else {
      lastContext.mode = selectedMode;
      lastContext.modeLabel = modeLabelMap[selectedMode];
    }

    const apiKey = apiKeyInput.value.trim();
    let greetingHtml = '';

    if (apiKey) {
      greetingHtml = await generateWithGeminiViaKie(lastContext, apiKey);
    }

    if (!greetingHtml) {
      const plain = templateGreeting(lastContext);
      greetingHtml = `<p>${plain.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
    }

    resultTitle.textContent = `${lastContext.friendName}, праздник дня: ${lastContext.holidayName}`;
    resultText.innerHTML = greetingHtml;

    const sourceText = lastContext.source === 'online' ? 'Источник: онлайн-календарь праздников.' : 'Источник: резервная база праздников.';
    resultText.innerHTML += `<p class="hint">${sourceText}</p>`;
  } catch (error) {
    resultTitle.textContent = 'Не удалось сгенерировать поздравление';
    resultText.textContent = error.message;
  } finally {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

generateBtn.addEventListener('click', () => createGreeting(false));
regenerateBtn.addEventListener('click', () => createGreeting(true));
