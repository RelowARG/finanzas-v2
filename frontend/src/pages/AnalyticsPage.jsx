// src/pages/AnalyticsPage.jsx
import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../services/api';
import { formatCurrency, formatMonthYear, currentMonthYear, getMonthOptions } from '../utils/format';
import { useToast } from '../hooks/useToast';

export default function AnalyticsPage() {
  const [month, setMonth] = useState(currentMonthYear());
  const [categoryData, setCategoryData] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast, ToastContainer } = useToast();
  const monthOptions = getMonthOptions(12);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsAPI.byCategory(month),
      analyticsAPI.monthlySummary(6),
    ]).then(([cat, mon]) => {
      setCategoryData(cat.data);
      setMonthly(mon.data);
    }).catch(() => toast.error('Error cargando datos'))
      .finally(() => setLoading(false));
  }, [month]);

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await analyticsAPI.insights(3);
      setInsights(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error generando insights');
    } finally { setLoadingInsights(false); }
  };

  const maxMonthExpense = Math.max(...monthly.map(m => m.expenses), 1);
  const sortedMonths = [...monthly].sort((a, b) => b.expenses - a.expenses);
  const worstMonth = sortedMonths[0];
  const bestMonth = sortedMonths[sortedMonths.length - 1];

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <div>
          <h1 className="page-title">Análisis de gastos</h1>
          <p className="page-subtitle">Entendé en qué gastás y dónde podés mejorar</p>
        </div>
        <select className="select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loader" /></div>
      ) : (
        <>
          {/* Resumen mensual */}
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            {[...monthly].slice(-4).map(m => (
              <div key={m.month} className="stat-card" style={{ borderTop: `2px solid ${m.month === month ? 'var(--accent)' : 'var(--border)'}` }}>
                <div className="stat-label">{formatMonthYear(m.month)}</div>
                <div className="stat-value red" style={{ fontSize: '1.25rem' }}>{formatCurrency(m.expenses, true)}</div>
                <div className="stat-sub">
                  {m.balance >= 0
                    ? <span style={{ color: 'var(--green)' }}>+{formatCurrency(m.balance, true)}</span>
                    : <span style={{ color: 'var(--red)' }}>{formatCurrency(m.balance, true)}</span>
                  }
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-2" style={{ marginBottom: 24 }}>
            {/* Por categoría */}
            <div className="card">
              <div className="section-title">🏷 Gastos por categoría — {formatMonthYear(month)}</div>
              {!categoryData || categoryData.categories?.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-icon">📊</div>
                  <p>Sin datos para este mes</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {categoryData.categories?.map(cat => (
                    <div key={cat.category_id || cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{cat.icon}</span>
                          <span style={{ fontWeight: 500 }}>{cat.name}</span>
                        </span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{cat.percentage}%</span>
                          <span className="amount-negative">{formatCurrency(cat.total)}</span>
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-fill"
                          style={{ width: `${cat.percentage}%`, background: cat.color || 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="divider" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Total</span>
                    <span className="amount-negative">{formatCurrency(categoryData.total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comparativa meses */}
            <div className="card">
              <div className="section-title">📅 Evolución mensual</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...monthly].reverse().map(m => (
                  <div key={m.month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                      <span style={{ color: m.month === month ? 'var(--text)' : 'var(--text-secondary)', fontWeight: m.month === month ? 600 : 400 }}>
                        {formatMonthYear(m.month)}
                      </span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span className="amount-negative">{formatCurrency(m.expenses, true)}</span>
                        {m.balance >= 0 && <span className="amount-positive">+{formatCurrency(m.balance, true)}</span>}
                      </div>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-fill" style={{
                        width: `${(m.expenses / maxMonthExpense) * 100}%`,
                        background: m.month === month ? 'var(--accent)' : 'var(--red)',
                        opacity: m.month === month ? 1 : 0.6,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {worstMonth && bestMonth && worstMonth.month !== bestMonth.month && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>PEOR MES</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{formatMonthYear(worstMonth.month)}</div>
                    <div className="amount-negative" style={{ fontSize: '0.875rem' }}>{formatCurrency(worstMonth.expenses, true)}</div>
                  </div>
                  <div style={{ background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>MEJOR MES</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{formatMonthYear(bestMonth.month)}</div>
                    <div className="amount-positive" style={{ fontSize: '0.875rem' }}>{formatCurrency(bestMonth.expenses, true)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Insights IA */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                ✨ Análisis inteligente
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  Powered by Gemini
                </span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={loadInsights}
                disabled={loadingInsights}
              >
                {loadingInsights ? <><span className="spin">◌</span> Analizando...</> : '⚡ Analizar'}
              </button>
            </div>

            {!insights && !loadingInsights && (
              <div className="empty-state" style={{ padding: 32 }}>
                <div className="empty-icon">🤖</div>
                <h3>Análisis con IA</h3>
                <p style={{ maxWidth: 360, margin: '0 auto' }}>
                  Gemini analizará tus últimos 3 meses y te dirá dónde podés ahorrar más
                </p>
              </div>
            )}

            {loadingInsights && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                <div className="loader" style={{ margin: '0 auto 12px' }} />
                Gemini está analizando tus gastos...
              </div>
            )}

            {insights && (
              <div>
                {insights.summary && (
                  <div style={{
                    background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)',
                    padding: '14px 18px', marginBottom: 20, fontSize: '0.9375rem',
                    borderLeft: '3px solid var(--accent)', lineHeight: 1.6
                  }}>
                    {insights.summary}
                  </div>
                )}

                <div className="grid grid-2" style={{ marginBottom: 20 }}>
                  {insights.top_insights?.map((insight, i) => (
                    <div key={i} style={{
                      background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      borderLeft: `3px solid ${insight.type === 'warning' ? 'var(--yellow)' : insight.type === 'achievement' ? 'var(--green)' : 'var(--accent)'}`,
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
                        {insight.type === 'warning' ? '⚠️' : insight.type === 'achievement' ? '🏆' : '💡'} {insight.title}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{insight.description}</div>
                    </div>
                  ))}
                </div>

                {insights.saving_opportunities?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      💰 OPORTUNIDADES DE AHORRO
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {insights.saving_opportunities.map((op, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)',
                          padding: '12px 16px', gap: 16
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{op.category}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{op.suggestion}</div>
                          </div>
                          <div style={{ color: 'var(--green)', fontWeight: 700, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
                            {formatCurrency(op.potential_monthly_saving, true)}/mes
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
