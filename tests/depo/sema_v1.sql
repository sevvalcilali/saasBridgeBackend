-- DONDURULMUŞ: şema sürüm 1 (yükseltme testleri için; değiştirmeyin).
-- Yakınlık sunucusunun kalıcı verisi (PLAN Bölüm 9): bellekteki alan modelinin aynası. Okuma bellekten yapılır; bu
-- dosya açılışta yükleme ve tik sonunda yazma içindir. Sürüm PRAGMA user_version'da (depo/sqlite.py SURUM).
-- Kısıt yalnız birincil anahtar ve NOT NULL: bellekteki bir tutarsızlık yazımı kilitlememeli (yazılamayan veri kaybolur).
-- kimlik / a / b: kişi kimliği ("k12"), kişisiz kart "kart:N", iade edilmiş kişisiz kart "arsiv:kart:N:sıra".

CREATE TABLE kisi (
    sira     INTEGER PRIMARY KEY,  -- kimliğin sayısı (k12 → 12): eklenme sırası
    kisi_id  TEXT NOT NULL,
    ad       TEXT NOT NULL,
    rol      TEXT NOT NULL,        -- investor | founder | guest
    kurum    TEXT NOT NULL,
    yildiz   INTEGER NOT NULL,
    renk     TEXT NOT NULL,
    notu     TEXT NOT NULL,
    kart     TEXT,                 -- şu an elindeki kart (açık atama); yoksa NULL
    ayrildi  INTEGER NOT NULL,     -- kartını iade etti
    silindi  INTEGER NOT NULL      -- listeden çıkarıldı (DELETE /api/people); satır ve kimlik korunur
);

CREATE TABLE atama (               -- zaman damgalı atama geçmişi (GET /api/assignments)
    id       INTEGER PRIMARY KEY,
    t        REAL NOT NULL,        -- duvar saati (epoch sn)
    kisi_id  TEXT NOT NULL,
    kart     TEXT NOT NULL,
    islem    TEXT NOT NULL         -- ata | iade | geri_al | degisim
);

CREATE TABLE oturum (              -- görüşme kayıtları (GET /api/sessions)
    id       INTEGER PRIMARY KEY,
    a        TEXT NOT NULL,
    b        TEXT NOT NULL,
    start_s  REAL NOT NULL,        -- etkinlik saniyesi
    end_s    REAL                  -- sürüyorsa NULL
);

CREATE TABLE kenar (               -- kim kimle kaç dakika (sıralı kimlik çifti)
    a        TEXT NOT NULL,
    b        TEXT NOT NULL,
    dakika   REAL NOT NULL,
    PRIMARY KEY (a, b)
);

CREATE TABLE toplam (              -- kişi başına toplam görüşme dakikası ve karşı rolle (yatırımcı ↔ girişimci) dakika
    kimlik   TEXT PRIMARY KEY,
    sure     REAL,                 -- NULL: bellekte bu kimlik için toplam yok
    karma    REAL
);

CREATE TABLE bildirim (
    id       INTEGER PRIMARY KEY,
    t        REAL NOT NULL,
    clock    TEXT NOT NULL,
    kind     TEXT NOT NULL,
    severity TEXT NOT NULL,
    title    TEXT NOT NULL,
    detail   TEXT NOT NULL,
    people   TEXT NOT NULL,        -- JSON dizisi: kart numaraları
    kisiler  TEXT NOT NULL         -- JSON dizisi: kişi kimlikleri
);

CREATE TABLE anlasma (             -- anlaşma bildirimi çıkmış kimlik çiftleri
    a        TEXT NOT NULL,
    b        TEXT NOT NULL,
    PRIMARY KEY (a, b)
);

CREATE TABLE ayar (                -- JSON değerler: esik, gecen_sn, son_duvar, biten, emekli_sayac, kisi_sayac
    anahtar  TEXT PRIMARY KEY,
    deger    TEXT NOT NULL
);
