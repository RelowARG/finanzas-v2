// pages/ImportPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdfAPI, transactionsAPI, categoriesAPI } from '../services/api';
import { useToast } from '../hooks/useToast';

const BANKS = ['Galicia', 'Mercado Pago', 'ICBC', 'American Express', 'UALA', 'Otro'];
const CONFIDENCE_LABELS = { high: 'Alta confianza', medium: 'Media', low: 'Baja' };
const CONFIDENCE_COLORS = { high: 'var(--green)', medium: '#f59e0b', low: 'var(--red)' };

export default function ImportPage() {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  const [step, setStep] = useState(1);
  const [selectedBank, setSelectedBank] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState({});
  const [categories, setCategories] = useState([]);
  const [txCategories, setTxCategories] = useState({});
  const [globalDate, setGlobalDate] = useState('');
  const [dueDateDetected, setDueDateDetected] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (f && f.type === 'application/pdf') setFile(f);
    else showToast('Solo se aceptan archivos PDF', 'error');
  };

  const handleAnalyze = async () => {
    if (!selectedBank) return showToast('Seleccioná un banco', 'error');
    if (!file) return showToast('Seleccioná un PDF', 'error');
    setLoading(true);
    try {
      const [pdfResponse, catsResponse] = await Promise.all([
        pdfAPI.parse(file, selectedBank),
        categoriesAPI.getAll(),
      ]);
      const pdfResult = pdfResponse?.data || pdfResponse;
      const cats = catsResponse?.data || catsResponse || [];
      const txs = pdfResult?.transactions || [];
      const due = pdfResult?.due_date || null;
      setTransactions(txs);
      setCategories(cats);
      if (due) { setGlobalDate(due); setDueDateDetected(true); }
      else { setGlobalDate(''); setDueDateDetected(false); }
      const initSelected = {}, initCats = {};
      txs.forEach((t, i) => { initSelected[i] = true; initCats[i] = t.category_id || ''; });
      setSelected(initSelected);
      setTxCategories(initCats);
      setStep(2);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Error al procesar el PDF', 'error');
    } finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!globalDate) return showToast('Ingresá la fecha de registro', 'error');
    const toImport = transactions.filter((_, i) => selected[i]).map((t, i) => ({
      date: globalDate, description: t.description, amount: t.amount,
      type: t.type, category_id: txCategories[i] || null, source: 'pdf', bank: selectedBank,
    }));
    if (toImport.length === 0) return showToast('Seleccioná al menos una transacción', 'error');
    setLoading(true);
    try {
      await transactionsAPI.bulkCreate(toImport);
      setImportedCount(toImport.length);
      setStep(3);
    } catch (err) {
      showToast('Error al importar las transacciones', 'error');
    } finally { setLoading(false); }
  };

  const toggleAll = (val) => {
    const next = {};
    transactions.forEach((_, i) => { next[i] = val; });
    setSelected(next);
  };

  const formatAmount = (amount, type) => {
    const num = parseFloat(amount);
    const formatted = num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return type === 'income' ? `+$ ${formatted}` : `-$ ${formatted}`;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-');
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <ToastContainer />
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>
        Importar extracto bancario
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Subí el PDF de tu banco y los gastos se cargan automáticamente
      </p>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {[{ n: 1, label: 'Subir PDF' }, { n: 2, label: 'Revisar' }, { n: 3, label: 'Listo' }].map(({ n, label }, idx) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
              background: step > n ? 'var(--green)' : step === n ? 'var(--accent)' : 'var(--bg-card)',
              color: step >= n ? '#fff' : 'var(--text-muted)',
              border: step < n ? '1px solid var(--border)' : 'none',
            }}>
              {step > n ? '✓' : n}
            </div>
            <span style={{ fontSize: '0.85rem', color: step >= n ? 'var(--text)' : 'var(--text-muted)', fontWeight: step === n ? 600 : 400 }}>
              {label}
            </span>
            {idx < 2 && <div style={{ flex: 1, height: 1, background: step > n ? 'var(--green)' : 'var(--border)', marginLeft: '0.5rem' }} />}
          </div>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>1. Seleccioná tu banco</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {BANKS.map(b => (
              <button key={b} onClick={() => setSelectedBank(b)} style={{
                padding: '0.4rem 1rem', borderRadius: 8, border: '1px solid',
                borderColor: selectedBank === b ? 'var(--accent)' : 'var(--border)',
                background: selectedBank === b ? 'rgba(108,99,255,0.15)' : 'transparent',
                color: selectedBank === b ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer', fontWeight: selectedBank === b ? 600 : 400, transition: 'all 0.15s',
              }}>{b}</button>
            ))}
          </div>

          <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>2. Subí el PDF</p>
          <label onDrop={handleDrop} onDragOver={e => e.preventDefault()} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.75rem', padding: '2.5rem', borderRadius: 12, cursor: 'pointer',
            border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
            background: file ? 'rgba(108,99,255,0.08)' : 'transparent', transition: 'all 0.2s',
          }}>
            <input type="file" accept=".pdf" onChange={handleDrop} style={{ display: 'none' }} />
            <span style={{ fontSize: '2.5rem' }}>📄</span>
            {file ? (
              <>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{file.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(file.size / 1024).toFixed(0)} KB · Clic para cambiar</span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 500 }}>Arrastrá el PDF o hacé clic para seleccionar</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Máximo 20MB</span>
              </>
            )}
          </label>

          <button onClick={handleAnalyze} disabled={loading || !file || !selectedBank} className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', padding: '0.9rem', fontSize: '1rem', opacity: (!file || !selectedBank) ? 0.5 : 1 }}>
            {loading ? '⏳ Analizando con IA...' : '⚡ Analizar PDF'}
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div>
          {/* Campo global de fecha */}
          <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 220 }}>
                <span style={{ fontSize: '1.2rem' }}>📅</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>Fecha de registro</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.1rem 0 0' }}>
                    {dueDateDetected ? 'Detectada automáticamente — podés cambiarla si es necesario' : 'No detectada — ingresála manualmente'}
                  </p>
                </div>
              </div>
              <input type="date" value={globalDate} onChange={e => setGlobalDate(e.target.value)} style={{
                background: 'var(--bg)', border: `1px solid ${globalDate ? 'var(--accent)' : 'var(--red)'}`,
                borderRadius: 8, color: 'var(--text)', padding: '0.5rem 0.75rem',
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', outline: 'none', minWidth: 160,
              }} />
            </div>
            {globalDate && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 0', paddingLeft: '1.8rem' }}>
                Todas las transacciones se registrarán el <strong style={{ color: 'var(--accent)' }}>{formatDateDisplay(globalDate)}</strong>
              </p>
            )}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>{selectedCount} de {transactions.length} transacciones seleccionadas</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-ghost" onClick={() => toggleAll(true)} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>Seleccionar todo</button>
              <button className="btn btn-ghost" onClick={() => toggleAll(false)} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>Deseleccionar todo</button>
              <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>← Volver</button>
            </div>
          </div>

          {/* Lista */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {transactions.map((t, i) => (
              <div key={i} className="card" style={{
                padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                opacity: selected[i] ? 1 : 0.45, transition: 'all 0.15s',
              }}>
                <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.description}</span>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 20, fontWeight: 600,
                      color: CONFIDENCE_COLORS[t.confidence] || 'var(--text-muted)',
                      border: `1px solid ${CONFIDENCE_COLORS[t.confidence] || 'var(--border)'}`,
                    }}>
                      {CONFIDENCE_LABELS[t.confidence] || t.confidence}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {globalDate ? formatDateDisplay(globalDate) : 'Sin fecha asignada'}
                  </span>
                </div>
                <select value={txCategories[i] || ''} onChange={e => setTxCategories(c => ({ ...c, [i]: e.target.value }))} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--text)', padding: '0.3rem 0.5rem', fontSize: '0.82rem', maxWidth: 160, cursor: 'pointer',
                }}>
                  <option value="">Sin categoría</option>
                  {categories.filter(c => c.type === t.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span style={{
                  fontWeight: 700, fontSize: '0.95rem', flexShrink: 0, minWidth: 90, textAlign: 'right',
                  color: t.type === 'income' ? 'var(--green)' : 'var(--red)',
                }}>
                  {formatAmount(t.amount, t.type)}
                </span>
              </div>
            ))}
          </div>

          <button onClick={handleImport} disabled={loading || selectedCount === 0 || !globalDate} className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', opacity: (selectedCount === 0 || !globalDate) ? 0.5 : 1 }}>
            {loading ? '⏳ Importando...' : `✓ Importar ${selectedCount} transacciones`}
          </button>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            ¡Importación exitosa!
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Se importaron <strong style={{ color: 'var(--green)' }}>{importedCount} transacciones</strong> de {selectedBank}
          </p>
          {globalDate && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
              Registradas el <strong style={{ color: 'var(--accent)' }}>{formatDateDisplay(globalDate)}</strong>
            </p>
          )}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => { setStep(1); setFile(null); setSelectedBank(''); setGlobalDate(''); setDueDateDetected(false); }}>
              Importar otro extracto
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/transactions')}>
              Ver transacciones →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}