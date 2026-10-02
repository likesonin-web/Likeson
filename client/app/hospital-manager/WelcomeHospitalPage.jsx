'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Building2, 
  FileText, 
  Clock, 
  Users, 
  ArrowRight, 
  PlusCircle, 
  AlertCircle 
} from 'lucide-react';
import { 
  fetchMyManagedHospitals, 
  selectMyManagedHospitals 
} from '@/store/slices/hospitalSlice';

// ─── Professional Subtle Animations ───────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.4, ease: 'easeOut' } 
  },
};

export default function WelcomeHospitalPage() {
  const dispatch = useDispatch();
  const managedHospitalsData = useSelector(selectMyManagedHospitals);

  useEffect(() => {
    dispatch(fetchMyManagedHospitals());
  }, [dispatch]);

  // Safely extract the primary managed hospital's name
  const hospitalList = managedHospitalsData?.managedHospitals || [];
  const hospitalName = hospitalList.length > 0 
    ? hospitalList[0].name 
    : 'Your Healthcare Facility';

  // Aligned with the dashboard's exact routing structure
  const steps = [
    {
      id: 1,
      title: 'Facility Details',
      description: 'Upload your hospital logo, gallery images, and outline your core specialties and facilities.',
      icon: Building2,
      color: 'text-primary',
      bgHover: 'group-hover:bg-primary/10 group-hover:border-primary/20',
      href: '/hospital-manager/profile',
    },
    {
      id: 2,
      title: 'Registration & Legal',
      description: 'Verify your medical licenses, GST, and PAN details to activate your hospital profile.',
      icon: FileText,
      color: 'text-success',
      bgHover: 'group-hover:bg-success/10 group-hover:border-success/20',
      href: '/hospital-manager/registration',
    },
    {
      id: 3,
      title: 'Pricing & Hours',
      description: 'Set your global consultation fees, emergency availability, and standard operating hours.',
      icon: Clock,
      color: 'text-warning',
      bgHover: 'group-hover:bg-warning/10 group-hover:border-warning/20',
      href: '/hospital-manager/pricing',
    },
    {
      id: 4,
      title: 'Link Doctors',
      description: 'Search and link verified doctors to your hospital to start accepting appointments.',
      icon: Users,
      color: 'text-info',
      bgHover: 'group-hover:bg-info/10 group-hover:border-info/20',
      href: '/hospital-manager/doctors/search',
    },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-10 px-4 sm:px-8">
      <div className="w-full max-w-6xl">
        
        {/* ── Header Section ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex flex-col items-center text-center mb-14"
        >
          <motion.span 
            variants={itemVariants} 
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full mb-6"
          >
            Hospital Management
          </motion.span>
          
          <motion.h1 
            variants={itemVariants} 
            className="text-3xl md:text-4xl font-black text-base-content tracking-tight"
          >
            Welcome to MedCore, <span className="text-primary">{hospitalName}</span>
          </motion.h1>
          
          <motion.p 
            variants={itemVariants} 
            className="mt-4 text-sm text-base-content/60 max-w-2xl mx-auto leading-relaxed"
          >
            Prepare your facility for patients. Complete the foundational setup steps below to unlock your command centre and start managing your medical staff.
          </motion.p>

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/hospital-manager/doctors/search">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-content text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm">
                <PlusCircle size={15} /> Link New Doctor
              </button>
            </Link>
            <Link href="/hospital-manager/operating-hours">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-base-100 border border-base-300 text-base-content text-xs font-bold rounded-xl hover:bg-base-200 transition-colors shadow-sm">
                <AlertCircle size={15} className="text-warning" /> Update Emergency Status
              </button>
            </Link>
          </motion.div>
        </motion.div>

        {/* ── Steps Grid ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div 
                key={step.id} 
                variants={itemVariants} 
                className="group flex flex-col h-full rounded-2xl border border-base-300 bg-base-100 p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
              >
                {/* Background ambient light on hover */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors pointer-events-none" />
                
                <div className="flex-1 relative z-10">
                  <div className={`w-12 h-12 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center mb-5 transition-colors duration-300 ${step.bgHover}`}>
                    <Icon size={22} className={step.color} />
                  </div>
                  
                  <h3 className="text-sm font-bold text-base-content mb-2 tracking-tight">
                    {step.id}. {step.title}
                  </h3>
                  
                  <p className="text-xs text-base-content/60 leading-relaxed mb-6">
                    {step.description}
                  </p>
                </div>

                <Link href={step.href} className="mt-auto relative z-10 w-full block">
                  <div className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-base-200/50 border border-transparent group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
                    <span className="text-xs font-bold text-base-content group-hover:text-primary transition-colors">
                      Configure
                    </span>
                    <ArrowRight size={14} className="text-base-content/40 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Bottom Call to Actions ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
          className="mt-14 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/hospital-manager/dashboard">
            <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3 bg-primary text-primary-content rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
              Enter Command Centre <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/hospital-manager/support">
            <button className="flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3 bg-base-100 border border-base-300 text-base-content rounded-xl text-sm font-bold hover:bg-base-200 transition-colors">
              Help & Support
            </button>
          </Link>
        </motion.div>
        
      </div>
    </div>
  );
}