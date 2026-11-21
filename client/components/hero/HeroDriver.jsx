'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import {
  Navigation, Star, Shield, Zap,
  MapPin, IndianRupee, Car, CheckCircle2,
  Wallet, ChevronRight, TrendingUp, AlertCircle,
} from 'lucide-react';
import { fetchDriverMe, updateDriverStatus } from '@/store/slices/transportPartnerSlice';

// ── Online/Offline Toggle ──────────────────────────────────────────────────
function OnlineToggle({ isOnline, onToggle }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-sm font-semibold"
        style={{ color: 'var(--base-content)', opacity: isOnline ? 0.4 : 1 }}
      >
        Offline
      </span>

      {/* Real toggle switch */}
      <button
        role="switch"
        aria-checked={isOnline}
        onClick={onToggle}
        style={{
          width: '52px',
          height: '28px',
          borderRadius: '9999px',
          padding: '3px',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.25s ease',
          backgroundColor: isOnline ? 'var(--success)' : 'var(--base-300)',
          outline: 'none',
        }}
      >
        <span
          style={{
            display: 'block',
            width: '22px',
            height: '22px',
            borderRadius: '9999px',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            transition: 'transform 0.25s ease',
            transform: isOnline ? 'translateX(24px)' : 'translateX(0px)',
          }}
        />
      </button>

      <span
        className="text-sm font-semibold"
        style={{ color: 'var(--base-content)', opacity: isOnline ? 1 : 0.4 }}
      >
        Online
      </span>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 'var(--r-box)',
        border: '1px solid var(--base-300)',
        backgroundColor: 'var(--base-200)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--r-field)',
          backgroundColor: bg,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <p
        style={{
          fontSize: '10px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'var(--base-content)',
          opacity: 0.5,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '22px',
          fontWeight: 900,
          color: color,
          lineHeight: 1,
          margin: 0,
          fontFamily: 'var(--font-family-poppins)',
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Feature Pill ──────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, text }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '9999px',
        border: '1px solid color-mix(in srgb, var(--primary), transparent 80%)',
        backgroundColor: 'color-mix(in srgb, var(--primary), transparent 92%)',
        color: 'var(--primary)',
        fontSize: '11px',
        fontWeight: 700,
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {text}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function HeroDriver() {
  const dispatch = useDispatch();
  const { driverMe, loading } = useSelector((state) => state.transportPartner);

  useEffect(() => {
    dispatch(fetchDriverMe());
  }, [dispatch]);

  // Derived values from JSON structure
  const firstName    = driverMe?.user?.name?.split(' ')[0] ?? 'Partner';
  const fullName     = driverMe?.user?.name ?? 'Driver Partner';
  const rating       = driverMe?.performance?.rating ?? 0;
  // Fallback to '—' since assignedVehicleId is null in the provided JSON payload
  const vehicleNo    = driverMe?.assignedVehicleSnapshot?.registrationNumber ?? '—'; 
  const isOnline     = driverMe?.status === 'Available' || driverMe?.status === 'On-Trip';
  const totalEarning = driverMe?.performance?.totalEarnings ?? 0;
  const totalRides   = driverMe?.performance?.totalRidesCompleted ?? 0;
  const coinBalance  = driverMe?.rewards?.coinBalance ?? 0;
  const monthlyRides = driverMe?.performance?.monthlyRides ?? 0;
  const kycValid     = driverMe?.kyc?.verificationStatus === 'Verified';
  const isAgency     = !!driverMe?.ownerAgency;

  const handleToggle = () => {
    const next = isOnline ? 'Offline' : 'Available';
    dispatch(updateDriverStatus({ status: next }));
  };

  // Loading state
  if (loading && !driverMe) {
    return (
      <section
        data-theme="driver"
        style={{
          minHeight: '92vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--base-100)',
        }}
      >
        <span className="loading loading-lg loading-spinner" />
      </section>
    );
  }

  return (
    <section
      data-theme="driver"
      style={{
        minHeight: '92vh',
        backgroundColor: 'var(--base-100)',
        fontFamily: 'var(--font-family-poppins)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '64px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'start',
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Online toggle */}
          <OnlineToggle isOnline={isOnline} onToggle={handleToggle} />

          {/* Greeting */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p
              style={{
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--base-content)',
                opacity: 0.45,
                margin: 0,
              }}
            >
              Welcome back
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-family-poppins)',
                fontSize: 'clamp(36px, 6vw, 56px)',
                fontWeight: 900,
                lineHeight: 1,
                color: 'var(--base-content)',
                margin: 0,
              }}
            >
              {firstName},<br />
              <span
                style={{
                  backgroundImage: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Let&apos;s Roll.
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: 'var(--base-content)',
              opacity: 0.55,
              maxWidth: '440px',
              margin: 0,
            }}
          >
            Your dashboard, your earnings, your schedule. Drive smarter with real-time surge zones, instant settlements, and full compliance tracking.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <FeaturePill icon={Shield}     text="Insured Rides"  />
            <FeaturePill icon={Zap}        text="Instant Payout" />
            <FeaturePill icon={MapPin}     text="Smart Routing"  />
            <FeaturePill icon={TrendingUp} text="Surge Alerts"   />
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Link href="/driver/dashboard">
              <button className="btn btn-primary text-white" style={{ gap: '8px', borderRadius: 'var(--r-field)', fontFamily: 'var(--font-family-poppins)', fontWeight: 700 }}>
                <Navigation size={15} strokeWidth={2.5} />
                Go to Dashboard
              </button>
            </Link>
            <Link href="/driver/bookings">
              <button className="btn btn-outline" style={{ gap: '6px', borderRadius: 'var(--r-field)', fontFamily: 'var(--font-family-poppins)', fontWeight: 700 }}>
                View Bookings
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </Link>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            <StatCard
              icon={IndianRupee}
              label="Total Earnings"
              value={`₹${totalEarning.toLocaleString('en-IN')}`}
              color="var(--accent)"
              bg="color-mix(in srgb, var(--accent), transparent 88%)"
            />
            <StatCard
              icon={Car}
              label="Rides Completed"
              value={totalRides}
              color="var(--primary)"
              bg="color-mix(in srgb, var(--primary), transparent 88%)"
            />
            <StatCard
              icon={Star}
              label="Rating"
              value={`${rating.toFixed(1)} ★`}
              color="var(--warning)"
              bg="color-mix(in srgb, var(--warning), transparent 88%)"
            />
            <StatCard
              icon={Car}
              label="Monthly Rides"
              value={`${monthlyRides}/mo`}
              color="var(--success)"
              bg="color-mix(in srgb, var(--success), transparent 88%)"
            />
          </div>
        </div>

        {/* ── RIGHT COLUMN — Driver Card ── */}
        <div
          style={{
            border: '1px solid color-mix(in srgb, var(--primary), transparent 75%)',
            borderRadius: 'var(--r-box)',
            backgroundColor: 'var(--base-200)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Driver info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--r-field)',
                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: 900,
                    color: 'var(--primary-content)',
                  }}
                >
                  {fullName.charAt(0).toUpperCase()}
                </div>
                {/* Status dot */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '9999px',
                    border: '2px solid var(--base-200)',
                    backgroundColor: isOnline ? 'var(--success)' : 'var(--base-300)',
                  }}
                />
              </div>

              {/* Name + vehicle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: '16px', margin: 0, color: 'var(--base-content)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {fullName}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--base-content)', opacity: 0.45, margin: '2px 0 4px' }}>
                  {vehicleNo}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={11} strokeWidth={2.5} style={{ color: 'var(--warning)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--warning)' }}>{rating.toFixed(1)}</span>
                  <span style={{ fontSize: '10px', color: 'var(--base-content)', opacity: 0.35 }}>/ 5.0</span>
                </div>
              </div>

              {/* Agency / Solo badge */}
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  backgroundColor: 'color-mix(in srgb, var(--primary), transparent 88%)',
                  color: 'var(--primary)',
                  border: '1px solid color-mix(in srgb, var(--primary), transparent 75%)',
                  flexShrink: 0,
                }}
              >
                {isAgency ? 'Agency' : 'Solo'}
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--base-300)' }} />

            {/* Performance rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--base-content)', opacity: 0.35, margin: 0 }}>
                Performance Summary
              </p>

              {[
                { icon: IndianRupee, label: 'Total Earnings',  val: `₹${totalEarning.toLocaleString('en-IN')}`, color: 'var(--accent)',  bg: 'color-mix(in srgb, var(--accent),   transparent 85%)' },
                { icon: Car,         label: 'Completed Rides', val: `${totalRides}`,                            color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary),  transparent 85%)' },
                { icon: Wallet,      label: 'Coin Balance',    val: `${coinBalance} pts`,                       color: 'var(--success)', bg: 'color-mix(in srgb, var(--success),  transparent 85%)' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--r-selector)',
                        backgroundColor: row.bg,
                        color: row.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <row.icon size={13} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--base-content)', opacity: 0.6 }}>{row.label}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: row.color }}>{row.val}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--base-300)' }} />

            {/* KYC compliance */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: kycValid ? 'var(--success)' : 'var(--warning)',
                }}
              >
                {kycValid
                  ? <CheckCircle2 size={14} strokeWidth={2.5} />
                  : <AlertCircle  size={14} strokeWidth={2.5} />
                }
                {kycValid ? 'All Documents Valid' : 'KYC Pending Review'}
              </div>
              <Link
                href="/driver/kyc"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--base-content)',
                  opacity: 0.45,
                  textDecoration: 'none',
                }}
              >
                View <ChevronRight size={11} />
              </Link>
            </div>

            {/* Go online/offline big toggle CTA */}
            <button
              onClick={handleToggle}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--r-field)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#ffffff',
                fontFamily: 'var(--font-family-poppins)',
                backgroundColor: isOnline ? 'var(--error)' : 'var(--primary)',
                transition: 'background-color 0.2s, opacity 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {isOnline ? 'Go Offline' : 'Start Accepting Rides'}
            </button>
          </div>

          {/* Location strip */}
          <div
            style={{
              padding: '10px 24px',
              borderTop: '1px solid var(--base-300)',
              backgroundColor: 'var(--base-100)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <MapPin size={12} strokeWidth={2.5} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span style={{ color: 'var(--base-content)', opacity: 0.5 }}>Active zone:</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
              {driverMe?.location?.coordinates
                ? `${driverMe.location.coordinates[1].toFixed(3)}°N`
                : 'Locating...'}
            </span>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '9999px',
                backgroundColor: isOnline ? 'var(--success)' : 'var(--base-300)',
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}