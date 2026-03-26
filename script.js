const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CODES = ['KE', 'NP', 'CO', 'PH', 'US'];

let state = {
    mode: 'volume',
    shiftMode: 'number',
    globalAHTUnit: 'sec',
    activeMonth: new Date().getMonth(),
    selectedCountries: ['KE', 'NP', 'CO', 'PH', 'US'],
    allHolidays: {},
    workDays: 5,
    workHolidays: false,
    intensity: 1,
    activeTab: 'weekly'
};

function toggleAcc(id) {
    document.getElementById(`sec-${id}`).classList.toggle('open');
    document.getElementById(`arrow-${id}`).classList.toggle('rotate-180');
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active', 'border-b-2'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active', 'border-b-2');
}

function distributeInteger(total, count) {
    let base = Math.floor(total / count);
    let rem = Math.round(total % count);
    let arr = new Array(count).fill(base);
    for (let i = 0; i < rem; i++) arr[i]++;
    return arr;
}

async function init() {
    const mSel = document.getElementById('targetMonth');
    MONTHS.forEach((m, i) => mSel.innerHTML += `<option value="${i}" ${i === state.activeMonth ? 'selected' : ''}>${m} 2026</option>`);
    const cG = document.getElementById('countryGrid');
    CODES.forEach(code => {
        cG.innerHTML += `<button onclick="toggleCountry('${code}')" id="tag-${code}" class="px-3 py-1.5 rounded-xl text-[10px] font-black border bg-blue-600 text-white border-blue-200 shadow-sm">${code}</button>`;
        fetchHolidays(code);
    });
    syncAll();
    setTimeout(() => lucide.createIcons(), 200);
}

function setWorkDays(d) {
    state.workDays = d;
    // Updated to include 1 in the loop
    [1, 5, 6, 7].forEach(v => {
        const btn = document.getElementById('wd' + v);
        if (btn) btn.className = 'btn-toggle flex-1' + (v === d ? ' active' : '');
    });
    // Intensity box only shows if we have weekend days (6 or 7)
    document.getElementById('intensityBox').style.display = d > 5 ? 'block' : 'none';
    runAnalysis();
}
function setHolWork(b) {
    state.workHolidays = b;

    // Update visual states
    const btnYes = document.getElementById('holYes');
    const btnNo = document.getElementById('holNo');

    if (b) {
        btnYes.classList.add('active');
        btnNo.classList.remove('active');
    } else {
        btnNo.classList.add('active');
        btnYes.classList.remove('active');
    }

    runAnalysis(); // Re-run the Round-Robin logic based on new availability
}

function updateIntensity(v) {
    state.intensity = v / 100;
    document.getElementById('intVal').innerText = v + '%';
    runAnalysis();
}

function syncAll() {
    renderRoster();
    renderUCs();
    renderShifts();
    runAnalysis();
}

async function fetchHolidays(code) {
    try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/2026/${code}`);
        const data = await res.json();
        // Save both date and name
        state.allHolidays[code] = data.map(h => ({ date: h.date, name: h.localName }));
        runAnalysis();
    } catch (e) { }
}

function toggleCountry(code) {
    const btn = document.getElementById(`tag-${code}`);
    if (state.selectedCountries.includes(code)) {
        state.selectedCountries = state.selectedCountries.filter(c => c !== code);
        btn.className = "px-3 py-1.5 rounded-xl text-[10px] font-black border bg-white text-slate-400 border-slate-200";
    } else {
        state.selectedCountries.push(code);
        btn.className = "px-3 py-1.5 rounded-xl text-[10px] font-black border bg-blue-600 text-white border-blue-200 shadow-sm";
    }
    runAnalysis();
}
function setMode(m) {
    // 1. Update the Global State
    state.mode = m;

    // 2. Update the Basics Labels
    // This changes the text above your main input box
    document.getElementById('label-dailyTarget').innerText =
        m === 'volume' ? 'Target Daily Volume (Tasks)' : 'Target Daily Hours';

    // 3. Toggle Visibility of Volume-only tools
    // We hide the TPT (Tasks Per Hour) box if we are just working with raw hours
    document.getElementById('tptContainer').style.display = m === 'volume' ? 'block' : 'none';
    document.getElementById('shiftStratSec').style.display = 'block';

    // 4. Style the "Mode" Buttons (Volume vs Hours)
    // This makes the active button white/blue and the inactive one grey
    const btnVol = document.getElementById('btn-vol');
    const btnHrs = document.getElementById('btn-hrs');

    const activeClass = 'flex-1 py-2 text-[10px] font-black rounded-xl bg-white text-blue-600 shadow-sm uppercase transition-all';
    const inactiveClass = 'flex-1 py-2 text-[10px] font-black rounded-xl text-slate-500 uppercase transition-all';

    btnVol.className = m === 'volume' ? activeClass : inactiveClass;
    btnHrs.className = m === 'hours' ? activeClass : inactiveClass;

    // 5. THE "CRUISING" ADDITION: Force the Shift Strategy back to Number mode
    // This prevents the "quack" math where 100 hours suddenly becomes 100%
    state.shiftMode = 'number';

    // 6. Trigger the cascade of updates
    renderShifts(); // Updates the "Confirmed Hours" vs "Vol/Num" labels
    renderUCs();    // Updates the Use Case columns (3 vs 4 columns)
    syncAll();      // Re-runs all the math for the dashboard
}


function setShiftMode(m) {
    const target = parseFloat(document.getElementById('dailyInput').value) || 1;
    const inputs = document.querySelectorAll('.shift-input');

    inputs.forEach(inp => {
        let val = parseFloat(inp.value) || 0;
        // If switching TO percent FROM numbers
        if (m === 'percent' && state.shiftMode === 'number') {
            inp.value = ((val / target) * 100).toFixed(1);
        }
        // If switching TO numbers FROM percent
        else if (m === 'number' && state.shiftMode === 'percent') {
            inp.value = ((val / 100) * target).toFixed(0);
        }
    });

    state.shiftMode = m;

    // Update button colors
    const nBtn = document.getElementById('sModeNum');
    const pBtn = document.getElementById('sModePerc');
    if (m === 'number') {
        nBtn.className = 'flex-1 py-1 text-[9px] font-black rounded-lg bg-white text-purple-600 shadow-sm';
        pBtn.className = 'flex-1 py-1 text-[9px] font-black rounded-lg text-slate-500';
    } else {
        pBtn.className = 'flex-1 py-1 text-[9px] font-black rounded-lg bg-white text-purple-600 shadow-sm';
        nBtn.className = 'flex-1 py-1 text-[9px] font-black rounded-lg text-slate-500';
    }

    renderShifts(); // Refresh the labels
}

function renderRoster() {
    let countInput = document.getElementById('rosterCount');
    let count = parseInt(countInput.value) || 1;
    if (count > 8) { count = 8; countInput.value = 8; }
    const cont = document.getElementById('rosterContainer');
    const existingRows = cont.querySelectorAll('.roster-row');
    const targetHC = parseInt(document.getElementById('totalCWHeadcount').value) || 0;
    if (existingRows.length > count) { for (let i = existingRows.length; i > count; i--) existingRows[i - 1].remove(); }
    else if (existingRows.length < count) {
        const dist = distributeInteger(targetHC, count);
        for (let i = existingRows.length; i < count; i++) {
            const div = document.createElement('div');
            div.className = "roster-row flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100";
            div.innerHTML = `<div class="flex-1"><input type="number" value="${8 - i}" oninput="validateRoster()" class="roster-hrs-val w-full input-pill p-1.5 text-xs text-emerald-600 font-black"></div><div class="flex-1 text-center font-black text-slate-300">×</div><div class="flex-1"><input type="number" value="${dist[i]}" oninput="validateRoster()" class="roster-hc-val w-full input-pill p-1.5 text-xs text-slate-900 font-black"></div>`;
            cont.appendChild(div);
        }
    }
    validateRoster();
}

function validateRoster() {
    const targetHC = parseInt(document.getElementById('totalCWHeadcount').value) || 0;
    const forfeit = parseFloat(document.getElementById('forfeit').value) / 100;
    const tpt = parseFloat(document.getElementById('globalTPT').value) || 1;
    const dailyInput = parseFloat(document.getElementById('dailyInput').value) || 0;

    const dailyTargetHrs = (state.mode === 'volume') ? (dailyInput / tpt) : dailyInput;
    const hcInputs = document.querySelectorAll('.roster-hc-val');
    const hrInputs = document.querySelectorAll('.roster-hrs-val');

    let sumHC = 0; let grossHrs = 0;
    hcInputs.forEach((inp, i) => {
        let hc = parseInt(inp.value) || 0;
        let hr = parseFloat(hrInputs[i].value) || 0;
        sumHC += hc; grossHrs += (hc * hr);
    });

    const netHrsAvailable = grossHrs * (1 - forfeit);
    const diff = netHrsAvailable - dailyTargetHrs;
    const fteGap = Math.abs(diff / 8).toFixed(1);

    const summaryList = document.getElementById('rosterSummaryList');
    summaryList.innerHTML = `
        <div class="flex justify-between items-center text-[10px] font-black uppercase"><span class="text-slate-400 tracking-widest">Headcount Alignment:</span><span>${sumHC} / ${targetHC} CWs</span></div>
        <div class="flex justify-between items-center text-[10px] font-black uppercase border-t pt-2"><span class="text-slate-400 tracking-widest">Daily Target:</span><span class="text-blue-600">${dailyTargetHrs.toFixed(1)} HRS</span></div>
        <div class="flex justify-between items-center text-[10px] font-black uppercase"><span class="text-slate-400 tracking-widest">Expected Fulfillment:</span><span class="text-emerald-600">${netHrsAvailable.toFixed(1)} HRS</span></div>
        <div class="flex justify-between items-center text-[10px] font-black uppercase border-t pt-2">
            <span class="text-slate-400 tracking-widest">${diff >= 0 ? 'Surplus' : 'Deficit'}:</span>
            <span class="${diff >= 0 ? 'text-emerald-600' : 'text-red-500'} font-black">${Math.abs(diff).toFixed(1)} HRS</span>
        </div>
        <div class="p-4 bg-slate-900 rounded-[1.5rem] text-[10px] font-black text-white uppercase mt-2 text-center italic tracking-tight leading-tight">
            ${diff >= 0 ? `You have ${fteGap} more FT employees` : `You have ${fteGap} less FT employees`}
        </div>
    `;

    runAnalysis();
}

function renderUCs() {
    let countInput = document.getElementById('ucCount');
    let count = parseInt(countInput.value) || 1;
    const cont = document.getElementById('ucContainer');
    const target = parseFloat(document.getElementById('dailyInput').value) || 0;

    // Unit Switcher (Only for Volume Mode)
    let unitHtml = state.mode === 'volume' ? `
        <div class="bg-blue-50/50 p-2 rounded-xl border border-blue-100 mb-3 flex justify-between items-center px-4">
            <span class="text-[8px] font-black text-blue-400 uppercase italic">AHT Unit:</span>
            <div class="flex bg-white rounded-lg p-0.5 border shadow-sm">
                <button onclick="setAHTUnit('sec')" class="px-3 py-1 text-[8px] font-black rounded-md ${state.globalAHTUnit === 'sec' ? 'bg-blue-600 text-white' : 'text-slate-400'}">SEC</button>
                <button onclick="setAHTUnit('min')" class="px-3 py-1 text-[8px] font-black rounded-md ${state.globalAHTUnit === 'min' ? 'bg-blue-600 text-white' : 'text-slate-400'}">MIN</button>
                <button onclick="setAHTUnit('hr')" class="px-3 py-1 text-[8px] font-black rounded-md ${state.globalAHTUnit === 'hr' ? 'bg-blue-600 text-white' : 'text-slate-400'}">HRS</button>
            </div>
        </div>` : '';

    let html = unitHtml;
    const dist = distributeInteger(target, count);

    for (let i = 0; i < count; i++) {
        // Grid changes from grid-cols-4 to grid-cols-3
        const gridCols = state.mode === 'volume' ? 'grid-cols-4' : 'grid-cols-3';

        html += `
            <div class="uc-row p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 mb-2">
                <input type="text" value="Use Case ${i + 1}" oninput="runAnalysis()" class="uc-name-input w-full bg-transparent text-[10px] font-black text-blue-600 uppercase italic outline-none input-edit px-1">
                <div class="grid ${gridCols} gap-2">
                    <div class="space-y-1">
                        <label class="text-[7px] font-black text-slate-400 uppercase ml-1">${state.mode === 'volume' ? 'Vol' : 'Raw Hrs'}</label>
                        <input type="number" value="${dist[i]}" oninput="runAnalysis()" class="uc-vol-input p-2 text-[11px] font-black border rounded-xl outline-none text-center bg-white shadow-sm w-full">
                    </div>
                    
                    ${state.mode === 'volume' ? `
                    <div class="space-y-1">
                        <label class="text-[7px] font-black text-slate-400 uppercase ml-1">Throughput</label>
                        <input type="number" value="120" oninput="runAnalysis()" class="uc-aht-input p-2 text-[11px] font-black border rounded-xl outline-none text-center bg-white shadow-sm w-full">
                    </div>` : ''}

                    <div class="space-y-1">
                        <label class="text-[7px] font-black text-slate-400 uppercase ml-1">Hrs/CW</label>
                        <input type="number" value="8" oninput="runAnalysis()" class="uc-shift-input p-2 text-[11px] font-black border border-blue-100 text-blue-600 rounded-xl outline-none text-center bg-white shadow-sm w-full">
                    </div>

                    <div class="space-y-1">
                        <label class="text-[7px] font-black text-slate-400 uppercase ml-1">Buf %</label>
                        <input type="number" value="10" oninput="runAnalysis()" class="uc-buf-input p-2 text-[11px] font-black border rounded-xl outline-none text-center bg-white shadow-sm w-full">
                    </div>
                </div>
            </div>`;
    }
    cont.innerHTML = html;
    runAnalysis();
}
function setMode(m) {
    state.mode = m;
    document.getElementById('btn-vol').className = m === 'volume' ? 'flex-1 py-2 text-[10px] font-black rounded-xl transition-all bg-white text-blue-600 shadow-sm uppercase' : 'flex-1 py-2 text-[10px] font-black rounded-xl transition-all text-slate-500 uppercase';
    document.getElementById('btn-hrs').className = m === 'hours' ? 'flex-1 py-2 text-[10px] font-black rounded-xl bg-white text-blue-600 shadow-sm uppercase' : 'flex-1 py-2 text-[10px] font-black rounded-xl transition-all text-slate-500 uppercase';

    document.getElementById('label-dailyTarget').innerText = m === 'volume' ? 'Target Daily Volume (Tasks)' : 'Target Daily Hours';

    // CHANGE: Ensure Shift Strategy Section is ALWAYS visible regardless of mode
    document.getElementById('shiftStratSec').style.display = 'block';

    document.getElementById('tptContainer').style.display = m === 'volume' ? 'block' : 'none';
    syncAll();
}

// Ensure the renderShifts logic uses the correct basis for distributionfunction renderShifts() {
function renderShifts() {
    let countInput = document.getElementById('shiftBlockCount');
    let count = parseInt(countInput.value) || 1;
    const cont = document.getElementById('shiftStratContainer');
    const target = parseFloat(document.getElementById('dailyInput').value) || 0;

    const nBtn = document.getElementById('sModeNum');
    const pBtn = document.getElementById('sModePerc');

    if (state.mode === 'hours') {
        nBtn.innerText = "Hours";
        pBtn.innerText = "Percent %";
    } else {
        nBtn.innerText = "Numbers";
        pBtn.innerText = "Percent %";
    }

    let columnLabel = (state.shiftMode === 'percent') ? "Percent %" : (state.mode === 'hours' ? "Confirmed Hours" : "Volume / Num");

    // NEW GRID: Added a column for Hrs/CW
    cont.innerHTML = `
        <div class="grid grid-cols-12 gap-1 px-2 text-[7px] font-black text-slate-400 uppercase italic text-center mb-1">
            <div class="col-span-3 text-left">Shift Name</div>
            <div class="col-span-4 text-purple-600">${columnLabel}</div>
            <div class="col-span-2 text-blue-500">Hrs per CW</div>
            <div class="col-span-3 text-emerald-500">Buf %</div>
        </div>
    `;

    const distValue = (state.shiftMode === 'percent') ? (100 / count).toFixed(1) : (target / count).toFixed(1);

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = "shift-row grid grid-cols-12 items-center gap-1 p-2 bg-slate-50 rounded-xl border border-slate-100 mb-2";
        div.innerHTML = `
            <div class="col-span-3">
                <input type="text" value="Shift ${i + 1}" oninput="runAnalysis()" class="shift-name-input text-[9px] font-black text-purple-600 uppercase w-full bg-transparent outline-none italic px-1">
            </div>
            <div class="col-span-4">
                <input type="number" value="${distValue}" oninput="validateShifts()" class="shift-input w-full bg-white p-1 text-xs font-black border rounded-lg outline-none text-center shadow-sm">
            </div>
            <div class="col-span-2">
                <input type="number" value="8" oninput="runAnalysis()" class="shift-len-input w-full bg-blue-50 p-1 text-xs font-black border border-blue-100 text-blue-600 rounded-lg outline-none text-center shadow-sm">
            </div>
            <div class="col-span-3">
                <input type="number" value="10" oninput="runAnalysis()" class="shift-buffer-input w-full bg-white p-1 text-xs font-black border border-emerald-100 text-emerald-600 rounded-lg outline-none text-center shadow-sm">
            </div>`;
        cont.appendChild(div);
    }
    validateShifts();
}

function validateShifts() {
    const target = parseFloat(document.getElementById('dailyInput').value) || 0;
    const inputs = document.querySelectorAll('.shift-input');
    let sum = 0;
    inputs.forEach(inp => sum += (parseFloat(inp.value) || 0));

    const box = document.getElementById('shiftValidation');

    // Set the Goal: Is it 100% or the Daily Number?
    const goal = (state.shiftMode === 'percent') ? 100 : target;
    const diff = goal - sum;

    // Set the Unit Label
    let unit = "";
    if (state.shiftMode === 'percent') {
        unit = "%";
    } else {
        unit = (state.mode === 'hours') ? "HRS" : "Tasks";
    }

    if (Math.abs(diff) < 0.1) {
        box.innerHTML = `<span>Balanced (${sum}${unit})</span> <i data-lucide="check-circle" class="w-3 h-3 text-emerald-500"></i>`;
        box.className = "p-3 rounded-xl text-[10px] font-black flex items-center justify-between bg-emerald-50 text-emerald-600 mt-2 border border-emerald-100";
    } else {
        const status = diff > 0 ? "Remaining" : "Over";
        box.innerHTML = `<span>${status}: ${Math.abs(diff).toFixed(1)}${unit}</span> <i data-lucide="alert-circle" class="w-3 h-3 pulse-red text-red-500"></i>`;
        box.className = "p-3 rounded-xl text-[10px] font-black flex items-center justify-between bg-red-50 text-red-600 mt-2 border border-red-100";
    }

    lucide.createIcons();
    runAnalysis();
}
function runAnalysis() {
    const dailyInput = parseFloat(document.getElementById('dailyInput').value) || 0;
    const tpt = parseFloat(document.getElementById('globalTPT').value) || 1;
    const forfeit = parseFloat(document.getElementById('forfeit').value) / 100;
    const targetMonth = parseInt(document.getElementById('targetMonth').value);
    const weeks = getStrictWeeks(2026, targetMonth);

    // 1. Demand Calculation
    const baseDailyHrs = (state.mode === 'volume') ? (dailyInput / tpt) : dailyInput;

    // 2. Supply Calculation
    let netGlobalSupplyHrs = 0;
    const rosterRows = document.querySelectorAll('.roster-row');
    const rowArray = Array.from(rosterRows);

    document.querySelectorAll('.roster-hrs-val').forEach((inp, idx) => {
        let h = parseFloat(inp.value) || 0;
        let c = parseFloat(document.querySelectorAll('.roster-hc-val')[idx].value) || 0;
        netGlobalSupplyHrs += (h * c) * (1 - forfeit);
    });

    const variance = netGlobalSupplyHrs - baseDailyHrs;

   // --- POPULATE TAB 3: WEEKLY ROADMAP (CALENDAR LOGIC) ---
    const weeklyBody = document.getElementById('weeklyBreakdownBody');
    const strategyText = document.getElementById('monthlyStrategyText');
    let totalMonthHrs = 0;
    let totalWorkDays = 0;

    if (weeklyBody) {
        weeklyBody.innerHTML = '';
       weeks.forEach((w, i) => {
            let netWeekDays = 0;
            let weightedWeekDemand = 0; 

            w.days.forEach(d => {
                // NEW: Logic to handle 1 working day vs 5, 6, or 7
                let isActive = false;
                if (state.workDays === 1) {
                    isActive = (d.dayNum === 1); // Monday only
                } else if (state.workDays === 5) {
                    isActive = (d.dayNum >= 1 && d.dayNum <= 5); // Mon-Fri
                } else if (state.workDays === 6) {
                    isActive = (d.dayNum >= 1 && d.dayNum <= 6); // Mon-Sat
                } else if (state.workDays === 7) {
                    isActive = true; // All days
                }

                // Subtract Regional Holidays if "Work Holidays" is NO
                let isHoliday = !state.workHolidays && state.selectedCountries.some(code =>
                    state.allHolidays[code]?.some(h => h.date === d.dateStr)
                );

                if (isActive && !isHoliday) {
                    netWeekDays++;
                    // Apply intensity slider (only affects Sat=6, Sun=0)
                    let isWeekend = (d.dayNum === 0 || d.dayNum === 6);
                    let weight = isWeekend ? state.intensity : 1;
                    
                    weightedWeekDemand += (baseDailyHrs * weight);
                }
            });

            const weekSupply = netGlobalSupplyHrs * netWeekDays;
            const weekGap = weekSupply - weightedWeekDemand;

            totalMonthHrs += weightedWeekDemand; 
            totalWorkDays += netWeekDays;

            weeklyBody.innerHTML += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="px-10 py-6 font-black italic text-slate-700 uppercase">Week ${i + 1} (${w.label})</td>
                    <td class="px-10 py-6 text-center font-black text-slate-600 uppercase">${netWeekDays} Working Days</td>
                    <td class="px-10 py-6 text-center font-mono font-black text-blue-600 uppercase">${Math.round(weightedWeekDemand).toLocaleString()} HRS</td>
                    <td class="px-10 py-6 text-right font-black ${weekGap < 0 ? 'text-red-500' : 'text-emerald-600'} uppercase">
                        ${weekGap < 0 ? 'Deficit ' + Math.abs(weekGap).toFixed(0) + ' HRS' : 'Covered'}
                    </td>
                </tr>`;
        });

        // Update the strategy header with the monthly totals
        if (strategyText) {
            strategyText.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="space-y-1">
                        <h4 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">Strategic Roadmap</h4>
                        <p class="text-sm font-black italic text-white uppercase tracking-tight">
                            Monthly Operational Requirement
                        </p>
                    </div>
                    <div class="flex gap-6">
                        <div class="bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700">
                            <span class="block text-[8px] font-black text-blue-400 uppercase tracking-widest">Total Demand</span>
                            <span class="text-lg font-black text-white font-mono">${Math.round(totalMonthHrs).toLocaleString()} <span class="text-[10px] text-slate-400">HRS</span></span>
                        </div>
                        <div class="bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700">
                            <span class="block text-[8px] font-black text-emerald-400 uppercase tracking-widest">Working Window</span>
                            <span class="text-lg font-black text-white font-mono">${totalWorkDays} <span class="text-[10px] text-slate-400">DAYS</span></span>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    // --- STYLED HOLIDAY RISK ASSESSMENT ---
    const holidayRiskBox = document.getElementById('summaryHolidayRisk');
    const monthPadded = (targetMonth + 1).toString().padStart(2, '0');
    let monthHolidays = [];

    state.selectedCountries.forEach(code => {
        const hols = state.allHolidays[code] || [];
        hols.forEach(h => {
            if (h.date.startsWith(`2026-${monthPadded}`)) {
                monthHolidays.push({ ...h, country: code });
            }
        });
    });

    if (holidayRiskBox) {
    const monthPadded = (targetMonth + 1).toString().padStart(2, '0');
    let groupedHolidays = {};

    state.selectedCountries.forEach(code => {
        const hols = state.allHolidays[code] || [];
        hols.forEach(h => {
            if (h.date.startsWith(`2026-${monthPadded}`)) {
                if (!groupedHolidays[h.date]) {
                    groupedHolidays[h.date] = { name: h.name, territories: [] };
                }
                if (!groupedHolidays[h.date].territories.includes(code)) {
                    groupedHolidays[h.date].territories.push(code);
                }
            }
        });
    });

    const sortedDates = Object.keys(groupedHolidays).sort();

    if (sortedDates.length > 0) {
        holidayRiskBox.innerHTML = sortedDates.map(date => {
            const h = groupedHolidays[date];
            const day = date.split('-')[2];
            const monthName = MONTHS[targetMonth].substring(0, 3);
            
            // Just raw text: Date -- Holiday Name -- Countries
            return `
                <div class="grid grid-cols-12 gap-4 py-4 items-center">
                    <div class="col-span-2 font-mono font-black text-blue-600 text-xs">
                        ${day} ${monthName}
                    </div>
                    <div class="col-span-7 font-black uppercase text-[10px] text-slate-700 italic">
                        ${h.name}
                    </div>
                    <div class="col-span-3 text-right font-black text-[10px] text-emerald-600 uppercase tracking-tighter">
                        ${h.territories.join(' • ')}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        holidayRiskBox.innerHTML = `<p class="text-[10px] font-black text-slate-300 uppercase italic">No regional overlaps found.</p>`;
    }
}

    // --- ROUND-ROBIN DISTRIBUTION LOGIC ---
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    // Calculate how many WHOLE people are needed globally
    // We use the first block as the reference for "standard" shift length
    const refHrs = parseFloat(rowArray[0]?.querySelector('.roster-hrs-val').value) || 8;
    let totalPeopleToDistribute = Math.ceil(Math.abs(variance) / (refHrs || 1));
    const isDeficit = variance < 0;

    // Initialize an array to track adjustments per row
    let adjustments = new Array(rowArray.length).fill(0);

    // Round-Robin Loop: Give 1 person to each row, then loop back, until pool is empty
    if (Math.abs(variance) > 0.5) {
        let i = 0;
        while (totalPeopleToDistribute > 0) {
            adjustments[i]++;
            totalPeopleToDistribute--;
            i = (i + 1) % rowArray.length; // Loop back to 0 after the last row
        }
    }

    // --- RENDER TABLE ROWS ---
    let totalHC = 0;
    let totalSupply = 0;
    let totalAdjCount = 0;

    rowArray.forEach((row, index) => {
        const hrsVal = parseFloat(row.querySelector('.roster-hrs-val').value) || 0;
        const hcVal = parseFloat(row.querySelector('.roster-hc-val').value) || 0;
        const blockSupply = (hrsVal * hcVal) * (1 - forfeit);

        // Accumulate totals
        totalHC += hcVal;
        totalSupply += blockSupply;
        totalAdjCount += adjustments[index];

        let adjText = "";
        let adjColor = "text-slate-400";

        if (adjustments[index] === 0) {
            adjText = "STABLE";
            adjColor = "text-emerald-500 font-black";
        } else {
            adjText = isDeficit ? `ADD ${adjustments[index]} CW(s)` : `SURPLUS ${adjustments[index]} CW(s)`;
            adjColor = isDeficit ? "text-red-500 font-black" : "text-blue-600 font-black";
        }

        tableBody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="px-10 py-5 font-black italic uppercase text-slate-700">Demand Block ${index + 1} (${hrsVal} HRS)</td>
                <td class="px-10 py-5 text-center text-xs font-black uppercase text-slate-500">${hcVal}</td>
                <td class="px-10 py-5 text-center font-mono font-black text-blue-600 uppercase">${blockSupply.toFixed(1)}</td>
                <td class="px-10 py-5 text-right px-10 ${adjColor}">${adjText}</td>
            </tr>`;
    });

    // --- ADD FOOTER (Matches Header Format) ---
    const finalAdjText = isDeficit ? `ADD ${totalAdjCount} CW(s)` : `SURPLUS ${totalAdjCount} CW(s)`;
    const finalAdjColor = isDeficit ? "text-red-500" : "text-blue-600";

    tableBody.innerHTML += `
        <tfoot class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-t-2 border-slate-200 bg-slate-50/50">
            <tr>
                <td class="px-10 py-4 italic text-slate-900">Global Roster Totals</td>
                <td class="px-10 py-4 text-center text-slate-700">${totalHC} CWs</td>
                <td class="px-10 py-4 text-center font-mono text-blue-600">${totalSupply.toFixed(1)} HRS</td>
                <td class="px-10 py-4 text-right ${finalAdjColor} underline">${totalAdjCount === 0 ? 'STABLE' : finalAdjText}</td>
            </tr>
        </tfoot>
    `;

    // --- STRATEGIC NOTES ---
    tableBody.innerHTML += `
        <tr>
            <td colspan="4" class="p-8 bg-slate-50/50 border-t-2 border-slate-200">
                <div class="space-y-4">
                    <h4 class="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600 italic">Sequential Roster Scaling</h4>
                    <div class="space-y-1 text-[11px] font-black uppercase tracking-tight text-slate-700">
                        <p>Total Demand: <span class="text-slate-900">${baseDailyHrs.toFixed(1)} HRS</span></p>
                        <p>Total Supply: <span class="text-emerald-600">${netGlobalSupplyHrs.toFixed(1)} HRS</span></p>
                        <p>Variance: <span class="${variance >= 0 ? 'text-blue-600' : 'text-red-500'} underline">${Math.abs(variance).toFixed(1)} HRS ${variance >= 0 ? 'SURPLUS' : 'DEFICIT'}</span></p>
                    </div>
                    <p class="text-[11px] font-black italic uppercase leading-relaxed text-slate-500 pt-2 border-t border-slate-200">
                        Strategy: Distribution follows a round-robin sequence. Each active block is assigned one whole Cloudworker per cycle until the total hour variance is satisfied.
                    </p>
                </div>
            </td>
        </tr>
    `;

    // --- UPDATED BY USE CASE TAB: CAPABILITY ANALYSIS ---
    // --- UPDATED BY USE CASE TAB: CAPABILITY ANALYSIS (VERTICAL STACK) ---
    // --- UPDATED BY USE CASE TAB: VERTICAL STACKED VIEW ---
    // --- UPDATED BY USE CASE TAB: VERTICAL STACKED DATA-HEAVY VIEW ---
    // --- UPDATED BY USE CASE TAB: VERTICAL STACKED WITH SHIFT COLUMN ---
    const ucListCont = document.getElementById('uc-list-container');
    const ucValidation = document.getElementById('ucValidation');

    if (ucListCont) {
        let xTotalDemandHrs = 0;
        let capableUCs = [];
        let unableUCs = [];
        let runningSupply = netGlobalSupplyHrs;
        let rowsHtml = '';

        const ucRows = document.querySelectorAll('.uc-row');

        ucRows.forEach((row) => {
            const name = row.querySelector('.uc-name-input').value;
            const val = parseFloat(row.querySelector('.uc-vol-input').value) || 0;
            const shiftLen = parseFloat(row.querySelector('.uc-shift-input').value) || 8;
            const buf = parseFloat(row.querySelector('.uc-buf-input').value) || 0;

            let streamHrs = 0;
            if (state.mode === 'volume') {
                const aht = parseFloat(row.querySelector('.uc-aht-input').value) || 0;
                let mult = state.globalAHTUnit === 'min' ? 60 : (state.globalAHTUnit === 'hr' ? 3600 : 1);
                streamHrs = ((val * (aht * mult)) / 3600) * (1 + (buf / 100));
            } else {
                streamHrs = val * (1 + (buf / 100));
            }

            // MATH: HC = Hours / Shift Length
            let bCWs = Math.ceil(streamHrs / (shiftLen || 8));
            xTotalDemandHrs += streamHrs;

            const isCapable = runningSupply >= streamHrs;
            if (isCapable) {
                capableUCs.push(name);
                runningSupply -= streamHrs;
            } else {
                unableUCs.push(name);
            }

            // TABLE ROW: 4 Columns (Name, Hours, Shift, Headcount)
            rowsHtml += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="px-10 py-6">
                        <div class="flex items-center gap-3">
                            <div class="w-3 h-3 rounded-full ${isCapable ? 'bg-emerald-500' : 'bg-red-500'}"></div>
                            <span class="font-black italic uppercase text-purple-600 tracking-tight">${name}</span>
                        </div>
                    </td>
                    <td class="px-10 py-6 text-center font-mono font-black ${isCapable ? 'text-slate-700' : 'text-red-500'}">
                        ${streamHrs.toFixed(1)} 
                    </td>
                    <td class="px-10 py-6 text-center font-mono font-black text-slate-500 uppercase italic text-xs">
                        ${shiftLen}
                    <td class="px-10 py-6 text-right font-mono font-black text-blue-600">
                        ${bCWs} 
                    </td>
                </tr>`;
        });

        const diff = netGlobalSupplyHrs - xTotalDemandHrs;
        const isDeficit = diff < 0;

        // Sidebar Sync
        if (ucValidation) {
            ucValidation.innerHTML = `
                <div class="space-y-2 w-full text-left">
                    <p class="text-[10px] font-medium leading-relaxed lowercase text-slate-500 first-letter:uppercase tracking-tight">
                        Demand (Y): <span class="font-black text-slate-900">${xTotalDemandHrs.toFixed(1)}h</span> | 
                        Supply (X): <span class="font-black text-blue-600">${netGlobalSupplyHrs.toFixed(1)}h</span>
                    </p>
                    <div class="pt-2 border-t border-slate-100">
                        <p class="text-[9px] font-black uppercase italic tracking-wider ${isDeficit ? 'text-red-500' : 'text-emerald-600'}">
                            ${isDeficit ? `⚠️ Deficit (Z): ${Math.abs(diff).toFixed(1)} hrs` : `✅ Surplus (Z): ${Math.abs(diff).toFixed(1)} hrs`}
                        </p>
                    </div>
                </div>`;
            ucValidation.className = `p-4 rounded-2xl border mt-4 transition-all duration-300 ${isDeficit ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`;
        }

        // --- RENDER VERTICAL STACK ---
        ucListCont.className = "col-span-full flex flex-col gap-6 w-full";

        ucListCont.innerHTML = `
            <div class="w-full p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="space-y-1">
                        <div class="text-[10px] font-black text-slate-400 italic uppercase tracking-widest leading-relaxed">Availability Hours (X)</div>
                        <div class="text-3xl font-black italic tracking-tighter text-blue-600 font-mono">${netGlobalSupplyHrs.toFixed(1)}<span class="text-sm ml-1 text-slate-400">HRS</span></div>
                        <p class="text-[9px] text-slate-400 font-medium leading-tight lowercase first-letter:uppercase">Total capacity provided by defined shifts.</p>
                    </div>
                    <div class="space-y-1">
                        <div class="text-[10px] font-black text-slate-400 italic uppercase tracking-widest leading-relaxed">Needed Hours (Y)</div>
                        <div class="text-3xl font-black italic tracking-tighter text-slate-900 font-mono">${xTotalDemandHrs.toFixed(1)}<span class="text-sm ml-1 text-slate-400">HRS</span></div>
                        <p class="text-[9px] text-slate-400 font-medium leading-tight lowercase first-letter:uppercase">Total workstream requirements (Sum of all samples).</p>
                    </div>
                    <div class="space-y-1">
                        <div class="text-[10px] font-black text-slate-400 italic uppercase tracking-widest leading-relaxed">${isDeficit ? 'Hours Deficit (Z)' : 'Hours Surplus (Z)'}</div>
                        <div class="text-3xl font-black italic tracking-tighter ${isDeficit ? 'text-red-500' : 'text-emerald-500'} font-mono">${Math.abs(diff).toFixed(1)}<span class="text-sm ml-1 text-slate-400">HRS</span></div>
                        <p class="text-[9px] text-slate-400 font-medium leading-tight lowercase first-letter:uppercase">${isDeficit ? 'Resources are insufficient for total demand.' : 'Capacity exceeds total requirement.'}</p>
                    </div>
                </div>
            </div>

            <div class="w-full bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden mb-12">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b bg-slate-50/50">
                            <th class="px-10 py-5 italic">Workstream Name</th>
                            <th class="text-center italic">Hours Needed</th>
                            <th class="text-center italic"> Hours per CW</th>
                            <th class="text-right px-10 italic">Headcount (CW)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${rowsHtml}
                    </tbody>
                    <tfoot class="text-[14px] font-black text-slate-500 uppercase tracking-tight border-t-2 border-slate-200 bg-slate-50/80">
                        <tr>
                            <td class="px-10 py-6 italic text-slate-900 font-black uppercase">Cumulative Analysis Total (Y)</td>
                            <td class="text-center font-mono text-slate-800">${xTotalDemandHrs.toFixed(1)} HRS</td>
                            <td class="text-center italic text-slate-400 text-xs uppercase">— MAx —</td>
                            <td class="text-right px-10 font-mono text-blue-700 text-xl">
                                ${capableUCs.length} / ${ucRows.length} <span class="text-[11px] tracking-widest text-slate-400 ml-1 uppercase">Ready</span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        lucide.createIcons();
    }   // --- UPDATED BLOCK DIST TAB: DYNAMIC COLUMNS & CLEAN FORMAT ---
    // --- UPDATED BLOCK DIST TAB: ADDED TOTALS & DYNAMIC SUMMARY ---
    const blockCont = document.getElementById('view-blocks');
    if (blockCont) {
        let totalVol = 0;
        let totalHrs = 0;
        let totalCW = 0;
        let rowsHtml = '';
        const shiftRows = document.querySelectorAll('.shift-row');
        const isHoursMode = (state.mode === 'hours');

        shiftRows.forEach((row) => {
            const name = row.querySelector('.shift-name-input').value;
            const val = parseFloat(row.querySelector('.shift-input').value) || 0;
            const shiftLen = parseFloat(row.querySelector('.shift-len-input').value) || 8;
            const bufferVal = parseFloat(row.querySelector('.shift-buffer-input').value) || 0;

            let bBasis = (state.shiftMode === 'percent') ? (dailyInput * (val / 100)) : val;
            let bHrs = isHoursMode ? bBasis : (bBasis / tpt);
            let finalHrs = bHrs * (1 + (bufferVal / 100));

            // MATH UPDATE: Round up to whole person per shift
            let bCWs = Math.ceil(finalHrs / (shiftLen || 8));

            totalVol += (isHoursMode ? 0 : bBasis);
            totalHrs += finalHrs;
            totalCW += bCWs;

            rowsHtml += `
                <tr class="hover:bg-slate-50 border-b">
                    <td class="px-10 py-6 font-black italic uppercase text-purple-600">${name}</td>
                    ${!isHoursMode ? `
                    <td class="px-10 py-6 text-center italic text-xs font-black">
                        ${state.shiftMode === 'percent' ? val + '%' : val.toLocaleString()} Vol
                    </td>` : ''}
                    <td class="px-10 py-6 text-center font-mono font-black text-slate-700">${finalHrs.toFixed(1)} HRS</td>
                    <td class="px-10 py-6 text-right px-10 font-mono font-black text-blue-600">
                        ${bCWs}
                    </td>
                </tr>`;
        });

        const availableCWs = (netGlobalSupplyHrs / 8).toFixed(1);
        const projectedCWs = totalCW; // Whole number from the sum of ceils
        const diffCWs = Math.abs(parseFloat(availableCWs) - projectedCWs).toFixed(1);
        const isDeficit = projectedCWs > parseFloat(availableCWs);
        const tptHrsNeeded = totalVol / tpt;

        blockCont.innerHTML = `
            <div class="space-y-1 mb-6 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div class="text-[10px] font-black text-slate-400 italic uppercase tracking-widest leading-relaxed">
                    Distributed: ${Math.round(totalVol).toLocaleString()} ${isHoursMode ? 'Hours' : 'Tasks'}
                </div>
                
                ${!isHoursMode ? `
                <div class="text-[10px] font-black text-blue-400 italic uppercase tracking-widest leading-relaxed">
                    Hours needed based on TPT (${tpt}): ${tptHrsNeeded.toFixed(1)} HRS
                </div>` : ''}

                <div class="text-[10px] font-black text-emerald-500 italic uppercase tracking-widest font-mono leading-relaxed">
                    Expected Shift Fulfillment: ${netGlobalSupplyHrs.toFixed(1)} HRS
                </div>
                
                <div class="text-[10px] font-black text-blue-500 italic uppercase tracking-widest leading-relaxed">
                    Total Strategy Requirement: ${projectedCWs} CWs (Based on headcount total)
                </div>

               
            </div>

            <div class="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-visible">
                <div class="overflow-y-auto custom-scrollbar" style="max-height: 600px; position: relative;">
                    <table class="w-full text-left border-separate border-spacing-0">
                    <thead>
                        <tr class="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            <th class="sticky top-0 z-20 px-10 py-4 italic bg-slate-50 border-b border-slate-100">Shift Block</th>
                            ${!isHoursMode ? `<th class="sticky top-0 z-20 text-center italic bg-slate-50 border-b border-slate-100">Basis</th>` : ''}
                            <th class="sticky top-0 z-20 text-center italic bg-slate-50 border-b border-slate-100">Hours</th>
                            <th class="sticky top-0 z-20 text-right px-10 italic bg-slate-50 border-b border-slate-100">Headcount</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${rowsHtml}
                    </tbody>
                    <tfoot class="text-[13px] font-black text-slate-500 uppercase tracking-tight border-t-2 border-slate-200 bg-slate-50/80">
                        <tr>
                            <td class="px-10 py-5 italic text-slate-900">Total Strategy</td>
                            ${!isHoursMode ? `
                            <td class="text-center italic text-slate-400">${Math.round(totalVol).toLocaleString()} Vol</td>` : ''}
                            <td class="text-center font-mono text-slate-800">${totalHrs.toFixed(1)} HRS</td>
                            <td class="text-right px-10 font-mono text-blue-700 text-lg">
                                ${totalCW} <span class="text-[13px] tracking-widest">CWs</span>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    // --- SCOREBOARD ---
    // --- NEW DYNAMIC SCOREBOARD ---
    const scoreboardData = [
        { label: 'Daily Target', val: baseDailyHrs.toFixed(1) + ' HRS' },
        { label: 'Expected Shift Fulfillment', val: netGlobalSupplyHrs.toFixed(1) + ' HRS' },
        {
            label: variance >= 0 ? 'Daily Excess' : 'Daily Deficit',
            val: Math.abs(variance).toFixed(1) + ' HRS', // Math.abs removes the "-" sign
            color: variance >= 0 ? 'text-emerald-600' : 'text-red-500'
        },
        { label: 'Target Month', val: Math.round(totalMonthHrs).toLocaleString() + ' HRS' }
    ];

    document.getElementById('scoreboard').innerHTML = scoreboardData.map(c => `
            <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase italic mb-1 tracking-widest">
                    ${c.label}
                </p>
                <h3 class="text-xl font-black italic mt-1 tracking-tighter ${c.color || 'text-slate-900'}">
                    ${c.val}
                </h3>
            </div>
        `).join('');
            lucide.createIcons();
        }

function getStrictWeeks(y, m) {
    let weeks = []; let cur = new Date(y, m, 1); let last = new Date(y, m + 1, 0);
    while (cur <= last) {
        let start = new Date(cur); let weekDays = [];
        for (let i = 0; i < 7; i++) { if (cur.getMonth() !== m) break; weekDays.push({ dateStr: cur.toISOString().split('T')[0], dayNum: cur.getDay() }); if (cur.getDay() === 0) { cur.setDate(cur.getDate() + 1); break; } cur.setDate(cur.getDate() + 1); }
        let end = new Date(cur); end.setDate(end.getDate() - 1); weeks.push({ label: `${start.getDate()} - ${end.getMonth() === m ? end.getDate() : last.getDate()}`, days: weekDays });
    }
    return weeks;
}
function setAHTUnit(unit) {
    state.globalAHTUnit = unit;
    renderUCs(); // Refreshes the buttons to show which is active
    runAnalysis(); // Recalculates the hours based on the new unit
}

window.onload = init;

// test 
