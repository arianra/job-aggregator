import fs from 'fs'
import path from 'path'
import { fitnessAudit, extractTemplate } from './lib/extract.js'

/**
 * ADR-0010 build path step 2 — extract-template.
 *   npx tsx scripts/extract-template.ts <file.docx> [name] [--out <dir>]
 *
 * Runs the fitness audit (rejects tables/textboxes/images/multi-column), then
 * extracts a candidate ResumeTemplate config + extraction-report.json. Emits
 * candidate.json + extraction-report.json in <out>.
 */
async function main(argv: string[]) {
  const positional: string[] = []
  let out = '.'
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && i + 1 < argv.length) out = argv[i + 1]
    else positional.push(argv[i])
  }
  const docxPath = positional[0]
  const name = positional[1] ?? 'extracted'
  if (!docxPath) {
    console.error('usage: extract-template <file.docx> [name] [--out <dir>]')
    process.exit(2)
  }
  const bytes = fs.readFileSync(docxPath)

  const audit = await fitnessAudit(bytes)
  const extraction = await extractTemplate(bytes, docxPath)

  fs.mkdirSync(out, { recursive: true })
  const reportPath = path.join(out, 'extraction-report.json')
  const candidatePath = path.join(out, 'candidate.json')
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { audit, ...extraction.report, page: extraction.page, fonts: extraction.fonts, sizesHalfPoints: extraction.sizesHalfPoints, line240ths: extraction.line240ths },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  fs.writeFileSync(candidatePath, JSON.stringify({ id: name, ...extraction }, null, 2) + '\n', 'utf8')

  if (!audit.pass) {
    console.error(`FITNESS AUDIT FAILED (${name}): ${audit.failures.join('; ')}`)
    console.error(`report written to ${reportPath}`)
    process.exit(1)
  }
  console.log(`OK (${name}): ${audit.failures.length || 'no'} audit failures`)
  console.log(`  page ${extraction.page.widthTwips}×${extraction.page.heightTwips}, margins ${extraction.page.marginTopTwips}tw`)
  console.log(`  fonts ${extraction.fonts.body} / ${extraction.fonts.bold}`)
  console.log(`  sizes ${JSON.stringify(extraction.sizesHalfPoints)} line ${extraction.line240ths}/240`)
  console.log(`  report ${reportPath}; candidate ${candidatePath}`)
  return 0
}

main(process.argv.slice(2)).then(
  (c) => process.exitCode = c,
  (e) => {
    console.error(e)
    process.exitCode = 1
  },
)