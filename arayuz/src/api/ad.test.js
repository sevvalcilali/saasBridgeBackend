import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tamAd, kisaAd } from './ad.js'

test('girişimcide kurum öne; yatırımcı/misafirde yalnız ad — iki veri biçiminde de aynı', () => {
  assert.equal(tamAd({ name: 'Can Yılmaz', org: 'Nova Robotik', role: 'founder' }), 'Nova Robotik · Can Yılmaz')
  assert.equal(tamAd({ ad: 'Can Yılmaz', kurum: 'Nova Robotik', rol: 'founder' }), 'Nova Robotik · Can Yılmaz')
  assert.equal(tamAd({ name: 'Ayşe Demir', org: 'Atlas Ventures', role: 'investor' }), 'Ayşe Demir')
  assert.equal(tamAd({ ad: 'Kerem Tekin', kurum: '', rol: 'guest' }), 'Kerem Tekin')
  assert.equal(kisaAd({ name: 'Can Yılmaz', org: 'Nova Robotik', role: 'founder' }), 'Nova Robotik')
  assert.equal(kisaAd({ ad: 'Ayşe Demir', kurum: 'Atlas', rol: 'investor' }), 'Ayşe Demir')
})

test('kurumsuz girişimci ve kayıtsız kart: ad olduğu gibi', () => {
  assert.equal(tamAd({ name: 'Deniz', org: '', role: 'founder' }), 'Deniz')
  assert.equal(kisaAd({ name: 'Kart 14', org: '', role: 'guest' }), 'Kart 14')
  assert.equal(tamAd({ ad: 'Kart 14 (kayıtsız)', rol: null }), 'Kart 14 (kayıtsız)')
})
