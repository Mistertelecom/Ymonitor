import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createDemoUser() {
  try {
    // Check if demo user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@ymonitor.com' },
    });

    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create demo user
    const user = await prisma.user.create({
      data: {
        email: 'admin@ymonitor.com',
        username: 'admin',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('Demo user created successfully:');
    console.log('Email: admin@ymonitor.com');
    console.log('Password: admin123');
    console.log('Role: ADMIN');
    console.log('User ID:', user.id);
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();