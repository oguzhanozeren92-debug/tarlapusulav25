import { useEffect, useState } from 'react';
import { fetchHomeProfileSummary } from '../services/homeProfile.service';

export function useHomeProfile() {
  const [profileName, setProfileName] = useState('Çiftçi');
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    void fetchHomeProfileSummary()
      .then((profile) => {
        if (!alive || !profile) return;
        setProfileName(profile.profileName);
        if (profile.points != null) setPoints(profile.points);
      })
      .catch(() => {
        // Profil bilgisi görünümü bozmasın.
      });

    return () => {
      alive = false;
    };
  }, []);

  return { profileName, points };
}
