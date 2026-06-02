'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, Zap, CheckCircle2, Clock, FileEdit, XCircle, RefreshCw, TrendingUp, Activity, LayoutDashboard, ChevronDown, ChevronUp, Send, AlertCircle } from 'lucide-react';

interface Campaign { id: string; attributes: { name: string; status: string; sendStrategy?: { datetime?: string }; audiences?: { included: string[]; excluded: string[] }; createdAt?: string; updatedAt?: string; }; }
interface Flow { id: string; attributes: { name: string; status: string; triggerType: string; created?: string; updated?: string; }; }

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

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'flows'>('campaigns');
  const [campaignFilter, setCampaignFilter] = useState('All');
  const [flowFilter, setFlowFilter] = useState('All');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [cRes, fRes] = await Promise.all([fetch('/api/campaigns'), fetch('/api/flows')]);
      const [cData, fData] = await Promise.all([cRes.json(), fRes.json()]);
      setCampaigns(cData.data || []); setFlows(fData.data || []); setLastUpdated(new Date());
    } catch (e) { console.error(e); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(() => fetchData(true), 60000); return () => clearInterval(i); }, [fetchData]);

  const stats = { total: campaigns.length, sent: campaigns.filter(c => c.attributes.status === 'Sent').length, draft: campaigns.filter(c => c.attributes.status === 'Draft').length, flowTotal: flows.length, flowLive: flows.filter(f => f.attributes.status === 'live').length, flowDraft: flows.filter(f => f.attributes.status === 'draft').length };
  const filteredCampaigns = campaigns.filter(c => (campaignFilter === 'All' || c.attributes.status === campaignFilter) && c.attributes.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFlows = flows.filter(f => (flowFilter === 'All' || f.attributes.status === flowFilter) && f.attributes.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  if (loading) return <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}><div style={{ width: 40, height: 40, border: '3px solid #1f1f2e', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><p style={{ color: '#6b7280', fontSize: 14 }}>Loading dashboard</p><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e5e7eb', fontFamily: 'sans-serif' }}>
      <style>{`* { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} } .rhover:hover { background: #111118 !important; } input[type=text] { background: #0f0f12; border: 1px solid #1f1f2e; border-radius: 10px; padding: 8px 14px; color: #e5e7eb; font-size: 13px; outline: none; width: 220px; } input[type=text]:focus { border-color: #6366f1; } input[type=text]::placeholder { color: #4b5563; }`}</style>
      <header style={{ borderBottom: '1px solid #1f1f2e', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#08080aee', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutDashboard size={16} color="#fff" /></div><div><div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Get My Course</div><div style={{ fontSize: 11, color: '#6b7280' }}>Klaviyo Dashboard</div></div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>{lastUpdated && <span style={{ fontSize: 11, color: '#4b5563' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}<button onClick={() => fetchData(true)} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#1f1f2e', border: '1px solid #2a2a3e', borderRadius: 9, color: '#9ca3af', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh</button><div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#052e16', border: '1px solid #22c55e33', borderRadius: 20 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} /><span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Live</span></div></div>
      </header>
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}><StatCard label="Total Campaigns" value={stats.total} icon={<Mail size={20} />} color="#6366f1" /><StatCard label="Sent" value={stats.sent} icon={<CheckCircle2 size={20} />} color="#22c55e" /><StatCard label="Draft Campaigns" value={stats.draft} icon={<FileEdit size={20} />} color="#facc15" /><StatCard label="Total Flows" value={stats.flowTotal} icon={<Zap size={20} />} color="#a855f7" /><StatCard label="Live Flows" value={stats.flowLive} icon={<Activity size={20} />} color="#22c55e" /><StatCard label="Draft Flows" value={stats.flowDraft} icon={<TrendingUp size={20} />} color="#f97316" /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 11, padding: 4, gap: 4 }}>{(['campaigns', 'flows'] as const).map(tab => <button key={tab} onClick={() => { setActiveTab(tab); setSearchQuery(''); }} style={{ padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: activeTab === tab ? '#1f1f2e' : 'transparent', color: activeTab === tab ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer' }}>{tab === 'campaigns' ? `Campaigns (${stats.total})` : `Flows (${stats.flowTotal})`}</button>)}</div>
          <input type="text" placeholder={`Search ${activeTab}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {activeTab === 'campaigns' && <><div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>{['All', 'Sent', 'Draft', 'Scheduled', 'Cancelled'].map(f => <button key={f} onClick={() => setCampaignFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: campaignFilter === f ? '#1f1f2e' : 'transparent', color: campaignFilter === f ? '#fff' : '#6b7280', border: `1px solid ${campaignFilter === f ? '#6366f1' : '#1f1f2e'}`, cursor: 'pointer' }}>{f}</button>)}</div><div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #1f1f2e' }}>{['Campaign Name', 'Status', 'Send Date', 'Lists', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{filteredCampaigns.map((c, i) => { const isExp = expandedCampaign === c.id; return <><tr key={c.id} className="rhover" style={{ borderBottom: '1px solid #1a1a26', background: i % 2 === 0 ? '#0f0f12' : '#0b0b10', cursor: 'pointer' }} onClick={() => setExpandedCampaign(isExp ? null : c.id)}><td style={{ padding: '13px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{c.attributes.name}</div></td><td style={{ padding: '13px 16px' }}><StatusBadge status={c.attributes.status} /></td><td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af' }}>{fmt(c.attributes.sendStrategy?.datetime || c.attributes.updatedAt)}</td><td style={{ padding: '13px 16px' }}><span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{c.attributes.audiences?.included?.length ?? 0} lists</span></td><td style={{ padding: '13px 16px' }}>{isExp ? <ChevronUp size={14} color="#6b7280" /> : <ChevronDown size={14} color="#6b7280" />}</td></tr>{isExp && <tr key={`${c.id}-x`} style={{ background: '#0a0a10' }}><td colSpan={5} style={{ padding: '14px 24px' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Created</div><div style={{ fontSize: 12, color: '#9ca3af' }}>{fmt(c.attributes.createdAt)}</div></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Lists</div><div style={{ fontSize: 12, color: '#818cf8' }}>{c.attributes.audiences?.included?.join(', ') || '-'}</div></div><div><div style={{ fontSize: 10, color: '#4b5563', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Open</div><a href={`https://www.klaviyo.com/campaign/${c.id}/wizard`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Open in Klaviyo</a></div></div></td></tr>}</>; })}{filteredCampaigns.length === 0 && <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No campaigns found</td></tr>}</tbody></table></div></>}
        {activeTab === 'flows' && <><div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>{['All', 'live', 'draft', 'manual', 'paused'].map(f => <button key={f} onClick={() => setFlowFilter(f)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: flowFilter === f ? '#1f1f2e' : 'transparent', color: flowFilter === f ? '#fff' : '#6b7280', border: `1px solid ${flowFilter === f ? '#a855f7' : '#1f1f2e'}`, cursor: 'pointer' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>)}</div><div style={{ background: '#0f0f12', border: '1px solid #1f1f2e', borderRadius: 14, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #1f1f2e' }}>{['Flow Name', 'Status', 'Trigger', 'Created', 'Updated', ''].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead><tbody>{filteredFlows.map((f, i) => <tr key={f.id} className="rhover" style={{ borderBottom: '1px solid #1a1a26', background: i % 2 === 0 ? '#0f0f12' : '#0b0b10' }}><td style={{ padding: '13px 16px' }}><div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{f.attributes.name}</div></td><td style={{ padding: '13px 16px' }}><StatusBadge status={f.attributes.status} /></td><td style={{ padding: '13px 16px' }}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: `${TRIGGER_COLORS[f.attributes.triggerType] || '#6b7280'}18`, color: TRIGGER_COLORS[f.attributes.triggerType] || '#6b7280' }}>{f.attributes.triggerType}</span></td><td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af' }}>{fmt(f.attributes.created)}</td><td style={{ padding: '13px 16px', fontSize: 12, color: '#9ca3af' }}>{fmt(f.attributes.updated)}</td><td style={{ padding: '13px 16px' }}><a href={`https://www.klaviyo.com/flow/${f.id}/edit`} target="_blank" style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Edit</a></td></tr>)}{filteredFlows.length === 0 && <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No flows found</td></tr>}</tbody></table></div></>}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#374151' }}>Auto-refreshes every 60 seconds · Powered by Klaviyo API</div>
      </main>
    </div>
  );
              }
