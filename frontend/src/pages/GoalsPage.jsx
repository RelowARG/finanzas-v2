// src/pages/GoalsPage.jsx
import React, { useEffect, useState } from 'react';
import { goalsAPI, transactionsAPI } from '../services/api';
import { formatCurrency, formatMonthYear, currentMonthYear, getMonthOptions } from '../utils/format';
import { useToast } from '../hooks/useToast';

const BADGES = [
  { streak: 1, emoji: '🌱', label: 'Primer mes' },
  { streak: 2, emoji: '🔥', label: 'En racha' },
  { streak: 3, emoji: '⚡', label: 'Consistente' },
  { streak: 6, emoji: '💎', label: 'Diamante' },
  { streak: 12, emoji: '👑', label: 'Maestro del ahorro' },
];

const currentYear = () => new Date().getFullYear().toString();

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    period_type: 'monthly',
    month_year: currentMonthYear(),
    year: currentYear(),
    target_amount: '',
    currency: 'USD',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingsSummary, setSavingsSummary] = useState({ total_usd: 0, total_ars: 0, count: 0 });
  const { toast, ToastContainer } = useToast();
  const monthOptions = getMonthOptions(24);

  // Años disponibles para objetivos anuales
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 1 + i;
    return { value: y.toString(), label: y.toString() };
  });

  const load = async () => {
    setLoading(true);
    try {
      const [goalsRes, savingsRes] = await Promise.all([
        goalsAPI.getAll(),
        transactionsAPI.getSavingsSummary(currentMonthYear()),
      ]);
      setGoals(goalsRes.data.goals || []);
      setStreak(goalsRes.data.streak || 0);
      setSavingsSummary(savingsRes.data || { total_usd: 0, total_ars: 0, count: 0 });
    } catch { toast.error('Error cargando objetivos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const currentBadge = BADGES.reduce((best, b) => streak >= b.streak ? b : best, BADGES[0]);

  const currentMonthlyGoal = goals.find(g => g.period_type === 'monthly' && g.month_year === currentMonthYear());
  const currentAnnualGoal = goals.find(g => g.period_type === 'annual' && g.month_year === currentYear());

  const usdSavedMonth = parseFloat(savingsSummary.total_usd || 0);
  const monthlyTarget = currentMonthlyGoal ? parseFloat(currentMonthlyGoal.target_amount) : 0;
  const monthlyProgress = monthlyTarget > 0 ? Math.round((usdSavedMonth / monthlyTarget) * 100) : 0;
  const monthlyMet = monthlyTarget > 0 && usdSavedMonth >= monthlyTarget;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.target_amount || parseFloat(form.target_amount) <= 0)
      return toast.error('Ingresá un monto válido');
    setSaving(true);
    try {
      const month_year = form.period_type === 'annual' ? form.year : form.month_year;
      await goalsAPI.save(month_year, form.target_amount, form.notes, form.period_type, form.currency);
      toast.success('Objetivo guardado');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando objetivo');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este objetivo?')) return;
    try {
      await goalsAPI.delete(id);
      toast.success('Objetivo eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const openEdit = (goal) => {
    setForm({
      period_type: goal.period_type,
      month_year: goal.period_type === 'monthly' ? goal.month_year : currentMonthYear(),
      year: goal.period_type === 'annual' ? goal.month_year : currentYear(),
      target_amount: goal.target_amount,
      currency: goal.currency || 'USD',
      notes: goal.notes || '',
    });
    setShowModal(true);
  };

  const formatGoalAmount = (goal) => {
    if (goal.currency === 'USD') return `USD ${parseFloat(goal.target_amount).toFixed(0)}`;
    return formatCurrency(goal.target_amount, true);
  };

  const formatSaved = (goal) => {
    if (goal.currency === 'USD') return `USD ${parseFloat(goal.actual_saved).toFixed(0)}`;
    return formatCurrency(goal.actual_saved, true);
  };

  const monthlyGoals = goals.filter(g => g.period_type === 'monthly');
  const annualGoals = goals.filter(g => g.period_type === 'annual');

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Objetivos de ahorro</h1>
          <p className="page-subtitle">Metas mensuales y anuales en ARS o USD</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setForm({ period_type: 'monthly', month_year: currentMonthYear(), year: currentYear(), target_amount: '', currency: 'USD', notes: '' });
          setShowModal(true);
        }}>+ Nuevo objetivo</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loader" /></div>
      ) : (
        <>
          {/* Racha + badges */}
          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            <div className="stat-card accent" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ fontSize: '3.5rem' }}>{currentBadge.emoji}</div>
              <div>
                <div className="stat-label">Racha actual</div>
                <div className="stat-value accent">{streak} {streak === 1 ? 'mes' : 'meses'}</div>
                <div className="stat-sub">{currentBadge.label}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div className="section-title" style={{ marginBottom: 12 }}>🏅 Insignias</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BADGES.map(b => (
                  <div key={b.streak} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    opacity: streak >= b.streak ? 1 : 0.25,
                    filter: streak >= b.streak ? 'none' : 'grayscale(1)',
                    transition: 'all 0.3s',
                  }}>
                    <div style={{ fontSize: '1.75rem' }}>{b.emoji}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Objetivo mensual actual */}
          {currentMonthlyGoal ? (
            <div className="card" style={{ marginBottom: 24, borderColor: monthlyMet ? 'var(--green)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 2 }}>
                    {monthlyMet ? '🏆 Meta cumplida!' : '🎯 Meta mensual'}
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
                      {formatMonthYear(currentMonthlyGoal.month_year)}
                    </span>
                  </div>
                  {currentMonthlyGoal.notes && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{currentMonthlyGoal.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(currentMonthlyGoal)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(currentMonthlyGoal.id)}>🗑</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>AHORRADO</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--green)' }}>
                    {formatSaved(currentMonthlyGoal)}
                  </div>
                  {currentMonthlyGoal.currency === 'USD' && savingsSummary.total_ars > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatCurrency(savingsSummary.total_ars, true)} ARS</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>META</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {formatGoalAmount(currentMonthlyGoal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>PROGRESO</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
                    {currentMonthlyGoal.progress_percentage}%
                  </div>
                </div>
              </div>
              <div className="progress-bar" style={{ height: 12 }}>
                <div className="progress-fill" style={{
                  width: `${Math.min(100, currentMonthlyGoal.progress_percentage)}%`,
                  background: monthlyMet ? 'var(--green)' : currentMonthlyGoal.progress_percentage > 60 ? 'var(--accent)' : 'var(--yellow)',
                }} />
              </div>
              {!monthlyMet && monthlyTarget > 0 && (
                <div style={{ marginTop: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Faltan <strong style={{ color: 'var(--text)' }}>
                    {currentMonthlyGoal.currency === 'USD'
                      ? `USD ${(monthlyTarget - usdSavedMonth).toFixed(0)}`
                      : formatCurrency(monthlyTarget - currentMonthlyGoal.actual_saved, true)}
                  </strong> para cumplir tu meta 💪
                </div>
              )}
              {savingsSummary.count === 0 && (
                <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Registrá compras de dólares desde Transacciones → Nueva → 💵 Ahorro
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 24, borderStyle: 'dashed', textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Sin meta mensual para {formatMonthYear(currentMonthYear())}</h3>
              <button className="btn btn-primary" onClick={() => {
                setForm({ period_type: 'monthly', month_year: currentMonthYear(), year: currentYear(), target_amount: '', currency: 'USD', notes: '' });
                setShowModal(true);
              }}>+ Fijar meta mensual</button>
            </div>
          )}

          {/* Objetivo anual */}
          {currentAnnualGoal ? (
            <div className="card" style={{ marginBottom: 24, borderColor: currentAnnualGoal.goal_met ? 'var(--green)' : 'rgba(245,158,11,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 2 }}>
                    {currentAnnualGoal.goal_met ? '🏆 Meta anual cumplida!' : '📅 Meta anual'} — {currentYear()}
                  </div>
                  {currentAnnualGoal.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{currentAnnualGoal.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(currentAnnualGoal)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(currentAnnualGoal.id)}>🗑</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>AHORRADO</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--green)' }}>
                    {formatSaved(currentAnnualGoal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>META ANUAL</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
                    {formatGoalAmount(currentAnnualGoal)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>PROGRESO</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
                    {currentAnnualGoal.progress_percentage}%
                  </div>
                </div>
              </div>
              <div className="progress-bar" style={{ height: 12 }}>
                <div className="progress-fill" style={{
                  width: `${Math.min(100, currentAnnualGoal.progress_percentage)}%`,
                  background: currentAnnualGoal.goal_met ? 'var(--green)' : '#f59e0b',
                }} />
              </div>
              {!currentAnnualGoal.goal_met && (
                <div style={{ marginTop: 10, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Faltan <strong style={{ color: 'var(--text)' }}>
                    {currentAnnualGoal.currency === 'USD'
                      ? `USD ${(parseFloat(currentAnnualGoal.target_amount) - parseFloat(currentAnnualGoal.actual_saved)).toFixed(0)}`
                      : formatCurrency(currentAnnualGoal.target_amount - currentAnnualGoal.actual_saved, true)}
                  </strong> para la meta anual
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 24, borderStyle: 'dashed', textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📅</div>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8, fontSize: '1rem' }}>Sin meta anual para {currentYear()}</h3>
              <button className="btn btn-ghost" onClick={() => {
                setForm({ period_type: 'annual', month_year: currentMonthYear(), year: currentYear(), target_amount: '', currency: 'USD', notes: '' });
                setShowModal(true);
              }}>+ Fijar meta anual</button>
            </div>
          )}

          {/* Historial */}
          {goals.length > 0 && (
            <div className="card">
              <div className="section-title">📋 Historial</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goals.map(g => (
                  <div key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'var(--bg-card2)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: `3px solid ${g.goal_met ? 'var(--green)' : g.progress_percentage > 0 ? 'var(--yellow)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: '1.25rem' }}>{g.goal_met ? '✅' : g.period_type === 'annual' ? '📅' : '⭕'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                          {g.period_type === 'annual' ? `${g.month_year} (anual)` : formatMonthYear(g.month_year)}
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {formatSaved(g)} / {formatGoalAmount(g)}
                          <span style={{ marginLeft: 8, fontWeight: 600, color: g.goal_met ? 'var(--green)' : 'var(--text)' }}>
                            {g.progress_percentage}%
                          </span>
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 4, marginTop: 6 }}>
                        <div className="progress-fill" style={{
                          width: `${Math.min(100, g.progress_percentage)}%`,
                          background: g.goal_met ? 'var(--green)' : g.period_type === 'annual' ? '#f59e0b' : 'var(--accent)',
                        }} />
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Nuevo objetivo de ahorro</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Tipo de período */}
              <div className="form-group">
                <label className="label">Tipo de objetivo</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    className={`btn ${form.period_type === 'monthly' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm(f => ({ ...f, period_type: 'monthly' }))}>
                    📆 Mensual
                  </button>
                  <button type="button"
                    className={`btn ${form.period_type === 'annual' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm(f => ({ ...f, period_type: 'annual' }))}>
                    📅 Anual
                  </button>
                </div>
              </div>

              {/* Período */}
              <div className="form-group">
                <label className="label">{form.period_type === 'annual' ? 'Año' : 'Mes'}</label>
                {form.period_type === 'annual' ? (
                  <select className="select" value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}>
                    {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <select className="select" value={form.month_year}
                    onChange={e => setForm(f => ({ ...f, month_year: e.target.value }))}>
                    {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>

              {/* Moneda */}
              <div className="form-group">
                <label className="label">Moneda</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button"
                    className={`btn ${form.currency === 'USD' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm(f => ({ ...f, currency: 'USD' }))}>
                    💵 Dólares (USD)
                  </button>
                  <button type="button"
                    className={`btn ${form.currency === 'ARS' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm(f => ({ ...f, currency: 'ARS' }))}>
                    🇦🇷 Pesos (ARS)
                  </button>
                </div>
              </div>

              {/* Monto */}
              <div className="form-group">
                <label className="label">
                  Meta de ahorro ({form.currency === 'USD' ? 'USD' : '$'})
                </label>
                <input type="number" className="input"
                  placeholder={form.currency === 'USD' ? 'Ej: 700' : 'Ej: 500000'}
                  min="1" step={form.currency === 'USD' ? '10' : '1000'}
                  value={form.target_amount}
                  onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
                  required autoFocus />
                {form.currency === 'USD' && form.period_type === 'monthly' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    El progreso se mide con las compras de dólares registradas en Transacciones
                  </span>
                )}
                {form.currency === 'USD' && form.period_type === 'annual' && form.target_amount && (
                  <span style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: 4, display: 'block' }}>
                    ≈ USD {(parseFloat(form.target_amount) / 12).toFixed(0)}/mes para llegar a la meta
                  </span>
                )}
              </div>

              {/* Nota */}
              <div className="form-group">
                <label className="label">Nota (opcional)</label>
                <input type="text" className="input" placeholder="Para qué estás ahorrando..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
                  {saving ? <><span className="spin">◌</span> Guardando...</> : 'Guardar objetivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}