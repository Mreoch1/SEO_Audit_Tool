#!/usr/bin/env node
/**
 * Create Admin User
 * 
 * Usage:
 *   npm run create-user -- --email=admin@example.com --password=securepassword
 * 
 * Or use tsx directly:
 *   tsx scripts/createUser.ts --email=admin@example.com --password=securepassword
 */

import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'

interface CliOptions {
  email?: string
  password?: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {}

  args.forEach(arg => {
    if (arg.startsWith('--email=')) {
      options.email = arg.split('=')[1]
    } else if (arg.startsWith('--password=')) {
      options.password = arg.split('=')[1]
    }
  })

  return options
}

async function main() {
  const options = parseArgs()

  if (!options.email || !options.password) {
    console.error('Error: --email and --password are required')
    console.log('\nUsage:')
    console.log('  npm run create-user -- --email=admin@example.com --password=securepassword')
    console.log('  Or: tsx scripts/createUser.ts --email=admin@example.com --password=securepassword')
    process.exit(1)
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: options.email }
    })

    if (existing) {
      console.error(`Error: User with email ${options.email} already exists`)
      process.exit(1)
    }

    // Hash password
    const passwordHash = await bcrypt.hash(options.password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: options.email,
        passwordHash
      }
    })

    console.log(`\n✅ User created successfully!`)
    console.log(`   Email: ${user.email}`)
    console.log(`   ID: ${user.id}\n`)
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

