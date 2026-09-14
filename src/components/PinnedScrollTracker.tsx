import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Pin } from 'lucide-react';
import type { PinnedComment } from '../types';

interface PinnedScrollTrackerProps {
  pinnedComments: PinnedComment[];
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const PinnedScrollTracker: React.FC<PinnedScrollTrackerProps> = ({
  pinnedComments,
  containerRef,
}) => {
  const [aboveIds, setAboveIds] = useState<string[]>([]);
  const [belowIds, setBelowIds] = useState<string[]>([]);

  const calculatePositions = useCallback(() => {
    if (!pinnedComments || pinnedComments.length === 0) {
      setAboveIds([]);
      setBelowIds([]);
      return;
    }

    // Lead IDs that have at least one active (unacknowledged or acknowledged) pinned comment
    const activeComments = pinnedComments.filter((c) => c.status !== 'done');
    const leadIds = Array.from(new Set(activeComments.map((c) => c.lead_id).filter(Boolean))) as string[];

    if (leadIds.length === 0) {
      setAboveIds([]);
      setBelowIds([]);
      return;
    }

    const container = containerRef?.current;
    const viewportTop = container ? container.getBoundingClientRect().top : 0;
    const viewportBottom = container
      ? container.getBoundingClientRect().bottom
      : window.innerHeight || document.documentElement.clientHeight;

    const newAbove: string[] = [];
    const newBelow: string[] = [];

    for (const leadId of leadIds) {
      const el = document.getElementById(`lead-card-${leadId}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < viewportTop + 60) {
          newAbove.push(leadId);
        } else if (rect.top > viewportBottom - 60) {
          newBelow.push(leadId);
        }
      }
    }

    setAboveIds(newAbove);
    setBelowIds(newBelow);
  }, [pinnedComments, containerRef]);

  useEffect(() => {
    calculatePositions();

    const handleScrollOrResize = () => {
      calculatePositions();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    const container = containerRef?.current;
    if (container) {
      container.addEventListener('scroll', handleScrollOrResize, { passive: true });
    }

    const interval = setInterval(calculatePositions, 1000);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (container) {
        container.removeEventListener('scroll', handleScrollOrResize);
      }
      clearInterval(interval);
    };
  }, [calculatePositions, containerRef]);

  const jumpToLead = (leadId: string) => {
    const el = document.getElementById(`lead-card-${leadId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-amber-500/50');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-amber-500/50');
      }, 1500);
    }
  };

  const jumpToAbove = () => {
    if (aboveIds.length > 0) {
      jumpToLead(aboveIds[aboveIds.length - 1]); // Jump to closest above
    }
  };

  const jumpToBelow = () => {
    if (belowIds.length > 0) {
      jumpToLead(belowIds[0]); // Jump to closest below
    }
  };

  if (aboveIds.length === 0 && belowIds.length === 0) return null;

  return (
    <>
      {/* Top Dock Indicator */}
      {aboveIds.length > 0 && (
        <div className="sticky top-16 z-30 flex justify-center py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none">
          <button
            type="button"
            onClick={jumpToAbove}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer ring-2 ring-white"
          >
            <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
            <Pin className="w-3 h-3 fill-white" />
            <span>
              {aboveIds.length} pinned note{aboveIds.length === 1 ? '' : 's'} above &mdash; click to jump
            </span>
          </button>
        </div>
      )}

      {/* Bottom Dock Indicator */}
      {belowIds.length > 0 && (
        <div className="sticky bottom-20 sm:bottom-6 z-30 flex justify-center py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          <button
            type="button"
            onClick={jumpToBelow}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all transform hover:translate-y-0.5 cursor-pointer ring-2 ring-white"
          >
            <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
            <Pin className="w-3 h-3 fill-white" />
            <span>
              {belowIds.length} pinned note{belowIds.length === 1 ? '' : 's'} below &mdash; click to jump
            </span>
          </button>
        </div>
      )}
    </>
  );
};
