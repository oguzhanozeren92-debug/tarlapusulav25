import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { supabase } from '../../supabaseClient';
import type { CmsBlockRow, CmsMenuRow, CmsPageRow } from '../../types';
import './AdminVisualBuilder.css';

type Mode = 'screens' | 'menu';
const CURRENT = [
  ['home','Ana Sayfa','Günlük özet, seçili tarla, görevler ve Pusula kararları.','⌂',1],
  ['aiAnalysis','Fotoğraf Analizi','Pusula AI ile tarla fotoğrafını saha, uydu, iklim ve ürün verileriyle birlikte incele.','✦',2],
  ['weatherHub','Hava Durumu','Tarlaya özel tahmin, ilaçlama uygunluğu, yağış ve riskleri takip et.','☀',3],
  ['fieldControlHub','Tarla Kontrolü','Uydu katmanları, görevler, saha kontrolü ve tarla değişimini birlikte izle.','⌖',4],
  ['soilAnalysisHub','Toprak Analizi','Toprak analizleri, SoilGrids verileri ve toprak yorumlarını yönet.','◌',5],
  ['inventoryHub','İlaç & Gübre Depom','Stok, son kullanma tarihi ve tarla kullanım kayıtlarını takip et.','▣',6],
  ['marketHub','Piyasa Fiyatları','Ürün fiyatları, piyasa görünümü ve küresel bağlamı karşılaştır.','↗',7],
  ['supportHub','Tarımsal Destek','Tarla ve ürüne göre destekleri görüntüle ve hesapla.','▤',8],
  ['agendaHub','Tarım Gündemi','Onaylanmış tarım haberleri, uyarılar ve güncel gelişmeler.','▦',9],
  ['nutritionHub','Bitki Besin Maddeleri Rehberi','Besin elementleri, eksiklik belirtileri ve gübre kaynakları.','◉',10],
  ['pestGuideHub','Hastalık & Zararlı Rehberi','Ürüne göre hastalık, zararlı ve yabancı ot bilgisini incele.','✥',11],
  ['producerMarketHub','Üretici Pazarı','Ürün ilanlarını keşfet ve üretici pazarını yönet.','▱',12],
  ['fieldNotebookHub','Tarla Defteri','Ekimden hasada faaliyetleri, maliyetleri ve sezon geçmişini kaydet.','▧',13],
  ['notificationsHub','Bildirimler','Görevler, tarla uyarıları ve ürün uygunluğu sonuçlarını tek yerde gör.','◇',14],
  ['settingsHub','Ayarlar','Hesap, bildirim, konum ve uygulama tercihlerini yönet.','⚙',15],
  ['calendar','Takvim','Tarla işleri, hatırlatmalar ve telefon bildirimlerini planla.','▣',16],
  ['adminHub','Yönetim Merkezi','İçerik, tasarım, kaynaklar ve uygulama görünümünü yönet.','◆',99],
] as const;

const byPage = (a: CmsPageRow,b: CmsPageRow) => a.menu_order-b.menu_order;
const byBlock = (a: CmsBlockRow,b: CmsBlockRow) => a.position-b.position;
const byMenu = (a: CmsMenuRow,b: CmsMenuRow) => a.position-b.position;
function moved<T>(rows:T[],from:number,to:number){const n=[...rows];const [x]=n.splice(from,1);n.splice(to,0,x);return n;}

export default function AdminVisualBuilder(){
  const [mode,setMode]=useState<Mode>('screens');
  const [pages,setPages]=useState<CmsPageRow[]>([]);
  const [blocks,setBlocks]=useState<CmsBlockRow[]>([]);
  const [menus,setMenus]=useState<CmsMenuRow[]>([]);
  const [pageKey,setPageKey]=useState('home');
  const [blockId,setBlockId]=useState('');
  const [drag,setDrag]=useState('');
  const [pageText,setPageText]=useState({title:'',subtitle:''});
  const [blockText,setBlockText]=useState({title:'',subtitle:''});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    const [p,b,m]=await Promise.all([
      supabase.from('app_pages').select('*').order('menu_order'),
      supabase.from('app_blocks').select('*').order('position'),
      supabase.from('app_menu_items').select('*').order('position'),
    ]);
    const error=p.error||b.error||m.error;
    if(error){setMessage(error.message);return;}
    setPages(((p.data??[]) as CmsPageRow[]).sort(byPage));
    setBlocks(((b.data??[]) as CmsBlockRow[]).sort(byBlock));
    setMenus(((m.data??[]) as CmsMenuRow[]).sort(byMenu));
  };
  useEffect(()=>{void load();},[]);

  const page=useMemo(()=>pages.find(x=>x.page_key===pageKey)??null,[pages,pageKey]);
  const pageBlocks=useMemo(()=>blocks.filter(x=>x.page_key===pageKey).sort(byBlock),[blocks,pageKey]);
  const block=useMemo(()=>pageBlocks.find(x=>x.id===blockId)??null,[pageBlocks,blockId]);
  useEffect(()=>{setPageText({title:page?.title??'',subtitle:page?.subtitle??''});setBlockId('');},[page?.id]);
  useEffect(()=>setBlockText({title:block?.title??'',subtitle:block?.subtitle??''}),[block?.id]);

  const done=(text:string)=>{setBusy(false);setMessage(text);window.dispatchEvent(new Event('tp-cms-updated'));};
  const fail=(e:unknown)=>{setBusy(false);setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.');};
  const run=async(work:()=>Promise<void>,ok:string)=>{setBusy(true);setMessage('');try{await work();done(ok);}catch(e){fail(e);}};

  const sync=()=>run(async()=>{
    const payload=CURRENT.map(([key,title,subtitle,icon,order])=>{
      const old=pages.find(x=>x.page_key===key);
      return {...(old??{}),page_key:key,title,subtitle,icon:old?.icon||icon,menu_order:order,
        icon_size:old?.icon_size??22,icon_position:old?.icon_position??'left',is_visible:old?.is_visible??true,
        layout:old?.layout??'grid',columns_desktop:old?.columns_desktop??1,columns_tablet:old?.columns_tablet??1,
        columns_mobile:old?.columns_mobile??1,padding_top:old?.padding_top??24,padding_bottom:old?.padding_bottom??24,
        background_type:old?.background_type??'color',background_value:old?.background_value??'#fff'};
    });
    const r=await supabase.from('app_pages').upsert(payload,{onConflict:'page_key'});if(r.error)throw r.error;await load();
  },'Güncel uygulama ekranlarıyla eşitlendi.');

  const savePage=()=>page&&run(async()=>{const r=await supabase.from('app_pages').update({title:pageText.title.trim()||page.title,subtitle:pageText.subtitle.trim()||null}).eq('id',page.id);if(r.error)throw r.error;await load();},'Sayfa kaydedildi.');
  const saveBlock=()=>block&&run(async()=>{const r=await supabase.from('app_blocks').update({title:blockText.title.trim()||null,subtitle:blockText.subtitle.trim()||null}).eq('id',block.id);if(r.error)throw r.error;await load();},'Kart kaydedildi.');
  const togglePage=()=>page&&run(async()=>{const r=await supabase.from('app_pages').update({is_visible:!page.is_visible}).eq('id',page.id);if(r.error)throw r.error;await load();},page.is_visible?'Sayfa gizlendi.':'Sayfa gösterildi.');
  const toggleBlock=()=>block&&run(async()=>{const r=await supabase.from('app_blocks').update({is_visible:!block.is_visible}).eq('id',block.id);if(r.error)throw r.error;await load();},block.is_visible?'Kart gizlendi.':'Kart gösterildi.');
  const background=(value:string)=>page&&run(async()=>{const r=await supabase.from('app_pages').update({background_type:'color',background_value:value}).eq('id',page.id);if(r.error)throw r.error;await load();},'Arka plan değişti.');

  const persistPages=(next:CmsPageRow[])=>run(async()=>{for(let i=0;i<next.length;i++){const r=await supabase.from('app_pages').update({menu_order:next[i].page_key==='adminHub'?99:i+1}).eq('id',next[i].id);if(r.error)throw r.error;}await load();},'Ekran sırası kaydedildi.');
  const persistBlocks=(next:CmsBlockRow[])=>run(async()=>{for(let i=0;i<next.length;i++){const r=await supabase.from('app_blocks').update({position:i+1}).eq('id',next[i].id);if(r.error)throw r.error;}await load();},'Kart sırası kaydedildi.');
  const persistMenus=(next:CmsMenuRow[])=>run(async()=>{for(let i=0;i<next.length;i++){const r=await supabase.from('app_menu_items').update({position:i+1}).eq('id',next[i].id);if(r.error)throw r.error;}await load();},'Menü sırası kaydedildi.');

  const reorder=<T extends {id:string}>(rows:T[],source:string,target:string,persist:(n:T[])=>unknown)=>{const from=rows.findIndex(x=>x.id===source),to=rows.findIndex(x=>x.id===target);if(from>=0&&to>=0&&from!==to)persist(moved(rows,from,to));};
  const nudge=<T extends {id:string}>(rows:T[],id:string,d:-1|1,persist:(n:T[])=>unknown)=>{const from=rows.findIndex(x=>x.id===id),to=from+d;if(from>=0&&to>=0&&to<rows.length)persist(moved(rows,from,to));};
  const toggleMenu=(item:CmsMenuRow)=>run(async()=>{const r=await supabase.from('app_menu_items').update({is_visible:!item.is_visible}).eq('id',item.id);if(r.error)throw r.error;await load();},item.is_visible?'Menü öğesi gizlendi.':'Menü öğesi gösterildi.');

  if(!pages.length)return <section className="tp-visual-builder tp-visual-builder--loading"><div className="tp-vb-empty">Yönetim verileri yükleniyor…</div></section>;
  const dark=page?.background_value==='#0b0b0b';

  return <section className="tp-visual-builder">
    <header className="tp-vb-head"><div><span>GÖRSEL DÜZENLEYİCİ</span><h2>Görerek düzenle</h2><p>Sayfayı seç, önizlemede kartları taşı, sağdan görünen metni değiştir.</p></div><button onClick={()=>void sync()} disabled={busy}>↻ Uygulamayla eşitle</button></header>
    <div className="tp-vb-mode"><button className={mode==='screens'?'active':''} onClick={()=>setMode('screens')}>Ekranlar</button><button className={mode==='menu'?'active':''} onClick={()=>setMode('menu')}>Menü düzeni</button><span>{busy?'Kaydediliyor…':'Hazır'}</span></div>
    {message&&<div className="tp-vb-message">{message}</div>}

    {mode==='menu'?<div className="tp-vb-menu-editor"><div className="tp-vb-panel-title"><strong>Sol menü</strong><span>Sürükle-bırak veya ↑ ↓ kullan.</span></div><div className="tp-vb-menu-list">
      {[...menus].sort(byMenu).map((item,i)=><article key={item.id} draggable className={!item.is_visible?'is-hidden':''} onDragStart={()=>setDrag(item.id)} onDragOver={(e:DragEvent<HTMLElement>)=>e.preventDefault()} onDrop={()=>{reorder([...menus].sort(byMenu),drag,item.id,persistMenus);setDrag('');}}><span className="drag">⋮⋮</span><b>{item.icon||'•'}</b><div><strong>{item.label}</strong><small>{item.page_key||item.menu_key}</small></div><div className="row-actions"><button onClick={()=>nudge([...menus].sort(byMenu),item.id,-1,persistMenus)} disabled={i===0}>↑</button><button onClick={()=>nudge([...menus].sort(byMenu),item.id,1,persistMenus)} disabled={i===menus.length-1}>↓</button><button onClick={()=>void toggleMenu(item)}>{item.is_visible?'Gizle':'Göster'}</button></div></article>)}
    </div></div>:
    <div className="tp-vb-workspace">
      <aside className="tp-vb-pages"><div className="tp-vb-panel-title"><strong>Ekranlar</strong><span>{pages.length} ekran</span></div><div className="tp-vb-page-list">{[...pages].sort(byPage).map((p,i)=><article key={p.id} draggable className={`${p.page_key===pageKey?'active':''} ${!p.is_visible?'is-hidden':''}`} onClick={()=>setPageKey(p.page_key)} onDragStart={()=>setDrag(p.id)} onDragOver={(e:DragEvent<HTMLElement>)=>e.preventDefault()} onDrop={()=>{reorder([...pages].sort(byPage),drag,p.id,persistPages);setDrag('');}}><span className="drag">⋮⋮</span><b>{p.icon||'□'}</b><div><strong>{p.title}</strong><small>{p.page_key}</small></div><div className="tiny-actions"><button onClick={e=>{e.stopPropagation();nudge([...pages].sort(byPage),p.id,-1,persistPages)}} disabled={i===0}>↑</button><button onClick={e=>{e.stopPropagation();nudge([...pages].sort(byPage),p.id,1,persistPages)}} disabled={i===pages.length-1}>↓</button></div></article>)}</div></aside>

      <div className="tp-vb-preview-wrap"><div className="tp-vb-panel-title"><div><strong>Canlı önizleme</strong><span>Karta dokun veya sürükle.</span></div><a href="/" target="_blank" rel="noreferrer">Uygulamayı aç ↗</a></div><div className={`tp-vb-phone ${dark?'dark':''}`} style={{background:page?.background_value||'#fff'}}><div className="tp-vb-phone-top"><span>9:41</span><i/><strong>TarlaPusula</strong></div><div className="tp-vb-phone-head"><button>‹</button><div><strong>{page?.title}</strong><small>{page?.subtitle}</small></div><span>{page?.icon||'□'}</span></div><div className="tp-vb-phone-content">{pageBlocks.length?pageBlocks.map((b,i)=><article key={b.id} draggable className={`${blockId===b.id?'selected':''} ${!b.is_visible?'is-hidden':''}`} onClick={()=>setBlockId(b.id)} onDragStart={()=>setDrag(b.id)} onDragOver={(e:DragEvent<HTMLElement>)=>e.preventDefault()} onDrop={()=>{reorder(pageBlocks,drag,b.id,persistBlocks);setDrag('');}}><span className="drag">⋮⋮</span><div className="block-copy"><small>{b.block_key}</small><strong>{b.title||'İsimsiz kart'}</strong>{b.subtitle&&<p>{b.subtitle}</p>}</div><div className="block-actions"><button onClick={e=>{e.stopPropagation();nudge(pageBlocks,b.id,-1,persistBlocks)}} disabled={i===0}>↑</button><button onClick={e=>{e.stopPropagation();nudge(pageBlocks,b.id,1,persistBlocks)}} disabled={i===pageBlocks.length-1}>↓</button></div></article>):<div className="tp-vb-empty">Bu ekran için düzenlenebilir kart yok.</div>}</div><div className="tp-vb-phone-nav"><span>⌂<small>Ana</small></span><span>▦<small>Tarlalar</small></span><span>✦<small>Pusula</small></span><span>▣<small>Takvim</small></span><span>•••<small>Daha</small></span></div></div></div>

      <aside className="tp-vb-inspector"><div className="tp-vb-panel-title"><strong>{block?'Kartı düzenle':'Sayfayı düzenle'}</strong><span>Ham sayı yok.</span></div>{block?<div className="tp-vb-form"><div className="tp-vb-selected-chip">{block.block_key}</div><label>Başlık<input value={blockText.title} onChange={e=>setBlockText(x=>({...x,title:e.target.value}))}/></label><label>Alt açıklama<textarea rows={4} value={blockText.subtitle} onChange={e=>setBlockText(x=>({...x,subtitle:e.target.value}))}/></label><button onClick={()=>void saveBlock()}>Kaydet</button><button className="secondary" onClick={()=>void toggleBlock()}>{block.is_visible?'Kartı gizle':'Kartı göster'}</button><button className="ghost" onClick={()=>setBlockId('')}>Sayfa ayarlarına dön</button></div>:page?<div className="tp-vb-form"><div className="tp-vb-selected-chip">{page.page_key}</div><label>Sayfa adı<input value={pageText.title} onChange={e=>setPageText(x=>({...x,title:e.target.value}))}/></label><label>Kısa açıklama<textarea rows={4} value={pageText.subtitle} onChange={e=>setPageText(x=>({...x,subtitle:e.target.value}))}/></label><button onClick={()=>void savePage()}>Kaydet</button><div className="tp-vb-choice"><span>Arka plan</span><div><button onClick={()=>void background('#ffffff')}>○ Beyaz</button><button onClick={()=>void background('#f5f7f5')}>○ Yumuşak</button><button onClick={()=>void background('#0b0b0b')}>● Siyah</button></div></div><button className="secondary" onClick={()=>void togglePage()}>{page.is_visible?'Sayfayı gizle':'Sayfayı göster'}</button></div>:null}<div className="tp-vb-help"><strong>Kullanım</strong><p>Soldan ekranı seç. Telefondaki kartları sürükle. Mobilde ↑ ↓ daha rahat. Sağdan metni ve görünürlüğü değiştir.</p></div></aside>
    </div>}
  </section>;
}
