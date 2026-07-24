"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Copy,
  MessageCircle,
  Gift,
  Users,
  Coins,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Send,
  Mail,
  MessageSquareText,
  IndianRupee,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  Link2,
  UserCheck,
  PartyPopper,
} from "lucide-react";

import SpecialButton from "@/components/SpecialButton";
import {
  getMyReferralCode,
  getMyReferrals,
  redeemReferralCoins,
  clearLastRedeem,
  clearReferralError,
} from "@/store/slices/referralSlice";
import { patchCoins } from "@/store/slices/userSlice";

// ─────────────────────────────────────────────────────────────────────────────
// Share message templates
// ─────────────────────────────────────────────────────────────────────────────

const SHARE_TEMPLATES = [
  {
    id: "casual",
    label: "Casual",
    text:
      "Hey! 👋 I've been using *Likeson Healthcare* for doctor bookings, medicines & lab tests — super easy to use.\n\nUse my code *{code}* when you sign up and get ₹{bonus} instantly! 🎁\n\n{url}",
  },
  {
    id: "professional",
    label: "Professional",
    text:
      "I'd like to recommend *Likeson Healthcare* — a reliable platform for doctor consultations, pharmacy orders, and diagnostic tests.\n\nSign up with referral code *{code}* to receive a welcome bonus of ₹{bonus}.\n\n{url}",
  },
  {
    id: "festive",
    label: "Festive",
    text:
      "🎉 A little gift for you! Join *Likeson Healthcare* using my code *{code}* and get ₹{bonus} credited to your wallet instantly.\n\nHealthcare made simple. 💙\n\n{url}",
  },
  {
    id: "family",
    label: "Family & Friends",
    text:
      "Hi! Adding you here because I think you'll find this useful — *Likeson Healthcare* handles doctor visits, medicines & lab tests all in one app.\n\nUse code *{code}* at signup, you'll get ₹{bonus} free. Try it out! 🙂\n\n{url}",
  },
];

const fillTemplate = (text, { code, bonus, url }) =>
  text
    .replaceAll("{code}", code || "——")
    .replaceAll("{bonus}", bonus ?? "0")
    .replaceAll("{url}", url || "");

const REDEEM_QUICK_PCTS = [25, 50, 100];

// ─────────────────────────────────────────────────────────────────────────────
// Presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
      className="stat-card flex items-center gap-4"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="skeleton h-6 w-16 mb-1" />
        ) : (
          <p className="stat-card-value truncate">{value}</p>
        )}
        <p className="stat-card-label">{label}</p>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  if (status === "completed") {
    return (
      <span className="badge badge-success badge-sm gap-1">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Completed
      </span>
    );
  }
  return (
    <span className="badge badge-warning badge-sm gap-1">
      <Clock className="h-3 w-3" aria-hidden="true" /> Pending
    </span>
  );
}

function HowItWorksStep({ index, icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-content text-xs font-black">
        {index}
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-bold text-base-content">
          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {title}
        </p>
        <p className="text-xs text-base-content/60 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function MyReferral() {
  const dispatch = useDispatch();

  const myCode = useSelector((s) => s.referral.myCode);
  const myReferrals = useSelector((s) => s.referral.myReferrals);
  const lastRedeem = useSelector((s) => s.referral.lastRedeem);
  const loaders = useSelector((s) => s.referral.loaders);
  const error = useSelector((s) => s.referral.error);

  const [templateId, setTemplateId] = useState(SHARE_TEMPLATES[0].id);
  const [statusFilter, setStatusFilter] = useState(""); // '' | pending | completed
  const [page, setPage] = useState(1);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [copied, setCopied] = useState(false);

  const redeemInputRef = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(getMyReferralCode());
    return () => dispatch(clearReferralError());
  }, [dispatch]);

  useEffect(() => {
    dispatch(getMyReferrals({ page, limit: 10, status: statusFilter || undefined }));
  }, [dispatch, page, statusFilter]);

  // Auto-dismiss the redeem success banner
  useEffect(() => {
    if (!lastRedeem) return;
    const t = setTimeout(() => dispatch(clearLastRedeem()), 8000);
    return () => clearTimeout(t);
  }, [lastRedeem, dispatch]);

  const activeTemplate = useMemo(
    () => SHARE_TEMPLATES.find((t) => t.id === templateId) ?? SHARE_TEMPLATES[0],
    [templateId]
  );

  const filledMessage = useMemo(
    () =>
      fillTemplate(activeTemplate.text, {
        code: myCode.referralCode,
        bonus: myCode.refereeBonus,
        url: myCode.shareableUrl,
      }),
    [activeTemplate, myCode.referralCode, myCode.refereeBonus, myCode.shareableUrl]
  );

  const redeemPointsNum = parseInt(redeemPoints, 10) || 0;
  const hasEnoughForMin = myCode.redeemPoints >= myCode.minRedeemPoints;
  const redeemDisabled =
    loaders.redeemCoins ||
    !redeemPointsNum ||
    redeemPointsNum < myCode.minRedeemPoints ||
    redeemPointsNum > myCode.redeemPoints;

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleCopyCode = useCallback(() => {
    if (!myCode.referralCode) return;
    navigator.clipboard.writeText(myCode.referralCode);
    setCopied(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopied(false), 1800);
  }, [myCode.referralCode]);

  const handleCopyMessage = useCallback(() => {
    if (!myCode.referralCode) return;
    navigator.clipboard.writeText(filledMessage);
    toast.success("Message copied — paste it anywhere!");
  }, [filledMessage, myCode.referralCode]);

  const handleWhatsAppShare = useCallback(() => {
    if (!myCode.referralCode) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(filledMessage)}`, "_blank", "noopener,noreferrer");
  }, [filledMessage, myCode.referralCode]);

  const handleSmsShare = useCallback(() => {
    if (!myCode.referralCode) return;
    window.open(`sms:?&body=${encodeURIComponent(filledMessage)}`, "_self");
  }, [filledMessage, myCode.referralCode]);

  const handleEmailShare = useCallback(() => {
    if (!myCode.referralCode) return;
    const subject = encodeURIComponent("Join me on Likeson Healthcare");
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(filledMessage)}`, "_self");
  }, [filledMessage, myCode.referralCode]);

  const handleNativeShare = useCallback(async () => {
    if (!myCode.referralCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Likeson Healthcare",
          text: filledMessage,
          url: myCode.shareableUrl,
        });
      } catch {
        /* user cancelled — no-op */
      }
    } else {
      handleCopyMessage();
    }
  }, [filledMessage, myCode.shareableUrl, myCode.referralCode, handleCopyMessage]);

  const applyQuickPct = useCallback(
    (pct) => {
      const amount = Math.floor((myCode.redeemPoints * pct) / 100);
      setRedeemPoints(String(Math.max(amount, 0)));
      redeemInputRef.current?.focus();
    },
    [myCode.redeemPoints]
  );

  const handleRedeem = useCallback(async () => {
    if (redeemPointsNum < myCode.minRedeemPoints) {
      toast.error(`Minimum ${myCode.minRedeemPoints} coins required.`);
      return;
    }
    if (redeemPointsNum > myCode.redeemPoints) {
      toast.error("You don't have enough coins.");
      return;
    }
    try {
      const result = await dispatch(redeemReferralCoins(redeemPointsNum)).unwrap();
      dispatch(patchCoins?.(result.remainingCoins) ?? { type: "noop" });
      setRedeemPoints("");
    } catch {
      /* toast already fired inside thunk */
    }
  }, [dispatch, redeemPointsNum, myCode.minRedeemPoints, myCode.redeemPoints]);

  const referrals = myReferrals.data ?? [];
  const pagination = myReferrals.pagination;
  const isInitialLoading = loaders.myCode && !myCode.referralCode;

  return (
    <div className="container-custom py-6 md:py-10 pb-24 md:pb-10 max-w-6xl">
      {/* ── Global error banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="alert alert-error mb-6"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-error mt-0.5" aria-hidden="true" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page heading ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Refer & Earn
            </span>
          </div>
          <h1 className="section-heading mb-0">My Referrals</h1>
          <p className="section-subheading mb-0">
            Invite friends & family, earn coins every time they join.
          </p>
        </div>

        <SpecialButton
          role="customer"
          variant="outline"
          size="sm"
          animation="press"
          icon={RefreshCw}
          fullWidth={false}
          disabled={loaders.myCode || loaders.myReferrals}
          onClick={() => {
            dispatch(getMyReferralCode());
            dispatch(getMyReferrals({ page, limit: 10, status: statusFilter || undefined }));
          }}
          className="w-fit"
        >
          {loaders.myCode || loaders.myReferrals ? "Refreshing…" : "Refresh"}
        </SpecialButton>
      </motion.div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        <StatCard icon={Coins} label="Coin Balance" value={myCode.redeemPoints} delay={0.02} loading={isInitialLoading} />
        <StatCard icon={IndianRupee} label="Coin Value" value={myCode.coinsValue} delay={0.06} loading={isInitialLoading} />
        <StatCard icon={CheckCircle2} label="Successful" value={myCode.successfulReferrals} delay={0.1} loading={isInitialLoading} />
        <StatCard icon={Clock} label="Pending" value={myCode.pendingReferrals} delay={0.14} loading={isInitialLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ── LEFT: Share card ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card p-5 md:p-6 lg:col-span-3"
        >
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold text-base-content">Share your code</h2>
          </div>

          {/* Referral code box */}
          <div className="mb-2 flex items-center gap-2">
            <div className="input-field flex-1 flex items-center justify-between font-mono text-base font-bold tracking-widest">
              <span aria-live="polite">
                {isInitialLoading ? "········" : myCode.referralCode || "—"}
              </span>
              <Link2 className="h-4 w-4 text-base-content/30 flex-shrink-0" aria-hidden="true" />
            </div>
            <button
              onClick={handleCopyCode}
              disabled={!myCode.referralCode}
              className="btn btn-primary btn-circle flex-shrink-0"
              aria-label="Copy referral code"
              type="button"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <p className="text-xs text-base-content/50 mb-5 truncate">
            {myCode.shareableUrl || "Your unique signup link will appear here"}
          </p>

          {/* Template selector */}
          <p className="label-text mb-2">Choose a message style</p>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Message style">
            {SHARE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === templateId}
                onClick={() => setTemplateId(t.id)}
                className={
                  t.id === templateId
                    ? "badge badge-primary badge-sm cursor-pointer"
                    : "badge badge-sm cursor-pointer bg-base-200 text-base-content/60 border border-base-300"
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live preview */}
          <AnimatePresence mode="wait">
            <motion.div
              key={templateId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="mb-5 rounded-[var(--r-field)] border border-base-300 bg-base-200 p-4"
            >
              <p className="whitespace-pre-line text-sm leading-relaxed text-base-content/90">
                {filledMessage}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Primary action */}
          <SpecialButton
            mood={{
              accent: "#25D366",
              barGradient: "linear-gradient(90deg,#25D366,#128C7E)",
              shadowColor: "rgba(37,211,102,0.35)",
              label: "WhatsApp",
            }}
            
            icon={MessageCircle}
            animation="lift"
            textAnimation="fade"
            disabled={!myCode.referralCode}
            onClick={handleWhatsAppShare}
            className="mb-3"
          >
            Share on WhatsApp
          </SpecialButton>

          {/* Secondary actions */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SpecialButton
              role="customer"
              variant="soft"
              size="sm"
              icon={Send}
              animation="press"
              textAnimation="fade"
              disabled={!myCode.referralCode}
              onClick={handleNativeShare}
            >
              Share
            </SpecialButton>
            <SpecialButton
              role="customer"
              variant="soft"
              size="sm"
              icon={MessageSquareText}
              animation="press"
              textAnimation="fade"
              disabled={!myCode.referralCode}
              onClick={handleSmsShare}
            >
              SMS
            </SpecialButton>
            <SpecialButton
              role="customer"
              variant="soft"
              size="sm"
              icon={Mail}
              animation="press"
              textAnimation="fade"
              disabled={!myCode.referralCode}
              onClick={handleEmailShare}
            >
              Email
            </SpecialButton>
            <SpecialButton
              role="customer"
              variant="outline"
              size="sm"
              icon={Copy}
              animation="press"
              textAnimation="fade"
              disabled={!myCode.referralCode}
              onClick={handleCopyMessage}
            >
              Copy
            </SpecialButton>
          </div>
        </motion.div>

        {/* ── RIGHT: Redeem card ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="card p-5 md:p-6 lg:col-span-2 flex flex-col"
        >
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
              <Wallet className="h-4 w-4 text-success" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold text-base-content">Redeem Coins</h2>
          </div>

          <div className="mb-4 rounded-[var(--r-field)] bg-success/5 border border-success/30 px-4 py-3">
            <p className="label-text-alt mb-1">Available balance</p>
            <p className="text-2xl font-black text-success">
              {myCode.redeemPoints} <span className="text-sm font-semibold">coins</span>
            </p>
            <p className="text-xs text-base-content/50">≈ {myCode.coinsValue}</p>
          </div>

          {!hasEnoughForMin && (
            <div className="alert alert-info mb-4">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-info mt-0.5" aria-hidden="true" />
              <p className="text-xs">
                You need at least {myCode.minRedeemPoints} coins to redeem. Keep referring to unlock this.
              </p>
            </div>
          )}

          <label htmlFor="redeem-points" className="label-text mb-1.5">
            Coins to redeem
          </label>
          <input
            id="redeem-points"
            ref={redeemInputRef}
            type="number"
            min={myCode.minRedeemPoints}
            max={myCode.redeemPoints}
            value={redeemPoints}
            onChange={(e) => setRedeemPoints(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={`Min ${myCode.minRedeemPoints} coins`}
            disabled={!hasEnoughForMin}
            className="input-field mb-2"
          />

          <div className="mb-3 flex gap-2">
            {REDEEM_QUICK_PCTS.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={!hasEnoughForMin}
                onClick={() => applyQuickPct(pct)}
                className="badge badge-sm cursor-pointer bg-base-200 text-base-content/60 border border-base-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>

          <p className="text-xs text-base-content/50 mb-4">
            {redeemPointsNum
              ? `You'll receive ₹${(redeemPointsNum / (myCode.pointsPerRupee || 100)).toFixed(2)}`
              : `${myCode.pointsPerRupee} coins = ₹1`}
          </p>

          <SpecialButton
            role="customer"
            icon={Coins}
            animation="glow"
            disabled={redeemDisabled}
            onClick={handleRedeem}
            className="mt-auto"
          >
            {loaders.redeemCoins ? "Redeeming…" : "Redeem to Wallet"}
          </SpecialButton>

          <AnimatePresence>
            {lastRedeem && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 alert alert-success"
                role="status"
              >
                <PartyPopper className="h-4 w-4 flex-shrink-0 text-success mt-0.5" aria-hidden="true" />
                <p className="text-sm">
                  Converted <b>{lastRedeem.pointsRedeemed}</b> coins → ₹{lastRedeem.rupeesEarned}. Wallet
                  balance: ₹{lastRedeem.walletBalance}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="card mt-6 p-5 md:p-6 grid grid-cols-1 gap-5 sm:grid-cols-3"
      >
        <HowItWorksStep
          index={1}
          icon={Send}
          title="Share your code"
          desc="Send your unique link to friends and family via WhatsApp, SMS or email."
        />
        <HowItWorksStep
          index={2}
          icon={UserPlus}
          title="They sign up"
          desc={`Your friend enters your code at signup and gets ₹${((myCode.refereeBonus || 0) / (myCode.pointsPerRupee || 100)).toFixed(0)} instantly.`}
        />
        <HowItWorksStep
          index={3}
          icon={UserCheck}
          title="You both earn"
          desc={`You receive ${myCode.coinsPerReferral} coins the moment they log in for the first time.`}
        />
      </motion.div>

      {/* ── Referral list ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="card mt-6 p-5 md:p-6"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
              <Users className="h-4 w-4 text-accent" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold text-base-content">Your Invites</h2>
          </div>

          <div className="flex gap-2" role="tablist" aria-label="Filter referrals by status">
            {["", "pending", "completed"].map((s) => (
              <button
                key={s || "all"}
                type="button"
                role="tab"
                aria-selected={statusFilter === s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={
                  statusFilter === s
                    ? "badge badge-primary badge-sm cursor-pointer"
                    : "badge badge-sm cursor-pointer bg-base-200 text-base-content/60 border border-base-300"
                }
              >
                {s === "" ? "All" : s === "pending" ? "Pending" : "Completed"}
              </button>
            ))}
          </div>
        </div>

        {loaders.myReferrals ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <UserPlus className="mb-3 h-10 w-10 text-base-content/30" aria-hidden="true" />
            <p className="font-semibold text-base-content/70">
              {statusFilter ? `No ${statusFilter} referrals yet` : "No referrals yet"}
            </p>
            <p className="text-sm text-base-content/50">
              Share your code above to start earning coins.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hide-mobile overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Coins</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r._id}>
                      <td className="font-semibold">{r.referredUserName || "—"}</td>
                      <td className="text-base-content/70">{r.referredUserEmail || "—"}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="font-bold text-primary">
                        {r.status === "completed" ? `+${r.pointsAwarded}` : "—"}
                      </td>
                      <td className="text-base-content/50">
                        {new Date(r.completedAt || r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="show-mobile space-y-3">
              {referrals.map((r) => (
                <div key={r._id} className="rounded-[var(--r-field)] border border-base-300 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-semibold">{r.referredUserName || "—"}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mb-1 text-xs text-base-content/60">{r.referredUserEmail || "—"}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-base-content/50">
                      {new Date(r.completedAt || r.createdAt).toLocaleDateString()}
                    </span>
                    {r.status === "completed" && (
                      <span className="font-bold text-primary">+{r.pointsAwarded} coins</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
                </button>
                <span className="text-xs text-base-content/50">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  className="btn btn-ghost btn-sm"
                >
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-2 text-xs text-base-content/50">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          Earn {myCode.coinsPerReferral} coins per successful referral. Your friend gets{" "}
          {myCode.refereeBonus} coins too.
        </span>
      </div>

      {/* ── Sticky mobile CTA ────────────────────────────────────────────── */}
      <div className="show-mobile fixed inset-x-0 bottom-0 z-40 border-t border-base-300 bg-base-100/95 backdrop-blur-strong p-3 safe-bottom">
        <SpecialButton
          mood={{
            accent: "#25D366",
            barGradient: "linear-gradient(90deg,#25D366,#128C7E)",
            shadowColor: "rgba(37,211,102,0.35)",
            label: "WhatsApp",
          }}
          icon={MessageCircle}
          animation="press"
          textAnimation="fade"
          disabled={!myCode.referralCode}
          onClick={handleWhatsAppShare}
        >
          Share & Earn {myCode.coinsPerReferral} Coins
        </SpecialButton>
      </div>
    </div>
  );
}