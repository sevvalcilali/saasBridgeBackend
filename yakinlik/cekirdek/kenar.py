"""Kim kimle ne kadar: kişi kimliği çifti → dakika. Kart değişse de süre kişide kalır (İ4). Saf."""


def kimlik_cifti(x: str, y: str) -> tuple[str, str]:
    """Sıralı kimlik çifti (mock'taki kenarAnahtari gibi metin sırasıyla)."""
    return (x, y) if x < y else (y, x)


class Kenarlar:
    def __init__(self) -> None:
        self.dakika: dict[tuple[str, str], float] = {}  # kimlik çifti → birlikte geçen dakika
        self.sure: dict[str, float] = {}  # kimlik → toplam görüşme dakikası (people[].min)
        self.karma: dict[str, float] = {}  # kimlik → karşı rolle (yatırımcı ↔ girişimci) dakika (people[].invMin)

    def ekle(self, x: str, y: str, dakika: float, karsi_rol: bool) -> None:
        cift = kimlik_cifti(x, y)
        self.dakika[cift] = self.dakika.get(cift, 0.0) + dakika
        hedefler = (self.sure, self.karma) if karsi_rol else (self.sure,)
        for hedef in hedefler:
            for kimlik in cift:
                hedef[kimlik] = hedef.get(kimlik, 0.0) + dakika

    def tasi(self, eski: str, yeni: str) -> None:
        """`eski` kimliğin bütün sürelerini `yeni` kimliğe aktarır (kişisiz karta kişi atanınca "kart:N" → kisiId)."""
        for cift in [cift for cift in self.dakika if eski in cift]:
            dakika = self.dakika.pop(cift)
            diger = cift[1] if cift[0] == eski else cift[0]
            if diger == yeni:
                # Kişi görüştüğü kişisiz kartı kendine aldı: kendi kendisiyle süresi olmaz. Bu dakikalar iki tarafın
                # toplamından da düşülür (kişinin süresi = kenar dakikalarının toplamı). Kişisiz kart misafir
                # sayıldığı için bu süre karşı rol (karma) toplamına hiç eklenmemişti.
                for kimlik in cift:
                    self.sure[kimlik] -= dakika
                continue
            yeni_cift = kimlik_cifti(yeni, diger)
            self.dakika[yeni_cift] = self.dakika.get(yeni_cift, 0.0) + dakika
        for tablo in (self.sure, self.karma):
            if eski in tablo:
                tablo[yeni] = tablo.get(yeni, 0.0) + tablo.pop(eski)
