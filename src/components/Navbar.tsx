import React from 'react';
import { PhoneCall, CheckCircle2, Archive, Shield, Bell, BellOff, LogOut, Plus, User as UserIcon } from 'lucide-react';
import type { User } from '../types';
import { UserAvatar } from './UserAvatar';

interface NavbarProps {
  currentView: 'active' | 'closed' | 'archive' | 'admin';
  onSelectView: (view: 'active' | 'closed' | 'archive' | 'admin') => void;
  activeCount: number;
  closedCount: number;
  archivedCount: number;
  dueNowCount: number;
  user: User | null;
  onLogout: () => void;
  onOpenNewLeadModal: () => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  onOpenPushModal?: () => void;
  isPushActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  activeCount,
  closedCount,
  archivedCount,
  dueNowCount,
  user,
  onLogout,
  onOpenNewLeadModal,
  notificationPermission,
  onRequestNotificationPermission,
  onOpenPushModal,
  isPushActive,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & App Title */}
          <div className="flex items-center gap-6">
            <div
              id="brand-logo-btn"
              onClick={() => onSelectView('active')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs group-hover:bg-amber-800 transition-colors">
                <PhoneCall className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-lg tracking-tight font-sans">
                    Voxel
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-600">
                    Internal
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 ml-2">
              <button
                id="nav-tab-active"
                onClick={() => onSelectView('active')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'active'
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <span>Active Leads</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full ${
                    dueNowCount > 0
                      ? 'bg-amber-100 text-amber-900 font-bold animate-pulse'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {activeCount}
                </span>
              </button>

              <button
                id="nav-tab-closed"
                onClick={() => onSelectView('closed')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'closed'
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Closed Deals</span>
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600">
                  {closedCount}
                </span>
              </button>

              <button
                id="nav-tab-archive"
                onClick={() => onSelectView('archive')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'archive'
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-semibold'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <Archive className="w-3.5 h-3.5 text-stone-500" />
                <span>Archive</span>
                <span className="text-xs px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600">
                  {archivedCount}
                </span>
              </button>

              {user?.role === 'admin' && (
                <button
                  id="nav-tab-admin"
                  onClick={() => onSelectView('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    currentView === 'admin'
                      ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-semibold'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Admin Settings</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Notification Permission Toggle */}
            <button
              id="notification-permission-btn"
              onClick={() => {
                if (onOpenPushModal) {
                  onOpenPushModal();
                } else {
                  onRequestNotificationPermission();
                }
              }}
              title={
                isPushActive || notificationPermission === 'granted'
                  ? 'Follow-up push alerts active (Click to manage)'
                  : 'Click to enable follow-up mobile & web push notifications'
              }
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isPushActive || notificationPermission === 'granted'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {isPushActive || notificationPermission === 'granted' ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Push Alerts On</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-stone-400" />
                  <span>Enable Push Alerts</span>
                </>
              )}
            </button>

            {/* Quick-Add Lead Button */}
            <button
              id="quick-add-lead-btn"
              onClick={onOpenNewLeadModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 active:scale-[0.98] text-white text-sm font-medium shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Lead</span>
            </button>

            {/* User Pill & Logout */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-stone-800 leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-stone-500 capitalize">
                    {user.role} &bull; {user.email}
                  </span>
                </div>
                <UserAvatar user={user} size="sm" />
                <button
                  id="logout-btn"
                  onClick={onLogout}
                  title="Log out"
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-200/60 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Subnavigation Row */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-stone-200 text-xs overflow-x-auto gap-2">
          <button
            onClick={() => onSelectView('active')}
            className={`px-3 py-1 rounded-md whitespace-nowrap font-medium ${
              currentView === 'active' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => onSelectView('closed')}
            className={`px-3 py-1 rounded-md whitespace-nowrap font-medium ${
              currentView === 'closed' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600'
            }`}
          >
            Closed Deals ({closedCount})
          </button>
          <button
            onClick={() => onSelectView('archive')}
            className={`px-3 py-1 rounded-md whitespace-nowrap font-medium ${
              currentView === 'archive' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600'
            }`}
          >
            Archive ({archivedCount})
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => onSelectView('admin')}
              className={`px-3 py-1 rounded-md whitespace-nowrap font-medium ${
                currentView === 'admin' ? 'bg-amber-100 text-amber-900 font-semibold' : 'text-stone-600'
              }`}
            >
              Admin Settings
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
