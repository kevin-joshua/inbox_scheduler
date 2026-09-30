import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (two levels up from backend/prisma/)
config({ path: resolve(__dirname, '../../../.env') });
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

interface EtherealAccount {
  user: string;
  pass: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  web: string;
}

/**
 * Create an Ethereal email test account
 * Ethereal is a fake SMTP service for testing
 */
async function createEtherealAccount(): Promise<EtherealAccount> {
  const testAccount = await nodemailer.createTestAccount();
  return testAccount;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in development only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧹 Cleaning existing data...');
    await prisma.email.deleteMany();
    await prisma.batch.deleteMany();
    await prisma.sender.deleteMany();
    await prisma.slackInstall.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Data cleaned');
  }

  // Create test users
  console.log('\n👤 Creating test users...');
  
  const testUser1 = await prisma.user.create({
    data: {
      googleId: 'google-test-user-1',
      email: 'test.user1@example.com',
      name: 'Test User One',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
    },
  });
  console.log(`✅ Created user: ${testUser1.email} (${testUser1.id})`);

  const testUser2 = await prisma.user.create({
    data: {
      googleId: 'google-test-user-2',
      email: 'test.user2@example.com',
      name: 'Test User Two',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2',
    },
  });
  console.log(`✅ Created user: ${testUser2.email} (${testUser2.id})`);

  // Create Ethereal SMTP accounts for testing
  console.log('\n📧 Creating Ethereal SMTP test accounts...');
  console.log('ℹ️  Ethereal provides temporary SMTP servers for testing');
  console.log('ℹ️  These accounts work for 30 days and emails can be viewed at ethereal.email');

  const senders = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`\n⏳ Creating Ethereal account ${i}/3...`);
    const account = await createEtherealAccount();
    
    const sender = await prisma.sender.create({
      data: {
        userId: i <= 2 ? testUser1.id : testUser2.id, // First 2 for user1, 1 for user2
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPass: account.pass,
      },
    });

    senders.push({
      sender,
      webUrl: account.web,
    });

    console.log(`✅ Created sender ${i}:`);
    console.log(`   Email: ${sender.email}`);
    console.log(`   SMTP: ${sender.smtpHost}:${sender.smtpPort}`);
    console.log(`   Web UI: ${account.web}`);
    console.log(`   Credentials: ${account.user} / ${account.pass}`);
  }

  // Create sample batch and emails
  console.log('\n📬 Creating sample email batch...');
  
  const batch = await prisma.batch.create({
    data: {
      userId: testUser1.id,
      subject: 'Welcome to ReachInbox Email Scheduler',
      body: `
Hello!

This is a test email from the ReachInbox Email Scheduler.

This system allows you to:
- Schedule emails to be sent at specific times
- Send bulk emails with customizable delays
- Monitor email delivery status
- Integrate with Slack for notifications

Best regards,
ReachInbox Team
      `.trim(),
      startAt: new Date(Date.now() + 60000), // Start in 1 minute
      delayMs: 5000, // 5 seconds between emails
      hourlyLimit: 50,
    },
  });
  console.log(`✅ Created batch: ${batch.id}`);

  // Create sample emails in the batch
  const recipients = [
    'recipient1@test.ethereal.email',
    'recipient2@test.ethereal.email',
    'recipient3@test.ethereal.email',
  ];

  for (let i = 0; i < recipients.length; i++) {
    const scheduledAt = new Date(batch.startAt.getTime() + i * batch.delayMs);
    
    await prisma.email.create({
      data: {
        batchId: batch.id,
        userId: testUser1.id,
        senderId: senders[0].sender.id,
        recipient: recipients[i],
        subject: batch.subject,
        body: batch.body,
        scheduledAt,
        status: 'SCHEDULED',
      },
    });
  }
  console.log(`✅ Created ${recipients.length} sample emails`);

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('🎉 Database seeding completed successfully!');
  console.log('='.repeat(80));
  
  console.log('\n📊 Summary:');
  console.log(`   Users created: 2`);
  console.log(`   SMTP senders created: ${senders.length}`);
  console.log(`   Batches created: 1`);
  console.log(`   Emails scheduled: ${recipients.length}`);

  console.log('\n🔑 Test Users:');
  console.log(`   1. ${testUser1.email} (${testUser1.id})`);
  console.log(`   2. ${testUser2.email} (${testUser2.id})`);

  console.log('\n📧 SMTP Senders (Ethereal):');
  senders.forEach((s, idx) => {
    console.log(`\n   ${idx + 1}. ${s.sender.email}`);
    console.log(`      Owner: ${s.sender.userId === testUser1.id ? testUser1.email : testUser2.email}`);
    console.log(`      SMTP: ${s.sender.smtpHost}:${s.sender.smtpPort}`);
    console.log(`      View emails: ${s.webUrl}`);
  });

  console.log('\n💡 Next Steps:');
  console.log('   1. Start the backend: cd backend && npm run dev');
  console.log('   2. Start the frontend: cd frontend && npm run dev');
  console.log('   3. Visit http://localhost:3000/dashboard to see scheduled emails');
  console.log('   4. Check Bull Board: http://localhost:4000/admin/queues');
  console.log('\n');
}

main()
  .catch((error) => {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
