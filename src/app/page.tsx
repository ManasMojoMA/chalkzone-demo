"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Briefcase, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedLogo } from "@/components/animated-logo";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-primary/20">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ED1B24_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#FBB03B]/20 to-[#ED1B24]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#0071BC]/10 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
      </div>

      {/* Header — truly fixed to the viewport. A `sticky` header fails here
          because the root div's `overflow-x-hidden` turns it into a scroll
          container; `fixed` sidesteps that entirely. */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-900/10"><div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <AnimatedLogo size="md" />
        <nav>
          <Button onClick={() => router.push("/login")} variant="outline" className="border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all font-bold">
            Login
          </Button>
        </nav>
      </div></header>

      {/* pt clears the fixed header so the hero isn't hidden behind it */}
      <main className="relative z-10 pt-[76px]">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium text-sm mb-8 border border-accent/20"
          >
            <Sparkles className="h-4 w-4" />
            Empowering Possibilities at Galgotias
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.9] mb-6 text-slate-900"
          >
            From <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Blackboard</span><br />
            To <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent relative">
              Boardroom
              <svg className="absolute -bottom-4 left-0 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0,5 Q50,10 100,5" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" className="text-accent/30" />
              </svg>
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 max-w-2xl mb-12 font-medium"
          >
            Where learning is drawn and careers begin.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button onClick={() => router.push("/login")} size="lg" className="h-16 px-10 text-xl font-bold bg-primary hover:bg-primary/90 text-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
              Sketch Your Future
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </motion.div>
        </section>

        {/* Feature Cards in Comic Style */}
        <section className="container mx-auto px-6 py-20 border-t-4 border-slate-900 bg-[#F8F9FA]">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<BookOpen className="h-8 w-8 text-primary" />}
              title="Modern Academics"
              description="Track attendance, performance, and assignments in real-time with an intelligent dashboard."
              color="bg-primary/10"
              delay={0.1}
            />
            <FeatureCard 
              icon={<Briefcase className="h-8 w-8 text-secondary" />}
              title="Placement Hub"
              description="Apply for jobs, track internships, and seamlessly connect with top recruiters."
              color="bg-secondary/10"
              delay={0.2}
            />
            <FeatureCard 
              icon={<Sparkles className="h-8 w-8 text-accent" />}
              title="AI Assistant"
              description="Get instant answers about university policies and procedures from our smart AI."
              color="bg-accent/10"
              delay={0.3}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description, color, delay }: { icon: React.ReactNode, title: string, description: string, color: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="group p-8 rounded-2xl bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all relative overflow-hidden"
    >
      <div className={`w-16 h-16 rounded-xl ${color} flex items-center justify-center mb-6 border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold uppercase tracking-tight mb-3 text-slate-900">{title}</h3>
      <p className="text-slate-600 font-medium">{description}</p>
      
      {/* Decorative halftone dots in corner */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10 bg-[radial-gradient(#0f172a_2px,transparent_2px)] [background-size:8px_8px]" />
    </motion.div>
  );
}
