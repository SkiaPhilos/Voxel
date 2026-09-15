import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  PhoneCall,
  Layers,
  CheckCircle2,
  Archive,
  User as UserIcon,
  Shield,
  LogOut,
  ChevronRight,
  Pin,
  Flame,
  Clock,
  MoreVertical,
  BellRing,
  ShoppingBag,
  ShieldAlert,
  Mail,
  X,
} from 'lucide-react';
import type { User } from '../types';
import { UserAvatar } from './UserAvatar';

export type AppView =
  | 'active'
  | 'all-leads'
  | 'closed'
  | 'archive'
  | 'potential-customers'
  | 'manager'
  | 'newsletter';

interface SidebarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  activeLeadsCount: number;
  allLeadsCount: number;
  closedLeadsCount: number;
  archivedLeadsCount: number;
  potentialCustomersCount?: number;
  dueNowCount: number;
  user: User;
  onOpenProfile: () => void;
  onOpenAdminSettings: () => void;
  onOpenPushModal?: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isPinned: boolean;
  onTogglePin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  activeLeadsCount,
  allLeadsCount,
  closedLeadsCount,
  archivedLeadsCount,
  potentialCustomersCount,
  dueNowCount,
  user,
  onOpenProfile,
  onOpenAdminSettings,
  onOpenPushModal,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
  isPinned,
  onTogglePin,
}) => {
  // Hover peek state (only takes effect if not pinned)
  const [isHovered, setIsHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePin = () => {
    onTogglePin();
  };

  // Expanded if pinned OR hovered
  const isExpanded = isPinned || isHovered;

  const navItems = [
    {
      id: 'active' as const,
      label: 'Active Leads',
      icon: PhoneCall,
      count: activeLeadsCount,
      hasPulse: dueNowCount > 0,
      badgeColor: dueNowCount > 0 ? 'bg-amber-500 text-amber-950 font-bold' : 'bg-stone-200 text-stone-700',
    },
    {
      id: 'all-leads' as const,
      label: 'All Leads',
      icon: Layers,
      count: allLeadsCount,
      hasPulse: false,
      badgeColor: 'bg-stone-200 text-stone-700',
    },
    {
      id: 'closed' as const,
      label: 'Closed Deals',
      icon: CheckCircle2,
      count: closedLeadsCount,
      hasPulse: false,
      badgeColor: 'bg-teal-100 text-teal-800',
    },
    {
      id: 'potential-customers' as const,
      label: 'Prospects',
      icon: ShoppingBag,
      count: potentialCustomersCount ?? 0,
      hasPulse: false,
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'archive' as const,
      label: 'Archive',
      icon: Archive,
      count: archivedLeadsCount,
      hasPulse: false,
      badgeColor: 'bg-stone-200 text-stone-600',
    },
    ...((user.role === 'manager' || user.role === 'admin')
      ? [
          {
            id: 'manager' as const,
            label: 'Manage Agents',
            icon: ShieldAlert,
            count: undefined,
            hasPulse: false,
            badgeColor: 'bg-amber-700 text-white',
          },
          {
            id: 'newsletter' as const,
            label: 'Newsletter',
            icon: Mail,
            count: undefined,
            badgeColor: 'bg-stone-200 text-stone-700',
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        onMouseEnter={() => !isPinned && setIsHovered(true)}
        onMouseLeave={() => !isPinned && setIsHovered(false)}
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#FAF8F5] border-r border-stone-200/90 flex flex-col justify-between transition-all duration-200 ease-out shadow-xl select-none
          ${isExpanded ? 'w-64' : 'w-18'}
          ${isMobileOpen ? 'translate-x-0 !w-64' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Top Header / Brand + Hamburger toggle */}
        <div>
          <div className="h-16 px-3.5 flex items-center justify-between border-b border-stone-200/80 bg-[#FAF8F5]">
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                id="sidebar-toggle-btn"
                onClick={togglePin}
                title={isPinned ? 'Collapse sidebar (hover to peek)' : 'Pin sidebar open'}
                className="w-10 h-10 rounded-xl hover:bg-stone-200/70 text-stone-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                className={`transition-opacity duration-150 whitespace-nowrap overflow-hidden ${
                  isExpanded ? 'opacity-100' : 'opacity-0 w-0'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-sm tracking-tight">
                    Voxel
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    Pro
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">High-Velocity Lead Desk</p>
              </div>
            </div>

            {/* Mobile close button to return to nav buttons */}
            <button
              id="mobile-sidebar-close-btn"
              onClick={() => setIsMobileOpen(false)}
              title="Close menu"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors lg:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Pin status icon indicator when expanded (desktop only) */}
            {isExpanded && (
              <button
                onClick={togglePin}
                title={isPinned ? 'Sidebar pinned open' : 'Click to pin open'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden lg:block ${
                  isPinned
                    ? 'text-amber-700 bg-amber-100/70'
                    : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200/60'
                }`}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'rotate-45 fill-amber-700' : ''}`} />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => {
                    onSelectView(item.id);
                    setIsMobileOpen(false);
                  }}
                  title={!isExpanded ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl transition-all duration-150 text-xs font-semibold cursor-pointer group relative
                    ${isExpanded ? 'px-3 py-2.5 justify-between' : 'h-11 justify-center'}
                    ${
                      isActive
                        ? 'bg-amber-50/90 text-amber-950 font-bold shadow-2xs border-l-4 border-amber-700'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 border-l-4 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon
                        className={`w-4.5 h-4.5 transition-transform duration-150 group-hover:scale-105 ${
                          isActive ? 'text-amber-800' : 'text-stone-500 group-hover:text-stone-800'
                        }`}
                      />
                      {item.hasPulse && !isExpanded && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                      )}
                    </div>

                    {isExpanded && (
                      <span className="truncate whitespace-nowrap text-left text-xs">
                        {item.label}
                      </span>
                    )}
                  </div>

                  {/* Badges / Count */}
                  {isExpanded && item.count !== undefined && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.hasPulse && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition-colors ${item.badgeColor}`}
                      >
                        {item.count}
                      </span>
                    </div>
                  )}

                  {/* Floating tooltip when collapsed and hovered */}
                  {!isExpanded && (
                    <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-stone-900 text-stone-100 text-xs rounded-lg shadow-lg whitespace-nowrap z-50 items-center gap-2 pointer-events-none">
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 font-mono">
                          {item.count}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User Info & Account Menu */}
        <div className="p-2.5 pb-6 lg:pb-2.5 border-t border-stone-200/80 bg-[#FAF8F5] relative" ref={userMenuRef}>
          {/* User Popover / Dropdown Menu */}
          {userMenuOpen && (
            <div
              className={`absolute bottom-full mb-2 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100
                ${isExpanded ? 'left-2 right-2' : 'left-2 w-56'}
              `}
            >
              <div className="px-3 py-2 border-b border-stone-100 mb-1 flex items-center gap-2.5">
                <UserAvatar user={user} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-stone-900 truncate">{user.name}</div>
                  <div className="text-[11px] text-stone-400 font-mono truncate">{user.email}</div>
                  <span className="inline-block mt-0.5 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                    {user.role}
                  </span>
                </div>
              </div>

              {/* My Profile */}
              <button
                id="menu-my-profile-btn"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenProfile();
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-stone-500" />
                <span>My Profile</span>
              </button>

              {/* Push Notifications */}
              <button
                id="menu-push-notifications-btn"
                onClick={() => {
                  setUserMenuOpen(false);
                  if (onOpenPushModal) onOpenPushModal();
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <BellRing className="w-4 h-4 text-amber-700" />
                <span>Push Notifications</span>
              </button>

              {/* Admin Settings (Admin Only) */}
              {user.role === 'admin' && (
                <button
                  id="menu-admin-settings-btn"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onOpenAdminSettings();
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-amber-700" />
                  <span>Admin Settings</span>
                </button>
              )}

              <hr className="my-1 border-stone-100" />

              {/* Logout */}
              <button
                id="menu-logout-btn"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {/* User Button Card */}
          <button
            id="user-profile-menu-trigger"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title={`${user.name} (${user.email}) - Click for account settings`}
            className={`w-full flex items-center rounded-xl p-2 transition-colors cursor-pointer hover:bg-stone-200/60 text-stone-800
              ${isExpanded ? 'justify-between' : 'justify-center'}
              ${userMenuOpen ? 'bg-stone-200/70' : ''}
            `}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar user={user} size="md" />

              {isExpanded && (
                <div className="truncate text-left min-w-0">
                  <div className="font-bold text-xs text-stone-900 truncate">{user.name}</div>
                  <div className="text-[10px] text-stone-400 font-mono truncate">{user.email}</div>
                </div>
              )}
            </div>

            {isExpanded && (
              <MoreVertical className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
