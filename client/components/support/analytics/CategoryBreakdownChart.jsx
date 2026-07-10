'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TICKET_TYPE_LABELS } from '../../../features/support/constants/support.constants';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

/**
 * @param {{ data: Array<{ticketType: string, count: number}> }} props
 */
export default function CategoryBreakdownChart({ data }) {
  if (!data?.length) return <p className="text-sm text-base-content/50 text-center py-12">No data for this period.</p>;

  const chartData = data.map((d) => ({ name: TICKET_TYPE_LABELS[d.ticketType] ?? d.ticketType, value: d.count }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
