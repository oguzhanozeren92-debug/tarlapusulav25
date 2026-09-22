# PCSE ile gerçek model çalıştırma denemesi

Bu araç [PCSE'nin resmi başlangıç örneğindeki](https://pcse.readthedocs.io/en/stable/quickstart.html) paket içi WOFOST modelini gerçekten çalıştırır. Girdi **güney İspanya, 2000, kışlık buğday** demo verisidir. Tarihler ve miktarlar modelin demo çıktısıdır; Türkiye'deki bir tarla için fenoloji, verim veya sulama tavsiyesi değildir.

```bash
python3 -m venv /tmp/tarlapusula-pcse-venv
/tmp/tarlapusula-pcse-venv/bin/pip install -r tools/pcse-poc/requirements.txt
/tmp/tarlapusula-pcse-venv/bin/python tools/pcse-poc/run_demo.py
/tmp/tarlapusula-pcse-venv/bin/python tools/pcse-poc/run_demo.py --daily
```

JSON içinde modelin çıkardığı çiçeklenme (anthesis) ve olgunluk tarihleri, maksimum yaprak alanı ve depolama organı kütlesi yer alır. Kütle sahada ölçülmüş veya doğrulanmış verim değildir. `--daily` ile 152 günlük model gelişim evresi (DVS) ve yaprak alanı (LAI) serisi alınabilir.

Gerçek tarla pilotuna geçiş koşulları `tools/crop-model-readiness/check.py` ile kontrol edilir: aynı yıllık ürüne ait sezonluk günlük meteoroloji, ürün/toprak/site parametreleri, agromanagement ve en az iki tarihli saha evresi gözlemi gerekir. Bu girdiler ve model çıktıları karşılaştırılmadan Pusula kararına bağlanmaz. Uygulamanın Vercel ön yüzüne Python paketi eklenmemiştir.
