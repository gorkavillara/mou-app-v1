'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { IFRMCard } from '@/components/dashboard/IFRMCard';
import { AdherenceChart } from '@/components/dashboard/AdherenceChart';
import { QualityChart } from '@/components/dashboard/QualityChart';
import { WeeklyProgress } from '@/components/dashboard/WeeklyProgress';
import { RecentExercises } from '@/components/dashboard/RecentExercises';
import { Suggestions } from '@/components/dashboard/Suggestions';
import { AppNav } from '@/components/AppNav';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24 md:pb-8 md:pl-[220px] font-sans">
      <AppNav active="/dashboard" />

      <main className="max-w-5xl mx-auto">
        <div className="p-6 pt-12">
          <DashboardHeader name="Carlos" />

          <IFRMCard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-[240px]"
            >
              <AdherenceChart />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-[240px]"
            >
              <QualityChart />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WeeklyProgress />
            <RecentExercises />
          </div>

          <Suggestions />
        </div>
      </main>
    </div>
  );
}
