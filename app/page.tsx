'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, Zap, CheckCircle2, Clock, FileEdit, XCircle, RefreshCw, TrendingUp, Activity, LayoutDashboard, ChevronDown, ChevronUp, Send, AlertCircle, BarChart2, MousePointer, Eye, DollarSign } from 'lucide-react';

interface Campaign { id: string; attributes: { name: string; status: string; sendStrategy?: { datetime?: string }; audiences?: { included: string[]; excluded: string[] }; createdAt?: string; updatedAt?: string; }; }
interface Flow { id: string; attributes: { name: string; status: string; triggerType: string; created?: string; updated?: string; }; }
interface CampaignMetric { campaign_id?: string; statistics?: { open_rate?: number; click_rate?: number; unsubscribe_rate?: number; delivered?: number; open_unique?: number; click_unique?: number; revenue?: number; }; }
interface FlowMetric { flow_id?: string; statistics?: { open_rate?: number; click_rate?: number; unsubscribe_rate?: number; delivered?: number; open_unique?: number; click_unique?: number; revenue?: number; }; }
interface MetricsOverview { total_delivered?: number; average_open_rate?: number; average_click_rate?: number; total_revenue?: number; }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  Sent: { label: 'Sent', color: '#22c55e', bg: '#052e16', icon: <CheckCircle2 size={12} /> },
  Draft: { label: 'Draft', color: '#facc15', bg: '#1a1200', icon: <FileEdit size={12} /> },
  Scheduled: { label: 'Scheduled', color: '#38bdf8', bg: '#082f49', icon: <Clock size={12} /> },
  Cancelled: { label: 'Cancelled', color: '#f87171', bg: '#300', icon: <XCircle size={12} /> },
  Sending: { label: 'Sending', color: '#a78bfa', bg: '#1e0a3c', icon: <Send size={12} /> },
  live: { label: 'Live', color: '#22c55e', bg: '#052e16', icon: <Activity size={12} /> },
  draft: { label: 'Draft', color: '#facc15', bg: '#1a1200', icon: <FileEdit size={12} /> },
  manual: { label: 'Manual', color: '#38bdf8', bg: '#082f49', icon: <Clock size={12} /> },
  paused: { label: 'Paused', color: '#f87171', bg: '#300', icon: <AlertCircle size={12} /> },
};
const TRIGGER_COLORS: Record<string, string> = { 'Added to List': '#818cf8', 'Metric': '#fb923c', 'Date Based': '#34d399', 'Unconfigured': '#6b7280', 'Price Drop': '#f472b6', 'Low Inventory': '#fbbf24' };

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#9ca3af', bg: '#111', icon: null };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>{cfg.icon} {cfg.label}</span>;
}
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return <div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div><div><div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div><div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div></div></div>;
}
function MetricStatCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return <div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div><div><div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{sub}</div>}<div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{label}</div></div></div>;
}
function RateBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 6, background: '#1f1f2e', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} /></div><span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>{(pct).toFixed(1)}%</span></div>;
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetric[]>([]);
  const [flowMetrics, setFlowMetrics] = useState<FlowMetric[]>([]);
  const [metricsOverview, setMetricsOverview] = useState<MetricsOverview>({});
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'flows' | 'metrics'>('campaigns');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [flowFilter, setFlowFilter] = useState('All');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [metricsSort, setMetricsSort] = useState<'open_rate' | 'click_rate' | 'delivered' | 'revenue'>('open_rate');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [cRes, fRes, mRes, fmRes] = await Promise.all([
        fetch('/api/campaigns'),
        fetch('/api/flows'),
        fetch('/api/metrics'),
        fetch('/api/flow-metrics'),
      ]);
      const [cData, fData, mData, fmData] = await Promise.all([
        cRes.json(), fRes.json(), mRes.json(), fmRes.json(),
      ]);
      setCampaigns(cData.data || []);
      setFlows(fData.data || []);
      if (mData.error && !mData.campaigns) {
        setMetricsError(mData.error);
      } else {
        setMetrics(mData.campaigns || []);
        setMetricsOverview(mData.overview || {});
        setMetricsError(null);
      }
      setFlowMetrics(fmData.flows || []);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(() => fetchData(true), 60000); return () => clearInterval(i); }, [fetchData]);

  const stats = { total: campaigns.length, sent: campaigns.filter(c => c.attributes.status === 'Sent').length, draft: campaigns.filter(c => c.attributes.status === 'Draft').length, flowTotal: flows.length, flowLive: flows.filter(f => f.attributes.status === 'live').length, flowDraft: flows.filter(f => f.attributes.status === 'draft').length };
  const filteredCampaigns = campaigns.filter(c => (campaignFilter === 'All' || c.attributes.status === campaignFilter) && c.attributes.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFlows = flows.filter(f => (flowFilter === 'All' || f.attributes.status === flowFilter) && f.attributes.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const fmtPct = (v?: number) => v != null ? (v * 100).toFixed(1) + '%' : '-';
  const fmtNum = (v?: number) => v != null ? v.toLocaleString() : '-';
  const fmtAUD = (v?: number) => v != null && v > 0 ? '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v === 0 ? '$0.00' : '-';

  const campaignNameMap: Record<string, string> = {};
  campaigns.forEach(c => { campaignNameMap[c.id] = c.attributes.name; });

  const flowMetricMap: Record<string, FlowMetric> = {};
  flowMetrics.forEach(fm => { if (fm.flow_id) flowMetricMap[fm.flow_id] = fm; });

  const sortedMetrics = [...metrics].filter(m => m.campaign_id && m.statistics).sort((a, b) => ((b.statistics?.[metricsSort] ?? 0) as number) - ((a.statistics?.[metricsSort] ?? 0) as number));

  const aggDelivered = metrics.reduce((s, m) => s + (m.statistics?.delivered ?? 0), 0);
  const aggOpens = metrics.reduce((s, m) => s + (m.statistics?.open_unique ?? 0), 0);
  const aggClicks = metrics.reduce((s, m) => s + (m.statistics?.click_unique ?? 0), 0);
  const aggRevenue = metrics.reduce((s, m) => s + (m.statistics?.revenue ?? 0), 0);
  const avgOpenRate = aggDelivered > 0 ? aggOpens / aggDelivered : (metricsOverview.average_open_rate ?? 0);
  const avgClickRate = aggDelivered > 0 ? aggClicks / aggDelivered : (metricsOverview.average_click_rate ?? 0);

  const flowAggDelivered = flowMetrics.reduce((s, m) => s + (m.statistics?.delivered ?? 0), 0);
  const flowAggOpens = flowMetrics.reduce((s, m) => s + (m.statistics?.open_unique ?? 0), 0);
  const flowAggClicks = flowMetrics.reduce((s, m) => s + (m.statistics?.click_unique ?? 0), 0);
  const flowAvgOpenRate = flowAggDelivered > 0 ? flowAggOpens / flowAggDelivered : 0;
  const flowAggRevenue = flowMetrics.reduce((s, m) => s + (m.statistics?.revenue ?? 0), 0);
const flowAvgClickRate = flowAggDelivered > 0 ? flowAggClicks / flowAggDelivered : 0;

  const hasMetrics = metrics.length > 0;
  const hasFlowMetrics = flowMetrics.length > 0;

  if (loading) return <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}><div style={{ width: 40, height: 40, border: '3px solid #1f1f2e', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ color: '#6b7280', fontSize: 14 }}>Loading dashboard</p><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e5e7eb', fontFamily: 'sans-serif' }}>
      <style>{`* { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} } .rhover:hover { background: #111118 !important; } input[type=text] { background: #0f0f12; border: 1px solid #1f1f2e; border-radius: 10px; padding: 8px 14px; color: #e5e7eb; font-size: 13px; outline: none; width: 220px; } input[type=text]:focus { border-color: #6366f1; } input[type=text]::placeholder { color: #4b5563; }`}</style>
      <header style={{ borderBottom: '1px solid #1f1f2e', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#08080aee', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutDashboard size={16} color="#fff" /></div><div><div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Get My Course</div><div style={{ fontSize: 11, color: '#6b7280' }}>Klaviyo Dashboard</div></div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{lastUpdated && <span style={{ fontSize: 11, color: '#4b5563' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}<button onClick={() => fetchData(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1f1f2e', border: '1px solid #2a2a3e', borderRadius: 9, color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh</button><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#052e16', border: '1px solid #22c55e33', borderRadius: 20 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} /><span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Live</span></div></div>
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard label="Total Campaigns" value={stats.total} icon={<Mail size={20} />} color="#6366f1" />
          <StatCard label="Sent" value={stats.sent} icon={<CheckCircle2 size={20} />} color="#22c55e" />
          <StatCard label="Draft Campaigns" value={stats.draft} icon={<FileEdit size={20} />} color="#facc15" />
          <StatCard label="Total Flows" value={stats.flowTotal} icon={<Zap size={20} />} color="#a855f7" />
          <StatCard label="Live Flows" value={stats.flowLive} icon={<Activity size={20} />} color="#22c55e" />
          <StatCard label="Draft Flows" value={stats.flowDraft} icon={<TrendingUp size={20} />} color="#f97316" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          <MetricStatCard label="Campaign Open Rate (90d)" value={hasMetrics ? fmtPct(avgOpenRate) : '—'} icon={<Eye size={20} />} color="#6366f1" sub={hasMetrics ? `${fmtNum(aggOpens)} unique opens` : 'Loading…'} />
          <MetricStatCard label="Campaign Click Rate (90d)" value={hasMetrics ? fmtPct(avgClickRate) : '—'} icon={<MousePointer size={20} />} color="#22c55e" sub={hasMetrics ? `${fmtNum(aggClicks)} unique clicks` : 'Loading…'} />
          <MetricStatCard label="Campaign Revenue (90d)" value={hasMetrics ? fmtAUD(aggRevenue || metricsOverview.total_revenue) : '—'} icon={<DollarSign size={20} />} color="#f97316" sub={hasMetrics ? `${metrics.length} campaigns` : 'Loading…'} />
          <MetricStatCard label="Flow Open Rate (90d)" value={hasFlowMetrics ? fmtPct(flowAvgOpenRate) : '—'} icon={<BarChart2 size={20} />} color="#a855f7" sub={hasFlowMetrics ? `${fmtNum(flowAggDelivered)} delivered` : 'Loading…'} />
          <MetricStatCard label="Flow Click Rate (90d)" value={hasFlowMetrics ? fmtPct(flowAvgClickRate) : '—'} icon={<MousePointer size={20} />} color="#38bdf8" sub={hasFlowMetrics ? `${fmtNum(flowAggClicks)} unique clicks` : 'Loading…'} />
<MetricStatCard label="Flow Revenue (90d)" value={hasFlowMetrics ? fmtAUD(flowAggRevenue) : '—'} icon={<DollarSign size={20} />} color="#f59e0b" sub={hasFlowMetrics ? `${flowMetrics.length} flows` : 'Loading…'} />
          <MetricStatCard label="Total Delivered (90d)" value={fmtNum((aggDelivered || 0) + (flowAggDelivered || 0))} icon={<Send size={20} />} color="#34d399" sub="Campaigns + Flows" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 11, padding: 4, gap: 4 }}>{(['campaigns', 'flows', 'metrics'] as const).map(tab => <button key={tab} onClick={() => { setActiveTab(tab); setSearchQuery(''); }} style={{ padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: activeTab === tab ? '#1f1f2e' : 'transparent', color: activeTab === tab ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer' }}>{tab === 'campaigns' ? `Campaigns (${stats.total})` : tab === 'flows' ? `Flows (${stats.flowTotal})` : `Metrics (${metrics.length})`}</button>)}</div>
          {activeTab !== 'metrics' && <input type="text" placeholder={`Search ${activeTab}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />}
        </div>
        {activeTab === 'campaigns' && <><div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>{['All', 'Sent', 'Draft', 'Scheduled', 'Cancelled'].map(f => <button key={f} onClick={() => setCampaignFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: campaignFilter === f ? '#1f1f2e' : 'transparent', color: campaignFilter === f ? '#fff' : '#6b7280', border: `1px solid ${campaignFilter === f ? '#6366f1' : '#1f1f2e'}`, cursor: 'pointer' }}>{f}</button>)}</div><div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #1f1f2e' }}>{['Campaign Name', 'Status', 'Open Rate', 'Click Rate', 'Revenue', 'Delivered', 'Send Date', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{filteredCampaigns.map((c, i) => { const isExp = expandedCampaign === c.id; const cm = metrics.find(m => m.campaign_id === c.id); return <><tr key={c.id} className="rhover" style={{ borderBottom: '1px solid #1a1a26', background: i % 2 === 0 ? '#0f0f12' : '#0b0b10', cursor: 'pointer' }} onClick={() => setExpandedCampaign(isExp ? null : c.id)}><td style={{ padding: '13px 16px', maxWidth: 260 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.attributes.name}</div></td><td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}><StatusBadge status={c.attributes.status} /></td><td style={{ padding: '13px 16px', minWidth: 130 }}>{cm?.statistics ? <RateBar value={cm.statistics.open_rate ?? 0} color="#6366f1" /> : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}</td><td style={{ padding: '13px 16px', minWidth: 130 }}>{cm?.statistics ? <RateBar value={cm.statistics.click_rate ?? 0} color="#22c55e" /> : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#f97316', fontWeight: 600, whiteSpace: 'nowrap' }}>{cm?.statistics ? fmtAUD(cm.statistics.revenue) : '—'}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#38bdf8', fontWeight: 600, whiteSpace: 'nowrap' }}>{cm?.statistics ? fmtNum(cm.statistics.delivered) : '—'}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmt(c.attributes.sendStrategy?.datetime || c.attributes.updatedAt)}</td><td style={{ padding: '13px 16px' }}>{isExp ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}</td></tr>{isExp && <tr key={`${c.id}-x`} style={{ background: '#0a0a10' }}><td colSpan={8} style={{ padding: '14px 24px' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Created</div><div style={{ fontSize: 12, color: '#9ca3af' }}>{fmt(c.attributes.createdAt)}</div></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Lists</div><div style={{ fontSize: 12, color: '#818cf8' }}>{c.attributes.audiences?.included?.join(', ') || '-'}</div></div>{cm?.statistics && <><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Open Rate</div><RateBar value={cm.statistics.open_rate ?? 0} color="#6366f1" /></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Click Rate</div><RateBar value={cm.statistics.click_rate ?? 0} color="#22c55e" /></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Delivered</div><div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}>{fmtNum(cm.statistics.delivered)}</div></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Revenue</div><div style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{fmtAUD(cm.statistics.revenue)}</div></div></>}<div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Open</div><a href={`https://www.klaviyo.com/campaign/${c.id}/wizard`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Open in Klaviyo</a></div></div></td></tr>}</>; })}{filteredCampaigns.length === 0 && <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No campaigns found</td></tr>}</tbody></table></div></>}
        {activeTab === 'flows' && <><div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>{['All', 'live', 'draft', 'manual', 'paused'].map(f => <button key={f} onClick={() => setFlowFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: flowFilter === f ? '#1f1f2e' : 'transparent', color: flowFilter === f ? '#fff' : '#6b7280', border: `1px solid ${flowFilter === f ? '#a855f7' : '#1f1f2e'}`, cursor: 'pointer' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div><div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #1f1f2e' }}>{['Flow Name', 'Status', 'Trigger', 'Open Rate', 'Click Rate', 'Delivered', 'Revenue', 'Created', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>{filteredFlows.map((f, i) => { const fm = flowMetricMap[f.id]; return <tr key={f.id} className="rhover" style={{ borderBottom: '1px solid #1a1a26', background: i % 2 === 0 ? '#0f0f12' : '#0b0b10' }}><td style={{ padding: '13px 16px', maxWidth: 280 }}><div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.attributes.name}</div></td><td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}><StatusBadge status={f.attributes.status} /></td><td style={{ padding: '13px 16px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: `${TRIGGER_COLORS[f.attributes.triggerType] || '#6b7280'}18`, color: TRIGGER_COLORS[f.attributes.triggerType] || '#6b7280' }}>{f.attributes.triggerType}</span></td><td style={{ padding: '13px 16px', minWidth: 120 }}>{fm?.statistics ? <RateBar value={fm.statistics.open_rate ?? 0} color="#6366f1" /> : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}</td><td style={{ padding: '13px 16px', minWidth: 120 }}>{fm?.statistics ? <RateBar value={fm.statistics.click_rate ?? 0} color="#22c55e" /> : <span style={{ fontSize: 11, color: '#374151' }}>—</span>}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#38bdf8', fontWeight: 600, whiteSpace: 'nowrap' }}>{fm?.statistics ? fmtNum(fm.statistics.delivered) : '—'}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#f97316', fontWeight: 600, whiteSpace: 'nowrap' }}>{fm?.statistics ? fmtAUD(fm.statistics.revenue) : '—'}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmt(f.attributes.created)}</td><td style={{ padding: '13px 16px' }}><a href={`https://www.klaviyo.com/flow/${f.id}/edit`} target="_blank" style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Edit</a></td></tr>; })}{filteredFlows.length === 0 && <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No flows found</td></tr>}</tbody></table></div></>}
        {activeTab === 'metrics' && <>{metricsError ? (<div style={{ background: '#1a0a0a', border: '1px solid #f8717133', borderRadius: 14, padding: 32, textAlign: 'center' }}><AlertCircle size={32} color="#f87171" style={{ margin: '0 auto 12px' }} /><div style={{ color: '#f87171', fontWeight: 600, marginBottom: 8 }}>Metrics unavailable</div><div style={{ color: '#6b7280', fontSize: 12, maxWidth: 500, margin: '0 auto' }}>The Klaviyo Campaign Values Report API returned an error. Check your API key scopes.</div></div>) : metrics.length === 0 ? (<div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No metrics data available for the last 90 days.</div>) : (<><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}><MetricStatCard label="Avg Open Rate (90d)" value={fmtPct(avgOpenRate)} icon={<Eye size={20} />} color="#6366f1" sub={`${fmtNum(aggOpens)} unique opens`} /><MetricStatCard label="Avg Click Rate (90d)" value={fmtPct(avgClickRate)} icon={<MousePointer size={20} />} color="#22c55e" sub={`${fmtNum(aggClicks)} unique clicks`} /><MetricStatCard label="Total Delivered (90d)" value={fmtNum(aggDelivered || metricsOverview.total_delivered)} icon={<Send size={20} />} color="#38bdf8" sub={`${metrics.length} campaigns tracked`} /><MetricStatCard label="Total Revenue (90d)" value={fmtAUD(aggRevenue || metricsOverview.total_revenue)} icon={<DollarSign size={20} />} color="#f97316" sub="Attributed revenue" /></div><div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}><span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginRight: 4 }}>Sort by:</span>{([['open_rate', 'Open Rate'], ['click_rate', 'Click Rate'], ['delivered', 'Delivered'], ['revenue', 'Revenue']] as const).map(([key, label]) => (<button key={key} onClick={() => setMetricsSort(key)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: metricsSort === key ? '#1f1f2e' : 'transparent', color: metricsSort === key ? '#fff' : '#6b7280', border: `1px solid ${metricsSort === key ? '#6366f1' : '#1f1f2e'}`, cursor: 'pointer' }}>{label}</button>))}</div><div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #1f1f2e' }}>{['Campaign Name', 'Delivered', 'Open Rate', 'Click Rate', 'Unsub Rate', 'Revenue'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{sortedMetrics.map((m, i) => { const name = m.campaign_id ? (campaignNameMap[m.campaign_id] || m.campaign_id) : 'Unknown'; const s = m.statistics || {}; return (<tr key={m.campaign_id || i} className="rhover" style={{ borderBottom: '1px solid #1a1a26', background: i % 2 === 0 ? '#0f0f12' : '#0b0b10' }}><td style={{ padding: '12px 16px' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', maxWidth: 300 }}>{name}</div></td><td style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>{fmtNum(s.delivered)}</td><td style={{ padding: '12px 16px', minWidth: 140 }}><RateBar value={s.open_rate ?? 0} color="#6366f1" /></td><td style={{ padding: '12px 16px', minWidth: 140 }}><RateBar value={s.click_rate ?? 0} color="#22c55e" /></td><td style={{ padding: '12px 16px', minWidth: 140 }}><RateBar value={s.unsubscribe_rate ?? 0} color="#f87171" /></td><td style={{ padding: '12px 16px', fontSize: 12, color: '#f97316', fontWeight: 600 }}>{s.revenue != null ? fmtAUD(s.revenue) : '-'}</td></tr>); })}{sortedMetrics.length === 0 && <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No campaign metrics found</td></tr>}</tbody></table></div></>)}</>}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#374151' }}>Auto-refreshes every 60 seconds · Powered by Klaviyo API</div>
      </main>
    </div>
  );
}
