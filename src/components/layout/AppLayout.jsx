import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBanner from './TopBanner';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBanner />
      <Sidebar />
      <main className="min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}