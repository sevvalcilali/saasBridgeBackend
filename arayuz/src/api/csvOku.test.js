// CSV dosya okuma: UTF-8 (BOM'lu/BOM'suz) ve Türkçe Excel'in Windows-1254 çıktısı.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvDosyasiOku } from './csvOku.js'

test('UTF-8 dosya olduğu gibi okunur; BOM atılır', async () => {
  const metin = 'ad;soyad\nŞule;Güneş\n'
  assert.equal(await csvDosyasiOku(new Blob([metin])), metin)
  assert.equal(await csvDosyasiOku(new Blob(['﻿' + metin])), metin)
})

test('Windows-1254 (Türkçe Excel) dosyada Türkçe harfler bozulmaz', async () => {
  // "Şule;Güneş;İzmir" Windows-1254 baytları
  const bayt = new Uint8Array([0xde, 0x75, 0x6c, 0x65, 0x3b, 0x47, 0xfc, 0x6e, 0x65, 0xfe, 0x3b, 0xdd, 0x7a, 0x6d, 0x69, 0x72])
  assert.equal(await csvDosyasiOku(new Blob([bayt])), 'Şule;Güneş;İzmir')
})
