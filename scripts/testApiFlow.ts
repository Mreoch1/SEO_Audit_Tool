#!/usr/bin/env node
/**
 * Test script to create an audit via API and email the report
 * Uses the actual API endpoints to test the full flow
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3000'
const URL = 'https://seoauditpro.net'
const EMAIL_TO = 'mreoch82@hotmail.com'

// Get user credentials from database
async function getCredentials() {
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  
  try {
    const user = await prisma.user.findFirst()
    if (!user) {
      throw new Error('No user found in database')
    }
    
    // We need the password, but it's hashed. Let's try to login with a test
    // For now, we'll need to manually provide credentials or use a test account
    return { email: user.email }
  } finally {
    await prisma.$disconnect()
  }
}

async function testFlow() {
  console.log('\n🧪 Testing SEO Audit API Flow\n')
  console.log(`URL: ${URL}`)
  console.log(`Email: ${EMAIL_TO}\n`)

  try {
    // Step 1: Create audit
    console.log('📝 Step 1: Creating audit...')
    const createResponse = await fetch(`${API_BASE}/api/audits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We'll need to handle auth - for now let's see what error we get
      },
      body: JSON.stringify({
        url: URL,
        maxPages: 5,
        maxDepth: 3,
        tier: 'starter'
      })
    })

    if (!createResponse.ok) {
      const error = await createResponse.text()
      console.error('❌ Failed to create audit:', error)
      console.log('\n💡 Note: This requires authentication. Please:')
      console.log('   1. Open http://localhost:3000 in your browser')
      console.log('   2. Login')
      console.log('   3. Create audit manually and email it')
      console.log('\n   OR run the direct test script: npm run test-direct')
      return
    }

    const { id, status } = await createResponse.json()
    console.log(`✅ Audit created: ${id} (status: ${status})\n`)

    // Step 2: Wait for audit to complete
    console.log('⏳ Step 2: Waiting for audit to complete...')
    let auditStatus = status
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max

    while (auditStatus === 'running' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      
      const statusResponse = await fetch(`${API_BASE}/api/audits/${id}`)
      if (statusResponse.ok) {
        const audit = await statusResponse.json()
        auditStatus = audit.status
        if (auditStatus === 'completed') {
          console.log('✅ Audit completed!\n')
          break
        } else if (auditStatus === 'failed') {
          console.error('❌ Audit failed:', audit.shortSummary)
          return
        }
      }
      attempts++
      process.stdout.write('.')
    }

    if (auditStatus !== 'completed') {
      console.error('\n❌ Audit did not complete in time')
      return
    }

    // Step 3: Email the report
    console.log('📧 Step 3: Sending email...')
    const emailResponse = await fetch(`${API_BASE}/api/audits/${id}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailTo: EMAIL_TO
      })
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      console.error('❌ Failed to send email:', error)
      return
    }

    const emailResult = await emailResponse.json()
    console.log('✅ Email sent successfully!')
    console.log(`\n✨ Check your inbox at ${EMAIL_TO}\n`)

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
  }
}

testFlow()


