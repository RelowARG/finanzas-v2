// services/gemini.service.js
const https = require('https');

// Instrucciones específicas por banco para ayudar a Gemini a parsear mejor
const BANK_INSTRUCTIONS = {
  'Galicia': `
- Formato: columnas FECHA | REFERENCIA | CUOTA | COMPROBANTE | PESOS | DÓLARES
- Las filas con asterisco (*) son cuotas de compras anteriores
- Las filas con K son compras en un pago
- Las filas con F/E son consumos en moneda extranjera (dólares/euros)
- Los montos negativos (ej: -20.085,49) son devoluciones → type: "income"
- "SU PAGO EN PESOS" y "SU PAGO EN USD" → type: "income"
- IIBB PERCEP, IVA RG 4240, DB.RG 5617 → type: "expense"
- Usar la fecha real de cada transacción, NO la fecha de vencimiento
`,
  'ICBC': `
- Formato: FECHA | COMPROBANTE | REFERENCIA | MONTO_PESOS | MONTO_USD
- Las fechas aparecen como "25 Octubre", "25 Junio", etc.
- "SU PAGO EN PESOS" → type: "income", monto negativo en el PDF = positivo en JSON
- "TRANSFERENCIA DEUDA" con TC seguido de monto → es una conversión de deuda en USD a pesos
- WIX.COM, Google GSUITE → Suscripciones/Tecnología
- LACAJASEGURO → Hogar (seguro)
- CHEVROLET → Transporte o Hogar (seguro de auto)
- IMP DE SELLOS, INTERESES FINANCIACION, DB IVA, IIBB PERCEP, IVA RG, DB.RG → type: "expense"
- Usar la fecha real de cada transacción
`,
  'American Express': `
- Formato: "DD de Mes  Monto\\nDESCRIPCION\\nREFERENCIA"
- "ACREDITACION DE VUESTRO PAGO" → type: "income"  
- "INTERESES PUNITORIOS", "INTERESES FINANCIEROS", "IVA 21%", "Percepción Ingresos Brutos" → type: "expense"
- Las cuotas (CUOTA XX/YY DE monto_original) → usar el monto de la cuota, NO el total
- Usar la fecha real de cada transacción
`,
  'Mercado Pago': `
- Identificar ingresos (acreditaciones, devoluciones) vs gastos (pagos, consumos)
- CVU transfers pueden ser income o expense según contexto
`,
  'default': `
- Identificar cada fila con fecha y monto como una transacción separada
- Pagos al banco/tarjeta → type: "income"
- Compras y gastos → type: "expense"
- Usar la fecha real de cada transacción
`
};

class GeminiService {
  constructor() {
    const keysRaw = process.env.GEMINI_API_KEYS || '';
    this.keys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
    this.currentIndex = 0;

    if (this.keys.length === 0) {
      console.warn('[Gemini] ⚠️  No hay API keys configuradas en GEMINI_API_KEYS');
    } else {
      console.log(`[Gemini] ✅ ${this.keys.length} API key(s) cargadas para rotación`);
    }
  }

  getCurrentKey() {
    return this.keys[this.currentIndex];
  }

  rotateKey() {
    const oldIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    console.log(`[Gemini] 🔄 Rotando key ${oldIndex + 1} → ${this.currentIndex + 1} (de ${this.keys.length})`);
    return this.keys[this.currentIndex];
  }

  async callGemini(prompt, retries = 0) {
    if (this.keys.length === 0) throw new Error('No hay API keys de Gemini configuradas');

    const key = this.getCurrentKey();
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536
      }
    });

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode === 429) {
              if (retries < this.keys.length - 1) {
                this.rotateKey();
                return resolve(await this.callGemini(prompt, retries + 1));
              }
              return reject(new Error('Cuota agotada en todas las keys configuradas'));
            }

            if (res.statusCode !== 200) {
              return reject(new Error(`Error ${res.statusCode}: ${parsed.error?.message || 'Error de Gemini'}`));
            }

            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return reject(new Error('La IA devolvió una respuesta vacía'));

            resolve(text);
          } catch (e) {
            reject(new Error(`Error al procesar respuesta de Gemini: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Error de red: ${e.message}`)));
      req.write(body);
      req.end();
    });
  }

  async detectDueDate(pdfText) {
    const prompt = `Del siguiente texto de un extracto bancario argentino, extraé ÚNICAMENTE la fecha de vencimiento actual del resumen (la fecha en que se debe pagar).

Devolvé SOLO una fecha en formato YYYY-MM-DD, sin ningún texto adicional, sin espacios, sin puntos.
Si no encontrás la fecha, devolvé exactamente: null

Ejemplos de formatos que podés encontrar:
- "Vencimiento actual 06-Feb-26" → 2026-02-06
- "Vto: 06/02/2026" → 2026-02-06
- "VENCIMIENTO 04 Nov 25" → 2025-11-04
- "Vencimiento Actual 05-Dic-25" → 2025-12-05
- "27/11/25" después de "Vencimiento Actual" → 2025-11-27

Meses en español: Ene=01, Feb=02, Mar=03, Abr=04, May=05, Jun=06, Jul=07, Ago=08, Sep/Set=09, Oct=10, Nov=11, Dic=12

TEXTO (primeras 2000 chars):
${pdfText.substring(0, 2000)}`;

    try {
      const response = await this.callGemini(prompt);
      const cleaned = response.trim();
      // Aceptar formato YYYY-MM-DD directamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        console.log(`[Gemini] 📅 Fecha de vencimiento detectada: ${cleaned}`);
        return cleaned;
      }
      // Intentar extraer solo la fecha si hay texto extra
      const match = cleaned.match(/\d{4}-\d{2}-\d{2}/);
      if (match) {
        console.log(`[Gemini] 📅 Fecha de vencimiento detectada: ${match[0]}`);
        return match[0];
      }
      console.warn('[Gemini] ⚠️ No se pudo detectar fecha de vencimiento. Respuesta:', cleaned);
      return null;
    } catch (e) {
      console.warn('[Gemini] ⚠️ Error detectando fecha:', e.message);
      return null;
    }
  }

  /**
   * Divide el texto en chunks respetando líneas completas.
   * Intenta no cortar transacciones a la mitad agregando overlap de líneas.
   */
  splitIntoChunks(pdfText, maxChunkLength = 12000, overlapLines = 5) {
    const lines = pdfText.split('\n');
    const chunks = [];
    let currentChunk = '';
    let currentLines = [];

    for (const line of lines) {
      if ((currentChunk.length + line.length + 1) > maxChunkLength && currentChunk.length > 0) {
        chunks.push(currentChunk);
        // Overlap: repetir las últimas N líneas en el siguiente chunk para no perder contexto
        const overlapStart = Math.max(0, currentLines.length - overlapLines);
        currentLines = currentLines.slice(overlapStart);
        currentChunk = currentLines.join('\n') + '\n';
      }
      currentLines.push(line);
      currentChunk += line + '\n';
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);

    return chunks;
  }

  async parseBankPDF(pdfText, bankName = 'desconocido') {
    // 1. Detectar fecha de vencimiento
    const dueDate = await this.detectDueDate(pdfText);

    // 2. Dividir en chunks con overlap
    const chunks = this.splitIntoChunks(pdfText);
    console.log(`[Gemini] 📄 PDF dividido en ${chunks.length} partes para extraer el 100%.`);

    // Instrucciones específicas del banco
    const bankInstructions = BANK_INSTRUCTIONS[bankName] || BANK_INSTRUCTIONS['default'];

    let allTransactions = [];
    const seenKeys = new Set(); // Para deduplicar transacciones que aparecen en el overlap

    // 3. Extraer transacciones por chunk
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Gemini] ⏳ Procesando parte ${i + 1} de ${chunks.length}...`);

      const prompt = `Sos un experto financiero analizando un extracto bancario argentino del banco "${bankName}".
Extraé TODAS las transacciones de este fragmento. Contexto: Argentina, pesos y dólares.

INSTRUCCIONES ESPECÍFICAS PARA ${bankName.toUpperCase()}:
${bankInstructions}

REGLAS GENERALES:
- Responde ÚNICAMENTE con el array JSON, sin bloques de código, sin texto antes ni después.
- Extraé CADA fila que tenga fecha y monto: consumos, pagos, devoluciones, impuestos (IIBB, IVA, DB.RG, percepciones).
- Los montos son SIEMPRE positivos en el JSON. Si en el PDF aparece negativo (devolución/pago), ponelo como "income".
- Formato de montos argentinos: 37.566,33 → 37566.33 (punto = separador miles, coma = decimales)
- Fechas en formato YYYY-MM-DD usando las fechas REALES del texto (NO usar la fecha de vencimiento).
- Si el chunk tiene overlap con el anterior, no duplicar transacciones que ya vienen del final.
- Categorías (exactamente así, sin emojis): Supermercado, Restaurantes, Transporte, Combustible, Salud, Farmacia, Ropa, Entretenimiento, Servicios, Educación, Viajes, Hogar, Tecnología, Delivery, Suscripciones, Efectivo / Varios, Sueldo, Freelance, Inversiones, Otros ingresos, Impuestos y cargos.

Formato de cada transacción:
{ "date": "YYYY-MM-DD", "description": "...", "amount": 0.0, "type": "expense|income", "suggested_category": "...", "confidence": "high|medium|low" }

TEXTO (parte ${i + 1} de ${chunks.length}):
${chunks[i]}`;

      const response = await this.callGemini(prompt);

      console.log(`[Gemini] RAW parte ${i + 1} (primeros 300 chars):`, response.substring(0, 300));

      try {
        let cleanResponse = response.replace(/```json|```/g, "").trim();
        const jsonStart = cleanResponse.indexOf('[');

        if (jsonStart !== -1) {
          let jsonString = cleanResponse.substring(jsonStart);

          if (!jsonString.endsWith(']')) {
            const lastValidBrace = jsonString.lastIndexOf('}');
            if (lastValidBrace !== -1) {
              jsonString = jsonString.substring(0, lastValidBrace + 1) + ']';
            } else {
              jsonString = '[]';
            }
          }

          const transactions = JSON.parse(jsonString);

          // Deduplicar usando date+description+amount como clave
          const newTxs = transactions.filter(t => {
            const key = `${t.date}|${t.description}|${t.amount}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          allTransactions = allTransactions.concat(newTxs);
          console.log(`[Gemini] ✅ Extraídas ${newTxs.length} transacciones nuevas (${transactions.length - newTxs.length} duplicadas) de la parte ${i + 1}`);
        } else {
          console.warn(`[Gemini] ⚠️ No se detectaron transacciones en la parte ${i + 1}`);
          console.log(`[Gemini] RAW completo parte ${i + 1}:`, response);
        }
      } catch (e) {
        console.error(`[Gemini] ❌ Error de parseo en la parte ${i + 1}:`, e.message);
        console.log(`[Gemini] RAW con error:`, response.substring(0, 500));
      }
    }

    // 4. NO reemplazar las fechas individuales — cada transacción mantiene su fecha real.
    // El dueDate se devuelve al frontend para que el usuario elija si quiere usarlo como
    // fecha de registro, pero las fechas de las transacciones reflejan cuándo ocurrieron.

    console.log(`[Gemini] 🎯 Total: ${allTransactions.length} transacciones.`);
    return { transactions: allTransactions, dueDate };
  }

  async analyzeSpending(spendingData) {
    const prompt = `Sos un asesor financiero personal para una familia argentina.
Analizá estos datos de gastos y generá insights útiles y accionables. Tené en cuenta el contexto económico de Argentina.

DATOS:
${JSON.stringify(spendingData, null, 2)}

Devolvé ÚNICAMENTE un objeto JSON válido sin bloques de código (sin \`\`\`json) con esta estructura:
{
  "top_insights": [
    { "title": "...", "description": "...", "type": "warning|tip|achievement", "category": "..." }
  ],
  "saving_opportunities": [
    { "category": "...", "potential_monthly_saving": 0, "suggestion": "..." }
  ],
  "summary": "..."
}

Máximo 4 insights y 3 oportunidades de ahorro. Sé específico con los montos en pesos argentinos.`;

    const response = await this.callGemini(prompt);

    try {
      const cleanResponse = response.replace(/```json|```/g, "").trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}') + 1;
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd);
      return JSON.parse(jsonString);
    } catch (e) {
      console.error("[Gemini] Falló el parseo de insights. Respuesta:", response);
      throw new Error('No se encontró un objeto JSON de insights válido');
    }
  }
}

module.exports = new GeminiService();