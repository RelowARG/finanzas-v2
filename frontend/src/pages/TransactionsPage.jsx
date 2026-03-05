// src/pages/TransactionsPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { transactionsAPI, categoriesAPI } from '../services/api';
import { formatCurrency, formatDate, currentMonthYear, getMonthOptions } from '../utils/format';
import { useToast } from '../hooks/useToast';

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  type: 'expense',
  category_id: '',
  notes: '',
  usd_amount: '',
  exchange_rate: '',
  currency: 'ARS',
};

export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [month, setMonth] = useState(currentMonthYear());
  const [typeFilter, setTypeFilter] = useState('');
  const [savingsSummary, setSavingsSummary] = useState({ total_usd: 0, total_ars: 0 });
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tx, cats, savRes] = await Promise.all([
        transactionsAPI.getAll({ month, type: typeFilter || undefined }),
        categoriesAPI.getAll(),
        transactionsAPI.getSavingsSummary(month),
      ]);
      setTransactions(tx.data.transactions || []);
      setCategories(cats.data);
      setSavingsSummary(savRes.data || { total_usd: 0, total_ars: 0 });
    } catch { toast.error('Error cargando transacciones'); }
    finally { setLoading(false); }
  }, [month, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };
  const openEdit = (tx) => {
    setForm({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category_id: tx.category_id || '',
      notes: tx.notes || '',
      usd_amount: tx.usd_amount || '',
      exchange_rate: tx.exchange_rate || '',
      currency: tx.usd_amount && tx.type !== 'savings' ? 'USD' : 'ARS',
    });
    setEditId(tx.id);
    setShowModal(true);
  };

  // Al cambiar tipo a savings, limpiar category_id
  const setType = (t) => {
    setForm(f => ({ ...f, type: t, category_id: '', usd_amount: '', exchange_rate: '', currency: 'ARS' }));
  };

  // Auto-calcular ARS cuando cambian USD o tipo de cambio
  const handleUsdChange = (usd) => {
    setForm(f => {
      const ars = f.exchange_rate && usd ? (parseFloat(usd) * parseFloat(f.exchange_rate)).toFixed(2) : f.amount;
      return { ...f, usd_amount: usd, amount: ars };
    });
  };

  const handleExchangeRateChange = (rate) => {
    setForm(f => {
      const ars = f.usd_amount && rate ? (parseFloat(f.usd_amount) * parseFloat(rate)).toFixed(2) : f.amount;
      return { ...f, exchange_rate: rate, amount: ars };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.date) return toast.error('Completá todos los campos');
    if (form.type === 'savings' && !form.usd_amount) return toast.error('Ingresá la cantidad de dólares');
    if (form.type === 'savings' && !form.exchange_rate) return toast.error('Ingresá el tipo de cambio');
    setSaving(true);
    try {
      const isSavings = form.type === 'savings';
      const isUSD = form.currency === 'USD' && !isSavings;
      const payload = {
        ...form,
        usd_amount: isSavings ? form.usd_amount : isUSD ? form.amount : null,
        exchange_rate: isSavings ? form.exchange_rate : null,
      };
      if (editId) {
        await transactionsAPI.update(editId, payload);
        toast.success('Transacción actualizada');
      } else {
        await transactionsAPI.create({ ...payload, source: 'manual' });
        toast.success('Transacción guardada');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await transactionsAPI.delete(id);
      toast.success('Eliminada');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const filteredCats = categories.filter(c => c.type === form.type);
  const monthOptions = getMonthOptions(12);

  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);

  const typeLabel = (type) => {
    if (type === 'income') return { label: '↑ Ingreso', color: 'var(--green)' };
    if (type === 'savings') return { label: '💵 Ahorro', color: '#f59e0b' };
    return { label: '↓ Gasto', color: 'var(--red)' };
  };

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Transacciones</h1>
          <p className="page-subtitle">Todos tus movimientos</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Todos</option>
          <option value="expense">Solo gastos</option>
          <option value="income">Solo ingresos</option>
          <option value="savings">Solo ahorros</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: '0.875rem', flexWrap: 'wrap' }}>
          <span className="amount-negative">Gastos: {formatCurrency(totalExpenses, true)}</span>
          <span className="amount-positive">Ingresos: {formatCurrency(totalIncome, true)}</span>
          {savingsSummary.total_usd > 0 && (
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
              💵 Ahorrado: USD {parseFloat(savingsSummary.total_usd).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="loader" style={{ margin: '0 auto' }} /></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💸</div>
            <h3>Sin transacciones</h3>
            <p>Importá un PDF o cargá una transacción manual</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Origen</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {formatDate(tx.date)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{tx.description}</div>
                      {tx.type === 'savings' && tx.usd_amount && (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                          USD {parseFloat(tx.usd_amount).toFixed(2)} @ ${parseFloat(tx.exchange_rate).toLocaleString('es-AR')}
                        </div>
                      )}
                      {tx.type !== 'savings' && tx.usd_amount && (
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600 }}>
                          💵 USD {parseFloat(tx.usd_amount).toFixed(2)}
                        </div>
                      )}
                      {tx.bank && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.bank}</div>}
                    </td>
                    <td>
                      {tx.type === 'savings' ? (
                        <span style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>💵 Dólares</span>
                      ) : tx.Category ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
                          <span>{tx.Category.icon}</span> {tx.Category.name}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`tag ${tx.source === 'pdf' ? 'tag-pdf' : 'tag-manual'}`}>
                        {tx.source === 'pdf' ? '⬆ PDF' : '✏ Manual'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: typeLabel(tx.type).color, fontWeight: 600 }}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tx)}>✏</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editId ? 'Editar transacción' : 'Nueva transacción'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tipo */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  className={`btn ${form.type === 'expense' ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ flex: 1 }} onClick={() => setType('expense')}>
                  ↓ Gasto
                </button>
                <button type="button"
                  className={`btn ${form.type === 'income' ? 'btn-success' : 'btn-ghost'}`}
                  style={{ flex: 1 }} onClick={() => setType('income')}>
                  ↑ Ingreso
                </button>
                <button type="button"
                  className={`btn ${form.type === 'savings' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, borderColor: form.type === 'savings' ? '#f59e0b' : undefined, background: form.type === 'savings' ? 'rgba(245,158,11,0.15)' : undefined, color: form.type === 'savings' ? '#f59e0b' : undefined }}
                  onClick={() => setType('savings')}>
                  💵 Ahorro
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="label">
                    {form.type === 'savings' ? 'Total ARS (calculado)' : 'Monto'}
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {form.type !== 'savings' && (
                      <select
                        value={form.currency}
                        onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        style={{
                          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                          color: form.currency === 'USD' ? '#60a5fa' : 'var(--text)',
                          padding: '0 8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    )}
                    <input type="number" className="input" placeholder="0" step="0.01" min="0"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      readOnly={form.type === 'savings' && !!form.usd_amount && !!form.exchange_rate}
                      style={{ opacity: form.type === 'savings' && form.usd_amount && form.exchange_rate ? 0.6 : 1 }}
                      required />
                  </div>
                </div>
              </div>

              {/* Indicador moneda USD para gastos/ingresos */}
              {form.type !== 'savings' && form.currency === 'USD' && (
                <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(96,165,250,0.08)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', fontSize: '0.82rem', color: '#60a5fa' }}>
                  💵 Esta transacción se guardará en dólares. El monto en ARS se puede calcular después.
                </div>
              )}

              {/* Campos extra para savings */}
              {form.type === 'savings' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Dólares comprados (USD)</label>
                    <input type="number" className="input" placeholder="700" step="0.01" min="0"
                      value={form.usd_amount} onChange={e => handleUsdChange(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label">Tipo de cambio (ARS/USD)</label>
                    <input type="number" className="input" placeholder="1200" step="1" min="0"
                      value={form.exchange_rate} onChange={e => handleExchangeRateChange(e.target.value)} required />
                  </div>
                  {form.usd_amount && form.exchange_rate && (
                    <div style={{ gridColumn: '1 / -1', fontSize: '0.82rem', color: '#f59e0b' }}>
                      = ${(parseFloat(form.usd_amount) * parseFloat(form.exchange_rate)).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="label">Descripción</label>
                <input type="text" className="input"
                  placeholder={form.type === 'savings' ? 'Ej: Compra dólares marzo' : form.type === 'income' ? 'Ej: Sueldo febrero' : '¿En qué gastaste?'}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>

              {form.type !== 'savings' && (
                <div className="form-group">
                  <label className="label">Categoría</label>
                  <select className="select" value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {filteredCats.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="label">Notas (opcional)</label>
                <input type="text" className="input" placeholder="Cualquier aclaración..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
                  {saving ? <><span className="spin">◌</span> Guardando...</> : (editId ? 'Guardar cambios' : 'Agregar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}