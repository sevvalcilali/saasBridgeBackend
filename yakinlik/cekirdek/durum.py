"""/state nesnesi (brief §5.1): alan modelinden arayüzün beklediği biçime projeksiyon. Saf.

Alan modeli kişi bazlıdır, /state kart bazlı: çevrim yalnız burada yapılır (PLAN Bölüm 4, [6]). Alan adları,
birimler ve yuvarlama mock'un durumUret() çıktısıyla aynı; tek ek alan people[].idleSinceS (SUNUCUDAN_ISTENENLER §9).
"""
import math
import time
from dataclasses import dataclass

from .alan import Alan
from .bildirim import GORUNUR_SN, karsi_rol
from .kisi import ROL_SIRASI
from .oturum import rapor_kimligi
from .sinyal import GRAFIK_SN


@dataclass(frozen=True)
class Etkinlik:
    ad: str
    alt_baslik: str
    tarih: str
    sure_dk: float = 180  # event.progress için


def js_yuvarla(deger: float, basamak: int = 0) -> float:
    """JavaScript `Math.round(x·10ⁿ)/10ⁿ`: buçuk +∞ yönüne (Python round() buçuğu çifte yuvarlar)."""
    carpan = 10**basamak
    return math.floor(deger * carpan + 0.5) / carpan


def oturumlar_sozluk(alan: Alan) -> list[dict]:
    """GET /api/sessions: [{a, b, start, end}] — kişi kimliği, etkinlik saniyesi (tek ondalık), sürüyorsa end null."""
    return [
        {"a": rapor_kimligi(o.a), "b": rapor_kimligi(o.b), "start": js_yuvarla(o.start, 1),
         "end": None if o.end is None else js_yuvarla(o.end, 1)}
        for o in alan.oturumlar
    ]


def atamalar_sozluk(alan: Alan) -> list[dict]:
    """GET /api/assignments: zaman damgalı atama geçmişi (t duvar saati, epoch sn)."""
    return [{"t": k.t, "kisiId": k.kisi_id, "kart": k.kart, "islem": k.islem} for k in alan.atama_gecmisi]


BOS_KART_UNUTMA_SN = 300  # bu kadar duyulmayan boş kart listeden düşer (kapandı ya da salondan çıktı)


def kartlar_uret(alan: Alan) -> list[dict]:
    """GET /api/cards: alıcının duyduğu kartlar (atanmış, masadaki yedek, iade dönmüş, dinleyici), numara sırasıyla.
    Atanmış kart duyulmasa da kalır (kayıp kart uyarısı); boş kart 5 dk duyulmazsa düşer (kart sağlığı kirlenmesin).
    Masa 1–3 sn'de bir yoklar; ucuz olmalı."""
    sonuc = []
    for kart in sorted(alan.sinyal.duyulan_kartlar(), key=lambda k: (not k.isdecimal(), int(k) if k.isdecimal() else 0, k)):
        yas, alici_rssi = alan.sinyal.kart_bilgisi(kart, alan.t)
        sahip = alan.defter.kart_sahibi(kart)
        if sahip is None and yas > BOS_KART_UNUTMA_SN:
            continue
        sonuc.append({
            "kart": kart,
            "rssiAlici": None if alici_rssi is None else js_yuvarla(alici_rssi, 1),
            "seenAgo": js_yuvarla(yas, 1),
            "atanan": None if sahip is None else sahip.kisi_id,
        })
    return sonuc


def durum_uret(alan: Alan, etkinlik: Etkinlik, duvar: float, grafik: bool = True) -> dict:
    """`grafik=False`: `history` boş gelir ve hesaplanmaz (büyük etkinlikte durumun en pahalı ve en büyük parçası;
    yalnız Kurulum grafiği kullanır — B7, Şevval kararı 05.10.2026)."""
    simdi = alan.t
    sinyaller = [] if simdi is None else alan.sinyal.sinyaller(simdi)
    gecmis = {} if simdi is None or not grafik else alan.sinyal.gecmis(simdi)
    birlikte = alan.birlikte_ciftler()

    sahne = alan.sahnedeki_kartlar()
    kisiler = {kart: alan.kisi(kart) for kart in sahne}
    kimlikten_kart = {kisi.kisi_id: kart for kart, kisi in kisiler.items()}
    # Kişi bazlı kenarlar → şu an sahnede olan kartlar; kartı olmayan kişinin süresi silinmez, yalnız görünmez.
    kenarlar = [
        (kimlikten_kart[x], kimlikten_kart[y], dakika)
        for (x, y), dakika in alan.kenarlar.dakika.items()
        if x in kimlikten_kart and y in kimlikten_kart and dakika > 0
    ]
    karsi_esler: dict[str, set[str]] = {}
    for a, b, _ in kenarlar:
        if karsi_rol(kisiler[a], kisiler[b]):
            karsi_esler.setdefault(a, set()).add(b)
            karsi_esler.setdefault(b, set()).add(a)
    gorusmeler: dict[str, list[tuple[str, float]]] = {}  # kart → [(eş kart, görüşme sn)]
    for anahtar, durum in birlikte.items():
        a, b = anahtar.split("-")
        gorusmeler.setdefault(a, []).append((b, durum.birlikte_sn))
        gorusmeler.setdefault(b, []).append((a, durum.birlikte_sn))

    people = []
    for kart in sorted(sahne, key=lambda k: ROL_SIRASI.index(kisiler[k].rol)):
        kisi = kisiler[kart]
        yas = None if simdi is None else alan.sinyal.gorulme_yasi(kart, simdi)
        aktif = gorusmeler.get(kart, [])
        durum = "away" if yas is None or yas > GORUNUR_SN else "talking" if aktif else "idle"
        people.append({
            "id": kart, "role": kisi.rol, "name": kisi.ad, "org": kisi.kurum, "color": kisi.renk,
            "stars": "★" * kisi.yildiz, "tier": kisi.yildiz, "status": durum,
            "withName": ", ".join(alan.kisi(es).gorunen_ad for es, _ in aktif) if durum == "talking" else "",
            "live": max(sn for _, sn in aktif) / 60 if aktif else 0,
            "min": js_yuvarla(alan.kenarlar.sure.get(kisi.kisi_id, 0.0), 2),
            "invMin": js_yuvarla(alan.kenarlar.karma.get(kisi.kisi_id, 0.0), 2),
            "invPeers": len(karsi_esler.get(kart, ())),
            "seenAgo": None if yas is None else js_yuvarla(yas, 1),
            "idleSinceS": js_yuvarla(alan.bosta_sn(kart), 1),
        })

    live = [
        {"a": s.a, "b": s.b, "real": True, "rssi": js_yuvarla(s.value, 1)}
        for s in sinyaller if f"{s.a}-{s.b}" in birlikte
    ]
    ulasan = {a if kisiler[a].rol == "founder" else b for a, b, _ in kenarlar if karsi_rol(kisiler[a], kisiler[b])}
    karma_dk = sum(dakika for a, b, dakika in kenarlar if karsi_rol(kisiler[a], kisiler[b]))
    alici_yasi = None if simdi is None else alan.sinyal.alici_yasi(simdi)

    return {
        "people": people,
        "live": live,
        "edges": [{"a": a, "b": b, "min": js_yuvarla(dakika, 2)} for a, b, dakika in kenarlar],
        "alerts": [b.sozluk() for b in alan.bildirimler],
        "stats": {
            "done": alan.biten,
            "livePairs": len(live),
            "mixedMin": js_yuvarla(karma_dk, 1),
            "deals": len(alan.anlasmalar),
            "reached": len(ulasan),
            "founders": sum(1 for kisi in kisiler.values() if kisi.rol == "founder"),
        },
        "receiverAge": None if alici_yasi is None else js_yuvarla(alici_yasi, 1),
        "elapsed": js_yuvarla(alan.gecen_sn, 1),
        "event": {
            "name": etkinlik.ad, "sub": etkinlik.alt_baslik, "date": etkinlik.tarih,
            "progress": min(1.0, alan.gecen_sn / (etkinlik.sure_dk * 60)),
        },
        "clock": time.strftime("%H:%M:%S", time.localtime(duvar)),
        "threshold": alan.esik,
        "signals": [
            {"a": s.a, "b": s.b,
             "ab": None if s.ab is None else js_yuvarla(s.ab, 1),
             "ba": None if s.ba is None else js_yuvarla(s.ba, 1),
             "value": js_yuvarla(s.value, 1), "n": s.n, "above": s.value >= alan.esik,
             "together": f"{s.a}-{s.b}" in birlikte}
            for s in sinyaller
        ],
        "history": {anahtar: [[yas, js_yuvarla(deger, 1)] for yas, deger in seri] for anahtar, seri in gecmis.items()},
        "chartSeconds": GRAFIK_SN,
        "rules": {"dealAfterS": alan.anlasma_sn},
    }
