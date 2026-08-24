import type { UserAccount, UserRole } from '../types';
import { DeviceService } from './deviceService';

const USERS_STORAGE_KEY = 'gomdon_users_v1';
const CURRENT_USER_STORAGE_KEY = 'gomdon_current_user_v1';
const ACCESS_TOKEN_STORAGE_KEY = 'gomdon_access_token_v1';

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const DEFAULT_ADMIN_USER: UserAccount = {
  id: 'user_super_admin',
  username: 'admin',
  password: 'admin@',
  fullName: 'Tổng Quản Trị Viên',
  role: 'ADMIN',
  phone: '0988888888',
  email: 'admin@autopro.io.vn',
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
};

export const AuthService = {
  getUsers(): UserAccount[] {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    let users: UserAccount[] = [];
    if (raw) {
      try {
        users = JSON.parse(raw);
      } catch {
        users = [];
      }
    }

    // Keep the local list display-only. Passwords are intentionally not
    // returned by the server after login/sync.
    let adminFound = false;
    users = users.map(u => {
      if (u.id === 'user_super_admin' || u.username?.toLowerCase() === 'ductin-admin' || u.username?.toLowerCase() === 'admin') {
        adminFound = true;
        return {
          ...u,
          id: 'user_super_admin',
          username: 'admin',
          fullName: (u.fullName && u.fullName.includes('Đức Tín')) ? 'Quản Trị Viên (Admin)' : (u.fullName || 'Quản Trị Viên (Admin)'),
        };
      }
      return u;
    });

    if (!adminFound) {
      users.unshift(DEFAULT_ADMIN_USER);
    }

    return users;
  },

  saveUsers(users: UserAccount[]): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    fetch('/api/db/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ users }),
    }).catch(err => console.warn('[User Server Save Fail]:', err));
  },

  async syncUsersFromServer(): Promise<UserAccount[]> {
    try {
      const res = await fetch('/api/auth/users', { headers: getAuthHeaders() });
      if (res.ok) {
        const result = await res.json();
        let serverUsers: UserAccount[] = (result.success && Array.isArray(result.users)) ? result.users : [];
        if (serverUsers.length > 0) {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(serverUsers));
          return serverUsers;
        }
      }
    } catch (err) {
      console.warn('[Sync Users Fail]:', err);
    }
    return this.getUsers();
  },

  getCurrentUser(): UserAccount | null {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCurrentUser(user: UserAccount | null): void {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  },

  async verifyCurrentPassword(password: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ password: password.trim() }),
      });
      const result = await response.json().catch(() => null);
      return Boolean(response.ok && result?.success);
    } catch {
      return false;
    }
  },

  async login(usernameInput: string, passwordInput: string): Promise<{
    success: boolean;
    user?: UserAccount;
    error?: string;
    require2FA?: boolean;
    userId?: string;
    tempToken?: string;
    maskedEmail?: string;
    message?: string;
  }> {
    const uClean = (usernameInput || '').trim();
    const pClean = (passwordInput || '').trim();

    if (!uClean || !pClean) {
      return { success: false, error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.' };
    }

    const deviceId = DeviceService.getDeviceId();
    const deviceName = DeviceService.getDeviceName();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uClean, password: pClean, deviceId, deviceName }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể xác thực với máy chủ.' };
      }

      // 🛡️ 2FA Challenge
      if (result.require2FA) {
        return {
          success: true,
          require2FA: true,
          userId: result.userId,
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
          message: result.message,
        };
      }

      if (!result.token || !result.user) {
        return { success: false, error: 'Phản hồi từ máy chủ không hợp lệ.' };
      }

      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([result.user]));
      this.setCurrentUser(result.user);
      return { success: true, user: result.user };
    } catch {
      return { success: false, error: 'Không kết nối được máy chủ để xác thực. Vui lòng kiểm tra mạng.' };
    }
  },

  async verify2FaOtp(userId: string, tempToken: string, otp: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tempToken, otp }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success || !result.token || !result.user) {
        return { success: false, error: result?.error || 'Mã OTP 2FA không hợp lệ.' };
      }
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([result.user]));
      this.setCurrentUser(result.user);
      return { success: true, user: result.user };
    } catch {
      return { success: false, error: 'Không kết nối được máy chủ xác thực 2FA.' };
    }
  },

  async sendForgotPasswordOtp(usernameOrEmail: string): Promise<{ success: boolean; userId?: string; maskedEmail?: string; error?: string; message?: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'Không thể gửi mã khôi phục.' };
      }
      return { success: true, userId: data.userId, maskedEmail: data.maskedEmail, message: data.message };
    } catch {
      return { success: false, error: 'Lỗi mạng khi gửi yêu cầu khôi phục mật khẩu.' };
    }
  },

  async resetPasswordWithOtp(userId: string, otp: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'Đặt lại mật khẩu thất bại.' };
      }
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Lỗi mạng khi đặt lại mật khẩu.' };
    }
  },

  async setQuickPin(pin: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const res = await fetch('/api/auth/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'Không thể lưu Mã PIN.' };
      }
      const cur = this.getCurrentUser();
      if (cur) {
        cur.hasPin = true;
        this.setCurrentUser(cur);
      }
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Lỗi mạng khi thiết lập Mã PIN.' };
    }
  },

  async verifyQuickPin(pin: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ pin }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async toggle2FA(enable: boolean): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const res = await fetch('/api/auth/2fa/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ enable }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'Không thể cập nhật cài đặt 2FA.' };
      }
      const cur = this.getCurrentUser();
      if (cur) {
        cur.twoFactorEnabled = enable;
        this.setCurrentUser(cur);
      }
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Lỗi mạng khi cập nhật 2FA.' };
    }
  },

  logout(): void {
    const headers = getAuthHeaders();
    if (headers.Authorization) fetch('/api/auth/logout', { method: 'POST', headers }).catch(() => {});
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    this.setCurrentUser(null);
  },

  kickUserDevice(userId: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Không tìm thấy người dùng.' };

    user.activeDeviceId = undefined;
    user.activeDeviceName = undefined;
    this.saveUsers(users);
    return { success: true };
  },

  async checkDeviceSession(currentUser: UserAccount): Promise<{ isKicked: boolean; newDeviceName?: string }> {
    if (!currentUser || currentUser.role === 'ADMIN') {
      return { isKicked: false };
    }
    const currentDeviceId = DeviceService.getDeviceId();
    const users = await this.syncUsersFromServer();
    const serverUser = users.find(u => u.id === currentUser.id);

    if (serverUser && serverUser.activeDeviceId && serverUser.activeDeviceId !== currentDeviceId) {
      this.logout();
      return {
        isKicked: true,
        newDeviceName: serverUser.activeDeviceName || 'một thiết bị khác',
      };
    }
    return { isKicked: false };
  },

  async createUser(data: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
    email?: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const username = data.username.trim();
    const password = data.password.trim();
    const fullName = data.fullName.trim();
    if (!username || !password || !fullName) {
      return { success: false, error: 'Vui lòng nhập đủ Tên đăng nhập, Mật khẩu và Họ tên.' };
    }

    try {
      const response = await fetch('/api/auth/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          username,
          password,
          fullName,
          role: data.role || 'STAFF',
          phone: data.phone?.trim() || '',
          email: data.email?.trim() || '',
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể tạo tài khoản trên máy chủ.' };
      }

      await this.syncUsersFromServer();
      return { success: true, user: result.user };
    } catch (err: any) {
      return { success: false, error: 'Lỗi kết nối máy chủ: ' + (err?.message || err) };
    }
  },

  async updateUser(
    userId: string,
    updates: Partial<Omit<UserAccount, 'id' | 'username' | 'createdAt'>>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/auth/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: userId, ...updates }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể cập nhật tài khoản trên máy chủ.' };
      }
      await this.syncUsersFromServer();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Lỗi kết nối máy chủ: ' + (err?.message || err) };
    }
  },

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/auth/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: userId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể xóa người dùng.' };
      }
      await this.syncUsersFromServer();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Lỗi kết nối: ' + (err?.message || err) };
    }
  },

  async changePassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 4 ký tự.' };
    }
    try {
      const response = await fetch('/api/auth/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: userId, newPassword }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể đổi mật khẩu.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Lỗi kết nối: ' + (err?.message || err) };
    }
  },

  async toggleUserActive(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/auth/users/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ id: userId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return { success: false, error: result?.error || 'Không thể thay đổi trạng thái tài khoản.' };
      }
      await this.syncUsersFromServer();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Lỗi kết nối: ' + (err?.message || err) };
    }
  },
};
