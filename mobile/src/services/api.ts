import AsyncStorage from '@react-native-async-storage/async-storage';

// Production Railway backend URL
const DEFAULT_API_URL = 'https://pregnant-production.up.railway.app/api';
const STORAGE_KEY_TOKEN = '@pregnacare_token';
const STORAGE_KEY_USER = '@pregnacare_user';
const STORAGE_KEY_BASE_URL = '@pregnacare_api_url';

const STORAGE_KEY_CACHE_PREFIX = '@pregnacare_cache_';
const STORAGE_KEY_OFFLINE_QUEUE = '@pregnacare_offline_queue';

interface QueuedMutation {
  id: string;
  endpoint: string;
  options: RequestInit;
  timestamp: string;
}

class ApiService {
  private baseUrl: string = DEFAULT_API_URL;
  private token: string | null = null;
  private isOffline: boolean = false;

  async init() {
    try {
      const savedToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedToken) this.token = savedToken;
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
      if (savedUrl) this.baseUrl = savedUrl;
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

  getIsOffline(): boolean {
    return this.isOffline;
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

  private isNetworkError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('connection refused') ||
      msg.includes('network request failed')
    );
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const method = (options.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const cacheKey = `${STORAGE_KEY_CACHE_PREFIX}${endpoint.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    // AbortController with 7-second timeout (extended to 45s for large payloads like images)
    const isLargePayload = options.body && typeof options.body === 'string' && options.body.length > 50000;
    const timeoutDuration = isLargePayload ? 45000 : 7000;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      if (this.token === 'offline_token') {
        // Immediately throw a fake network error so it triggers offline queue/cache
        throw new Error('network request failed (guest mode)');
      }

      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        let cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        if (cleanText.includes('Fatal error:')) {
          cleanText = cleanText.split('Stack trace:')[0].trim();
        }
        throw new Error(cleanText || `Server returned HTML status ${res.status}`);
      }

      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      this.isOffline = false;

      // Cache successful GET endpoints locally for offline usage
      if (method === 'GET') {
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isNet = this.isNetworkError(err);
      if (isNet) {
        this.isOffline = true;
      }

      // 1. Offline GET Fallback: Read from local AsyncStorage cache
      if (method === 'GET' && isNet) {
        try {
          const cachedJson = await AsyncStorage.getItem(cacheKey);
          if (cachedJson) {
            const cachedData = JSON.parse(cachedJson);
            cachedData._isOffline = true;
            console.log(`[API Cache] Returning offline cached copy for ${endpoint}`);
            return cachedData as T;
          }
          if (this.token === 'offline_token') {
            console.log(`[API Fallback] Returning hardcoded default for ${endpoint}`);
            return this.getOfflineFallbackData(endpoint) as T;
          }
        } catch (cacheErr) {
          console.warn('[API Cache Read Error]', cacheErr);
        }
      }

      // 2. Offline POST Queue: Store mutations for later auto-sync
      if (method === 'POST' && isNet) {
        // We can queue ANY post request EXCEPT login and register
        const isAuth = endpoint.includes('auth.php?action=login') || endpoint.includes('auth.php?action=register');

        if (!isAuth) {
          await this.enqueueOfflineMutation(endpoint, options);
          return {
            success: true,
            _queuedOffline: true,
            message: 'Recorded offline. Will automatically sync when reconnected.',
          } as any as T;
        }
      }

      console.log(`[API] Response notice on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // --- Offline Guest Fallbacks ---
  private getOfflineFallbackData(endpoint: string): any {
    const base = { success: true, _isOffline: true };
    if (endpoint.includes('dashboard')) {
      return { ...base, user: { name: 'Guest', email: 'offline@local' }, risk_summary: { score: 'Low', messages: [] }, notifications: { items: [], unread_count: 0 }, last_vitals: null };
    }
    if (endpoint.includes('wellness') && endpoint.includes('hospital_bag')) {
      return { ...base, data: [
        { id: '1', item_label: 'Phil Health/ MDR/Marriage Contract and PSA Birth Certificate', category: 'For Mom', is_packed: 0 },
        { id: '2', item_label: 'Birth Plan', category: 'General', is_packed: 0 },
        { id: '3', item_label: 'Comfortable Clothes', category: 'For Mom', is_packed: 0 },
        { id: '4', item_label: 'Toiletries', category: 'For Mom', is_packed: 0 },
        { id: '5', item_label: 'Baby Clothes (Newborn)', category: 'For Baby', is_packed: 0 },
        { id: '6', item_label: 'Diapers & Wipes', category: 'For Baby', is_packed: 0 }
      ]};
    }
    if (endpoint.includes('wellness') && endpoint.includes('education')) {
      return { ...base, data: [
        { id: '1', title: 'Welcome to PregnaCare (Offline)', category: 'General', content: 'You are using the app offline. Your data will sync when you connect to the internet.', trimester_tag: null }
      ]};
    }
    // Default empty lists for trackers, vitals, etc.
    return { ...base, data: [], items: [] };
  }

  // --- Offline Queue Engine ---
  private async enqueueOfflineMutation(endpoint: string, options: RequestInit) {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      const queue: QueuedMutation[] = existing ? JSON.parse(existing) : [];
      queue.push({
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        endpoint,
        options,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue));
      console.log(`[Offline Queue] Queued mutation for ${endpoint}. Total queued: ${queue.length}`);
    } catch (e) {
      console.warn('[Offline Queue Error]', e);
    }
  }

  async getOfflineQueueCount(): Promise<number> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      const queue: QueuedMutation[] = existing ? JSON.parse(existing) : [];
      return queue.length;
    } catch {
      return 0;
    }
  }

  async syncOfflineQueue(): Promise<{ synced: number; remaining: number }> {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      if (!existing) return { synced: 0, remaining: 0 };
      const queue: QueuedMutation[] = JSON.parse(existing);
      if (queue.length === 0) return { synced: 0, remaining: 0 };

      console.log(`[Offline Sync] Attempting to sync ${queue.length} queued records...`);
      const remaining: QueuedMutation[] = [];
      let syncedCount = 0;

      for (const item of queue) {
        try {
          const url = `${this.baseUrl}/${item.endpoint.replace(/^\//, '')}`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(item.options.headers as Record<string, string> || {}),
          };
          if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

          const res = await fetch(url, { ...item.options, headers });
          if (res.ok) {
            syncedCount++;
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      await AsyncStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(remaining));
      this.isOffline = remaining.length > 0;
      console.log(`[Offline Sync] Synced ${syncedCount} items, ${remaining.length} remaining.`);
      return { synced: syncedCount, remaining: remaining.length };
    } catch (e) {
      console.warn('[Offline Sync Error]', e);
      return { synced: 0, remaining: 0 };
    }
  }

  // --- Auth Endpoints ---
  async login(emailOrUsername: string, password: string) {
    const data = await this.request('auth.php?action=login', {
      method: 'POST',
      body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, password }),
    });
    if (data.token) {
      await this.setAuth(data.token, data.user);
    }
    return data;
  }

  async resetPassword(emailOrUsername: string, newPassword: string) {
    return await this.request('auth.php?action=reset_password', {
      method: 'POST',
      body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, new_password: newPassword }),
    });
  }

  async register(payload: {
    username?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    name?: string;
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

  async clearAllNotifications() {
    return this.request('dashboard.php?action=clear_all', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_all' }),
    });
  }

  async deleteNotification(id: string) {
    return this.request('dashboard.php?action=delete', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id }),
    });
  }

  async markNotificationRead(id: string) {
    return this.request('dashboard.php?action=mark_read', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    });
  }

  async resolveClinicalVisit(payload: {
    assessment_id?: string;
    facility: string;
    doctor_name?: string;
    visit_date?: string;
    notes?: string;
  }) {
    return this.request('dashboard.php?action=resolve_visit', {
      method: 'POST',
      body: JSON.stringify({ action: 'resolve_visit', ...payload }),
    });
  }

  // --- Vitals Monitoring Endpoints ---
  async getVitals(limit = 30) {
    return this.request(`monitoring.php?limit=${limit}`);
  }

  async logVitals(payload: {
    bp_sys?: number;
    bp_dia?: number;
    weight_kg?: number;
    blood_sugar?: number;
    hemoglobin?: number;
    temp?: number;
    heart_rate?: number;
    respiratory_rate?: number;
    spo2?: number;
    fetal_heart_rate?: number;
    fetal_movement?: number;
    sleep_hours?: number;
    water_intake?: number;
    mood?: string;
    activity?: string;
    glucose_timing?: string;
    date?: string;
  }) {
    return this.request('monitoring.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Prenatal Laboratory Endpoints ---
  async getLaboratoryResults(limit = 30) {
    return this.request(`monitoring.php?section=laboratory&limit=${limit}`);
  }

  async logLaboratoryResult(payload: {
    date?: string;
    lab_type?: 'initial' | 'followup' | 'investigation';
    cbc_hemoglobin?: number;
    cbc_hematocrit?: number;
    cbc_wbc?: number;
    cbc_platelets?: number;
    blood_type?: string;
    rh_factor?: string;
    urinalysis_protein?: string;
    urinalysis_glucose?: string;
    urinalysis_ketones?: string;
    blood_glucose?: number;
    hiv_screening?: string;
    syphilis_screening?: string;
    hepb_screening?: string;
    urine_culture?: string;
    other_tests?: string;
    ultrasound_notes?: string;
    fetal_heart_rate?: number;
    fundal_height_cm?: number;
    fetal_movement?: number;
    notes?: string;
  }) {
    return this.request('monitoring.php?section=laboratory', {
      method: 'POST',
      body: JSON.stringify({ section: 'laboratory', ...payload }),
    });
  }

  // --- Symptoms & Risk Engine ---
  async getSymptomCatalog() {
    return this.request('symptoms.php');
  }

  async submitSymptoms(payload: {
    symptoms: Array<{ id: string; severity: string; duration?: string; frequency?: string }>;
    pregnancy_problems?: Record<string, boolean>;
    [key: string]: any;
  }) {
    return this.request('symptoms.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getCooplandAssessment() {
    try {
      const res = await this.getSymptomCatalog();
      return {
        coopland: res?.coopland || null,
        clinical_alerts: res?.clinical_alerts || [],
      };
    } catch {
      return { coopland: null, clinical_alerts: [] };
    }
  }

  async submitCooplandAssessment(payload: {
    score: number;
    risk_level: string;
    matched_factors: string[];
    symptoms?: any[];
    pregnancy_problems?: Record<string, boolean>;
  }) {
    // Route directly through symptoms.php (which persists assessment, Coopland score & risk)
    return await this.submitSymptoms({
      source: 'coopland',
      action: 'coopland',
      symptoms: payload.symptoms || [],
      pregnancy_problems: payload.pregnancy_problems || {},
      score: payload.score,
      coopland_score: payload.score,
      risk_level: payload.risk_level,
      coopland_risk: payload.risk_level,
      matched_factors: payload.matched_factors,
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
    const res = await this.request('wellness.php?section=hospital_bag');
    if (res && res.categories && typeof res.categories === 'object') {
      Object.keys(res.categories).forEach((cat) => {
        if (cat === 'For Mom' && Array.isArray(res.categories[cat])) {
          res.categories[cat] = res.categories[cat].map((item: any) => {
            if (item.label === 'ID and hospital documents' || item.label?.toLowerCase() === 'id and hospital documents' || item.label?.toLowerCase().includes('id and hospital')) {
              return { ...item, label: 'Phil Health/ MDR/Marriage Contract and PSA Birth Certificate' };
            }
            return item;
          });
        }
      });
    }
    return res;
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

  async addMedication(name: string, dosage?: string, scheduleTime?: string) {
    return this.request('wellness.php?section=medications&action=add', {
      method: 'POST',
      body: JSON.stringify({ name, dosage, schedule_time: scheduleTime }),
    });
  }

  async deleteMedication(id: string) {
    return this.request('wellness.php?section=medications&action=delete', {
      method: 'POST',
      body: JSON.stringify({ id, medication_id: id }),
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

  async addBumpPhoto(week_number: number, note: string, imageBase64: string) {
    return this.request('wellness.php?section=bump_photos&action=add', {
      method: 'POST',
      body: JSON.stringify({ week_number, note, image_base64: imageBase64 }),
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

  async toggleMedicationTaken(medicationId: string) {
    return this.request('wellness.php?section=reminders&action=toggle_taken', {
      method: 'POST',
      body: JSON.stringify({ medication_id: medicationId }),
    });
  }

  async addSupplement(name: string, dosage: string, scheduleTime: string) {
    return this.request('wellness.php?section=reminders&action=add_supplement', {
      method: 'POST',
      body: JSON.stringify({ name, dosage, schedule_time: scheduleTime }),
    });
  }
}

export const api = new ApiService();
