// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, transactionsAPI } from '../services/api';
import { formatCurrency, formatMonthYear, currentMonthYear } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

// Cotización del dólar desde dolarapi.com
async function fetchDolarRate() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue');
    const data = await res.json();
    return { compra: data.compra, venta: data.venta, source: 'blue' };
  } catch {
    try {
      const res2 = await fetch('https://dolarapi.com/v1/dolares/oficial');
      const data2 = await res2.json();
      return { compra: data2.compra, venta: data2.venta, source: 'oficial' };
    } catch {
      return null;
    }
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [savingsSummary, setSavingsSummary] = useState(null);
  const [dolar, setDolar] = useState(null);
  const [loading, setLoading] = useState(true);
  const month = currentMonthYear();

  useEffect(() => {
    Promise.all([
      analyticsAPI.savingsProgress(month),
      analyticsAPI.monthlySummary(6),
      transactionsAPI.getSavingsSummary(month),
      fetchDolarRate(),
    ]).then(([p, m, s, d]) => {
      setProgress(p.data);
      setMonthly(m.data);
      setSavingsSummary(s.data);
      setDolar(d);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.name?.split(' ')[0] || '';

  const monthsWithData = monthly.filter(m => m.expenses > 0);
  const maxMonth = monthsWithData.reduce((max, m) => m.expenses > (max?.expenses || 0) ? m : max, null);
  const minMonth = monthsWithData.reduce((min, m) => m.expenses < (min?.expenses || Infinity) ? m : min, null);

  const usdSaved = parseFloat(savingsSummary?.total_usd || 0);
  const totalIncome = parseFloat(progress?.total_income || 0);
  const totalExpenses = parseFloat(progress?.total_expenses || 0);
  const saldo = totalIncome - totalExpenses;

  // Calcular cuánto equivale el saldo en dólares si hay cotización
  const saldoEnUSD = dolar && saldo > 0 ? (saldo / dolar.venta).toFixed(0) : null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <div className="loader" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 2 }}>{greeting}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            {firstName} 👋
          </h1>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {formatMonthYear(month)} · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dolar && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 14px', fontSize: '0.82rem',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>💵 Dólar {dolar.source}</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>${dolar.venta?.toLocaleString('es-AR')}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>venta</span>
            </div>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/import')}>⬆ Importar PDF</button>
          <button className="btn btn-primary" onClick={() => navigate('/transactions?new=1')}>+ Nueva</button>
        </div>
      </div>

      {/* Stats principales */}
      {progress && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {/* Ingresos */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '20px 22px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--green)', borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Ingresos</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.02em' }}>
              {formatCurrency(totalIncome, true)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{formatMonthYear(month)}</div>
          </div>

          {/* Gastos */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '20px 22px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--red)', borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Gastos</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: 'var(--red)', letterSpacing: '-0.02em' }}>
              {formatCurrency(totalExpenses, true)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{formatMonthYear(month)}</div>
          </div>

          {/* Saldo */}
          <div style={{
            background: 'var(--bg-card)', border: `1px solid ${saldo >= 0 ? 'rgba(34,211,165,0.25)' : 'rgba(255,92,125,0.25)'}`, borderRadius: 14,
            padding: '20px 22px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: saldo >= 0 ? 'var(--green)' : 'var(--red)', borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Saldo</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: saldo >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em' }}>
              {formatCurrency(Math.abs(saldo), true)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {saldo >= 0 ? '✅ Superávit' : '⚠️ Déficit'}
              {saldoEnUSD && saldo > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>≈ USD {saldoEnUSD}</span>}
            </div>
          </div>

          {/* Ahorrado en USD */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14,
            padding: '20px 22px', position: 'relative', overflow: 'hidden', cursor: 'pointer',
          }} onClick={() => navigate('/goals')}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f59e0b', borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              💵 Ahorrado (USD)
            </div>
            {usdSaved > 0 ? (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em' }}>
                  USD {usdSaved.toFixed(0)}
                </div>
                {savingsSummary?.total_ars > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatCurrency(savingsSummary.total_ars, true)} ARS
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Sin registros
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Ver objetivos →
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Progreso objetivo mensual */}
      {progress?.goal && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '18px 22px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {progress.goal_met ? '🏆 ' : '🎯 '}Meta del mes — {formatMonthYear(month)}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {formatCurrency(progress.actual_saved)} / {formatCurrency(progress.goal.target)}
            </span>
          </div>
          <div className="progress-bar" style={{ height: 10, borderRadius: 10 }}>
            <div className="progress-fill" style={{
              width: `${Math.min(100, progress.progress_percentage)}%`,
              background: progress.goal_met ? 'var(--green)' : progress.progress_percentage > 60 ? 'var(--accent)' : 'var(--yellow)',
              borderRadius: 10, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>{progress.progress_percentage}% completado</span>
            {!progress.goal_met && (
              <span>Faltan {formatCurrency(progress.goal.target - progress.actual_saved)} 💪</span>
            )}
          </div>
        </div>
      )}

      {/* Gráfico + comparativas */}
      {monthly.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 <span>Últimos 6 meses</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...monthly].reverse().map(m => {
                const maxExp = Math.max(...monthly.map(x => x.expenses), 1);
                const pct = (m.expenses / maxExp) * 100;
                const isMax = m.month === maxMonth?.month;
                return (
                  <div key={m.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {formatMonthYear(m.month)}
                      </span>
                      <span style={{ fontWeight: 600, color: isMax ? 'var(--red)' : 'var(--text)' }}>
                        {formatCurrency(m.expenses, true)}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-card2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: isMax ? 'var(--red)' : 'var(--accent)',
                        borderRadius: 6, transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              📈 <span>Comparativas</span>
            </div>

            {maxMonth && (
              <div style={{
                background: 'rgba(255,92,125,0.08)', border: '1px solid rgba(255,92,125,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Mes que más gastaron
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{formatMonthYear(maxMonth.month)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--red)' }}>
                  {formatCurrency(maxMonth.expenses)}
                </div>
              </div>
            )}

            {minMonth && minMonth.month !== maxMonth?.month && (
              <div style={{
                background: 'rgba(34,211,165,0.08)', border: '1px solid rgba(34,211,165,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Mes que menos gastaron
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{formatMonthYear(minMonth.month)}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--green)' }}>
                  {formatCurrency(minMonth.expenses)}
                </div>
              </div>
            )}

            {dolar && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  💵 Dólar {dolar.source} hoy
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Compra</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                      ${dolar.compra?.toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Venta</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
                      ${dolar.venta?.toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => navigate('/analytics')}>
              Ver análisis completo →
            </button>
          </div>
        </div>
      )}

      {/* CTAs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { icon: '⬆', title: 'Importar extracto', desc: 'Subí el PDF de tu banco', path: '/import', color: 'var(--accent)' },
          { icon: '💵', title: 'Gasto en efectivo', desc: 'Cargá gastos manuales', path: '/transactions?new=1', color: 'var(--green)' },
          { icon: '💰', title: 'Registrar ahorro', desc: 'Compra de dólares u otro ahorro', path: '/transactions?new=1', color: '#f59e0b' },
          { icon: '🎯', title: 'Objetivos', desc: 'Metas mensuales y anuales', path: '/goals', color: 'var(--red)' },
        ].map(cta => (
          <button key={cta.path + cta.title} onClick={() => navigate(cta.path)}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
              padding: '18px 18px', textAlign: 'left', cursor: 'pointer',
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = cta.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontSize: '1.4rem' }}>{cta.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cta.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{cta.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}