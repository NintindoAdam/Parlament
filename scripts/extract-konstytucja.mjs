/**
 * JEDNORAZOWA ekstrakcja wiernego tekstu Konstytucji RP z public/konstytucja.pdf
 * (Dz.U. 1997 nr 78 poz. 483) do data/konstytucja.json + public/konstytucja/search.json.
 * Dokument niezmienny → wynik commitujemy. Wymaga tymczasowo: npm i pdfjs-dist.
 * Uruchomienie: node scripts/extract-konstytucja.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const ROOT = process.cwd()
const PDF = path.join(ROOT, 'public', 'konstytucja.pdf')

const ROZDZIAL_SLUG = {
  I: 'rzeczpospolita', II: 'wolnosci-prawa-obowiazki', III: 'zrodla-prawa',
  IV: 'sejm-i-senat', V: 'prezydent', VI: 'rada-ministrow', VII: 'samorzad-terytorialny',
  VIII: 'sady-i-trybunaly', IX: 'kontrola-panstwowa', X: 'finanse-publiczne',
  XI: 'stany-nadzwyczajne', XII: 'zmiana-konstytucji', XIII: 'przepisy-koncowe',
}
const SEKCJE = new Set([
  'Zasady ogólne','Wolności i prawa osobiste','Wolności i prawa polityczne',
  'Wolności i prawa ekonomiczne, socjalne i kulturalne','Środki ochrony wolności i praw','Obowiązki',
  'Wybory i kadencja','Posłowie i senatorowie','Organizacja i działanie','Referendum',
  'Sądy','Trybunał Konstytucyjny','Trybunał Stanu',
  'Najwyższa Izba Kontroli','Rzecznik Praw Obywatelskich','Krajowa Rada Radiofonii i Telewizji',
])

async function extractLines() {
  const data = new Uint8Array(readFileSync(PDF))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    let lastY = null, cur = ''
    const push = () => { const t = cur.replace(/\s+/g,' ').trim(); if (t) lines.push(t); cur = '' }
    for (const it of tc.items) {
      const y = Math.round(it.transform[5])
      if (lastY === null) lastY = y
      if (Math.abs(y - lastY) > 3) { push(); lastY = y }
      cur += it.str
      if (it.hasEOL) push()
    }
    push()
  }
  return lines
}
function clean(lines) {
  const out = []; let skip = false
  for (const l of lines) {
    if (/^©Kancelaria Sejmu/.test(l)) continue
    if (/^\d{4}-\d{2}-\d{2}$/.test(l)) continue
    if (l.startsWith('Opracowano na')) { skip = true; continue }
    if (skip) { if (/poz\.\s*946\./.test(l)) skip = false; continue }
    out.push(l)
  }
  return out
}

const raw = await extractLines()
const lines = clean(raw)
const startPre = lines.findIndex((l) => l.startsWith('W trosce'))
const firstRoz = lines.findIndex((l) => /^Rozdział\s+[IVX]+$/.test(l))
const preambula = lines.slice(startPre, firstRoz).join(' ').replace(/\s+/g,' ').trim()

const rozdzialy = []
let roz = null, art = null, ustep = null, punkt = null, expectTitle = false
const appendText = (s) => { if (punkt) punkt.text += ' ' + s; else if (ustep) ustep.text += ' ' + s }

for (let i = firstRoz; i < lines.length; i++) {
  const l = lines[i]
  const mRoz = /^Rozdział\s+([IVX]+)$/.exec(l)
  if (mRoz) { roz = { nr: mRoz[1], slug: ROZDZIAL_SLUG[mRoz[1]], tytul:'', od:0, do:0, elementy:[] }; rozdzialy.push(roz); art=ustep=punkt=null; expectTitle=true; continue }
  if (expectTitle) {
    if (/^Art\.\s+\d+\./.test(l) || SEKCJE.has(l)) { expectTitle = false }
    else { roz.tytul = roz.tytul ? roz.tytul + ' ' + l : l; continue }
  }
  if (SEKCJE.has(l)) { roz.elementy.push({ sekcja: l }); art=ustep=punkt=null; continue }
  const mArt = /^Art\.\s+(\d+)\.\s?(.*)$/.exec(l)
  if (mArt) {
    art = { nr: Number(mArt[1]), ustepy: [] }; roz.elementy.push({ artykul: art }); ustep=punkt=null
    const rest = mArt[2]; const mU = /^(\d+)\.\s+(.*)$/.exec(rest)
    if (mU) { ustep = { nr: mU[1], text: mU[2] }; art.ustepy.push(ustep) }
    else if (rest) { ustep = { nr: null, text: rest }; art.ustepy.push(ustep) }
    continue
  }
  if (!art) continue
  const mPkt = /^(\d+)\)\s+(.*)$/.exec(l)
  if (mPkt) { if (!ustep) { ustep = { nr:null, text:'' }; art.ustepy.push(ustep) } if (!ustep.punkty) ustep.punkty = []; punkt = { nr: mPkt[1], text: mPkt[2] }; ustep.punkty.push(punkt); continue }
  const mUst = /^(\d+)\.\s+(.*)$/.exec(l)
  if (mUst) { ustep = { nr: mUst[1], text: mUst[2] }; punkt=null; art.ustepy.push(ustep); continue }
  appendText(l)
}
for (const r of rozdzialy) { const nums = r.elementy.filter(e=>e.artykul).map(e=>e.artykul.nr); r.od=Math.min(...nums); r.do=Math.max(...nums) }

const konst = { meta: { tytul:'Konstytucja Rzeczypospolitej Polskiej', uchwalona:'1997-04-02', weszla:'1997-10-17', dziennik:'Dz.U. 1997 nr 78 poz. 483' }, preambula, rozdzialy }
mkdirSync(path.join(ROOT,'data'), { recursive:true }); mkdirSync(path.join(ROOT,'public','konstytucja'), { recursive:true })
writeFileSync(path.join(ROOT,'data','konstytucja.json'), JSON.stringify(konst))
const search = []
for (const r of rozdzialy) for (const e of r.elementy) if (e.artykul) {
  const flat = e.artykul.ustepy.map(u => (u.nr?u.nr+'. ':'')+u.text+(u.punkty?' '+u.punkty.map(p=>p.nr+') '+p.text).join(' '):'')).join(' ')
  search.push({ art: e.artykul.nr, roz: r.slug, text: flat })
}
writeFileSync(path.join(ROOT,'public','konstytucja','search.json'), JSON.stringify(search))

const allArts = rozdzialy.flatMap(r => r.elementy.filter(e=>e.artykul).map(e=>e.artykul.nr))
const g = (n)=>search.find(s=>s.art===n)?.text
console.log('Rozdziałów:', rozdzialy.length)
console.log('Artykułów:', allArts.length, 'min/max', Math.min(...allArts), Math.max(...allArts))
console.log('Preambuła:', preambula.slice(0,52))
console.log('Art.1:', g(1))
console.log('Art.2:', g(2))
console.log('Art.30:', g(30))
console.log('Art.243:', g(243))
console.log('Rozdziały:', rozdzialy.map(r=>`${r.nr}(${r.od}-${r.do})`).join(' '))
const problems=[]
if (rozdzialy.length!==13) problems.push('rozdz!=13')
if (allArts.length!==243) problems.push('art!=243')
if (!/^W trosce o byt i przyszłość naszej Ojczyzny,/.test(preambula)) problems.push('preambula')
if (g(1)!=='Rzeczpospolita Polska jest dobrem wspólnym wszystkich obywateli.') problems.push('art1')
console.log(problems.length ? '✖ '+problems.join('; ') : '✔ OK')
