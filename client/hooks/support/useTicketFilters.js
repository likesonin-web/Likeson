// hooks/support/useTicketFilters.js

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setFilters, resetFilters, fetchTickets, selectTicketFilters } from '../../store/slices/ticketSlice';
import { GLOBAL_SEARCH_DEBOUNCE_MS } from '../../features/support/constants/support.constants';

export function useTicketFilters() {
  const dispatch = useDispatch();
  const filters = useSelector(selectTicketFilters);
  const debounceRef = useRef(null);

  const applyFilters = useCallback(
    (patch, { immediate = false } = {}) => {
      dispatch(setFilters(patch));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      const delay = immediate ? 0 : GLOBAL_SEARCH_DEBOUNCE_MS;
      debounceRef.current = setTimeout(() => {
        dispatch(fetchTickets({ ...filters, ...patch }));
      }, delay);
    },
    [dispatch, filters]
  );

  const clearFilters = useCallback(() => {
    dispatch(resetFilters());
    dispatch(fetchTickets({}));
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { filters, setStatus: (status) => applyFilters({ status }, { immediate: true }),
    setPriority: (priority) => applyFilters({ priority }, { immediate: true }),
    setTicketType: (ticketType) => applyFilters({ ticketType }, { immediate: true }),
    setSearch: (search) => applyFilters({ search }),
    setAssignee: (assignee) => applyFilters({ assignee }, { immediate: true }),
    setDepartment: (department) => applyFilters({ department }, { immediate: true }),
    setDateRange: (dateFrom, dateTo) => applyFilters({ dateFrom, dateTo }, { immediate: true }),
    setSort: (sortBy, sortOrder) => applyFilters({ sortBy, sortOrder }, { immediate: true }),
    clearFilters };
}

export default useTicketFilters;
