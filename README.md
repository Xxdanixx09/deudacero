# 💰 DeudaCero - Gestor de Deudas, Abonos e Historial

Una aplicación web moderna, ágil y visualmente atractiva diseñada para llevar el control total de tus deudas, registrar cada abono que realizas y visualizar tu avance hacia la libertad financiera con historial completo.

---

## 🌟 Características Principales

1. **Dashboard Financiero en Tiempo Real:**
   - Métricas clave: Saldo Pendiente Total, Monto Total Abonado, Total Original Prestado y Porcentaje Global de Avance.
   - Barra de progreso general con estado de liquidación.
   - Gráficos interactivos con Chart.js:
     - Distribución de deuda por acreedor / categoría (gráfico de dona).
     - Evolución mensual de abonos realizados (gráfico de barras).
   - Acceso rápido a las deudas prioritarias y últimos movimientos.

2. **Gestión Completa de Deudas:**
   - Registro de tarjetas de crédito, préstamos bancarios, préstamos personales, tiendas departamentales, hipotecas o autos.
   - Seguimiento del saldo inicial vs. saldo restante.
   - Control de fecha o día de corte/vencimiento mensual con alertas visuales.
   - Tasa de interés opcional y pago mínimo sugerido.
   - Tarjetas con barras de progreso individuales y distintivo especial cuando se liquida al 100% (¡con celebración de confeti!).

3. **Módulo de Abonos e Historial de Auditoría:**
   - Registro instantáneo de abonos con previsualización en vivo: *“El saldo pasará de $X a $Y antes de confirmar”*.
   - Múltiples métodos de pago: Transferencia SPEI, Efectivo, Descuento Vía Nómina, Débito, Practicaja/OXXO, etc.
   - Registro de folios de transferencia, referencias y notas de cada abono.
   - Historial detallado con buscador en vivo, filtro por deuda y filtro por períodos (Este mes, Últimos 3 meses, Todo).
   - Capacidad de revertir o anular un abono (recalculando automáticamente el saldo de la deuda).
   - **Exportación a Excel (CSV)** con un solo clic.

4. **Estrategias de Pago & Calculadora:**
   - **Método Bola de Nieve (Snowball):** Ordena deudas de menor a mayor saldo para victorias psicológicas rápidas.
   - **Método Avalancha (Avalanche):** Ordena deudas de mayor a menor tasa de interés para maximizar el ahorro económico.
   - Simulador mes a mes que calcula tu **Fecha de Libertad Financiera** (mes y año en que terminarás de pagar) y el ahorro estimado.

5. **📱 Acceso y Experiencia en Móvil (Celular):**
   - **Diseño Mobile-First:** Barra de navegación inferior táctil, botones de tamaño óptimo para dedos y tarjetas legibles.
   - **PWA (Progressive Web App):** Puedes añadirla a la pantalla de inicio de tu smartphone (en Chrome o Safari) para usarla como una aplicación nativa.
   - **Código QR Integrado:** Botón en la cabecera que muestra un código QR en pantalla para escanear y abrir la app al instante desde tu celular en la misma red Wi-Fi.

6. **Privacidad y Seguridad de Datos:**
   - Los datos se guardan en tu propio navegador mediante **IndexedDB** (con respaldo en LocalStorage).
   - **Respaldo JSON descargable:** Puedes exportar tu información en cualquier momento para guardarla o transferirla entre tu PC y tu teléfono.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con el servidor local (Recomendado para PC y Celular)
Desde la terminal, ejecuta:

```bash
cd /home/dxmniel/.gemini/antigravity/scratch/gestor-finanzas-deudas
./start.sh
# o también:
python3 server.py
```

La terminal te mostrará las direcciones:
- 💻 **En tu PC:** Abre tu navegador en `http://localhost:8080`
- 📱 **En tu Celular:** Conéctate al mismo Wi-Fi y abre la dirección `http://<IP_LOCAL>:8080` (también puedes hacer clic en el botón de teléfono en la app para ver el código QR).

### Opción 2: Apertura directa
Puedes abrir directamente el archivo `index.html` con cualquier navegador web (Chrome, Firefox, Edge, Brave, Safari).

---

## 📱 Cómo instalar en tu teléfono (PWA)

1. Abre la dirección en el navegador de tu celular (Google Chrome en Android o Safari en iPhone).
2. **En Android (Chrome):** Toca los 3 puntos de la esquina superior derecha y selecciona **"Añadir a la pantalla de inicio"** o **"Instalar aplicación"**.
3. **En iPhone (Safari):** Toca el botón Compartir (el ícono del recuadro con la flecha hacia arriba) y selecciona **"Añadir a pantalla de inicio"**.
4. ¡Listo! Tendrás el ícono de **DeudaCero** en la pantalla de tu móvil y funcionará incluso sin internet gracias al Service Worker y almacenamiento local.
