'use client';

import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import { setDateRange, selectAnalyticsDateRange } from '../../../store/slices/analyticsSlice';

const PRESETS = [
  { key: 'last_7_days', label: '7 days', days: 7 },
  { key: 'last_30_days', label: '30 days', days: 30 },
  { key: 'last_90_days', label: '90 days', days: 90 },
];

export default function DateRangePicker({ onChange }) {
  const dispatch = useDispatch();
  const dateRange = useSelector(selectAnalyticsDateRange);

  const applyPreset = (preset) => {
    const to = dayjs().toISOString();
    const from = dayjs().subtract(preset.days, 'day').toISOString();
    const next = { from, to, preset: preset.key };
    dispatch(setDateRange(next));
    onChange?.(next);
  };

  return (
    <div className="flex gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => applyPreset(p)}
          className={`btn btn-sm ${dateRange.preset === p.key ? 'btn-primary' : 'btn-ghost'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
