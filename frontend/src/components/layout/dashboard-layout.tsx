import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  fullScreen?: boolean;
}

export function DashboardLayout({ children, hideSidebar, fullScreen }: DashboardLayoutProps) {
  return (
    <div className={cn(
      'min-h-screen bg-background',
      fullScreen && 'h-screen overflow-hidden'
    )}>
      {children}
    </div>
  );
}

export default DashboardLayout;
