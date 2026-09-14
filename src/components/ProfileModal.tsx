import React, { useState, useRef } from 'react';
import {
  User as UserIcon,
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  Upload,
  Save,
} from 'lucide-react';
import type { User } from '../types';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';
import { ImageCropModal } from './ImageCropModal';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  // Avatar state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarRawSrc, setAvatarRawSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Name update state
  const [name, setName] = useState(user.name);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be selected again
    e.target.value = '';

    setAvatarError(null);
    setAvatarSuccess(null);

    // Validate type
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (JPG or PNG).');
      return;
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Photo exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarRawSrc(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob, croppedDataUrl: string) => {
    setIsCropOpen(false);
    setIsAvatarProcessing(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const res = await api.uploadAvatar(croppedDataUrl, croppedBlob.type || 'image/jpeg');
      onUserUpdated(res.user);
      setAvatarSuccess('Profile photo updated successfully!');
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to upload profile photo');
    } finally {
      setIsAvatarProcessing(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Remove profile photo and revert to initial initials?')) return;
    setIsAvatarProcessing(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const res = await api.removeAvatar();
      onUserUpdated(res.user);
      setAvatarSuccess('Profile photo removed. Showing dynamic initials avatar.');
    } catch (err: any) {
      setAvatarError(err.message || 'Failed to remove photo');
    } finally {
      setIsAvatarProcessing(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }

    setIsUpdatingName(true);
    setNameError(null);
    setNameSuccess(null);

    try {
      const res = await api.updateProfile({ name: name.trim() });
      onUserUpdated(res.user);
      setNameSuccess('Display name updated successfully!');
    } catch (err: any) {
      setNameError(err.message || 'Failed to update name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!currentPassword) {
      setPwdError('Current password is required to verify identity');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New password and confirmation do not match');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const res = await api.updateProfile({
        currentPassword,
        newPassword,
      });
      onUserUpdated(res.user);
      setPwdSuccess('Password changed successfully! Keep it safe.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center font-bold text-base shadow-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">My Profile Settings</h2>
              <p className="text-xs text-stone-500 font-mono">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* 1. Profile Picture / Avatar Preview Section */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-stone-200">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <UserAvatar user={user} size="xl" className="w-16 h-16" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload new photo (max 2MB, JPG/PNG)"
                  disabled={isAvatarProcessing}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-700 hover:bg-amber-800 text-white flex items-center justify-center text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Profile Photo
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Max 2MB (JPG, PNG). Includes crop & reposition tool.
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAvatarProcessing}
                    className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-500" />
                    <span>{user.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>

                  {user.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isAvatarProcessing}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-stone-500 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-stone-400 group-hover:text-rose-600" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Avatar messages */}
            {avatarSuccess && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{avatarSuccess}</span>
              </div>
            )}
            {avatarError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{avatarError}</span>
              </div>
            )}
          </div>

          {/* Image Cropper Modal */}
          <ImageCropModal
            isOpen={isCropOpen}
            imageSrc={avatarRawSrc}
            onClose={() => setIsCropOpen(false)}
            onCropComplete={handleCropComplete}
          />

          {/* 2. Change Display Name Form */}
          <form onSubmit={handleUpdateName} className="space-y-3">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Display Name
              </h3>
            </div>

            {nameSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{nameSuccess}</span>
              </div>
            )}
            {nameError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{nameError}</span>
              </div>
            )}

            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full display name"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingName || name.trim() === user.name}
                className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isUpdatingName ? 'Saving...' : 'Save Name'}</span>
              </button>
            </div>
          </form>

          <hr className="border-stone-200" />

          {/* 3. Change Password Form */}
          <form onSubmit={handleUpdatePassword} className="space-y-3.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Change Password
              </h3>
            </div>

            {pwdSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}
            {pwdError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password to verify"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs bg-white text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isUpdatingPassword || !currentPassword || !newPassword}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isUpdatingPassword ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
