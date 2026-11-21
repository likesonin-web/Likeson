"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, UserPlus, Shield, TrendingUp, Search, Filter,
  MoreVertical, Ban, CheckCircle, Mail, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, Eye, Crown, Stethoscope,
  Truck, FlaskConical, ShoppingBag, Heart, DollarSign,
  Circle, AlertTriangle, Download, SlidersHorizontal,
  ArrowUpRight, ArrowDownRight, Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  fetchAllUsers, fetchUsersAnalytics, blockUnblockUser,
  resetUserPassword, verifyUserEmail, deleteUser,
  setFilters, setPage,
  selectAllUsers, selectUsersPagination, selectUsersFilters,
  selectUsersAnalytics, selectListLoading, selectAnalyticsLoading,
  selectBlockLoading, selectDeleteLoading,
} from "@/store/slices/adminUserSlice";

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_META = {
  customer:         { label: "Customer",          icon: Users,         color: "var(--chart-1)" },
  doctor:           { label: "Doctor",             icon: Stethoscope,   color: "var(--chart-2)" },
  pharmacy:         { label: "Pharmacist",         icon: ShoppingBag,   color: "var(--chart-3)" },
  transportpartner: { label: "Transport Partner",  icon: Truck,         color: "var(--chart-4)" },
  "lab partner":    { label: "Lab Partner",        icon: FlaskConical,  color: "var(--chart-5)" },
  "care assistant": { label: "Care Assistant",     icon: Heart,         color: "var(--chart-6)" },
  finance:          { label: "Finance",            icon: DollarSign,    color: "var(--chart-1)" },
  admin:            { label: "Admin",              icon: Shield,        color: "var(--chart-2)" },
  superadmin:       { label: "Super Admin",        icon: Crown,         color: "var(--chart-3)" },
  driver:           { label: "Driver",             icon: Truck,         color: "var(--chart-4)" },
};

const ROLES_LIST = [
  "", "customer", "doctor", "pharmacy", "transportpartner",
  "lab partner", "care assistant", "finance", "driver", "admin",
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
          {label}
        </span>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
          <Icon size={17} style={{ color }} />
        </span>
      </div>
      <p className="font-display text-3xl font-black" style={{ color: "var(--base-content)" }}>
        {value ?? "—"}
      </p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-bold ${trend >= 0 ? "text-success" : "text-error"}`}>
              {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="text-xs" style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>{sub}</span>}
        </div>
      )}
    </motion.div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const meta = ROLE_META[role] || { label: role, icon: Users, color: "var(--neutral)" };
  const Icon = meta.icon;
  return (
    <span className="badge inline-flex items-center gap-1" style={{
      background: `color-mix(in srgb, ${meta.color}, transparent 85%)`,
      color: meta.color,
      border: `1px solid color-mix(in srgb, ${meta.color}, transparent 65%)`,
    }}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ isBlocked, isOnline }) {
  if (isBlocked) return (
    <span className="badge badge-error gap-1"><Ban size={10} />Blocked</span>
  );
  if (isOnline) return (
    <span className="badge badge-success gap-1"><Circle size={8} className="fill-success" />Online</span>
  );
  return (
    <span className="badge" style={{ background: "var(--base-300)", color: "var(--base-content)", border: "1px solid var(--base-300)" }}>
      <Circle size={8} />Offline
    </span>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-sm shadow-xl">
      <p className="font-bold mb-1" style={{ color: "var(--base-content)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── User row action menu ──────────────────────────────────────────────────────
function UserRowMenu({ user, onBlock, onReset, onVerify, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-200 transition-colors">
        <MoreVertical size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-9 z-20 card w-52 py-1 shadow-xl"
              style={{ background: "var(--base-100)" }}
            >
              {[
                { icon: Eye,          label: "View Profile",    href: `/admin/users/${user._id}` },
                { icon: Mail,         label: "Verify Email",    action: () => { onVerify(user._id); setOpen(false); } },
                { icon: RefreshCw,    label: "Reset Password",  action: () => { onReset(user._id); setOpen(false); } },
                { icon: user.isBlocked ? CheckCircle : Ban,
                  label: user.isBlocked ? "Unblock" : "Block",
                  action: () => { onBlock(user); setOpen(false); },
                  color: user.isBlocked ? "var(--success)" : "var(--warning)" },
                { icon: Trash2, label: "Deactivate", action: () => { onDelete(user._id); setOpen(false); }, color: "var(--error)" },
              ].map((item) => (
                item.href ? (
                  <Link key={item.label} href={item.href}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors"
                    style={{ color: item.color || "var(--base-content)" }}
                    onClick={() => setOpen(false)}>
                    <item.icon size={14} />{item.label}
                  </Link>
                ) : (
                  <button key={item.label} onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-base-200 transition-colors text-left"
                    style={{ color: item.color || "var(--base-content)" }}>
                    <item.icon size={14} />{item.label}
                  </button>
                )
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const dispatch = useDispatch();
  const users      = useSelector(selectAllUsers);
  const pagination = useSelector(selectUsersPagination);
  const filters    = useSelector(selectUsersFilters);
  const analytics  = useSelector(selectUsersAnalytics);
  const listLoading     = useSelector(selectListLoading);
  const analyticsLoading = useSelector(selectAnalyticsLoading);

  const [search, setSearch]       = useState(filters.search || "");
  const [showFilters, setShowFilters] = useState(false);

  // Load
  useEffect(() => {
    dispatch(fetchUsersAnalytics());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAllUsers(filters));
  }, [dispatch, filters]);

  const handleSearch = useCallback(() => {
    dispatch(setFilters({ search, page: 1 }));
  }, [dispatch, search]);

  const handleFilter = (key, val) => dispatch(setFilters({ [key]: val, page: 1 }));

  const handleBlock = (user) => {
    const action = user.isBlocked ? "unblock" : "block";
    dispatch(blockUnblockUser({ id: user._id, action, reason: action === "block" ? "Blocked via admin panel" : undefined }));
  };

  const handleReset  = (id) => dispatch(resetUserPassword(id));
  const handleVerify = (id) => dispatch(verifyUserEmail(id));
  const handleDelete = (id) => { if (confirm("Permanently deactivate this account?")) dispatch(deleteUser(id)); };

  // Chart data
  const roleChartData = analytics?.byRole
    ? Object.entries(analytics.byRole).map(([role, count]) => ({
        name: ROLE_META[role]?.label || role,
        value: count,
        color: ROLE_META[role]?.color || "var(--chart-1)",
      }))
    : [];

  const trendData = (analytics?.registrationTrend || []).slice(-14).map(d => ({
    date: d._id?.slice(5),
    users: d.count,
  }));

  const orderData = analytics?.orders
    ? Object.entries(analytics.orders).map(([status, { count, revenue }]) => ({
        status, count, revenue: Math.round(revenue / 1000),
      }))
    : [];

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: "var(--base-100)" }}>

      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-heading !mb-1">User Management</h1>
          <p className="section-subheading !mb-0">
            {pagination.total.toLocaleString()} total users across all roles
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/employees"
            className="btn-secondary flex items-center gap-2 !px-4 !py-2.5">
            <Shield size={15} />Employees
          </Link>
          <Link href="/admin/users/create"
            className="btn-primary-cta flex items-center gap-2 !px-4 !py-2.5">
            <UserPlus size={15} />Add User
          </Link>
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Users",    value: analytics?.summary?.totalUsers?.toLocaleString(),   icon: Users,        color: "var(--chart-1)", delay: 0    },
          { label: "Online Now",     value: analytics?.summary?.onlineUsers,                    icon: Circle,       color: "var(--success)", delay: 0.05 },
          { label: "New This Week",  value: analytics?.summary?.newThisWeek,                    icon: TrendingUp,   color: "var(--chart-2)", delay: 0.1  },
          { label: "Verified",       value: analytics?.summary?.verifiedEmails?.toLocaleString(),icon: CheckCircle, color: "var(--chart-3)", sub: analytics?.summary?.verificationRate, delay: 0.15 },
          { label: "Blocked",        value: analytics?.summary?.blockedUsers,                   icon: Ban,          color: "var(--error)",   delay: 0.2  },
          { label: "Admins",         value: (analytics?.byRole?.admin || 0) + (analytics?.byRole?.superadmin || 0), icon: Shield, color: "var(--chart-5)", delay: 0.25 },
        ].map((s) => (
          analyticsLoading
            ? <div key={s.label} className="skeleton h-28 rounded-xl" />
            : <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Registration Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5 lg:col-span-2">
          <h3 className="text-base font-bold mb-4" style={{ color: "var(--base-content)" }}>
            Registration Trend <span className="text-xs font-normal opacity-50">(last 14 days)</span>
          </h3>
          {analyticsLoading ? <div className="skeleton h-52" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="ugradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="users" stroke="var(--chart-1)"
                  strokeWidth={2.5} fill="url(#ugradient)" name="New Users" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Role Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-5">
          <h3 className="text-base font-bold mb-4" style={{ color: "var(--base-content)" }}>
            By Role
          </h3>
          {analyticsLoading ? <div className="skeleton h-52" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={roleChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {roleChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-2 gap-1 mt-2">
            {roleChartData.slice(0, 6).map((r) => (
              <div key={r.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="truncate opacity-70">{r.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Order Stats Bar Chart */}
      {orderData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass-card p-5">
          <h3 className="text-base font-bold mb-4" style={{ color: "var(--base-content)" }}>
            Pharmacy Orders by Status
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={orderData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--base-content)", opacity: 0.6 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} name="Orders" />
              <Bar dataKey="revenue" fill="var(--chart-2)" radius={[6, 6, 0, 0]} name="Revenue (₹K)" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── Table Section ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card overflow-hidden">

        {/* Table toolbar */}
        <div className="p-5 border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
          style={{ borderColor: "var(--base-300)" }}>
          <div className="flex gap-3 flex-1 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 input-field flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className="opacity-40 flex-shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search name, email, phone…"
                className="bg-transparent flex-1 outline-none text-sm" />
            </div>

            {/* Role filter */}
            <select value={filters.role} onChange={e => handleFilter("role", e.target.value)}
              className="input-field text-sm cursor-pointer">
              {ROLES_LIST.map(r => (
                <option key={r} value={r}>{r ? (ROLE_META[r]?.label || r) : "All Roles"}</option>
              ))}
            </select>

            {/* Status filter */}
            <select value={filters.isBlocked} onChange={e => handleFilter("isBlocked", e.target.value)}
              className="input-field text-sm cursor-pointer">
              <option value="">All Status</option>
              <option value="false">Active</option>
              <option value="true">Blocked</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={() => dispatch(fetchAllUsers(filters))}
              className="btn-secondary !px-3 !py-2.5 !text-xs flex items-center gap-1.5">
              <RefreshCw size={13} />Refresh
            </button>
            <button className="btn-secondary !px-3 !py-2.5 !text-xs flex items-center gap-1.5">
              <Download size={13} />Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--base-200)", borderBottom: "1px solid var(--base-300)" }}>
                {["User", "Role", "Status", "Verified", "Joined", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider"
                    style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {listLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--base-300)" }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="skeleton h-4 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.map((user, i) => (
                  <motion.tr key={user._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-base-200 transition-colors"
                    style={{ borderBottom: "1px solid var(--base-300)" }}>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                          style={{ background: "var(--base-300)" }}>
                          {user.avatar
                            ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                                style={{ color: "var(--primary)" }}>
                                {user.name?.[0]?.toUpperCase()}
                              </div>
                          }
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "var(--base-content)" }}>{user.name}</p>
                          <p className="text-xs opacity-50">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4"><RoleBadge role={user.role} /></td>

                    <td className="px-5 py-4">
                      <StatusDot isBlocked={user.isBlocked} isOnline={user.isOnline} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-xs">
                        {user.isEmailVerified
                          ? <CheckCircle size={13} style={{ color: "var(--success)" }} />
                          : <AlertTriangle size={13} style={{ color: "var(--warning)" }} />
                        }
                        <span className="opacity-60">{user.isEmailVerified ? "Email" : "Unverified"}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs opacity-50">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <UserRowMenu user={user} onBlock={handleBlock}
                        onReset={handleReset} onVerify={handleVerify} onDelete={handleDelete} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {!listLoading && users.length === 0 && (
            <div className="text-center py-16" style={{ color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No users found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 flex items-center justify-between border-t"
          style={{ borderColor: "var(--base-300)" }}>
          <p className="text-xs opacity-50">
            Showing {((filters.page - 1) * filters.limit) + 1}–
            {Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button disabled={filters.page <= 1}
              onClick={() => dispatch(setPage(filters.page - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-200 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold px-2">
              {filters.page} / {pagination.totalPages}
            </span>
            <button disabled={filters.page >= pagination.totalPages}
              onClick={() => dispatch(setPage(filters.page + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-200 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}