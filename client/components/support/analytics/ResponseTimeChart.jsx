'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * @param {{ data: Array<{date: string, firstResponseMinutes: number, resolutionMinutes: number}> }} props
 */
export default function ResponseTimeChart({ data }) {
  if (!data?.length) return <p className="text-sm text-base-content/50 text-center py-12">No data for this period.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} label={{ value: 'minutes', angle: -90, fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="firstResponseMinutes" name="First response" stroke="var(--primary)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="resolutionMinutes" name="Resolution" stroke="var(--accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
