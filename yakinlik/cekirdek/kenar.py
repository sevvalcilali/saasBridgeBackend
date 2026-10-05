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
