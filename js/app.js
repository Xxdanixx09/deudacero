/**
 * app.js - Controlador principal de la aplicación de Finanzas y Deudas
 */

class FinanceApp {
  constructor() {
    this.currentView = 'dashboard';
    this.debts = [];
    this.payments = [];
    this.settings = {
      currencySymbol: '$',
      currencyCode: 'MXN',
      theme: 'dark',
      monthlyPayoffBudget: 0
    };
    this.selectedDebtForPayment = null;
    this.editingDebtId = null;
  }

  async init() {
    await window.db.init();
    this.settings = await window.db.getSettings();
    this.applyTheme(this.settings.theme || 'dark');
    
    this.bindEvents();
    await this.refreshData();

    // Si no hay datos, cargar de ejemplo si el usuario nunca ha usado la app o mostrar empty state
    if (this.debts.length === 0 && this.payments.length === 0) {
      const hasVisited = localStorage.getItem('finance_app_visited');
      if (!hasVisited) {
        localStorage.setItem('finance_app_visited', 'true');
        await window.db.loadSampleData();
        await this.refreshData();
        this.showToast('¡Bienvenido! Cargamos datos de demostración para que explores la app.', 'info');
      }
    }

    // Inicializar fecha de hoy en el modal de abono
    const todayStr = new Date().toISOString().split('T')[0];
    const paymentDateInput = document.getElementById('paymentDate');
    if (paymentDateInput) paymentDateInput.value = todayStr;
  }

  bindEvents() {
    // Navegación de vistas (Desktop y Móvil)
    document.querySelectorAll('[data-view-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = el.getAttribute('data-view-target');
        this.switchView(targetView);
      });
    });

    // Cambio de tema Dark / Light
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextTheme = this.settings.theme === 'dark' ? 'light' : 'dark';
        this.settings.theme = nextTheme;
        window.db.saveSettings(this.settings);
        this.applyTheme(nextTheme);
        window.financeCharts.updateAll(this.debts, this.payments);
      });
    }

    // Botones para abrir modales
    const btnNewDebt = document.getElementById('btnNewDebt');
    if (btnNewDebt) btnNewDebt.addEventListener('click', () => this.openDebtModal());

    const btnNewDebtAlt = document.getElementById('btnNewDebtAlt');
    if (btnNewDebtAlt) btnNewDebtAlt.addEventListener('click', () => this.openDebtModal());

    const btnNewPayment = document.getElementById('btnNewPayment');
    if (btnNewPayment) btnNewPayment.addEventListener('click', () => this.openPaymentModal());

    const btnNewPaymentAlt = document.getElementById('btnNewPaymentAlt');
    if (btnNewPaymentAlt) btnNewPaymentAlt.addEventListener('click', () => this.openPaymentModal());

    const btnOpenMobileModal = document.getElementById('btnOpenMobileModal');
    if (btnOpenMobileModal) btnOpenMobileModal.addEventListener('click', () => this.openMobileModal());

    // Formularios
    const debtForm = document.getElementById('debtForm');
    if (debtForm) debtForm.addEventListener('submit', (e) => this.handleSaveDebt(e));

    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) paymentForm.addEventListener('submit', (e) => this.handleSavePayment(e));

    // Cálculo dinámico en el modal de abono
    const paymentAmountInput = document.getElementById('paymentAmount');
    const paymentDebtSelect = document.getElementById('paymentDebtSelect');
    if (paymentAmountInput && paymentDebtSelect) {
      const updatePreview = () => this.updatePaymentPreview();
      paymentAmountInput.addEventListener('input', updatePreview);
      paymentDebtSelect.addEventListener('change', updatePreview);
    }

    // Buscador y filtros de deudas
    const debtSearchInput = document.getElementById('debtSearchInput');
    const debtFilterStatus = document.getElementById('debtFilterStatus');
    if (debtSearchInput) debtSearchInput.addEventListener('input', () => this.renderDebtsList());
    if (debtFilterStatus) debtFilterStatus.addEventListener('change', () => this.renderDebtsList());

    // Buscador y filtros de historial
    const historySearchInput = document.getElementById('historySearchInput');
    const historyDebtFilter = document.getElementById('historyDebtFilter');
    const historyPeriodFilter = document.getElementById('historyPeriodFilter');
    if (historySearchInput) historySearchInput.addEventListener('input', () => this.renderHistory());
    if (historyDebtFilter) historyDebtFilter.addEventListener('change', () => this.renderHistory());
    if (historyPeriodFilter) historyPeriodFilter.addEventListener('change', () => this.renderHistory());

    // Exportar e Importar
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', async () => {
        try {
          await window.db.exportCSV();
          this.showToast('Historial descargado en formato CSV (Excel)', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    const btnExportJSON = document.getElementById('btnExportJSON');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', async () => {
        await window.db.exportJSON();
        this.showToast('Respaldo JSON generado exitosamente', 'success');
      });
    }

    const fileImportJSON = document.getElementById('fileImportJSON');
    if (fileImportJSON) {
      fileImportJSON.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            await window.db.importJSON(event.target.result);
            await this.refreshData();
            this.showToast('¡Respaldo importado correctamente!', 'success');
          } catch (err) {
            this.showToast('Error al importar el archivo: ' + err.message, 'error');
          }
          fileImportJSON.value = '';
        };
        reader.readAsText(file);
      });
    }

    // Cargar datos demo y limpiar
    const btnLoadDemo = document.getElementById('btnLoadDemo');
    if (btnLoadDemo) {
      btnLoadDemo.addEventListener('click', async () => {
        if (confirm('¿Deseas cargar los datos de ejemplo?')) {
          await window.db.loadSampleData();
          await this.refreshData();
          this.showToast('Datos de ejemplo cargados con éxito', 'success');
        }
      });
    }

    const btnClearAll = document.getElementById('btnClearAll');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', async () => {
        if (confirm('¿ATENCIÓN: Estás seguro de borrar todos tus registros? Esta acción no se puede deshacer.')) {
          await window.db.clearAll();
          await this.refreshData();
          this.showToast('Todos los datos han sido eliminados', 'info');
        }
      });
    }

    // Calculadora de liquidación
    const calcBudgetInput = document.getElementById('calcBudgetInput');
    const stratSnowball = document.getElementById('stratSnowball');
    const stratAvalanche = document.getElementById('stratAvalanche');

    if (calcBudgetInput) calcBudgetInput.addEventListener('input', () => this.runCalculator());
    if (stratSnowball) {
      stratSnowball.addEventListener('click', () => {
        document.querySelectorAll('.strategy-radio').forEach(r => r.classList.remove('selected'));
        stratSnowball.classList.add('selected');
        this.runCalculator('snowball');
      });
    }
    if (stratAvalanche) {
      stratAvalanche.addEventListener('click', () => {
        document.querySelectorAll('.strategy-radio').forEach(r => r.classList.remove('selected'));
        stratAvalanche.classList.add('selected');
        this.runCalculator('avalanche');
      });
    }

    // Cerrar modales con botones de cerrar o fondo
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });

    // Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('themeToggleIcon');
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark' 
        ? `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`
        : `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`;
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Actualizar secciones
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    // Actualizar navs
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(el => {
      el.classList.remove('active');
      if (el.getAttribute('data-view-target') === viewName) {
        el.classList.add('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'calculator') {
      this.runCalculator();
    }
  }

  async refreshData() {
    this.debts = await window.db.getDebts();
    this.payments = await window.db.getPayments();
    
    this.renderDashboard();
    this.renderDebtsList();
    this.renderHistory();
    this.populateDebtSelects();
    window.financeCharts.updateAll(this.debts, this.payments);
  }

  formatCurrency(num) {
    const sym = this.settings.currencySymbol || '$';
    return `${sym}${Number(num || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  // --- RENDER DASHBOARD ---
  renderDashboard() {
    const totalOriginal = this.debts.reduce((sum, d) => sum + (d.initialAmount || 0), 0);
    const totalRemaining = this.debts.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
    const totalPaid = Math.max(0, totalOriginal - totalRemaining);
    const progressPercent = totalOriginal > 0 ? Math.min(100, Math.round((totalPaid / totalOriginal) * 100)) : 0;

    // KPIs
    document.getElementById('kpiRemainingBalance').innerText = this.formatCurrency(totalRemaining);
    document.getElementById('kpiTotalPaid').innerText = this.formatCurrency(totalPaid);
    document.getElementById('kpiOriginalDebt').innerText = this.formatCurrency(totalOriginal);
    document.getElementById('kpiProgressPct').innerText = `${progressPercent}%`;

    // Global Progress
    const progressBar = document.getElementById('globalProgressBar');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    const progressHeaderPct = document.getElementById('globalProgressPctText');
    if (progressHeaderPct) progressHeaderPct.innerText = `${progressPercent}% Liquidado`;

    const legendPaid = document.getElementById('legendPaidAmount');
    if (legendPaid) legendPaid.innerText = `Abonado: ${this.formatCurrency(totalPaid)}`;
    const legendRemaining = document.getElementById('legendRemainingAmount');
    if (legendRemaining) legendRemaining.innerText = `Resta: ${this.formatCurrency(totalRemaining)}`;

    // Próximo vencimiento
    const today = new Date().getDate();
    const activeWithDays = this.debts
      .filter(d => d.currentBalance > 0 && d.dueDay)
      .map(d => {
        let diff = d.dueDay - today;
        if (diff < 0) diff += 30; // Próximo mes
        return { ...d, diffDays: diff };
      })
      .sort((a, b) => a.diffDays - b.diffDays);

    const kpiNextPayment = document.getElementById('kpiNextPayment');
    if (kpiNextPayment) {
      if (activeWithDays.length > 0) {
        const next = activeWithDays[0];
        kpiNextPayment.innerText = `${next.name.slice(0, 14)} (Día ${next.dueDay})`;
      } else {
        kpiNextPayment.innerText = 'Sin fechas pendientes';
      }
    }

    // Deudas activas prioritarias (máx 3)
    const priorityContainer = document.getElementById('dashboardPriorityDebts');
    if (priorityContainer) {
      const activeDebts = this.debts.filter(d => d.currentBalance > 0).slice(0, 3);
      if (activeDebts.length === 0) {
        priorityContainer.innerHTML = `
          <div class="empty-state" style="padding: 1.5rem; margin-top: 0.5rem;">
            <div class="empty-icon" style="color: var(--accent-emerald);">🎉</div>
            <div class="empty-title">¡Sin deudas pendientes!</div>
            <div class="empty-desc">Todas tus deudas registradas están 100% liquidadas.</div>
          </div>
        `;
      } else {
        priorityContainer.innerHTML = activeDebts.map(d => this.createDebtCardHtml(d, true)).join('');
      }
    }

    // Últimos abonos (máx 4)
    const recentPaymentsContainer = document.getElementById('dashboardRecentPayments');
    if (recentPaymentsContainer) {
      const recent = this.payments.slice(0, 4);
      if (recent.length === 0) {
        recentPaymentsContainer.innerHTML = `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-desc">Aún no has registrado ningún abono. Pulsa "+ Nuevo Abono" para empezar.</div>
          </div>
        `;
      } else {
        recentPaymentsContainer.innerHTML = `
          <div class="mobile-history-list">
            ${recent.map(p => this.createPaymentItemHtml(p)).join('')}
          </div>
        `;
      }
    }
  }

  // --- RENDER DEUDAS ---
  renderDebtsList() {
    const grid = document.getElementById('allDebtsGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('debtSearchInput')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('debtFilterStatus')?.value || 'all';

    let filtered = this.debts.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(searchTerm) || 
                          (d.creditor && d.creditor.toLowerCase().includes(searchTerm)) ||
                          (d.category && d.category.toLowerCase().includes(searchTerm));
      
      const matchStatus = filterStatus === 'all' 
        ? true 
        : filterStatus === 'active' 
          ? d.currentBalance > 0 
          : d.currentBalance === 0;

      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">📂</div>
          <div class="empty-title">No se encontraron deudas</div>
          <div class="empty-desc">Intenta ajustar tu búsqueda o registra una nueva deuda con el botón de arriba.</div>
          <button class="btn btn-primary" onclick="app.openDebtModal()">+ Registrar Deuda</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(d => this.createDebtCardHtml(d, false)).join('');
  }

  createDebtCardHtml(debt, isMini = false) {
    const paidAmount = Math.max(0, debt.initialAmount - debt.currentBalance);
    const progress = debt.initialAmount > 0 ? Math.min(100, Math.round((paidAmount / debt.initialAmount) * 100)) : 100;
    const isPaid = debt.currentBalance <= 0;

    let badgeClass = 'badge-emerald';
    if (debt.category?.includes('Tarjeta')) badgeClass = 'badge-blue';
    else if (debt.category?.includes('Bancario') || debt.category?.includes('Personal')) badgeClass = 'badge-purple';
    else if (debt.category?.includes('Tienda')) badgeClass = 'badge-amber';

    return `
      <div class="debt-card ${isPaid ? 'paid' : ''}" data-debt-id="${debt.id}">
        <div class="debt-card-header">
          <div class="debt-info">
            <span class="badge ${badgeClass}">${debt.category || 'Deuda'}</span>
            <h3 class="debt-name">${debt.name}</h3>
            ${debt.creditor ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">${debt.creditor}</span>` : ''}
          </div>
          ${isPaid ? `
            <span class="badge badge-emerald" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
              ✓ ¡PAGADA!
            </span>
          ` : `
            <span style="font-size: 0.85rem; font-weight: 800; color: var(--accent-emerald);">
              ${progress}%
            </span>
          `}
        </div>

        <div class="debt-amounts">
          <div class="debt-amount-item">
            <span class="debt-amount-label">Resta pagar</span>
            <span class="debt-amount-value ${isPaid ? 'paid-amount' : 'remaining'}">
              ${this.formatCurrency(debt.currentBalance)}
            </span>
          </div>
          <div class="debt-amount-item">
            <span class="debt-amount-label">Total original</span>
            <span class="debt-amount-value">
              ${this.formatCurrency(debt.initialAmount)}
            </span>
          </div>
        </div>

        <!-- Barra de progreso individual -->
        <div>
          <div class="progress-track" style="height: 8px;">
            <div class="progress-bar-fill" style="width: ${progress}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">
            <span>Abonado: ${this.formatCurrency(paidAmount)}</span>
            <span>${100 - progress}% pendiente</span>
          </div>
        </div>

        <div class="debt-meta">
          ${debt.dueDay ? `
            <div class="debt-meta-item">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Corte: día ${debt.dueDay}</span>
            </div>
          ` : ''}
          ${debt.interestRate ? `
            <div class="debt-meta-item">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <span>${debt.interestRate}% anual</span>
            </div>
          ` : ''}
          ${debt.minimumPayment ? `
            <div class="debt-meta-item">
              <span>Mínimo: ${this.formatCurrency(debt.minimumPayment)}</span>
            </div>
          ` : ''}
        </div>

        <div class="debt-actions">
          ${!isPaid ? `
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="app.quickPay('${debt.id}')">
              ⚡ Abonar
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="app.viewDebtHistory('${debt.id}')" title="Ver historial de abonos de esta deuda">
            📜 Historial
          </button>
          <button class="btn btn-icon btn-sm" onclick="app.editDebt('${debt.id}')" title="Editar deuda">
            ✏️
          </button>
          <button class="btn btn-icon btn-sm" onclick="app.deleteDebt('${debt.id}')" title="Eliminar deuda">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  // --- RENDER HISTORIAL ---
  renderHistory() {
    const tableBody = document.getElementById('historyTableBody');
    const mobileList = document.getElementById('historyMobileList');
    if (!tableBody && !mobileList) return;

    const searchTerm = (document.getElementById('historySearchInput')?.value || '').toLowerCase();
    const filterDebt = document.getElementById('historyDebtFilter')?.value || 'all';
    const filterPeriod = document.getElementById('historyPeriodFilter')?.value || 'all';

    const now = new Date();
    let filtered = this.payments.filter(p => {
      const matchSearch = p.debtName.toLowerCase().includes(searchTerm) ||
                          (p.method && p.method.toLowerCase().includes(searchTerm)) ||
                          (p.reference && p.reference.toLowerCase().includes(searchTerm)) ||
                          (p.notes && p.notes.toLowerCase().includes(searchTerm));

      const matchDebt = filterDebt === 'all' || p.debtId === filterDebt;

      let matchPeriod = true;
      if (filterPeriod === 'this_month') {
        const pDate = new Date(p.date + 'T00:00:00');
        matchPeriod = pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      } else if (filterPeriod === 'last_3_months') {
        const pDate = new Date(p.date + 'T00:00:00');
        const diffMonths = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
        matchPeriod = diffMonths >= 0 && diffMonths <= 3;
      }

      return matchSearch && matchDebt && matchPeriod;
    });

    // Estadísticas de historial
    const totalPaymentsCount = filtered.length;
    const totalAbonado = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    const avgAbono = totalPaymentsCount > 0 ? totalAbonado / totalPaymentsCount : 0;
    const maxAbono = filtered.reduce((max, p) => Math.max(max, p.amount || 0), 0);

    const elTotal = document.getElementById('histKpiTotal');
    const elCount = document.getElementById('histKpiCount');
    const elAvg = document.getElementById('histKpiAvg');
    const elMax = document.getElementById('histKpiMax');

    if (elTotal) elTotal.innerText = this.formatCurrency(totalAbonado);
    if (elCount) elCount.innerText = totalPaymentsCount.toString();
    if (elAvg) elAvg.innerText = this.formatCurrency(avgAbono);
    if (elMax) elMax.innerText = this.formatCurrency(maxAbono);

    if (filtered.length === 0) {
      const emptyHtml = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">Sin registros en el historial</div>
          <div class="empty-desc">No hay abonos que coincidan con los filtros seleccionados.</div>
        </div>
      `;
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
      if (mobileList) mobileList.innerHTML = emptyHtml;
      return;
    }

    // Desktop Table
    if (tableBody) {
      tableBody.innerHTML = filtered.map(p => `
        <tr>
          <td><span style="font-weight: 600;">${p.date}</span></td>
          <td><strong>${p.debtName}</strong></td>
          <td class="payment-amount-cell">+${this.formatCurrency(p.amount)}</td>
          <td><span class="badge badge-blue">${p.method || 'SPEI'}</span></td>
          <td style="color: var(--text-secondary); font-size: 0.8rem;">
            ${this.formatCurrency(p.balanceBefore)} → <strong style="color: var(--text-primary);">${this.formatCurrency(p.balanceAfter)}</strong>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${p.reference ? `<span style="font-weight:600; color:var(--text-secondary);">Ref: ${p.reference}</span> ` : ''}
            ${p.notes || ''}
          </td>
          <td>
            <button class="btn btn-icon btn-sm" onclick="app.deletePayment('${p.id}')" title="Revertir este abono">
              🗑️
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Mobile Cards
    if (mobileList) {
      mobileList.innerHTML = filtered.map(p => this.createPaymentItemHtml(p, true)).join('');
    }
  }

  createPaymentItemHtml(p, canDelete = false) {
    return `
      <div class="mobile-history-card">
        <div class="mobile-history-header">
          <span class="mobile-history-debt">${p.debtName}</span>
          <span class="mobile-history-amount">+${this.formatCurrency(p.amount)}</span>
        </div>
        <div class="mobile-history-meta">
          <span>📅 ${p.date} • <span class="badge badge-blue" style="font-size:0.65rem; padding:0.1rem 0.4rem;">${p.method}</span></span>
          <span>Saldo: ${this.formatCurrency(p.balanceAfter)}</span>
        </div>
        ${(p.reference || p.notes) ? `
          <div style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-primary); padding: 0.35rem 0.5rem; border-radius: 4px;">
            ${p.reference ? `<strong>Ref:</strong> ${p.reference} ` : ''}
            ${p.notes ? `• ${p.notes}` : ''}
          </div>
        ` : ''}
        ${canDelete ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
            <button class="btn btn-danger btn-sm" onclick="app.deletePayment('${p.id}')">
              🗑️ Revertir abono
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- POPULATE SELECTS ---
  populateDebtSelects() {
    const selects = ['paymentDebtSelect', 'historyDebtFilter'];
    selects.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;

      const currentValue = select.value;
      let options = '';

      if (id === 'historyDebtFilter') {
        options = '<option value="all">Todas las deudas</option>';
      } else {
        options = '<option value="">-- Selecciona la deuda a abonar --</option>';
      }

      const list = id === 'paymentDebtSelect' ? this.debts.filter(d => d.currentBalance > 0) : this.debts;

      list.forEach(d => {
        options += `<option value="${d.id}">${d.name} (Resta: ${this.formatCurrency(d.currentBalance)})</option>`;
      });

      select.innerHTML = options;
      if (currentValue && list.some(d => d.id === currentValue)) {
        select.value = currentValue;
      }
    });
  }

  // --- MODAL DE DEUDA ---
  openDebtModal(debt = null) {
    this.editingDebtId = debt ? debt.id : null;
    const modal = document.getElementById('debtModal');
    const title = document.getElementById('debtModalTitle');
    
    if (title) title.innerText = debt ? '✏️ Editar Deuda' : '➕ Nueva Deuda';

    document.getElementById('debtName').value = debt ? debt.name : '';
    document.getElementById('debtCategory').value = debt ? debt.category : 'Tarjeta de Crédito';
    document.getElementById('debtCreditor').value = debt ? (debt.creditor || '') : '';
    document.getElementById('debtInitialAmount').value = debt ? debt.initialAmount : '';
    document.getElementById('debtCurrentBalance').value = debt ? debt.currentBalance : '';
    document.getElementById('debtInterestRate').value = debt ? (debt.interestRate || '') : '';
    document.getElementById('debtMinimumPayment').value = debt ? (debt.minimumPayment || '') : '';
    document.getElementById('debtDueDay').value = debt ? (debt.dueDay || '') : '';
    document.getElementById('debtNotes').value = debt ? (debt.notes || '') : '';

    if (modal) modal.classList.add('active');
  }

  async handleSaveDebt(e) {
    e.preventDefault();
    const name = document.getElementById('debtName').value.trim();
    const initialAmount = parseFloat(document.getElementById('debtInitialAmount').value);
    const balanceInput = document.getElementById('debtCurrentBalance').value;
    const currentBalance = balanceInput !== '' ? parseFloat(balanceInput) : initialAmount;

    if (!name || isNaN(initialAmount) || initialAmount <= 0) {
      this.showToast('Por favor introduce un nombre y monto inicial válido', 'error');
      return;
    }

    const debtData = {
      id: this.editingDebtId,
      name: name,
      category: document.getElementById('debtCategory').value,
      creditor: document.getElementById('debtCreditor').value.trim(),
      initialAmount: initialAmount,
      currentBalance: isNaN(currentBalance) ? initialAmount : currentBalance,
      interestRate: parseFloat(document.getElementById('debtInterestRate').value) || 0,
      minimumPayment: parseFloat(document.getElementById('debtMinimumPayment').value) || 0,
      dueDay: parseInt(document.getElementById('debtDueDay').value, 10) || null,
      notes: document.getElementById('debtNotes').value.trim()
    };

    await window.db.saveDebt(debtData);
    this.closeAllModals();
    await this.refreshData();
    this.showToast(this.editingDebtId ? 'Deuda actualizada correctamente' : '¡Deuda registrada con éxito!', 'success');
  }

  async editDebt(id) {
    const debt = await window.db.getDebt(id);
    if (debt) this.openDebtModal(debt);
  }

  async deleteDebt(id) {
    const debt = await window.db.getDebt(id);
    if (!debt) return;

    if (confirm(`¿Estás seguro de eliminar "${debt.name}"? Se borrarán también los abonos registrados a esta deuda.`)) {
      await window.db.deleteDebt(id);
      await this.refreshData();
      this.showToast('Deuda eliminada del registro', 'info');
    }
  }

  // --- MODAL DE ABONO ---
  openPaymentModal(preselectedDebtId = null) {
    const modal = document.getElementById('paymentModal');
    this.populateDebtSelects();

    const select = document.getElementById('paymentDebtSelect');
    if (preselectedDebtId && select) {
      select.value = preselectedDebtId;
    }

    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentNotes').value = '';
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];

    this.updatePaymentPreview();
    if (modal) modal.classList.add('active');
  }

  quickPay(debtId) {
    this.openPaymentModal(debtId);
  }

  updatePaymentPreview() {
    const debtId = document.getElementById('paymentDebtSelect')?.value;
    const amountVal = parseFloat(document.getElementById('paymentAmount')?.value) || 0;
    const box = document.getElementById('paymentBalancePreviewBox');
    const label = document.getElementById('paymentPreviewText');

    if (!debtId || !box || !label) {
      if (box) box.style.display = 'none';
      return;
    }

    const debt = this.debts.find(d => d.id === debtId);
    if (!debt) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'flex';
    const newBalance = Math.max(0, debt.currentBalance - amountVal);
    label.innerHTML = `Saldo actual: <strong>${this.formatCurrency(debt.currentBalance)}</strong> → Nuevo saldo: <strong style="color: var(--accent-emerald);">${this.formatCurrency(newBalance)}</strong>`;
  }

  async handleSavePayment(e) {
    e.preventDefault();
    const debtId = document.getElementById('paymentDebtSelect').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const reference = document.getElementById('paymentReference').value;
    const notes = document.getElementById('paymentNotes').value;

    if (!debtId) {
      this.showToast('Por favor selecciona la deuda a la que deseas abonar', 'error');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      this.showToast('Ingresa un monto de abono mayor a 0', 'error');
      return;
    }

    try {
      const result = await window.db.addPayment({
        debtId,
        amount,
        date,
        method,
        reference,
        notes
      });

      this.closeAllModals();
      await this.refreshData();

      if (result.wasJustPaid) {
        this.launchConfetti();
        this.showToast(`🎉 ¡FELICIDADES! Has liquidado al 100% "${result.debt.name}"`, 'success');
      } else {
        this.showToast(`¡Abono de ${this.formatCurrency(amount)} registrado con éxito!`, 'success');
      }
    } catch (err) {
      this.showToast('Error al registrar abono: ' + err.message, 'error');
    }
  }

  async deletePayment(id) {
    if (confirm('¿Deseas revertir este abono? El monto se volverá a sumar al saldo pendiente de la deuda.')) {
      await window.db.deletePayment(id);
      await this.refreshData();
      this.showToast('Abono revertido y saldo recalculado', 'info');
    }
  }

  // --- HISTORIAL INDIVIDUAL DE UNA DEUDA ---
  async viewDebtHistory(debtId) {
    const debt = await window.db.getDebt(debtId);
    if (!debt) return;

    const payments = await window.db.getPaymentsByDebt(debtId);
    const modal = document.getElementById('debtHistoryModal');
    const title = document.getElementById('debtHistoryTitle');
    const container = document.getElementById('debtHistoryContent');

    if (title) title.innerText = `Historial: ${debt.name}`;

    const totalAbonado = payments.reduce((sum, p) => sum + p.amount, 0);

    if (container) {
      container.innerHTML = `
        <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 1rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Saldo Original</div>
              <div style="font-size: 1.1rem; font-weight: 800;">${this.formatCurrency(debt.initialAmount)}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Saldo Pendiente</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #f87171;">${this.formatCurrency(debt.currentBalance)}</div>
            </div>
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--accent-emerald);">
            Total abonado hasta hoy: <strong>${this.formatCurrency(totalAbonado)}</strong> (${payments.length} abonos)
          </div>
        </div>

        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem;">Registro de abonos de esta deuda</h4>
        ${payments.length === 0 ? `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-desc">No hay abonos registrados para esta deuda todavía.</div>
          </div>
        ` : `
          <div class="mobile-history-list">
            ${payments.map(p => this.createPaymentItemHtml(p, true)).join('')}
          </div>
        `}
      `;
    }

    if (modal) modal.classList.add('active');
  }

  // --- CALCULADORA DE LIQUIDACIÓN ---
  runCalculator(forceStrategy = null) {
    const selectedStratEl = document.querySelector('.strategy-radio.selected');
    const strategy = forceStrategy || (selectedStratEl?.id === 'stratAvalanche' ? 'avalanche' : 'snowball');
    
    // Suma de pagos mínimos como sugerencia
    const activeDebts = this.debts.filter(d => d.currentBalance > 0);
    const sumMinPayments = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 50), 0);

    const budgetInput = document.getElementById('calcBudgetInput');
    let userBudget = budgetInput ? parseFloat(budgetInput.value) : 0;

    if (!userBudget || userBudget < sumMinPayments) {
      if (budgetInput && !budgetInput.value && sumMinPayments > 0) {
        budgetInput.value = sumMinPayments + 500; // sugerencia
        userBudget = sumMinPayments + 500;
      }
    }

    const result = DebtPayoffCalculator.simulatePayoff(this.debts, userBudget || 1000, strategy);

    const resultBox = document.getElementById('calcResultBox');
    if (resultBox) {
      if (activeDebts.length === 0) {
        resultBox.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-icon" style="color: var(--accent-emerald);">🌟</div>
            <div class="empty-title">¡Estás libre de deudas!</div>
            <div class="empty-desc">No tienes ninguna deuda pendiente actualmente.</div>
          </div>
        `;
        return;
      }

      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const freedomStr = `${monthNames[result.freedomDate.getMonth()]} de ${result.freedomDate.getFullYear()}`;

      resultBox.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%); border: 1px solid var(--accent-emerald); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-emerald-light); text-transform: uppercase;">Meta de Libertad Financiera</div>
          <div style="font-size: 1.6rem; font-weight: 800; margin: 0.4rem 0;">Libre en ${result.months} meses</div>
          <div style="font-size: 0.95rem; color: var(--text-secondary);">Fecha estimada de liquidación total: <strong>${freedomStr}</strong></div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
            <div>Intereses estimados: <strong>${this.formatCurrency(result.totalInterest)}</strong></div>
            <div>Total a abonar: <strong>${this.formatCurrency(result.totalPaid)}</strong></div>
          </div>
        </div>

        <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Orden de liquidación recomendado (${strategy === 'snowball' ? 'Bola de Nieve' : 'Avalancha'}):</h4>
        <div class="timeline-list">
          ${result.payoffOrder.map((item, idx) => `
            <div class="timeline-step">
              <div class="step-num">${idx + 1}</div>
              <div class="step-content">
                <div style="font-weight: 700;">${item.name}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                  Liquidada aproximadamente en el <strong>Mes ${item.month}</strong>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // --- MODAL MÓVIL Y CÓDIGO QR ---
  openMobileModal() {
    const modal = document.getElementById('mobileModal');
    const qrContainer = document.getElementById('qrCodeContainer');
    const linkText = document.getElementById('mobileUrlText');

    const currentUrl = window.location.href;
    if (linkText) linkText.innerText = currentUrl;

    if (qrContainer) {
      qrContainer.innerHTML = '';
      // Generar código QR en canvas usando QRious si está disponible o imagen QR de respaldo
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 180;
      qrContainer.appendChild(canvas);

      if (window.QRious) {
        new QRious({
          element: canvas,
          value: currentUrl,
          size: 180,
          level: 'M'
        });
      } else {
        // Fallback vía API de código QR pública o imagen directa
        qrContainer.innerHTML = `
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}" 
               alt="Código QR para abrir en celular" 
               style="border-radius: 8px; width: 180px; height: 180px; display: block; margin: 0 auto;" />
        `;
      }
    }

    if (modal) modal.classList.add('active');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    this.editingDebtId = null;
  }

  // --- CONFETTI DE CELEBRACIÓN ---
  launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#34d399'];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 8 + 6,
        h: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        velY: Math.random() * 4 + 3,
        velX: (Math.random() - 0.5) * 4,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }

    let frames = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.y += p.velY;
        p.x += p.velX;
        p.rot += p.rotSpeed;
      });

      frames++;
      if (frames < 180) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animate();
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    else if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `
      <span style="font-weight: 800; font-size: 1.1rem;">${icon}</span>
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.app = new FinanceApp();
  window.app.init();
});
