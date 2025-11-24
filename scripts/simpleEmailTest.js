const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testEmail() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' }
    });

    if (!settings) {
      console.error('❌ No settings found');
      process.exit(1);
    }

    console.log('📧 Testing SMTP connection...\n');
    console.log('Config:');
    console.log(`  Host: ${settings.smtpHost}`);
    console.log(`  Port: ${settings.smtpPort}`);
    console.log(`  User: ${settings.smtpUser}\n`);

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    console.log('📤 Sending test email...');
    const info = await transporter.sendMail({
      from: `"SEO Audit Pro" <${settings.smtpFrom || settings.smtpUser}>`,
      to: 'mreoch82@hotmail.com',
      subject: 'Test Email - SMTP Working',
      html: `
        <h2>Test Email</h2>
        <p>If you received this, SMTP is working correctly!</p>
        <p>Time: ${new Date().toISOString()}</p>
      `
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`\n✨ Check your inbox at mreoch82@hotmail.com\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testEmail();

