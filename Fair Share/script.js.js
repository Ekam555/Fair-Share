/**
 * FairShare · Precision Bill Splitter
 * Pure Vanilla JavaScript (No Frameworks)
 * Strict Penny Allocation & Persistence Engine
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_KEY_CURRENT = 'fairshare_active_bill';
  const STORAGE_KEY_HISTORY = 'fairshare_history_bills';

  // DOM Elements
  const form = document.getElementById('billSplitterForm');
  const occasionInput = document.getElementById('occasionInput');
  const billAmountInput = document.getElementById('billAmountInput');
  const numPeopleInput = document.getElementById('numPeopleInput');
  const btnDecrement = document.getElementById('btnDecrementPeople');
  const btnIncrement = document.getElementById('btnIncrementPeople');
  const btnReset = document.getElementById('btnReset');
  const alertContainer = document.getElementById('alertContainer');
  const emptyState = document.getElementById('emptyState');
  const resultsContainer = document.getElementById('resultsContainer');
  const sessionBadge = document.getElementById('sessionBadge');
  const presetChips = document.querySelectorAll('.preset-chip');
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Result Elements
  const resOccasionName = document.getElementById('resOccasionName');
  const resOccasionDate = document.getElementById('resOccasionDate');
  const resTotalBill = document.getElementById('resTotalBill');
  const resNumPeople = document.getElementById('resNumPeople');
  const resBaseShare = document.getElementById('resBaseShare');
  const resReconciledBadge = document.getElementById('resReconciledBadge');
  const sharesTableBody = document.getElementById('sharesTableBody');
  const resReconciliationMath = document.getElementById('resReconciliationMath');
  const btnCopySummary = document.getElementById('btnCopySummary');
  const copyFeedback = document.getElementById('copyFeedback');
  const btnPrint = document.getElementById('btnPrint');

  // State
  let currentCalculation = null;

  /**
   * Format a number as USD currency string ($X.XX)
   */
  function formatCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format ISO date string into readable local format
   */
  function formatDate(isoString) {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Just now';
    }
  }

  /**
   * Hide any active validation alerts
   */
  function clearAlert() {
    alertContainer.innerHTML = '';
    alertContainer.style.display = 'none';
  }

  /**
   * Display a structured error alert message and hide results
   * Requirement 4: "show message and no result, if the bill or no. of people is empty, zero or negative"
   */
  function showError(title, description) {
    alertContainer.innerHTML = `
      <div class="alert-box">
        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="alert-content">
          <div class="alert-title">${escapeHTML(title)}</div>
          <div class="alert-desc">${escapeHTML(description)}</div>
        </div>
      </div>
    `;
    alertContainer.style.display = 'block';

    // Strictly ensure NO result is visible
    resultsContainer.style.display = 'none';
    emptyState.style.display = 'block';
    currentCalculation = null;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validate inputs based on prompt rules:
   * 1. Occasion name cannot be empty
   * 2. Bill amount cannot be empty, zero, or negative
   * 3. Number of people cannot be empty, zero, or negative
   */
  function validateInputs() {
    clearAlert();

    const occasionRaw = occasionInput.value.trim();
    const billRaw = billAmountInput.value.trim();
    const peopleRaw = numPeopleInput.value.trim();

    // 1. Check Occasion Name
    if (!occasionRaw) {
      showError(
        'Occasion name is missing',
        'Please enter an occasion name (e.g., "Dinner with friends", "Cabin Weekend", "Groceries").'
      );
      occasionInput.focus();
      return { valid: false };
    }

    // 2. Check Bill Amount
    if (billRaw === '') {
      showError(
        'Bill amount is empty',
        'Please enter the total bill amount before calculating the split.'
      );
      billAmountInput.focus();
      return { valid: false };
    }

    const bill = parseFloat(billRaw);
    if (isNaN(bill) || bill <= 0) {
      showError(
        'Invalid bill amount',
        'The bill amount must be greater than zero ($0.00). Negative numbers and zero are not allowed.'
      );
      billAmountInput.focus();
      return { valid: false };
    }

    // 3. Check Number of People
    if (peopleRaw === '') {
      showError(
        'Number of people is empty',
        'Please enter how many people are splitting the bill.'
      );
      numPeopleInput.focus();
      return { valid: false };
    }

    const people = Number(peopleRaw);
    if (isNaN(people) || people <= 0 || !Number.isInteger(people)) {
      showError(
        'Invalid number of people',
        'The number of people must be a positive whole number of at least 1 person. Zero and negative values are not allowed.'
      );
      numPeopleInput.focus();
      return { valid: false };
    }

    return {
      valid: true,
      occasion: occasionRaw,
      bill: Math.round(bill * 100) / 100,
      people: people
    };
  }

  /**
   * Exact Penny Calculation Engine
   * Requirement 3: "shows each person share and shares add up exactly to the bill"
   */
  function computeExactShares(totalBill, numPeople) {
    const totalCents = Math.round(totalBill * 100);
    const baseCents = Math.floor(totalCents / numPeople);
    const remainderCents = totalCents % numPeople;

    const shares = [];
    let runningSumCents = 0;

    for (let i = 0; i < numPeople; i++) {
      const hasExtraPenny = i < remainderCents;
      const personCents = baseCents + (hasExtraPenny ? 1 : 0);
      runningSumCents += personCents;

      shares.push({
        id: i + 1,
        name: `Person ${i + 1}`,
        amount: personCents / 100,
        adjusted: hasExtraPenny
      });
    }

    return {
      shares: shares,
      totalSum: runningSumCents / 100,
      baseShare: baseCents / 100,
      remainderCents: remainderCents
    };
  }

  /**
   * Render the split results to the UI
   */
  function renderResults(calc) {
    resOccasionName.textContent = calc.occasion;
    resOccasionDate.textContent = formatDate(calc.createdAt);
    resTotalBill.textContent = formatCurrency(calc.bill);
    resNumPeople.textContent = `${calc.people} ${calc.people === 1 ? 'person' : 'people'}`;
    resBaseShare.textContent = formatCurrency(calc.computation.baseShare);

    const diff = Math.abs(calc.computation.totalSum - calc.bill);
    const isExact = diff < 0.0001;

    if (isExact) {
      resReconciledBadge.textContent = 'Exact match (0 discrepancy)';
      resReconciledBadge.style.color = 'var(--sage)';
    } else {
      resReconciledBadge.textContent = 'Reconciled';
    }

    if (calc.computation.remainderCents > 0) {
      const higherCount = calc.computation.remainderCents;
      const lowerCount = calc.people - higherCount;
      const higherVal = formatCurrency((calc.computation.baseShare * 100 + 1) / 100);
      const lowerVal = formatCurrency(calc.computation.baseShare);

      resReconciliationMath.textContent =
        `${higherCount} × ${higherVal} + ${lowerCount} × ${lowerVal} = ${formatCurrency(calc.computation.totalSum)} (exact to the penny)`;
    } else {
      resReconciliationMath.textContent =
        `${calc.people} × ${formatCurrency(calc.computation.baseShare)} = ${formatCurrency(calc.computation.totalSum)} (exact to the penny)`;
    }

    sharesTableBody.innerHTML = '';
    calc.computation.shares.forEach((person) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="person-cell">
            <span class="person-avatar">${person.id}</span>
            <span class="person-name">${escapeHTML(person.name)}</span>
          </div>
        </td>
        <td>
          ${person.adjusted
            ? '<span class="share-tag share-tag-adjusted">+1¢ rounding adj.</span>'
            : '<span class="share-tag share-tag-standard">Standard share</span>'}
        </td>
        <td class="text-right">
          <span class="person-share-val">${formatCurrency(person.amount)}</span>
        </td>
      `;
      sharesTableBody.appendChild(tr);
    });

    emptyState.style.display = 'none';
    resultsContainer.style.display = 'block';
  }

  /**
   * Save current calculation to localStorage
   * Requirement 5: "still show the result after the page is reloaded"
   */
  function saveActiveSplit(calc) {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(calc));
      saveToHistory(calc);
    } catch (e) {
      console.warn('LocalStorage unavailable:', e);
    }
  }

  function saveToHistory(calc) {
    try {
      const existing = getHistory();
      const filtered = existing.filter((item) => item.occasion !== calc.occasion || item.bill !== calc.bill);
      filtered.unshift(calc);
      const trimmed = filtered.slice(0, 6);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
      renderHistoryList(trimmed);
    } catch (e) {
      console.warn('History save error:', e);
    }
  }

  function getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function renderHistoryList(items) {
    if (!historyList || !historySection) return;

    if (!items || items.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = '';

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.title = 'Click to reload this split';
      card.innerHTML = `
        <div class="history-card-info">
          <span class="history-card-name">${escapeHTML(item.occasion)}</span>
          <span class="history-card-meta">${item.people} ${item.people === 1 ? 'person' : 'people'} · ${formatDate(item.createdAt)}</span>
        </div>
        <div class="history-card-amount">${formatCurrency(item.bill)}</div>
      `;

      card.addEventListener('click', () => {
        occasionInput.value = item.occasion;
        billAmountInput.value = item.bill;
        numPeopleInput.value = item.people;
        processCalculation();
      });

      historyList.appendChild(card);
    });
  }

  function processCalculation() {
    const check = validateInputs();
    if (!check.valid) {
      return;
    }

    const computation = computeExactShares(check.bill, check.people);

    const calc = {
      occasion: check.occasion,
      bill: check.bill,
      people: check.people,
      createdAt: new Date().toISOString(),
      computation: computation
    };

    currentCalculation = calc;
    renderResults(calc);
    saveActiveSplit(calc);

    if (sessionBadge) {
      sessionBadge.style.display = 'inline-flex';
    }
  }

  function copySummaryToClipboard() {
    if (!currentCalculation) return;

    const c = currentCalculation;
    const lines = [
      `🧾 FairShare: ${c.occasion}`,
      `Total Bill: ${formatCurrency(c.bill)}`,
      `Headcount: ${c.people} ${c.people === 1 ? 'person' : 'people'}`,
      '--------------------------------',
      ...c.computation.shares.map((s) => `• ${s.name}: ${formatCurrency(s.amount)}`),
      '--------------------------------',
      `Reconciled Sum: ${formatCurrency(c.computation.totalSum)} (exact 100% match)`
    ];

    const textToCopy = lines.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      copyFeedback.textContent = 'Copied to clipboard!';
      copyFeedback.style.display = 'inline-flex';
      setTimeout(() => {
        copyFeedback.style.display = 'none';
      }, 2500);
    }).catch(() => {
      copyFeedback.textContent = 'Copied!';
      copyFeedback.style.display = 'inline-flex';
    });
  }

  function resetAll() {
    form.reset();
    occasionInput.value = '';
    billAmountInput.value = '';
    numPeopleInput.value = '2';
    clearAlert();
    resultsContainer.style.display = 'none';
    emptyState.style.display = 'block';
    currentCalculation = null;

    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    if (sessionBadge) {
      sessionBadge.style.display = 'none';
    }

    occasionInput.focus();
  }

  function clearAllHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      renderHistoryList([]);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function initialize() {
    const history = getHistory();
    renderHistoryList(history);

    let restored = false;
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY_CURRENT);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved && saved.occasion && saved.bill > 0 && saved.people > 0) {
          occasionInput.value = saved.occasion;
          billAmountInput.value = saved.bill;
          numPeopleInput.value = saved.people;

          const computation = computeExactShares(saved.bill, saved.people);
          currentCalculation = {
            occasion: saved.occasion,
            bill: saved.bill,
            people: saved.people,
            createdAt: saved.createdAt || new Date().toISOString(),
            computation: computation
          };

          renderResults(currentCalculation);
          if (sessionBadge) {
            sessionBadge.style.display = 'inline-flex';
          }
          restored = true;
        }
      }
    } catch (e) {
      console.warn('Failed to restore active bill from storage:', e);
    }

    if (!restored) {
      resultsContainer.style.display = 'none';
      emptyState.style.display = 'block';
      if (sessionBadge) {
        sessionBadge.style.display = 'none';
      }
    }
  }

  // Event Listeners
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    processCalculation();
  });

  btnDecrement.addEventListener('click', function () {
    const current = parseInt(numPeopleInput.value, 10) || 1;
    if (current > 1) {
      numPeopleInput.value = current - 1;
    }
  });

  btnIncrement.addEventListener('click', function () {
    const current = parseInt(numPeopleInput.value, 10) || 1;
    numPeopleInput.value = current + 1;
  });

  presetChips.forEach((chip) => {
    chip.addEventListener('click', function () {
      occasionInput.value = this.dataset.occasion || this.textContent.trim();
      billAmountInput.focus();
    });
  });

  btnReset.addEventListener('click', resetAll);
  btnCopySummary.addEventListener('click', copySummaryToClipboard);
  btnPrint.addEventListener('click', function () {
    window.print();
  });

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', clearAllHistory);
  }

  occasionInput.addEventListener('input', clearAlert);
  billAmountInput.addEventListener('input', clearAlert);
  numPeopleInput.addEventListener('input', clearAlert);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();