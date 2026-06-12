import React from 'react';
import { Droplets, LogOut, User, Shield, Compass, Truck, Sparkles, Sun, Moon } from 'lucide-react';
import { UserRole } from '../types.js';

interface HeaderProps {
  currentUser: { id: string; name: string; email: string; role: UserRole; phone: string } | null;
  socketConnected: boolean;
  onLogout: () => void;
  onNavigateToTab?: (tab: string) => void;
  activeTab?: string;
  isDark: boolean;
  onToggleTheme: () => void;
}

export default function Header({
  currentUser,
  socketConnected,
  onLogout,
  onNavigateToTab,
  activeTab,
  isDark,
  onToggleTheme,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-[50] w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center min-h-16 py-2 sm:py-0 gap-3">
          {/* Logo / Branding */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-200 dark:shadow-sky-950/45 shrink-0">
              <Droplets className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white font-sans">
                  AquaFlow
                </span>
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md font-mono font-bold bg-sky-50 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900 dark:bg-sky-950/40">
                  Express
                </span>
              </div>
              <p className="hidden md:block text-[10px] text-slate-500 dark:text-slate-440 font-medium font-sans">
                Real-Time Delivery Ecosystem
              </p>
            </div>
          </div>

          {/* Actions panel */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Global Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-95 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white shadow-sm flex items-center justify-center cursor-pointer shrink-0"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              id="header-theme-toggle-btn"
            >
              {isDark ? (
                <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-amber-500 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-700 dark:text-sky-400" />
              )}
            </button>

            {/* User profile & Navigation shortcuts */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-3">
                {/* Connection Status Badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-850 text-xs font-mono">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  {socketConnected ? 'WS Live' : 'Polling'}
                </div>

                {/* Role-Specific Badges */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {currentUser.role === UserRole.OWNER && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 whitespace-nowrap">
                      <Shield className="h-3.5 w-3.5 text-amber-500" /> <span className="hidden sm:inline">Vendor Admin</span><span className="sm:hidden">Admin</span>
                    </span>
                  )}
                  {currentUser.role === UserRole.DELIVERY && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-250 dark:border-sky-900 whitespace-nowrap">
                      <Truck className="h-3.5 w-3.5 text-sky-550" /> <span className="hidden sm:inline">Delivery Agent</span><span className="sm:hidden">Driver</span>
                    </span>
                  )}
                  {currentUser.role === UserRole.USER && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 whitespace-nowrap">
                      <User className="h-3.5 w-3.5 text-emerald-500" /> <span className="hidden sm:inline">Customer Account</span><span className="sm:hidden">Customer</span>
                    </span>
                  )}

                  {/* Profile Display */}
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-450 font-mono">
                      {currentUser.email}
                    </span>
                  </div>
                </div>

                {/* Logout button */}
                <button
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 text-slate-600 dark:text-slate-400 hover:text-red-650 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 shrink-0"
                  title="Log out from your account"
                  id="header-logout-btn"
                >
                  <LogOut className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-440 font-mono">
                <span>● Interactive Sandbox</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
