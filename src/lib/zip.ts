const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function w16(dv: DataView, o: number, v: number) { dv.setUint16(o, v, true) }
function w32(dv: DataView, o: number, v: number) { dv.setUint32(o, v, true) }

function toBytes(s: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(s).buffer as ArrayBuffer)
}

export function createZipBlob(files: { name: string; content: string }[]): Blob {
  const parts: BlobPart[] = []
  type Entry = { nb: Uint8Array; dataLen: number; crc: number; offset: number }
  const entries: Entry[] = []
  let off = 0

  for (const file of files) {
    const nb = toBytes(file.name)
    const data = toBytes(file.content)
    const crc = crc32(data)

    const lhBuf = new ArrayBuffer(30 + nb.length)
    const lh = new DataView(lhBuf)
    w32(lh, 0, 0x04034b50); w16(lh, 4, 20); w16(lh, 6, 0); w16(lh, 8, 0)
    w16(lh, 10, 0); w16(lh, 12, 0)
    w32(lh, 14, crc); w32(lh, 18, data.length); w32(lh, 22, data.length)
    w16(lh, 26, nb.length); w16(lh, 28, 0)
    new Uint8Array(lhBuf).set(nb, 30)

    entries.push({ nb, dataLen: data.length, crc, offset: off })
    parts.push(lhBuf, data)
    off += 30 + nb.length + data.length
  }

  const cdOffset = off
  for (const e of entries) {
    const cdBuf = new ArrayBuffer(46 + e.nb.length)
    const cd = new DataView(cdBuf)
    w32(cd, 0, 0x02014b50); w16(cd, 4, 20); w16(cd, 6, 20); w16(cd, 8, 0); w16(cd, 10, 0)
    w16(cd, 12, 0); w16(cd, 14, 0)
    w32(cd, 16, e.crc); w32(cd, 20, e.dataLen); w32(cd, 24, e.dataLen)
    w16(cd, 28, e.nb.length); w16(cd, 30, 0); w16(cd, 32, 0)
    w16(cd, 34, 0); w16(cd, 36, 0); w32(cd, 38, 0)
    w32(cd, 42, e.offset)
    new Uint8Array(cdBuf).set(e.nb, 46)
    parts.push(cdBuf)
    off += 46 + e.nb.length
  }

  const cdSize = off - cdOffset
  const eocdBuf = new ArrayBuffer(22)
  const eocd = new DataView(eocdBuf)
  w32(eocd, 0, 0x06054b50); w16(eocd, 4, 0); w16(eocd, 6, 0)
  w16(eocd, 8, entries.length); w16(eocd, 10, entries.length)
  w32(eocd, 12, cdSize); w32(eocd, 16, cdOffset); w16(eocd, 20, 0)
  parts.push(eocdBuf)

  return new Blob(parts, { type: 'application/zip' })
}
