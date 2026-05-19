import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBanner from './TopBanner';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBanner />
      <Sidebar visible={sidebarVisible} onToggle={setSidebarVisible} />
      <main className={cn("min-h-screen transition-all duration-300", sidebarVisible ? "lg:pl-60" : "")}>
        <div className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}