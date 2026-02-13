(function() {
  if (document.getElementById('tracker-panel')) return;

  const STORAGE_KEY = 'tracker_global';
  let isDragging = false;
  let dragOffsetX, dragOffsetY;
  let activeTab = 'assignments';
  let data = { assignments: [], exams: [] };

  // --- Panel HTML ---
  const panel = document.createElement('div');
  panel.id = 'tracker-panel';
  panel.innerHTML = `
    <div id="tracker-header">
      <span>TASK TRACKER</span>
      <div>
        <button id="tracker-close" title="Close">&times;</button>
      </div>
    </div>
    <div id="tracker-tabs">
      <button class="tracker-tab active" data-tab="assignments">Assignments</button>
      <button class="tracker-tab" data-tab="exams">Exams</button>
    </div>
    <div id="tracker-add">
      <input type="text" id="tracker-name" placeholder="Enter assignment name..." maxlength="200" autocomplete="off">
      <input type="text" id="tracker-date" placeholder="MM/DD/YYYY" maxlength="10" autocomplete="off">
      <button id="tracker-add-btn" title="Add">+</button>
    </div>
    <div id="tracker-list"></div>
    <div id="tracker-resize">&#x27CB;</div>
  `;
  document.body.appendChild(panel);

  // --- Elements ---
  const header = document.getElementById('tracker-header');
  const listEl = document.getElementById('tracker-list');
  const nameInput = document.getElementById('tracker-name');
  const dateInput = document.getElementById('tracker-date');
  const addBtn = document.getElementById('tracker-add-btn');
  const tabs = panel.querySelectorAll('.tracker-tab');

  // --- Drag ---
  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragOffsetX = e.clientX - panel.offsetLeft;
    dragOffsetY = e.clientY - panel.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - dragOffsetX) + 'px';
    panel.style.top = (e.clientY - dragOffsetY) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  // --- Resize ---
  let isResizing = false;
  document.getElementById('tracker-resize').addEventListener('mousedown', (e) => {
    isResizing = true;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const rect = panel.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const newHeight = e.clientY - rect.top;
    if (newWidth > 280) panel.style.width = newWidth + 'px';
    if (newHeight > 300) panel.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => { isResizing = false; });

  // --- Stop key propagation in inputs ---
  [nameInput, dateInput].forEach(input => {
    ['keydown', 'keypress', 'keyup'].forEach(evt => {
      input.addEventListener(evt, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true);
    });
  });

  // --- Close ---
  document.getElementById('tracker-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // --- Extract date from text ---
  // Tries to pull a date out of highlighted text, returns { name, date }
  function extractDateFromText(text) {
    const cleaned = text.trim();
    const patterns = [
      // MM/DD/YYYY or MM-DD-YYYY
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      // "Feb 15, 2026" or "February 15, 2026"
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/i,
      // "15 Feb 2026" or "15 February 2026"
      /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s*(\d{4})\b/i,
      // YYYY-MM-DD
      /(\d{4})-(\d{2})-(\d{2})/
    ];

    const monthMap = {jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};

    for (const pat of patterns) {
      const m = cleaned.match(pat);
      if (!m) continue;

      let iso = null;
      if (pat === patterns[0]) {
        // MM/DD/YYYY
        iso = `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      } else if (pat === patterns[1]) {
        // Month DD, YYYY
        const mon = monthMap[m[1].toLowerCase().substring(0,3)];
        iso = `${m[3]}-${String(mon).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      } else if (pat === patterns[2]) {
        // DD Month YYYY
        const mon = monthMap[m[2].toLowerCase().substring(0,3)];
        iso = `${m[3]}-${String(mon).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      } else if (pat === patterns[3]) {
        // YYYY-MM-DD
        iso = `${m[1]}-${m[2]}-${m[3]}`;
      }

      if (iso) {
        const name = cleaned.replace(m[0], '').replace(/[\s,\-–—]+$/, '').replace(/^[\s,\-–—]+/, '').trim();
        return { name: name || cleaned, date: iso };
      }
    }

    return { name: cleaned, date: null };
  }

  // --- Message handler ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'ping') return; // alive check

    if (msg.action === 'toggle') {
      if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'flex';
        loadData();
      } else {
        panel.style.display = 'none';
      }
    }

    if (msg.action === 'add-selection') {
      // Switch to the right tab
      const targetTab = msg.type || 'assignments';
      if (targetTab !== activeTab) {
        activeTab = targetTab;
        tabs.forEach(t => {
          t.classList.toggle('active', t.dataset.tab === activeTab);
        });
        nameInput.placeholder = `Enter ${activeTab === 'assignments' ? 'assignment' : 'exam'} name...`;
      }

      // Extract name + date from selection
      const extracted = extractDateFromText(msg.text);

      // Open panel and pre-fill
      panel.style.display = 'flex';
      loadData();
      nameInput.value = extracted.name;

      if (extracted.date) {
        // Date found in text — fill it and auto-focus the add button
        const d = parseDate(extracted.date);
        if (d) {
          dateInput.value = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
        }
        // Brief highlight to show it's ready to add
        addBtn.style.transform = 'scale(1.2)';
        setTimeout(() => { addBtn.style.transform = ''; }, 300);
        nameInput.focus();
      } else {
        // No date found — focus the date field so user can type it
        dateInput.value = '';
        dateInput.focus();
      }
    }
  });

  // --- Storage ---
  async function loadData() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] || {};
      data.assignments = stored.assignments || [];
      data.exams = stored.exams || [];
      renderList();
    } catch (e) {
      console.log('Tracker load error:', e);
    }
  }

  async function saveData() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (e) {
      console.log('Tracker save error:', e);
    }
  }

  // --- ID ---
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  // --- Date Utilities ---
  function parseDate(dateStr) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return null;
  }

  function formatDisplay(isoDate) {
    const d = parseDate(isoDate);
    if (!d) return isoDate;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function toISO(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getDateClass(isoDate) {
    const d = parseDate(isoDate);
    if (!d) return 'future';
    const today = new Date(); today.setHours(0,0,0,0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23,59,59,999);
    if (d < today) return 'overdue';
    if (d <= endOfWeek) return 'thisweek';
    return 'future';
  }

  // --- Tabs ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      nameInput.placeholder = `Enter ${activeTab === 'assignments' ? 'assignment' : 'exam'} name...`;
      renderList();
    });
  });

  // --- Add ---
  function addItem() {
    const name = nameInput.value.trim();
    const dateRaw = dateInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const isoDate = toISO(dateRaw);
    if (!isoDate) {
      dateInput.focus();
      dateInput.style.borderColor = '#D93025';
      setTimeout(() => { dateInput.style.borderColor = ''; }, 1500);
      return;
    }
    data[activeTab].push({
      id: generateId(),
      name: name,
      date: isoDate,
      completed: false,
      created: new Date().toISOString()
    });
    saveData().then(renderList);
    nameInput.value = '';
    dateInput.value = '';
    nameInput.focus();
  }

  addBtn.addEventListener('click', addItem);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { dateInput.value.trim() ? addItem() : dateInput.focus(); }
  });
  dateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItem();
  });

  // --- Toggle Complete ---
  function toggleComplete(id) {
    const item = data[activeTab].find(i => i.id === id);
    if (item) { item.completed = !item.completed; saveData().then(renderList); }
  }

  // --- Delete ---
  function deleteItem(id) {
    data[activeTab] = data[activeTab].filter(i => i.id !== id);
    saveData().then(renderList);
  }

  // --- Inline Edit ---
  function startEditName(id, el) {
    const item = data[activeTab].find(i => i.id === id);
    if (!item) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tracker-inline-edit';
    input.value = item.name;
    input.maxLength = 200;
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    // Stop key propagation for inline edit inputs
    ['keydown', 'keypress', 'keyup'].forEach(evt => {
      input.addEventListener(evt, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true);
    });

    function save() {
      const v = input.value.trim();
      if (v && v !== item.name) { item.name = v; saveData().then(renderList); }
      else renderList();
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.removeEventListener('blur', save); renderList(); }
    });
  }

  function startEditDate(id, el) {
    const item = data[activeTab].find(i => i.id === id);
    if (!item) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tracker-inline-date';
    const d = parseDate(item.date);
    if (d) {
      input.value = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
    }
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    ['keydown', 'keypress', 'keyup'].forEach(evt => {
      input.addEventListener(evt, (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true);
    });

    function save() {
      const nd = toISO(input.value.trim());
      if (nd && nd !== item.date) { item.date = nd; saveData().then(renderList); }
      else renderList();
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.removeEventListener('blur', save); renderList(); }
    });
  }

  // --- Escape HTML ---
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Render ---
  function renderList() {
    const items = data[activeTab].slice();
    items.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.date || '').localeCompare(b.date || '');
    });

    listEl.innerHTML = '';

    if (items.length === 0) {
      const label = activeTab === 'assignments' ? 'assignments' : 'exams';
      listEl.innerHTML = `<div class="tracker-empty"><p>No ${label} yet.</p><p class="tracker-hint">Add your first ${label === 'assignments' ? 'assignment' : 'exam'} above!</p></div>`;
      return;
    }

    items.forEach(item => {
      const dc = item.completed ? 'future' : getDateClass(item.date);
      const row = document.createElement('div');
      row.className = 'tracker-item' + (item.completed ? ' completed' : '') + (!item.completed && dc === 'overdue' ? ' overdue' : '') + (!item.completed && dc === 'thisweek' ? ' thisweek' : '');
      row.innerHTML = `
        <input type="checkbox" class="tracker-cb" ${item.completed ? 'checked' : ''}>
        <div class="tracker-content">
          <div class="tracker-item-name">${esc(item.name)}</div>
          <div class="tracker-item-date date-${dc}">${formatDisplay(item.date)}</div>
        </div>
        <button class="tracker-del" title="Delete">&times;</button>
      `;
      row.querySelector('.tracker-cb').addEventListener('change', () => toggleComplete(item.id));
      row.querySelector('.tracker-item-name').addEventListener('click', (e) => startEditName(item.id, e.currentTarget));
      row.querySelector('.tracker-item-date').addEventListener('click', (e) => startEditDate(item.id, e.currentTarget));
      row.querySelector('.tracker-del').addEventListener('click', () => deleteItem(item.id));
      listEl.appendChild(row);
    });
  }

})();
