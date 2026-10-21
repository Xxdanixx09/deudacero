/**
 * db.js - Gestor de almacenamiento con IndexedDB y Fallback a LocalStorage
 * Guarda registro e historial completo de deudas y abonos de forma persistente y segura.
 */

class FinanceDB {
  constructor() {
    this.dbName = 'FinanzasDeudasDB';
    this.dbVersion = 1;
    this.db = null;
    this.storageKey = 'finanzas_deudas_data';
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB no soportado en este navegador. Usando localStorage.');
        resolve(false);
        return;
      }

      const request = window.indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', event.target.error);
        resolve(false);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Almacén de deudas
        if (!db.objectStoreNames.contains('debts')) {
          const debtStore = db.createObjectStore('debts', { keyPath: 'id' });
          debtStore.createIndex('status', 'status', { unique: false });
          debtStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Almacén de abonos / pagos
        if (!db.objectStoreNames.contains('payments')) {
          const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentStore.createIndex('debtId', 'debtId', { unique: false });
          paymentStore.createIndex('date', 'date', { unique: false });
          paymentStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Almacén de configuración
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // --- MÉTODOS LOCALSTORAGE DE RESPALDO/FALLBACK ---
  _getLocalStorageData() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return { debts: [], payments: [], settings: {} };
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error leyendo localStorage:', e);
      return { debts: [], payments: [], settings: {} };
    }
  }

  _saveLocalStorageData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }

  // --- GESTIÓN DE DEUDAS ---
  async getDebts() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts'], 'readonly');
        const store = tx.objectStore('debts');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } else {
      return this._getLocalStorageData().debts;
    }
  }

  async getDebt(id) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts'], 'readonly');
        const store = tx.objectStore('debts');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } else {
      const debts = this._getLocalStorageData().debts;
      return debts.find(d => d.id === id) || null;
    }
  }

  async saveDebt(debtData) {
    const isNew = !debtData.id;
    const now = new Date().toISOString();
    
    const debt = {
      id: debtData.id || 'debt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: (debtData.name || '').trim(),
      category: debtData.category || 'Tarjeta de Crédito',
      creditor: (debtData.creditor || '').trim(),
      initialAmount: Math.max(0, parseFloat(debtData.initialAmount) || 0),
      currentBalance: debtData.currentBalance !== undefined 
        ? Math.max(0, parseFloat(debtData.currentBalance)) 
        : Math.max(0, parseFloat(debtData.initialAmount) || 0),
      interestRate: parseFloat(debtData.interestRate) || 0,
      minimumPayment: parseFloat(debtData.minimumPayment) || 0,
      dueDay: parseInt(debtData.dueDay, 10) || null,
      notes: (debtData.notes || '').trim(),
      status: (debtData.currentBalance !== undefined && parseFloat(debtData.currentBalance) <= 0) ? 'paid' : 'active',
      createdAt: debtData.createdAt || now,
      updatedAt: now
    };

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts'], 'readwrite');
        const store = tx.objectStore('debts');
        const request = store.put(debt);
        request.onsuccess = () => resolve(debt);
        request.onerror = () => reject(request.error);
      });
    } else {
      const data = this._getLocalStorageData();
      const idx = data.debts.findIndex(d => d.id === debt.id);
      if (idx >= 0) {
        data.debts[idx] = debt;
      } else {
        data.debts.push(debt);
      }
      this._saveLocalStorageData(data);
      return debt;
    }
  }

  async deleteDebt(id) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts', 'payments'], 'readwrite');
        const debtStore = tx.objectStore('debts');
        const paymentStore = tx.objectStore('payments');

        debtStore.delete(id);

        // También eliminar los abonos asociados a esta deuda
        const index = paymentStore.index('debtId');
        const request = index.openCursor(IDBKeyRange.only(id));
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const data = this._getLocalStorageData();
      data.debts = data.debts.filter(d => d.id !== id);
      data.payments = data.payments.filter(p => p.debtId !== id);
      this._saveLocalStorageData(data);
      return true;
    }
  }

  // --- GESTIÓN DE ABONOS (PAGOS) CON HISTORIAL ---
  async getPayments() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['payments'], 'readonly');
        const store = tx.objectStore('payments');
        const request = store.getAll();
        request.onsuccess = () => {
          const list = request.result || [];
          // Ordenar por fecha y hora descendente (el más reciente primero)
          list.sort((a, b) => new Date(b.date + 'T' + (b.createdAt?.split('T')[1] || '00:00:00')) - new Date(a.date + 'T' + (a.createdAt?.split('T')[1] || '00:00:00')));
          resolve(list);
        };
        request.onerror = () => reject(request.error);
      });
    } else {
      const list = this._getLocalStorageData().payments;
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      return list;
    }
  }

  async getPaymentsByDebt(debtId) {
    const all = await this.getPayments();
    return all.filter(p => p.debtId === debtId);
  }

  /**
   * Registra un abono, actualizando atómicamente el saldo de la deuda e insertando el registro histórico.
   */
  async addPayment(paymentData) {
    const debt = await this.getDebt(paymentData.debtId);
    if (!debt) {
      throw new Error('La deuda seleccionada no existe');
    }

    const amount = parseFloat(paymentData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('El monto del abono debe ser mayor a 0');
    }

    const balanceBefore = debt.currentBalance;
    const balanceAfter = Math.max(0, balanceBefore - amount);
    const wasJustPaid = balanceBefore > 0 && balanceAfter === 0;

    const payment = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      debtId: debt.id,
      debtName: debt.name,
      amount: amount,
      date: paymentData.date || new Date().toISOString().split('T')[0],
      method: paymentData.method || 'Transferencia SPEI',
      reference: (paymentData.reference || '').trim(),
      notes: (paymentData.notes || '').trim(),
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      createdAt: new Date().toISOString()
    };

    // Actualizamos deuda
    debt.currentBalance = balanceAfter;
    if (balanceAfter === 0) {
      debt.status = 'paid';
    }
    debt.updatedAt = new Date().toISOString();

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts', 'payments'], 'readwrite');
        tx.objectStore('debts').put(debt);
        tx.objectStore('payments').add(payment);
        
        tx.oncomplete = () => resolve({ payment, debt, wasJustPaid });
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const data = this._getLocalStorageData();
      const idx = data.debts.findIndex(d => d.id === debt.id);
      if (idx >= 0) data.debts[idx] = debt;
      data.payments.unshift(payment);
      this._saveLocalStorageData(data);
      return { payment, debt, wasJustPaid };
    }
  }

  /**
   * Elimina un abono y devuelve el saldo a la deuda correspondiente (auditoría / reversión).
   */
  async deletePayment(paymentId) {
    const payments = await this.getPayments();
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return false;

    const debt = await this.getDebt(payment.debtId);
    if (debt) {
      // Devolver el monto abonado al saldo
      debt.currentBalance = Math.min(debt.initialAmount, debt.currentBalance + payment.amount);
      if (debt.currentBalance > 0) {
        debt.status = 'active';
      }
      debt.updatedAt = new Date().toISOString();
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['debts', 'payments'], 'readwrite');
        if (debt) {
          tx.objectStore('debts').put(debt);
        }
        tx.objectStore('payments').delete(paymentId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const data = this._getLocalStorageData();
      if (debt) {
        const dIdx = data.debts.findIndex(d => d.id === debt.id);
        if (dIdx >= 0) data.debts[dIdx] = debt;
      }
      data.payments = data.payments.filter(p => p.id !== paymentId);
      this._saveLocalStorageData(data);
      return true;
    }
  }

  // --- CONFIGURACIÓN ---
  async getSettings() {
    const defaults = {
      currencySymbol: '$',
      currencyCode: 'MXN',
      theme: 'dark',
      monthlyPayoffBudget: 0
    };

    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction(['settings'], 'readonly');
        const store = tx.objectStore('settings');
        const request = store.get('user_settings');
        request.onsuccess = () => resolve(request.result?.value || defaults);
        request.onerror = () => resolve(defaults);
      });
    } else {
      const data = this._getLocalStorageData();
      return Object.assign({}, defaults, data.settings);
    }
  }

  async saveSettings(settings) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['settings'], 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key: 'user_settings', value: settings });
        tx.oncomplete = () => resolve(settings);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const data = this._getLocalStorageData();
      data.settings = settings;
      this._saveLocalStorageData(data);
      return settings;
    }
  }

  // --- RESPALDO, IMPORTACIÓN Y EXPORTACIÓN ---
  async exportJSON() {
    const debts = await this.getDebts();
    const payments = await this.getPayments();
    const settings = await this.getSettings();

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'GestorDeudasHistorial',
      data: {
        debts,
        payments,
        settings
      }
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_deudas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const debts = parsed.data?.debts || parsed.debts || [];
      const payments = parsed.data?.payments || parsed.payments || [];
      const settings = parsed.data?.settings || parsed.settings || {};

      if (this.db) {
        await new Promise((resolve, reject) => {
          const tx = this.db.transaction(['debts', 'payments', 'settings'], 'readwrite');
          const debtStore = tx.objectStore('debts');
          const paymentStore = tx.objectStore('payments');
          const settingStore = tx.objectStore('settings');

          debtStore.clear();
          paymentStore.clear();

          for (const d of debts) debtStore.put(d);
          for (const p of payments) paymentStore.put(p);
          if (Object.keys(settings).length > 0) {
            settingStore.put({ key: 'user_settings', value: settings });
          }

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      } else {
        this._saveLocalStorageData({ debts, payments, settings });
      }
      return true;
    } catch (e) {
      console.error('Error al importar JSON:', e);
      throw new Error('El archivo de respaldo no es válido');
    }
  }

  async exportCSV() {
    const payments = await this.getPayments();
    if (payments.length === 0) {
      throw new Error('No hay abonos registrados para exportar');
    }

    const headers = ['ID', 'Fecha', 'Deuda', 'Monto Abonado', 'Método de Pago', 'Saldo Anterior', 'Nuevo Saldo', 'Referencia / Folio', 'Notas'];
    const rows = payments.map(p => [
      `"${p.id}"`,
      `"${p.date}"`,
      `"${p.debtName.replace(/"/g, '""')}"`,
      p.amount,
      `"${p.method}"`,
      p.balanceBefore,
      p.balanceAfter,
      `"${(p.reference || '').replace(/"/g, '""')}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_abonos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async loadSampleData() {
    const today = new Date();
    const formatDate = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    const sampleDebts = [
      {
        id: 'sample_debt_1',
        name: 'Tarjeta Nu (Crédito)',
        category: 'Tarjeta de Crédito',
        creditor: 'Nu México',
        initialAmount: 18500,
        currentBalance: 7200,
        interestRate: 42,
        minimumPayment: 850,
        dueDay: 15,
        notes: 'Compras a meses y súper',
        status: 'active',
        createdAt: new Date(today.getTime() - 90 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sample_debt_2',
        name: 'Préstamo Personal Nómina',
        category: 'Préstamo Bancario',
        creditor: 'BBVA',
        initialAmount: 35000,
        currentBalance: 16000,
        interestRate: 28,
        minimumPayment: 2100,
        dueDay: 28,
        notes: 'Para remodelación de recámara',
        status: 'active',
        createdAt: new Date(today.getTime() - 120 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sample_debt_3',
        name: 'Liverpool (Muebles sala)',
        category: 'Tienda Departamental',
        creditor: 'Liverpool',
        initialAmount: 12000,
        currentBalance: 0,
        interestRate: 0,
        minimumPayment: 1000,
        dueDay: 5,
        notes: 'Meses sin intereses ¡Liquidada!',
        status: 'paid',
        createdAt: new Date(today.getTime() - 180 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const samplePayments = [
      {
        id: 'sample_pay_1',
        debtId: 'sample_debt_1',
        debtName: 'Tarjeta Nu (Crédito)',
        amount: 3500,
        date: formatDate(3),
        method: 'Transferencia SPEI',
        reference: 'SPEI-849201',
        notes: 'Abono fuerte de quincena',
        balanceBefore: 10700,
        balanceAfter: 7200,
        createdAt: new Date(today.getTime() - 3 * 86400000).toISOString()
      },
      {
        id: 'sample_pay_2',
        debtId: 'sample_debt_1',
        debtName: 'Tarjeta Nu (Crédito)',
        amount: 2500,
        date: formatDate(18),
        method: 'Transferencia SPEI',
        reference: 'SPEI-120485',
        notes: 'Pago de corte mensual',
        balanceBefore: 13200,
        balanceAfter: 10700,
        createdAt: new Date(today.getTime() - 18 * 86400000).toISOString()
      },
      {
        id: 'sample_pay_3',
        debtId: 'sample_debt_2',
        debtName: 'Préstamo Personal Nómina',
        amount: 4000,
        date: formatDate(12),
        method: 'Descuento Vía Nómina',
        reference: 'NOM-44129',
        notes: 'Mensualidad fija BBVA',
        balanceBefore: 20000,
        balanceAfter: 16000,
        createdAt: new Date(today.getTime() - 12 * 86400000).toISOString()
      },
      {
        id: 'sample_pay_4',
        debtId: 'sample_debt_3',
        debtName: 'Liverpool (Muebles sala)',
        amount: 3000,
        date: formatDate(25),
        method: 'Efectivo',
        reference: 'TICKET-9921',
        notes: '¡Último abono para liquidar la cuenta!',
        balanceBefore: 3000,
        balanceAfter: 0,
        createdAt: new Date(today.getTime() - 25 * 86400000).toISOString()
      }
    ];

    for (const d of sampleDebts) await this.saveDebt(d);
    
    // Guardar payments
    if (this.db) {
      await new Promise((resolve) => {
        const tx = this.db.transaction(['payments'], 'readwrite');
        const store = tx.objectStore('payments');
        for (const p of samplePayments) store.put(p);
        tx.oncomplete = () => resolve();
      });
    } else {
      const data = this._getLocalStorageData();
      data.payments = samplePayments;
      this._saveLocalStorageData(data);
    }

    return true;
  }

  async clearAll() {
    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction(['debts', 'payments', 'settings'], 'readwrite');
        tx.objectStore('debts').clear();
        tx.objectStore('payments').clear();
        tx.objectStore('settings').clear();
        tx.oncomplete = () => resolve(true);
      });
    } else {
      localStorage.removeItem(this.storageKey);
      return true;
    }
  }
}

// Exportar instancia singleton
window.db = new FinanceDB();
