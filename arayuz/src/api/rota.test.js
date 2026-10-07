// Hash yönlendirme: panodaki "Kişi ata" masayı o kartla açar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rotaAdi, rotaKart, kartVerAdresi, rotaParametresi, kartDegistirAdresi, kartIadeAdresi, sunumModuMu, isimsizMi, sunumAdresi, raporKisisi, kisiRaporuAdresi } from './useRota.js'

test('rotaAdi: kart-ver (parametreli ya da değil), kurulum; diğer her şey pano', () => {
  assert.equal(rotaAdi('#/kart-ver'), 'kart-ver')
  assert.equal(rotaAdi('#/kart-ver?kart=14'), 'kart-ver')
  assert.equal(rotaAdi('#/'), 'pano')
  assert.equal(rotaAdi(''), 'pano')
  assert.equal(rotaAdi('#/kart-verx'), 'pano')
  assert.equal(rotaAdi('#/kurulum'), 'kurulum')
  assert.equal(rotaAdi('#/rapor'), 'rapor')
})

test('rotaKart: yalnız sayısal kart no', () => {
  assert.equal(rotaKart('#/kart-ver?kart=14'), '14')
  assert.equal(rotaKart('#/kart-ver'), null)
  assert.equal(rotaKart('#/kart-ver?kart=abc'), null)
  assert.equal(rotaKart('#/?kart=14'), null)
})

test('kartVerAdresi: gidiş-dönüş', () => {
  assert.equal(rotaKart(kartVerAdresi('14')), '14')
  assert.equal(kartVerAdresi(null), '#/kart-ver')
})

test('kısayol adresleri: değiştir / iade parametreleri', () => {
  assert.equal(rotaAdi(kartDegistirAdresi('14')), 'kart-ver')
  assert.equal(rotaParametresi(kartDegistirAdresi('14'), 'degistir'), '14')
  assert.equal(rotaParametresi(kartIadeAdresi('7'), 'iade'), '7')
  assert.equal(rotaParametresi(kartIadeAdresi('7'), 'degistir'), null)
  assert.equal(rotaKart(kartIadeAdresi('7')), null)
})

test('sunum modu: ?clean=1 (brief §4.5), isimsiz ayrı bayrak; adres hash rotasından bağımsız', () => {
  assert.equal(sunumModuMu('?clean=1'), true)
  assert.equal(sunumModuMu('?clean=1&isimsiz=1'), true)
  assert.equal(sunumModuMu(''), false)
  assert.equal(sunumModuMu('?clean=0'), false)
  assert.equal(isimsizMi('?clean=1&isimsiz=1'), true)
  assert.equal(isimsizMi('?clean=1'), false)
  assert.equal(sunumAdresi(), '?clean=1#/')
  assert.equal(sunumAdresi(true), '?clean=1&isimsiz=1#/')
})

test('kişiye özel rapor adresi: #/rapor?kisi=k3 → Rapor; kimlik ya da "yatirimcilar" (hepsi)', () => {
  assert.equal(rotaAdi('#/rapor?kisi=k3'), 'rapor')
  assert.equal(raporKisisi('#/rapor?kisi=k3'), 'k3')
  assert.equal(raporKisisi('#/rapor?kisi=yatirimcilar'), 'yatirimcilar')
  assert.equal(raporKisisi('#/rapor'), null)
  assert.equal(raporKisisi('#/rapor?kisi=<script>'), null)
  assert.equal(raporKisisi(kisiRaporuAdresi('k12')), 'k12')
})
