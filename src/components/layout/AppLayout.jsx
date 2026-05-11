import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBanner from './TopBanner';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <TopBanner />
      <Sidebar />
      <main className="lg:pl-60 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}