'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RATING_COLORS = {
  1: 'var(--error)',
  2: 'var(--warning)',
  3: 'var(--info)',
  4: 'var(--secondary)',
  5: 'var(--success)',
};

/**
 * @param {{ data: Array<{rating: number, count: number}>, average?: number }} props
 */
export default function CSATChart({ data, average }) {
  if (!data?.length) return <p className="text-sm text-base-content/50 text-center py-12">No ratings yet.</p>;

  const chartData = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r}★`,
    count: data.find((d) => d.rating === r)?.count ?? 0,
    ratingValue: r,
  }));

  return (
    <div>
      {average !== undefined && (
        <p className="text-2xl font-black text-primary mb-2">
          {average.toFixed(1)} <span className="text-sm font-semibold text-base-content/50">avg / 5</span>
        </p>
      )}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="rating" tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--base-content)" opacity={0.5} allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((d) => (
                <Cell key={d.ratingValue} fill={RATING_COLORS[d.ratingValue]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
