'use client';

import { useDispatch, useSelector } from 'react-redux';
import { Download } from 'lucide-react';
import { exportAnalytics, selectAnalyticsLoaders, selectAnalyticsDateRange } from '../../../store/slices/analyticsSlice';

export default function AnalyticsExportButton() {
  const dispatch = useDispatch();
  const loaders = useSelector(selectAnalyticsLoaders);
  const dateRange = useSelector(selectAnalyticsDateRange);

  return (
    <button
      type="button"
      onClick={() => dispatch(exportAnalytics(dateRange))}
      disabled={loaders.export}
      className="btn btn-outline btn-sm"
    >
      <Download className="w-4 h-4" />
      {loaders.export ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}
