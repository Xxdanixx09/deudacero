/**
 * charts.js - Gráficos visuales con Chart.js para finanzas y deudas
 */

class FinanceCharts {
  constructor() {
    this.distributionChart = null;
    this.historyChart = null;
  }

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      cardBg: isDark ? '#161f30' : '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };
  }

  /**
   * Renderiza el gráfico de dona con la distribución del saldo pendiente de las deudas
   */
  renderDistribution(debts) {
    const canvas = document.getElementById('debtDistributionChart');
    if (!canvas || !window.Chart) return;

    if (this.distributionChart) {
      this.distributionChart.destroy();
      this.distributionChart = null;
    }

    const activeDebts = debts.filter(d => d.currentBalance > 0);
    const theme = this.getThemeColors();

    if (activeDebts.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px ' + theme.fontFamily;
      ctx.fillStyle = theme.textColor;
      ctx.textAlign = 'center';
      ctx.fillText('¡Felicidades! No tienes deudas activas.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const labels = activeDebts.map(d => d.name);
    const data = activeDebts.map(d => d.currentBalance);
    const palette = [
      '#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
      '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
    ];

    this.distributionChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette.slice(0, activeDebts.length),
          borderWidth: 2,
          borderColor: theme.cardBg
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: theme.fontFamily, size: 12 },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = Math.round((val / total) * 100);
                return ` ${context.label}: $${val.toLocaleString()} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  /**
   * Renderiza el gráfico de barras con el total abonado por mes en los últimos meses
   */
  renderHistory(payments) {
    const canvas = document.getElementById('paymentHistoryChart');
    if (!canvas || !window.Chart) return;

    if (this.historyChart) {
      this.historyChart.destroy();
      this.historyChart = null;
    }

    const theme = this.getThemeColors();

    if (!payments || payments.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px ' + theme.fontFamily;
      ctx.fillStyle = theme.textColor;
      ctx.textAlign = 'center';
      ctx.fillText('Sin abonos registrados aún', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Agrupar abonos por mes (AAAA-MM)
    const monthlyTotals = {};
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Tomar los últimos 6 meses cronológicamente
    payments.forEach(p => {
      if (!p.date) return;
      const [year, month] = p.date.split('-');
      const key = `${year}-${month}`;
      monthlyTotals[key] = (monthlyTotals[key] || 0) + (p.amount || 0);
    });

    const sortedKeys = Object.keys(monthlyTotals).sort();
    const displayKeys = sortedKeys.slice(-6); // últimos 6 meses

    const labels = displayKeys.map(k => {
      const [year, month] = k.split('-');
      return `${monthNames[parseInt(month, 10) - 1]} ${year.slice(2)}`;
    });

    const data = displayKeys.map(k => monthlyTotals[k]);

    this.historyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Abonado',
          data: data,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          hoverBackgroundColor: '#10b981',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: theme.fontFamily, size: 11 } }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: theme.fontFamily, size: 11 },
              callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => ` Abonado: $${(context.raw || 0).toLocaleString()}`
            }
          }
        }
      }
    });
  }

  updateAll(debts, payments) {
    this.renderDistribution(debts);
    this.renderHistory(payments);
  }
}

window.financeCharts = new FinanceCharts();
