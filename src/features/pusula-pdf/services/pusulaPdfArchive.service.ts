import { supabase } from '../../../supabaseClient';
import { getPrivateFileUrl, uploadPrivateFile } from '../../../services/r2Storage';
import type { WeeklyPusulaReport } from '../types';
import { generatePusulaPdf } from './pusulaPdfRenderer.service';

function safePart(value: unknown) {
  return String(value ?? 'report').toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü-]+/gi, '-').replace(/^-+|-+$/g, '') || 'report';
}

export async function ensurePusulaPdfArchived(report: WeeklyPusulaReport) {
  if (report.pdf_path) return report.pdf_path;
  if (!report.report_data) throw new Error('Rapor snapshot verisi bulunamadı.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Rapor arşivi için oturum bulunamadı.');

  const doc = await generatePusulaPdf(report.report_data);
  const blob = doc.output('blob');
  const objectPath = [
    authData.user.id,
    report.field_id,
    safePart(report.report_data.field?.name),
    `${report.id}.pdf`,
  ].join('/');

  const storedPath = await uploadPrivateFile('reports', objectPath, blob, 'application/pdf');
  const { data, error } = await supabase
    .from('weekly_field_reports')
    .update({ pdf_bucket: 'r2:reports', pdf_path: storedPath, generated_at: new Date().toISOString() })
    .eq('id', report.id)
.eq('user_id', authData.user.id)
    .select('*')
    .single();
  if (error) throw error;
  return String(data.pdf_path ?? storedPath);
}

export async function openArchivedPusulaPdf(report: WeeklyPusulaReport) {
  const storedPath = await ensurePusulaPdfArchived(report);
  const url = await getPrivateFileUrl('reports', storedPath);
  if (!url) throw new Error('Rapor bağlantısı hazırlanamadı.');
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
  return storedPath;
}
