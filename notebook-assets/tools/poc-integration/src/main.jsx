import React, { useRef, useEffect, forwardRef } from 'react'
import { createRoot } from 'react-dom/client'
import HTMLFlipBook from 'react-pageflip'
import * as fabric from 'fabric'
import { remove, rembgConfig, newSession } from '@bunnio/rembg-web'
import { get, set } from 'idb-keyval'

const results = {}
const log = (k, v) => { results[k] = v; document.getElementById('out').textContent = JSON.stringify(results, null, 1) }
const Page = forwardRef((p, ref) => <div ref={ref}><div style={{background:p.bg,height:'100%',boxSizing:'border-box',padding:12,boxShadow:'inset 0 0 0 1px #C8D4E8',fontSize:28,fontFamily:'Georgia',color:p.bg==='#2E5BB8'?'#fff':'#0A1A44'}}>{p.children}</div></div>)

function App() {
  const book = useRef(null)
  useEffect(() => { log('react', React.version); window.__book = book }, [])
  const bgs = ['#2E5BB8','#F4F7FC','#EAF1FB','#D6E2F7','#F4F7FC','#2E5BB8']
  return (
    <HTMLFlipBook ref={book} width={300} height={420} showCover={true} flippingTime={800} maxShadowOpacity={0.4}
      drawShadow={true} usePortrait={true} mobileScrollSupport={true} size="fixed"
      onFlip={(e) => log('flip_page_index', e.data)} onInit={() => log('pageflip_init', true)} style={{}}>
      {['Cover','One','Two','Three','Four','Back'].map((t, i) => <Page key={i} bg={bgs[i]}>{t}</Page>)}
    </HTMLFlipBook>
  )
}
const root = createRoot(document.getElementById('root'))
root.render(<App />)

window.__runTests = async () => {
  // 1. page flip
  try {
    await new Promise(r => setTimeout(r, 600))
    const el = document.querySelector('.stf__parent'); log('pageflip_dom', !!el)
  } catch (e) { log('pageflip_err', String(e)) }
  // 2. fabric canvas + object model + JSON roundtrip
  try {
    const c = document.createElement('canvas'); c.width = 400; c.height = 400; document.body.appendChild(c)
    const fc = new fabric.Canvas(c)
    const img = await fabric.FabricImage.fromURL('/test/photo.jpg')
    img.scale(0.2); img.set({ left: 50, top: 40, angle: 12 }); fc.add(img); fc.requestRenderAll()
    const json = fc.toJSON()
    const fc2 = new fabric.Canvas(document.createElement('canvas'))
    await fc2.loadFromJSON(json)
    const o = fc2.getObjects()[0]
    log('fabric', { version: fabric.version ?? 'n/a', objects: fc2.getObjects().length, angle: o.angle, left: o.left, jsonBytes: JSON.stringify(json).length })
  } catch (e) { log('fabric_err', String(e)) }
  // 3. idb-keyval blob roundtrip
  try {
    const blob = await (await fetch('/test/photo.jpg')).blob(); await set('photo', blob); const b2 = await get('photo')
    log('idb', { stored: blob.size, read: b2?.size, same: b2?.size === blob.size })
  } catch (e) { log('idb_err', String(e)) }
  // 4. rembg-web with self-hosted model
  for (const model of ['u2netp', 'silueta']) {
    try {
      rembgConfig.setBaseUrl('/models')
      const t = performance.now(); const prog = []
      const session = await newSession(model)
      const blob = await (await fetch('/test/photo.jpg')).blob()
      const out = await remove(blob, { session, onProgress: i => prog.push(i.step) })
      const bmp = await createImageBitmap(out)
      const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0)
      const d = cx.getImageData(0, 0, bmp.width, bmp.height).data; let tr = 0, op = 0
      for (let i = 3; i < d.length; i += 4) { if (d[i] < 16) tr++; else if (d[i] > 240) op++ }
      const n = d.length / 4
      log('rembg_' + model, { type: out.type, w: bmp.width, h: bmp.height, transparent: +(tr / n).toFixed(2), opaque: +(op / n).toFixed(2), ms: Math.round(performance.now() - t), steps: [...new Set(prog)] })
      window.__lastBlob = out
    } catch (e) { log('rembg_' + model + '_err', String(e && e.message || e)) }
  }
  log('done', true)
}
