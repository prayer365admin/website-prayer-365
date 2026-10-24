/* eslint-disable no-console */
import { existsSync, readdirSync, renameSync, statSync } from 'fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const DIR = ['public/videos']

main()

function main() {
  DIR.forEach((dir) => {
    if (!existsSync(dir)) {
      console.log(`${dir} not found`)
      return
    }

    const files = readdirSync(dir)

    files.forEach((file) => {
      // Skip temporary files
      if (file.endsWith('.webm')) return
      // Process mp4, ogg, or existing webm
      if (!['.mp4', '.ogg'].some((f) => file.endsWith(f))) return

      const filePath = join(dir, file)
      const fileStat = statSync(filePath)
      const fileName = file.slice(0, file.lastIndexOf('.'))

      if (fileStat.isFile()) {
        const outPath = join(dir, `${fileName}.webm`)
        console.log(`Compressing: ${filePath} -> ${outPath}`)

        // Optimized VP9 encoding for web backgrounds
        // -crf 38: Aggressive compression (good for bg video)
        // -b:v 0: Let CRF control quality
        // -deadline good -cpu-used 2: Balance of speed/compression
        const sp = spawn('ffmpeg', [
          '-i',
          filePath,
          '-vf',
          "scale='min(1280,iw)':-2,fps=24",
          '-c:v',
          'libvpx-vp9',
          '-crf',
          '38',
          '-b:v',
          '0',
          '-deadline',
          'good',
          '-cpu-used',
          '2',
          '-row-mt',
          '1',
          '-an', // Background video, strip audio
          '-y',
          outPath,
        ])

        sp.stdout.on('data', (data) => console.log(data.toString()))
        sp.stderr.on('data', (data) => console.error(data.toString()))

        sp.on('error', (e) => console.error(e))
        sp.on('close', (code) => {
          if (code === 0) {
            const finalPath = join(dir, `${fileName}.webm`)
            renameSync(outPath, finalPath)
            console.log(`Successfully compressed ${finalPath}`)
          } else {
            console.error(`Failed to compress ${file}, ffmpeg exited with code ${code}`)
          }
        })
      }
    })
  })
}
