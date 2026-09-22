import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { supabase } from '../../../supabaseClient';
import { urlBase64ToUint8Array } from '../../../utils/fileUtils';
import { calendarLocalDate } from '../services/weeklyFieldPlan';
import type { CalendarReminder, Field, Screen } from '../../../types';

type UseCalendarControllerOptions = {
  realFields: Field[];
  selectedField: Field | null;
  setScreen: Dispatch<SetStateAction<Screen>>;
};

export function useCalendarController({
  realFields,
  selectedField,
  setScreen,
}: UseCalendarControllerOptions) {
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminder[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderFormLoading, setReminderFormLoading] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderFieldId, setReminderFieldId] = useState('');
  const [reminderType, setReminderType] = useState('Saha Kontrolü');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(calendarLocalDate(new Date()));
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');

  const [pushSupported, setPushSupported] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  const savePushSubscription = async (subscription: PushSubscription) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) throw new Error('Bildirimleri açmak için giriş yapmalısın.');

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON(),
          user_agent: navigator.userAgent,
          enabled: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );

    if (error) throw error;
  };

  const checkPushNotificationStatus = async () => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setPushSupported(supported);
    if (!supported) {
      setPushEnabled(false);
      setPushMessage('Bu tarayıcı web push bildirimlerini desteklemiyor.');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushEnabled(false);
      setPushMessage(
        'Bildirim izni tarayıcıda kapalı. Adres çubuğundaki site ayarlarından Bildirimler → İzin ver seç.',
      );
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        setPushEnabled(Notification.permission === 'granted');
        await savePushSubscription(subscription);
      } else {
        setPushEnabled(false);
      }
    } catch (error) {
      console.warn('Push bildirim durumu kontrol edilemedi:', error);
    }
  };

  const enablePushNotifications = async () => {
    setPushLoading(true);
    setPushMessage('');

    try {
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim();
      if (!vapidPublicKey) {
        setPushEnabled(false);
        setPushMessage(
          'Telefon bildirimlerinin sunucu anahtarı bu önizlemede tanımlı değil. VAPID public key eklendiğinde buradan tek dokunuşla açılacak.',
        );
        return;
      }

      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setPushSupported(false);
        throw new Error('Bu tarayıcı push bildirimlerini desteklemiyor.');
      }

      /*
       * Kullanıcı daha önce bildirimi engellediyse requestPermission() çağırma.
       * Chrome bu durumda ekranın altında kendi uyarı bandını çıkarıyor.
       * Biz bunun yerine açıklamayı uygulama kartının içinde gösteriyoruz.
       */
      if (Notification.permission === 'denied') {
        setPushEnabled(false);
        setPushMessage(
          'Bildirim izni tarayıcıda kapalı. Adres çubuğundaki site ayarlarından Bildirimler → İzin ver seç.',
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushEnabled(false);
        setPushMessage('Bildirim izni verilmedi. İstersen daha sonra tekrar açabilirsin.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await savePushSubscription(subscription);
      setPushEnabled(true);
      setPushMessage(
        'Telefon bildirimleri açık. Hatırlatma zamanı geldiğinde TarlaPusula bildirim gönderebilir.',
      );

      await registration.showNotification('TarlaPusula bildirimleri açık', {
        body: 'Tarla hatırlatmalarını artık telefonunda görebilirsin.',
        tag: 'tarlapusula-push-enabled',
        data: { url: window.location.origin },
      });
    } catch (error) {
      console.error('Push bildirim açılamadı:', error);
      setPushEnabled(false);
      setPushMessage(error instanceof Error ? error.message : 'Telefon bildirimi açılamadı.');
    } finally {
      setPushLoading(false);
    }
  };

  const disablePushNotifications = async () => {
    setPushLoading(true);
    setPushMessage('');

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('endpoint', subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }

      setPushEnabled(false);
      setPushMessage('Telefon bildirimleri kapatıldı.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'Bildirimler kapatılamadı.');
    } finally {
      setPushLoading(false);
    }
  };

  const sendTestPushNotification = async () => {
    if (!pushEnabled) return;
    setPushLoading(true);
    setPushMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('send-due-reminders', {
        body: { test: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPushMessage('Test bildirimi gönderildi. Birkaç saniye içinde görünmeli.');
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : 'Test bildirimi gönderilemedi.');
    } finally {
      setPushLoading(false);
    }
  };

  const resetReminderForm = (field?: Field | null) => {
    setReminderFieldId(field ? String(field.id) : '');
    setReminderType('Saha Kontrolü');
    setReminderTitle('');
    setReminderDate(calendarLocalDate(new Date()));
    setReminderTime('');
    setReminderNotes('');
    setReminderMessage('');
  };

  const loadCalendarReminders = async () => {
    setCalendarLoading(true);
    setReminderMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setCalendarReminders([]);
        return;
      }

      const { data, error } = await supabase
        .from('calendar_reminders')
        .select('id, field_id, reminder_type, title, reminder_date, reminder_time, notes, completed, fields(name)')
        .eq('user_id', user.id)
        .order('reminder_date', { ascending: true })
        .order('reminder_time', { ascending: true, nullsFirst: false });
      if (error) throw error;

      setCalendarReminders(
        (data ?? []).map((item: any) => ({
          id: String(item.id),
          fieldId: String(item.field_id),
          fieldName: item.fields?.name ?? 'Tarla',
          reminderType: item.reminder_type ?? 'Diğer',
          title: item.title ?? item.reminder_type ?? 'Hatırlatma',
          reminderDate: item.reminder_date,
          reminderTime: item.reminder_time ?? null,
          notes: item.notes ?? null,
          completed: Boolean(item.completed),
        })),
      );
    } catch (error) {
      console.error('Takvim yüklenemedi:', error);
      setReminderMessage(error instanceof Error ? error.message : 'Takvim yüklenemedi.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const openCalendarScreen = () => {
    setScreen('calendar');
    void loadCalendarReminders();
    void checkPushNotificationStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReminderModal = (field?: Field | null) => {
    const targetField = field ?? selectedField ?? realFields[0] ?? null;
    resetReminderForm(targetField);
    setReminderFormOpen(true);
  };

  const handleAddReminder = async (event: FormEvent) => {
    event.preventDefault();
    if (!reminderFieldId) {
      setReminderMessage('Hatırlatmanın ait olduğu tarlayı seç.');
      return;
    }
    if (!reminderDate) {
      setReminderMessage('Hatırlatma tarihini seç.');
      return;
    }

    setReminderFormLoading(true);
    setReminderMessage('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase.from('calendar_reminders').insert({
        user_id: user.id,
        field_id: reminderFieldId,
        reminder_type: reminderType,
        title: reminderTitle.trim() || `${reminderType} hatırlatması`,
        reminder_date: reminderDate,
        reminder_time: reminderTime || null,
        notes: reminderNotes.trim() || null,
        completed: false,
        notification_enabled: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
      });
      if (error) throw error;

      setReminderFormOpen(false);
      resetReminderForm();
      await loadCalendarReminders();
    } catch (error) {
      setReminderMessage(error instanceof Error ? error.message : 'Hatırlatma kaydedilemedi.');
    } finally {
      setReminderFormLoading(false);
    }
  };

  const handleToggleReminder = async (reminder: CalendarReminder) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('calendar_reminders')
      .update({
        completed: !reminder.completed,
        completed_at: !reminder.completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminder.id)
      .eq('user_id', user.id);

    if (error) setReminderMessage(error.message);
    else await loadCalendarReminders();
  };

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm('Bu hatırlatmayı silmek istiyor musun?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('calendar_reminders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) setReminderMessage(error.message);
    else await loadCalendarReminders();
  };

  return {
    calendarReminders,
    calendarLoading,
    reminderFormOpen,
    reminderFormLoading,
    reminderMessage,
    reminderFieldId,
    reminderType,
    reminderTitle,
    reminderDate,
    reminderTime,
    reminderNotes,
    setReminderFormOpen,
    setReminderMessage,
    setReminderFieldId,
    setReminderType,
    setReminderTitle,
    setReminderDate,
    setReminderTime,
    setReminderNotes,
    pushSupported,
    pushEnabled,
    pushLoading,
    pushMessage,
    openCalendarScreen,
    openReminderModal,
    handleAddReminder,
    handleToggleReminder,
    handleDeleteReminder,
    enablePushNotifications,
    disablePushNotifications,
    sendTestPushNotification,
  };
}
