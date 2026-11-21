"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";
import Header from "./Header";
import Footer from "./Footer";
import { usePathname } from "next/navigation";

// Dynamically import heavy dashboards so they are not included in public bundle
const LikesonSuperAdminDashboard = dynamic(
  () => import("@/components/dashboard/LikesonSuperAdminDashboard"),
  { ssr: false }
);
const AdminDashboard = dynamic(
  () => import("@/app/admin/AdminDashboard"),
  { ssr: false }
);
const PharmacyDashboard = dynamic(
  () => import("@/components/dashboard/PharmacyDashboard"),
  { ssr: false }
);
const TransportPartnerDashboard = dynamic(
  () => import("@/components/dashboard/Transportpartnerdashboard"),
  { ssr: false }
);
const HospitalMangerDashboard = dynamic(
  () => import("@/components/dashboard/HospitalMangerDashboard"),
  { ssr: false }
);
const DoctorDashboard = dynamic(
  () => import("@/components/dashboard/DoctorDashboard"),
  { ssr: false }
);
const BloodBankDashboard = dynamic(
  () => import("@/components/dashboard/BloodBankDashboard"),
  { ssr: false }
);
const LabPartnerDashboard = dynamic(
  () => import("@/components/dashboard/LabPartnerDashboard"),
  { ssr: false }
);

export default function LayoutConditionalWrapper({ children }) {
  const { user } = useSelector((state) => state.user);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isTrackingPage = pathname?.startsWith("/rides/") && pathname?.endsWith("/tracking");

  // Only render role dashboards on the client when user is authenticated with a staff/admin role
  if (isClient && user?.role) {
    if (user.role === "superadmin") {
      return <LikesonSuperAdminDashboard>{children}</LikesonSuperAdminDashboard>;
    }
    if (user.role === "admin") {
      return <AdminDashboard>{children}</AdminDashboard>;
    }
    if (user.role === "pharmacy") {
      return <PharmacyDashboard>{children}</PharmacyDashboard>;
    }
    if (user.role === "transportpartner") {
      return <TransportPartnerDashboard>{children}</TransportPartnerDashboard>;
    }
    if (user.role === "doctor") {
      return <DoctorDashboard>{children}</DoctorDashboard>;
    }
    if (user.role === "labpartner") {
      return <LabPartnerDashboard>{children}</LabPartnerDashboard>;
    }
    if (user.role === "hospital") {
      return <HospitalMangerDashboard>{children}</HospitalMangerDashboard>;
    }
    if (user.role === "blood_bank") {
      return <BloodBankDashboard>{children}</BloodBankDashboard>;
    }
  }

  // Default SSR & public customer layout: immediate HTML, no blank screen
  return (
    <>
      <Header />
      <main className="min-h-screen transition-all duration-300">
        {children}
      </main>
      {!isTrackingPage && <Footer />}
    </>
  );
}
