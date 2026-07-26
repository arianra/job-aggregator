import { PrismaClient } from '@prisma/client'

async function main() {
  const p = new PrismaClient()
  await p.application.deleteMany()
  await p.match.deleteMany()
  await p.source.deleteMany()
  await p.job.deleteMany()
  await p.company.deleteMany()
  await p.profile.deleteMany()
  await p.board.deleteMany()
  console.log('All data cleared')
  await p.$disconnect()
}

main().catch(console.error)
