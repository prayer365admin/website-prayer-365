import 'dotenv/config'
import fs from 'fs'
import path from 'path'

// Define the output file path for Sass variables
const outputPath = path.join(process.cwd(), 'src', 'styles', '_variables.scss')
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath)
}

// Read environment variables
const sassVariables = `
$primary_color: ${process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#F36E69'};
$second_color: ${process.env.NEXT_PUBLIC_SECONDARY_COLOR || '#8C2425'};
$accent_color_1: ${process.env.NEXT_PUBLIC_ACCENT_COLOR_1 || '#E9262C'};
$accent_color_2: ${process.env.NEXT_PUBLIC_ACCENT_COLOR_2 || '#F8AFA8'};
$black_color: ${process.env.NEXT_PUBLIC_BLACK_COLOR || '#09080D'};
$white_color: ${process.env.NEXT_PUBLIC_WHITE_COLOR || '#FFF'};
`

// Write the Sass variables to the file
fs.writeFileSync(outputPath, sassVariables, 'utf8')
