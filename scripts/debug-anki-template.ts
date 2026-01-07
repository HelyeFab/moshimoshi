import fs from 'fs'
import path from 'path'
import { AnkiParser } from '../src/lib/anki/parser'

class FileSimulator {
  private buffer: Buffer
  name: string
  size: number
  type: string

  constructor(buffer: Buffer, filename: string) {
    this.buffer = buffer
    this.name = filename
    this.size = buffer.length
    this.type = 'application/zip'
  }

  async arrayBuffer() {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    )
  }
}

async function main() {
  const filePath =
    '/home/beano/Downloads/Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images.apkg'
  const fileBuffer = fs.readFileSync(filePath)
  const file = new FileSimulator(fileBuffer, path.basename(filePath))

  const result = await AnkiParser.parseApkg(file as any)
  const deck = result.decks[0]

  console.log('Deck:', deck?.name, 'Cards:', deck?.cards?.length)

  const sample = deck?.cards?.slice(0, 5) || []
  for (const card of sample) {
    console.log('--- Card ---')
    console.log('Front:', card.front)
    console.log('Back:', card.back)
    console.log('Audio:', card.audioFilename)
    console.log('Image:', card.imageFilename)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
