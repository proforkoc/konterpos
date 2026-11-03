import { db } from './index.ts';
import { users } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    // If it's the first user or email matches, default to owner
    const existing = await db.select().from(users);
    const assignedRole = existing.length === 0 ? 'owner' : 'cashier';

    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || 'Operator Konter',
        role: assignedRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Database user sync failed', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.id));
  } catch (error) {
    console.error('Failed to get all users:', error);
    throw new Error('Gagal mengambil daftar pengguna', { cause: error });
  }
}

export async function createUser(data: {
  email: string;
  name: string;
  role: string;
  pin?: string;
}) {
  try {
    const syntheticUid = `staff-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const [created] = await db
      .insert(users)
      .values({
        uid: syntheticUid,
        email: data.email,
        name: data.name,
        role: data.role || 'cashier',
        pin: data.pin || '1234',
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Failed to create user:', error);
    throw new Error('Gagal menambahkan pengguna baru', { cause: error });
  }
}

export async function verifyUserPin(userId: number, pin: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { success: false, message: 'Pengguna tidak ditemukan' };
    if (user.pin === pin) {
      return { success: true, user };
    }
    return { success: false, message: 'PIN yang dimasukkan salah' };
  } catch (error) {
    console.error('Failed to verify user PIN:', error);
    throw new Error('Gagal memverifikasi PIN', { cause: error });
  }
}

export async function updateUserPin(userId: number, pin: string) {
  try {
    const [updated] = await db
      .update(users)
      .set({ pin })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to update PIN:', error);
    throw new Error('Gagal memperbarui PIN', { cause: error });
  }
}

export async function updateUserRole(id: number, role: string) {
  try {
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();

    return updated;
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw new Error('Gagal memperbarui hak akses peran pengguna', { cause: error });
  }
}

export async function authenticateUser(identifier: string, secret: string) {
  try {
    const all = await db.select().from(users);
    const cleanId = identifier.trim().toLowerCase();
    const cleanSecret = secret.trim();

    // Match by email, username part, name, or role
    const matched = all.find((u) => {
      const email = u.email.toLowerCase();
      const name = (u.name || '').toLowerCase();
      const role = u.role.toLowerCase();
      const emailPrefix = email.split('@')[0];

      if (email === cleanId || emailPrefix === cleanId) return true;
      if (cleanId === 'owner' && role === 'owner') return true;
      if (cleanId === 'kasir' && role === 'cashier') return true;
      if (cleanId === 'cashier' && role === 'cashier') return true;
      if (cleanId === 'manager' && role === 'manager') return true;
      if (cleanId === 'teknisi' && role === 'technician') return true;
      if (name.includes(cleanId) && cleanId.length >= 3) return true;

      return false;
    });

    if (!matched) {
      return { success: false, message: 'Username atau Email tidak ditemukan' };
    }

    if (matched.pin === cleanSecret) {
      return { success: true, user: matched };
    }

    return { success: false, message: 'Password atau PIN salah. Silakan coba lagi.' };
  } catch (error) {
    console.error('Failed to authenticate user:', error);
    throw new Error('Gagal memproses otentikasi pengguna', { cause: error });
  }
}

export async function updateUser(id: number, data: { name?: string; role?: string; pin?: string }) {
  try {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined && data.name.trim() !== '') {
      updateData.name = data.name.trim();
    }
    if (data.role !== undefined && data.role.trim() !== '') {
      updateData.role = data.role.trim();
    }
    if (data.pin !== undefined && data.pin.trim() !== '') {
      updateData.pin = data.pin.trim();
    }

    if (Object.keys(updateData).length === 0) {
      const [current] = await db.select().from(users).where(eq(users.id, id));
      return current;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return updated;
  } catch (error) {
    console.error('Failed to update user:', error);
    throw new Error('Gagal memperbarui data pengguna', { cause: error });
  }
}

export async function deleteUser(id: number) {
  try {
    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      throw new Error('Pengguna tidak ditemukan');
    }
    if (existing.role === 'owner') {
      throw new Error('Akun Pemilik Utama (Owner) tidak dapat dihapus untuk melindungi hak akses administratif sistem');
    }
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

