import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import prisma from '../src/lib/prisma';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = 'demo@manasarora.dev';
  const password = 'Demo@2024';

  console.log(`Seeding user: ${email}`);

  // 1. Create in Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.status === 422 || authError.code === 'email_exists' || authError.message.includes('already')) {
      console.log('User already exists in Supabase Auth');
    } else {
      console.error('Error creating auth user:', authError);
      return;
    }
  }

  // 2. Create in Prisma
  // First fetch the auth user to get their ID
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = users.users.find((u) => u.email === email);

  if (authUser) {
    await prisma.user.upsert({
      where: { id: authUser.id },
      update: { role: 'ADMIN', isActive: true },
      create: {
        id: authUser.id,
        email: email,
        name: 'Demo Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`Successfully created Prisma profile for ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
