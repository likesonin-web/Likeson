'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * @param {{ data: Array<{date: string, count: number}> }} props
 */
export default function VolumeChart({ data }) {
  if (!data?.length) return <p className="text-sm text-base-content/50 text-center py-12">No data for this period.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fill="url(#volumeGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
