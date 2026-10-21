/**
 * calculator.js - Motor de proyección y estrategias de liquidación de deudas
 * Métodos: Bola de Nieve (Snowball) y Avalancha (Avalanche)
 */

class DebtPayoffCalculator {
  /**
   * Ordena las deudas según la estrategia elegida
   * @param {Array} debts - Lista de deudas activas
   * @param {'snowball'|'avalanche'} strategy 
   */
  static prioritizeDebts(debts, strategy = 'snowball') {
    const active = debts.filter(d => d.currentBalance > 0);
    const copy = [...active];

    if (strategy === 'snowball') {
      // De menor saldo a mayor saldo (victorias rápidas)
      copy.sort((a, b) => a.currentBalance - b.currentBalance);
    } else if (strategy === 'avalanche') {
      // De mayor tasa de interés a menor (ahorro máximo)
      copy.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
    }
    return copy;
  }

  /**
   * Simula la amortización mensual mes a mes
   * @param {Array} debts 
   * @param {number} monthlyBudget 
   * @param {'snowball'|'avalanche'} strategy 
   */
  static simulatePayoff(debts, monthlyBudget, strategy = 'snowball') {
    const activeDebts = debts.filter(d => d.currentBalance > 0);
    if (activeDebts.length === 0) {
      return {
        months: 0,
        totalPaid: 0,
        totalInterest: 0,
        freedomDate: new Date(),
        timeline: [],
        payoffOrder: []
      };
    }

    // Clonar estado para no alterar objetos reales
    const simDebts = activeDebts.map(d => ({
      id: d.id,
      name: d.name,
      balance: d.currentBalance,
      interestRate: (d.interestRate || 0) / 100 / 12, // Tasa mensual
      minPayment: Math.max(10, d.minimumPayment || 50),
      monthPaid: null
    }));

    const totalMinPayments = simDebts.reduce((sum, d) => sum + d.minPayment, 0);
    const actualBudget = Math.max(monthlyBudget, totalMinPayments);

    let currentMonth = 0;
    const maxMonths = 360; // Límite de 30 años de protección
    let totalPaid = 0;
    let totalInterest = 0;
    const payoffOrder = [];

    while (simDebts.some(d => d.balance > 0.01) && currentMonth < maxMonths) {
      currentMonth++;
      let remainingBudget = actualBudget;

      // 1. Acumular interés mensual
      for (const d of simDebts) {
        if (d.balance > 0) {
          const interest = d.balance * d.interestRate;
          d.balance += interest;
          totalInterest += interest;
        }
      }

      // 2. Pagar los pagos mínimos de todas las deudas activas
      for (const d of simDebts) {
        if (d.balance > 0) {
          const payment = Math.min(d.balance, d.minPayment, remainingBudget);
          d.balance -= payment;
          remainingBudget -= payment;
          totalPaid += payment;

          if (d.balance <= 0.01 && !d.monthPaid) {
            d.balance = 0;
            d.monthPaid = currentMonth;
            payoffOrder.push({ ...d });
          }
        }
      }

      // 3. Aplicar todo el presupuesto sobrante a la deuda prioritaria según la estrategia
      if (remainingBudget > 0) {
        // Encontrar la deuda prioritaria aún pendiente
        const prioritized = this.prioritizeDebts(
          simDebts.map(sd => ({ ...sd, currentBalance: sd.balance })),
          strategy
        );

        if (prioritized.length > 0) {
          const targetId = prioritized[0].id;
          const targetDebt = simDebts.find(d => d.id === targetId);

          if (targetDebt && targetDebt.balance > 0) {
            const extraPayment = Math.min(targetDebt.balance, remainingBudget);
            targetDebt.balance -= extraPayment;
            remainingBudget -= extraPayment;
            totalPaid += extraPayment;

            if (targetDebt.balance <= 0.01 && !targetDebt.monthPaid) {
              targetDebt.balance = 0;
              targetDebt.monthPaid = currentMonth;
              payoffOrder.push({ ...targetDebt });
            }
          }
        }
      }
    }

    const freedomDate = new Date();
    freedomDate.setMonth(freedomDate.getMonth() + currentMonth);

    return {
      months: currentMonth,
      totalPaid: Math.round(totalPaid),
      totalInterest: Math.round(totalInterest),
      freedomDate,
      payoffOrder: payoffOrder.map(item => ({
        id: item.id,
        name: item.name,
        month: item.monthPaid
      }))
    };
  }
}

window.DebtPayoffCalculator = DebtPayoffCalculator;
