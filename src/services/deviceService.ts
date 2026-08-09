// Helper to generate a persistent unique Device ID for the current browser
export const DeviceService = {
  getDeviceId(): string {
    let deviceId = localStorage.getItem('gomdon_device_id_v1');
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('gomdon_device_id_v1', deviceId);
    }
    return deviceId;
  },

  getDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = 'Trình duyệt';
    let os = 'Thiết bị';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Windows')) os = 'Windows PC';
    else if (ua.includes('Android')) os = 'Điện thoại Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iPhone/iPad';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} (${os})`;
  }
};
