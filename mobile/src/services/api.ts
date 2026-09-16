import AsyncStorage from '@react-native-async-storage/async-storage';

// Production Railway backend URL
const DEFAULT_API_URL = 'https://pregnant-production.up.railway.app/api';
const STORAGE_KEY_TOKEN = '@pregnacare_token';
const STORAGE_KEY_USER = '@pregnacare_user';
const STORAGE_KEY_BASE_URL = '@pregnacare_api_url';

class ApiService {
  private baseUrl: string = DEFAULT_API_URL;
  private token: string | null = null;

  async init() {
    try {
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
      if (savedUrl) this.baseUrl = savedUrl;

      const savedToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedToken) this.token = savedToken;
    } catch (e) {
      console.error('Failed to load stored API settings:', e);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async setBaseUrl(url: string) {
    let clean = url.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    this.baseUrl = clean;
    await AsyncStorage.setItem(STORAGE_KEY_BASE_URL, clean);
  }

  getToken(): string | null {
    return this.token;
  }

  async setAuth(token: string | null, user: any = null) {
    this.token = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
      if (user) await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEY_USER);
    }
  }

  async getCachedUser(): Promise<any | null> {
    try {
      const u = await AsyncStorage.getItem(STORAGE_KEY_USER);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const text = await res.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server returned HTML status ${res.status}`);
      }

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      return data as T;
    } catch (err: any) {
      console.warn(`[API] Error on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // --- Auth Endpoints ---
  async login(email: string, password: string) {
    const data = await this.request('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      await this.setAuth(data.token, data.user);
    }
    return data;
  }

  async register(payload: {
    name: string;
    email: string;
    password: string;
    dob?: string;
    lmp?: string;
    edd?: string;
    age?: number;
    height_cm?: number;
    weight_kg?: number;
    phone?: string;
  }) {
    const data = await this.request('auth.php?action=register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) {
      await this.setAuth(data.token, data.user);
    }
    return data;
  }

  async getProfile() {
    return this.request('auth.php?action=me');
  }

  async updateProfile(fields: Record<string, any>) {
    return this.request('auth.php?action=update_profile', {
      method: 'POST',
      body: JSON.stringify(fields),
    });
  }

  async logout() {
    try {
      await this.request('auth.php?action=logout', { method: 'POST' });
    } finally {
      await this.setAuth(null, null);
    }
  }

  // --- Dashboard Endpoint ---
  async getDashboard() {
    return this.request('dashboard.php');
  }

  async markAllNotificationsRead() {
    return this.request('dashboard.php?action=mark_all_read', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
  }

  async markNotificationRead(id: string) {
    return this.request('dashboard.php?action=mark_read', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    });
  }

  // --- Vitals Monitoring Endpoints ---
  async getVitals(limit = 30) {
    return this.request(`monitoring.php?limit=${limit}`);
  }

  async logVitals(payload: { bp_sys?: number; bp_dia?: number; weight_kg?: number; blood_sugar?: number; hemoglobin?: number; temp?: number }) {
    return this.request('monitoring.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Symptoms & Risk Engine ---
  async getSymptomCatalog() {
    return this.request('symptoms.php');
  }

  async submitSymptoms(payload: {
    symptoms: Array<{ id: string; severity: string; duration?: string; frequency?: string }>;
    pregnancy_problems?: Record<string, boolean>;
  }) {
    return this.request('symptoms.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Trackers ---
  async getKicks() {
    return this.request('trackers.php?kind=kick');
  }

  async logKick() {
    return this.request('trackers.php?action=kick', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getContractions() {
    return this.request('trackers.php?kind=contraction');
  }

  async logContraction(durationSeconds: number) {
    return this.request('trackers.php?action=contraction', {
      method: 'POST',
      body: JSON.stringify({ duration_seconds: durationSeconds }),
    });
  }

  async deleteTracker(id: string) {
    return this.request(`trackers.php?action=delete&id=${id}`, {
      method: 'POST',
    });
  }

  // --- Wellness Tools ---
  async getHospitalBag() {
    return this.request('wellness.php?section=hospital_bag');
  }

  async toggleHospitalBagItem(id: string) {
    return this.request('wellness.php?section=hospital_bag&action=toggle', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  async addHospitalBagItem(label: string, category = 'General') {
    return this.request('wellness.php?section=hospital_bag&action=add', {
      method: 'POST',
      body: JSON.stringify({ label, category }),
    });
  }

  async getMedications() {
    return this.request('wellness.php?section=medications');
  }

  async toggleMedication(medicationId: string) {
    return this.request('wellness.php?section=medications&action=toggle', {
      method: 'POST',
      body: JSON.stringify({ medication_id: medicationId }),
    });
  }

  async getBirthPlan() {
    return this.request('wellness.php?section=birth_plan');
  }

  async saveBirthPlan(plan: Record<string, any>) {
    return this.request('wellness.php?section=birth_plan', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  }

  async getWeightGain() {
    return this.request('wellness.php?section=weight_gain');
  }

  // --- Journal ---
  async getJournalEntries() {
    return this.request('wellness.php?section=journal');
  }

  async addJournalEntry(mood: string, content: string) {
    return this.request('wellness.php?section=journal&action=add', {
      method: 'POST',
      body: JSON.stringify({ mood, content }),
    });
  }

  async deleteJournalEntry(id: string) {
    return this.request('wellness.php?section=journal&action=delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  // --- Bump Photos ---
  async getBumpPhotos() {
    return this.request('wellness.php?section=bump_photos');
  }

  async addBumpPhoto(weekNumber: number, note?: string, filename?: string) {
    return this.request('wellness.php?section=bump_photos&action=add', {
      method: 'POST',
      body: JSON.stringify({ week_number: weekNumber, note, filename }),
    });
  }

  async deleteBumpPhoto(id: string) {
    return this.request('wellness.php?section=bump_photos&action=delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  // --- Postpartum & Baby Care ---
  async getPostpartum() {
    return this.request('wellness.php?section=postpartum');
  }

  async markDelivered(deliveryDate: string, deliveryType: string, babyName?: string) {
    return this.request('wellness.php?section=postpartum&action=mark_delivered', {
      method: 'POST',
      body: JSON.stringify({ delivery_date: deliveryDate, delivery_type: deliveryType, baby_name: babyName }),
    });
  }

  async updatePostpartumNotes(notes: string) {
    return this.request('wellness.php?section=postpartum&action=update_notes', {
      method: 'POST',
      body: JSON.stringify({ recovery_notes: notes }),
    });
  }

  async toggleBabyVaccine(vaxId: string, given: boolean) {
    return this.request('wellness.php?section=postpartum&action=toggle_vaccine', {
      method: 'POST',
      body: JSON.stringify({ vax_id: vaxId, given: given ? 1 : 0 }),
    });
  }

  // --- Education & Meal Planner ---
  async getEducationGuidance() {
    return this.request('wellness.php?section=education');
  }

  async getMealPlan() {
    return this.request('wellness.php?section=meal_planner');
  }

  // --- Reminders ---
  async getReminders() {
    return this.request('wellness.php?section=reminders');
  }

  async setObVisit(nextObVisit: string) {
    return this.request('wellness.php?section=reminders&action=set_ob_visit', {
      method: 'POST',
      body: JSON.stringify({ next_ob_visit: nextObVisit }),
    });
  }
}

export const api = new ApiService();
