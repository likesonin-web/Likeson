"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function BackButton({ 
  label = "Go Back", 
  className = "" 
}) {
  const router = useRouter();

  return (
    <motion.button
      onClick={() => router.back()}
      // Framer Motion properties replacing Tailwind's hover transform
      whileHover={{ x: -4 }} 
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`
        rounded-md px-4 py-2 text-white bg-gradient-to-r from-primary/40 to-secondary/40 flex gap-3 text-base-content 
         transition-colors
        ${className}
      `}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-xs">{label}</span>
    </motion.button>
  );
}