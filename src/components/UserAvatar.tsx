import React, { useState } from 'react';

interface UserAvatarProps {
  user?: {
    name?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  } | null;
  name?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-16 h-16 text-xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name: directName,
  avatarUrl: directAvatarUrl,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const displayName = directName || user?.name || user?.email || 'User';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const src = directAvatarUrl || user?.avatarUrl;

  const sizeCls = sizeClasses[size] || sizeClasses.md;

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
        className={`${sizeCls} rounded-full object-cover shrink-0 shadow-2xs border border-stone-200/80 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeCls} rounded-full bg-amber-700 text-amber-50 flex items-center justify-center font-bold shrink-0 shadow-2xs select-none ${className}`}
      title={displayName}
    >
      {initial}
    </div>
  );
};
