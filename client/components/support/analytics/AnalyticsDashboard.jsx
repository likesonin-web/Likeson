'use client';

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAnalyticsVolume,
  fetchAnalyticsResponseTimes,
  fetchAnalyticsSLA,
  fetchAnalyticsCategoryBreakdown,
  fetchAnalyticsCSAT,
  selectAnalyticsVolume,
  selectAnalyticsResponseTimes,
  selectAnalyticsCategoryBreakdown,
  selectAnalyticsCSAT,
  selectAnalyticsDateRange,
} from '../../../store/slices/analyticsSlice';
import DateRangePicker from './DateRangePicker';
import VolumeChart from './VolumeChart';
import ResponseTimeChart from './ResponseTimeChart';
import CategoryBreakdownChart from './CategoryBreakdownChart';
import CSATChart from './CSATChart';
import AnalyticsExportButton from './AnalyticsExportButton';

export default function AnalyticsDashboard() {
  const dispatch = useDispatch();
  const dateRange = useSelector(selectAnalyticsDateRange);
  const volume = useSelector(selectAnalyticsVolume);
  const responseTimes = useSelector(selectAnalyticsResponseTimes);
  const categoryBreakdown = useSelector(selectAnalyticsCategoryBreakdown);
  const csat = useSelector(selectAnalyticsCSAT);

  const fetchAll = useCallback(
    (range) => {
      const params = { from: range.from, to: range.to };
      dispatch(fetchAnalyticsVolume(params));
      dispatch(fetchAnalyticsResponseTimes(params));
      dispatch(fetchAnalyticsSLA(params));
      dispatch(fetchAnalyticsCategoryBreakdown(params));
      dispatch(fetchAnalyticsCSAT(params));
    },
    [dispatch]
  );

  useEffect(() => {
    fetchAll(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Support Analytics</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker onChange={fetchAll} />
          <AnalyticsExportButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4">Ticket Volume</h3>
          <VolumeChart data={volume?.series} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4">Response & Resolution Time</h3>
          <ResponseTimeChart data={responseTimes?.series} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4">Category Breakdown</h3>
          <CategoryBreakdownChart data={categoryBreakdown?.breakdown} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4">Customer Satisfaction</h3>
          <CSATChart data={csat?.distribution} average={csat?.average} />
        </div>
      </div>
    </div>
  );
}
