import React, { useState, useEffect } from 'react';
import {
  Trophy,
  PhoneCall,
  Users,
  Calendar,
  CheckCircle2,
  Flame,
  Award,
  Clock,
  Sparkles,
  Play,
  RotateCw,
  TrendingUp,
  Volume2,
  ChevronRight,
  Target,
} from 'lucide-react';
import { api } from '../lib/api';
import type { LeaderboardStats, LeaderboardMember, ActivityFeedItem, OutcomeTag } from '../types';
import { AudioPlayer } from './AudioPlayer';

interface TeamLeaderboardViewProps {
  onSelectLead?: (leadId: string) => void;
  className?: string;
}

export const TeamLeaderboardView: React.FC<TeamLeaderboardViewProps> = ({
  onSelectLead,
  className = '',
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [data, setData] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAudioId, setExpandedAudioId] = useState<string | null>(null);

  const fetchStats = async (selectedPeriod: 'today' | 'week' | 'month' | 'all', isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.getLeaderboard(selectedPeriod);
      setData(res);
    } catch (err) {
      console.error('Failed to load leaderboard stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  const getRankBadge = (rank?: number) => {
    if (rank === 1) {
      return (
        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 border-2 border-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
          🥇
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 border-2 border-stone-300 flex items-center justify-center font-bold text-xs shadow-xs">
          🥈
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-7 h-7 rounded-full bg-amber-900/10 text-amber-900 border-2 border-amber-700/40 flex items-center justify-center font-bold text-xs shadow-xs">
          🥉
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-xs">
        {rank}
      </div>
    );
  };

  const getOutcomeBadgeStyle = (outcome: OutcomeTag | string) => {
    switch (outcome) {
      case 'Closed/Matured':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Interested':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Call Back Later':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Busy':
      case "Couldn't Connect":
      case 'No Answer':
        return 'bg-stone-100 text-stone-600 border-stone-200';
      case 'Not Interested':
      case 'Wrong Number':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const diffSecs = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & Period Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
              <Trophy className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 tracking-tight">
                Live Sales Leaderboard &amp; Coaching Feed
              </h2>
              <p className="text-xs text-stone-500">
                Real-time team outreach metrics, connect rates, and managerial activity streaming
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <div className="inline-flex p-1 rounded-xl bg-stone-100 border border-stone-200">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  period === tab.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchStats(period, true)}
            disabled={refreshing}
            className="p-2 text-stone-500 hover:text-stone-900 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
            title="Refresh statistics"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aggregate KPI Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            <PhoneCall className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">Total Dials</p>
            <p className="text-xl font-extrabold text-stone-900">
              {data?.totals.totalDials ?? (loading ? '-' : 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">Live Connects</p>
            <p className="text-xl font-extrabold text-stone-900">
              {data?.totals.totalConnects ?? (loading ? '-' : 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">Meetings &amp; Follow-ups</p>
            <p className="text-xl font-extrabold text-stone-900">
              {data?.totals.totalMeetings ?? (loading ? '-' : 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200">
            <Flame className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">Deals Closed</p>
            <p className="text-xl font-extrabold text-stone-900">
              {data?.totals.totalClosed ?? (loading ? '-' : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Leaderboard Table & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Standings Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-bold text-stone-900">Team Scoreboard</h3>
            </div>
            <span className="text-[11px] font-medium text-stone-500">
              Ranked by composite score
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/50 text-stone-500 uppercase tracking-wider font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Sales Rep</th>
                  <th className="py-3 px-3 text-center">Dials</th>
                  <th className="py-3 px-3 text-center">Connects</th>
                  <th className="py-3 px-3 text-center">Meetings</th>
                  <th className="py-3 px-3 text-center">Tasks</th>
                  <th className="py-3 px-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      Loading team standings...
                    </td>
                  </tr>
                ) : !data || data.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      No outreach activity recorded for this period yet.
                    </td>
                  </tr>
                ) : (
                  data.leaderboard.map((member) => (
                    <tr
                      key={member.userId}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        member.rank === 1 ? 'bg-amber-50/30 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center">{getRankBadge(member.rank)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-7 h-7 rounded-full object-cover border border-stone-200"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900 truncate max-w-[120px] sm:max-w-[160px]">
                              {member.name}
                            </p>
                            <p className="text-[10px] text-stone-400 capitalize">{member.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-stone-800">
                        {member.dialsCount}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                        {member.connectsCount}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-blue-700">
                        {member.meetingsCount}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-stone-600">
                        {member.directivesCompleted}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] border border-amber-200">
                          {member.score} pts
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Points: Dial = 1pt · Connect = 3pts · Meeting = 6pts · Closed = 15pts · Directive = 8pts</span>
          </div>
        </div>

        {/* Right 5 Columns: Live Team Activity Stream */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col max-h-[640px]">
          <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-stone-900">Live Team Feed</h3>
            </div>
            <span className="text-[11px] text-stone-400">Chronological</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 divide-y divide-stone-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-stone-400">
                Loading live feed...
              </div>
            ) : !data || data.activityFeed.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-400">
                No recent activity logged for this time window.
              </div>
            ) : (
              data.activityFeed.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 text-xs">{item.userName}</span>
                        {item.outcomeTag ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getOutcomeBadgeStyle(
                              item.outcomeTag
                            )}`}
                          >
                            {item.outcomeTag}
                          </span>
                        ) : item.type === 'directive_completed' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                            Directive Done
                          </span>
                        ) : null}
                      </div>

                      {item.leadName && (
                        <p className="text-xs text-stone-600 mt-0.5">
                          Account:{' '}
                          {item.leadId && onSelectLead ? (
                            <button
                              type="button"
                              onClick={() => onSelectLead(item.leadId!)}
                              className="font-semibold text-amber-800 hover:underline cursor-pointer"
                            >
                              {item.leadName}
                            </button>
                          ) : (
                            <span className="font-semibold text-stone-800">{item.leadName}</span>
                          )}
                        </p>
                      )}

                      {item.summary && (
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </div>

                    <span className="text-[10px] text-stone-400 whitespace-nowrap shrink-0">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  {/* If call has attached audio recording, render player toggle */}
                  {item.audioUrl && (
                    <div className="mt-2">
                      {expandedAudioId === item.id ? (
                        <div className="space-y-1">
                          <AudioPlayer
                            src={item.audioUrl}
                            title={`${item.leadName || 'Call'} recording`}
                            duration={item.audioDuration}
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedAudioId(null)}
                            className="text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer"
                          >
                            Close Audio
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedAudioId(item.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-medium transition-colors cursor-pointer border border-stone-200"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                          <span>Listen to Call Drop / Recording</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
