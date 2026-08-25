import { prisma } from './src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const users = await prisma.user.findMany()
  console.log("Total Users:", users.length)
  for (const user of users) {
    console.log("User:", user.email, user.role)
    if (user.email === 'owner@phoneshop.lk') {
      console.log("match admin:", await bcrypt.compare('changeme123', user.password))
    }
    if (user.email === 'john@phoneshop.lk') {
      console.log("match emp:", await bcrypt.compare('employee123', user.password))
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
