import type { UserAccount, UserRole } from '../types';
import { DeviceService } from './deviceService';

const USERS_STORAGE_KEY = 'gomdon_users_v1';
const CURRENT_USER_STORAGE_KEY = 'gomdon_current_user_v1';

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
    if (!raw) {
      this.saveUsers([DEFAULT_ADMIN_USER]);
      return [DEFAULT_ADMIN_USER];
    }
    try {
      const users: UserAccount[] = JSON.parse(raw);
      // Ensure super admin always exists with username 'admin'
      const adminIdx = users.findIndex(u => u.username.toLowerCase() === 'admin');
      if (adminIdx >= 0) {
        users[adminIdx] = { ...users[adminIdx], username: 'admin', password: users[adminIdx].password || 'admin@' };
      } else {
        users.unshift(DEFAULT_ADMIN_USER);
      }
      this.saveUsers(users);
      return users;
    } catch {
      this.saveUsers([DEFAULT_ADMIN_USER]);
      return [DEFAULT_ADMIN_USER];
    }
  },

  saveUsers(users: UserAccount[]): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    fetch('/api/db/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    }).catch(err => console.warn('[User Server Save Fail]:', err));
  },

  async syncUsersFromServer(): Promise<UserAccount[]> {
    try {
      const res = await fetch('/api/db/all');
      if (res.ok) {
        const result = await res.json();
        const serverUsers: UserAccount[] = (result.success && result.data && Array.isArray(result.data.users)) ? result.data.users : [];
        const localUsers: UserAccount[] = this.getUsers();

        // Merge local users and server users by username
        const mergedMap = new Map<string, UserAccount>();
        
        // Add default admin
        mergedMap.set(DEFAULT_ADMIN_USER.username.toLowerCase(), DEFAULT_ADMIN_USER);
        
        // Add server users
        serverUsers.forEach(u => {
          if (u && u.username) {
            mergedMap.set(u.username.toLowerCase(), u);
          }
        });

        // Add local users (if not present on server)
        let hasNewLocal = false;
        localUsers.forEach(u => {
          if (u && u.username && !mergedMap.has(u.username.toLowerCase())) {
            mergedMap.set(u.username.toLowerCase(), u);
            hasNewLocal = true;
          }
        });

        const mergedList = Array.from(mergedMap.values());
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mergedList));

        // If local had new users that server didn't have, push merged list to server!
        if (hasNewLocal || serverUsers.length < mergedList.length) {
          fetch('/api/db/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: mergedList }),
          }).catch(() => {});
        }

        return mergedList;
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

  async login(usernameInput: string, passwordInput: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const uClean = (usernameInput || '').trim();
    const pClean = (passwordInput || '').trim();

    if (!uClean || !pClean) {
      return { success: false, error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.' };
    }

    // Smart sync and merge with server before login check
    await this.syncUsersFromServer();

    const users = this.getUsers();
    const found = users.find(u => u.username.toLowerCase() === uClean.toLowerCase());

    if (!found) {
      return { success: false, error: 'Tên đăng nhập không tồn tại trên hệ thống.' };
    }

    if (!found.active) {
      return { success: false, error: 'Tài khoản này đang bị khóa. Vui lòng liên hệ Admin.' };
    }

    if (found.password !== pClean) {
      return { success: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại.' };
    }

    const deviceId = DeviceService.getDeviceId();
    const deviceName = DeviceService.getDeviceName();
    const now = new Date().toISOString();

    // 🔒 Block multi-device login for non-ADMIN accounts
    if (found.role !== 'ADMIN' && found.activeDeviceId && found.activeDeviceId !== deviceId) {
      return {
        success: false,
        error: `Tài khoản đang được đăng nhập trên thiết bị: "${found.activeDeviceName || 'máy khác'}". Vui lòng liên hệ Admin để được hỗ trợ đăng xuất thiết bị cũ.`,
      };
    }

    // Bind current device
    found.lastLoginAt = now;
    found.activeDeviceId = deviceId;
    found.activeDeviceName = deviceName;
    found.lastActiveAt = now;

    this.saveUsers(users);

    const sessionUser = { ...found };
    delete sessionUser.password; // do not keep plain password in current user state

    this.setCurrentUser(sessionUser);
    return { success: true, user: sessionUser };
  },

  logout(): void {
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

  createUser(data: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
    email?: string;
  }): { success: boolean; user?: UserAccount; error?: string } {
    const username = data.username.trim();
    if (!username || !data.password.trim() || !data.fullName.trim()) {
      return { success: false, error: 'Vui lòng nhập đủ Tên đăng nhập, Mật khẩu và Họ tên.' };
    }

    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: `Tên đăng nhập "${username}" đã tồn tại. Vui lòng chọn tên khác.` };
    }

    const newUser: UserAccount = {
      id: `user_${Date.now()}`,
      username,
      password: data.password.trim(),
      fullName: data.fullName.trim(),
      role: data.role || 'STAFF',
      phone: data.phone?.trim() || '',
      email: data.email?.trim() || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, user: newUser };
  },

  updateUser(
    userId: string,
    updates: Partial<Omit<UserAccount, 'id' | 'username' | 'createdAt'>>
  ): { success: boolean; error?: string } {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return { success: false, error: 'Không tìm thấy người dùng.' };

    users[index] = {
      ...users[index],
      ...updates,
    };

    this.saveUsers(users);

    // If current logged-in user was updated, refresh session
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      const refreshed = { ...users[index] };
      delete refreshed.password;
      this.setCurrentUser(refreshed);
    }

    return { success: true };
  },

  deleteUser(userId: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);

    if (!user) return { success: false, error: 'Không tìm thấy người dùng.' };
    if (user.username.toLowerCase() === DEFAULT_ADMIN_USER.username.toLowerCase()) {
      return { success: false, error: 'Không thể xóa tài khoản Quản trị viên tối cao (Super Admin).' };
    }

    const filtered = users.filter(u => u.id !== userId);
    this.saveUsers(filtered);
    return { success: true };
  },

  changePassword(userId: string, newPassword: string): { success: boolean; error?: string } {
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Mật khẩu phải có ít nhất 4 ký tự.' };
    }

    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Không tìm thấy người dùng.' };

    user.password = newPassword.trim();
    this.saveUsers(users);
    return { success: true };
  },

  toggleUserActive(userId: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Không tìm thấy người dùng.' };

    if (user.username.toLowerCase() === DEFAULT_ADMIN_USER.username.toLowerCase()) {
      return { success: false, error: 'Không thể khóa tài khoản Quản trị viên tối cao.' };
    }

    user.active = !user.active;
    this.saveUsers(users);
    return { success: true };
  },
};
