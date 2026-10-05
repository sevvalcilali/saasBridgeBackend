"""CSV ile toplu kişi yükleme (SUNUCUDAN_ISTENENLER §1, brief §6.2). Saf.

Sütunlar: ad, soyad, rol, kurum, yıldız. İlk satır başlıksa sütunlar ada göre eşlenir, değilse bu sırayla okunur.
Ayraç `;` (Türkçe Excel), `,` ya da sekme — ilk satırdan anlaşılır. Tırnaklı alan ve `""` kaçışı desteklenir; baştaki
UTF-8 BOM atılır. Başlık ve rol büyük-küçük harf, Türkçe harf (ı/i, ş/s …) farkı gözetmeden tanınır. Atlanan satırlar
dosyadaki satır numarasıyla bildirilir; boş satırlar sessizce geçilir. Dosya kodlamasını arayüz çözer (hep UTF-8 gelir).
"""
from dataclasses import dataclass

from .kisi import KisiDefteri

_SIRA = ("ad", "soyad", "rol", "kurum", "yildiz")  # başlık yoksa sütun sırası
_SUTUNLAR = {"ad": "ad", "isim": "ad", "soyad": "soyad", "soyadi": "soyad", "rol": "rol",
             "kurum": "kurum", "sirket": "kurum", "yildiz": "yildiz"}
_ROLLER = {"yatirimci": "investor", "investor": "investor", "girisimci": "founder", "founder": "founder",
           "misafir": "guest", "guest": "guest"}
_TURKCE_HARFSIZ = str.maketrans("çğıöşü", "cgiosu")


@dataclass(frozen=True)
class Atlanan:
    satir: int  # dosyadaki satır numarası (1'den)
    sebep: str


@dataclass(frozen=True)
class AktarmaSonucu:
    eklenen: int
    atlanan: tuple[Atlanan, ...]


def _kucuk(metin: str) -> str:
    """Türkçe küçük harf (I → ı, İ → i)."""
    return metin.strip().replace("I", "ı").replace("İ", "i").lower()


def _anahtar(metin: str) -> str:
    """Başlık ve rol karşılaştırması: Türkçe küçük harf, Türkçe harfler katlanmış ("YATIRIMCI", "INVESTOR" tanınsın)."""
    return _kucuk(metin).translate(_TURKCE_HARFSIZ)


def satirlar(metin: str) -> list[list[str]]:
    """Metni hücrelere böler (mock'taki csvSatirlari ile aynı). Ayraç ilk satırda en çok bölen aday."""
    metin = metin.removeprefix("\ufeff")
    ilk = metin.splitlines()[0] if metin else ""
    ayrac = ","
    for aday in (";", "\t", ","):
        if len(ilk.split(aday)) > len(ilk.split(ayrac)):
            ayrac = aday
    sonuc: list[list[str]] = []
    satir: list[str] = []
    alan, tirnakta, i = "", False, 0
    while i < len(metin):
        harf = metin[i]
        if tirnakta:
            if harf == '"' and metin[i + 1:i + 2] == '"':
                alan += '"'
                i += 1
            elif harf == '"':
                tirnakta = False
            else:
                alan += harf
        elif harf == '"':
            tirnakta = True
        elif harf == ayrac:
            satir.append(alan)
            alan = ""
        elif harf in "\r\n":
            if harf == "\r" and metin[i + 1:i + 2] == "\n":
                i += 1
            satir.append(alan)
            sonuc.append(satir)
            satir, alan = [], ""
        else:
            alan += harf
        i += 1
    if alan or satir:
        satir.append(alan)
        sonuc.append(satir)
    return sonuc


def iceri_aktar(defter: KisiDefteri, metin: str) -> AktarmaSonucu:
    """CSV'deki kişileri kartsız ("kart bekliyor") ekler. Aynı ad + kurum zaten kayıtlıysa (ya da dosyada daha önce
    geçtiyse) atlanır."""
    tablo = satirlar(metin)
    sutunlar: list[str | None] = list(_SIRA)
    bas = 0
    if tablo and _anahtar(tablo[0][0]) in _SUTUNLAR:
        sutunlar = [_SUTUNLAR.get(_anahtar(baslik)) for baslik in tablo[0]]
        bas = 1
    kayitli = {f"{_kucuk(kisi.ad)}|{_kucuk(kisi.kurum)}" for kisi in defter.kisiler()}
    eklenen, atlanan = 0, []
    for sira in range(bas, len(tablo)):
        hucreler = tablo[sira]
        if all(not hucre.strip() for hucre in hucreler):
            continue
        degerler = {sutun: hucreler[j].strip() if j < len(hucreler) else "" for j, sutun in enumerate(sutunlar) if sutun}
        satir_no = sira + 1
        ad = " ".join(parca for parca in (degerler.get("ad"), degerler.get("soyad")) if parca)
        rol = _ROLLER.get(_anahtar(degerler.get("rol", "")))
        if not degerler.get("ad"):
            atlanan.append(Atlanan(satir_no, "ad boş"))
            continue
        if rol is None:
            atlanan.append(Atlanan(satir_no, f'rol anlaşılamadı: "{degerler.get("rol", "")}"'))
            continue
        kurum = degerler.get("kurum", "")
        anahtar = f"{_kucuk(ad)}|{_kucuk(kurum)}"
        if anahtar in kayitli:
            atlanan.append(Atlanan(satir_no, f"{ad} zaten kayıtlı"))
            continue
        kayitli.add(anahtar)
        defter.ekle(ad=ad, rol=rol, kurum=kurum, yildiz=degerler.get("yildiz", ""))
        eklenen += 1
    return AktarmaSonucu(eklenen, tuple(atlanan))
