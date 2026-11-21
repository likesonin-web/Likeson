"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import dynamic from "next/dynamic";

// Critical above-the-fold components (loaded immediately)
import Hero from "@/components/ui/Hero";
import Services from "@/components/ui/Services";
import Container from "@/components/ui/Container";

// Below-the-fold components (lazy loaded to minimize initial JS payload)
const Subscription = dynamic(() => import("@/app/(page)/Subscription"), { ssr: true });
const Banner = dynamic(() => import("@/components/Banner"), { ssr: true });
const Ads = dynamic(() => import("@/components/Ads"), { ssr: false });
const Hospital = dynamic(() => import("@/app/(page)/HospitalPage"), { ssr: true });
const Faq = dynamic(() => import("@/components/Faq"), { ssr: true });

// Role-specific partner components (dynamically loaded only when role matches)
const LabHero = dynamic(() => import("@/app/lab-partner/Hero"), { ssr: false });
const HeroSoloDriver = dynamic(() => import("@/components/hero/HeroSoloDriver"), { ssr: false });
const CareAssistant = dynamic(() => import("@/components/Careassistanthero"), { ssr: false });
const HeroDriver = dynamic(() => import("@/components/hero/HeroDriver"), { ssr: false });

const Home: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user);
  const role = user?.role || "customer"; // Default to customer for guests

  return (
    <main className="min-h-screen bg-base-100 transition-colors duration-300 overflow-x-hidden relative">
      {/* ── CUSTOMER / GUEST ──────────────────────────────────────────────── */}
      {role === "customer" && (
        <Container className="w-full flex flex-col gap-8 pb-12">
          {/* 1. Hero */}
          <Hero />

          {/* 2. Hero Banner ad - Global */}
          <Ads page="Global" slot="Hero_Banner" />

          {/* 3. Core service navigation hub */}
          <Services />

          {/* 4. Native Feed ad */}
          <Ads page="Global" slot="Native_Feed" />

          <Hospital />

          {/* 5. Dynamic promotions */}
          <section className="animate-fade-in">
            <Banner position="Home_Middle" />
          </section>
          <Ads page="Global" slot="Popup" />

          {/* 6. Retention */}
          <Subscription />
          <Faq />
        </Container>
      )}

      {/* ── CARE ASSISTANT ────────────────────────────────────────────────── */}
      {role === "care_assistant" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <CareAssistant />
        </Container>
      )}

      {/* ── LAB PARTNER ───────────────────────────────────────────────────── */}
      {role === "lab_partner" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <LabHero />
        </Container>
      )}

      {/* ── SOLO DRIVER PARTNER ───────────────────────────────────────────── */}
      {role === "solodriverpartner" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <HeroSoloDriver />
        </Container>
      )}

      {/* ── DRIVER ────────────────────────────────────────────────────────── */}
      {role === "driver" && (
        <Container className="w-full flex flex-col gap-12 py-6">
          <HeroDriver />
        </Container>
      )}

      {/* Only show the Global Sticky Bottom if they aren't drivers */}
      {role !== "driver" && role !== "solodriverpartner" && (
        <Ads page="Global" slot="Sticky_Bottom" />
      )}
    </main>
  );
};

export default Home;
