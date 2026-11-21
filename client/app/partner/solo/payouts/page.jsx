'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  SendHorizonal, DollarSign, Percent, CalendarCheck, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, IndianRupee, Banknote,
  Receipt, Wallet, TrendingUp, ChevronDown, RefreshCw, Info, X
} from 'lucide-react';
import {
  fetchBankDetails,
  fetchSettlementSummary,
  fetchPricing,
  selectBankDetails,
  selectSettlementSummary,
  selectPricing,
  selectProfile,
  selectLoading,
} from '@/store/slices/soloDriverSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

const mockPayoutData = [
  { label: 'Base Fare', amount: 8400, color: 'var(--primary)' },
  { label: 'Waiting Charges', amount: 320, color: 'var(--secondary)' },
  { label: 'Night Surcharge', amount: 580, color: 'var(--accent)' },
  { label: 'Platform Fee', amount: -1030, color: 'var(--error)' },
  { label: 'Net Payout', amount: 8270, color: 'var(--success)' },
];

const mockUpcomingPayouts = [
  { date: '2026-04-01', amount: 4850, rides: 14, status: 'scheduled', method: 'Bank Transfer' },
  { date: '2026-03-25', amount: 3200, rides: 10, status: 'processing', method: 'Bank Transfer' },
];

const historyData = [
  { week: 'Mar W1', gross: 6200, fee: 744, net: 5456 },
  { week: 'Mar W2', gross: 5800, fee: 696, net: 5104 },
  { week: 'Mar W3', gross: 7100, fee: 852, net: 6248 },
  { week: 'Mar W4', gross: 4900, fee: 588, net: 4312 },
];

function FareRow({ label, amount, sub, accent }) {
  const isNeg = amount < 0;
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: 'var(--base-300)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: accent ? 'var(--primary)' : 'var(--base-content)' }}>{label}</p>
        {sub && <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>{sub}</p>}
      </div>
      <p className={`text-sm font-bold ${isNeg ? 'text-error' : accent ? 'text-success' : ''}`}
        style={{ color: !isNeg && !accent ? 'var(--base-content)' : undefined }}>
        {isNeg ? '-' : '+'}₹{Math.abs(amount).toLocaleString()}
      </p>
    </div>
  );
}

function RequestPayoutModal({ onClose, bankDetails, pendingAmount }) {
  const [method, setMethod] = useState('Bank Transfer');
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const bd = bankDetails?.bankDetails;

  const handleRequest = async () => {
    setConfirming(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setDone(true);
    setConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)' }}
      >
        {done ? (
          <div className="p-8 flex flex-col items-center text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            </motion.div>
            <h3 className="text-xl font-black mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
              Payout Requested!
            </h3>
            <p className="text-sm mb-6" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              ₹{pendingAmount.toLocaleString()} will be credited within 24–48 hours via {method}.
            </p>
            <button onClick={onClose} className="btn-primary-cta px-8">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--base-300)' }}>
              <div>
                <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                  Request Payout
                </h3>
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  Instant transfer available
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
                <X size={18} style={{ color: 'var(--base-content)' }} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Amount */}
              <div className="p-4 rounded-xl text-center"
                style={{ background: 'color-mix(in srgb, var(--success), transparent 90%)', border: '1px solid color-mix(in srgb, var(--success), transparent 70%)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--success)' }}>
                  Available to Withdraw
                </p>
                <p className="text-4xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--success)' }}>
                  ₹{pendingAmount.toLocaleString()}
                </p>
              </div>

              {/* Method */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>Payout Method</p>
                <div className="grid grid-cols-2 gap-3">
                  {['Bank Transfer', 'UPI'].map(m => (
                    <button key={m} onClick={() => setMethod(m)}
                      className="p-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: method === m ? 'var(--primary)' : 'var(--base-200)',
                        color: method === m ? 'var(--primary-content)' : 'var(--base-content)',
                        border: `1px solid ${method === m ? 'var(--primary)' : 'var(--base-300)'}`,
                      }}>
                      {m === 'Bank Transfer' ? '🏦 ' : '📱 '}{m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination */}
              {bd && (
                <div className="p-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}>
                  <Banknote size={16} style={{ color: 'var(--primary)' }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>
                      {bd.bankName} · XXXX {bd.accountLast4}
                    </p>
                    <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                      {bd.accountHolderName}
                    </p>
                  </div>
                  <CheckCircle2 size={14} className="ml-auto" style={{ color: 'var(--success)' }} />
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--warning), transparent 90%)', border: '1px solid color-mix(in srgb, var(--warning), transparent 70%)' }}>
                <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                <p className="text-xs" style={{ color: 'var(--base-content)' }}>
                  Processing takes 24–48 hours. Platform fee has already been deducted from your balance.
                </p>
              </div>

              <button onClick={handleRequest} disabled={confirming}
                className="btn-primary-cta w-full flex items-center justify-center gap-2">
                {confirming
                  ? <><RefreshCw size={16} className="animate-spin" /> Processing...</>
                  : <><SendHorizonal size={16} /> Request ₹{pendingAmount.toLocaleString()}</>}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Payouts() {
  const dispatch = useDispatch();
  const bankDetails = useSelector(selectBankDetails);
  const settlement = useSelector(selectSettlementSummary);
  const pricing = useSelector(selectPricing);
  const profile = useSelector(selectProfile);
  const loading = useSelector(selectLoading('settlement'));
  const [showModal, setShowModal] = useState(false);
  const [expandBreakdown, setExpandBreakdown] = useState(true);

  useEffect(() => {
    dispatch(fetchBankDetails());
    dispatch(fetchSettlementSummary());
    dispatch(fetchPricing());
  }, [dispatch]);

  const pending = settlement?.summary?.pendingAmount ?? 4850;
  const totalSettled = settlement?.summary?.totalSettled ?? 38400;
  const effectiveFee = pricing?.effectivePlatformFee;
  const feeDisplay = effectiveFee
    ? (effectiveFee.type === 'percentage' ? `${effectiveFee.value}%` : `₹${effectiveFee.value} flat`)
    : 'Platform default';

  const hasBankAccount = bankDetails?.bankDetails?.ifscCode;
  const isVerified = bankDetails?.bankDetails?.isVerified;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
              <Banknote size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Payouts
              </h1>
              <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Earnings · Deductions · Transfers
              </p>
            </div>
          </div>
          <button onClick={() => { dispatch(fetchSettlementSummary()); dispatch(fetchBankDetails()); }}
            className="p-2.5 rounded-xl transition-all hover:bg-base-200"
            style={{ border: '1px solid var(--base-300)' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--base-content)' }} />
          </button>
        </motion.div>

        {/* Alert: no bank / unverified */}
        {!hasBankAccount && (
          <motion.div variants={fadeUp} custom={0.3} initial="hidden" animate="show"
            className="flex items-start gap-3 p-4 rounded-xl mb-6"
            style={{ background: 'color-mix(in srgb, var(--warning), transparent 88%)', border: '1px solid color-mix(in srgb, var(--warning), transparent 60%)' }}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div>
              <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--base-content)' }}>Bank Account Required</p>
              <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                Add a verified bank account to receive payouts.
              </p>
            </div>
            <a href="/partner/solo/bank" className="ml-auto shrink-0">
              <ArrowRight size={16} style={{ color: 'var(--warning)' }} />
            </a>
          </motion.div>
        )}

        {/* Pending Payout Hero */}
        <motion.div variants={fadeUp} custom={0.5} initial="hidden" animate="show"
          className="relative overflow-hidden rounded-2xl p-6 mb-6"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            boxShadow: '0 20px 60px color-mix(in srgb, var(--primary), transparent 55%)',
          }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Pending Payout</p>
            <p className="text-5xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              ₹{pending.toLocaleString()}
            </p>
            <p className="text-white/60 text-xs mb-5">
              Platform fee deducted · Net amount
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5 py-4 border-y border-white/20">
              <div>
                <p className="text-white/60 text-xs mb-0.5">Platform Fee</p>
                <p className="text-white font-bold">{feeDisplay}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-0.5">Total Settled</p>
                <p className="text-white font-bold">₹{totalSettled.toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              disabled={!hasBankAccount || !isVerified || pending === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: (!hasBankAccount || !isVerified || pending === 0) ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
                color: (!hasBankAccount || !isVerified || pending === 0) ? 'rgba(255,255,255,0.5)' : 'var(--primary)',
                cursor: (!hasBankAccount || !isVerified || pending === 0) ? 'not-allowed' : 'pointer',
              }}>
              <SendHorizonal size={16} />
              {!hasBankAccount ? 'Add Bank Account First' : !isVerified ? 'Bank Verification Pending' : `Request Payout`}
            </button>
          </div>
        </motion.div>

        {/* Earnings Breakdown */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show" className="card overflow-hidden mb-6">
          <button
            onClick={() => setExpandBreakdown(v => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-base-200 transition-colors">
            <div className="flex items-center gap-3">
              <Receipt size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                This Cycle Breakdown
              </h3>
            </div>
            <motion.div animate={{ rotate: expandBreakdown ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} style={{ color: 'var(--base-content)' }} />
            </motion.div>
          </button>

          <AnimatePresence>
            {expandBreakdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden">
                <div className="px-5 pb-5">
                  <FareRow label="Base Fare" amount={8400} sub="12 rides × avg ₹700" />
                  <FareRow label="Waiting Charges" amount={320} sub="32 minutes total" />
                  <FareRow label="Night Surcharge" amount={580} sub="20% on 3 night rides" />
                  <FareRow label="Wheelchair Surcharge" amount={100} sub="1 accessible ride" />
                  <FareRow label="Gross Earnings" amount={9400} accent />
                  <FareRow label="Platform Fee" amount={-1130} sub={feeDisplay} />
                  <div className="mt-2 pt-3" style={{ borderTop: '2px solid var(--primary)' }}>
                    <FareRow label="Net Payout" amount={8270} accent />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Weekly History Chart */}
        <motion.div variants={fadeUp} custom={1.5} initial="hidden" animate="show" className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
              Payout History
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={historyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }}
                formatter={(v, n) => [`₹${v.toLocaleString()}`, n]}
              />
              <Bar dataKey="gross" name="Gross" fill="var(--primary)" radius={[4, 4, 0, 0]} fillOpacity={0.5} />
              <Bar dataKey="net" name="Net Payout" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Upcoming Payouts */}
        <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" className="card overflow-hidden">
          <div className="p-5 border-b" style={{ borderColor: 'var(--base-300)' }}>
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} style={{ color: 'var(--info)' }} />
              <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Upcoming Payouts
              </h3>
            </div>
          </div>
          <div className="p-3">
            {mockUpcomingPayouts.map((payout, i) => (
              <motion.div key={i} variants={fadeUp} custom={i * 0.1} initial="hidden" animate="show"
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-base-200 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: payout.status === 'scheduled'
                      ? 'color-mix(in srgb, var(--info), transparent 88%)'
                      : 'color-mix(in srgb, var(--warning), transparent 88%)',
                  }}>
                  {payout.status === 'scheduled'
                    ? <CalendarCheck size={16} style={{ color: 'var(--info)' }} />
                    : <Clock size={16} style={{ color: 'var(--warning)' }} />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
                    {payout.method} · {payout.rides} rides
                  </p>
                  <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                    {new Date(payout.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-base text-success">₹{payout.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold capitalize
                    ${payout.status === 'scheduled' ? 'text-info' : 'text-warning'}`}
                    style={{
                      background: payout.status === 'scheduled'
                        ? 'color-mix(in srgb, var(--info), transparent 88%)'
                        : 'color-mix(in srgb, var(--warning), transparent 88%)',
                    }}>
                    {payout.status === 'scheduled' ? <CalendarCheck size={10} /> : <Clock size={10} />}
                    {payout.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <RequestPayoutModal
            onClose={() => setShowModal(false)}
            bankDetails={bankDetails}
            pendingAmount={pending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}