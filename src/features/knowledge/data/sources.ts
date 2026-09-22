import type { KnowledgeSource } from '../types.ts';

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: 'openfarm', name: 'OpenFarm', url: 'https://github.com/openfarmcc/OpenFarm',
    description: 'Bitki yetiştirme ve bakım rehberleri.', status: 'Arşiv kaynağı',
    limitation: 'Hizmet Nisan 2025’te kapandı. Canlı içerik alınmıyor; erişilebilir veri arşivi gerekli.',
    license: 'Veri: CC0; yazılım: MIT', checkedAt: '2026-09-16',
  },
  {
    id: 'pdo', name: 'Plant Disease Ontology', url: 'https://github.com/Planteome/plant-disease-ontology',
    description: 'Bitki hastalıklarının adlarını ve aralarındaki ilişkileri düzenleyen sözlük.',
    status: 'Ön çalışma', limitation: 'Kaynak ön çalışma olarak işaretli ve Plant Stress Ontology’ye taşınıyor. İçerik lisansı ve terimler doğrulanmadan aktarılmadı.',
    license: 'İçerik kullanım koşulları doğrulanmalı', checkedAt: '2026-09-16',
  },
  {
    id: 'agrodss', name: 'AgrODSS / PDP-O', url: 'https://github.com/Amalharbi/AgrODSS',
    description: 'Hastalık, zararlı ve mücadele kavramlarını ilişkilendiren araştırma projesi.',
    status: 'Kaynak bağlantısı', limitation: 'Depoda araştırma belgeleri var. Kullanılabilir ontoloji dosyası ve yeniden kullanım izni henüz doğrulanmadı.',
    license: 'İçerik kullanım koşulları doğrulanmalı', checkedAt: '2026-09-16',
  },
  {
    id: 'agripest', name: 'AgriPestDatabase', url: 'https://github.com/SHAFNehal/AgriPestDatabase_USDA_TextDataBase_for_LLM_Training',
    description: 'USDA belgelerinden derlenen zararlı bilgi metinleri; bağımsız araştırma veri seti.',
    status: 'Taslak kaynak', limitation: 'Resmî USDA API’si değildir. Kaynak kendi içeriğini taslak olarak işaretliyor; tam metinler aktarılmadı.',
    license: 'Belge bazında kullanım koşulları doğrulanmalı', checkedAt: '2026-09-16',
  },
  {
    id: 'plantvillage', name: 'PlantVillage', url: 'https://github.com/spMohanty/PlantVillage-Dataset',
    description: 'Bitki yaprakları için hastalık ve sağlıklı örnek sınıfları.',
    status: 'Türkçe etiket kataloğu', limitation: 'Yalnızca sınıf adları Türkçeleştirildi. Fotoğraf arşivi, teşhis modeli veya mücadele rehberi değildir.',
    license: 'CC BY-SA 3.0 (veri kartı)', checkedAt: '2026-09-16',
  },
  {
    id: 'ip102', name: 'IP102', url: 'https://github.com/xpwu95/IP102',
    description: 'Böcek zararlıları için görüntü tanıma araştırma veri seti.',
    status: 'Kullanım izni gerekiyor', limitation: 'Ücretsiz kullanım akademik amaçlarla sınırlı. Uygulamada dağıtım için hak sahibinin izni gerekli; görüntüler aktarılmadı.',
    license: 'Akademik kullanım; diğer amaçlar için izin', checkedAt: '2026-09-16',
  },
];
