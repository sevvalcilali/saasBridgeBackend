"""Uyarı kuralları (Şevval isteği 2026-10-06). Saf.

Organizatör her etkinlik için kural kurar: "[kim] ile [kiminle] [yan yana gelince | N dakikadan uzun birlikte
kalınca]" → panoda açılır uyarı (bildirim `kind: "kural"`). Kim / kiminle: belirli kişiler (kisiId) ya da bir grup
(rol, yatırımcıda en az yıldız, ya da herkes). Kimseye atanmamış kart hiçbir kurala uymaz. Bir kural bir çiftin bir
görüşmesinde bir kez tetiklenir (alan.py).
"""
import math
from collections.abc import Mapping, Set
from dataclasses import dataclass

from .kisi import Kisi

ROLLER = ("investor", "founder", "guest", "herkes")
_ROL_ADI = {"investor": "yatırımcılar", "founder": "girişimciler", "guest": "misafirler", "herkes": "herkes"}
EN_COK_DAKIKA = 600
AD_SINIRI = 80


@dataclass(frozen=True)
class Secim:
    """Kuralın bir tarafı: belirli kişiler ya da bir grup (rol + en az yıldız)."""

    kisiler: tuple[str, ...] = ()  # boş değilse yalnız bu kişiler
    rol: str = "herkes"
    en_az_yildiz: int = 0  # yalnız yatırımcıda anlamlı

    def uyar(self, kisi: Kisi) -> bool:
        if kisi.kisi_id.startswith("kart:"):  # kim olduğu bilinmeyen kart
            return False
        if self.kisiler:
            return kisi.kisi_id in self.kisiler
        if self.rol != "herkes" and kisi.rol != self.rol:
            return False
        return kisi.yildiz >= self.en_az_yildiz

    def sozluk(self) -> dict:
        if self.kisiler:
            return {"kisiler": list(self.kisiler)}
        return {"rol": self.rol, "enAzYildiz": self.en_az_yildiz}

    def adi(self, adlar: Mapping[str, str]) -> str:
        if self.kisiler:
            return ", ".join(adlar.get(kisi_id, kisi_id) for kisi_id in self.kisiler)
        yildiz = f"★{self.en_az_yildiz}+ " if self.en_az_yildiz and self.rol in ("investor", "herkes") else ""
        return yildiz + _ROL_ADI[self.rol]


@dataclass
class Kural:
    kural_id: str  # "r3"
    ad: str
    kim: Secim
    kiminle: Secim
    dakika: float  # 0: yan yana gelince (sistem bir çifti 1 dk yakınlıkla "birlikte" sayar); N: N dk'dan uzun
    acik: bool = True

    def ciftine_uyar(self, a: Kisi, b: Kisi) -> bool:
        """Çift (iki yönden biriyle) kurala uyuyor mu? Kişi kendisiyle eşleşmez."""
        if a.kisi_id == b.kisi_id:
            return False
        return (self.kim.uyar(a) and self.kiminle.uyar(b)) or (self.kim.uyar(b) and self.kiminle.uyar(a))

    def sozluk(self) -> dict:
        return {"kuralId": self.kural_id, "ad": self.ad, "kim": self.kim.sozluk(), "kiminle": self.kiminle.sozluk(),
                "dakika": self.dakika, "acik": self.acik}


def _secim_coz(deger: object, taraf: str, kayitli: Set[str]) -> Secim | str:
    if not isinstance(deger, Mapping):
        return f"{taraf}: kişiler ya da rol seçin"
    if "kisiler" in deger:
        kisiler = deger["kisiler"]
        if not isinstance(kisiler, list) or not kisiler or not all(isinstance(k, str) for k in kisiler):
            return f"{taraf}: en az bir kişi seçin"
        for kisi_id in kisiler:
            if kisi_id not in kayitli:
                return f"{taraf}: bilinmeyen kişi {kisi_id}"
        return Secim(kisiler=tuple(dict.fromkeys(kisiler)))
    rol = deger.get("rol")
    if rol not in ROLLER:
        return f"{taraf}: rol yatırımcı, girişimci, misafir ya da herkes olmalı"
    yildiz = deger.get("enAzYildiz", 0)
    if isinstance(yildiz, bool) or not isinstance(yildiz, int) or not 0 <= yildiz <= 5:
        return f"{taraf}: en az yıldız 0–5 olmalı"
    return Secim(rol=rol, en_az_yildiz=yildiz)


def kural_coz(govde: Mapping[str, object], kural_id: str, kayitli: Set[str] | Mapping[str, str]) -> Kural | str:
    """İstek gövdesinden kural; geçersizse kullanıcıya gösterilecek hata metni. `kayitli`: var olan kisiId'ler (sözlükse
    kimlik → görünen ad; ad verilmezse kuralın adı bununla üretilir)."""
    adlar = kayitli if isinstance(kayitli, Mapping) else {}
    kim = _secim_coz(govde.get("kim"), "kim", kayitli)
    if isinstance(kim, str):
        return kim
    kiminle = _secim_coz(govde.get("kiminle"), "kiminle", kayitli)
    if isinstance(kiminle, str):
        return kiminle
    dakika = govde.get("dakika", 0)
    if isinstance(dakika, bool) or not isinstance(dakika, (int, float)) or not math.isfinite(dakika) \
            or not 0 <= dakika <= EN_COK_DAKIKA:
        return f"dakika 0–{EN_COK_DAKIKA} olmalı"
    acik = govde.get("acik", True)
    if not isinstance(acik, bool):
        return "acik true / false olmalı"
    ad = govde.get("ad")
    ad = ad.strip()[:AD_SINIRI] if isinstance(ad, str) and ad.strip() else ""
    if not ad:
        ad = f"{kim.adi(adlar)} ile {kiminle.adi(adlar)}" + (f" · {dakika:g} dk" if dakika else " · yan yana")
    return Kural(kural_id, ad[:AD_SINIRI], kim, kiminle, dakika, acik)


def _secim_yukle(deger: Mapping[str, object]) -> Secim:
    if "kisiler" in deger:
        return Secim(kisiler=tuple(deger["kisiler"]))
    return Secim(rol=deger.get("rol", "herkes"), en_az_yildiz=deger.get("enAzYildiz", 0))


def kural_tanimi(kural: Kural) -> dict:
    """Kalıcı kayıt için (depo): kim, kiminle, dakika."""
    return {"kim": kural.kim.sozluk(), "kiminle": kural.kiminle.sozluk(), "dakika": kural.dakika}


def kural_yukle(kural_id: str, ad: str, tanim: Mapping[str, object], acik: bool) -> Kural:
    """Diskteki kural (doğrulanmış olarak yazıldı; kişi sonradan silindiyse kural yalnız uymaz)."""
    return Kural(kural_id, ad, _secim_yukle(tanim["kim"]), _secim_yukle(tanim["kiminle"]), tanim["dakika"], acik)
